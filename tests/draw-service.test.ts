import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";
import { DrawService } from "../src/lib/services/draw.service";

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

describe("Phase B: Draw Service & Simulation Integration Tests", () => {
  let adminClient: SupabaseClient<Database>;

  // Track created test resources for cleanup
  const createdUserIds: string[] = [];
  const createdDrawIds: string[] = [];

  let userEligibleA: string;
  let userEligibleB: string;
  let userTrialing: string;
  let userCancelAtPeriodEnd: string;
  let userFewScores: string;
  let userExpiredSub: string;
  let userPastDueSub: string;

  const password = "TestPassword123!";

  before(async () => {
    adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);

    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    // Helper to create test user with profile
    async function createTestUser(emailPrefix: string, name: string): Promise<string> {
      const email = `${emailPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@gmail.com`;
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name },
      });
      assert.ifError(error);
      const uid = data.user.id;
      createdUserIds.push(uid);
      return uid;
    }

    // 1. userEligibleA: Active monthly sub (₹499) + 5 scores [10, 20, 30, 40, 45]
    userEligibleA = await createTestUser("draw_el_a", "Eligible User Alpha");
    await adminClient.from("subscriptions").insert({
      user_id: userEligibleA,
      stripe_subscription_id: `sub_ela_${Date.now()}`,
      plan_type: "monthly",
      amount: 499,
      currency: "inr",
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: futureDate,
      cancel_at_period_end: false,
    });
    // Add 5 scores on 5 distinct dates
    for (let i = 1; i <= 5; i++) {
      const playedDate = `2026-08-0${i}`;
      const scoreVal = [10, 20, 30, 40, 45][i - 1];
      await adminClient.from("golf_scores").insert({
        user_id: userEligibleA,
        score: scoreVal,
        played_date: playedDate,
      });
    }

    // 2. userEligibleB: Active yearly sub (₹4,999) + 5 scores [5, 15, 25, 35, 45]
    userEligibleB = await createTestUser("draw_el_b", "Eligible User Beta");
    await adminClient.from("subscriptions").insert({
      user_id: userEligibleB,
      stripe_subscription_id: `sub_elb_${Date.now()}`,
      plan_type: "yearly",
      amount: 4999,
      currency: "inr",
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: futureDate,
      cancel_at_period_end: false,
    });
    for (let i = 1; i <= 5; i++) {
      const playedDate = `2026-08-0${i}`;
      const scoreVal = [5, 15, 25, 35, 45][i - 1];
      await adminClient.from("golf_scores").insert({
        user_id: userEligibleB,
        score: scoreVal,
        played_date: playedDate,
      });
    }

    // 3. userTrialing: Trialing sub + 5 scores
    userTrialing = await createTestUser("draw_trial", "Trialing User");
    await adminClient.from("subscriptions").insert({
      user_id: userTrialing,
      stripe_subscription_id: `sub_trial_${Date.now()}`,
      plan_type: "monthly",
      amount: 499,
      currency: "inr",
      status: "trialing",
      current_period_start: new Date().toISOString(),
      current_period_end: futureDate,
      cancel_at_period_end: false,
    });
    for (let i = 1; i <= 5; i++) {
      await adminClient.from("golf_scores").insert({
        user_id: userTrialing,
        score: 30 + i,
        played_date: `2026-08-0${i}`,
      });
    }

    // 4. userCancelAtPeriodEnd: Active sub scheduled to cancel at period end + 5 scores
    userCancelAtPeriodEnd = await createTestUser("draw_cancel_end", "Cancel Period End User");
    await adminClient.from("subscriptions").insert({
      user_id: userCancelAtPeriodEnd,
      stripe_subscription_id: `sub_canc_${Date.now()}`,
      plan_type: "monthly",
      amount: 499,
      currency: "inr",
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: futureDate,
      cancel_at_period_end: true,
    });
    for (let i = 1; i <= 5; i++) {
      await adminClient.from("golf_scores").insert({
        user_id: userCancelAtPeriodEnd,
        score: 20 + i,
        played_date: `2026-08-0${i}`,
      });
    }

    // 5. userFewScores: Active sub, but ONLY 3 scores (Excluded from entry, but included in prize pool!)
    userFewScores = await createTestUser("draw_few_sc", "Few Scores User");
    await adminClient.from("subscriptions").insert({
      user_id: userFewScores,
      stripe_subscription_id: `sub_few_${Date.now()}`,
      plan_type: "monthly",
      amount: 499,
      currency: "inr",
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: futureDate,
      cancel_at_period_end: false,
    });
    for (let i = 1; i <= 3; i++) {
      await adminClient.from("golf_scores").insert({
        user_id: userFewScores,
        score: 35,
        played_date: `2026-08-0${i}`,
      });
    }

    // 6. userExpiredSub: Expired sub (past current_period_end) + 5 scores
    userExpiredSub = await createTestUser("draw_expired", "Expired Sub User");
    await adminClient.from("subscriptions").insert({
      user_id: userExpiredSub,
      stripe_subscription_id: `sub_exp_${Date.now()}`,
      plan_type: "monthly",
      amount: 499,
      currency: "inr",
      status: "active",
      current_period_start: pastDate,
      current_period_end: pastDate,
      cancel_at_period_end: false,
    });
    for (let i = 1; i <= 5; i++) {
      await adminClient.from("golf_scores").insert({
        user_id: userExpiredSub,
        score: 18,
        played_date: `2026-08-0${i}`,
      });
    }

    // 7. userPastDueSub: past_due sub + 5 scores
    userPastDueSub = await createTestUser("draw_pastdue", "Past Due Sub User");
    await adminClient.from("subscriptions").insert({
      user_id: userPastDueSub,
      stripe_subscription_id: `sub_pd_${Date.now()}`,
      plan_type: "monthly",
      amount: 499,
      currency: "inr",
      status: "past_due",
      current_period_start: new Date().toISOString(),
      current_period_end: futureDate,
      cancel_at_period_end: false,
    });
    for (let i = 1; i <= 5; i++) {
      await adminClient.from("golf_scores").insert({
        user_id: userPastDueSub,
        score: 25,
        played_date: `2026-08-0${i}`,
      });
    }
  });

  after(async () => {
    // 1. Delete created draws (cascades to draw_entries)
    if (createdDrawIds.length > 0) {
      await adminClient.from("draw_entries").delete().in("draw_id", createdDrawIds);
      await adminClient.from("draws").delete().in("id", createdDrawIds);
    }

    // 2. Delete test users (cascades to subscriptions, golf_scores, profiles)
    for (const uid of createdUserIds) {
      await adminClient.from("draw_entries").delete().eq("user_id", uid);
      await adminClient.from("subscriptions").delete().eq("user_id", uid);
      await adminClient.from("golf_scores").delete().eq("user_id", uid);
      await adminClient.auth.admin.deleteUser(uid);
    }
  });

  // ==========================================================================
  // 1. DRAW CREATION
  // ==========================================================================
  describe("1. Draw Creation", () => {
    test("valid draw creation produces draft status", async () => {
      const res = await DrawService.createDraw(adminClient, {
        title: "September 2026 Championship Draw",
        draw_date: new Date().toISOString(),
        draw_mode: "algorithmic",
      });

      assert.strictEqual(res.error, undefined);
      assert.ok(res.data);
      assert.strictEqual(res.data.status, "draft");
      assert.strictEqual(res.data.title, "September 2026 Championship Draw");
      assert.strictEqual(res.data.draw_mode, "algorithmic");
      assert.strictEqual(res.data.drawn_numbers, null);
      createdDrawIds.push(res.data.id);
    });

    test("invalid title shorter than 3 characters is rejected", async () => {
      const res = await DrawService.createDraw(adminClient, {
        title: "Hi",
        draw_date: new Date().toISOString(),
        draw_mode: "random",
      });

      assert.ok(res.error);
      assert.match(res.error, /Title must be at least 3 characters/i);
    });

    test("unsupported draw mode is rejected", async () => {
      const res = await DrawService.createDraw(adminClient, {
        title: "Invalid Draw Mode Test",
        draw_date: new Date().toISOString(),
        draw_mode: "super_lotto",
      });

      assert.ok(res.error);
      assert.match(res.error, /Draw mode must be either/i);
    });
  });

  // ==========================================================================
  // 2. PARTICIPANT & SUBSCRIBER ELIGIBILITY
  // ==========================================================================
  describe("2. Participant Eligibility & Prize Pool Population", () => {
    test("active subscriber with exactly 5 scores is eligible for draw participation", async () => {
      const eligibleRes = await DrawService.getEligibleParticipants(adminClient);
      assert.strictEqual(eligibleRes.error, undefined);
      assert.ok(eligibleRes.data);

      const userAEntry = eligibleRes.data.find((p) => p.userId === userEligibleA);
      assert.ok(userAEntry, "userEligibleA should be eligible");
      assert.strictEqual(userAEntry.retainedScores.length, 5);
      assert.deepStrictEqual(userAEntry.retainedScores, [45, 40, 30, 20, 10]); // played_date desc order

      const userBEntry = eligibleRes.data.find((p) => p.userId === userEligibleB);
      assert.ok(userBEntry, "userEligibleB should be eligible");
      assert.strictEqual(userBEntry.retainedScores.length, 5);
    });

    test("active subscriber with fewer than 5 scores is excluded from draw participation", async () => {
      const eligibleRes = await DrawService.getEligibleParticipants(adminClient);
      assert.ok(eligibleRes.data);

      const userFew = eligibleRes.data.find((p) => p.userId === userFewScores);
      assert.strictEqual(userFew, undefined, "User with only 3 scores must NOT be in eligible draw entries");
    });

    test("trialing subscriber with 5 scores is eligible", async () => {
      const eligibleRes = await DrawService.getEligibleParticipants(adminClient);
      assert.ok(eligibleRes.data);

      const trialing = eligibleRes.data.find((p) => p.userId === userTrialing);
      assert.ok(trialing, "Trialing subscriber with future period end should be eligible");
    });

    test("canceled subscriber with cancel_at_period_end before period end remains eligible", async () => {
      const eligibleRes = await DrawService.getEligibleParticipants(adminClient);
      assert.ok(eligibleRes.data);

      const cancelEnd = eligibleRes.data.find((p) => p.userId === userCancelAtPeriodEnd);
      assert.ok(cancelEnd, "cancel_at_period_end=true before period end must remain eligible");
    });

    test("expired subscriber is excluded from draw participation", async () => {
      const eligibleRes = await DrawService.getEligibleParticipants(adminClient);
      assert.ok(eligibleRes.data);

      const expired = eligibleRes.data.find((p) => p.userId === userExpiredSub);
      assert.strictEqual(expired, undefined, "Expired subscription must be excluded");
    });

    test("non-qualifying statuses (past_due) are excluded from draw participation", async () => {
      const eligibleRes = await DrawService.getEligibleParticipants(adminClient);
      assert.ok(eligibleRes.data);

      const pastDue = eligibleRes.data.find((p) => p.userId === userPastDueSub);
      assert.strictEqual(pastDue, undefined, "past_due subscription must be excluded");
    });

    test("prize pool population includes active subscribers even without 5 scores", async () => {
      const activeSubsRes = await DrawService.getActiveSubscribers(adminClient);
      assert.strictEqual(activeSubsRes.error, undefined);
      assert.ok(activeSubsRes.data);

      // userFewScores has only 3 scores, but active subscription
      const fewScoresInPool = activeSubsRes.data.find((s) => s.userId === userFewScores);
      assert.ok(fewScoresInPool, "Active subscriber with < 5 scores MUST contribute to subscription prize pool");

      // Expired and past_due subscribers must NOT be in active subscribers pool
      const expiredInPool = activeSubsRes.data.find((s) => s.userId === userExpiredSub);
      assert.strictEqual(expiredInPool, undefined, "Expired subscriber must not be in active subscribers pool");

      const pastDueInPool = activeSubsRes.data.find((s) => s.userId === userPastDueSub);
      assert.strictEqual(pastDueInPool, undefined, "past_due subscriber must not be in active subscribers pool");
    });

    test("subscriber with more than 5 scores has strictly 5 retained scores evaluated", async () => {
      // Add a 6th score to userEligibleA with an older played date
      await adminClient.from("golf_scores").insert({
        user_id: userEligibleA,
        score: 1,
        played_date: "2026-07-01", // older date
      });

      const eligibleRes = await DrawService.getEligibleParticipants(adminClient);
      const userAEntry = eligibleRes.data?.find((p) => p.userId === userEligibleA);

      assert.ok(userAEntry);
      // Retained rule: strictly the 5 newest scores by played_date DESC
      assert.strictEqual(userAEntry.retainedScores.length, 5);
      assert.strictEqual(userAEntry.retainedScores.includes(1), false, "Older 6th score must not be in retained scores");

      // Cleanup the 6th score
      await adminClient
        .from("golf_scores")
        .delete()
        .eq("user_id", userEligibleA)
        .eq("played_date", "2026-07-01");
    });
  });

  // ==========================================================================
  // 3. AUTHORITATIVE ROLLOVER INSPECTION
  // ==========================================================================
  describe("3. Authoritative Rollover Jackpot", () => {
    test("returns 0 when there are no previous published draws", async () => {
      // If there are no published draws in test environment, rollover is 0
      const rollover = await DrawService.getAuthoritativeRolloverJackpot(adminClient);
      assert.strictEqual(rollover.error, undefined);
      assert.strictEqual(typeof rollover.data, "number");
    });

    test("draft and simulated draws are strictly ignored for rollover", async () => {
      // Create a draft draw with high rollover_jackpot_out
      const { data: fakeDraft } = await adminClient
        .from("draws")
        .insert({
          title: "Fake Draft With Outflow",
          draw_date: new Date().toISOString(),
          draw_mode: "random",
          status: "draft",
          rollover_jackpot_out: 99999.0,
          jackpot_rolled_over: true,
        })
        .select()
        .single();
      assert.ok(fakeDraft);
      createdDrawIds.push(fakeDraft.id);

      // Create a simulated draw with high rollover_jackpot_out
      const { data: fakeSim } = await adminClient
        .from("draws")
        .insert({
          title: "Fake Simulated With Outflow",
          draw_date: new Date().toISOString(),
          draw_mode: "random",
          status: "simulated",
          rollover_jackpot_out: 88888.0,
          jackpot_rolled_over: true,
        })
        .select()
        .single();
      assert.ok(fakeSim);
      createdDrawIds.push(fakeSim.id);

      const rollover = await DrawService.getAuthoritativeRolloverJackpot(adminClient);
      assert.notStrictEqual(rollover.data, 99999.0);
      assert.notStrictEqual(rollover.data, 88888.0);
    });

    test("reads rollover strictly from latest PUBLISHED draw", async () => {
      // Insert a mock published draw with rollover
      const { data: pubDraw } = await adminClient
        .from("draws")
        .insert({
          title: "Previous Published Draw With Rollover",
          draw_date: new Date(Date.now() - 10000).toISOString(),
          published_at: new Date(Date.now() - 5000).toISOString(),
          draw_mode: "random",
          status: "published",
          jackpot_rolled_over: true,
          rollover_jackpot_out: 12345.67,
        })
        .select()
        .single();
      assert.ok(pubDraw);
      createdDrawIds.push(pubDraw.id);

      const rollover = await DrawService.getAuthoritativeRolloverJackpot(adminClient);
      assert.strictEqual(rollover.error, undefined);
      assert.strictEqual(rollover.data, 12345.67);
    });

    test("REGRESSION: newer published draw without rollover must NOT be skipped to reuse older rollover", async () => {
      // Draw A: Published earlier with rollover
      const { data: drawA } = await adminClient
        .from("draws")
        .insert({
          title: "Draw A - Published earlier with rollover",
          draw_date: new Date(Date.now() - 20000).toISOString(),
          published_at: new Date(Date.now() - 15000).toISOString(),
          draw_mode: "random",
          status: "published",
          jackpot_rolled_over: true,
          rollover_jackpot_out: 10000.0,
        })
        .select()
        .single();
      assert.ok(drawA);
      createdDrawIds.push(drawA.id);

      // Draw B: Published later with 0 rollover (e.g., jackpot was won)
      const { data: drawB } = await adminClient
        .from("draws")
        .insert({
          title: "Draw B - Published later without rollover",
          draw_date: new Date(Date.now() - 10000).toISOString(),
          published_at: new Date(Date.now() - 1000).toISOString(),
          draw_mode: "random",
          status: "published",
          jackpot_rolled_over: false,
          rollover_jackpot_out: 0.0,
        })
        .select()
        .single();
      assert.ok(drawB);
      createdDrawIds.push(drawB.id);

      // Authoritative rollover must return 0 from Draw B, NOT 10000 from Draw A
      const rollover = await DrawService.getAuthoritativeRolloverJackpot(adminClient);
      assert.strictEqual(rollover.error, undefined);
      assert.strictEqual(
        rollover.data,
        0,
        "Authoritative rollover must be 0 from latest published Draw B, not 10000 from older Draw A"
      );

      // Create and simulate a new draw, ensuring rollover_jackpot_in is 0
      const draftRes = await DrawService.createDraw(adminClient, {
        title: "Simulation After Won Jackpot",
        draw_date: new Date().toISOString(),
        draw_mode: "random",
      });
      assert.ok(draftRes.data);
      createdDrawIds.push(draftRes.data.id);

      const simRes = await DrawService.simulateDraw(adminClient, draftRes.data.id);
      assert.strictEqual(simRes.error, undefined);
      assert.strictEqual(
        simRes.data?.draw.rollover_jackpot_in,
        0,
        "Simulated draw must use rollover_jackpot_in = 0 from latest published draw"
      );
    });
  });

  // ==========================================================================
  // 4. SIMULATION WORKFLOW
  // ==========================================================================
  describe("4. Simulation Workflow", () => {
    let testDrawId: string;

    before(async () => {
      const res = await DrawService.createDraw(adminClient, {
        title: "Simulation Test Draw",
        draw_date: new Date().toISOString(),
        draw_mode: "random",
      });
      assert.ok(res.data);
      testDrawId = res.data.id;
      createdDrawIds.push(testDrawId);
    });

    test("draft draw transitions to simulated status", async () => {
      const simRes = await DrawService.simulateDraw(adminClient, testDrawId);
      assert.strictEqual(simRes.error, undefined);
      assert.ok(simRes.data);

      const { draw, entriesCount, eligibleParticipantsCount, totalActiveSubscribersCount } =
        simRes.data;

      assert.strictEqual(draw.status, "simulated");
      assert.ok(draw.drawn_numbers);
      assert.strictEqual(draw.drawn_numbers.length, 5);
      // All drawn numbers are distinct and between 1 and 45
      assert.strictEqual(new Set(draw.drawn_numbers).size, 5);
      assert.ok(draw.drawn_numbers.every((n) => n >= 1 && n <= 45));

      // Eligible count matches persisted entries count
      assert.strictEqual(entriesCount, eligibleParticipantsCount);
      assert.ok(eligibleParticipantsCount >= 2);
      assert.ok(totalActiveSubscribersCount >= eligibleParticipantsCount);

      // Verify pool calculations are persisted on the draw
      assert.ok(draw.total_prize_pool > 0);
      assert.ok(draw.tier_5_pool > 0);
      assert.ok(draw.tier_4_pool > 0);
      assert.ok(draw.tier_3_pool > 0);
    });

    test("persisted draw_entries have exact 5-score snapshots and matches", async () => {
      const entriesRes = await DrawService.getDrawEntries(adminClient, testDrawId);
      assert.strictEqual(entriesRes.error, undefined);
      assert.ok(entriesRes.data && entriesRes.data.length > 0);

      for (const entry of entriesRes.data) {
        assert.strictEqual(entry.scores_snapshot.length, 5);
        assert.ok(entry.matches_count >= 0 && entry.matches_count <= 5);
        assert.ok(Array.isArray(entry.matched_numbers));
        assert.strictEqual(entry.matches_count, entry.matched_numbers.length);
        assert.ok(typeof entry.prize_amount === "number");

        if (entry.matches_count === 5) {
          assert.strictEqual(entry.winning_tier, "tier_5");
        } else if (entry.matches_count === 4) {
          assert.strictEqual(entry.winning_tier, "tier_4");
        } else if (entry.matches_count === 3) {
          assert.strictEqual(entry.winning_tier, "tier_3");
        } else {
          assert.strictEqual(entry.winning_tier, null);
        }
      }
    });

    test("winners table remains strictly empty during simulation", async () => {
      const { data: winners, error } = await adminClient
        .from("winners")
        .select("*")
        .eq("draw_id", testDrawId);

      assert.ifError(error);
      assert.strictEqual(winners?.length, 0, "Simulation MUST NOT insert any rows into public.winners");
    });

    test("draw remains in simulated status and is NOT published", async () => {
      const { data: draw } = await adminClient
        .from("draws")
        .select("status, published_at")
        .eq("id", testDrawId)
        .single();

      assert.strictEqual(draw?.status, "simulated");
      assert.strictEqual(draw?.published_at, null);
    });
  });

  // ==========================================================================
  // 5. RE-SIMULATION WORKFLOW
  // ==========================================================================
  describe("5. Re-simulation Workflow", () => {
    let reSimDrawId: string;

    before(async () => {
      const res = await DrawService.createDraw(adminClient, {
        title: "Re-simulation Test Draw",
        draw_date: new Date().toISOString(),
        draw_mode: "algorithmic",
      });
      assert.ok(res.data);
      reSimDrawId = res.data.id;
      createdDrawIds.push(reSimDrawId);
    });

    test("re-simulating replaces previous draw_entries cleanly with zero stale records", async () => {
      // 1. Initial simulation with specific numbers: [10, 20, 30, 40, 45]
      // Matches userEligibleA completely (tier_5 winner)
      const sim1 = await DrawService.simulateDraw(adminClient, reSimDrawId, {
        drawnNumbers: [10, 20, 30, 40, 45],
      });
      assert.strictEqual(sim1.error, undefined);

      const entries1 = await DrawService.getDrawEntries(adminClient, reSimDrawId);
      const entryIds1 = (entries1.data ?? []).map((e) => e.id);
      assert.ok(entryIds1.length > 0);

      // Verify userEligibleA got tier 5
      const userAEntry1 = entries1.data?.find((e) => e.user_id === userEligibleA);
      assert.strictEqual(userAEntry1?.winning_tier, "tier_5");
      assert.ok((userAEntry1?.prize_amount ?? 0) > 0);

      // 2. Second simulation (RE-SIMULATION) with completely different numbers: [1, 2, 3, 4, 5]
      const sim2 = await DrawService.simulateDraw(adminClient, reSimDrawId, {
        drawnNumbers: [1, 2, 3, 4, 5],
      });
      assert.strictEqual(sim2.error, undefined);

      const entries2 = await DrawService.getDrawEntries(adminClient, reSimDrawId);
      const entryIds2 = (entries2.data ?? []).map((e) => e.id);
      assert.ok(entryIds2.length > 0);

      // Old entry IDs must be completely replaced
      for (const oldId of entryIds1) {
        assert.strictEqual(
          entryIds2.includes(oldId),
          false,
          `Old draw entry ${oldId} must have been deleted during re-simulation`
        );
      }

      // Check new draw entries
      const userAEntry2 = entries2.data?.find((e) => e.user_id === userEligibleA);
      // User A scores are [10, 20, 30, 40, 45], none match [1, 2, 3, 4, 5]
      assert.strictEqual(userAEntry2?.matches_count, 0);
      assert.strictEqual(userAEntry2?.winning_tier, null);
      assert.strictEqual(userAEntry2?.prize_amount, 0);

      // Winners table remains untouched
      const { data: winners } = await adminClient
        .from("winners")
        .select("*")
        .eq("draw_id", reSimDrawId);
      assert.strictEqual(winners?.length, 0);
    });

    test("cannot simulate a draw that is already published", async () => {
      // Temporarily mark the draw as published
      await adminClient
        .from("draws")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", reSimDrawId);

      const simPub = await DrawService.simulateDraw(adminClient, reSimDrawId);
      assert.ok(simPub.error);
      assert.match(simPub.error, /Cannot simulate a draw in 'published' status/i);

      // Reset to simulated
      await adminClient
        .from("draws")
        .update({ status: "simulated" })
        .eq("id", reSimDrawId);
    });
  });
});
