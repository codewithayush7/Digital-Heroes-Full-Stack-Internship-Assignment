"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ScoreService, type GolfScore } from "@/lib/services/score.service";

export type ScoreActionResult = {
  error?: string;
  success?: boolean;
  data?: GolfScore | null;
};

export async function addScoreAction(
  _prevState: ScoreActionResult | null,
  formData: FormData
): Promise<ScoreActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to enter scores." };
  }

  const rawData = {
    score: formData.get("score"),
    playedDate: formData.get("playedDate"),
  };

  const result = await ScoreService.addScore(supabase, user.id, rawData);

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to edit scores." };
  }

  const rawData = {
    scoreId: formData.get("scoreId"),
    score: formData.get("score"),
    playedDate: formData.get("playedDate") || undefined,
  };

  const result = await ScoreService.updateScore(supabase, user.id, rawData);

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to delete scores." };
  }

  const result = await ScoreService.deleteScore(supabase, user.id, scoreId);

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/dashboard");
  revalidatePath("/scores");

  return { success: true };
}
