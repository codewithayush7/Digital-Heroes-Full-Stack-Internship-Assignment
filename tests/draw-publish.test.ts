import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";
import { DrawService } from "../src/lib/services/draw.service";
import { publishDrawAction } from "../src/app/actions/draw";

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

describe("Phase C: Publish Draw Atomic RPC & Concurrency Tests", () => {
  let adminClient: SupabaseClient<Database>;
  let authedAdminClient: SupabaseClient<Database>;
  let authedNonAdminClient: SupabaseClient<Database>;

  const createdUserIds: string[] = [];
  const createdDrawIds: string[] = [];

  let adminUserId: string;
  let adminEmail: string;
  let nonAdminUserId: string;
  let nonAdminEmail: string;
  let participantT5: string;
  let participantT4: string;
  let participantT3: string;
  let participantNonWinner: string;

  const password = "TestPassword123!";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  before(async () => {
    adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);

    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    async function createTestUser(emailPrefix: string, name: string, role: "admin" | "subscriber" = "subscriber"): Promise<{ uid: string; email: string }> {
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

      // Add subscription so user is active
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
    const adminUser = await createTestUser("pub_admin", "Draw Admin User", "admin");
    adminUserId = adminUser.uid;
    adminEmail = adminUser.email;

    // 2. Create Non-Admin User
    const nonAdminUser = await createTestUser("pub_user", "Regular Golfer", "subscriber");
    nonAdminUserId = nonAdminUser.uid;
    nonAdminEmail = nonAdminUser.email;

    // 3. Create Participants for Tier 5, 4, 3, and Non-winner
    participantT5 = (await createTestUser("p_t5", "Tier 5 Golfer")).uid;
    participantT4 = (await createTestUser("p_t4", "Tier 4 Golfer")).uid;
    participantT3 = (await createTestUser("p_t3", "Tier 3 Golfer")).uid;
    participantNonWinner = (await createTestUser("p_none", "Non-winning Golfer")).uid;

    // 4. Authenticate separate clients for admin and non-admin
    authedAdminClient = createClient<Database>(supabaseUrl, anonKey);
    const { error: adminLoginError } = await authedAdminClient.auth.signInWithPassword({
      email: adminEmail,
      password,
    });
    assert.ifError(adminLoginError);

    authedNonAdminClient = createClient<Database>(supabaseUrl, anonKey);
    const { error: nonAdminLoginError } = await authedNonAdminClient.auth.signInWithPassword({
      email: nonAdminEmail,
      password,
    });
    assert.ifError(nonAdminLoginError);

    // Add 5 scores for each participant
    const setupScores = async (uid: string, scores: number[]) => {
      for (let i = 0; i < scores.length; i++) {
        await adminClient.from("golf_scores").insert({
          user_id: uid,
          score: scores[i],
          played_date: `2026-08-1${i}`,
        });
      }
    };

    // Drawn numbers will be [10, 20, 30, 40, 45]
    await setupScores(participantT5, [10, 20, 30, 40, 45]); // 5 matches -> tier_5
    await setupScores(participantT4, [10, 20, 30, 40, 1]);  // 4 matches -> tier_4
    await setupScores(participantT3, [10, 20, 30, 2, 3]);   // 3 matches -> tier_3
    await setupScores(participantNonWinner, [1, 2, 3, 4, 5]); // 0 matches -> null
  });

  after(async () => {
    // 1. Delete created draws (cascades to winners, draw_entries)
    if (createdDrawIds.length > 0) {
      await adminClient.from("winners").delete().in("draw_id", createdDrawIds);
      await adminClient.from("draw_entries").delete().in("draw_id", createdDrawIds);
      await adminClient.from("draws").delete().in("id", createdDrawIds);
    }

    // 2. Delete test users
    for (const uid of createdUserIds) {
      await adminClient.from("subscriptions").delete().eq("user_id", uid);
      await adminClient.from("golf_scores").delete().eq("user_id", uid);
      await adminClient.auth.admin.deleteUser(uid);
    }
  });

  // Helper to create and simulate a valid test draw
  async function createSimulatedDraw(title: string, drawnNumbers: number[] = [10, 20, 30, 40, 45]) {
    const drawRes = await DrawService.createDraw(adminClient, {
      title,
      draw_date: new Date().toISOString(),
      draw_mode: "random",
    });
    assert.ok(drawRes.data);
    const drawId = drawRes.data.id;
    createdDrawIds.push(drawId);

    const simRes = await DrawService.simulateDraw(adminClient, drawId, { drawnNumbers });
    assert.strictEqual(simRes.error, undefined);
    assert.ok(simRes.data);

    return { drawId, draw: simRes.data.draw };
  }

  // ==========================================================================
  // 1. AUTHORIZATION & SECURITY
  // ==========================================================================
  describe("1. Authorization Checks & RPC Security Invariants", () => {
    test("rejects publication if admin user ID is missing", async () => {
      const { drawId } = await createSimulatedDraw("Auth Test Missing Admin");

      const resMissing = await DrawService.publishDraw(authedAdminClient, drawId, "");
      assert.ok(resMissing.error);
      assert.match(resMissing.error, /admin user ID is required/i);
    });

    test("DIRECT RPC IMPERSONATION: authenticated non-admin calling with another admin's UUID is REJECTED", async () => {
      const { drawId } = await createSimulatedDraw("RPC Impersonation Test Draw");

      // 1. Non-admin calls RPC directly supplying valid admin's UUID
      const { data, error } = await authedNonAdminClient.rpc("publish_draw", {
        p_draw_id: drawId,
        p_admin_id: adminUserId,
      });

      // 2. The RPC MUST reject the request
      assert.ok(error, "Expected RPC to fail when non-admin impersonates admin");
      assert.match(error.message, /UNAUTHORIZED.*caller does not match admin ID/i);
      assert.strictEqual(data, null);

      // 3. The draw MUST remain simulated
      const { data: drawRecord } = await adminClient
        .from("draws")
        .select("status, published_at")
        .eq("id", drawId)
        .single();
      assert.strictEqual(drawRecord?.status, "simulated");
      assert.strictEqual(drawRecord?.published_at, null);

      // 4. No winner rows may be created
      const { data: winnerRows } = await adminClient
        .from("winners")
        .select("*")
        .eq("draw_id", drawId);
      assert.strictEqual(winnerRows?.length, 0);
    });

    test("DIRECT RPC: authenticated non-admin calling with their own UUID is REJECTED (non-admin role)", async () => {
      const { drawId } = await createSimulatedDraw("Non Admin Own UUID Test Draw");

      // Non-admin calls RPC supplying their own ID: caller matches, but role != 'admin'
      const { data, error } = await authedNonAdminClient.rpc("publish_draw", {
        p_draw_id: drawId,
        p_admin_id: nonAdminUserId,
      });

      assert.ok(error, "Expected RPC to reject non-admin role");
      assert.match(error.message, /UNAUTHORIZED.*not an active admin/i);
      assert.strictEqual(data, null);

      // Draw remains simulated, zero winners
      const { data: drawRecord } = await adminClient.from("draws").select("status").eq("id", drawId).single();
      assert.strictEqual(drawRecord?.status, "simulated");

      const { data: winners } = await adminClient.from("winners").select("*").eq("draw_id", drawId);
      assert.strictEqual(winners?.length, 0);
    });

    test("DIRECT RPC: authenticated admin caller with their own p_admin_id is ALLOWED", async () => {
      const { drawId } = await createSimulatedDraw("Auth Test Draw Valid Admin");

      const res = await DrawService.publishDraw(authedAdminClient, drawId, adminUserId);
      assert.strictEqual(res.error, undefined);
      assert.ok(res.data);
      assert.strictEqual(res.data.status, "published");
      assert.strictEqual(res.data.draw_id, drawId);
    });

    test("server action rejects unauthenticated caller", async () => {
      const res = await publishDrawAction("some-draw-id");
      assert.ok(res.error);
      assert.match(res.error, /Authentication required/i);
    });

    test("server action rejects missing drawId", async () => {
      const res = await publishDrawAction("");
      assert.ok(res.error);
      assert.match(res.error, /Draw ID is required/i);
    });
  });

  // ==========================================================================
  // 2. LIFECYCLE STATE ENFORCEMENT
  // ==========================================================================
  describe("2. Lifecycle State Transitions", () => {
    test("rejects draft -> published transition directly", async () => {
      const draftRes = await DrawService.createDraw(adminClient, {
        title: "Draft Direct Publish Test",
        draw_date: new Date().toISOString(),
        draw_mode: "random",
      });
      assert.ok(draftRes.data);
      createdDrawIds.push(draftRes.data.id);

      const res = await DrawService.publishDraw(authedAdminClient, draftRes.data.id, adminUserId);
      assert.ok(res.error);
      assert.match(res.error, /INVALID_STATUS.*expected 'simulated'/i);
    });

    test("rejects published -> published (already published)", async () => {
      const { drawId } = await createSimulatedDraw("Published Twice Test");

      const res1 = await DrawService.publishDraw(authedAdminClient, drawId, adminUserId);
      assert.strictEqual(res1.error, undefined);

      const res2 = await DrawService.publishDraw(authedAdminClient, drawId, adminUserId);
      assert.ok(res2.error);
      assert.match(res2.error, /INVALID_STATUS.*expected 'simulated'/i);
    });

    test("rejects completed -> published transition", async () => {
      const { drawId } = await createSimulatedDraw("Completed Publish Test");

      // Mark draw completed manually
      await adminClient.from("draws").update({ status: "completed" }).eq("id", drawId);

      const res = await DrawService.publishDraw(authedAdminClient, drawId, adminUserId);
      assert.ok(res.error);
      assert.match(res.error, /INVALID_STATUS.*expected 'simulated'/i);
    });
  });

  // ==========================================================================
  // 3. AUTHORITATIVE ROLLOVER VALIDATION & STALE REJECTION
  // ==========================================================================
  describe("3. Authoritative Rollover Validation", () => {
    test("publishes cleanly when simulation matches current authoritative rollover", async () => {
      const { drawId } = await createSimulatedDraw("Matching Rollover Test");

      const res = await DrawService.publishDraw(authedAdminClient, drawId, adminUserId);
      assert.strictEqual(res.error, undefined);
      assert.ok(res.data);
    });

    test("rejects publication as STALE when authoritative rollover changed after simulation", async () => {
      const { drawId } = await createSimulatedDraw("Stale Rollover Test Draw");

      // Artificially change the draw's rollover_jackpot_in to simulate a stale snapshot
      await adminClient
        .from("draws")
        .update({ rollover_jackpot_in: 99999.0 })
        .eq("id", drawId);

      const res = await DrawService.publishDraw(authedAdminClient, drawId, adminUserId);
      assert.ok(res.error);
      assert.match(res.error, /STALE_ROLLOVER/i);
    });
  });

  // ==========================================================================
  // 4. WINNERS PERSISTENCE & TIERS
  // ==========================================================================
  describe("4. Atomic Winner Creation", () => {
    test("creates winners for tier_5, tier_4, tier_3 with exact amounts and pending statuses", async () => {
      // Drawn numbers match participant scores:
      // participantT5 -> 5 matches -> tier_5
      // participantT4 -> 4 matches -> tier_4
      // participantT3 -> 3 matches -> tier_3
      // participantNonWinner -> 0 matches -> null
      const { drawId, draw } = await createSimulatedDraw("Winners Verification Draw", [10, 20, 30, 40, 45]);

      const res = await DrawService.publishDraw(authedAdminClient, drawId, adminUserId);
      assert.strictEqual(res.error, undefined);
      assert.ok(res.data);

      // Verify winners table
      const { data: winners, error: winErr } = await adminClient
        .from("winners")
        .select("*")
        .eq("draw_id", drawId);

      assert.ifError(winErr);
      assert.ok(winners);
      // Exactly 3 winners (Tier 5, Tier 4, Tier 3), 0 for non-winner
      assert.strictEqual(winners.length, 3);

      const w5 = winners.find((w) => w.user_id === participantT5);
      assert.ok(w5);
      assert.strictEqual(w5.tier, "tier_5");
      assert.strictEqual(w5.verification_status, "pending_submission");
      assert.strictEqual(w5.payment_status, "pending");
      assert.strictEqual(w5.prize_amount, draw.tier_5_pool);

      const w4 = winners.find((w) => w.user_id === participantT4);
      assert.ok(w4);
      assert.strictEqual(w4.tier, "tier_4");
      assert.strictEqual(w4.verification_status, "pending_submission");
      assert.strictEqual(w4.payment_status, "pending");
      assert.strictEqual(w4.prize_amount, draw.tier_4_pool);

      const w3 = winners.find((w) => w.user_id === participantT3);
      assert.ok(w3);
      assert.strictEqual(w3.tier, "tier_3");
      assert.strictEqual(w3.verification_status, "pending_submission");
      assert.strictEqual(w3.payment_status, "pending");
      assert.strictEqual(w3.prize_amount, draw.tier_3_pool);

      // Non-winning participant must NEVER produce a row in winners
      const wNone = winners.find((w) => w.user_id === participantNonWinner);
      assert.strictEqual(wNone, undefined);
    });

    test("zero tier 5 winners marks jackpot_rolled_over=true and rolls over full tier 5 pool", async () => {
      // Numbers [1, 2, 3, 4, 6] produces ZERO tier 5 winners (no participant has this exact set)
      const { drawId, draw } = await createSimulatedDraw("Zero Tier 5 Rollover Draw", [1, 2, 3, 4, 6]);

      const res = await DrawService.publishDraw(authedAdminClient, drawId, adminUserId);
      assert.strictEqual(res.error, undefined);
      assert.ok(res.data);

      assert.strictEqual(res.data.tier_5_winners, 0);
      assert.strictEqual(res.data.jackpot_rolled_over, true);
      assert.strictEqual(Number(res.data.rollover_jackpot_out), Number(draw.tier_5_pool));
    });
  });

  // ==========================================================================
  // 5. ACCOUNTING INVARIANTS & ATOMIC ROLLBACK
  // ==========================================================================
  describe("5. Accounting Invariants & Atomic Rollback", () => {
    test("corrupted prize pool sum is rejected and rolls back completely", async () => {
      const { drawId } = await createSimulatedDraw("Corrupted Pool Draw");

      // Corrupt tier pool sum so tier5 + tier4 + tier3 != total_prize_pool
      await adminClient
        .from("draws")
        .update({ tier_5_pool: 999999.0 })
        .eq("id", drawId);

      const res = await DrawService.publishDraw(authedAdminClient, drawId, adminUserId);
      assert.ok(res.error);
      assert.match(res.error, /ACCOUNTING_MISMATCH/i);

      // Verify ATOMICITY: No winners created, draw remains simulated
      const { data: draw } = await adminClient.from("draws").select("status").eq("id", drawId).single();
      assert.strictEqual(draw?.status, "simulated");

      const { data: winners } = await adminClient.from("winners").select("*").eq("draw_id", drawId);
      assert.strictEqual(winners?.length, 0);
    });

    test("non-winning entry with non-zero prize is rejected by accounting check", async () => {
      const { drawId } = await createSimulatedDraw("Corrupted Entry Draw");

      // Corrupt a non-winning entry to have prize_amount > 0
      const { data: entries } = await adminClient
        .from("draw_entries")
        .select("id")
        .eq("draw_id", drawId)
        .is("winning_tier", null)
        .limit(1);

      if (entries && entries.length > 0) {
        await adminClient
          .from("draw_entries")
          .update({ prize_amount: 50.0 })
          .eq("id", entries[0].id);

        const res = await DrawService.publishDraw(authedAdminClient, drawId, adminUserId);
        assert.ok(res.error);
        assert.match(res.error, /ACCOUNTING_MISMATCH.*non-winning/i);
      }
    });
  });

  // ==========================================================================
  // 6. IDEMPOTENCY & CONCURRENCY
  // ==========================================================================
  describe("6. Idempotency & Advisory Lock Concurrency", () => {
    test("idempotent publication: duplicate call is cleanly rejected without duplicate winners", async () => {
      const { drawId } = await createSimulatedDraw("Idempotency Draw");

      const first = await DrawService.publishDraw(authedAdminClient, drawId, adminUserId);
      assert.strictEqual(first.error, undefined);

      const second = await DrawService.publishDraw(authedAdminClient, drawId, adminUserId);
      assert.ok(second.error);
      assert.match(second.error, /INVALID_STATUS/i);

      // Verify no duplicate winners
      const { data: winners } = await adminClient.from("winners").select("id").eq("draw_id", drawId);
      const uniqueWinnerIds = new Set(winners?.map((w) => w.id));
      assert.strictEqual(winners?.length, uniqueWinnerIds.size);
    });

    test("competing draw publications: first updates authoritative rollover, second rejected as stale", async () => {
      // 1. Publish Draw 1 which rolls over a jackpot
      const { drawId: d1 } = await createSimulatedDraw("Competing Draw 1", [1, 2, 3, 4, 6]);
      const p1 = await DrawService.publishDraw(authedAdminClient, d1, adminUserId);
      assert.strictEqual(p1.error, undefined);
      assert.strictEqual(p1.data?.jackpot_rolled_over, true);
      const newAuthoritativeRollover = Number(p1.data?.rollover_jackpot_out);

      // 2. Draw 2 was simulated BEFORE Draw 1 published (so its rollover_in is 0)
      const { drawId: d2 } = await createSimulatedDraw("Competing Draw 2 With Stale Rollover", [10, 20, 30, 40, 45]);
      await adminClient.from("draws").update({ rollover_jackpot_in: 0.0 }).eq("id", d2);

      // Attempting to publish Draw 2 must fail because authoritative rollover is now newAuthoritativeRollover > 0
      if (newAuthoritativeRollover > 0) {
        const p2 = await DrawService.publishDraw(authedAdminClient, d2, adminUserId);
        assert.ok(p2.error);
        assert.match(p2.error, /STALE_ROLLOVER/i);
      }
    });
  });
});
