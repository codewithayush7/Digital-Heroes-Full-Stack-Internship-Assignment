import { z } from "zod";
import {
  MIN_CHARITY_CONTRIBUTION_PCT,
  MAX_CHARITY_CONTRIBUTION_PCT,
} from "../config/constants";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const charitySelectionSchema = z.object({
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

export type CharitySelectionInput = z.infer<typeof charitySelectionSchema>;
