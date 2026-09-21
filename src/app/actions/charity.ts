"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CharityService } from "@/lib/services/charity.service";

export type CharityActionResult = {
  error?: string;
  success?: boolean;
  message?: string;
};

export async function updateCharitySelectionAction(
  _prevState: CharityActionResult | null,
  formData: FormData
): Promise<CharityActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to update your charity preferences." };
  }

  const rawData = {
    charityId: formData.get("charityId"),
    charityContributionPct: formData.get("charityContributionPct"),
  };

  const adminClient = createAdminClient();
  const result = await CharityService.updateSubscriberCharity(
    adminClient,
    user.id,
    rawData
  );

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/dashboard");
  revalidatePath("/profile");

  return {
    success: true,
    message: "Charity preferences successfully updated!",
  };
}

/**
 * Internal helper to verify admin role from auth session
 */
async function requireAdmin(): Promise<{ error?: string; userId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "UNAUTHORIZED: Authentication required." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "UNAUTHORIZED: Administrator privileges required." };
  }

  return { userId: user.id };
}

/**
 * Admin action to create a new partner charity.
 */
export async function createCharityAction(
  _prevState: CharityActionResult | null,
  formData: FormData
): Promise<CharityActionResult> {
  const authCheck = await requireAdmin();
  if (authCheck.error) {
    return { error: authCheck.error };
  }

  const rawData = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    tagline: formData.get("tagline") || null,
    description: formData.get("description"),
    websiteUrl: formData.get("websiteUrl") || null,
    logoUrl: formData.get("logoUrl") || null,
    coverImageUrl: formData.get("coverImageUrl") || null,
    isFeatured: formData.get("isFeatured") === "true" || formData.get("isFeatured") === "on",
  };

  const adminClient = createAdminClient();
  const result = await CharityService.createCharity(adminClient, rawData);

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin/charities");
  revalidatePath("/admin");
  revalidatePath("/charities");

  return {
    success: true,
    message: `Partner charity '${result.data?.name}' successfully created!`,
  };
}

/**
 * Admin action to update an existing partner charity.
 */
export async function updateCharityAction(
  _prevState: CharityActionResult | null,
  formData: FormData
): Promise<CharityActionResult> {
  const authCheck = await requireAdmin();
  if (authCheck.error) {
    return { error: authCheck.error };
  }

  const rawData = {
    id: formData.get("id"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    tagline: formData.get("tagline") || null,
    description: formData.get("description"),
    websiteUrl: formData.get("websiteUrl") || null,
    logoUrl: formData.get("logoUrl") || null,
    coverImageUrl: formData.get("coverImageUrl") || null,
    isFeatured: formData.get("isFeatured") === "true" || formData.get("isFeatured") === "on",
  };

  const adminClient = createAdminClient();
  const result = await CharityService.updateCharity(adminClient, rawData);

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin/charities");
  revalidatePath("/admin");
  revalidatePath("/charities");
  if (result.data?.slug) {
    revalidatePath(`/charities/${result.data.slug}`);
  }

  return {
    success: true,
    message: `Partner charity '${result.data?.name}' updated successfully!`,
  };
}

/**
 * Admin action to toggle featured status of a partner charity.
 */
export async function toggleFeaturedCharityAction(
  charityId: string,
  isFeatured: boolean
): Promise<CharityActionResult> {
  const authCheck = await requireAdmin();
  if (authCheck.error) {
    return { error: authCheck.error };
  }

  const adminClient = createAdminClient();
  const result = await CharityService.toggleFeatured(adminClient, charityId, isFeatured);

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin/charities");
  revalidatePath("/admin");
  revalidatePath("/charities");

  return {
    success: true,
    message: `Featured status updated for '${result.data?.name}'.`,
  };
}

/**
 * Admin action to delete a partner charity.
 * Relies on PostgreSQL foreign keys:
 * - profiles.charity_id SET NULL
 * - charity_events CASCADE
 * - donations CASCADE
 */
export async function deleteCharityAction(
  charityId: string
): Promise<CharityActionResult> {
  const authCheck = await requireAdmin();
  if (authCheck.error) {
    return { error: authCheck.error };
  }

  const adminClient = createAdminClient();
  const result = await CharityService.deleteCharity(adminClient, charityId);

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin/charities");
  revalidatePath("/admin");
  revalidatePath("/charities");
  revalidatePath("/dashboard");

  return {
    success: true,
    message: "Charity successfully deleted.",
  };
}
