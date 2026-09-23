import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { SubscriptionService } from "@/lib/services/subscription.service";

export type UserVerificationStatus = {
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
};

/**
 * Checks whether a user account has a confirmed email address.
 * Evaluates both email_confirmed_at and confirmed_at for compatibility.
 */
export function isUserEmailConfirmed(
  user: UserVerificationStatus | null | undefined
): boolean {
  if (!user) return false;
  return Boolean(user.email_confirmed_at || user.confirmed_at);
}

/**
 * Authoritatively evaluates whether an authenticated normal user qualifies to manage golf scores:
 * 1. User must be authenticated.
 * 2. User must have a confirmed email address.
 * 3. User must hold an active or trialing subscription with future current_period_end.
 *
 * Non-qualifying states (no subscription, past_due, unpaid, canceled, lapsed, expired) are rejected.
 */
export async function verifyUserScoreAuthorization(
  supabase: SupabaseClient<Database>,
  user: (UserVerificationStatus & { id: string }) | null | undefined,
  actionType: "enter" | "edit" | "delete" = "enter"
): Promise<{ allowed: boolean; error?: string }> {
  if (!user || !user.id) {
    return {
      allowed: false,
      error: `You must be signed in to ${actionType} scores.`,
    };
  }

  if (!isUserEmailConfirmed(user)) {
    return {
      allowed: false,
      error: "Please verify your email address before managing golf scores.",
    };
  }

  const isSubscribed = await SubscriptionService.hasActiveSubscription(
    supabase,
    user.id
  );

  if (!isSubscribed) {
    return {
      allowed: false,
      error: "An active subscription is required to manage golf scores.",
    };
  }

  return { allowed: true };
}
