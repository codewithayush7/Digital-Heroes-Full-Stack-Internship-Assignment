import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database.types";
import {
  scoreSchema,
  updateScoreSchema,
} from "../validations/score.schema";
import { MAX_RETAINED_SCORES } from "../config/constants";

export type GolfScore = Tables<"golf_scores">;

export type ScoreServiceResult<T> = {
  data?: T;
  error?: string;
};

/**
 * Pure business logic service for Golf Score Management
 * Strictly enforces PRD rules:
 * - 1-45 Stableford range
 * - One score per user per played_date
 * - Only the latest 5 scores retained
 * - Ordering strictly by played_date DESC, created_at DESC
 * - Older dates entered later never displace newer retained scores
 */
export class ScoreService {
  /**
   * Retrieve the user's retained scores (maximum 5), ordered by played_date DESC, created_at DESC.
   */
  static async getUserScores(
    supabase: SupabaseClient<Database>,
    userId: string
  ): Promise<ScoreServiceResult<GolfScore[]>> {
    const { data, error } = await supabase
      .from("golf_scores")
      .select("*")
      .eq("user_id", userId)
      .order("played_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(MAX_RETAINED_SCORES);

    if (error) {
      return { error: error.message };
    }

    return { data: data ?? [] };
  }

  /**
   * Add a new golf score for a user and enforce the rolling 5-score retention rule.
   */
  static async addScore(
    supabase: SupabaseClient<Database>,
    userId: string,
    input: unknown
  ): Promise<ScoreServiceResult<GolfScore>> {
    const parseResult = scoreSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        error: parseResult.error.issues[0]?.message ?? "Invalid score input",
      };
    }

    const { score, playedDate } = parseResult.data;

    // 1. Enforce unique(user_id, played_date) upfront
    const { data: existingDateScore, error: checkError } = await supabase
      .from("golf_scores")
      .select("id")
      .eq("user_id", userId)
      .eq("played_date", playedDate)
      .maybeSingle();

    if (checkError) {
      return { error: checkError.message };
    }

    if (existingDateScore) {
      return {
        error: "Only one score entry is permitted per date. Duplicate scores for the same date are not allowed.",
      };
    }

    // 2. Insert the new score
    const { data: insertedScore, error: insertError } = await supabase
      .from("golf_scores")
      .insert({
        user_id: userId,
        score,
        played_date: playedDate,
      })
      .select()
      .single();

    if (insertError) {
      // Catch duplicate constraint if raced
      if (insertError.code === "23505") {
        return {
          error: "Only one score entry is permitted per date. Duplicate scores for the same date are not allowed.",
        };
      }
      return { error: insertError.message };
    }

    // 3. Enforce retention: Retain the 5 most recent scores by played_date DESC, created_at DESC
    // If more than 5 exist, prune any scores ranked 6th or older.
    await this.pruneOldScores(supabase, userId);

    return { data: insertedScore };
  }

  /**
   * Update an existing score owned by the user.
   */
  static async updateScore(
    supabase: SupabaseClient<Database>,
    userId: string,
    input: unknown
  ): Promise<ScoreServiceResult<GolfScore>> {
    const parseResult = updateScoreSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        error: parseResult.error.issues[0]?.message ?? "Invalid update input",
      };
    }

    const { scoreId, score, playedDate } = parseResult.data;

    // Verify existing score ownership
    const { data: existing, error: findError } = await supabase
      .from("golf_scores")
      .select("*")
      .eq("id", scoreId)
      .eq("user_id", userId)
      .maybeSingle();

    if (findError) {
      return { error: findError.message };
    }

    if (!existing) {
      return { error: "Score not found or access denied." };
    }

    // If date changed, ensure no date collision with another score for this user
    if (playedDate && playedDate !== existing.played_date) {
      const { data: collision } = await supabase
        .from("golf_scores")
        .select("id")
        .eq("user_id", userId)
        .eq("played_date", playedDate)
        .neq("id", scoreId)
        .maybeSingle();

      if (collision) {
        return {
          error: "Only one score entry is permitted per date. An existing score already uses this date.",
        };
      }
    }

    const updatePayload: { score: number; played_date?: string; updated_at: string } = {
      score,
      updated_at: new Date().toISOString(),
    };

    if (playedDate) {
      updatePayload.played_date = playedDate;
    }

    const { data: updated, error: updateError } = await supabase
      .from("golf_scores")
      .update(updatePayload)
      .eq("id", scoreId)
      .eq("user_id", userId)
      .select()
      .single();

    if (updateError) {
      return { error: updateError.message };
    }

    // Re-verify retention in case date changed
    if (playedDate) {
      await this.pruneOldScores(supabase, userId);
    }

    return { data: updated };
  }

  /**
   * Delete a score owned by the user.
   */
  static async deleteScore(
    supabase: SupabaseClient<Database>,
    userId: string,
    scoreId: string
  ): Promise<ScoreServiceResult<boolean>> {
    const { error } = await supabase
      .from("golf_scores")
      .delete()
      .eq("id", scoreId)
      .eq("user_id", userId);

    if (error) {
      return { error: error.message };
    }

    return { data: true };
  }

  /**
   * Retention Pruner:
   * Keeps strictly the top 5 scores ordered by played_date DESC, created_at DESC.
   * Any score ranked beyond the 5 most recent is automatically deleted.
   * If an older played_date was inserted later, it ranks at position 6+ and is pruned,
   * guaranteeing it never displaces a newer retained score.
   */
  private static async pruneOldScores(
    supabase: SupabaseClient<Database>,
    userId: string
  ): Promise<void> {
    const { data: allUserScores } = await supabase
      .from("golf_scores")
      .select("id")
      .eq("user_id", userId)
      .order("played_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (allUserScores && allUserScores.length > MAX_RETAINED_SCORES) {
      const idsToDelete = allUserScores
        .slice(MAX_RETAINED_SCORES)
        .map((row) => row.id);

      if (idsToDelete.length > 0) {
        await supabase
          .from("golf_scores")
          .delete()
          .in("id", idsToDelete);
      }
    }
  }
}
