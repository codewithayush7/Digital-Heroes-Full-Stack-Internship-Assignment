"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DonationService } from "@/lib/services/donation.service";
import { donationCheckoutSchema } from "@/lib/validations/donation.schema";

export async function createDonationCheckoutAction(formData: FormData) {
  const rawData = {
    charityId: formData.get("charityId"),
    amount: formData.get("amount"),
  };

  const parsed = donationCheckoutSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid donation input." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const headerList = await headers();
  const host = headerList.get("host") || "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") || "http";
  const originUrl =
    process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

  const { url, error } = await DonationService.createDonationCheckoutSession(
    supabase,
    {
      charityId: parsed.data.charityId,
      amount: parsed.data.amount,
      userId: user?.id || null,
      originUrl,
    }
  );

  if (error || !url) {
    return { error: error || "Unable to initiate donation checkout." };
  }

  redirect(url);
}
