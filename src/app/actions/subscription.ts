"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SubscriptionService } from "@/lib/services/subscription.service";
import { checkoutSessionSchema } from "@/lib/validations/subscription.schema";
import type { PlanType } from "@/lib/stripe";

export async function createCheckoutSessionAction(planType: PlanType) {
  const parsed = checkoutSessionSchema.safeParse({ planType });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid plan type selection." };
  }

  const supabase = await createClient();
  const headerList = await headers();
  const host = headerList.get("host") || "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") || "http";
  const originUrl =
    process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

  const { url, error } = await SubscriptionService.createCheckoutSession(
    supabase,
    parsed.data.planType,
    originUrl
  );

  if (error || !url) {
    return { error: error || "Unable to initiate checkout." };
  }

  redirect(url);
}

export async function createCustomerPortalAction() {
  const supabase = await createClient();
  const headerList = await headers();
  const host = headerList.get("host") || "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") || "http";
  const originUrl =
    process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

  const { url, error } = await SubscriptionService.createCustomerPortalSession(
    supabase,
    originUrl
  );

  if (error || !url) {
    return { error: error || "Unable to access billing portal." };
  }

  redirect(url);
}
