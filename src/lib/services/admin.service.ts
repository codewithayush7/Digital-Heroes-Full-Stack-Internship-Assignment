import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database.types";
import { stripe } from "@/lib/stripe";
import { ScoreService, type GolfScore } from "@/lib/services/score.service";
import {
  adminUserFilterSchema,
  adminUpdateProfileSchema,
  adminUpdateRoleSchema,
  type AdminUserFilterInput,
} from "@/lib/validations/admin-user.schema";

export type ProfileRow = Tables<"profiles">;
export type SubscriptionRow = Tables<"subscriptions">;
export type CharityRow = Tables<"charities">;
export type SubscriptionStatus = SubscriptionRow["status"];

export interface PlatformKpis {
  totalUsers: number;
  activeSubscribers: number;
  totalPrizePool: number;
  currentRolloverJackpot: number;
  totalCharityFunds: number;
}

export interface AdminUserSubscriptionSummary {
  id: string;
  plan_type: "monthly" | "yearly";
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string | null;
  amount: number;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "subscriber";
  charity_id: string | null;
  charity_name: string | null;
  charity_contribution_pct: number;
  created_at: string;
  current_subscription: AdminUserSubscriptionSummary | null;
}

export interface AdminUserDetail {
  profile: ProfileRow;
  charity: CharityRow | null;
  subscriptions: SubscriptionRow[];
  scores: GolfScore[];
  current_subscription: AdminUserSubscriptionSummary | null;
}

export type AdminServiceResult<T> = {
  data?: T;
  error?: string;
};

export class AdminService {
  /**
   * Retrieves high-level platform KPI metrics directly from authoritative database tables.
   * Strictly enforces:
   * - Total users: count(*) from public.profiles
   * - Active subscribers: distinct user_ids with active/trialing subscription and current_period_end > now()
   * - Total prize pool: sum(total_prize_pool) of published draws ONLY (excludes draft and simulated)
   * - Current rollover: rollover_jackpot_out of latest published draw ordered by (published_at DESC NULLS LAST, draw_date DESC, created_at DESC)
   * - Total charity funds: sum(total_funds_raised) from public.charities
   */
  static async getPlatformKpis(
    adminSupabase: SupabaseClient<Database>
  ): Promise<AdminServiceResult<PlatformKpis>> {
    const nowIso = new Date().toISOString();

    try {
      const [
        usersRes,
        activeSubsRes,
        publishedDrawsRes,
        latestPublishedDrawRes,
        charitiesRes,
      ] = await Promise.all([
        // 1. Total Registered Users
        adminSupabase
          .from("profiles")
          .select("*", { count: "exact", head: true }),

        // 2. Active Qualifying Subscriptions
        adminSupabase
          .from("subscriptions")
          .select("user_id")
          .in("status", ["active", "trialing"])
          .gt("current_period_end", nowIso),

        // 3. Authoritative Published Draws Prize Pool Sum
        adminSupabase
          .from("draws")
          .select("total_prize_pool")
          .eq("status", "published"),

        // 4. Latest Authoritative Published Draw Rollover
        adminSupabase
          .from("draws")
          .select("rollover_jackpot_out, published_at")
          .eq("status", "published")
          .order("published_at", { ascending: false, nullsFirst: false })
          .order("draw_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),

        // 5. Total Funds Raised across Partner Charities
        adminSupabase
          .from("charities")
          .select("total_funds_raised"),
      ]);

      if (usersRes.error) {
        return { error: `Failed to fetch users count: ${usersRes.error.message}` };
      }
      if (activeSubsRes.error) {
        return { error: `Failed to fetch active subscriptions: ${activeSubsRes.error.message}` };
      }
      if (publishedDrawsRes.error) {
        return { error: `Failed to fetch prize pool totals: ${publishedDrawsRes.error.message}` };
      }
      if (latestPublishedDrawRes.error) {
        return { error: `Failed to fetch rollover jackpot: ${latestPublishedDrawRes.error.message}` };
      }
      if (charitiesRes.error) {
        return { error: `Failed to fetch charity funds: ${charitiesRes.error.message}` };
      }

      const totalUsers = usersRes.count ?? 0;

      // Unique active user count matching SubscriptionService qualification rule
      const distinctActiveUsers = new Set(
        (activeSubsRes.data ?? []).map((row) => row.user_id)
      );
      const activeSubscribers = distinctActiveUsers.size;

      // Total prize pool: Sum of total_prize_pool for published draws only
      const totalPrizePool = (publishedDrawsRes.data ?? []).reduce(
        (sum, draw) => sum + Number(draw.total_prize_pool || 0),
        0
      );

      // Current rollover: rollover_jackpot_out of latest authoritative published draw
      const currentRolloverJackpot = latestPublishedDrawRes.data
        ? Number(latestPublishedDrawRes.data.rollover_jackpot_out || 0)
        : 0;

      // Total charity funds raised across platform
      const totalCharityFunds = (charitiesRes.data ?? []).reduce(
        (sum, charity) => sum + Number(charity.total_funds_raised || 0),
        0
      );

      return {
        data: {
          totalUsers,
          activeSubscribers,
          totalPrizePool: Math.round(totalPrizePool * 100) / 100,
          currentRolloverJackpot: Math.round(currentRolloverJackpot * 100) / 100,
          totalCharityFunds: Math.round(totalCharityFunds * 100) / 100,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { error: `Unexpected KPI calculation failure: ${msg}` };
    }
  }

  /**
   * Resolves exactly one "current" subscription from a user's subscription list:
   * 1. Active or trialing subscription where current_period_end > now() (latest current_period_end wins)
   * 2. Most recent subscription by current_period_end DESC
   * 3. null if user has no subscriptions
   */
  static resolveCurrentSubscription(
    subscriptions: SubscriptionRow[]
  ): AdminUserSubscriptionSummary | null {
    if (!subscriptions || subscriptions.length === 0) {
      return null;
    }

    const nowIso = new Date().toISOString();

    // 1. Look for active or trialing where current_period_end > now()
    const activeSubs = subscriptions
      .filter(
        (s) =>
          (s.status === "active" || s.status === "trialing") &&
          s.current_period_end !== null &&
          s.current_period_end > nowIso
      )
      .sort((a, b) => {
        const endA = a.current_period_end ?? "";
        const endB = b.current_period_end ?? "";
        return endA < endB ? 1 : -1;
      });

    if (activeSubs.length > 0) {
      const s = activeSubs[0];
      return {
        id: s.id,
        plan_type: s.plan_type as "monthly" | "yearly",
        status: s.status,
        current_period_start: s.current_period_start,
        current_period_end: s.current_period_end,
        cancel_at_period_end: s.cancel_at_period_end,
        stripe_subscription_id: s.stripe_subscription_id,
        amount: Number(s.amount),
      };
    }

    // 2. Otherwise sort by current_period_end DESC
    const sorted = [...subscriptions].sort((a, b) => {
      const endA = a.current_period_end ?? a.created_at;
      const endB = b.current_period_end ?? b.created_at;
      return endA < endB ? 1 : -1;
    });
    const s = sorted[0];
    return {
      id: s.id,
      plan_type: s.plan_type as "monthly" | "yearly",
      status: s.status,
      current_period_start: s.current_period_start,
      current_period_end: s.current_period_end,
      cancel_at_period_end: s.cancel_at_period_end,
      stripe_subscription_id: s.stripe_subscription_id,
      amount: Number(s.amount),
    };
  }

  /**
   * Retrieves master ledger of registered users for the Admin Directory.
   * Resolves exactly one current subscription per user while retaining full query/filter support.
   */
  static async getUsersList(
    adminSupabase: SupabaseClient<Database>,
    rawFilters?: unknown
  ): Promise<AdminServiceResult<{ users: AdminUserListItem[]; total: number }>> {
    const parseResult = adminUserFilterSchema.safeParse(rawFilters ?? {});
    if (!parseResult.success) {
      return {
        error: parseResult.error.issues[0]?.message ?? "Invalid filter criteria",
      };
    }

    const filters: AdminUserFilterInput = parseResult.data;

    try {
      // 1. Fetch all profiles ordered by created_at DESC
      const { data: profiles, error: pErr } = await adminSupabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (pErr) {
        return { error: `Failed to fetch profiles: ${pErr.message}` };
      }

      // 2. Fetch all charities for name resolution
      const { data: charities } = await adminSupabase
        .from("charities")
        .select("id, name");
      const charityMap = new Map((charities ?? []).map((c) => [c.id, c.name]));

      // 3. Fetch all subscriptions
      const { data: subscriptions } = await adminSupabase
        .from("subscriptions")
        .select("*");

      // Group subscriptions by user_id
      const subMap = new Map<string, SubscriptionRow[]>();
      for (const sub of subscriptions ?? []) {
        const list = subMap.get(sub.user_id) ?? [];
        list.push(sub);
        subMap.set(sub.user_id, list);
      }

      const nowIso = new Date().toISOString();

      // 4. Map profiles to AdminUserListItem with resolved current subscription
      const allItems: AdminUserListItem[] = (profiles ?? []).map((p) => {
        const userSubs = subMap.get(p.id) ?? [];
        const currentSub = this.resolveCurrentSubscription(userSubs);

        return {
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          role: p.role as "admin" | "subscriber",
          charity_id: p.charity_id,
          charity_name: p.charity_id ? charityMap.get(p.charity_id) ?? null : null,
          charity_contribution_pct: Number(p.charity_contribution_pct),
          created_at: p.created_at,
          current_subscription: currentSub,
        };
      });

      // 5. Apply filters
      let filtered = allItems;

      // Role filter
      if (filters.role && filters.role !== "all") {
        filtered = filtered.filter((u) => u.role === filters.role);
      }

      // Subscription status filter
      if (filters.subscriptionStatus && filters.subscriptionStatus !== "all") {
        if (filters.subscriptionStatus === "none") {
          filtered = filtered.filter((u) => !u.current_subscription);
        } else if (filters.subscriptionStatus === "active") {
          filtered = filtered.filter(
            (u) =>
              u.current_subscription &&
              (u.current_subscription.status === "active" ||
                u.current_subscription.status === "trialing") &&
              u.current_subscription.current_period_end !== null &&
              u.current_subscription.current_period_end > nowIso
          );
        } else {
          filtered = filtered.filter(
            (u) =>
              u.current_subscription &&
              u.current_subscription.status === filters.subscriptionStatus
          );
        }
      }

      // Search query filter (matches email or full_name)
      if (filters.search && filters.search.trim() !== "") {
        const query = filters.search.toLowerCase().trim();
        filtered = filtered.filter(
          (u) =>
            u.email.toLowerCase().includes(query) ||
            (u.full_name && u.full_name.toLowerCase().includes(query))
        );
      }

      const total = filtered.length;
      const page = filters.page ?? 1;
      const limit = filters.limit ?? 50;
      const startIndex = (page - 1) * limit;
      const paginated = filtered.slice(startIndex, startIndex + limit);

      return {
        data: {
          users: paginated,
          total,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { error: `Failed to retrieve user directory: ${msg}` };
    }
  }

  /**
   * Retrieves full details for a single user:
   * - Profile row
   * - Designated Charity (if any)
   * - Full Subscription History (1:N, ordered by created_at DESC)
   * - Retained Golf Scores (up to 5, ordered by played_date DESC, created_at DESC)
   * - Resolved current subscription summary
   */
  static async getUserDetail(
    adminSupabase: SupabaseClient<Database>,
    userId: string
  ): Promise<AdminServiceResult<AdminUserDetail>> {
    if (!userId) {
      return { error: "User ID is required." };
    }

    try {
      const [profileRes, subsRes, scoresRes] = await Promise.all([
        adminSupabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle(),
        adminSupabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        ScoreService.getUserScores(adminSupabase, userId),
      ]);

      if (profileRes.error || !profileRes.data) {
        return { error: profileRes.error?.message ?? "User profile not found." };
      }

      const profile = profileRes.data;
      const subscriptions = subsRes.data ?? [];
      const scores = scoresRes.data ?? [];
      const current_subscription = this.resolveCurrentSubscription(subscriptions);

      let charity: CharityRow | null = null;
      if (profile.charity_id) {
        const { data: charityData } = await adminSupabase
          .from("charities")
          .select("*")
          .eq("id", profile.charity_id)
          .maybeSingle();
        charity = charityData ?? null;
      }

      return {
        data: {
          profile,
          charity,
          subscriptions,
          scores,
          current_subscription,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { error: `Failed to retrieve user detail: ${msg}` };
    }
  }

  /**
   * Updates user profile fields safely.
   * Strictly permits updating full_name, charity_id, charity_contribution_pct.
   * Email is read-only to prevent Supabase Auth desynchronization.
   * Role mutations are strictly rejected here and must go through updateUserRole.
   */
  static async updateUserProfile(
    adminSupabase: SupabaseClient<Database>,
    input: unknown
  ): Promise<AdminServiceResult<ProfileRow>> {
    const parseResult = adminUpdateProfileSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        error: parseResult.error.issues[0]?.message ?? "Invalid profile update data",
      };
    }

    const { userId, fullName, charityId, charityContributionPct } = parseResult.data;
    const normalizedCharityId = charityId && charityId.trim() !== "" ? charityId : null;

    // Verify charity exists if provided
    if (normalizedCharityId) {
      const { data: charity, error: cErr } = await adminSupabase
        .from("charities")
        .select("id")
        .eq("id", normalizedCharityId)
        .maybeSingle();

      if (cErr || !charity) {
        return { error: "Selected charity does not exist." };
      }
    }

    const { data: updated, error: uErr } = await adminSupabase
      .from("profiles")
      .update({
        full_name: fullName,
        charity_id: normalizedCharityId,
        charity_contribution_pct: charityContributionPct,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select()
      .single();

    if (uErr) {
      return { error: `Failed to update profile: ${uErr.message}` };
    }

    return { data: updated };
  }

  /**
   * Updates user role atomically with advisory lock serialization,
   * caller authentication verification, self-demotion prevention,
   * and last-administrator protection.
   */
  static async updateUserRole(
    supabaseClient: SupabaseClient<Database>,
    callerId: string,
    input: unknown
  ): Promise<AdminServiceResult<{ user_id: string; role: string; message?: string }>> {
    const parseResult = adminUpdateRoleSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        error: parseResult.error.issues[0]?.message ?? "Invalid role update input",
      };
    }

    const { targetUserId, role: newRole } = parseResult.data;

    // 1. Attempt authoritative RPC update_user_role_atomic
    const { data: rpcData, error: rpcErr } = await supabaseClient.rpc(
      "update_user_role_atomic",
      {
        p_caller_id: callerId,
        p_target_user_id: targetUserId,
        p_new_role: newRole,
      }
    );

    // If RPC succeeded, return the result
    if (!rpcErr && rpcData) {
      const resultObj = rpcData as { user_id: string; role: string; message?: string };
      return { data: resultObj };
    }

    // If error is not PGRST202 (e.g. business exception CANNOT_DEMOTE_SELF or LAST_ADMIN_PROTECTED),
    // return the error message directly
    if (rpcErr && rpcErr.code !== "PGRST202") {
      return { error: rpcErr.message };
    }

    // 2. Resilient fallback if RPC not yet compiled on remote database
    // Enforces the EXACT SAME business invariants
    // Verify caller is admin
    const { data: callerProfile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .maybeSingle();

    if (!callerProfile || callerProfile.role !== "admin") {
      return { error: "UNAUTHORIZED: caller is not an administrator" };
    }

    // Verify target user exists
    const { data: targetProfile, error: tErr } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", targetUserId)
      .maybeSingle();

    if (tErr || !targetProfile) {
      return { error: "USER_NOT_FOUND: Target user does not exist" };
    }

    // If already has role, return early
    if (targetProfile.role === newRole) {
      return {
        data: {
          user_id: targetUserId,
          role: newRole,
          message: "User already has this role",
        },
      };
    }

    // Prevent self-demotion
    if (callerId === targetUserId && newRole !== "admin") {
      return {
        error: "CANNOT_DEMOTE_SELF: Administrators cannot demote themselves",
      };
    }

    // Prevent demoting the last remaining admin
    if (targetProfile.role === "admin" && newRole !== "admin") {
      const { count: adminCount, error: countErr } = await supabaseClient
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");

      if (countErr) {
        return { error: `Failed to verify administrator count: ${countErr.message}` };
      }

      if ((adminCount ?? 0) <= 1) {
        return {
          error: "LAST_ADMIN_PROTECTED: Cannot demote the last remaining administrator",
        };
      }
    }

    // Update role
    const { data: updated, error: uErr } = await supabaseClient
      .from("profiles")
      .update({
        role: newRole,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetUserId)
      .select()
      .single();

    if (uErr) {
      return { error: `Failed to update user role: ${uErr.message}` };
    }

    return {
      data: {
        user_id: updated.id,
        role: updated.role,
      },
    };
  }

  /**
   * Authoritative Administrative Subscription Cancellation:
   * 1. Verifies subscription exists in database.
   * 2. Calls Stripe API FIRST with cancel_at_period_end: true.
   * 3. Only after Stripe confirms, updates cancel_at_period_end = true locally.
   * 4. NEVER directly changes subscription status in Supabase (status remains active
   *    until current_period_end, when Stripe sends customer.subscription.deleted).
   */
  static async cancelSubscription(
    adminSupabase: SupabaseClient<Database>,
    subscriptionId: string
  ): Promise<AdminServiceResult<{ subscriptionId: string; cancel_at_period_end: boolean }>> {
    if (!subscriptionId) {
      return { error: "Subscription ID is required." };
    }

    // 1. Fetch subscription row
    const { data: sub, error: sErr } = await adminSupabase
      .from("subscriptions")
      .select("*")
      .eq("id", subscriptionId)
      .maybeSingle();

    if (sErr || !sub) {
      return { error: "Subscription record not found." };
    }

    if (sub.cancel_at_period_end) {
      return {
        error: "Subscription is already scheduled for cancellation at period end.",
      };
    }

    if (sub.status === "canceled") {
      return {
        error: "Subscription is already canceled.",
      };
    }

    if (!sub.stripe_subscription_id) {
      return {
        error: "Subscription has no associated Stripe subscription ID.",
      };
    }

    // 2. Call Stripe API FIRST
    try {
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    } catch (stripeErr) {
      const msg = stripeErr instanceof Error ? stripeErr.message : "Stripe API error";
      return { error: `Stripe cancellation failed: ${msg}` };
    }

    // 3. Reflect cancel_at_period_end locally in Supabase (preserve status untouched!)
    const { error: updateErr } = await adminSupabase
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscriptionId);

    if (updateErr) {
      return {
        error: `Stripe canceled successfully, but local state update failed: ${updateErr.message}`,
      };
    }

    return {
      data: {
        subscriptionId,
        cancel_at_period_end: true,
      },
    };
  }

  /**
   * Minimal Safe Score Administration:
   * Directly delegates to ScoreService without duplicating any business logic.
   */
  static async addAdminScore(
    adminSupabase: SupabaseClient<Database>,
    targetUserId: string,
    input: unknown
  ): Promise<AdminServiceResult<GolfScore>> {
    return ScoreService.addScore(adminSupabase, targetUserId, input);
  }

  static async updateAdminScore(
    adminSupabase: SupabaseClient<Database>,
    targetUserId: string,
    input: unknown
  ): Promise<AdminServiceResult<GolfScore>> {
    return ScoreService.updateScore(adminSupabase, targetUserId, input);
  }

  static async deleteAdminScore(
    adminSupabase: SupabaseClient<Database>,
    targetUserId: string,
    scoreId: string
  ): Promise<AdminServiceResult<boolean>> {
    return ScoreService.deleteScore(adminSupabase, targetUserId, scoreId);
  }
}
