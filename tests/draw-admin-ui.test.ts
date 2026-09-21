import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";
import { DrawService } from "../src/lib/services/draw.service";
import { createDrawAction, simulateDrawAction } from "../src/app/actions/draw";

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

describe("Phase D1: Admin Draw Operations & Winners UI Integration Tests", () => {
  let adminClient: SupabaseClient<Database>;
  let authedAdminClient: SupabaseClient<Database>;
  let authedNonAdminClient: SupabaseClient<Database>;

  const createdUserIds: string[] = [];
  const createdDrawIds: string[] = [];

  let adminUserId: string;
  let adminEmail: string;
  let nonAdminUserId: string;
  let nonAdminEmail: string;
  let participant1Id: string;
  let participant2Id: string;

  const password = "TestPassword123!";

  before(async () => {
    adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    async function createTestUser(emailPrefix: string, name: string, role: "admin" | "subscriber" = "subscriber") {
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

      if (role === "admin") {
        await adminClient.from("profiles").update({ role: "admin" }).eq("id", uid);
      }

      await adminClient.from("subscriptions").insert({
        user_id: uid,
        stripe_subscription_id: `sub_${emailPrefix}_${Date.now()}`,
        plan_type: "monthly",
        amount: 499,
        currency: "inr",
        status: "active",
        current_period_start: new Date().toISOString(),
        current_period_end: futureDate,
        cancel_at_period_end: false,
      });

      return { uid, email };
    }

    // 1. Create Admin User
    const adminUser = await createTestUser("d1_admin", "Admin Operations", "admin");
    adminUserId = adminUser.uid;
    adminEmail = adminUser.email;

    // 2. Create Non-Admin User
    const nonAdminUser = await createTestUser("d1_user", "Subscriber Golfer", "subscriber");
    nonAdminUserId = nonAdminUser.uid;
    nonAdminEmail = nonAdminUser.email;

    // 3. Create Participants with 5 scores
    participant1Id = (await createTestUser("d1_p1", "Participant One")).uid;
    participant2Id = (await createTestUser("d1_p2", "Participant Two")).uid;

    const setupScores = async (uid: string, scores: number[]) => {
      for (let i = 0; i < scores.length; i++) {
        await adminClient.from("golf_scores").insert({
          user_id: uid,
          score: scores[i],
          played_date: `2026-07-1${i}`,
        });
      }
    };

    await setupScores(participant1Id, [10, 20, 30, 40, 45]);
    await setupScores(participant2Id, [10, 20, 30, 40, 1]);

    // 4. Authenticate client sessions
    authedAdminClient = createClient<Database>(supabaseUrl, anonKey);
    const { error: adminLoginErr } = await authedAdminClient.auth.signInWithPassword({
      email: adminEmail,
      password,
    });
    assert.ifError(adminLoginErr);

    authedNonAdminClient = createClient<Database>(supabaseUrl, anonKey);
    const { error: nonAdminLoginErr } = await authedNonAdminClient.auth.signInWithPassword({
      email: nonAdminEmail,
      password,
    });
    assert.ifError(nonAdminLoginErr);
  });

  after(async () => {
    if (createdDrawIds.length > 0) {
      await adminClient.from("winners").delete().in("draw_id", createdDrawIds);
      await adminClient.from("draw_entries").delete().in("draw_id", createdDrawIds);
      await adminClient.from("draws").delete().in("id", createdDrawIds);
    }

    for (const uid of createdUserIds) {
      await adminClient.from("subscriptions").delete().eq("user_id", uid);
      await adminClient.from("golf_scores").delete().eq("user_id", uid);
      await adminClient.auth.admin.deleteUser(uid);
    }
  });

  // ==========================================================================
  // 1. SERVER ACTIONS: createDrawAction
  // ==========================================================================
  describe("1. createDrawAction Server Action", () => {
    test("rejects unauthenticated execution (missing cookies/context)", async () => {
      const res = await createDrawAction({
        title: "Unauth Draw",
        draw_date: new Date().toISOString(),
        draw_mode: "algorithmic",
      });
      assert.ok(res.error);
      assert.match(res.error, /Authentication required/i);
    });

    test("validates input fields through createDrawSchema (e.g. title < 3 chars fails)", async () => {
      const { createDrawSchema } = await import("../src/lib/validations/draw.schema");
      const invalidParse = createDrawSchema.safeParse({
        title: "ab",
        draw_date: new Date().toISOString(),
        draw_mode: "algorithmic",
      });
      assert.strictEqual(invalidParse.success, false);
      assert.match(invalidParse.error.issues[0]?.message, /at least 3 characters/i);
    });

    test("creates draft draw successfully via DrawService with initial status 'draft'", async () => {
      const drawRes = await DrawService.createDraw(adminClient, {
        title: "Test D1 Draft Draw",
        draw_date: new Date().toISOString(),
        draw_mode: "algorithmic",
      }, adminUserId);

      assert.strictEqual(drawRes.error, undefined);
      assert.ok(drawRes.data);
      assert.strictEqual(drawRes.data.status, "draft");
      assert.strictEqual(drawRes.data.cadence, "monthly");
      createdDrawIds.push(drawRes.data.id);
    });
  });

  // ==========================================================================
  // 2. SERVER ACTIONS: simulateDrawAction & Lifecycle
  // ==========================================================================
  describe("2. simulateDrawAction & Lifecycle Controls", () => {
    test("rejects simulation with missing drawId", async () => {
      const res = await simulateDrawAction("");
      assert.ok(res.error);
      assert.match(res.error, /Draw ID is required/i);
    });

    test("transitions draft -> simulated with persistent snapshot", async () => {
      const drawRes = await DrawService.createDraw(adminClient, {
        title: "Simulation Test Draw",
        draw_date: new Date().toISOString(),
        draw_mode: "algorithmic",
      }, adminUserId);
      assert.ok(drawRes.data);
      const drawId = drawRes.data.id;
      createdDrawIds.push(drawId);

      // Simulate using DrawService
      const simRes = await DrawService.simulateDraw(adminClient, drawId, {
        drawnNumbers: [10, 20, 30, 40, 45],
      });
      assert.strictEqual(simRes.error, undefined);
      assert.ok(simRes.data);
      assert.strictEqual(simRes.data.draw.status, "simulated");
      assert.strictEqual(simRes.data.draw.drawn_numbers?.length, 5);
      assert.ok(simRes.data.entriesCount > 0);

      // Verify draft draw UI does not offer publish
      assert.notStrictEqual(drawRes.data.status, "published");
      // Verify simulated draw has publish available
      assert.strictEqual(simRes.data.draw.status, "simulated");
    });

    test("re-simulation cleanly replaces previous draw entries snapshot", async () => {
      const drawRes = await DrawService.createDraw(adminClient, {
        title: "Re-simulation Test Draw",
        draw_date: new Date().toISOString(),
        draw_mode: "random",
      }, adminUserId);
      assert.ok(drawRes.data);
      const drawId = drawRes.data.id;
      createdDrawIds.push(drawId);

      // First simulation
      const sim1 = await DrawService.simulateDraw(adminClient, drawId, {
        drawnNumbers: [10, 20, 30, 40, 45],
      });
      assert.strictEqual(sim1.error, undefined);

      const { data: entries1 } = await adminClient.from("draw_entries").select("id").eq("draw_id", drawId);
      const count1 = entries1?.length ?? 0;
      assert.ok(count1 > 0);

      // Second simulation (re-simulate) with different numbers
      const sim2 = await DrawService.simulateDraw(adminClient, drawId, {
        drawnNumbers: [1, 2, 3, 4, 5],
      });
      assert.strictEqual(sim2.error, undefined);

      const { data: entries2 } = await adminClient.from("draw_entries").select("id").eq("draw_id", drawId);
      // Ensure no duplicate accumulated entries
      assert.strictEqual(entries2?.length, count1);
    });

    test("published draw rejects subsequent simulation attempt", async () => {
      const drawRes = await DrawService.createDraw(adminClient, {
        title: "Published Draw Sim Rejection",
        draw_date: new Date().toISOString(),
        draw_mode: "random",
      }, adminUserId);
      assert.ok(drawRes.data);
      const drawId = drawRes.data.id;
      createdDrawIds.push(drawId);

      // Simulate
      await DrawService.simulateDraw(adminClient, drawId, {
        drawnNumbers: [10, 20, 30, 40, 45],
      });

      // Publish using authenticated admin
      const pubRes = await DrawService.publishDraw(authedAdminClient, drawId, adminUserId);
      assert.strictEqual(pubRes.error, undefined);

      // Attempting to simulate a published draw must fail
      const simFail = await DrawService.simulateDraw(adminClient, drawId);
      assert.ok(simFail.error);
      assert.match(simFail.error, /Cannot simulate a draw in 'published' status/i);
    });
  });

  // ==========================================================================
  // 3. READ SERVICES: getDrawEntriesWithProfiles & listWinners
  // ==========================================================================
  describe("3. Read Services for Admin UI", () => {
    test("getDrawEntriesWithProfiles joins participant full_name and email", async () => {
      const drawRes = await DrawService.createDraw(adminClient, {
        title: "Profile Join Test Draw",
        draw_date: new Date().toISOString(),
        draw_mode: "algorithmic",
      }, adminUserId);
      assert.ok(drawRes.data);
      const drawId = drawRes.data.id;
      createdDrawIds.push(drawId);

      await DrawService.simulateDraw(adminClient, drawId, {
        drawnNumbers: [10, 20, 30, 40, 45],
      });

      const entriesRes = await DrawService.getDrawEntriesWithProfiles(adminClient, drawId);
      assert.strictEqual(entriesRes.error, undefined);
      assert.ok(entriesRes.data);
      assert.ok(entriesRes.data.length > 0);

      // Verify profile is joined on entry
      const entry = entriesRes.data[0];
      assert.ok(entry.profile);
      assert.ok(typeof entry.profile.email === "string");
      assert.ok(entry.scores_snapshot.length === 5);
    });

    test("listWinners returns winners with profile and draw details, respecting filters", async () => {
      const drawRes = await DrawService.createDraw(adminClient, {
        title: "Winners List Test Draw",
        draw_date: new Date().toISOString(),
        draw_mode: "algorithmic",
      }, adminUserId);
      assert.ok(drawRes.data);
      const drawId = drawRes.data.id;
      createdDrawIds.push(drawId);

      await DrawService.simulateDraw(adminClient, drawId, {
        drawnNumbers: [10, 20, 30, 40, 45],
      });

      await DrawService.publishDraw(authedAdminClient, drawId, adminUserId);

      // Query winners without filters
      const allWinnersRes = await DrawService.listWinners(adminClient);
      assert.strictEqual(allWinnersRes.error, undefined);
      assert.ok(allWinnersRes.data);
      assert.ok(allWinnersRes.data.length > 0);

      const targetWinner = allWinnersRes.data.find((w) => w.draw_id === drawId);
      assert.ok(targetWinner);
      assert.ok(targetWinner.profile);
      assert.ok(targetWinner.draw);
      assert.strictEqual(targetWinner.draw.title, "Winners List Test Draw");

      // Query winners with drawId filter
      const filteredByDraw = await DrawService.listWinners(adminClient, { drawId });
      assert.strictEqual(filteredByDraw.error, undefined);
      assert.ok(filteredByDraw.data);
      assert.ok(filteredByDraw.data.every((w) => w.draw_id === drawId));

      // Query winners with tier filter
      const filteredByTier = await DrawService.listWinners(adminClient, {
        drawId,
        tier: "tier_5",
      });
      assert.strictEqual(filteredByTier.error, undefined);
      assert.ok(filteredByTier.data);
      assert.ok(filteredByTier.data.every((w) => w.tier === "tier_5"));
    });

    test("privacy: normal user client cannot query other users' winners or draw entries via RLS", async () => {
      // Normal user queries draw_entries directly
      const { data: userEntries, error: userEntriesErr } = await authedNonAdminClient
        .from("draw_entries")
        .select("*");
      assert.ifError(userEntriesErr);

      // Must ONLY contain rows belonging to nonAdminUserId
      if (userEntries && userEntries.length > 0) {
        assert.ok(userEntries.every((e) => e.user_id === nonAdminUserId));
      }

      // Normal user queries winners directly
      const { data: userWinners, error: userWinnersErr } = await authedNonAdminClient
        .from("winners")
        .select("*");
      assert.ifError(userWinnersErr);

      if (userWinners && userWinners.length > 0) {
        assert.ok(userWinners.every((w) => w.user_id === nonAdminUserId));
      }
    });
  });
});
