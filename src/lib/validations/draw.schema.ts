import { z } from "zod";
import {
  SCORE_MIN,
  SCORE_MAX,
  DRAW_NUMBERS_COUNT,
} from "../config/constants";

export const drawnNumbersSchema = z
  .array(
    z.coerce
      .number()
      .int("Draw numbers must be integers")
      .min(SCORE_MIN, `Number must be at least ${SCORE_MIN}`)
      .max(SCORE_MAX, `Number cannot exceed ${SCORE_MAX}`)
  )
  .length(
    DRAW_NUMBERS_COUNT,
    `Draw must contain exactly ${DRAW_NUMBERS_COUNT} numbers`
  )
  .refine(
    (nums) => new Set(nums).size === DRAW_NUMBERS_COUNT,
    "All drawn numbers must be distinct"
  );

export const createDrawSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters long"),
  draw_date: z
    .string()
    .refine((val) => {
      const parsed = new Date(val);
      return !isNaN(parsed.getTime());
    }, "Draw date must be a valid date/timestamp string"),
  draw_mode: z.enum(["random", "algorithmic"], {
    message: "Draw mode must be either 'random' or 'algorithmic'",
  }),
});

export type DrawnNumbersInput = z.infer<typeof drawnNumbersSchema>;
export type CreateDrawInput = z.infer<typeof createDrawSchema>;
