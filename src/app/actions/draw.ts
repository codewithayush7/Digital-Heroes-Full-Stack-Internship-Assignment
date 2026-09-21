"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createDrawSchema } from "@/lib/validations/draw.schema";
import {
  DrawService,
  type Draw,
  type SimulationResult,
  type PublishDrawResult,
} from "@/lib/services/draw.service";

export type DrawActionResult<T = unknown> = {
  success?: boolean;
  error?: string;
  data?: T | null;
};

export type PublishDrawActionResult = DrawActionResult<PublishDrawResult>;

/**
 * Server action to create a new draw in 'draft' status.
 * Authenticates caller, verifies admin role, validates input via createDrawSchema,
 * and delegates to DrawService.createDraw.
 */
export async function createDrawAction(
  input: FormData | { title: string; draw_date: string; draw_mode: string }
): Promise<DrawActionResult<Draw>> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Authentication required to create draws." };
  }

  // 1. Get current authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Authentication required to create draws." };
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
    return { error: "Unauthorized: only administrators can create draws." };
  }

  // 3. Parse input
  let rawData: Record<string, unknown>;
  if (input instanceof FormData) {
    rawData = {
      title: input.get("title"),
      draw_date: input.get("draw_date"),
      draw_mode: input.get("draw_mode"),
    };
  } else {
    rawData = input as Record<string, unknown>;
  }

  const parsed = createDrawSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid draw input." };
  }

  // 4. Delegate to DrawService
  const result = await DrawService.createDraw(supabase, parsed.data, user.id);
  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin/draws");
  return { success: true, data: result.data };
}

/**
 * Server action to simulate or re-simulate a draw.
 * Authenticates caller, verifies admin role, validates drawId,
 * and delegates to DrawService.simulateDraw.
 */
export async function simulateDrawAction(
  drawId: string
): Promise<DrawActionResult<SimulationResult>> {
  if (!drawId) {
    return { error: "Draw ID is required to simulate." };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Authentication required to simulate draws." };
  }

  // 1. Get current authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Authentication required to simulate draws." };
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
    return { error: "Unauthorized: only administrators can simulate draws." };
  }

  // 3. Delegate to DrawService
  const result = await DrawService.simulateDraw(supabase, drawId);
  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin/draws");
  revalidatePath(`/admin/draws/${drawId}`);

  return { success: true, data: result.data };
}

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
