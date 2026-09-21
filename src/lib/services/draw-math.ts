import {
  SCORE_MIN,
  SCORE_MAX,
  DRAW_NUMBERS_COUNT,
  PRIZE_TIER_SPLITS,
} from "../config/constants";

export type WinningTier = "tier_5" | "tier_4" | "tier_3" | null;

export interface MatchResult {
  matchesCount: number;
  matchedNumbers: number[];
  winningTier: WinningTier;
}

export interface SubscriberPoolInput {
  plan_type: "monthly" | "yearly";
  amount: number;
}

export interface PrizePoolBreakdown {
  subscriptionPoolPaise: number;
  rolloverJackpotInPaise: number;
  totalPrizePoolPaise: number;
  tier5PoolPaise: number;
  tier4PoolPaise: number;
  tier3PoolPaise: number;
  // Rupee equivalents
  subscription_pool_portion: number;
  rollover_jackpot_in: number;
  total_prize_pool: number;
  tier_5_pool: number;
  tier_4_pool: number;
  tier_3_pool: number;
}

export interface DrawEntryCandidate {
  id: string;
  userId: string;
  winningTier: WinningTier;
  prizeAmount?: number;
  prizeAmountPaise?: number;
}

export interface PrizeAllocationResult {
  allocatedEntries: Array<
    DrawEntryCandidate & { prizeAmount: number; prizeAmountPaise: number }
  >;
  tier5WinnersCount: number;
  tier4WinnersCount: number;
  tier3WinnersCount: number;
  rolloverJackpotOutPaise: number;
  rollover_jackpot_out: number;
  jackpotRolledOver: boolean;
  unclaimedTier4Paise: number;
  unclaimed_tier_4: number;
  unclaimedTier3Paise: number;
  unclaimed_tier_3: number;
}

/**
 * Pure Draw Mathematical & Business Logic Engine
 * Zero side-effects, no database calls, no environment access.
 */
export class DrawMath {
  /**
   * Generates 5 distinct winning numbers between 1 and 45.
   * - RANDOM: Uniform random sampling without replacement.
   * - ALGORITHMIC: Weighted random sampling without replacement using raw score frequencies.
   *   Formula: weight(n) = 1 + frequency(n) for all n in [1, 45].
   * Returns numbers sorted in ascending order.
   */
  static generateDrawnNumbers(
    mode: "random" | "algorithmic",
    populationScores?: number[],
    rng: () => number = Math.random
  ): number[] {
    if (mode === "random") {
      const pool: number[] = [];
      for (let n = SCORE_MIN; n <= SCORE_MAX; n++) {
        pool.push(n);
      }

      // Fisher-Yates shuffle
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const temp = pool[i];
        pool[i] = pool[j];
        pool[j] = temp;
      }

      return pool.slice(0, DRAW_NUMBERS_COUNT).sort((a, b) => a - b);
    }

    // ALGORITHMIC MODE
    // 1. Tally raw score frequencies from eligible participants
    const frequencies = new Map<number, number>();
    for (let n = SCORE_MIN; n <= SCORE_MAX; n++) {
      frequencies.set(n, 0);
    }

    if (populationScores) {
      for (const score of populationScores) {
        if (
          typeof score !== "number" ||
          !Number.isInteger(score) ||
          score < SCORE_MIN ||
          score > SCORE_MAX
        ) {
          throw new Error(
            `Invalid score in populationScores: ${score}. Must be integer between ${SCORE_MIN} and ${SCORE_MAX}.`
          );
        }
        frequencies.set(score, (frequencies.get(score) ?? 0) + 1);
      }
    }

    // 2. Compute weights: weight(n) = 1 + frequency(n)
    // Zero-frequency numbers retain a baseline weight of 1.
    const availableNumbers: number[] = [];
    const weights = new Map<number, number>();

    for (let n = SCORE_MIN; n <= SCORE_MAX; n++) {
      availableNumbers.push(n);
      weights.set(n, 1 + (frequencies.get(n) ?? 0));
    }

    const drawn: number[] = [];

    // 3. Weighted sampling without replacement
    for (let pick = 0; pick < DRAW_NUMBERS_COUNT; pick++) {
      let totalWeight = 0;
      for (const num of availableNumbers) {
        totalWeight += weights.get(num) ?? 0;
      }

      if (totalWeight <= 0) {
        throw new Error("Unable to draw numbers: total weight is non-positive.");
      }

      // Generate random threshold in [0, totalWeight)
      const threshold = rng() * totalWeight;
      let accumulated = 0;
      let selectedIndex = -1;

      for (let i = 0; i < availableNumbers.length; i++) {
        accumulated += weights.get(availableNumbers[i]) ?? 0;
        if (accumulated > threshold) {
          selectedIndex = i;
          break;
        }
      }

      // Fallback for edge precision
      if (selectedIndex === -1) {
        selectedIndex = availableNumbers.length - 1;
      }

      const selectedNumber = availableNumbers[selectedIndex];
      drawn.push(selectedNumber);

      // Remove selected number from available pool
      availableNumbers.splice(selectedIndex, 1);
    }

    return drawn.sort((a, b) => a - b);
  }

  /**
   * Evaluates matches between a user's retained scores and the drawn numbers.
   * User scores are deduplicated so duplicate score values never inflate match count.
   * Matching is order-independent.
   * Tiers:
   * - 5 matches -> 'tier_5'
   * - 4 matches -> 'tier_4'
   * - 3 matches -> 'tier_3'
   * - <3 matches -> null
   */
  static calculateMatches(
    userScores: number[],
    drawnNumbers: number[]
  ): MatchResult {
    // 1. Deduplicate user scores for matching
    const distinctScores = new Set(userScores);

    // 2. Order-independent intersection
    const matchedNumbers = drawnNumbers
      .filter((num) => distinctScores.has(num))
      .sort((a, b) => a - b);

    const matchesCount = matchedNumbers.length;

    let winningTier: WinningTier = null;
    if (matchesCount === 5) {
      winningTier = "tier_5";
    } else if (matchesCount === 4) {
      winningTier = "tier_4";
    } else if (matchesCount === 3) {
      winningTier = "tier_3";
    }

    return {
      matchesCount,
      matchedNumbers,
      winningTier,
    };
  }

  /**
   * Calculates subscription pool portions and tier prize pools in integer paise.
   * - Monthly contribution: round(amountPaise * 30%)
   * - Yearly contribution: round((amountPaise * 30%) / 12)  [monthly amortization]
   * - Tier splits:
   *   tier_5 = round(subscriptionPool * 40%) + rolloverJackpotIn
   *   tier_4 = round(subscriptionPool * 35%)
   *   tier_3 = round(subscriptionPool * 25%)
   * Exact reconciliation: tier5_sub + tier4 + tier3 = subscriptionPool.
   */
  static calculatePrizePools(
    subscribers: SubscriberPoolInput[],
    rolloverJackpotIn: number = 0,
    prizePoolPercentage: number = 30
  ): PrizePoolBreakdown {
    let subscriptionPoolPaise = 0;

    for (const sub of subscribers) {
      const amountPaise = Math.round(sub.amount * 100);
      const totalPoolPortionPaise = amountPaise * (prizePoolPercentage / 100);

      if (sub.plan_type === "monthly") {
        subscriptionPoolPaise += Math.round(totalPoolPortionPaise);
      } else {
        // Annual subscription amortized monthly
        subscriptionPoolPaise += Math.round(totalPoolPortionPaise / 12);
      }
    }

    const rolloverJackpotInPaise = Math.round(rolloverJackpotIn * 100);

    // Reconcile tier allocations exactly in integer paise
    const tier4PoolPaise = Math.round(
      subscriptionPoolPaise * PRIZE_TIER_SPLITS.tier_4.share
    );
    const tier3PoolPaise = Math.round(
      subscriptionPoolPaise * PRIZE_TIER_SPLITS.tier_3.share
    );
    // Residual from 40% ensures tier5_sub + tier4 + tier3 === subscriptionPoolPaise
    const tier5SubPaise = subscriptionPoolPaise - tier4PoolPaise - tier3PoolPaise;
    const tier5PoolPaise = tier5SubPaise + rolloverJackpotInPaise;

    const totalPrizePoolPaise = subscriptionPoolPaise + rolloverJackpotInPaise;

    return {
      subscriptionPoolPaise,
      rolloverJackpotInPaise,
      totalPrizePoolPaise,
      tier5PoolPaise,
      tier4PoolPaise,
      tier3PoolPaise,
      subscription_pool_portion: subscriptionPoolPaise / 100,
      rollover_jackpot_in: rolloverJackpotInPaise / 100,
      total_prize_pool: totalPrizePoolPaise / 100,
      tier_5_pool: tier5PoolPaise / 100,
      tier_4_pool: tier4PoolPaise / 100,
      tier_3_pool: tier3PoolPaise / 100,
    };
  }

  /**
   * Allocates tier pools among winning entries.
   * Winners within a tier are sorted deterministically by userId ascending.
   * Base prize = floor(poolPaise / winnerCount).
   * Remainder paise are distributed +1 paise each to the first remainder winners.
   * Unclaimed amounts:
   * - Tier 5 with 0 winners -> rolloverJackpotOut = tier5Pool
   * - Tier 5 with >= 1 winners -> rolloverJackpotOut = 0
   * - Tier 4 with 0 winners -> unclaimedTier4 = tier4Pool
   * - Tier 3 with 0 winners -> unclaimedTier3 = tier3Pool
   */
  static allocatePrizes(
    entries: DrawEntryCandidate[],
    pools: {
      tier5PoolPaise: number;
      tier4PoolPaise: number;
      tier3PoolPaise: number;
    }
  ): PrizeAllocationResult {
    const allocatedEntries: Array<
      DrawEntryCandidate & { prizeAmount: number; prizeAmountPaise: number }
    > = [];

    const tier5Winners = entries
      .filter((e) => e.winningTier === "tier_5")
      .sort((a, b) => a.userId.localeCompare(b.userId));

    const tier4Winners = entries
      .filter((e) => e.winningTier === "tier_4")
      .sort((a, b) => a.userId.localeCompare(b.userId));

    const tier3Winners = entries
      .filter((e) => e.winningTier === "tier_3")
      .sort((a, b) => a.userId.localeCompare(b.userId));

    const nonWinners = entries.filter((e) => e.winningTier === null);

    // 1. Distribute Tier 5
    let rolloverJackpotOutPaise = 0;
    let jackpotRolledOver = false;

    if (tier5Winners.length > 0) {
      const wCount = tier5Winners.length;
      const basePrize = Math.floor(pools.tier5PoolPaise / wCount);
      const remainder = pools.tier5PoolPaise % wCount;

      for (let i = 0; i < wCount; i++) {
        const prizePaise = basePrize + (i < remainder ? 1 : 0);
        allocatedEntries.push({
          ...tier5Winners[i],
          prizeAmountPaise: prizePaise,
          prizeAmount: prizePaise / 100,
        });
      }
      rolloverJackpotOutPaise = 0;
      jackpotRolledOver = false;
    } else {
      rolloverJackpotOutPaise = pools.tier5PoolPaise;
      jackpotRolledOver = true;
    }

    // 2. Distribute Tier 4
    let unclaimedTier4Paise = 0;
    if (tier4Winners.length > 0) {
      const wCount = tier4Winners.length;
      const basePrize = Math.floor(pools.tier4PoolPaise / wCount);
      const remainder = pools.tier4PoolPaise % wCount;

      for (let i = 0; i < wCount; i++) {
        const prizePaise = basePrize + (i < remainder ? 1 : 0);
        allocatedEntries.push({
          ...tier4Winners[i],
          prizeAmountPaise: prizePaise,
          prizeAmount: prizePaise / 100,
        });
      }
      unclaimedTier4Paise = 0;
    } else {
      unclaimedTier4Paise = pools.tier4PoolPaise;
    }

    // 3. Distribute Tier 3
    let unclaimedTier3Paise = 0;
    if (tier3Winners.length > 0) {
      const wCount = tier3Winners.length;
      const basePrize = Math.floor(pools.tier3PoolPaise / wCount);
      const remainder = pools.tier3PoolPaise % wCount;

      for (let i = 0; i < wCount; i++) {
        const prizePaise = basePrize + (i < remainder ? 1 : 0);
        allocatedEntries.push({
          ...tier3Winners[i],
          prizeAmountPaise: prizePaise,
          prizeAmount: prizePaise / 100,
        });
      }
      unclaimedTier3Paise = 0;
    } else {
      unclaimedTier3Paise = pools.tier3PoolPaise;
    }

    // 4. Attach Non-Winners
    for (const nonWinner of nonWinners) {
      allocatedEntries.push({
        ...nonWinner,
        prizeAmountPaise: 0,
        prizeAmount: 0,
      });
    }

    return {
      allocatedEntries,
      tier5WinnersCount: tier5Winners.length,
      tier4WinnersCount: tier4Winners.length,
      tier3WinnersCount: tier3Winners.length,
      rolloverJackpotOutPaise,
      rollover_jackpot_out: rolloverJackpotOutPaise / 100,
      jackpotRolledOver,
      unclaimedTier4Paise,
      unclaimed_tier_4: unclaimedTier4Paise / 100,
      unclaimedTier3Paise,
      unclaimed_tier_3: unclaimedTier3Paise / 100,
    };
  }
}
