import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database.types";
import {
  createDrawSchema,
  drawnNumbersSchema,
} from "../validations/draw.schema";
import {
  DrawMath,
  type DrawEntryCandidate,
  type SubscriberPoolInput,
} from "./draw-math";
import {
  MAX_RETAINED_SCORES,
  SUBSCRIPTION_PRIZE_POOL_PERCENTAGE,
} from "../config/constants";

export type Draw = Tables<"draws">;
export type DrawEntry = Tables<"draw_entries">;
export type Winner = Tables<"winners">;

export type DrawEntryWithProfile = DrawEntry & {
  profile?: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
};

export type WinnerWithDetails = Winner & {
  profile?: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
  draw?: {
    id: string;
    title: string;
    draw_date: string;
  } | null;
};

export interface WinnerFilters {
  drawId?: string;
  tier?: Database["public"]["Tables"]["winners"]["Row"]["tier"];
  verificationStatus?: Database["public"]["Tables"]["winners"]["Row"]["verification_status"];
  paymentStatus?: Database["public"]["Tables"]["winners"]["Row"]["payment_status"];
}

export type UserWinnerWithDraw = Winner & {
  draw?: {
    id: string;
    title: string;
    draw_date: string;
    published_at: string | null;
  } | null;
};

export interface UserWinningsSummary {
  winners: UserWinnerWithDraw[];
  totalWon: number;
  pendingAmount: number;
  paidAmount: number;
}

export type DrawServiceResult<T> = {
  data?: T;
  error?: string;
};

export interface EligibleParticipant {
  userId: string;
  retainedScores: number[];
}

export interface ActiveSubscriberInfo {
  userId: string;
  planType: "monthly" | "yearly";
  amount: number;
  status: string;
  currentPeriodEnd: string;
}

export interface SimulationResult {
  draw: Draw;
  entriesCount: number;
  eligibleParticipantsCount: number;
  totalActiveSubscribersCount: number;
}

export interface PublishDrawResult {
  draw_id: string;
  status: "published";
  published_at: string;
  winners_count: number;
  tier_5_winners: number;
  tier_4_winners: number;
  tier_3_winners: number;
  jackpot_rolled_over: boolean;
  rollover_jackpot_out: number;
  unclaimed_tier_4: number;
  unclaimed_tier_3: number;
}

/**
 * Service orchestrating Draw lifecycle, participant eligibility,
 * prize-pool calculation, and persistent simulation snapshots.
 *
 * Enforces strictly:
 * - draft -> simulated lifecycle (no publishing in Phase B)
 * - Eligibility: active qualifying subscription AND exactly 5 retained scores
 * - Prize-pool population: all active qualifying subscribers regardless of score count
 * - Rollover: authoritative from latest published draw only
 * - Complete fresh snapshot on re-simulation
 * - Zero mutation of winners table
 */
export class DrawService {
  /**
   * Create a new draw in 'draft' status.
   * Directly enforces that initial status is strictly 'draft'.
   */
  static async createDraw(
    supabase: SupabaseClient<Database>,
    input: unknown,
    createdBy?: string
  ): Promise<DrawServiceResult<Draw>> {
    const parseResult = createDrawSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        error: parseResult.error.issues[0]?.message ?? "Invalid draw input",
      };
    }

    const { title, draw_date, draw_mode } = parseResult.data;

    const { data, error } = await supabase
      .from("draws")
      .insert({
        title,
        draw_date,
        draw_mode,
        status: "draft",
        cadence: "monthly",
        created_by: createdBy || null,
      })
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    return { data };
  }

  /**
   * Retrieve a draw by its unique ID.
   */
  static async getDraw(
    supabase: SupabaseClient<Database>,
    drawId: string
  ): Promise<DrawServiceResult<Draw>> {
    const { data, error } = await supabase
      .from("draws")
      .select("*")
      .eq("id", drawId)
      .maybeSingle();

    if (error) {
      return { error: error.message };
    }

    if (!data) {
      return { error: "Draw not found" };
    }

    return { data };
  }

  /**
   * List draws with optional status filter, ordered by draw_date descending.
   */
  static async listDraws(
    supabase: SupabaseClient<Database>,
    options?: { status?: Draw["status"] }
  ): Promise<DrawServiceResult<Draw[]>> {
    let query = supabase
      .from("draws")
      .select("*")
      .order("draw_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (options?.status) {
      query = query.eq("status", options.status);
    }

    const { data, error } = await query;

    if (error) {
      return { error: error.message };
    }

    return { data: data ?? [] };
  }

  /**
   * Retrieve all draw entries for a given draw.
   */
  static async getDrawEntries(
    supabase: SupabaseClient<Database>,
    drawId: string
  ): Promise<DrawServiceResult<DrawEntry[]>> {
    const { data, error } = await supabase
      .from("draw_entries")
      .select("*")
      .eq("draw_id", drawId)
      .order("prize_amount", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      return { error: error.message };
    }

    return { data: data ?? [] };
  }

  /**
   * Query all active qualifying subscribers for the prize pool.
   * Rules:
   * - status in ('active', 'trialing')
   * - current_period_end > now
   * - cancel_at_period_end = true does NOT disqualify before period end
   * - past_due, unpaid, canceled, lapsed are excluded
   * - Deduplicates multiple subscription rows per user if any.
   */
  static async getActiveSubscribers(
    supabase: SupabaseClient<Database>
  ): Promise<DrawServiceResult<ActiveSubscriberInfo[]>> {
    const nowIso = new Date().toISOString();

    const { data: subscriptions, error } = await supabase
      .from("subscriptions")
      .select("user_id, plan_type, amount, status, current_period_end")
      .in("status", ["active", "trialing"])
      .gt("current_period_end", nowIso)
      .order("current_period_end", { ascending: false });

    if (error) {
      return { error: error.message };
    }

    if (!subscriptions || subscriptions.length === 0) {
      return { data: [] };
    }

    // Deduplicate by user_id to avoid double-counting if duplicate active records exist
    const seenUsers = new Set<string>();
    const uniqueSubscribers: ActiveSubscriberInfo[] = [];

    for (const sub of subscriptions) {
      if (!seenUsers.has(sub.user_id)) {
        seenUsers.add(sub.user_id);
        uniqueSubscribers.push({
          userId: sub.user_id,
          planType: sub.plan_type as "monthly" | "yearly",
          amount: Number(sub.amount),
          status: sub.status,
          currentPeriodEnd: sub.current_period_end ?? "",
        });
      }
    }

    return { data: uniqueSubscribers };
  }

  /**
   * Evaluates participant eligibility for draw entry:
   * - Must have an active qualifying subscription
   * - Must have exactly 5 retained golf scores (ordered by played_date DESC, created_at DESC)
   */
  static async getEligibleParticipants(
    supabase: SupabaseClient<Database>
  ): Promise<DrawServiceResult<EligibleParticipant[]>> {
    const activeSubsResult = await this.getActiveSubscribers(supabase);
    if (activeSubsResult.error) {
      return { error: activeSubsResult.error };
    }

    const activeSubs = activeSubsResult.data ?? [];
    if (activeSubs.length === 0) {
      return { data: [] };
    }

    const subscriberUserIds = activeSubs.map((s) => s.userId);

    // Retrieve all scores for active subscribers
    const { data: scores, error: scoresError } = await supabase
      .from("golf_scores")
      .select("user_id, score, played_date, created_at")
      .in("user_id", subscriberUserIds)
      .order("played_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (scoresError) {
      return { error: scoresError.message };
    }

    // Group scores by user
    const scoresByUser = new Map<
      string,
      Array<{ score: number; played_date: string; created_at: string }>
    >();

    for (const s of scores ?? []) {
      const userList = scoresByUser.get(s.user_id) ?? [];
      userList.push(s);
      scoresByUser.set(s.user_id, userList);
    }

    const eligibleParticipants: EligibleParticipant[] = [];

    for (const sub of activeSubs) {
      const userScores = scoresByUser.get(sub.userId) ?? [];
      // Existing repository rule: Retain the top 5 scores by played_date DESC, created_at DESC
      const retainedScores = userScores.slice(0, MAX_RETAINED_SCORES);

      // Only participants with exactly 5 retained scores qualify
      if (retainedScores.length === MAX_RETAINED_SCORES) {
        eligibleParticipants.push({
          userId: sub.userId,
          retainedScores: retainedScores.map((s) => s.score),
        });
      }
    }

    return { data: eligibleParticipants };
  }

  /**
   * Retrieves the authoritative rollover jackpot from the latest PUBLISHED draw.
   * Draft and simulated draws are strictly ignored.
   * If no previous published draw exists, returns 0.
   * The authoritative rollover source is ALWAYS the single latest published draw,
   * regardless of whether that draw rolled over a jackpot.
   * A newer published draw without rollover MUST NEVER be skipped to reuse an older rollover.
   */
  static async getAuthoritativeRolloverJackpot(
    supabase: SupabaseClient<Database>
  ): Promise<DrawServiceResult<number>> {
    const { data, error } = await supabase
      .from("draws")
      .select("id, status, jackpot_rolled_over, rollover_jackpot_out")
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("draw_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { error: error.message };
    }

    if (!data) {
      return { data: 0 };
    }

    return { data: Number(data.rollover_jackpot_out ?? 0) };
  }

  /**
   * Simulates a draw or completely re-simulates an existing simulated draw.
   * Creates a persistent hypothetical snapshot:
   * - Evaluates current active subscribers (prize pool population)
   * - Evaluates current eligible participants (active sub + 5 retained scores)
   * - Reads authoritative rollover from latest published draw
   * - Generates winning numbers
   * - Calculates matches and hypothetical prize amounts
   * - Replaces all draw_entries for this draw_id
   * - Updates draw status to 'simulated'
   *
   * Re-simulation guarantee:
   * If the draw is already 'simulated', old draw_entries are deleted first
   * and fresh entries are created.
   *
   * Strictly DOES NOT:
   * - Insert winners records
   * - Publish the draw
   * - Change authoritative rollover
   */
  static async simulateDraw(
    supabase: SupabaseClient<Database>,
    drawId: string,
    options?: {
      drawnNumbers?: number[];
      rng?: () => number;
    }
  ): Promise<DrawServiceResult<SimulationResult>> {
    // 1. Fetch the draw record
    const drawResult = await this.getDraw(supabase, drawId);
    if (drawResult.error) {
      return { error: drawResult.error };
    }

    const draw = drawResult.data!;

    // Lifecycle validation: only 'draft' or 'simulated' draws can be simulated
    if (draw.status === "published" || draw.status === "completed") {
      return {
        error: `Cannot simulate a draw in '${draw.status}' status. Only draft or simulated draws can be simulated.`,
      };
    }

    // 2. Re-simulation cleanup: delete old entries if re-simulating
    if (draw.status === "simulated") {
      const { error: deleteError } = await supabase
        .from("draw_entries")
        .delete()
        .eq("draw_id", drawId);

      if (deleteError) {
        return { error: `Failed to clear previous draw entries: ${deleteError.message}` };
      }
    }

    // 3. Determine Prize Pool Population (ALL active qualifying subscribers)
    const activeSubsResult = await this.getActiveSubscribers(supabase);
    if (activeSubsResult.error) {
      return { error: activeSubsResult.error };
    }
    const activeSubscribers = activeSubsResult.data ?? [];

    // 4. Determine Draw Participants (active qualifying subscriber + 5 retained scores)
    const eligibleResult = await this.getEligibleParticipants(supabase);
    if (eligibleResult.error) {
      return { error: eligibleResult.error };
    }
    const eligibleParticipants = eligibleResult.data ?? [];

    // 5. Determine Authoritative Rollover Jackpot (from latest published draw only)
    const rolloverResult = await this.getAuthoritativeRolloverJackpot(supabase);
    if (rolloverResult.error) {
      return { error: rolloverResult.error };
    }
    const rolloverJackpotIn = rolloverResult.data ?? 0;

    // 6. Generate Drawn Numbers
    let drawnNumbers: number[];
    if (options?.drawnNumbers) {
      const parsed = drawnNumbersSchema.safeParse(options.drawnNumbers);
      if (!parsed.success) {
        return {
          error: `Invalid drawn numbers override: ${parsed.error.issues[0]?.message}`,
        };
      }
      drawnNumbers = parsed.data;
    } else if (draw.draw_mode === "algorithmic") {
      // Concatenate raw retained scores from all eligible participants
      const populationScores = eligibleParticipants.flatMap(
        (p) => p.retainedScores
      );
      drawnNumbers = DrawMath.generateDrawnNumbers(
        "algorithmic",
        populationScores,
        options?.rng
      );
    } else {
      drawnNumbers = DrawMath.generateDrawnNumbers(
        "random",
        undefined,
        options?.rng
      );
    }

    // 7. Calculate Prize Pools in Integer Paise
    const subscriberPoolInputs: SubscriberPoolInput[] = activeSubscribers.map(
      (sub) => ({
        plan_type: sub.planType,
        amount: sub.amount,
      })
    );

    const pools = DrawMath.calculatePrizePools(
      subscriberPoolInputs,
      rolloverJackpotIn,
      SUBSCRIPTION_PRIZE_POOL_PERCENTAGE
    );

    // 8. Match Scores & Allocate Hypothetical Prizes
    const candidates: DrawEntryCandidate[] = eligibleParticipants.map((p) => {
      const match = DrawMath.calculateMatches(p.retainedScores, drawnNumbers);
      return {
        id: p.userId,
        userId: p.userId,
        winningTier: match.winningTier,
      };
    });

    const allocation = DrawMath.allocatePrizes(candidates, {
      tier5PoolPaise: pools.tier5PoolPaise,
      tier4PoolPaise: pools.tier4PoolPaise,
      tier3PoolPaise: pools.tier3PoolPaise,
    });

    // 9. Persist Fresh Draw Entries
    const entryRows = eligibleParticipants.map((p) => {
      const match = DrawMath.calculateMatches(p.retainedScores, drawnNumbers);
      const allocated = allocation.allocatedEntries.find(
        (e) => e.userId === p.userId
      );

      return {
        draw_id: drawId,
        user_id: p.userId,
        scores_snapshot: p.retainedScores,
        matches_count: match.matchesCount,
        matched_numbers: match.matchedNumbers,
        winning_tier: match.winningTier,
        prize_amount: allocated?.prizeAmount ?? 0,
      };
    });

    if (entryRows.length > 0) {
      const { error: insertEntriesError } = await supabase
        .from("draw_entries")
        .insert(entryRows);

      if (insertEntriesError) {
        return {
          error: `Failed to persist draw entries: ${insertEntriesError.message}`,
        };
      }
    }

    // 10. Update Draw State to 'simulated' with Pool Breakdowns
    const { data: updatedDraw, error: updateDrawError } = await supabase
      .from("draws")
      .update({
        status: "simulated",
        drawn_numbers: drawnNumbers,
        total_active_subscribers: activeSubscribers.length,
        subscription_pool_portion: pools.subscription_pool_portion,
        rollover_jackpot_in: pools.rollover_jackpot_in,
        total_prize_pool: pools.total_prize_pool,
        tier_5_pool: pools.tier_5_pool,
        tier_4_pool: pools.tier_4_pool,
        tier_3_pool: pools.tier_3_pool,
        unclaimed_tier_4: allocation.unclaimed_tier_4,
        unclaimed_tier_3: allocation.unclaimed_tier_3,
        jackpot_rolled_over: allocation.jackpotRolledOver,
        rollover_jackpot_out: allocation.rollover_jackpot_out,
        updated_at: new Date().toISOString(),
      })
      .eq("id", drawId)
      .select()
      .single();

    if (updateDrawError) {
      return {
        error: `Failed to update draw status: ${updateDrawError.message}`,
      };
    }

    return {
      data: {
        draw: updatedDraw,
        entriesCount: entryRows.length,
        eligibleParticipantsCount: eligibleParticipants.length,
        totalActiveSubscribersCount: activeSubscribers.length,
      },
    };
  }

  /**
   * Publishes a simulated draw atomically via PostgreSQL publish_draw RPC.
   * Acquires an advisory lock, verifies admin authorization, validates authoritative rollover,
   * enforces accounting invariants, creates winner rows, and updates draw status to 'published'.
   */
  static async publishDraw(
    supabase: SupabaseClient<Database>,
    drawId: string,
    adminId: string
  ): Promise<DrawServiceResult<PublishDrawResult>> {
    if (!adminId) {
      return { error: "Admin user ID is required to publish a draw." };
    }

    const { data, error } = await supabase.rpc("publish_draw", {
      p_draw_id: drawId,
      p_admin_id: adminId,
    });

    if (error) {
      return { error: error.message };
    }

    return { data: data as unknown as PublishDrawResult };
  }

  /**
   * Retrieve all draw entries for a given draw along with participant profile info.
   * Read-only orchestrator for authorized admin simulation and publish review.
   */
  static async getDrawEntriesWithProfiles(
    supabase: SupabaseClient<Database>,
    drawId: string
  ): Promise<DrawServiceResult<DrawEntryWithProfile[]>> {
    const entriesResult = await this.getDrawEntries(supabase, drawId);
    if (entriesResult.error) {
      return { error: entriesResult.error };
    }

    const entries = entriesResult.data ?? [];
    if (entries.length === 0) {
      return { data: [] };
    }

    const userIds = [...new Set(entries.map((e) => e.user_id))];
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    if (profilesError) {
      return { error: profilesError.message };
    }

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const entriesWithProfiles: DrawEntryWithProfile[] = entries.map((entry) => ({
      ...entry,
      profile: profileMap.get(entry.user_id) || null,
    }));

    return { data: entriesWithProfiles };
  }

  /**
   * List winners across draws with optional filters for draw, tier, verification status, and payment status.
   * Read-only orchestrator for authorized admin winner review.
   */
  static async listWinners(
    supabase: SupabaseClient<Database>,
    filters?: WinnerFilters
  ): Promise<DrawServiceResult<WinnerWithDetails[]>> {
    let query = supabase
      .from("winners")
      .select("*")
      .order("created_at", { ascending: false });

    if (filters?.drawId) {
      query = query.eq("draw_id", filters.drawId);
    }
    if (filters?.tier) {
      query = query.eq("tier", filters.tier);
    }
    if (filters?.verificationStatus) {
      query = query.eq("verification_status", filters.verificationStatus);
    }
    if (filters?.paymentStatus) {
      query = query.eq("payment_status", filters.paymentStatus);
    }

    const { data: winners, error: winnersError } = await query;
    if (winnersError) {
      return { error: winnersError.message };
    }

    if (!winners || winners.length === 0) {
      return { data: [] };
    }

    const userIds = [...new Set(winners.map((w) => w.user_id))];
    const drawIds = [...new Set(winners.map((w) => w.draw_id))];

    const [profilesRes, drawsRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email").in("id", userIds),
      supabase.from("draws").select("id, title, draw_date").in("id", drawIds),
    ]);

    const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
    const drawMap = new Map((drawsRes.data ?? []).map((d) => [d.id, d]));

    const winnersWithDetails: WinnerWithDetails[] = winners.map((winner) => ({
      ...winner,
      profile: profileMap.get(winner.user_id) || null,
      draw: drawMap.get(winner.draw_id) || null,
    }));

    return { data: winnersWithDetails };
  }

  /**
   * Retrieves the latest published draw.
   * Draft and simulated draws are strictly excluded.
   * Returns null if no published draw exists.
   */
  static async getLatestPublishedDraw(
    supabase: SupabaseClient<Database>
  ): Promise<DrawServiceResult<Draw | null>> {
    const { data, error } = await supabase
      .from("draws")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("draw_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { error: error.message };
    }

    return { data: data || null };
  }

  /**
   * Retrieves a specific user's draw entry for a given draw.
   * Returns null if user did not participate in this draw.
   */
  static async getUserDrawEntry(
    supabase: SupabaseClient<Database>,
    drawId: string,
    userId: string
  ): Promise<DrawServiceResult<DrawEntry | null>> {
    const { data, error } = await supabase
      .from("draw_entries")
      .select("*")
      .eq("draw_id", drawId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return { error: error.message };
    }

    return { data: data || null };
  }

  /**
   * Retrieves all winnings records for a user, joined with draw title and dates.
   * Computes lifetime winnings stats: totalWon, pendingAmount, and paidAmount.
   * Note: Authoritative match counts live on draw_entries.matches_count; winners table stores tier and prize.
   */
  static async getUserWinnings(
    supabase: SupabaseClient<Database>,
    userId: string
  ): Promise<DrawServiceResult<UserWinningsSummary>> {
    const { data: winners, error: winnersError } = await supabase
      .from("winners")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (winnersError) {
      return { error: winnersError.message };
    }

    if (!winners || winners.length === 0) {
      return {
        data: {
          winners: [],
          totalWon: 0,
          pendingAmount: 0,
          paidAmount: 0,
        },
      };
    }

    const drawIds = [...new Set(winners.map((w) => w.draw_id))];
    const { data: draws, error: drawsError } = await supabase
      .from("draws")
      .select("id, title, draw_date, published_at")
      .in("id", drawIds);

    if (drawsError) {
      return { error: drawsError.message };
    }

    const drawMap = new Map((draws ?? []).map((d) => [d.id, d]));

    let totalWon = 0;
    let pendingAmount = 0;
    let paidAmount = 0;

    const winnersWithDraw: UserWinnerWithDraw[] = winners.map((winner) => {
      const amount = Number(winner.prize_amount ?? 0);
      totalWon += amount;
      if (winner.payment_status === "paid") {
        paidAmount += amount;
      } else {
        pendingAmount += amount;
      }

      return {
        ...winner,
        draw: drawMap.get(winner.draw_id) || null,
      };
    });

    return {
      data: {
        winners: winnersWithDraw,
        totalWon: Math.round(totalWon * 100) / 100,
        pendingAmount: Math.round(pendingAmount * 100) / 100,
        paidAmount: Math.round(paidAmount * 100) / 100,
      },
    };
  }
}

