import { z } from "zod";

export const MAX_PROOF_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_PROOF_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const submitWinnerProofSchema = z.object({
  winnerId: z.string().uuid("Winner ID must be a valid UUID"),
});

export const reviewWinnerProofSchema = z
  .object({
    winnerId: z.string().uuid("Winner ID must be a valid UUID"),
    action: z.enum(["approve", "reject"], {
      message: "Action must be either 'approve' or 'reject'",
    }),
    notes: z.string().trim().max(1000, "Notes cannot exceed 1000 characters").optional(),
  })
  .refine(
    (data) => {
      if (data.action === "reject") {
        return typeof data.notes === "string" && data.notes.length >= 3;
      }
      return true;
    },
    {
      message: "Admin notes explaining the rejection reason are required (minimum 3 characters).",
      path: ["notes"],
    }
  );

export const markWinnerPaidSchema = z.object({
  winnerId: z.string().uuid("Winner ID must be a valid UUID"),
  notes: z.string().trim().max(1000, "Notes cannot exceed 1000 characters").optional(),
});

export type SubmitWinnerProofInput = z.infer<typeof submitWinnerProofSchema>;
export type ReviewWinnerProofInput = z.infer<typeof reviewWinnerProofSchema>;
export type MarkWinnerPaidInput = z.infer<typeof markWinnerPaidSchema>;
