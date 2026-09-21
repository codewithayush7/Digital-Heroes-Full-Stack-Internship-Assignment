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

  /**
   * Retrieve all charities for admin ledger, ordered by created_at DESC.
   */
  static async getAllCharitiesAdmin(
    supabase: SupabaseClient<Database>
  ): Promise<CharityServiceResult<Charity[]>> {
    const { data, error } = await supabase
      .from("charities")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return { error: error.message };
    }

    return { data: data ?? [] };
  }

  /**
   * Admin creation of a new partner charity.
   * Validates server-side with Zod and enforces slug uniqueness.
   */
  static async createCharity(
    supabase: SupabaseClient<Database>,
    input: unknown
  ): Promise<CharityServiceResult<Charity>> {
    const { createCharitySchema } = await import(
      "../validations/admin-charity.schema"
    );
    const parseResult = createCharitySchema.safeParse(input);
    if (!parseResult.success) {
      return {
        error:
          parseResult.error.issues[0]?.message ?? "Invalid charity creation data.",
      };
    }

    const {
      name,
      slug,
      tagline,
      description,
      websiteUrl,
      logoUrl,
      coverImageUrl,
      isFeatured,
    } = parseResult.data;

    // Check slug uniqueness
    const { data: existingSlug, error: checkErr } = await supabase
      .from("charities")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (checkErr) {
      return { error: checkErr.message };
    }

    if (existingSlug) {
      return { error: "A charity with this slug already exists." };
    }

    const { data: createdCharity, error: insertErr } = await supabase
      .from("charities")
      .insert({
        name,
        slug,
        tagline: tagline || null,
        description,
        website_url: websiteUrl || null,
        logo_url: logoUrl || null,
        cover_image_url: coverImageUrl || null,
        is_featured: isFeatured,
      })
      .select()
      .single();

    if (insertErr) {
      return { error: insertErr.message };
    }

    return { data: createdCharity };
  }

  /**
   * Admin update of an existing partner charity.
   * Validates server-side with Zod and preserves unique slug constraint.
   */
  static async updateCharity(
    supabase: SupabaseClient<Database>,
    input: unknown
  ): Promise<CharityServiceResult<Charity>> {
    const { updateCharitySchema } = await import(
      "../validations/admin-charity.schema"
    );
    const parseResult = updateCharitySchema.safeParse(input);
    if (!parseResult.success) {
      return {
        error:
          parseResult.error.issues[0]?.message ?? "Invalid charity update data.",
      };
    }

    const {
      id,
      name,
      slug,
      tagline,
      description,
      websiteUrl,
      logoUrl,
      coverImageUrl,
      isFeatured,
    } = parseResult.data;

    // Verify existence
    const { data: existingCharity, error: findErr } = await supabase
      .from("charities")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (findErr) {
      return { error: findErr.message };
    }

    if (!existingCharity) {
      return { error: "Charity not found." };
    }

    // Check slug uniqueness against other records
    const { data: slugCollision } = await supabase
      .from("charities")
      .select("id")
      .eq("slug", slug)
      .neq("id", id)
      .maybeSingle();

    if (slugCollision) {
      return { error: "Another charity is already using this slug." };
    }

    const { data: updatedCharity, error: updateErr } = await supabase
      .from("charities")
      .update({
        name,
        slug,
        tagline: tagline || null,
        description,
        website_url: websiteUrl || null,
        logo_url: logoUrl || null,
        cover_image_url: coverImageUrl || null,
        is_featured: isFeatured,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      return { error: updateErr.message };
    }

    return { data: updatedCharity };
  }

  /**
   * Admin toggle of a charity's featured status.
   */
  static async toggleFeatured(
    supabase: SupabaseClient<Database>,
    charityId: string,
    isFeatured: boolean
  ): Promise<CharityServiceResult<Charity>> {
    const { toggleFeaturedCharitySchema } = await import(
      "../validations/admin-charity.schema"
    );
    const parseResult = toggleFeaturedCharitySchema.safeParse({
      id: charityId,
      isFeatured,
    });
    if (!parseResult.success) {
      return {
        error:
          parseResult.error.issues[0]?.message ?? "Invalid featured toggle input.",
      };
    }

    const { data: updated, error } = await supabase
      .from("charities")
      .update({
        is_featured: isFeatured,
        updated_at: new Date().toISOString(),
      })
      .eq("id", charityId)
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    return { data: updated };
  }

  /**
   * Admin deletion of a partner charity.
   * Relies on PostgreSQL foreign key constraints:
   * - profiles.charity_id -> ON DELETE SET NULL
   * - charity_events -> ON DELETE CASCADE
   * - donations -> ON DELETE CASCADE
   */
  static async deleteCharity(
    supabase: SupabaseClient<Database>,
    charityId: string
  ): Promise<CharityServiceResult<boolean>> {
    const { deleteCharitySchema } = await import(
      "../validations/admin-charity.schema"
    );
    const parseResult = deleteCharitySchema.safeParse({ id: charityId });
    if (!parseResult.success) {
      return {
        error:
          parseResult.error.issues[0]?.message ?? "Invalid charity ID for deletion.",
      };
    }

    // Verify existence
    const { data: existing, error: findErr } = await supabase
      .from("charities")
      .select("id, name")
      .eq("id", charityId)
      .maybeSingle();

    if (findErr) {
      return { error: findErr.message };
    }

    if (!existing) {
      return { error: "Charity not found." };
    }

    const { error: deleteErr } = await supabase
      .from("charities")
      .delete()
      .eq("id", charityId);

    if (deleteErr) {
      return { error: deleteErr.message };
    }

    return { data: true };
  }
}
