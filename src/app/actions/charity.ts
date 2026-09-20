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
