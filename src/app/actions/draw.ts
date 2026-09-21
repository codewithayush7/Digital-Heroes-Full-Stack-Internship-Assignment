"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DrawService,
  type PublishDrawResult,
} from "@/lib/services/draw.service";

export type PublishDrawActionResult = {
  success?: boolean;
  error?: string;
  data?: PublishDrawResult | null;
};

/**
 * Server action to publish a simulated draw.
 * 1. Creates authenticated server-side Supabase client
 * 2. Retrieves current authenticated user
 * 3. Verifies that the user has the 'admin' role in profiles
 * 4. Calls DrawService.publishDraw (invoking the atomic publish_draw PostgreSQL RPC)
 * 5. Revalidates relevant UI paths
 * 6. Returns structured result
 */
export async function publishDrawAction(
  drawId: string
): Promise<PublishDrawActionResult> {
  if (!drawId) {
    return { error: "Draw ID is required." };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Authentication required to publish draws." };
  }

  // 1. Get current authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Authentication required to publish draws." };
  }

  // 2. Verify profile.role = 'admin'
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { error: "Unable to verify administrator authorization." };
  }

  if (profile.role !== "admin") {
    return { error: "Unauthorized: only administrators can publish draws." };
  }

  // 3. Delegate atomic publishing to DrawService / PostgreSQL RPC
  const result = await DrawService.publishDraw(supabase, drawId, user.id);

  if (result.error) {
    return { error: result.error };
  }

  // 4. Revalidate relevant paths
  revalidatePath("/admin/draws");
  revalidatePath("/dashboard");
  revalidatePath("/draws");

  return { success: true, data: result.data };
}
