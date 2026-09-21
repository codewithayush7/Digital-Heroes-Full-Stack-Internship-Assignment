"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  WinnerService,
  type Winner,
  type WinnerVerificationContext,
} from "@/lib/services/winner.service";
import {
  submitWinnerProofSchema,
  reviewWinnerProofSchema,
  markWinnerPaidSchema,
  type ReviewWinnerProofInput,
  type MarkWinnerPaidInput,
} from "@/lib/validations/winner.schema";

export type WinnerActionResult<T = unknown> = {
  success?: boolean;
  error?: string;
  data?: T | null;
};

/**
 * Server action for a winning participant to submit or resubmit proof of golf scores.
 * Enforces authenticated session, winner ownership, file characteristics, and atomic CAS mutation.
 */
export async function submitWinnerProofAction(
  formData: FormData
): Promise<WinnerActionResult<Winner>> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Authentication required to submit proof." };
  }

  // 1. Authenticate caller
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Authentication required to submit proof." };
  }

  // 2. Parse winner ID
  const rawWinnerId = formData.get("winnerId");
  const parsed = submitWinnerProofSchema.safeParse({ winnerId: rawWinnerId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid winner ID." };
  }

  // 3. Extract and validate file
  const proofFile = formData.get("proofFile");
  if (!proofFile || !(proofFile instanceof File)) {
    return { error: "Proof image file is required." };
  }

  let fileBuffer: Buffer;
  try {
    const arrayBuf = await proofFile.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuf);
  } catch {
    return { error: "Failed to read image file data." };
  }

  // 4. Delegate to WinnerService with admin client for storage mutations
  const adminClient = createAdminClient();
  const result = await WinnerService.submitWinnerProof(
    adminClient,
    user.id,
    parsed.data.winnerId,
    fileBuffer
  );

  if (result.error) {
    return { error: result.error };
  }

  // 5. Revalidate paths
  revalidatePath("/dashboard");
  revalidatePath("/admin/winners");

  return { success: true, data: result.data };
}

/**
 * Server action for administrators to approve or reject a winner's score proof.
 * Enforces admin authorization, pending_review state, non-empty rejection notes, and CAS updates.
 */
export async function reviewWinnerProofAction(
  input: ReviewWinnerProofInput
): Promise<WinnerActionResult<Winner>> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Authentication required to review winners." };
  }

  // 1. Authenticate caller
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Authentication required to review winners." };
  }

  // 2. Verify admin role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "UNAUTHORIZED: Only administrators can review winner proofs." };
  }

  // 3. Validate input
  const parsed = reviewWinnerProofSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid review input." };
  }

  // 4. Delegate to WinnerService
  const result = await WinnerService.reviewWinnerProof(
    supabase,
    user.id,
    parsed.data.winnerId,
    parsed.data.action,
    parsed.data.notes
  );

  if (result.error) {
    return { error: result.error };
  }

  // 5. Revalidate paths
  revalidatePath("/admin/winners");
  revalidatePath("/dashboard");

  return { success: true, data: result.data };
}

/**
 * Server action for administrators to mark an approved winner's payout as completed.
 * Enforces admin role, approved verification status, pending payment status, and CAS idempotency.
 */
export async function markWinnerPaidAction(
  input: MarkWinnerPaidInput
): Promise<WinnerActionResult<Winner>> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Authentication required to disburse payouts." };
  }

  // 1. Authenticate caller
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Authentication required to disburse payouts." };
  }

  // 2. Verify admin role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "UNAUTHORIZED: Only administrators can record prize payouts." };
  }

  // 3. Validate input
  const parsed = markWinnerPaidSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid payout input." };
  }

  // 4. Delegate to WinnerService
  const result = await WinnerService.markWinnerPaid(
    supabase,
    user.id,
    parsed.data.winnerId,
    parsed.data.notes
  );

  if (result.error) {
    return { error: result.error };
  }

  // 5. Revalidate paths
  revalidatePath("/admin/winners");
  revalidatePath("/dashboard");

  return { success: true, data: result.data };
}

/**
 * Server action to generate an ephemeral signed URL (15-min TTL) to view private score proof.
 * Enforces ownership or admin role. Never exposes the service-role key to the client.
 */
export async function getWinnerProofSignedUrlAction(
  winnerId: string
): Promise<WinnerActionResult<{ signedUrl: string; objectPath: string }>> {
  if (!winnerId) {
    return { error: "Winner ID is required." };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Authentication required to access score proof." };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Authentication required to access score proof." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";
  const adminClient = createAdminClient();

  const result = await WinnerService.getProofSignedUrl(
    adminClient,
    user.id,
    isAdmin,
    winnerId
  );

  if (result.error) {
    return { error: result.error };
  }

  return { success: true, data: result.data };
}

/**
 * Server action to retrieve complete verification comparison context
 * (draw numbers, participant 5 snapshot scores, matched numbers, and winner status).
 */
export async function getWinnerVerificationContextAction(
  winnerId: string
): Promise<WinnerActionResult<WinnerVerificationContext>> {
  if (!winnerId) {
    return { error: "Winner ID is required." };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Authentication required." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  const result = await WinnerService.getVerificationContext(supabase, winnerId);
  if (result.error) {
    return { error: result.error };
  }

  if (!isAdmin && result.data?.winner.user_id !== user.id) {
    return { error: "UNAUTHORIZED: You cannot view verification context for another golfer." };
  }

  return { success: true, data: result.data };
}
