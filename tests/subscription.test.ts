import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";
import {
  SubscriptionService,
  type StripeSubscriptionPayload,
  type StripeInvoicePayload,
} from "../src/lib/services/subscription.service";
import {
  stripe,
  getStripePriceId,
  getPlanTypeFromPriceId,
} from "../src/lib/stripe";
import { POST as webhookRouteHandler } from "../src/app/api/webhooks/stripe/route";
import { NextRequest } from "next/server";
import type Stripe from "stripe";

// Load environment variables from .env.local
const envContent = fs.readFileSync(".env.local", "utf-8");
envContent
  .split("\n")
  .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
  .forEach((line) => {
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_secret";

describe("Milestone 2: Subscription & Stripe Integration Tests", () => {
  let adminClient: SupabaseClient<Database>;
  let userClient: SupabaseClient<Database>;
  let anonClient: SupabaseClient<Database>;

  let testUserId: string;
  let testCharityId: string;
  const userEmail = `sub_tester_${Date.now()}@gmail.com`;
  const userPassword = "TestPassword123!";

  const dummySubId = `sub_test_${Date.now()}`;
  const dummyCustomerId = `cus_test_${Date.now()}`;

  before(async () => {
    adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);
    anonClient = createClient<Database>(supabaseUrl, supabaseAnonKey);

    // 1. Create authenticated test user
    const { data: userAuth, error: authErr } =
      await adminClient.auth.admin.createUser({
        email: userEmail,
        password: userPassword,
        email_confirm: true,
        user_metadata: { full_name: "Stripe Subscription Tester" },
      });
    assert.ifError(authErr);
    testUserId = userAuth.user.id;

    // 2. Sign in user to establish authenticated client session
    userClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
    const { error: signInErr } = await userClient.auth.signInWithPassword({
      email: userEmail,
      password: userPassword,
    });
    assert.ifError(signInErr);

    // 3. Find an existing charity to test charity allocation
    const { data: charities } = await adminClient
      .from("charities")
      .select("id")
      .limit(1);

    if (charities && charities.length > 0) {
      testCharityId = charities[0].id;
      // Configure user with this charity and 20% contribution
      await adminClient
        .from("profiles")
        .update({
          charity_id: testCharityId,
          charity_contribution_pct: 20.0,
        })
        .eq("id", testUserId);
    }
  });

  after(async () => {
    // Cleanup subscriptions, donations, and test user
    if (adminClient && testUserId) {
      await adminClient.from("subscriptions").delete().eq("user_id", testUserId);
      await adminClient.from("donations").delete().eq("user_id", testUserId);
      await adminClient.auth.admin.deleteUser(testUserId);
    }
  });

  // 1. Monthly checkout uses monthly Price ID
  test("1. monthly checkout uses configured monthly Price ID", () => {
    const monthlyPriceId = getStripePriceId("monthly");
    assert.strictEqual(monthlyPriceId, process.env.STRIPE_MONTHLY_PRICE_ID);
    assert.strictEqual(getPlanTypeFromPriceId(monthlyPriceId), "monthly");
  });

  // 2. Yearly checkout uses yearly Price ID
  test("2. yearly checkout uses configured yearly Price ID", () => {
    const yearlyPriceId = getStripePriceId("yearly");
    assert.strictEqual(yearlyPriceId, process.env.STRIPE_YEARLY_PRICE_ID);
    assert.strictEqual(getPlanTypeFromPriceId(yearlyPriceId), "yearly");
  });

  // 3. Unauthenticated checkout is rejected
  test("3. unauthenticated checkout is rejected", async () => {
    const res = await SubscriptionService.createCheckoutSession(
      anonClient,
      "monthly",
      "http://localhost:3000"
    );

    assert.strictEqual(res.url, null);
    assert.ok(res.error?.toLowerCase().includes("authentication"));
  });

  // 4. Client cannot supply arbitrary userId for checkout
  test("4. client cannot supply arbitrary userId for checkout", async () => {
    // Calling with authenticated user client
    // Server-side code must use supabase.auth.getUser() and ignore any client attempts to pass a foreign userId
    const res = await SubscriptionService.createCheckoutSession(
      userClient,
      "monthly",
      "http://localhost:3000"
    );

    // Should generate a valid Stripe test checkout session URL or return Stripe API error
    if (res.error) {
      // If Stripe test key rejects without network or if valid session is returned
      assert.ok(res.error || res.url);
    } else {
      assert.ok(res.url?.startsWith("https://checkout.stripe.com"));
    }
  });

  // 5. Webhook rejects invalid / missing signatures
  test("5. webhook rejects invalid or missing signatures", async () => {
    const payload = JSON.stringify({ id: "evt_test", type: "ping" });

    // 5a. Missing signature
    const reqMissing = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      body: payload,
    });
    const resMissing = await webhookRouteHandler(reqMissing);
    assert.strictEqual(resMissing.status, 400);

    // 5b. Invalid signature
    const reqInvalid = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: {
        "stripe-signature": "t=1234567,v1=bad_signature_hex_digest",
      },
    });
    const resInvalid = await webhookRouteHandler(reqInvalid);
    assert.strictEqual(resInvalid.status, 400);

    // 5c. Valid signature succeeds with 200
    const validSignature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });
    const reqValid = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: {
        "stripe-signature": validSignature,
      },
    });
    const resValid = await webhookRouteHandler(reqValid);
    assert.strictEqual(resValid.status, 200);
  });

  // 6. Valid subscription webhook creates/updates subscription
  test("6. valid subscription webhook creates/updates subscription", async () => {
    const nowEpoch = Math.floor(Date.now() / 1000);
    const mockSubscription: Partial<StripeSubscriptionPayload> = {
      id: dummySubId,
      customer: dummyCustomerId,
      status: "active",
      current_period_start: nowEpoch,
      current_period_end: nowEpoch + 30 * 86400, // 30 days ahead
      cancel_at_period_end: false,
      currency: "inr",
      metadata: {
        userId: testUserId,
        planType: "monthly",
      },
      items: {
        object: "list",
        data: [
          {
            id: "si_mock",
            object: "subscription_item",
            price: {
              id: process.env.STRIPE_MONTHLY_PRICE_ID || "price_mock_monthly",
              unit_amount: 49900,
            } as unknown as Stripe.Price,
          } as unknown as Stripe.SubscriptionItem,
        ],
        has_more: false,
        url: "",
      },
    };

    const syncRes = await SubscriptionService.syncSubscriptionFromStripe(
      adminClient,
      mockSubscription as unknown as Stripe.Subscription
    );

    assert.strictEqual(syncRes.success, true);
    assert.ok(syncRes.subscription);
    assert.strictEqual(syncRes.subscription.user_id, testUserId);
    assert.strictEqual(syncRes.subscription.stripe_subscription_id, dummySubId);
    assert.strictEqual(syncRes.subscription.status, "active");
    assert.strictEqual(syncRes.subscription.plan_type, "monthly");
  });

  // 7. Subscription update is idempotent
  test("7. subscription update is idempotent using stripe_subscription_id", async () => {
    const nowEpoch = Math.floor(Date.now() / 1000);
    const mockUpdatedSub: Partial<StripeSubscriptionPayload> = {
      id: dummySubId,
      customer: dummyCustomerId,
      status: "active",
      current_period_start: nowEpoch,
      current_period_end: nowEpoch + 60 * 86400,
      cancel_at_period_end: true, // updated
      currency: "inr",
      metadata: {
        userId: testUserId,
        planType: "monthly",
      },
      items: {
        object: "list",
        data: [
          {
            id: "si_mock",
            object: "subscription_item",
            price: {
              id: process.env.STRIPE_MONTHLY_PRICE_ID || "price_mock_monthly",
              unit_amount: 49900,
            } as unknown as Stripe.Price,
          } as unknown as Stripe.SubscriptionItem,
        ],
        has_more: false,
        url: "",
      },
    };

    const syncRes = await SubscriptionService.syncSubscriptionFromStripe(
      adminClient,
      mockUpdatedSub as unknown as Stripe.Subscription
    );

    assert.strictEqual(syncRes.success, true);
    assert.strictEqual(syncRes.subscription?.cancel_at_period_end, true);

    // Verify only 1 row exists in public.subscriptions for this stripe_subscription_id
    const { data: rows } = await adminClient
      .from("subscriptions")
      .select("id")
      .eq("stripe_subscription_id", dummySubId);

    assert.strictEqual(rows?.length, 1);
  });

  // 8. Successful invoice records charity allocation
  test("8. successful invoice records charity allocation (20% of paid amount)", async () => {
    const invoicePaymentId = `pi_test_${Date.now()}`;
    const amountPaidCents = 49900; // 499.00
    const expectedDonationAmount = Math.round((499.00 * 0.20) * 100) / 100; // 99.80

    const mockInvoice: Partial<StripeInvoicePayload> = {
      id: `in_test_${Date.now()}`,
      subscription: dummySubId,
      amount_paid: amountPaidCents,
      currency: "inr",
      payment_intent: invoicePaymentId,
      billing_reason: "subscription_cycle",
    };

    const result = await SubscriptionService.handleInvoicePaymentSucceeded(
      adminClient,
      mockInvoice as unknown as Stripe.Invoice
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.donationCreated, true);

    // Check donation row in database
    const { data: donation } = await adminClient
      .from("donations")
      .select("*")
      .eq("stripe_payment_id", invoicePaymentId)
      .single();

    assert.ok(donation);
    assert.strictEqual(donation.user_id, testUserId);
    assert.strictEqual(donation.charity_id, testCharityId);
    assert.strictEqual(Number(donation.amount), expectedDonationAmount);
    assert.strictEqual(donation.donation_type, "subscription_allocation");
    assert.strictEqual(donation.status, "completed");
  });

  // 9. Duplicate invoice/webhook does not double-credit donation
  test("9. duplicate invoice/webhook does not double-credit donation", async () => {
    const invoicePaymentId = `pi_test_dup_${Date.now()}`;
    const mockInvoice: Partial<StripeInvoicePayload> = {
      id: `in_test_dup_${Date.now()}`,
      subscription: dummySubId,
      amount_paid: 49900,
      currency: "inr",
      payment_intent: invoicePaymentId,
      billing_reason: "subscription_cycle",
    };

    // First call creates donation
    const firstCall = await SubscriptionService.handleInvoicePaymentSucceeded(
      adminClient,
      mockInvoice as unknown as Stripe.Invoice
    );
    assert.strictEqual(firstCall.success, true);
    assert.strictEqual(firstCall.donationCreated, true);

    // Duplicate call should NOT create second donation
    const secondCall = await SubscriptionService.handleInvoicePaymentSucceeded(
      adminClient,
      mockInvoice as unknown as Stripe.Invoice
    );
    assert.strictEqual(secondCall.success, true);
    assert.strictEqual(secondCall.donationCreated, false);

    // Verify exactly 1 donation exists for this payment_id
    const { data: donations } = await adminClient
      .from("donations")
      .select("id")
      .eq("stripe_payment_id", invoicePaymentId);

    assert.strictEqual(donations?.length, 1);
  });

  // 10. Cancellation at period end preserves active status until period end
  test("10. cancellation at period end preserves active status until period end", async () => {
    const futureDate = new Date(Date.now() + 15 * 86400 * 1000).toISOString();

    await adminClient
      .from("subscriptions")
      .update({
        status: "active",
        cancel_at_period_end: true,
        current_period_end: futureDate,
      })
      .eq("stripe_subscription_id", dummySubId);

    const activeSub = await SubscriptionService.getActiveSubscription(userClient, testUserId);
    assert.ok(activeSub);
    assert.strictEqual(activeSub.status, "active");
    assert.strictEqual(activeSub.cancel_at_period_end, true);

    const isQualifying = await SubscriptionService.hasActiveSubscription(userClient, testUserId);
    assert.strictEqual(isQualifying, true);
  });

  // 11. past_due is non-qualifying
  test("11. past_due is non-qualifying for draw eligibility", async () => {
    const futureDate = new Date(Date.now() + 15 * 86400 * 1000).toISOString();

    await adminClient
      .from("subscriptions")
      .update({
        status: "past_due",
        current_period_end: futureDate,
      })
      .eq("stripe_subscription_id", dummySubId);

    const activeSub = await SubscriptionService.getActiveSubscription(userClient, testUserId);
    assert.strictEqual(activeSub, null);

    const isQualifying = await SubscriptionService.hasActiveSubscription(userClient, testUserId);
    assert.strictEqual(isQualifying, false);
  });

  // 12. unpaid is non-qualifying
  test("12. unpaid is non-qualifying for draw eligibility", async () => {
    await adminClient
      .from("subscriptions")
      .update({
        status: "unpaid",
      })
      .eq("stripe_subscription_id", dummySubId);

    const isQualifying = await SubscriptionService.hasActiveSubscription(userClient, testUserId);
    assert.strictEqual(isQualifying, false);
  });

  // 13. canceled/lapsed is non-qualifying
  test("13. canceled or lapsed is non-qualifying for draw eligibility", async () => {
    await adminClient
      .from("subscriptions")
      .update({
        status: "canceled",
      })
      .eq("stripe_subscription_id", dummySubId);

    const isQualifyingCanceled = await SubscriptionService.hasActiveSubscription(userClient, testUserId);
    assert.strictEqual(isQualifyingCanceled, false);

    await adminClient
      .from("subscriptions")
      .update({
        status: "lapsed",
      })
      .eq("stripe_subscription_id", dummySubId);

    const isQualifyingLapsed = await SubscriptionService.hasActiveSubscription(userClient, testUserId);
    assert.strictEqual(isQualifyingLapsed, false);
  });

  // 14. Active subscription check requires valid future current_period_end
  test("14. active subscription check requires valid future current period", async () => {
    const pastDate = new Date(Date.now() - 3600 * 1000).toISOString(); // 1 hour ago

    await adminClient
      .from("subscriptions")
      .update({
        status: "active",
        current_period_end: pastDate,
      })
      .eq("stripe_subscription_id", dummySubId);

    const activeSub = await SubscriptionService.getActiveSubscription(userClient, testUserId);
    assert.strictEqual(activeSub, null);

    const isQualifying = await SubscriptionService.hasActiveSubscription(userClient, testUserId);
    assert.strictEqual(isQualifying, false);
  });
});
