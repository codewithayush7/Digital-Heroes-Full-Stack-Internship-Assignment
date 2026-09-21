import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  drawnNumbersSchema,
  createDrawSchema,
} from "../src/lib/validations/draw.schema";
import {
  DrawMath,
  type DrawEntryCandidate,
} from "../src/lib/services/draw-math";

describe("Phase A: Pure Draw Math & Validation Tests", () => {
  // ==========================================================================
  // 1. DRAW NUMBER SCHEMA VALIDATION
  // ==========================================================================
  describe("1. drawnNumbersSchema", () => {
    test("accepts valid 5 distinct numbers between 1 and 45", () => {
      const valid = [1, 14, 22, 33, 45];
      const parsed = drawnNumbersSchema.safeParse(valid);
      assert.strictEqual(parsed.success, true);
      if (parsed.success) {
        assert.deepStrictEqual(parsed.data, valid);
      }
    });

    test("rejects array with fewer than 5 numbers", () => {
      const invalid = [5, 10, 15, 20];
      const parsed = drawnNumbersSchema.safeParse(invalid);
      assert.strictEqual(parsed.success, false);
      assert.ok(
        parsed.error.issues.some((i) =>
          i.message.includes("Draw must contain exactly 5 numbers")
        )
      );
    });

    test("rejects array with more than 5 numbers", () => {
      const invalid = [1, 2, 3, 4, 5, 6];
      const parsed = drawnNumbersSchema.safeParse(invalid);
      assert.strictEqual(parsed.success, false);
      assert.ok(
        parsed.error.issues.some((i) =>
          i.message.includes("Draw must contain exactly 5 numbers")
        )
      );
    });

    test("rejects array with duplicate numbers", () => {
      const duplicates = [7, 14, 21, 21, 35];
      const parsed = drawnNumbersSchema.safeParse(duplicates);
      assert.strictEqual(parsed.success, false);
      assert.ok(
        parsed.error.issues.some((i) =>
          i.message.includes("All drawn numbers must be distinct")
        )
      );
    });

    test("rejects number below 1", () => {
      const invalid = [0, 10, 20, 30, 40];
      const parsed = drawnNumbersSchema.safeParse(invalid);
      assert.strictEqual(parsed.success, false);
      assert.ok(
        parsed.error.issues.some((i) =>
          i.message.includes("Number must be at least 1")
        )
      );
    });

    test("rejects number above 45", () => {
      const invalid = [5, 15, 25, 35, 46];
      const parsed = drawnNumbersSchema.safeParse(invalid);
      assert.strictEqual(parsed.success, false);
      assert.ok(
        parsed.error.issues.some((i) =>
          i.message.includes("Number cannot exceed 45")
        )
      );
    });

    test("coerces string numbers to integers safely", () => {
      const strings = ["10", "20", "30", "40", "45"];
      const parsed = drawnNumbersSchema.safeParse(strings);
      assert.strictEqual(parsed.success, true);
      if (parsed.success) {
        assert.deepStrictEqual(parsed.data, [10, 20, 30, 40, 45]);
      }
    });
  });

  describe("1b. createDrawSchema", () => {
    test("accepts valid draw configuration", () => {
      const input = {
        title: "September 2026 Monthly Draw",
        draw_date: new Date().toISOString(),
        draw_mode: "algorithmic",
      };
      const parsed = createDrawSchema.safeParse(input);
      assert.strictEqual(parsed.success, true);
    });

    test("rejects title shorter than 3 characters", () => {
      const input = {
        title: "No",
        draw_date: new Date().toISOString(),
        draw_mode: "random",
      };
      const parsed = createDrawSchema.safeParse(input);
      assert.strictEqual(parsed.success, false);
    });

    test("rejects invalid draw date string", () => {
      const input = {
        title: "Valid Title",
        draw_date: "not-a-valid-date",
        draw_mode: "random",
      };
      const parsed = createDrawSchema.safeParse(input);
      assert.strictEqual(parsed.success, false);
    });

    test("rejects unsupported draw mode", () => {
      const input = {
        title: "Valid Title",
        draw_date: new Date().toISOString(),
        draw_mode: "super_lottery",
      };
      const parsed = createDrawSchema.safeParse(input);
      assert.strictEqual(parsed.success, false);
    });
  });

  // ==========================================================================
  // 2. RANDOM DRAW GENERATOR
  // ==========================================================================
  describe("2. Random Draw Generator", () => {
    test("generates exactly 5 distinct numbers in range 1-45 sorted ascending", () => {
      for (let run = 0; run < 20; run++) {
        const numbers = DrawMath.generateDrawnNumbers("random");
        assert.strictEqual(numbers.length, 5);
        // All distinct
        assert.strictEqual(new Set(numbers).size, 5);
        // All in range
        assert.ok(numbers.every((n) => n >= 1 && n <= 45 && Number.isInteger(n)));
        // Sorted ascending
        assert.deepStrictEqual(numbers, [...numbers].sort((a, b) => a - b));
      }
    });

    test("uses injected RNG deterministically for random mode", () => {
      let counter = 0;
      // Controlled sequence of fractions
      const predictableFractions = [0.1, 0.4, 0.7, 0.2, 0.9, 0.3, 0.5];
      const mockRng = () => {
        const val = predictableFractions[counter % predictableFractions.length];
        counter++;
        return val;
      };

      const numbers1 = DrawMath.generateDrawnNumbers("random", undefined, mockRng);
      counter = 0;
      const numbers2 = DrawMath.generateDrawnNumbers("random", undefined, mockRng);

      assert.deepStrictEqual(numbers1, numbers2);
      assert.strictEqual(numbers1.length, 5);
      assert.strictEqual(new Set(numbers1).size, 5);
    });
  });

  // ==========================================================================
  // 3. ALGORITHMIC (WEIGHTED) DRAW GENERATOR
  // ==========================================================================
  describe("3. Algorithmic (Weighted) Draw Generator", () => {
    test("counts raw score frequency without deduplication", () => {
      // User A scores: [36, 36, 34, 38, 36]
      // 36 appears 3 times, 34 once, 38 once.
      // Numbers with frequency 0 still have weight 1.
      // Number 36 has weight 1 + 3 = 4.
      const population = [36, 36, 34, 38, 36];
      const numbers = DrawMath.generateDrawnNumbers("algorithmic", population);

      assert.strictEqual(numbers.length, 5);
      assert.strictEqual(new Set(numbers).size, 5);
      assert.ok(numbers.every((n) => n >= 1 && n <= 45));
      assert.deepStrictEqual(numbers, [...numbers].sort((a, b) => a - b));
    });

    test("rejects out-of-range numbers in populationScores", () => {
      assert.throws(
        () => DrawMath.generateDrawnNumbers("algorithmic", [10, 20, 55]),
        /Invalid score in populationScores: 55/
      );
      assert.throws(
        () => DrawMath.generateDrawnNumbers("algorithmic", [0, 20, 30]),
        /Invalid score in populationScores: 0/
      );
    });

    test("zero-frequency numbers have non-zero probability and can be drawn", () => {
      // Population only has 36 and 38
      // If zero-frequency numbers had 0 probability, it would be impossible to pick 5 distinct numbers.
      // Because baseline weight is 1, all 5 distinct numbers are successfully selected without error.
      const sparsePopulation = [36, 36, 38, 38];
      const numbers = DrawMath.generateDrawnNumbers("algorithmic", sparsePopulation);

      assert.strictEqual(numbers.length, 5);
      assert.strictEqual(new Set(numbers).size, 5);
    });

    test("produces deterministic output with controlled injected RNG", () => {
      let callIndex = 0;
      const sequence = [0.05, 0.25, 0.5, 0.75, 0.95];
      const mockRng = () => {
        const v = sequence[callIndex % sequence.length];
        callIndex++;
        return v;
      };

      const population = [10, 10, 20, 20, 30, 40];
      const resultA = DrawMath.generateDrawnNumbers("algorithmic", population, mockRng);

      callIndex = 0;
      const resultB = DrawMath.generateDrawnNumbers("algorithmic", population, mockRng);

      assert.deepStrictEqual(resultA, resultB);
      assert.strictEqual(resultA.length, 5);
      assert.strictEqual(new Set(resultA).size, 5);
    });
  });

  // ==========================================================================
  // 4. SCORE MATCHING & DEDUPLICATION
  // ==========================================================================
  describe("4. Score Matching & Tier Assignment", () => {
    test("duplicate user scores count only once (PRD rule)", () => {
      const userScores = [36, 36, 34, 38, 36];
      const drawnNumbers = [36, 38, 40, 41, 42];

      const match = DrawMath.calculateMatches(userScores, drawnNumbers);

      assert.strictEqual(match.matchesCount, 2);
      assert.deepStrictEqual(match.matchedNumbers, [36, 38]);
      assert.strictEqual(match.winningTier, null); // <3 matches is not a winning tier
    });

    test("order-independent matching", () => {
      const userScores = [40, 20, 10, 30, 15];
      const drawnNumbers = [10, 15, 20, 25, 30];

      const match = DrawMath.calculateMatches(userScores, drawnNumbers);

      assert.strictEqual(match.matchesCount, 4);
      assert.deepStrictEqual(match.matchedNumbers, [10, 15, 20, 30]);
      assert.strictEqual(match.winningTier, "tier_4");
    });

    test("5 matches correctly assigned to tier_5", () => {
      const userScores = [7, 14, 21, 28, 35];
      const drawnNumbers = [7, 14, 21, 28, 35];

      const match = DrawMath.calculateMatches(userScores, drawnNumbers);

      assert.strictEqual(match.matchesCount, 5);
      assert.strictEqual(match.winningTier, "tier_5");
      assert.deepStrictEqual(match.matchedNumbers, [7, 14, 21, 28, 35]);
    });

    test("4 matches correctly assigned to tier_4", () => {
      const userScores = [7, 14, 21, 28, 30];
      const drawnNumbers = [7, 14, 21, 28, 35];

      const match = DrawMath.calculateMatches(userScores, drawnNumbers);

      assert.strictEqual(match.matchesCount, 4);
      assert.strictEqual(match.winningTier, "tier_4");
    });

    test("3 matches correctly assigned to tier_3", () => {
      const userScores = [7, 14, 21, 29, 30];
      const drawnNumbers = [7, 14, 21, 28, 35];

      const match = DrawMath.calculateMatches(userScores, drawnNumbers);

      assert.strictEqual(match.matchesCount, 3);
      assert.strictEqual(match.winningTier, "tier_3");
    });

    test("0, 1, 2 matches result in null winningTier", () => {
      const drawnNumbers = [1, 2, 3, 4, 5];

      assert.strictEqual(
        DrawMath.calculateMatches([10, 20, 30, 40, 45], drawnNumbers).winningTier,
        null
      );
      assert.strictEqual(
        DrawMath.calculateMatches([1, 20, 30, 40, 45], drawnNumbers).winningTier,
        null
      );
      assert.strictEqual(
        DrawMath.calculateMatches([1, 2, 30, 40, 45], drawnNumbers).winningTier,
        null
      );
    });
  });

  // ==========================================================================
  // 5. PRIZE POOL CALCULATIONS & AMORTIZATION
  // ==========================================================================
  describe("5. Prize Pool Calculations & Amortization", () => {
    test("monthly ₹499 subscriber contributes ₹149.70 (14,970 paise)", () => {
      const subscribers = [{ plan_type: "monthly" as const, amount: 499 }];
      const pool = DrawMath.calculatePrizePools(subscribers, 0);

      assert.strictEqual(pool.subscriptionPoolPaise, 14970);
      assert.strictEqual(pool.subscription_pool_portion, 149.7);
    });

    test("yearly ₹4,999 subscriber contributes ₹124.98 (12,498 paise) monthly-equivalent", () => {
      // 499900 * 30 / 100 = 149970 annual paise
      // 149970 / 12 = 12497.5 -> round(12497.5) = 12498 paise = ₹124.98
      const subscribers = [{ plan_type: "yearly" as const, amount: 4999 }];
      const pool = DrawMath.calculatePrizePools(subscribers, 0);

      assert.strictEqual(pool.subscriptionPoolPaise, 12498);
      assert.strictEqual(pool.subscription_pool_portion, 124.98);
    });

    test("tier split reconciles exactly to 40% (tier 5), 35% (tier 4), 25% (tier 3)", () => {
      // 10 monthly subscribers @ ₹499 = 10 * 14970 = 149,700 paise (₹1,497.00)
      const subscribers = Array(10).fill({ plan_type: "monthly" as const, amount: 499 });
      const pool = DrawMath.calculatePrizePools(subscribers, 0);

      assert.strictEqual(pool.subscriptionPoolPaise, 149700);
      // 35% of 149700 = 52395 paise (₹523.95)
      assert.strictEqual(pool.tier4PoolPaise, 52395);
      assert.strictEqual(pool.tier_4_pool, 523.95);
      // 25% of 149700 = 37425 paise (₹374.25)
      assert.strictEqual(pool.tier3PoolPaise, 37425);
      assert.strictEqual(pool.tier_3_pool, 374.25);
      // 40% of 149700 = 59880 paise (₹598.80)
      assert.strictEqual(pool.tier5PoolPaise, 59880);
      assert.strictEqual(pool.tier_5_pool, 598.8);

      // Exact paise reconciliation invariant
      assert.strictEqual(
        pool.tier5PoolPaise + pool.tier4PoolPaise + pool.tier3PoolPaise,
        pool.totalPrizePoolPaise
      );
    });

    test("rollover jackpot is added strictly to tier 5 only", () => {
      const subscribers = [{ plan_type: "monthly" as const, amount: 499 }];
      const rolloverRupees = 5000; // ₹5,000 carried over
      const pool = DrawMath.calculatePrizePools(subscribers, rolloverRupees);

      const rolloverPaise = 500000;
      assert.strictEqual(pool.rolloverJackpotInPaise, rolloverPaise);
      assert.strictEqual(pool.rollover_jackpot_in, 5000);

      // Tier 4 and Tier 3 must NOT receive any rollover
      assert.strictEqual(
        pool.tier4PoolPaise,
        Math.round(pool.subscriptionPoolPaise * 0.35)
      );
      assert.strictEqual(
        pool.tier3PoolPaise,
        Math.round(pool.subscriptionPoolPaise * 0.25)
      );

      // Tier 5 must include the full rollover
      const expectedTier5 =
        (pool.subscriptionPoolPaise - pool.tier4PoolPaise - pool.tier3PoolPaise) +
        rolloverPaise;
      assert.strictEqual(pool.tier5PoolPaise, expectedTier5);

      // Total prize pool must equal sum of all tiers
      assert.strictEqual(
        pool.tier5PoolPaise + pool.tier4PoolPaise + pool.tier3PoolPaise,
        pool.totalPrizePoolPaise
      );
    });
  });

  // ==========================================================================
  // 6. PRIZE ALLOCATION & REMAINDER DISTRIBUTION
  // ==========================================================================
  describe("6. Prize Allocation & Deterministic Remainder", () => {
    test("deterministic remainder distribution: ₹100.01 divided across 3 winners", () => {
      // ₹100.01 = 10,001 paise. Divided by 3 winners:
      // Base = 3333 paise. Remainder = 2 paise.
      // Winner 1 -> 3334 paise (₹33.34)
      // Winner 2 -> 3334 paise (₹33.34)
      // Winner 3 -> 3333 paise (₹33.33)
      // Sum = 10,001 paise exactly.
      const entries: DrawEntryCandidate[] = [
        { id: "e-3", userId: "user-charlie", winningTier: "tier_4" },
        { id: "e-1", userId: "user-alice", winningTier: "tier_4" },
        { id: "e-2", userId: "user-bob", winningTier: "tier_4" },
      ];

      const pools = {
        tier5PoolPaise: 50000,
        tier4PoolPaise: 10001,
        tier3PoolPaise: 20000,
      };

      const result = DrawMath.allocatePrizes(entries, pools);

      const tier4Prizes = result.allocatedEntries
        .filter((e) => e.winningTier === "tier_4")
        .sort((a, b) => a.userId.localeCompare(b.userId));

      assert.strictEqual(tier4Prizes.length, 3);
      // Alphabetical by userId: alice (0), bob (1), charlie (2)
      assert.strictEqual(tier4Prizes[0].userId, "user-alice");
      assert.strictEqual(tier4Prizes[0].prizeAmountPaise, 3334);
      assert.strictEqual(tier4Prizes[0].prizeAmount, 33.34);

      assert.strictEqual(tier4Prizes[1].userId, "user-bob");
      assert.strictEqual(tier4Prizes[1].prizeAmountPaise, 3334);
      assert.strictEqual(tier4Prizes[1].prizeAmount, 33.34);

      assert.strictEqual(tier4Prizes[2].userId, "user-charlie");
      assert.strictEqual(tier4Prizes[2].prizeAmountPaise, 3333);
      assert.strictEqual(tier4Prizes[2].prizeAmount, 33.33);

      // Sum of distributed prizes must match pool exactly
      const totalDistributed = tier4Prizes.reduce(
        (sum, e) => sum + e.prizeAmountPaise,
        0
      );
      assert.strictEqual(totalDistributed, 10001);
      assert.strictEqual(result.unclaimedTier4Paise, 0);
    });

    test("zero tier-5 winners rolls over entire tier 5 pool", () => {
      const entries: DrawEntryCandidate[] = [
        { id: "e-1", userId: "user-a", winningTier: "tier_4" },
      ];

      const pools = {
        tier5PoolPaise: 60000, // ₹600.00
        tier4PoolPaise: 52500,
        tier3PoolPaise: 37500,
      };

      const result = DrawMath.allocatePrizes(entries, pools);

      assert.strictEqual(result.tier5WinnersCount, 0);
      assert.strictEqual(result.jackpotRolledOver, true);
      assert.strictEqual(result.rolloverJackpotOutPaise, 60000);
      assert.strictEqual(result.rollover_jackpot_out, 600.0);
    });

    test("tier-5 with >= 1 winners sets rollover to exactly zero", () => {
      const entries: DrawEntryCandidate[] = [
        { id: "e-jackpot", userId: "lucky-user", winningTier: "tier_5" },
      ];

      const pools = {
        tier5PoolPaise: 60000,
        tier4PoolPaise: 52500,
        tier3PoolPaise: 37500,
      };

      const result = DrawMath.allocatePrizes(entries, pools);

      assert.strictEqual(result.tier5WinnersCount, 1);
      assert.strictEqual(result.jackpotRolledOver, false);
      assert.strictEqual(result.rolloverJackpotOutPaise, 0);
      assert.strictEqual(result.rollover_jackpot_out, 0);

      const winner = result.allocatedEntries.find((e) => e.userId === "lucky-user");
      assert.strictEqual(winner?.prizeAmountPaise, 60000);
      assert.strictEqual(winner?.prizeAmount, 600.0);
    });

    test("zero-winner tier 4 and tier 3 pools become full unclaimed amounts", () => {
      // Only 1 jackpot winner, zero tier 4 and zero tier 3 winners
      const entries: DrawEntryCandidate[] = [
        { id: "e-1", userId: "user-jackpot", winningTier: "tier_5" },
        { id: "e-2", userId: "user-loser", winningTier: null },
      ];

      const pools = {
        tier5PoolPaise: 60000,
        tier4PoolPaise: 52500,
        tier3PoolPaise: 37500,
      };

      const result = DrawMath.allocatePrizes(entries, pools);

      assert.strictEqual(result.tier4WinnersCount, 0);
      assert.strictEqual(result.unclaimedTier4Paise, 52500);
      assert.strictEqual(result.unclaimed_tier_4, 525.0);

      assert.strictEqual(result.tier3WinnersCount, 0);
      assert.strictEqual(result.unclaimedTier3Paise, 37500);
      assert.strictEqual(result.unclaimed_tier_3, 375.0);

      // Non-winner prize is 0
      const loser = result.allocatedEntries.find((e) => e.userId === "user-loser");
      assert.strictEqual(loser?.prizeAmountPaise, 0);
      assert.strictEqual(loser?.prizeAmount, 0);
    });

    test("Currency Invariants: All pools reconcile exactly across all tiers", () => {
      const entries: DrawEntryCandidate[] = [
        { id: "e-1", userId: "user-1", winningTier: "tier_5" },
        { id: "e-2", userId: "user-2", winningTier: "tier_4" },
        { id: "e-3", userId: "user-3", winningTier: "tier_4" },
        { id: "e-4", userId: "user-4", winningTier: "tier_3" },
        { id: "e-5", userId: "user-5", winningTier: null },
      ];

      const pools = {
        tier5PoolPaise: 75003,
        tier4PoolPaise: 65627,
        tier3PoolPaise: 46876,
      };

      const result = DrawMath.allocatePrizes(entries, pools);

      // Tier 5 reconciliation
      const t5Sum = result.allocatedEntries
        .filter((e) => e.winningTier === "tier_5")
        .reduce((sum, e) => sum + e.prizeAmountPaise, 0);
      assert.strictEqual(
        t5Sum + result.rolloverJackpotOutPaise,
        pools.tier5PoolPaise
      );

      // Tier 4 reconciliation
      const t4Sum = result.allocatedEntries
        .filter((e) => e.winningTier === "tier_4")
        .reduce((sum, e) => sum + e.prizeAmountPaise, 0);
      assert.strictEqual(
        t4Sum + result.unclaimedTier4Paise,
        pools.tier4PoolPaise
      );

      // Tier 3 reconciliation
      const t3Sum = result.allocatedEntries
        .filter((e) => e.winningTier === "tier_3")
        .reduce((sum, e) => sum + e.prizeAmountPaise, 0);
      assert.strictEqual(
        t3Sum + result.unclaimedTier3Paise,
        pools.tier3PoolPaise
      );

      // Grand total reconciliation
      const allWinnersPayout = result.allocatedEntries.reduce(
        (sum, e) => sum + e.prizeAmountPaise,
        0
      );
      const allAccounted =
        allWinnersPayout +
        result.rolloverJackpotOutPaise +
        result.unclaimedTier4Paise +
        result.unclaimedTier3Paise;
      const expectedTotalPool =
        pools.tier5PoolPaise + pools.tier4PoolPaise + pools.tier3PoolPaise;

      assert.strictEqual(allAccounted, expectedTotalPool);
    });
  });
});
