import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";
import { ScoreService } from "../src/lib/services/score.service";
import { AdminService } from "../src/lib/services/admin.service";
import { verifyUserScoreAuthorization } from "../src/lib/auth";
import {
  addScoreAction,
  updateScoreAction,
  deleteScoreAction,
} from "../src/app/actions/score";

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

describe("Golf Score Access Authorization & Subscription Gating Regression Suite", () => {
  let adminClient: SupabaseClient<Database>;
  const createdUserIds: string[] = [];
  const createdSubIds: string[] = [];
  const createdScoreIds: string[] = [];

  const password = "TestPassword123!";

  // Helper to create a test user
  async function createTestUser(
    prefix: string,
    emailConfirm = true
  ): Promise<{ id: string; email: string; email_confirmed_at?: string | null }> {
    const email = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@score-auth-test.com`;
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: emailConfirm,
      user_metadata: { full_name: "Test Score Golfer" },
    });
    assert.ifError(error);
    const user = data.user;
    createdUserIds.push(user.id);
    return {
      id: user.id,
      email: user.email!,
      email_confirmed_at: user.email_confirmed_at,
    };
  }

  // Helper to attach or update subscription
  async function setUserSubscription(
    userId: string,
    status: Database["public"]["Tables"]["subscriptions"]["Row"]["status"],
    currentPeriodEnd: string
  ): Promise<string> {
    const subId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const { data, error } = await adminClient
      .from("subscriptions")
      .insert({
        user_id: userId,
        status,
        plan_type: "monthly",
        current_period_start: new Date(Date.now() - 86400000).toISOString(),
        current_period_end: currentPeriodEnd,
        stripe_subscription_id: subId,
        amount: 20,
        currency: "usd",
        cancel_at_period_end: false,
      })
      .select()
      .single();

    assert.ifError(error);
    createdSubIds.push(data.id);
    return data.id;
  }

  before(async () => {
    adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);
  });

  after(async () => {
    // Cleanup scores, subscriptions, and users
    if (createdScoreIds.length > 0) {
      await adminClient.from("golf_scores").delete().in("id", createdScoreIds);
    }
    if (createdSubIds.length > 0) {
      await adminClient.from("subscriptions").delete().in("id", createdSubIds);
    }
    for (const uid of createdUserIds) {
      await adminClient.from("golf_scores").delete().eq("user_id", uid);
      await adminClient.from("subscriptions").delete().eq("user_id", uid);
      await adminClient.auth.admin.deleteUser(uid);
    }
  });

  // --------------------------------------------------------------------------
  // 1. Unauthenticated user cannot create a score
  // --------------------------------------------------------------------------
  test("1. Unauthenticated user cannot create a score via server action", async () => {
    const formData = new FormData();
    formData.append("score", "36");
    formData.append("playedDate", "2026-03-01");

    const result = await addScoreAction(null, formData);
    assert.ok(result.error, "Expected error for unauthenticated caller");
    assert.match(result.error, /You must be signed in to enter scores/i);
    assert.strictEqual(result.success, undefined);
  });

  test("1b. Unauthenticated caller fails authorization boundary", async () => {
    const auth = await verifyUserScoreAuthorization(
      adminClient,
      null,
      "enter"
    );
    assert.strictEqual(auth.allowed, false);
    assert.match(auth.error!, /You must be signed in to enter scores/i);
  });

  // --------------------------------------------------------------------------
  // 2. Authenticated but unverified user follows existing email-verification protection
  // --------------------------------------------------------------------------
  test("2. Authenticated but unverified user cannot manage scores", async () => {
    const unverifiedUser = await createTestUser("unverified_user", false);
    // Give user an active subscription
    await setUserSubscription(
      unverifiedUser.id,
      "active",
      new Date(Date.now() + 86400000 * 30).toISOString()
    );

    const auth = await verifyUserScoreAuthorization(
      adminClient,
      { id: unverifiedUser.id, email_confirmed_at: null },
      "enter"
    );
    assert.strictEqual(auth.allowed, false);
    assert.strictEqual(
      auth.error,
      "Please verify your email address before managing golf scores."
    );
  });

  // --------------------------------------------------------------------------
  // 3. Authenticated user with NO subscription cannot create a score
  // --------------------------------------------------------------------------
  test("3. Authenticated user with NO subscription cannot create a score", async () => {
    const noSubUser = await createTestUser("nosub_user", true);

    const auth = await verifyUserScoreAuthorization(
      adminClient,
      { id: noSubUser.id, email_confirmed_at: new Date().toISOString() },
      "enter"
    );
    assert.strictEqual(auth.allowed, false);
    assert.strictEqual(
      auth.error,
      "An active subscription is required to manage golf scores."
    );
  });

  // --------------------------------------------------------------------------
  // 4. Authenticated user with active subscription CAN create a score
  // --------------------------------------------------------------------------
  test("4. Authenticated user with active subscription CAN create a score", async () => {
    const activeUser = await createTestUser("active_sub_user", true);
    await setUserSubscription(
      activeUser.id,
      "active",
      new Date(Date.now() + 86400000 * 30).toISOString()
    );

    const auth = await verifyUserScoreAuthorization(
      adminClient,
      { id: activeUser.id, email_confirmed_at: new Date().toISOString() },
      "enter"
    );
    assert.strictEqual(auth.allowed, true);
    assert.strictEqual(auth.error, undefined);

    // Creating score succeeds
    const addRes = await ScoreService.addScore(adminClient, activeUser.id, {
      score: 38,
      playedDate: "2026-03-10",
    });
    assert.ifError(addRes.error);
    assert.ok(addRes.data);
    assert.strictEqual(addRes.data.score, 38);
    createdScoreIds.push(addRes.data.id);
  });

  // --------------------------------------------------------------------------
  // 5. Authenticated user with trialing + future current_period_end CAN create a score
  // --------------------------------------------------------------------------
  test("5. Authenticated user with trialing + future current_period_end CAN create a score", async () => {
    const trialingUser = await createTestUser("trialing_sub_user", true);
    await setUserSubscription(
      trialingUser.id,
      "trialing",
      new Date(Date.now() + 86400000 * 14).toISOString()
    );

    const auth = await verifyUserScoreAuthorization(
      adminClient,
      { id: trialingUser.id, email_confirmed_at: new Date().toISOString() },
      "enter"
    );
    assert.strictEqual(auth.allowed, true);
    assert.strictEqual(auth.error, undefined);

    const addRes = await ScoreService.addScore(adminClient, trialingUser.id, {
      score: 40,
      playedDate: "2026-03-11",
    });
    assert.ifError(addRes.error);
    assert.ok(addRes.data);
    assert.strictEqual(addRes.data.score, 40);
    createdScoreIds.push(addRes.data.id);
  });

  // --------------------------------------------------------------------------
  // 6. Authenticated user with expired current_period_end cannot create a score
  // --------------------------------------------------------------------------
  test("6. Authenticated user with expired current_period_end cannot create a score", async () => {
    const expiredUser = await createTestUser("expired_sub_user", true);
    // Period ended in the past
    await setUserSubscription(
      expiredUser.id,
      "active",
      new Date(Date.now() - 86400000).toISOString()
    );

    const auth = await verifyUserScoreAuthorization(
      adminClient,
      { id: expiredUser.id, email_confirmed_at: new Date().toISOString() },
      "enter"
    );
    assert.strictEqual(auth.allowed, false);
    assert.strictEqual(
      auth.error,
      "An active subscription is required to manage golf scores."
    );
  });

  // --------------------------------------------------------------------------
  // 7. past_due cannot create a score
  // --------------------------------------------------------------------------
  test("7. past_due subscription cannot create a score", async () => {
    const pastDueUser = await createTestUser("past_due_user", true);
    await setUserSubscription(
      pastDueUser.id,
      "past_due",
      new Date(Date.now() + 86400000 * 10).toISOString()
    );

    const auth = await verifyUserScoreAuthorization(
      adminClient,
      { id: pastDueUser.id, email_confirmed_at: new Date().toISOString() },
      "enter"
    );
    assert.strictEqual(auth.allowed, false);
    assert.strictEqual(
      auth.error,
      "An active subscription is required to manage golf scores."
    );
  });

  // --------------------------------------------------------------------------
  // 8. unpaid cannot create a score
  // --------------------------------------------------------------------------
  test("8. unpaid subscription cannot create a score", async () => {
    const unpaidUser = await createTestUser("unpaid_user", true);
    await setUserSubscription(
      unpaidUser.id,
      "unpaid",
      new Date(Date.now() + 86400000 * 10).toISOString()
    );

    const auth = await verifyUserScoreAuthorization(
      adminClient,
      { id: unpaidUser.id, email_confirmed_at: new Date().toISOString() },
      "enter"
    );
    assert.strictEqual(auth.allowed, false);
    assert.strictEqual(
      auth.error,
      "An active subscription is required to manage golf scores."
    );
  });

  // --------------------------------------------------------------------------
  // 9. canceled / lapsed cannot create a score
  // --------------------------------------------------------------------------
  test("9. canceled / lapsed subscription cannot create a score", async () => {
    const canceledUser = await createTestUser("canceled_user", true);
    await setUserSubscription(
      canceledUser.id,
      "canceled",
      new Date(Date.now() + 86400000 * 10).toISOString()
    );

    const authCanceled = await verifyUserScoreAuthorization(
      adminClient,
      { id: canceledUser.id, email_confirmed_at: new Date().toISOString() },
      "enter"
    );
    assert.strictEqual(authCanceled.allowed, false);
    assert.strictEqual(
      authCanceled.error,
      "An active subscription is required to manage golf scores."
    );

    const lapsedUser = await createTestUser("lapsed_user", true);
    await setUserSubscription(
      lapsedUser.id,
      "lapsed",
      new Date(Date.now() + 86400000 * 10).toISOString()
    );

    const authLapsed = await verifyUserScoreAuthorization(
      adminClient,
      { id: lapsedUser.id, email_confirmed_at: new Date().toISOString() },
      "enter"
    );
    assert.strictEqual(authLapsed.allowed, false);
    assert.strictEqual(
      authLapsed.error,
      "An active subscription is required to manage golf scores."
    );
  });

  // --------------------------------------------------------------------------
  // 10. Non-subscriber cannot edit an existing score
  // --------------------------------------------------------------------------
  test("10. Non-subscriber cannot edit an existing score", async () => {
    const nonSubUser = await createTestUser("nonsub_edit_user", true);

    const auth = await verifyUserScoreAuthorization(
      adminClient,
      { id: nonSubUser.id, email_confirmed_at: new Date().toISOString() },
      "edit"
    );
    assert.strictEqual(auth.allowed, false);
    assert.strictEqual(
      auth.error,
      "An active subscription is required to manage golf scores."
    );
  });

  // --------------------------------------------------------------------------
  // 11. Non-subscriber cannot delete an existing score
  // --------------------------------------------------------------------------
  test("11. Non-subscriber cannot delete an existing score", async () => {
    const nonSubUser = await createTestUser("nonsub_delete_user", true);

    const auth = await verifyUserScoreAuthorization(
      adminClient,
      { id: nonSubUser.id, email_confirmed_at: new Date().toISOString() },
      "delete"
    );
    assert.strictEqual(auth.allowed, false);
    assert.strictEqual(
      auth.error,
      "An active subscription is required to manage golf scores."
    );
  });

  // --------------------------------------------------------------------------
  // 12. Active subscriber can edit/delete according to existing score rules
  // --------------------------------------------------------------------------
  test("12. Active subscriber can edit and delete according to existing score rules", async () => {
    const activeUser = await createTestUser("active_edit_del_user", true);
    await setUserSubscription(
      activeUser.id,
      "active",
      new Date(Date.now() + 86400000 * 30).toISOString()
    );

    const editAuth = await verifyUserScoreAuthorization(
      adminClient,
      { id: activeUser.id, email_confirmed_at: new Date().toISOString() },
      "edit"
    );
    assert.strictEqual(editAuth.allowed, true);

    const delAuth = await verifyUserScoreAuthorization(
      adminClient,
      { id: activeUser.id, email_confirmed_at: new Date().toISOString() },
      "delete"
    );
    assert.strictEqual(delAuth.allowed, true);

    // Insert score
    const insertRes = await ScoreService.addScore(adminClient, activeUser.id, {
      score: 35,
      playedDate: "2026-03-05",
    });
    assert.ifError(insertRes.error);
    const scoreId = insertRes.data!.id;
    createdScoreIds.push(scoreId);

    // Edit score
    const updateRes = await ScoreService.updateScore(adminClient, activeUser.id, {
      scoreId,
      score: 39,
    });
    assert.ifError(updateRes.error);
    assert.strictEqual(updateRes.data!.score, 39);

    // Delete score
    const deleteRes = await ScoreService.deleteScore(
      adminClient,
      activeUser.id,
      scoreId
    );
    assert.ifError(deleteRes.error);
    assert.strictEqual(deleteRes.data, true);
  });

  // --------------------------------------------------------------------------
  // 13. Admin score management still works
  // --------------------------------------------------------------------------
  test("13. Admin score management still works regardless of target user subscription status", async () => {
    const unsubscribedUser = await createTestUser("unsub_target_user", true);

    // 1. Admin adds score for unsubscribed user
    const adminAddRes = await AdminService.addAdminScore(
      adminClient,
      unsubscribedUser.id,
      {
        score: 41,
        playedDate: "2026-03-15",
      }
    );
    assert.ifError(adminAddRes.error);
    assert.ok(adminAddRes.data);
    assert.strictEqual(adminAddRes.data.score, 41);
    const scoreId = adminAddRes.data.id;
    createdScoreIds.push(scoreId);

    // 2. Admin updates score for unsubscribed user
    const adminUpdateRes = await AdminService.updateAdminScore(
      adminClient,
      unsubscribedUser.id,
      {
        scoreId,
        score: 43,
      }
    );
    assert.ifError(adminUpdateRes.error);
    assert.strictEqual(adminUpdateRes.data!.score, 43);

    // 3. Admin deletes score for unsubscribed user
    const adminDelRes = await AdminService.deleteAdminScore(
      adminClient,
      unsubscribedUser.id,
      scoreId
    );
    assert.ifError(adminDelRes.error);
    assert.strictEqual(adminDelRes.data, true);
  });

  // --------------------------------------------------------------------------
  // 14. Client cannot bypass restriction by supplying fake subscription/user value
  // --------------------------------------------------------------------------
  test("14. Client cannot bypass restriction by supplying fake subscription or userId values", async () => {
    // Attempting to send fake subscription or fake userId to addScoreAction
    const formData = new FormData();
    formData.append("score", "36");
    formData.append("playedDate", "2026-03-20");
    formData.append("userId", "00000000-0000-0000-0000-000000000000");
    formData.append("isSubscribed", "true");
    formData.append("subscriptionStatus", "active");
    formData.append("role", "subscriber");

    const result = await addScoreAction(null, formData);
    // Server-side authorization does NOT trust form values and rejects the unauthenticated / unsubscribed caller
    assert.ok(result.error);
    assert.strictEqual(result.success, undefined);
    assert.match(result.error, /You must be signed in to enter scores/i);

    // Testing updateScoreAction with fake values
    const updateFormData = new FormData();
    updateFormData.append("scoreId", "fake-score-id");
    updateFormData.append("score", "40");
    updateFormData.append("isSubscribed", "true");

    const updateResult = await updateScoreAction(null, updateFormData);
    assert.ok(updateResult.error);
    assert.match(updateResult.error, /You must be signed in to edit scores/i);

    // Testing deleteScoreAction directly
    const deleteResult = await deleteScoreAction("fake-score-id");
    assert.ok(deleteResult.error);
    assert.match(deleteResult.error, /You must be signed in to delete scores/i);
  });
});
