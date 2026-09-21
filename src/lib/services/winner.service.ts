import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  MAX_PROOF_FILE_SIZE,
  ALLOWED_PROOF_MIME_TYPES,
} from "../validations/winner.schema";

export type Winner = Database["public"]["Tables"]["winners"]["Row"];
export type DrawEntry = Database["public"]["Tables"]["draw_entries"]["Row"];
export type Draw = Database["public"]["Tables"]["draws"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export interface WinnerServiceResult<T = unknown> {
  data?: T;
  error?: string;
}

export interface WinnerVerificationContext {
  winner: Winner;
  profile: Pick<Profile, "id" | "full_name" | "email"> | null;
  draw: Pick<Draw, "id" | "title" | "draw_date" | "drawn_numbers" | "published_at"> | null;
  drawEntry: Pick<
    DrawEntry,
    "id" | "scores_snapshot" | "matches_count" | "matched_numbers" | "winning_tier" | "prize_amount"
  > | null;
}

export const STORAGE_BUCKET_NAME =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "winner-proofs";

/**
 * Validates actual file characteristics via leading magic bytes.
 * Never trust client-supplied MIME types alone.
 */
export function validateImageMagicBytes(buffer: Buffer): {
  valid: boolean;
  format?: "jpeg" | "png" | "webp";
} {
  if (!buffer || buffer.length < 12) {
    return { valid: false };
  }

  // 1. JPEG: starts with 0xFF, 0xD8, 0xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, format: "jpeg" };
  }

  // 2. PNG: 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, format: "png" };
  }

  // 3. WebP: 0x52, 0x49, 0x46, 0x46 ('RIFF') ... 0x57, 0x45, 0x42, 0x50 ('WEBP') at byte 8
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, format: "webp" };
  }

  return { valid: false };
}

export class WinnerService {
  /**
   * Idempotent fallback helper to ensure the private winner-proofs bucket exists.
   * NOTE: supabase/migrations/20260303000000_winner_storage.sql is the authoritative
   * schema definition; this helper provides dev/test resilience.
   */
  static async ensureStorageBucket(
    adminSupabase: SupabaseClient<Database>
  ): Promise<WinnerServiceResult<boolean>> {
    try {
      const { data: bucket, error } = await adminSupabase.storage.getBucket(
        STORAGE_BUCKET_NAME
      );

      if (!error && bucket) {
        return { data: true };
      }

      const { error: createError } = await adminSupabase.storage.createBucket(
        STORAGE_BUCKET_NAME,
        {
          public: false,
          fileSizeLimit: MAX_PROOF_FILE_SIZE,
          allowedMimeTypes: [...ALLOWED_PROOF_MIME_TYPES],
        }
      );

      if (createError && !createError.message.includes("already exists")) {
        return { error: createError.message };
      }

      return { data: true };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Failed to ensure storage bucket",
      };
    }
  }

  /**
   * Submits or resubmits proof of golf scores.
   * Concurrency-safe CAS mutation:
   * - Validates caller ownership & status (pending_submission or rejected, payment pending).
   * - Validates file size and actual magic bytes.
   * - Server-generates canonical object path: proofs/<winner_id>/<timestamp>_<uuid>.<ext>.
   * - Updates public.winners using conditional CAS.
   * - Compensation: if DB update fails or 0 rows match, deletes uploaded storage file.
   * - If resubmitting, cleans up old proof object after successful replacement.
   */
  static async submitWinnerProof(
    adminSupabase: SupabaseClient<Database>,
    userId: string,
    winnerId: string,
    fileBuffer: Buffer,
    _declaredMimeType?: string
  ): Promise<WinnerServiceResult<Winner>> {
    void _declaredMimeType;
    // 1. File Size Verification
    if (fileBuffer.length > MAX_PROOF_FILE_SIZE) {
      return {
        error: `File size exceeds maximum allowed limit of ${MAX_PROOF_FILE_SIZE / (1024 * 1024)} MB.`,
      };
    }

    // 2. Real Magic Bytes Verification
    const magicCheck = validateImageMagicBytes(fileBuffer);
    if (!magicCheck.valid || !magicCheck.format) {
      return {
        error: "Invalid image format. Only authentic JPEG, PNG, or WebP files are permitted.",
      };
    }

    // 3. Verify Winner Record Existence & Ownership
    const { data: winner, error: winnerError } = await adminSupabase
      .from("winners")
      .select("*")
      .eq("id", winnerId)
      .maybeSingle();

    if (winnerError || !winner) {
      return { error: "NOT_FOUND: Winner record not found." };
    }

    if (winner.user_id !== userId) {
      return {
        error: "UNAUTHORIZED: You can only submit score proof for your own winning record.",
      };
    }

    // 4. Validate Current Lifecycle State
    if (winner.payment_status === "paid") {
      return { error: "INVALID_STATE: This prize has already been paid out and cannot be modified." };
    }

    if (winner.verification_status === "approved") {
      return { error: "INVALID_STATE: Score proof has already been verified and approved." };
    }

    if (winner.verification_status === "pending_review") {
      return { error: "INVALID_STATE: Score proof is currently under review." };
    }

    if (
      winner.verification_status !== "pending_submission" &&
      winner.verification_status !== "rejected"
    ) {
      return {
        error: `INVALID_STATE: Cannot submit proof from '${winner.verification_status}' status.`,
      };
    }

    // 5. Ensure Storage Bucket Exists
    await this.ensureStorageBucket(adminSupabase);

    // 6. Generate Server-Controlled Canonical Storage Path
    const ext = magicCheck.format === "jpeg" ? "jpg" : magicCheck.format;
    const randomSuffix = Math.random().toString(36).slice(2, 10);
    const serverObjectPath = `proofs/${winnerId}/${Date.now()}_${randomSuffix}.${ext}`;
    const oldProofPath = winner.proof_image_url;

    // 7. Upload to Private Storage
    const contentType =
      magicCheck.format === "jpeg"
        ? "image/jpeg"
        : magicCheck.format === "png"
        ? "image/png"
        : "image/webp";

    const { error: uploadError } = await adminSupabase.storage
      .from(STORAGE_BUCKET_NAME)
      .upload(serverObjectPath, fileBuffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      return { error: `Failed to upload proof to storage: ${uploadError.message}` };
    }

    // 8. Atomic Compare-And-Swap (CAS) Database Mutation
    const nowIso = new Date().toISOString();
    const { data: updatedRows, error: updateError } = await adminSupabase
      .from("winners")
      .update({
        proof_image_url: serverObjectPath,
        proof_submitted_at: nowIso,
        verification_status: "pending_review",
        updated_at: nowIso,
      })
      .eq("id", winnerId)
      .eq("user_id", userId)
      .in("verification_status", ["pending_submission", "rejected"])
      .eq("payment_status", "pending")
      .select();

    // 9. Failure Compensation & Losing Race Cleanup
    if (updateError || !updatedRows || updatedRows.length === 0) {
      // Roll back the uploaded storage object immediately
      await adminSupabase.storage.from(STORAGE_BUCKET_NAME).remove([serverObjectPath]);

      if (updateError) {
        return { error: `Database update failed: ${updateError.message}` };
      }
      return {
        error: "CONCURRENT_CONFLICT: Record status changed concurrently. Submission rejected.",
      };
    }

    // 10. Clean up Old Storage Proof on Successful Resubmission
    if (oldProofPath && oldProofPath !== serverObjectPath) {
      try {
        await adminSupabase.storage.from(STORAGE_BUCKET_NAME).remove([oldProofPath]);
      } catch {
        // Non-blocking cleanup failure
      }
    }

    return { data: updatedRows[0] };
  }

  /**
   * Reviews proof of golf scores (Approve or Reject).
   * Concurrency-safe CAS mutation:
   * - Enforces current state is strictly 'pending_review' and payment_status is 'pending'.
   * - If rejecting, enforces non-empty admin notes.
   * - Records reviewed_by = adminId.
   */
  static async reviewWinnerProof(
    supabase: SupabaseClient<Database>,
    adminId: string,
    winnerId: string,
    action: "approve" | "reject",
    notes?: string
  ): Promise<WinnerServiceResult<Winner>> {
    if (action === "reject") {
      if (!notes || notes.trim().length < 3) {
        return {
          error: "Admin notes explaining the rejection reason are required (minimum 3 characters).",
        };
      }
    }

    const targetStatus = action === "approve" ? "approved" : "rejected";
    const nowIso = new Date().toISOString();

    // Atomic CAS Update
    const { data: updatedRows, error: updateError } = await supabase
      .from("winners")
      .update({
        verification_status: targetStatus,
        reviewed_by: adminId,
        admin_notes: notes?.trim() || null,
        updated_at: nowIso,
      })
      .eq("id", winnerId)
      .eq("verification_status", "pending_review")
      .eq("payment_status", "pending")
      .select();

    if (updateError) {
      return { error: updateError.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      // Diagnostic query for exact error message
      const { data: winner } = await supabase
        .from("winners")
        .select("verification_status, payment_status")
        .eq("id", winnerId)
        .maybeSingle();

      if (!winner) {
        return { error: "NOT_FOUND: Winner record not found." };
      }
      if (winner.payment_status === "paid") {
        return { error: "INVALID_STATE: Winner payout is already completed." };
      }
      if (winner.verification_status !== "pending_review") {
        return {
          error: `INVALID_STATE: Cannot review winner with status '${winner.verification_status}'. Expected 'pending_review'.`,
        };
      }
      return {
        error: "CONCURRENT_CONFLICT: Review state conflict. The record was modified concurrently.",
      };
    }

    return { data: updatedRows[0] };
  }

  /**
   * Marks winner payout as paid (Manual Payout Operations).
   * Concurrency-safe CAS mutation:
   * - Enforces verification_status === 'approved' AND payment_status === 'pending'.
   * - Sets payment_status = 'paid', paid_at = now().
   * - A concurrent second call fails explicitly rather than silently succeeding.
   */
  static async markWinnerPaid(
    supabase: SupabaseClient<Database>,
    adminId: string,
    winnerId: string,
    notes?: string
  ): Promise<WinnerServiceResult<Winner>> {
    const nowIso = new Date().toISOString();

    // Atomic CAS Update
    const updatePayload: Database["public"]["Tables"]["winners"]["Update"] = {
      payment_status: "paid",
      paid_at: nowIso,
      updated_at: nowIso,
    };

    if (notes && notes.trim().length > 0) {
      updatePayload.admin_notes = notes.trim();
    }

    const { data: updatedRows, error: updateError } = await supabase
      .from("winners")
      .update(updatePayload)
      .eq("id", winnerId)
      .eq("verification_status", "approved")
      .eq("payment_status", "pending")
      .select();

    if (updateError) {
      return { error: updateError.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      // Diagnostic check for exact failure reason
      const { data: winner } = await supabase
        .from("winners")
        .select("verification_status, payment_status, paid_at")
        .eq("id", winnerId)
        .maybeSingle();

      if (!winner) {
        return { error: "NOT_FOUND: Winner record not found." };
      }
      if (winner.payment_status === "paid") {
        return {
          error: `ALREADY_PAID: Winner payout has already been completed on ${winner.paid_at || "previous date"}.`,
        };
      }
      if (winner.verification_status !== "approved") {
        return {
          error: `INVALID_STATE: Cannot mark as paid. Winner verification must be 'approved' first (current: '${winner.verification_status}').`,
        };
      }
      return {
        error: "CONCURRENT_CONFLICT: Payment state conflict. The record was modified concurrently.",
      };
    }

    return { data: updatedRows[0] };
  }

  /**
   * Generates a short-lived signed URL (15-minute TTL) for viewing private score proof.
   * Enforces independent verification:
   * 1. Winner record exists
   * 2. Caller is owner OR admin
   * 3. Proof object path exists
   */
  static async getProofSignedUrl(
    adminSupabase: SupabaseClient<Database>,
    callerId: string,
    isAdmin: boolean,
    winnerId: string
  ): Promise<WinnerServiceResult<{ signedUrl: string; objectPath: string }>> {
    const { data: winner, error } = await adminSupabase
      .from("winners")
      .select("id, user_id, proof_image_url")
      .eq("id", winnerId)
      .maybeSingle();

    if (error || !winner) {
      return { error: "NOT_FOUND: Winner record not found." };
    }

    // Ownership or Admin Check
    if (!isAdmin && winner.user_id !== callerId) {
      return {
        error: "UNAUTHORIZED: You do not have permission to access this score proof.",
      };
    }

    // Proof Existence Check
    if (!winner.proof_image_url) {
      return {
        error: "NO_PROOF: No proof image has been submitted for this winning record.",
      };
    }

    // 15-minute TTL (900 seconds)
    const { data: signedData, error: signedError } = await adminSupabase.storage
      .from(STORAGE_BUCKET_NAME)
      .createSignedUrl(winner.proof_image_url, 900);

    if (signedError || !signedData?.signedUrl) {
      return {
        error: `Failed to generate signed URL: ${signedError?.message || "unknown storage error"}`,
      };
    }

    return {
      data: {
        signedUrl: signedData.signedUrl,
        objectPath: winner.proof_image_url,
      },
    };
  }

  /**
   * Encapsulated verification context reader for Admin Review modal & User Dashboard.
   * Gathers winner, draw, draw_entry, scores_snapshot, matched_numbers, drawn_numbers,
   * and participant profile details without altering draw.service.ts.
   */
  static async getVerificationContext(
    supabase: SupabaseClient<Database>,
    winnerId: string
  ): Promise<WinnerServiceResult<WinnerVerificationContext>> {
    const { data: winner, error: winnerError } = await supabase
      .from("winners")
      .select("*")
      .eq("id", winnerId)
      .maybeSingle();

    if (winnerError || !winner) {
      return { error: "Winner record not found." };
    }

    const [profileRes, drawRes, entryRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", winner.user_id)
        .maybeSingle(),
      supabase
        .from("draws")
        .select("id, title, draw_date, drawn_numbers, published_at")
        .eq("id", winner.draw_id)
        .maybeSingle(),
      supabase
        .from("draw_entries")
        .select(
          "id, scores_snapshot, matches_count, matched_numbers, winning_tier, prize_amount"
        )
        .eq("id", winner.draw_entry_id)
        .maybeSingle(),
    ]);

    return {
      data: {
        winner,
        profile: profileRes.data || null,
        draw: drawRes.data || null,
        drawEntry: entryRes.data || null,
      },
    };
  }
}
