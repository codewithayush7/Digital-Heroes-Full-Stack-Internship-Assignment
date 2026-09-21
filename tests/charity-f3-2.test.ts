import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";
import { CharityService } from "../src/lib/services/charity.service";
import { DonationService } from "../src/lib/services/donation.service";
import { donationCheckoutSchema } from "../src/lib/validations/donation.schema";
import { signupSchema } from "../src/lib/validations/auth.schema";
import { formatCurrency } from "../src/lib/utils";
import { stripe } from "../src/lib/stripe";
import type Stripe from "stripe";

// Load environment variables
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

describe("Phase F3.2: Charity Completion & Independent Donations Tests", () => {
  let adminClient: SupabaseClient<Database>;
  let userClient: SupabaseClient<Database>;

  let testCharityId: string;
  let testCharitySlug: string;
  let testUserId: string;

  const testDonationPaymentIds: string[] = [];

  before(async () => {
    adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);
    userClient = createClient<Database>(supabaseUrl, supabaseAnonKey);

    // 1. Create a dedicated test charity with gallery images
    testCharitySlug = `f32-charity-${Date.now()}`;
    const { data: charity, error: charErr } = await adminClient
      .from("charities")
      .insert({
        name: "F3.2 Direct Giving Foundation",
        slug: testCharitySlug,
        tagline: "Testing direct gifts and gallery views",
        description: "Test charity for Phase F3.2 independent donation flow.",
        is_featured: false,
        gallery_images: [
          "https://example.com/gallery1.jpg",
          "https://example.com/gallery2.jpg",
        ],
        total_funds_raised: 1000.0,
      })
      .select()
      .single();

    assert.ifError(charErr);
    assert.ok(charity);
    testCharityId = charity.id;

    // 2. Create a test authenticated user
    const testEmail = `f32_donor_${Date.now()}@example.com`;
    const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
      email: testEmail,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: {
        full_name: "Donor User",
      },
    });

    assert.ifError(authErr);
    assert.ok(authData.user);
    testUserId = authData.user.id;
  });

  after(async () => {
    // Clean up test donations
    if (testDonationPaymentIds.length > 0) {
      await adminClient
        .from("donations")
        .delete()
        .in("stripe_payment_id", testDonationPaymentIds);
    }

    // Clean up test charity
    if (testCharityId) {
      await adminClient.from("charities").delete().eq("id", testCharityId);
    }

    // Clean up test user
    if (testUserId) {
      await adminClient.auth.admin.deleteUser(testUserId);
    }
  });

  // ===========================================================================
  // 1. CHARITY GALLERY RENDERING & PUBLIC PROFILE
  // ===========================================================================
  describe("1. Charity Gallery & Public Detail", () => {
    test("charity detail retrieval by slug returns gallery images array", async () => {
      const res = await CharityService.getCharityBySlug(userClient, testCharitySlug);
      assert.ifError(res.error);
      assert.ok(res.data);
      assert.ok(Array.isArray(res.data.charity.gallery_images));
      assert.strictEqual(res.data.charity.gallery_images.length, 2);
      assert.strictEqual(res.data.charity.gallery_images[0], "https://example.com/gallery1.jpg");
    });

    test("charity detail page source renders gallery and direct donation component", () => {
      const detailPath = path.join(process.cwd(), "src/app/charities/[slug]/page.tsx");
      const detailContent = fs.readFileSync(detailPath, "utf-8");

      assert.ok(detailContent.includes("DirectDonationCard"), "Detail page must include DirectDonationCard");
      assert.ok(detailContent.includes("gallery_images"), "Detail page must reference gallery_images");
      assert.ok(detailContent.includes("Impact & Community Gallery"), "Detail page must render gallery heading");
      assert.ok(detailContent.includes("Support on Signup"), "Detail page must render Support on Signup link");
      assert.ok(detailContent.includes("charityId="), "Support on Signup must link with charityId param");
    });

    test("formatCurrency(51793.6) returns ₹51,793.60 with ₹ INR formatting and no $ symbol", () => {
      const formatted = formatCurrency(51793.6);
      assert.strictEqual(formatted, "₹51,793.60");
      assert.strictEqual(formatted.includes("$"), false);
      assert.strictEqual(formatted.startsWith("₹"), true);
    });

    test("formatCurrency explicitly supports non-INR currencies when requested (e.g. USD)", () => {
      const formatted = formatCurrency(50, "USD");
      assert.strictEqual(formatted, "$50.00");
    });
  });

  // ===========================================================================
  // 2. SIGNUP CHARITY SELECTION & PRE-SELECTION
  // ===========================================================================
  describe("2. Signup Charity Selection & Validation", () => {
    test("accepts valid charityId in signup schema", () => {
      const result = signupSchema.safeParse({
        email: "test@example.com",
        password: "Password123",
        confirmPassword: "Password123",
        fullName: "Test Donor",
        charityId: testCharityId,
        charityContributionPct: 20,
      });

      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.charityId, testCharityId);
      }
    });

    test("accepts signup without charityId (optional pre-selection)", () => {
      const result = signupSchema.safeParse({
        email: "test2@example.com",
        password: "Password123",
        confirmPassword: "Password123",
        fullName: "Test Donor 2",
        charityContributionPct: 15,
      });

      assert.strictEqual(result.success, true);
    });

    test("rejects invalid non-UUID charityId in signup schema", () => {
      const result = signupSchema.safeParse({
        email: "test3@example.com",
        password: "Password123",
        confirmPassword: "Password123",
        fullName: "Test Donor 3",
        charityId: "invalid-not-a-uuid",
        charityContributionPct: 15,
      });

      assert.strictEqual(result.success, false);
    });

    test("signup page passes preSelectedCharityId to form", () => {
      const signupPagePath = path.join(process.cwd(), "src/app/signup/page.tsx");
      const content = fs.readFileSync(signupPagePath, "utf-8");
      assert.ok(content.includes("preSelectedCharityId"), "Signup page must pass preSelectedCharityId");
      assert.ok(content.includes("charityId"), "Signup page must read charityId from searchParams");
    });
  });

  // ===========================================================================
  // 3. INDEPENDENT DONATION SERVICE & CHECKOUT CREATION
  // ===========================================================================
  describe("3. Independent Donation Service & Stripe Checkout", () => {
    test("rejects donation below minimum amount (₹25)", () => {
      const result = donationCheckoutSchema.safeParse({
        charityId: testCharityId,
        amount: 25,
      });
      assert.strictEqual(result.success, false);
      assert.ok(result.error?.issues.some((i) => i.message.includes("Minimum donation amount is ₹50.00.")));
    });

    test("rejects donation below minimum amount (₹49)", () => {
      const result = donationCheckoutSchema.safeParse({
        charityId: testCharityId,
        amount: 49,
      });
      assert.strictEqual(result.success, false);
      assert.ok(result.error?.issues.some((i) => i.message.includes("Minimum donation amount is ₹50.00.")));
    });

    test("accepts donation meeting minimum amount threshold (₹50)", () => {
      const result = donationCheckoutSchema.safeParse({
        charityId: testCharityId,
        amount: 50,
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data?.amount, 50);
    });

    test("rejects donation exceeding maximum amount (₹50,000)", () => {
      const result = donationCheckoutSchema.safeParse({
        charityId: testCharityId,
        amount: 60000,
      });
      assert.strictEqual(result.success, false);
      assert.ok(result.error?.issues.some((i) => i.message.includes("Maximum single donation")));
    });

    test("nonexistent charity with amount 50 still reaches the charity validation rather than failing minimum validation", async () => {
      const fakeUuid = "00000000-0000-0000-0000-000000000000";
      const res = await DonationService.createDonationCheckoutSession(adminClient, {
        charityId: fakeUuid,
        amount: 50,
        originUrl: "http://localhost:3000",
      });
      assert.ok(res.error);
      assert.match(res.error, /could not be found/i);
    });

    test("creates Stripe Checkout Session with mode: 'payment', INR currency, disabled adaptive pricing, and custom donation metadata", async () => {
      // Mock stripe.checkout.sessions.create
      const originalCreate = stripe.checkout.sessions.create;
      let capturedParams: Stripe.Checkout.SessionCreateParams | null = null;

      (stripe.checkout.sessions as unknown as {
        create: (params: Stripe.Checkout.SessionCreateParams) => Promise<{ url: string }>;
      }).create = async (params: Stripe.Checkout.SessionCreateParams) => {
        capturedParams = params;
        return { url: "https://checkout.stripe.com/test_donation_session" };
      };

      try {
        const res = await DonationService.createDonationCheckoutSession(adminClient, {
          charityId: testCharityId,
          amount: 50,
          userId: testUserId,
          originUrl: "http://localhost:3000",
        });

        assert.ifError(res.error);
        assert.ok(res.url);
        assert.strictEqual(res.url, "https://checkout.stripe.com/test_donation_session");

        // Verify Stripe session invariants
        const params = capturedParams as Stripe.Checkout.SessionCreateParams | null;
        assert.ok(params);
        assert.strictEqual(params.mode, "payment", "Donation session must use mode: payment");
        assert.strictEqual(params.adaptive_pricing?.enabled, false, "Must disable adaptive pricing");
        assert.strictEqual(params.client_reference_id, testUserId);
        assert.strictEqual(params.metadata?.paymentType, "independent_donation");
        assert.strictEqual(params.metadata?.charityId, testCharityId);
        assert.strictEqual(params.metadata?.userId, testUserId);

        // Verify line items unit amount in paise and currency in INR
        const lineItem = params.line_items?.[0];
        assert.ok(lineItem);
        assert.strictEqual(lineItem.price_data?.currency, "inr");
        assert.strictEqual(lineItem.price_data?.unit_amount, 5000); // ₹50.00 in paise
      } finally {
        stripe.checkout.sessions.create = originalCreate;
      }
    });

    test("supports anonymous/guest donation checkout without userId", async () => {
      const originalCreate = stripe.checkout.sessions.create;
      let capturedParams: Stripe.Checkout.SessionCreateParams | null = null;

      (stripe.checkout.sessions as unknown as {
        create: (params: Stripe.Checkout.SessionCreateParams) => Promise<{ url: string }>;
      }).create = async (params: Stripe.Checkout.SessionCreateParams) => {
        capturedParams = params;
        return { url: "https://checkout.stripe.com/test_guest_donation" };
      };

      try {
        const res = await DonationService.createDonationCheckoutSession(adminClient, {
          charityId: testCharityId,
          amount: 100,
          userId: null,
          originUrl: "http://localhost:3000",
        });

        assert.ifError(res.error);
        const params = capturedParams as Stripe.Checkout.SessionCreateParams | null;
        assert.ok(params);
        assert.strictEqual(params.client_reference_id, undefined);
        assert.strictEqual(params.metadata?.userId, "");
      } finally {
        stripe.checkout.sessions.create = originalCreate;
      }
    });
  });

  // ===========================================================================
  // 4. WEBHOOK RECONCILIATION & CONCURRENCY IDEMPOTENCY
  // ===========================================================================
  describe("4. Webhook Reconciliation & Concurrency Idempotency", () => {
    test("A. Sequential replay: records valid independent donation and ignores replay", async () => {
      const paymentIntentId = `pi_seq_${Date.now()}`;
      testDonationPaymentIds.push(paymentIntentId);

      const mockSession: Stripe.Checkout.Session = {
        id: `cs_seq_${Date.now()}`,
        mode: "payment",
        payment_intent: paymentIntentId,
        amount_total: 7500, // $75.00
        currency: "usd",
        metadata: {
          paymentType: "independent_donation",
          charityId: testCharityId,
          userId: testUserId,
        },
      } as unknown as Stripe.Checkout.Session;

      // 1st delivery
      const res1 = await DonationService.recordIndependentDonation(adminClient, mockSession);
      assert.strictEqual(res1.success, true);
      assert.strictEqual(res1.donationCreated, true);

      // Verify database donation row
      const { data: donation } = await adminClient
        .from("donations")
        .select("*")
        .eq("stripe_payment_id", paymentIntentId)
        .single();

      assert.ok(donation);
      assert.strictEqual(donation.charity_id, testCharityId);
      assert.strictEqual(donation.user_id, testUserId);
      assert.strictEqual(Number(donation.amount), 75.0);
      assert.strictEqual(donation.donation_type, "independent");
      assert.strictEqual(donation.status, "completed");

      // Verify charity funds incremented (initial 1000.00 -> 1075.00)
      const { data: charityAfter1 } = await adminClient
        .from("charities")
        .select("total_funds_raised")
        .eq("id", testCharityId)
        .single();
      assert.strictEqual(Number(charityAfter1?.total_funds_raised), 1075.0);

      // 2nd delivery (sequential replay)
      const res2 = await DonationService.recordIndependentDonation(adminClient, mockSession);
      assert.strictEqual(res2.success, true);
      assert.strictEqual(res2.donationCreated, false, "Replay must report donationCreated = false");

      // Verify exactly 1 donation row in DB
      const { data: donations } = await adminClient
        .from("donations")
        .select("id")
        .eq("stripe_payment_id", paymentIntentId);
      assert.strictEqual(donations?.length, 1);

      // Verify charity funds NOT incremented again (remains 1075.00)
      const { data: charityAfter2 } = await adminClient
        .from("charities")
        .select("total_funds_raised")
        .eq("id", testCharityId)
        .single();
      assert.strictEqual(Number(charityAfter2?.total_funds_raised), 1075.0);
    });

    test("B. TRUE CONCURRENT PROCESSING: simultaneous webhooks for same payment ID do not double-credit", async () => {
      const paymentIntentId = `pi_concurrent_same_${Date.now()}`;
      testDonationPaymentIds.push(paymentIntentId);

      const mockSession: Stripe.Checkout.Session = {
        id: `cs_concurrent_${Date.now()}`,
        mode: "payment",
        payment_intent: paymentIntentId,
        amount_total: 5000, // $50.00
        currency: "usd",
        metadata: {
          paymentType: "independent_donation",
          charityId: testCharityId,
          userId: testUserId,
        },
      } as unknown as Stripe.Checkout.Session;

      // Get charity balance prior to concurrent execution
      const { data: charityBefore } = await adminClient
        .from("charities")
        .select("total_funds_raised")
        .eq("id", testCharityId)
        .single();
      const initialTotal = Number(charityBefore?.total_funds_raised || 0);

      // Fire two concurrent reconciliation requests for the EXACT SAME payment ID
      const [res1, res2] = await Promise.all([
        DonationService.recordIndependentDonation(adminClient, mockSession),
        DonationService.recordIndependentDonation(adminClient, mockSession),
      ]);

      // Both must resolve successfully
      assert.strictEqual(res1.success, true, "Concurrent call 1 must succeed");
      assert.strictEqual(res2.success, true, "Concurrent call 2 must succeed");

      // Exactly one must have created the donation, and exactly one must have identified duplicate
      const createdCount = [res1.donationCreated, res2.donationCreated].filter(Boolean).length;
      assert.strictEqual(
        createdCount,
        1,
        `Expected exactly 1 call to create donation, got ${createdCount}`
      );

      // Verify database contains EXACTLY 1 donation row for this stripe_payment_id
      const { data: donations } = await adminClient
        .from("donations")
        .select("id, amount, stripe_payment_id")
        .eq("stripe_payment_id", paymentIntentId);

      assert.strictEqual(donations?.length, 1, "Database must contain exactly 1 donation record");

      // Verify charity funds were incremented by EXACTLY $50.00 once
      const { data: charityAfter } = await adminClient
        .from("charities")
        .select("total_funds_raised")
        .eq("id", testCharityId)
        .single();

      const expectedTotal = Math.round((initialTotal + 50.0) * 100) / 100;
      assert.strictEqual(
        Number(charityAfter?.total_funds_raised),
        expectedTotal,
        `Charity total must be ${expectedTotal}, got ${charityAfter?.total_funds_raised}`
      );
    });

    test("C. Concurrent different payments: multiple distinct payments process and credit independently", async () => {
      const paymentId1 = `pi_diff_1_${Date.now()}`;
      const paymentId2 = `pi_diff_2_${Date.now()}`;
      testDonationPaymentIds.push(paymentId1, paymentId2);

      const session1: Stripe.Checkout.Session = {
        id: `cs_diff1_${Date.now()}`,
        mode: "payment",
        payment_intent: paymentId1,
        amount_total: 3000, // $30.00
        currency: "usd",
        metadata: {
          paymentType: "independent_donation",
          charityId: testCharityId,
          userId: testUserId,
        },
      } as unknown as Stripe.Checkout.Session;

      const session2: Stripe.Checkout.Session = {
        id: `cs_diff2_${Date.now()}`,
        mode: "payment",
        payment_intent: paymentId2,
        amount_total: 4500, // $45.00
        currency: "usd",
        metadata: {
          paymentType: "independent_donation",
          charityId: testCharityId,
          userId: testUserId,
        },
      } as unknown as Stripe.Checkout.Session;

      const { data: charityBefore } = await adminClient
        .from("charities")
        .select("total_funds_raised")
        .eq("id", testCharityId)
        .single();
      const initialTotal = Number(charityBefore?.total_funds_raised || 0);

      // Run both distinct payments concurrently
      const [res1, res2] = await Promise.all([
        DonationService.recordIndependentDonation(adminClient, session1),
        DonationService.recordIndependentDonation(adminClient, session2),
      ]);

      assert.strictEqual(res1.success, true);
      assert.strictEqual(res1.donationCreated, true);
      assert.strictEqual(res2.success, true);
      assert.strictEqual(res2.donationCreated, true);

      // Verify both donation rows exist
      const { data: d1 } = await adminClient
        .from("donations")
        .select("id")
        .eq("stripe_payment_id", paymentId1)
        .maybeSingle();
      const { data: d2 } = await adminClient
        .from("donations")
        .select("id")
        .eq("stripe_payment_id", paymentId2)
        .maybeSingle();

      assert.ok(d1, "Donation 1 must be recorded");
      assert.ok(d2, "Donation 2 must be recorded");

      // Verify charity funds were incremented by exactly $30 + $45 = $75
      const { data: charityAfter } = await adminClient
        .from("charities")
        .select("total_funds_raised")
        .eq("id", testCharityId)
        .single();

      const expectedTotal = Math.round((initialTotal + 75.0) * 100) / 100;
      assert.strictEqual(Number(charityAfter?.total_funds_raised), expectedTotal);
    });

    test("D. Atomic rollback: failing charity update rolls back donation insertion", async () => {
      const nonExistentCharityId = "00000000-0000-0000-0000-000000000001";
      const paymentIntentId = `pi_fail_rollback_${Date.now()}`;
      testDonationPaymentIds.push(paymentIntentId);

      const mockSession: Stripe.Checkout.Session = {
        id: `cs_fail_${Date.now()}`,
        mode: "payment",
        payment_intent: paymentIntentId,
        amount_total: 10000, // $100.00
        currency: "usd",
        metadata: {
          paymentType: "independent_donation",
          charityId: nonExistentCharityId,
        },
      } as unknown as Stripe.Checkout.Session;

      const res = await DonationService.recordIndependentDonation(adminClient, mockSession);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.donationCreated, false);

      // Verify NO donation row was committed to the database
      const { data: donation } = await adminClient
        .from("donations")
        .select("id")
        .eq("stripe_payment_id", paymentIntentId)
        .maybeSingle();

      assert.strictEqual(donation, null, "Donation insert must have rolled back completely");
    });

    test("E. Database uniqueness: partial unique index rejects duplicate non-null stripe_payment_id", async () => {
      const uniquePaymentId = `pi_unique_index_guard_${Date.now()}`;
      testDonationPaymentIds.push(uniquePaymentId);

      // Direct insert 1
      const { error: err1 } = await adminClient.from("donations").insert({
        charity_id: testCharityId,
        amount: 20.0,
        currency: "usd",
        donation_type: "independent",
        stripe_payment_id: uniquePaymentId,
        status: "completed",
      });
      assert.ifError(err1);

      // Direct insert 2 with same stripe_payment_id must fail via database unique index
      const { error: err2 } = await adminClient.from("donations").insert({
        charity_id: testCharityId,
        amount: 20.0,
        currency: "usd",
        donation_type: "independent",
        stripe_payment_id: uniquePaymentId,
        status: "completed",
      });

      assert.ok(err2, "Duplicate insert must be rejected by database");
      assert.strictEqual(
        err2.code,
        "23505",
        `Expected PostgreSQL unique_violation error code 23505, got ${err2.code}`
      );
    });

    test("F. Subscription donations compatibility: supports multiple null stripe_payment_id rows", async () => {
      // Subscription allocation donations may have null stripe_payment_id
      const { data: subDonation1, error: err1 } = await adminClient
        .from("donations")
        .insert({
          charity_id: testCharityId,
          amount: 5.0,
          currency: "usd",
          donation_type: "subscription_allocation",
          stripe_payment_id: null,
          status: "completed",
        })
        .select("id")
        .single();

      assert.ifError(err1);
      assert.ok(subDonation1);

      const { data: subDonation2, error: err2 } = await adminClient
        .from("donations")
        .insert({
          charity_id: testCharityId,
          amount: 5.0,
          currency: "usd",
          donation_type: "subscription_allocation",
          stripe_payment_id: null,
          status: "completed",
        })
        .select("id")
        .single();

      assert.ifError(err2);
      assert.ok(subDonation2);

      // Clean up the two subscription test donations
      await adminClient.from("donations").delete().in("id", [subDonation1.id, subDonation2.id]);
    });

    test("G. Security: anonymous and regular users cannot execute record_independent_donation_atomic", async () => {
      const { error: anonErr } = await userClient.rpc("record_independent_donation_atomic", {
        p_charity_id: testCharityId,
        p_amount: 100,
        p_currency: "usd",
        p_stripe_payment_id: "pi_unauthorized_test",
      });

      assert.ok(anonErr, "Anonymous/client RPC invocation must be rejected");
      // PostgREST returns 42501 (insufficient_privilege) or PGRST301/PGRST202
      assert.ok(
        anonErr.code === "42501" || anonErr.code === "PGRST202" || anonErr.message.includes("permission denied"),
        `Unexpected error code: ${anonErr.code}: ${anonErr.message}`
      );
    });

    test("webhook route ignores payment sessions with wrong paymentType", async () => {
      const otherPaymentId = `pi_test_other_${Date.now()}`;
      testDonationPaymentIds.push(otherPaymentId);

      const mockSession: Stripe.Checkout.Session = {
        id: `cs_other_${Date.now()}`,
        mode: "payment",
        payment_intent: otherPaymentId,
        amount_total: 5000,
        metadata: {
          paymentType: "some_other_type", // NOT independent_donation
          charityId: testCharityId,
        },
      } as unknown as Stripe.Checkout.Session;

      const res = await DonationService.recordIndependentDonation(adminClient, mockSession);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.donationCreated, false);

      // Verify no donation was inserted
      const { data: donation } = await adminClient
        .from("donations")
        .select("id")
        .eq("stripe_payment_id", otherPaymentId)
        .maybeSingle();

      assert.strictEqual(donation, null);
    });
  });

  // ===========================================================================
  // 5. ISOLATION & SUBSCRIPTION NON-INTERFERENCE
  // ===========================================================================
  describe("5. Isolation from Gameplay & Subscriptions", () => {
    test("independent donation does NOT insert or alter subscriptions table", async () => {
      const { data: subsBefore } = await adminClient
        .from("subscriptions")
        .select("id")
        .eq("user_id", testUserId);

      const countBefore = subsBefore?.length || 0;

      // Execute an independent donation for this user
      const paymentId = `pi_test_isolation_${Date.now()}`;
      testDonationPaymentIds.push(paymentId);

      await DonationService.recordIndependentDonation(adminClient, {
        id: `cs_isolation_${Date.now()}`,
        mode: "payment",
        payment_intent: paymentId,
        amount_total: 2500,
        currency: "usd",
        metadata: {
          paymentType: "independent_donation",
          charityId: testCharityId,
          userId: testUserId,
        },
      } as unknown as Stripe.Checkout.Session);

      const { data: subsAfter } = await adminClient
        .from("subscriptions")
        .select("id")
        .eq("user_id", testUserId);

      const countAfter = subsAfter?.length || 0;

      assert.strictEqual(countAfter, countBefore, "Subscriptions table must remain untouched");
    });

    test("client cannot insert directly into donations table under RLS", async () => {
      const { error } = await userClient.from("donations").insert({
        charity_id: testCharityId,
        amount: 50,
        donation_type: "independent",
        status: "completed",
      });

      assert.ok(error, "Anonymous/subscriber client direct insert into donations must fail");
    });
  });
});

