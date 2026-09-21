"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AdminService,
  type AdminUserListItem,
  type AdminUserDetail,
  type ProfileRow,
} from "@/lib/services/admin.service";
import type { GolfScore } from "@/lib/services/score.service";
import {
  adminUpdateProfileSchema,
  adminUpdateRoleSchema,
  adminAddScoreSchema,
  adminUpdateScoreSchema,
  adminDeleteScoreSchema,
} from "@/lib/validations/admin-user.schema";

export type AdminUserActionResult<T = unknown> = {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
};

/**
 * Verifies that the current request is from an authenticated administrator.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Authentication required to access administrative features." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { error: "Unable to verify administrator privileges." };
  }

  if (profile.role !== "admin") {
    return { error: "Unauthorized: requires administrator privileges." };
  }

  return { supabase, user };
}

/**
 * Fetch master user ledger with filters and pagination.
 */
export async function getUsersListAction(
  filters?: unknown
): Promise<AdminUserActionResult<{ users: AdminUserListItem[]; total: number }>> {
  const authCheck = await requireAdmin();
  if (authCheck.error || !authCheck.user) {
    return { error: authCheck.error };
  }

  const adminClient = createAdminClient();
  const result = await AdminService.getUsersList(adminClient, filters);
  if (result.error) {
    return { error: result.error };
  }

  return { success: true, data: result.data };
}

/**
 * Fetch full user details, 1:N subscription history, and golf scores.
 */
export async function getUserDetailAction(
  userId: string
): Promise<AdminUserActionResult<AdminUserDetail>> {
  const authCheck = await requireAdmin();
  if (authCheck.error || !authCheck.user) {
    return { error: authCheck.error };
  }

  const adminClient = createAdminClient();
  const result = await AdminService.getUserDetail(adminClient, userId);
  if (result.error) {
    return { error: result.error };
  }

  return { success: true, data: result.data };
}

/**
 * Safely update user profile metadata (full_name, charity_id, charity_contribution_pct).
 * Email is read-only.
 */
export async function updateUserProfileAction(
  _prevState: AdminUserActionResult<ProfileRow> | null,
  formData: FormData
): Promise<AdminUserActionResult<ProfileRow>> {
  const authCheck = await requireAdmin();
  if (authCheck.error || !authCheck.user) {
    return { error: authCheck.error };
  }

  const rawData = {
    userId: formData.get("userId"),
    fullName: formData.get("fullName"),
    charityId: formData.get("charityId"),
    charityContributionPct: formData.get("charityContributionPct"),
  };

  const parsed = adminUpdateProfileSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid profile data." };
  }

  const adminClient = createAdminClient();
  const result = await AdminService.updateUserProfile(adminClient, parsed.data);
  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${parsed.data.userId}`);

  return {
    success: true,
    data: result.data,
    message: "User profile successfully updated.",
  };
}

/**
 * Update user role atomically with advisory lock serialization and last-admin protection.
 */
export async function updateUserRoleAction(
  targetUserId: string,
  newRole: "admin" | "subscriber"
): Promise<AdminUserActionResult<{ user_id: string; role: string }>> {
  const authCheck = await requireAdmin();
  if (authCheck.error || !authCheck.user) {
    return { error: authCheck.error };
  }

  const parsed = adminUpdateRoleSchema.safeParse({ targetUserId, role: newRole });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid role input." };
  }

  const result = await AdminService.updateUserRole(
    authCheck.supabase,
    authCheck.user.id,
    parsed.data
  );

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${targetUserId}`);

  return {
    success: true,
    data: result.data,
    message: `User role updated to ${newRole}.`,
  };
}

/**
 * Authoritative administrative cancellation: calls Stripe first, then marks cancel_at_period_end.
 */
export async function cancelUserSubscriptionAction(
  subscriptionId: string
): Promise<AdminUserActionResult<{ subscriptionId: string; cancel_at_period_end: boolean }>> {
  const authCheck = await requireAdmin();
  if (authCheck.error || !authCheck.user) {
    return { error: authCheck.error };
  }

  const adminClient = createAdminClient();
  const result = await AdminService.cancelSubscription(adminClient, subscriptionId);
  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin/users");

  return {
    success: true,
    data: result.data,
    message: "Subscription scheduled for cancellation at period end.",
  };
}

/**
 * Minimal safe score administration: Add golf score for user.
 */
export async function adminAddScoreAction(
  targetUserId: string,
  input: { score: number; playedDate: string }
): Promise<AdminUserActionResult<GolfScore>> {
  const authCheck = await requireAdmin();
  if (authCheck.error || !authCheck.user) {
    return { error: authCheck.error };
  }

  const parsed = adminAddScoreSchema.safeParse({ targetUserId, ...input });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid score entry." };
  }

  const adminClient = createAdminClient();
  const result = await AdminService.addAdminScore(adminClient, targetUserId, {
    score: parsed.data.score,
    playedDate: parsed.data.playedDate,
  });

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin/users");
  return {
    success: true,
    data: result.data,
    message: "Golf score added successfully.",
  };
}

/**
 * Minimal safe score administration: Update golf score for user.
 */
export async function adminUpdateScoreAction(
  targetUserId: string,
  scoreId: string,
  input: { score: number; playedDate?: string }
): Promise<AdminUserActionResult<GolfScore>> {
  const authCheck = await requireAdmin();
  if (authCheck.error || !authCheck.user) {
    return { error: authCheck.error };
  }

  const parsed = adminUpdateScoreSchema.safeParse({
    targetUserId,
    scoreId,
    ...input,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid update entry." };
  }

  const adminClient = createAdminClient();
  const result = await AdminService.updateAdminScore(adminClient, targetUserId, {
    scoreId: parsed.data.scoreId,
    score: parsed.data.score,
    playedDate: parsed.data.playedDate,
  });

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin/users");
  return {
    success: true,
    data: result.data,
    message: "Golf score updated successfully.",
  };
}

/**
 * Minimal safe score administration: Delete golf score for user.
 */
export async function adminDeleteScoreAction(
  targetUserId: string,
  scoreId: string
): Promise<AdminUserActionResult<boolean>> {
  const authCheck = await requireAdmin();
  if (authCheck.error || !authCheck.user) {
    return { error: authCheck.error };
  }

  const parsed = adminDeleteScoreSchema.safeParse({ targetUserId, scoreId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid score delete request." };
  }

  const adminClient = createAdminClient();
  const result = await AdminService.deleteAdminScore(adminClient, targetUserId, scoreId);
  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin/users");
  return {
    success: true,
    data: true,
    message: "Golf score deleted successfully.",
  };
}
