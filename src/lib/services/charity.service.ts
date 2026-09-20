import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database.types";
import { charitySelectionSchema } from "../validations/charity.schema";

export type Charity = Tables<"charities">;
export type CharityEvent = Tables<"charity_events">;

export type CharityServiceResult<T> = {
  data?: T;
  error?: string;
};

export class CharityService {
  /**
   * Retrieve all charities with optional search and featured filtering.
   * Publicly accessible without authentication.
   */
  static async getCharities(
    supabase: SupabaseClient<Database>,
    options?: { search?: string; featuredOnly?: boolean }
  ): Promise<CharityServiceResult<Charity[]>> {
    let query = supabase
      .from("charities")
      .select("*")
      .order("is_featured", { ascending: false })
      .order("name", { ascending: true });

    if (options?.featuredOnly) {
      query = query.eq("is_featured", true);
    }

    if (options?.search && options.search.trim() !== "") {
      const term = `%${options.search.trim()}%`;
      query = query.or(`name.ilike.${term},description.ilike.${term},tagline.ilike.${term}`);
    }

    const { data, error } = await query;

    if (error) {
      return { error: error.message };
    }

    return { data: data ?? [] };
  }

  /**
   * Retrieve an individual charity by unique slug, including its upcoming events.
   * Publicly accessible without authentication.
   */
  static async getCharityBySlug(
    supabase: SupabaseClient<Database>,
    slug: string
  ): Promise<CharityServiceResult<{ charity: Charity; events: CharityEvent[] }>> {
    const { data: charity, error: charityErr } = await supabase
      .from("charities")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (charityErr) {
      return { error: charityErr.message };
    }

    if (!charity) {
      return { error: "Charity not found" };
    }

    // Retrieve upcoming events for this charity
    const { data: events, error: eventsErr } = await supabase
      .from("charity_events")
      .select("*")
      .eq("charity_id", charity.id)
      .order("event_date", { ascending: true });

    if (eventsErr) {
      return { error: eventsErr.message };
    }

    return {
      data: {
        charity,
        events: events ?? [],
      },
    };
  }

  /**
   * Controlled server-side update of a subscriber's selected charity and contribution percentage.
   * Uses the admin client to bypass the absence of a generic client-side UPDATE policy on profiles.
   * Strictly verifies input via Zod and guarantees 'role' is never modified.
   */
  static async updateSubscriberCharity(
    supabaseAdmin: SupabaseClient<Database>,
    userId: string,
    input: unknown
  ): Promise<CharityServiceResult<{ charity_id: string | null; charity_contribution_pct: number }>> {
    const parseResult = charitySelectionSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        error: parseResult.error.issues[0]?.message ?? "Invalid charity selection input",
      };
    }

    const { charityId, charityContributionPct } = parseResult.data;
    const normalizedCharityId = charityId && charityId.trim() !== "" ? charityId : null;

    // Verify charity exists if an ID is provided
    if (normalizedCharityId) {
      const { data: charityExists, error: checkErr } = await supabaseAdmin
        .from("charities")
        .select("id")
        .eq("id", normalizedCharityId)
        .maybeSingle();

      if (checkErr || !charityExists) {
        return { error: "Selected charity does not exist." };
      }
    }

    // Controlled update: Strictly modifies ONLY charity_id and charity_contribution_pct
    const { data: updatedProfile, error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({
        charity_id: normalizedCharityId,
        charity_contribution_pct: charityContributionPct,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("charity_id, charity_contribution_pct, role")
      .single();

    if (updateErr) {
      return { error: updateErr.message };
    }

    return {
      data: {
        charity_id: updatedProfile.charity_id,
        charity_contribution_pct: Number(updatedProfile.charity_contribution_pct),
      },
    };
  }
}
