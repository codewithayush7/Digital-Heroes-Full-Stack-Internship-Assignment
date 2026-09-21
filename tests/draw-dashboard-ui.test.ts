import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";
import { DrawService } from "../src/lib/services/draw.service";
import { SubscriptionService } from "../src/lib/services/subscription.service";
import { ScoreService } from "../src/lib/services/score.service";

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

describe("Phase D2: User Dashboard Draw Experience Integration Tests", () => {
  let adminClient: SupabaseClient<Database>;
  let authedUserClient1: SupabaseClient<Database>;
  let authedUserClient2: SupabaseClient<Database>;

  const createdUserIds: string[] = [];
  const createdDrawIds: string[] = [];

  let user1Id: string;
  let user1Email: string;
  let user2Id: string;
  let user2Email: string;
  let user3Id: string;

  const password = "TestPassword123!";

  before(async () => {
    adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    async function createTestUser(emailPrefix: string, name: string) {
      const email = `${emailPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`;
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name },
      });
      assert.ifError(error);
      const uid = data.user.id;
      createdUserIds.push(uid);

      await adminClient.from("subscriptions").insert({
        user_id: uid,
        plan_type: "monthly",
        status: "active",
        amount: 50.0,
        currency: "usd",
        current_period_end: futureDate,
      });

      return { uid, email };
    }

    const u1 = await createTestUser("d2_user1", "Participant One");
    user1Id = u1.uid;
    user1Email = u1.email;

    const u2 = await createTestUser("d2_user2", "Participant Two");
    user2Id = u2.uid;
    user2Email = u2.email;

    // Seed 5 scores for user 1
    const baseDate = new Date("2026-03-01");
    for (let i = 0; i < 5; i++) {
      const d = new Date(baseDate.getTime() + i * 86400000).toISOString().split("T")[0];
      await adminClient.from("golf_scores").insert({
        user_id: user1Id,
        score: 10 + i * 2, // [10, 12, 14, 16, 18]
        played_date: d,
      });
    }

    // Seed 3 scores for user 2 (incomplete)
    for (let i = 0; i < 3; i++) {
      const d = new Date(baseDate.getTime() + i * 86400000).toISOString().split("T")[0];
      await adminClient.from("golf_scores").insert({
        user_id: user2Id,
        score: 20 + i, // [20, 21, 22]
        played_date: d,
      });
    }

    // Create user 3 with a canceled subscription and exactly 5 scores
    const u3Email = `d2_user3_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`;
    const { data: u3Data, error: u3Err } = await adminClient.auth.admin.createUser({
      email: u3Email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Participant Three" },
    });
    assert.ifError(u3Err);
    user3Id = u3Data.user.id;
    createdUserIds.push(user3Id);

    await adminClient.from("subscriptions").insert({
      user_id: user3Id,
      plan_type: "monthly",
      status: "canceled",
      amount: 50.0,
      currency: "usd",
      current_period_end: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // expired
    });

    for (let i = 0; i < 5; i++) {
      const d = new Date(baseDate.getTime() + i * 86400000).toISOString().split("T")[0];
      await adminClient.from("golf_scores").insert({
        user_id: user3Id,
        score: 30 + i, // [30, 31, 32, 33, 34]
        played_date: d,
      });
    }

    // Create authed clients
    authedUserClient1 = createClient<Database>(supabaseUrl, anonKey);
    const authRes1 = await authedUserClient1.auth.signInWithPassword({
      email: user1Email,
      password,
    });
    assert.ifError(authRes1.error);

    authedUserClient2 = createClient<Database>(supabaseUrl, anonKey);
    const authRes2 = await authedUserClient2.auth.signInWithPassword({
      email: user2Email,
      password,
    });
    assert.ifError(authRes2.error);
  });

  after(async () => {
    // Teardown created draws
    for (const drawId of createdDrawIds) {
      await adminClient.from("draws").delete().eq("id", drawId);
    }
    // Teardown created users
    for (const uid of createdUserIds) {
      await adminClient.auth.admin.deleteUser(uid);
    }
  });

  describe("1. DrawService.getLatestPublishedDraw", () => {
    test("strictly returns only published draws, ignoring newer draft and simulated draws", async () => {
      // Create a published draw with an earlier timestamp
      const { data: publishedDraw, error: pubErr } = await adminClient
        .from("draws")
        .insert({
          title: "March 2026 Official Published Draw",
          draw_date: new Date("2026-03-15T12:00:00Z").toISOString(),
          cadence: "monthly",
          status: "published",
          draw_mode: "random",
          drawn_numbers: [10, 12, 14, 30, 35],
          total_prize_pool: 1000.0,
          tier_5_pool: 400.0,
          tier_4_pool: 350.0,
          tier_3_pool: 250.0,
          published_at: new Date("2026-03-15T12:30:00Z").toISOString(),
        })
        .select()
        .single();
      assert.ifError(pubErr);
      createdDrawIds.push(publishedDraw.id);

      // Create a newer simulated draw
      const { data: simulatedDraw, error: simErr } = await adminClient
        .from("draws")
        .insert({
          title: "April 2026 Simulated Draft Draw",
          draw_date: new Date("2026-04-15T12:00:00Z").toISOString(),
          cadence: "monthly",
          status: "simulated",
          draw_mode: "random",
          drawn_numbers: [1, 2, 3, 4, 5],
          total_prize_pool: 2000.0,
        })
        .select()
        .single();
      assert.ifError(simErr);
      createdDrawIds.push(simulatedDraw.id);

      // Create an even newer draft draw
      const { data: draftDraw, error: draftErr } = await adminClient
        .from("draws")
        .insert({
          title: "May 2026 Raw Draft Draw",
          draw_date: new Date("2026-05-15T12:00:00Z").toISOString(),
          cadence: "monthly",
          status: "draft",
          draw_mode: "random",
        })
        .select()
        .single();
      assert.ifError(draftErr);
      createdDrawIds.push(draftDraw.id);

      // Normal user query should only see the published draw
      const result = await DrawService.getLatestPublishedDraw(authedUserClient1);
      assert.ifError(result.error);
      assert.ok(result.data, "Should find the published draw");
      assert.equal(result.data.id, publishedDraw.id);
      assert.equal(result.data.status, "published");
      assert.equal(result.data.title, "March 2026 Official Published Draw");

      // Verify that normal user cannot fetch draft/simulated draws directly via RLS
      const { data: draftFetch } = await authedUserClient1
        .from("draws")
        .select("id")
        .eq("id", draftDraw.id);
      assert.equal(draftFetch?.length, 0, "Normal user cannot read draft draw under RLS");

      const { data: simFetch } = await authedUserClient1
        .from("draws")
        .select("id")
        .eq("id", simulatedDraw.id);
      assert.equal(simFetch?.length, 0, "Normal user cannot read simulated draw under RLS");
    });
  });

  describe("2. DrawService.getUserDrawEntry & Entry Matching", () => {
    let testDrawId: string;

    before(async () => {
      // Find the published draw created in step 1
      testDrawId = createdDrawIds[0];

      // Insert draw_entry for user 1 (3 matches: 10, 12, 14)
      await adminClient.from("draw_entries").insert({
        draw_id: testDrawId,
        user_id: user1Id,
        scores_snapshot: [10, 12, 14, 16, 18],
        matches_count: 3,
        matched_numbers: [10, 12, 14],
        winning_tier: "tier_3",
        prize_amount: 250.0,
      });

      // User 2 was NOT entered in this draw
    });

    test("returns user entry with snapshot scores and matched numbers when participated", async () => {
      const entryRes = await DrawService.getUserDrawEntry(
        authedUserClient1,
        testDrawId,
        user1Id
      );
      assert.ifError(entryRes.error);
      assert.ok(entryRes.data, "User 1 should have an entry");
      assert.deepEqual(entryRes.data.scores_snapshot, [10, 12, 14, 16, 18]);
      assert.equal(entryRes.data.matches_count, 3);
      assert.deepEqual(entryRes.data.matched_numbers, [10, 12, 14]);
      assert.equal(entryRes.data.winning_tier, "tier_3");
      assert.equal(Number(entryRes.data.prize_amount), 250.0);
    });

    test("returns null when user did not participate in this draw", async () => {
      const entryRes = await DrawService.getUserDrawEntry(
        authedUserClient2,
        testDrawId,
        user2Id
      );
      assert.ifError(entryRes.error);
      assert.equal(entryRes.data, null, "User 2 did not participate");
    });

    test("privacy: authenticated user cannot query another user's draw entry under RLS", async () => {
      const { data, error } = await authedUserClient2
        .from("draw_entries")
        .select("*")
        .eq("draw_id", testDrawId)
        .eq("user_id", user1Id);

      assert.ifError(error);
      assert.equal(data?.length, 0, "User 2 cannot see User 1's draw entry");
    });
  });

  describe("3. DrawService.getUserWinnings & Payout Tracking", () => {
    let testDrawId: string;

    before(async () => {
      testDrawId = createdDrawIds[0];

      // Fetch user 1's draw_entry_id
      const { data: entry } = await adminClient
        .from("draw_entries")
        .select("id")
        .eq("draw_id", testDrawId)
        .eq("user_id", user1Id)
        .single();

      // Insert winner record for user 1 (note: no match_count column used)
      await adminClient.from("winners").insert({
        draw_id: testDrawId,
        draw_entry_id: entry!.id,
        user_id: user1Id,
        tier: "tier_3",
        prize_amount: 250.0,
        verification_status: "pending_submission",
        payment_status: "pending",
      });
    });

    test("computes totalWon, pendingAmount, paidAmount and links draw details", async () => {
      const winningsRes = await DrawService.getUserWinnings(authedUserClient1, user1Id);
      assert.ifError(winningsRes.error);
      assert.ok(winningsRes.data);
      assert.equal(winningsRes.data.winners.length, 1);

      const win = winningsRes.data.winners[0];
      assert.equal(win.tier, "tier_3");
      assert.equal(Number(win.prize_amount), 250.0);
      assert.equal(win.payment_status, "pending");
      assert.equal(win.verification_status, "pending_submission");
      assert.ok(win.draw, "Draw details should be attached");
      assert.equal(win.draw?.title, "March 2026 Official Published Draw");

      // Verify computed aggregates
      assert.equal(winningsRes.data.totalWon, 250.0);
      assert.equal(winningsRes.data.pendingAmount, 250.0);
      assert.equal(winningsRes.data.paidAmount, 0.0);
    });

    test("returns empty summary with zeroes when user has no winnings", async () => {
      const winningsRes = await DrawService.getUserWinnings(authedUserClient2, user2Id);
      assert.ifError(winningsRes.error);
      assert.ok(winningsRes.data);
      assert.equal(winningsRes.data.winners.length, 0);
      assert.equal(winningsRes.data.totalWon, 0);
      assert.equal(winningsRes.data.pendingAmount, 0);
      assert.equal(winningsRes.data.paidAmount, 0);
    });

    test("privacy: authenticated user cannot query another user's winners record under RLS", async () => {
      const { data, error } = await authedUserClient2
        .from("winners")
        .select("*")
        .eq("user_id", user1Id);

      assert.ifError(error);
      assert.equal(data?.length, 0, "User 2 cannot see User 1's winnings");
    });
  });

  describe("4. Readiness & Qualification Logic Consumption", () => {
    test("User 1 (Active Subscription + 5 Retained Scores) is ready for next draw", async () => {
      const sub = await SubscriptionService.getActiveSubscription(adminClient, user1Id);
      const scoresRes = await ScoreService.getUserScores(adminClient, user1Id);

      const isSubscribed = Boolean(sub);
      const scoresCount = (scoresRes.data ?? []).length;

      assert.equal(isSubscribed, true, "User 1 has active sub");
      assert.equal(scoresCount, 5, "User 1 has exactly 5 retained scores");

      const isReady = isSubscribed && scoresCount === 5;
      assert.equal(isReady, true, "User 1 is ready for the next monthly draw");
    });

    test("User 2 (Active Subscription + 3 Scores) is not ready due to incomplete score count", async () => {
      const sub = await SubscriptionService.getActiveSubscription(adminClient, user2Id);
      const scoresRes = await ScoreService.getUserScores(adminClient, user2Id);

      const isSubscribed = Boolean(sub);
      const scoresCount = (scoresRes.data ?? []).length;

      assert.equal(isSubscribed, true, "User 2 has active sub");
      assert.equal(scoresCount, 3, "User 2 has 3 scores (< 5)");

      const isReady = isSubscribed && (scoresCount as number) === 5;
      assert.equal(isReady, false, "User 2 is not ready (needs 2 more scores)");
    });

    test("User 3 (Inactive/Canceled Subscription + 5 Retained Scores) is NOT qualified", async () => {
      const sub = await SubscriptionService.getActiveSubscription(adminClient, user3Id);
      const scoresRes = await ScoreService.getUserScores(adminClient, user3Id);

      const isSubscribed = Boolean(sub);
      const scoresCount = (scoresRes.data ?? []).length;

      assert.equal(isSubscribed, false, "User 3 has an inactive/canceled subscription");
      assert.equal(scoresCount, 5, "User 3 has exactly 5 retained scores");

      const isReady = isSubscribed && (scoresCount as number) === 5;
      assert.equal(isReady, false, "User 3 is NOT qualified due to inactive subscription");
    });
  });
});
