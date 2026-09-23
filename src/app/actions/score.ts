"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ScoreService, type GolfScore } from "@/lib/services/score.service";
import { verifyUserScoreAuthorization } from "@/lib/auth";

export type ScoreActionResult = {
  error?: string;
  success?: boolean;
  data?: GolfScore | null;
};

/**
 * Server-side authorization guard for normal user golf score mutations.
 * Authoritatively verifies:
 * 1. User is authenticated via Supabase server-side session.
 * 2. User has confirmed their email address.
 * 3. User possesses a currently qualifying subscription (active or trialing with future current_period_end).
 * Prevents client-supplied forgery of user IDs or subscription status.
 */
async function authorizeScoreOperation(actionType: "enter" | "edit" | "delete") {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: `You must be signed in to ${actionType} scores.` };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: `You must be signed in to ${actionType} scores.` };
  }

  const auth = await verifyUserScoreAuthorization(
    supabase,
    user,
    actionType
  );

  if (!auth.allowed) {
    return { error: auth.error };
  }

  return { supabase, user };
}

export async function addScoreAction(
  _prevState: ScoreActionResult | null,
  formData: FormData
): Promise<ScoreActionResult> {
  const auth = await authorizeScoreOperation("enter");
  if (auth.error || !auth.user || !auth.supabase) {
    return { error: auth.error };
  }

  const rawData = {
    score: formData.get("score"),
    playedDate: formData.get("playedDate"),
  };

  const result = await ScoreService.addScore(auth.supabase, auth.user.id, rawData);

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/dashboard");
  revalidatePath("/scores");

  return { success: true, data: result.data };
}

export async function updateScoreAction(
  _prevState: ScoreActionResult | null,
  formData: FormData
): Promise<ScoreActionResult> {
  const auth = await authorizeScoreOperation("edit");
  if (auth.error || !auth.user || !auth.supabase) {
    return { error: auth.error };
  }

  const rawData = {
    scoreId: formData.get("scoreId"),
    score: formData.get("score"),
    playedDate: formData.get("playedDate") || undefined,
  };

  const result = await ScoreService.updateScore(auth.supabase, auth.user.id, rawData);

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/dashboard");
  revalidatePath("/scores");

  return { success: true, data: result.data };
}

export async function deleteScoreAction(
  scoreId: string
): Promise<ScoreActionResult> {
  const auth = await authorizeScoreOperation("delete");
  if (auth.error || !auth.user || !auth.supabase) {
    return { error: auth.error };
  }

  const result = await ScoreService.deleteScore(auth.supabase, auth.user.id, scoreId);

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/dashboard");
  revalidatePath("/scores");

  return { success: true };
}
