import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";
import { AdminService } from "../src/lib/services/admin.service";
import { ScoreService } from "../src/lib/services/score.service";
import { stripe } from "../src/lib/stripe";

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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe("Phase F2: Admin User & Subscription Management Tests", () => {
  let adminClient: SupabaseClient<Database>;
  let authedAdminClient: SupabaseClient<Database>;
  let authedSubscriberClient: SupabaseClient<Database>;

  const createdUserIds: string[] = [];
  const createdCharityIds: string[] = [];
  const createdSubscriptionIds: string[] = [];
  const createdScoreIds: string[] = [];

  let primaryAdminId: string;
  let primaryAdminEmail: string;
  let secondaryAdminId: string;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let secondaryAdminEmail: string;
  let testSubscriberId: string;
  let testSubscriberEmail: string;
  let testCharityId: string;

  const password = "TestPassword123!";

  before(async () => {
    adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);

    async function createTestUser(
      prefix: string,
      name: string,
      role: "admin" | "subscriber" = "subscriber"
    ): Promise<{ uid: string; email: string }> {
      const email = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@user-test.com`;
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name },
      });
      assert.ifError(error);
      const uid = data.user.id;
      createdUserIds.push(uid);

      if (role === "admin") {
        await adminClient.from("profiles").update({ role: "admin" }).eq("id", uid);
      }

      return { uid, email };
    }

    // 1. Create Primary Admin
    const admin1 = await createTestUser("f2_admin1", "Primary Admin", "admin");
    primaryAdminId = admin1.uid;
    primaryAdminEmail = admin1.email;

    // 2. Create Secondary Admin
    const admin2 = await createTestUser("f2_admin2", "Secondary Admin", "admin");
    secondaryAdminId = admin2.uid;
    secondaryAdminEmail = admin2.email;

    // 3. Create Subscriber User
    const subUser = await createTestUser("f2_golfer", "Jack Nicklaus", "subscriber");
    testSubscriberId = subUser.uid;
    testSubscriberEmail = subUser.email;

    // 4. Authenticate Supabase clients
    authedAdminClient = createClient<Database>(supabaseUrl, anonKey);
    const { error: adminLoginErr } = await authedAdminClient.auth.signInWithPassword({
      email: primaryAdminEmail,
      password,
    });
    assert.ifError(adminLoginErr);

    authedSubscriberClient = createClient<Database>(supabaseUrl, anonKey);
    const { error: subLoginErr } = await authedSubscriberClient.auth.signInWithPassword({
      email: testSubscriberEmail,
      password,
    });
    assert.ifError(subLoginErr);

    // 5. Create test charity
    const { data: charity, error: cErr } = await adminClient
      .from("charities")
      .insert({
        name: "F2 User Test Charity",
        slug: `f2-user-test-${Date.now()}`,
        description: "Charity for admin user testing",
      })
      .select()
      .single();

    assert.ifError(cErr);
    assert.ok(charity);
    testCharityId = charity.id;
    createdCharityIds.push(testCharityId);
  });

  after(async () => {
    // 1. Cleanup golf scores
    if (createdScoreIds.length > 0) {
      await adminClient.from("golf_scores").delete().in("id", createdScoreIds);
    }
    if (createdUserIds.length > 0) {
      await adminClient.from("golf_scores").delete().in("user_id", createdUserIds);
    }

    // 2. Cleanup subscriptions
    if (createdSubscriptionIds.length > 0) {
      await adminClient.from("subscriptions").delete().in("id", createdSubscriptionIds);
    }
    if (createdUserIds.length > 0) {
      await adminClient.from("subscriptions").delete().in("user_id", createdUserIds);
    }

    // 3. Cleanup test users
    for (const uid of createdUserIds) {
      await adminClient.auth.admin.deleteUser(uid);
    }

    // 4. Cleanup charities
    if (createdCharityIds.length > 0) {
      await adminClient.from("charities").delete().in("id", createdCharityIds);
    }
  });

  // ============================================================================
  // 1. USER LISTING & SUBSCRIPTION RESOLUTION
  // ============================================================================
  describe("1. User Directory & Current Subscription Resolution", () => {
    test("lists registered users including created test users", async () => {
      const res = await AdminService.getUsersList(adminClient);
      assert.ifError(res.error);
      assert.ok(res.data);
      assert.ok(res.data.total >= 3);

      const foundSub = res.data.users.find((u) => u.id === testSubscriberId);
      assert.ok(foundSub);
      assert.strictEqual(foundSub.email, testSubscriberEmail);
      assert.strictEqual(foundSub.role, "subscriber");
    });

    test("resolves current subscription correctly when user has multiple subscriptions (1:N)", async () => {
      // User has an expired subscription and a newer active subscription
      const pastDate = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
      const futureDate = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

      // Older expired subscription
      const { data: sub1 } = await adminClient
        .from("subscriptions")
        .insert({
          user_id: testSubscriberId,
          stripe_subscription_id: `sub_old_${Date.now()}`,
          plan_type: "monthly",
          amount: 499,
          currency: "inr",
          status: "canceled",
          current_period_start: new Date(Date.now() - 60 * 86400 * 1000).toISOString(),
          current_period_end: pastDate,
          cancel_at_period_end: true,
        })
        .select()
        .single();
      if (sub1) createdSubscriptionIds.push(sub1.id);

      // Newer active subscription
      const { data: sub2 } = await adminClient
        .from("subscriptions")
        .insert({
          user_id: testSubscriberId,
          stripe_subscription_id: `sub_act_${Date.now()}`,
          plan_type: "yearly",
          amount: 4999,
          currency: "inr",
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: futureDate,
          cancel_at_period_end: false,
        })
        .select()
        .single();
      if (sub2) createdSubscriptionIds.push(sub2.id);

      const res = await AdminService.getUsersList(adminClient, { search: testSubscriberEmail });
      assert.ifError(res.error);
      assert.ok(res.data);
      assert.strictEqual(res.data.users.length, 1);

      const user = res.data.users[0];
      assert.ok(user.current_subscription);
      // The ACTIVE subscription must be resolved as current
      assert.strictEqual(user.current_subscription.id, sub2?.id);
      assert.strictEqual(user.current_subscription.status, "active");
      assert.strictEqual(user.current_subscription.plan_type, "yearly");
      assert.strictEqual(user.current_subscription.cancel_at_period_end, false);
    });

    test("filters users by role and subscription status", async () => {
      // Filter by role: admin
      const adminRes = await AdminService.getUsersList(adminClient, { role: "admin" });
      assert.ifError(adminRes.error);
      assert.ok(adminRes.data);
      assert.ok(adminRes.data.users.every((u) => u.role === "admin"));
      assert.ok(adminRes.data.users.some((u) => u.id === primaryAdminId));

      // Filter by subscription status: active
      const activeRes = await AdminService.getUsersList(adminClient, {
        subscriptionStatus: "active",
      });
      assert.ifError(activeRes.error);
      assert.ok(activeRes.data);
      assert.ok(
        activeRes.data.users.every(
          (u) =>
            u.current_subscription &&
            u.current_subscription.status === "active" &&
            new Date(u.current_subscription.current_period_end!) > new Date()
        )
      );
    });
  });

  // ============================================================================
  // 2. USER DETAIL INSPECTION
  // ============================================================================
  describe("2. Single User Detail Inspection", () => {
    test("retrieves user detail with profile, designated charity, and complete subscription history", async () => {
      const res = await AdminService.getUserDetail(adminClient, testSubscriberId);
      assert.ifError(res.error);
      assert.ok(res.data);

      assert.strictEqual(res.data.profile.id, testSubscriberId);
      assert.strictEqual(res.data.profile.email, testSubscriberEmail);
      // Subscriptions list must contain both inserted subscriptions
      assert.strictEqual(res.data.subscriptions.length, 2);
      assert.ok(res.data.current_subscription);
      assert.strictEqual(res.data.current_subscription.status, "active");
    });
  });

  // ============================================================================
  // 3. SAFE PROFILE EDITING
  // ============================================================================
  describe("3. Safe User Profile Editing", () => {
    test("successfully updates full_name, charity_id, and charity_contribution_pct", async () => {
      const res = await AdminService.updateUserProfile(adminClient, {
        userId: testSubscriberId,
        fullName: "Jack W. Nicklaus (Golden Bear)",
        charityId: testCharityId,
        charityContributionPct: 25,
      });

      assert.ifError(res.error);
      assert.ok(res.data);
      assert.strictEqual(res.data.full_name, "Jack W. Nicklaus (Golden Bear)");
      assert.strictEqual(res.data.charity_id, testCharityId);
      assert.strictEqual(Number(res.data.charity_contribution_pct), 25);
      // Email is unchanged
      assert.strictEqual(res.data.email, testSubscriberEmail);
    });

    test("rejects invalid charity contribution percentage (< 10% or > 100%)", async () => {
      const resLow = await AdminService.updateUserProfile(adminClient, {
        userId: testSubscriberId,
        fullName: "Test",
        charityId: testCharityId,
        charityContributionPct: 5,
      });
      assert.ok(resLow.error);
      assert.match(resLow.error, /at least 10%/i);

      const resHigh = await AdminService.updateUserProfile(adminClient, {
        userId: testSubscriberId,
        fullName: "Test",
        charityId: testCharityId,
        charityContributionPct: 105,
      });
      assert.ok(resHigh.error);
      assert.match(resHigh.error, /cannot exceed 100%/i);
    });

    test("rejects non-existent charity ID", async () => {
      const res = await AdminService.updateUserProfile(adminClient, {
        userId: testSubscriberId,
        fullName: "Test",
        charityId: "00000000-0000-0000-0000-000000000000",
        charityContributionPct: 20,
      });
      assert.ok(res.error);
      assert.match(res.error, /selected charity does not exist/i);
    });
  });

  // ============================================================================
  // 4. ROLE MANAGEMENT & ATOMIC LAST-ADMIN PROTECTION
  // ============================================================================
  describe("4. Role Management & Last-Admin Demotion Safeguards", () => {
    test("rejects role mutation if caller is non-admin", async () => {
      const res = await AdminService.updateUserRole(
        authedSubscriberClient,
        testSubscriberId,
        {
          targetUserId: testSubscriberId,
          role: "admin",
        }
      );
      assert.ok(res.error);
      assert.match(res.error, /UNAUTHORIZED/i);
    });

    test("rejects self-demotion (CANNOT_DEMOTE_SELF)", async () => {
      const res = await AdminService.updateUserRole(
        authedAdminClient,
        primaryAdminId,
        {
          targetUserId: primaryAdminId,
          role: "subscriber",
        }
      );
      assert.ok(res.error);
      assert.match(res.error, /CANNOT_DEMOTE_SELF/i);
    });

    test("successfully promotes a subscriber to admin", async () => {
      const res = await AdminService.updateUserRole(
        authedAdminClient,
        primaryAdminId,
        {
          targetUserId: testSubscriberId,
          role: "admin",
        }
      );
      assert.ifError(res.error);
      assert.ok(res.data);
      assert.strictEqual(res.data.role, "admin");

      // Verify in DB
      const { data: profile } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", testSubscriberId)
        .single();
      assert.strictEqual(profile?.role, "admin");
    });

    test("successfully demotes an admin when multiple admins exist", async () => {
      // testSubscriberId was promoted, so we have at least 3 admins now
      const res = await AdminService.updateUserRole(
        authedAdminClient,
        primaryAdminId,
        {
          targetUserId: testSubscriberId,
          role: "subscriber",
        }
      );
      assert.ifError(res.error);
      assert.ok(res.data);
      assert.strictEqual(res.data.role, "subscriber");

      // Verify in DB
      const { data: profile } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", testSubscriberId)
        .single();
      assert.strictEqual(profile?.role, "subscriber");
    });

    test("protects the last remaining administrator from demotion (LAST_ADMIN_PROTECTED)", async () => {
      // Demote secondaryAdminId so that only primaryAdminId (or total admins = 1) remains
      await AdminService.updateUserRole(authedAdminClient, primaryAdminId, {
        targetUserId: secondaryAdminId,
        role: "subscriber",
      });

      // Now query current admin count
      const { count: currentAdminCount } = await adminClient
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");

      assert.ok(currentAdminCount !== null);

      if (currentAdminCount === 1) {
        // Attempting to demote the single remaining admin MUST be rejected with LAST_ADMIN_PROTECTED
        const res = await AdminService.updateUserRole(
          authedAdminClient,
          primaryAdminId,
          {
            targetUserId: primaryAdminId,
            role: "subscriber",
          }
        );
        assert.ok(res.error);
        assert.match(res.error, /CANNOT_DEMOTE_SELF|LAST_ADMIN_PROTECTED/i);
      }

      // Restore secondaryAdminId to admin role for clean state
      await AdminService.updateUserRole(authedAdminClient, primaryAdminId, {
        targetUserId: secondaryAdminId,
        role: "admin",
      });
    });
  });

  // ============================================================================
  // 5. AUTHORITATIVE STRIPE SUBSCRIPTION CANCELLATION
  // ============================================================================
  describe("5. Authoritative Stripe Subscription Cancellation", () => {
    test("cancellation calls Stripe first, never directly overwrites status to canceled", async () => {
      // Create a test subscription with dummy stripe ID
      const { data: sub } = await adminClient
        .from("subscriptions")
        .insert({
          user_id: testSubscriberId,
          stripe_subscription_id: `sub_test_cancel_${Date.now()}`,
          plan_type: "monthly",
          amount: 499,
          currency: "inr",
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
          cancel_at_period_end: false,
        })
        .select()
        .single();

      assert.ok(sub);
      createdSubscriptionIds.push(sub.id);

      // Mock stripe.subscriptions.update to simulate successful Stripe cancellation
      const originalUpdate = stripe.subscriptions.update;
      let stripeCalledWith: { id: string; params: { cancel_at_period_end?: boolean } } | null = null;
      (stripe.subscriptions as unknown as { update: (id: string, params: { cancel_at_period_end?: boolean }) => Promise<unknown> }).update = async (id: string, params: { cancel_at_period_end?: boolean }) => {
        stripeCalledWith = { id, params };
        return { id, cancel_at_period_end: true };
      };

      try {
        const res = await AdminService.cancelSubscription(adminClient, sub.id);
        assert.ifError(res.error);
        assert.ok(res.data);
        assert.strictEqual(res.data.cancel_at_period_end, true);

        // Verify Stripe was called FIRST with cancel_at_period_end: true
        const captured = stripeCalledWith as { id: string; params: { cancel_at_period_end?: boolean } } | null;
        assert.ok(captured);
        assert.strictEqual(captured.id, sub.stripe_subscription_id);
        assert.strictEqual(captured.params.cancel_at_period_end, true);

        // Verify database: cancel_at_period_end is true, BUT status is STILL 'active'
        const { data: updatedSub } = await adminClient
          .from("subscriptions")
          .select("*")
          .eq("id", sub.id)
          .single();

        assert.ok(updatedSub);
        assert.strictEqual(updatedSub.cancel_at_period_end, true);
        assert.strictEqual(updatedSub.status, "active", "Status must remain active until webhook");
      } finally {
        stripe.subscriptions.update = originalUpdate;
      }
    });

    test("if Stripe fails, local database is NOT updated", async () => {
      const { data: sub } = await adminClient
        .from("subscriptions")
        .insert({
          user_id: testSubscriberId,
          stripe_subscription_id: `sub_test_fail_${Date.now()}`,
          plan_type: "monthly",
          amount: 499,
          currency: "inr",
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
          cancel_at_period_end: false,
        })
        .select()
        .single();

      assert.ok(sub);
      createdSubscriptionIds.push(sub.id);

      // Mock stripe.subscriptions.update to throw
      const originalUpdate = stripe.subscriptions.update;
      (stripe.subscriptions as unknown as { update: () => Promise<never> }).update = async () => {
        throw new Error("Stripe network timeout or invalid subscription");
      };

      try {
        const res = await AdminService.cancelSubscription(adminClient, sub.id);
        assert.ok(res.error);
        assert.match(res.error, /Stripe cancellation failed/i);

        // Verify DB was untouched
        const { data: untouchedSub } = await adminClient
          .from("subscriptions")
          .select("cancel_at_period_end")
          .eq("id", sub.id)
          .single();
        assert.strictEqual(untouchedSub?.cancel_at_period_end, false);
      } finally {
        stripe.subscriptions.update = originalUpdate;
      }
    });
  });

  // ============================================================================
  // 6. SAFE ADMIN GOLF SCORE ADMINISTRATION
  // ============================================================================
  describe("6. Safe Golf Score Administration (ScoreService Delegation)", () => {
    test("admin can add a valid golf score for user (1-45 range)", async () => {
      const res = await AdminService.addAdminScore(adminClient, testSubscriberId, {
        score: 38,
        playedDate: "2026-07-01",
      });

      assert.ifError(res.error);
      assert.ok(res.data);
      assert.strictEqual(res.data.score, 38);
      assert.strictEqual(res.data.played_date, "2026-07-01");
      createdScoreIds.push(res.data.id);
    });

    test("rejects invalid score values (< 1 or > 45)", async () => {
      const resLow = await AdminService.addAdminScore(adminClient, testSubscriberId, {
        score: 0,
        playedDate: "2026-07-02",
      });
      assert.ok(resLow.error);
      assert.match(resLow.error, /at least 1/i);

      const resHigh = await AdminService.addAdminScore(adminClient, testSubscriberId, {
        score: 46,
        playedDate: "2026-07-03",
      });
      assert.ok(resHigh.error);
      assert.match(resHigh.error, /cannot exceed 45/i);
    });

    test("rejects duplicate score entry on the same date for the user", async () => {
      const resDup = await AdminService.addAdminScore(adminClient, testSubscriberId, {
        score: 35,
        playedDate: "2026-07-01", // already logged above
      });
      assert.ok(resDup.error);
      assert.match(resDup.error, /only one score entry is permitted per date/i);
    });

    test("enforces rolling 5-score retention rule identically for admin operations", async () => {
      // Clear existing scores for testSubscriberId
      await adminClient.from("golf_scores").delete().eq("user_id", testSubscriberId);

      // Add 6 scores in sequential dates
      for (let i = 1; i <= 6; i++) {
        const res = await AdminService.addAdminScore(adminClient, testSubscriberId, {
          score: 30 + i,
          playedDate: `2026-07-1${i}`,
        });
        assert.ifError(res.error);
        assert.ok(res.data);
      }

      // Fetch user scores: exactly 5 retained
      const { data: retainedScores } = await ScoreService.getUserScores(
        adminClient,
        testSubscriberId
      );
      assert.ok(retainedScores);
      assert.strictEqual(retainedScores.length, 5);

      // Verify the oldest date (2026-07-11) was pruned, while 2026-07-16 to 2026-07-12 remain
      const dates = retainedScores.map((s) => s.played_date);
      assert.ok(!dates.includes("2026-07-11"));
      assert.ok(dates.includes("2026-07-16"));
    });

    test("admin can update an existing score", async () => {
      const scoresRes = await ScoreService.getUserScores(adminClient, testSubscriberId);
      assert.ok(scoresRes.data && scoresRes.data.length > 0);
      const targetScore = scoresRes.data[0];

      const res = await AdminService.updateAdminScore(adminClient, testSubscriberId, {
        scoreId: targetScore.id,
        score: 42,
      });

      assert.ifError(res.error);
      assert.ok(res.data);
      assert.strictEqual(res.data.score, 42);
    });

    test("admin can delete a score", async () => {
      const scoresRes = await ScoreService.getUserScores(adminClient, testSubscriberId);
      assert.ok(scoresRes.data && scoresRes.data.length > 0);
      const targetScore = scoresRes.data[0];

      const res = await AdminService.deleteAdminScore(
        adminClient,
        testSubscriberId,
        targetScore.id
      );
      assert.ifError(res.error);
      assert.strictEqual(res.data, true);

      // Verify score count decreased by 1
      const afterRes = await ScoreService.getUserScores(adminClient, testSubscriberId);
      assert.strictEqual((afterRes.data ?? []).length, (scoresRes.data.length - 1));
    });
  });
});
