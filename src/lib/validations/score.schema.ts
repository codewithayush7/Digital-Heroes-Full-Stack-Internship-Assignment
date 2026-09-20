import { z } from "zod";
import { SCORE_MIN, SCORE_MAX } from "../config/constants";

export const scoreSchema = z.object({
  score: z.coerce
    .number()
    .int("Score must be an integer")
    .min(SCORE_MIN, `Score must be at least ${SCORE_MIN}`)
    .max(SCORE_MAX, `Score cannot exceed ${SCORE_MAX}`),
  playedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .refine((val) => {
      const parsed = new Date(val);
      return !isNaN(parsed.getTime());
    }, "Invalid date"),
});

export const updateScoreSchema = z.object({
  scoreId: z.string().uuid("Invalid score ID"),
  score: z.coerce
    .number()
    .int("Score must be an integer")
    .min(SCORE_MIN, `Score must be at least ${SCORE_MIN}`)
    .max(SCORE_MAX, `Score cannot exceed ${SCORE_MAX}`),
  playedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .refine((val) => {
      const parsed = new Date(val);
      return !isNaN(parsed.getTime());
    }, "Invalid date")
    .optional(),
});

export type ScoreInput = z.infer<typeof scoreSchema>;
export type UpdateScoreInput = z.infer<typeof updateScoreSchema>;
