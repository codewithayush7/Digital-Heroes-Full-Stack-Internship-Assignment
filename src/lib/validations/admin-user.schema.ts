import { z } from "zod";
import {
  MIN_CHARITY_CONTRIBUTION_PCT,
  MAX_CHARITY_CONTRIBUTION_PCT,
  SCORE_MIN,
  SCORE_MAX,
} from "../config/constants";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const adminUserFilterSchema = z.object({
  search: z.string().optional().default(""),
  role: z.enum(["all", "admin", "subscriber"]).optional().default("all"),
  subscriptionStatus: z
    .enum(["all", "active", "canceled", "past_due", "trialing", "none"])
    .optional()
    .default("all"),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
});

export type AdminUserFilterInput = z.infer<typeof adminUserFilterSchema>;

export const adminUpdateProfileSchema = z.object({
  userId: z.string().regex(UUID_REGEX, "Invalid user ID format"),
  fullName: z
    .string()
    .min(1, "Full name is required")
    .max(100, "Full name must not exceed 100 characters")
    .trim(),
  charityId: z
    .string()
    .regex(UUID_REGEX, "Invalid charity ID format")
    .nullable()
    .optional()
    .or(z.literal("")),
  charityContributionPct: z.coerce
    .number()
    .min(
      MIN_CHARITY_CONTRIBUTION_PCT,
      `Charity contribution must be at least ${MIN_CHARITY_CONTRIBUTION_PCT}%`
    )
    .max(
      MAX_CHARITY_CONTRIBUTION_PCT,
      `Charity contribution cannot exceed ${MAX_CHARITY_CONTRIBUTION_PCT}%`
    ),
});

export type AdminUpdateProfileInput = z.infer<typeof adminUpdateProfileSchema>;

export const adminUpdateRoleSchema = z.object({
  targetUserId: z.string().regex(UUID_REGEX, "Invalid user ID format"),
  role: z.enum(["admin", "subscriber"], {
    error: "Role must be either 'admin' or 'subscriber'",
  }),
});

export type AdminUpdateRoleInput = z.infer<typeof adminUpdateRoleSchema>;

export const adminCancelSubscriptionSchema = z.object({
  subscriptionId: z.string().regex(UUID_REGEX, "Invalid subscription ID format"),
});

export type AdminCancelSubscriptionInput = z.infer<typeof adminCancelSubscriptionSchema>;

export const adminAddScoreSchema = z.object({
  targetUserId: z.string().regex(UUID_REGEX, "Invalid target user ID format"),
  score: z.coerce
    .number()
    .int("Score must be an integer")
    .min(SCORE_MIN, `Score must be at least ${SCORE_MIN}`)
    .max(SCORE_MAX, `Score cannot exceed ${SCORE_MAX}`),
  playedDate: z
    .string()
    .regex(DATE_REGEX, "Date must be formatted as YYYY-MM-DD")
    .refine((val) => !isNaN(Date.parse(val)), "Invalid date format"),
});

export type AdminAddScoreInput = z.infer<typeof adminAddScoreSchema>;

export const adminUpdateScoreSchema = z.object({
  targetUserId: z.string().regex(UUID_REGEX, "Invalid target user ID format"),
  scoreId: z.string().regex(UUID_REGEX, "Invalid score ID format"),
  score: z.coerce
    .number()
    .int("Score must be an integer")
    .min(SCORE_MIN, `Score must be at least ${SCORE_MIN}`)
    .max(SCORE_MAX, `Score cannot exceed ${SCORE_MAX}`),
  playedDate: z
    .string()
    .regex(DATE_REGEX, "Date must be formatted as YYYY-MM-DD")
    .refine((val) => !isNaN(Date.parse(val)), "Invalid date format")
    .optional(),
});

export type AdminUpdateScoreInput = z.infer<typeof adminUpdateScoreSchema>;

export const adminDeleteScoreSchema = z.object({
  targetUserId: z.string().regex(UUID_REGEX, "Invalid target user ID format"),
  scoreId: z.string().regex(UUID_REGEX, "Invalid score ID format"),
});

export type AdminDeleteScoreInput = z.infer<typeof adminDeleteScoreSchema>;
