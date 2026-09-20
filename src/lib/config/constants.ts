/**
 * Digital Heroes Platform Constants & Implementation Parameters
 */

// PRD Mandated Constraints
export const SCORE_MIN = 1;
export const SCORE_MAX = 45;
export const MAX_RETAINED_SCORES = 5;
export const DRAW_NUMBERS_COUNT = 5;
export const MIN_CHARITY_CONTRIBUTION_PCT = 10.0;
export const MAX_CHARITY_CONTRIBUTION_PCT = 100.0;

// PRD Mandated Prize Tier Split (Section 07)
export const PRIZE_TIER_SPLITS = {
  tier_5: {
    name: "5-Number Match",
    share: 0.40, // 40%
    rollover: true, // Jackpot rolls over if unclaimed
  },
  tier_4: {
    name: "4-Number Match",
    share: 0.35, // 35%
    rollover: false, // Does not roll over
  },
  tier_3: {
    name: "3-Number Match",
    share: 0.25, // 25%
    rollover: false, // Does not roll over
  },
} as const;

/**
 * Subscription Allocation Parameter
 * NOTE: The PRD specifies that a "fixed portion of each subscription contributes to the prize pool"
 * but does NOT hard-code a specific percentage. 
 * Default demo assumption: 30% of each active subscription enters the monthly prize pool.
 * This can be overridden via process.env.SUBSCRIPTION_PRIZE_POOL_PERCENTAGE.
 */
export const SUBSCRIPTION_PRIZE_POOL_PERCENTAGE: number = Number(
  process.env.SUBSCRIPTION_PRIZE_POOL_PERCENTAGE ?? "30"
);
