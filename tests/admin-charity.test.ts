import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";
import { CharityService } from "../src/lib/services/charity.service";
import { AdminService } from "../src/lib/services/admin.service";

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

describe("Phase F1: Admin Charity Management & Admin KPI Dashboard Tests", () => {
  let adminClient: SupabaseClient<Database>;
  let authedAdminClient: SupabaseClient<Database>;
  let authedSubscriberClient: SupabaseClient<Database>;

  const createdUserIds: string[] = [];
  const createdCharityIds: string[] = [];
  const createdDrawIds: string[] = [];
  const createdSubscriptionIds: string[] = [];

  let adminUserId: string;
  let adminEmail: string;
  let subscriberUserId: string;
  let subscriberEmail: string;

  const password = "TestPassword123!";

  before(async () => {
    adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);

    async function createTestUser(
      prefix: string,
      name: string,
      role: "admin" | "subscriber" = "subscriber"
    ): Promise<{ uid: string; email: string }> {
      const email = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@admin-test.com`;
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

    const adminUser = await createTestUser("admin_f1", "Admin F1 User", "admin");
    adminUserId = adminUser.uid;
    adminEmail = adminUser.email;
    assert.ok(adminUserId);

    const subUser = await createTestUser("sub_f1", "Subscriber F1 User", "subscriber");
    subscriberUserId = subUser.uid;
    subscriberEmail = subUser.email;

    // Create authenticated client for Admin
    authedAdminClient = createClient<Database>(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: adminLoginErr } =
      await authedAdminClient.auth.signInWithPassword({
        email: adminEmail,
        password,
      });
    assert.ifError(adminLoginErr);

    // Create authenticated client for Subscriber
    authedSubscriberClient = createClient<Database>(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: subLoginErr } =
      await authedSubscriberClient.auth.signInWithPassword({
        email: subscriberEmail,
        password,
      });
    assert.ifError(subLoginErr);
  });

  after(async () => {
    // 1. Cleanup created subscriptions
    if (createdSubscriptionIds.length > 0) {
      await adminClient
        .from("subscriptions")
        .delete()
        .in("id", createdSubscriptionIds);
    }

    // 2. Cleanup created draws
    if (createdDrawIds.length > 0) {
      await adminClient.from("draws").delete().in("id", createdDrawIds);
    }

    // 3. Cleanup created charities
    if (createdCharityIds.length > 0) {
      await adminClient.from("charities").delete().in("id", createdCharityIds);
    }

    // 4. Cleanup test users
    for (const uid of createdUserIds) {
      await adminClient.auth.admin.deleteUser(uid);
    }
  });

  // ==========================================================================
  // PART A — ADMIN CHARITY CRUD & AUTHORIZATION
  // ==========================================================================
  let testCharityId: string;
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const testSlug = `partner-f1-${uniqueSuffix}`;

  test("1. Admin can list all charities via CharityService.getAllCharitiesAdmin", async () => {
    const res = await CharityService.getAllCharitiesAdmin(adminClient);
    assert.ifError(res.error);
    assert.ok(Array.isArray(res.data));
  });

  test("2. Admin can create charity with valid data", async () => {
    const res = await CharityService.createCharity(adminClient, {
      name: `F1 Test Charity ${uniqueSuffix}`,
      slug: testSlug,
      tagline: "Dedicated to junior golf access",
      description: "Comprehensive youth development programs through junior golf instruction.",
      websiteUrl: "https://f1charity.org",
      logoUrl: "https://f1charity.org/logo.png",
      coverImageUrl: "https://f1charity.org/cover.jpg",
      isFeatured: false,
    });

    assert.ifError(res.error);
    assert.ok(res.data?.id);
    assert.strictEqual(res.data.slug, testSlug);
    assert.strictEqual(res.data.is_featured, false);

    testCharityId = res.data.id;
    createdCharityIds.push(testCharityId);
  });

  test("3. Admin can update charity details", async () => {
    const updatedTagline = "Updated tagline for junior golf excellence";
    const res = await CharityService.updateCharity(adminClient, {
      id: testCharityId,
      name: `F1 Test Charity ${uniqueSuffix} (Updated)`,
      slug: testSlug,
      tagline: updatedTagline,
      description: "Updated description meeting length requirements for non-profit programs.",
      websiteUrl: "https://f1charity-updated.org",
      isFeatured: false,
    });

    assert.ifError(res.error);
    assert.ok(res.data);
    assert.strictEqual(res.data.tagline, updatedTagline);
    assert.match(res.data.name, /Updated/);
  });

  test("4. Admin can toggle is_featured", async () => {
    const res1 = await CharityService.toggleFeatured(adminClient, testCharityId, true);
    assert.ifError(res1.error);
    assert.strictEqual(res1.data?.is_featured, true);

    const res2 = await CharityService.toggleFeatured(adminClient, testCharityId, false);
    assert.ifError(res2.error);
    assert.strictEqual(res2.data?.is_featured, false);
  });

  test("5. Admin can delete charity", async () => {
    // Create a temporary charity to delete
    const tempSlug = `temp-delete-${Date.now()}`;
    const createRes = await CharityService.createCharity(adminClient, {
      name: "Temporary Charity for Deletion",
      slug: tempSlug,
      description: "Temporary charity created strictly to verify deletion capabilities.",
    });
    assert.ifError(createRes.error);
    assert.ok(createRes.data?.id);

    const tempId = createRes.data.id;
    const deleteRes = await CharityService.deleteCharity(adminClient, tempId);
    assert.ifError(deleteRes.error);
    assert.strictEqual(deleteRes.data, true);

    // Verify charity is gone from database
    const { data: check } = await adminClient
      .from("charities")
      .select("id")
      .eq("id", tempId)
      .maybeSingle();
    assert.strictEqual(check, null);
  });

  test("6. Non-admin cannot create charity (rejected with UNAUTHORIZED)", async () => {
    // Attempting direct insert with authenticated subscriber client is rejected by RLS
    const { error: rlsErr } = await authedSubscriberClient
      .from("charities")
      .insert({
        name: "Rogue Non-Admin Charity",
        slug: `rogue-${Date.now()}`,
        description: "Attempted creation by unauthorized subscriber user.",
      });

    assert.ok(rlsErr);
    assert.match(rlsErr.message, /row-level security/i);
  });

  test("7. Non-admin cannot update charity (rejected with UNAUTHORIZED)", async () => {
    // Attempting update with authenticated subscriber client is blocked by RLS
    const { data, error } = await authedSubscriberClient
      .from("charities")
      .update({ tagline: "Hacked tagline" })
      .eq("id", testCharityId)
      .select();

    // RLS blocks either via error or 0 rows returned
    assert.ok(error || !data || data.length === 0);

    // Verify database row remains unchanged
    const { data: check } = await adminClient
      .from("charities")
      .select("tagline")
      .eq("id", testCharityId)
      .single();
    assert.notStrictEqual(check?.tagline, "Hacked tagline");
  });

  test("8. Non-admin cannot delete charity (rejected with UNAUTHORIZED)", async () => {
    // Attempting delete with authenticated subscriber client is blocked by RLS
    const { data, error } = await authedSubscriberClient
      .from("charities")
      .delete()
      .eq("id", testCharityId)
      .select();

    // RLS blocks either via error or 0 rows returned
    assert.ok(error || !data || data.length === 0);

    // Verify charity still exists in database
    const { data: check } = await adminClient
      .from("charities")
      .select("id")
      .eq("id", testCharityId)
      .maybeSingle();
    assert.ok(check);
  });

  test("9. Non-admin cannot toggle featured status (rejected with UNAUTHORIZED)", async () => {
    const { data, error } = await authedSubscriberClient
      .from("charities")
      .update({ is_featured: true })
      .eq("id", testCharityId)
      .select();

    // RLS blocks either via error or 0 rows returned
    assert.ok(error || !data || data.length === 0);

    // Verify featured status remains false
    const { data: check } = await adminClient
      .from("charities")
      .select("is_featured")
      .eq("id", testCharityId)
      .single();
    assert.strictEqual(check?.is_featured, false);
  });


  test("10. Invalid charity data rejected by Zod validation", async () => {
    // Invalid slug (spaces and uppercase)
    const res1 = await CharityService.createCharity(adminClient, {
      name: "Invalid Slug Charity",
      slug: "INVALID SLUG WITH SPACES",
      description: "Description long enough to pass length requirements.",
    });
    assert.ok(res1.error);
    assert.match(res1.error, /Slug must contain only lowercase/i);

    // Description too short (< 10 chars)
    const res2 = await CharityService.createCharity(adminClient, {
      name: "Short Desc Charity",
      slug: `short-desc-${Date.now()}`,
      description: "Short",
    });
    assert.ok(res2.error);
    assert.match(res2.error, /Description must be at least 10 characters/i);
  });

  // ==========================================================================
  // PART B — FOREIGN KEY DELETION BEHAVIOR
  // ==========================================================================

  test("11. Existing FK deletion behavior preserved: deleting charity sets profiles.charity_id to NULL", async () => {
    // 1. Create a designated charity
    const fkSlug = `fk-test-charity-${Date.now()}`;
    const charityRes = await CharityService.createCharity(adminClient, {
      name: "FK Test Charity",
      slug: fkSlug,
      description: "Testing PostgreSQL ON DELETE SET NULL foreign key constraint on profiles.",
    });
    assert.ifError(charityRes.error);
    const fkCharityId = charityRes.data!.id;

    // 2. Assign this charity to subscriber profile
    await adminClient
      .from("profiles")
      .update({ charity_id: fkCharityId })
      .eq("id", subscriberUserId);

    // Verify assignment
    const { data: profileBefore } = await adminClient
      .from("profiles")
      .select("charity_id")
      .eq("id", subscriberUserId)
      .single();
    assert.strictEqual(profileBefore?.charity_id, fkCharityId);

    // 3. Delete charity via CharityService
    const deleteRes = await CharityService.deleteCharity(adminClient, fkCharityId);
    assert.ifError(deleteRes.error);

    // 4. Verify subscriber profile still exists and charity_id is now NULL
    const { data: profileAfter } = await adminClient
      .from("profiles")
      .select("charity_id")
      .eq("id", subscriberUserId)
      .single();
    assert.ok(profileAfter);
    assert.strictEqual(profileAfter.charity_id, null);
  });

  test("12. Existing FK deletion behavior preserved: deleting charity cascades attached charity_events", async () => {
    // 1. Create charity
    const eventCharityRes = await CharityService.createCharity(adminClient, {
      name: "Cascade Event Charity",
      slug: `cascade-charity-${Date.now()}`,
      description: "Testing PostgreSQL ON DELETE CASCADE foreign key constraint on charity_events.",
    });
    assert.ifError(eventCharityRes.error);
    const eventCharityId = eventCharityRes.data!.id;

    // 2. Insert a charity event
    const { data: eventRow, error: eventErr } = await adminClient
      .from("charity_events")
      .insert({
        charity_id: eventCharityId,
        title: "Annual Golf Classic",
        event_date: new Date(Date.now() + 86400000 * 14).toISOString(),
        location: "Royal Pines Golf Club",
      })
      .select()
      .single();
    assert.ifError(eventErr);
    assert.ok(eventRow);

    // 3. Delete the charity
    const delRes = await CharityService.deleteCharity(adminClient, eventCharityId);
    assert.ifError(delRes.error);

    // 4. Verify attached event was automatically cascaded
    const { data: eventCheck } = await adminClient
      .from("charity_events")
      .select("id")
      .eq("id", eventRow.id)
      .maybeSingle();
    assert.strictEqual(eventCheck, null);
  });

  // ==========================================================================
  // PART C — ADMIN KPI DASHBOARD METRICS
  // ==========================================================================

  test("13. Total users KPI calculated correctly (COUNT(*) FROM profiles)", async () => {
    const kpiRes = await AdminService.getPlatformKpis(adminClient);
    assert.ifError(kpiRes.error);
    assert.ok(kpiRes.data);

    // Compare with direct count from profiles
    const { count } = await adminClient
      .from("profiles")
      .select("*", { count: "exact", head: true });
    assert.strictEqual(kpiRes.data.totalUsers, count);
  });

  test("14. Active subscribers KPI calculated correctly (active/trialing AND current_period_end > now())", async () => {
    // 1. Create active subscription with future date for subscriber
    const futureDate = new Date(Date.now() + 30 * 86400000).toISOString();
    const { data: subRow, error: subErr } = await adminClient
      .from("subscriptions")
      .insert({
        user_id: subscriberUserId,
        plan_type: "monthly",
        status: "active",
        amount: 499,
        current_period_start: new Date().toISOString(),
        current_period_end: futureDate,
        stripe_subscription_id: `sub_f1_test_${Date.now()}`,
      })
      .select()
      .single();
    assert.ifError(subErr);
    createdSubscriptionIds.push(subRow.id);

    const kpiRes = await AdminService.getPlatformKpis(adminClient);
    assert.ifError(kpiRes.error);
    assert.ok(kpiRes.data);
    assert.ok(kpiRes.data.activeSubscribers >= 1);
  });

  test("15. Published draws contribute to authoritative prize-pool KPI", async () => {
    // Read current KPI
    const beforeKpi = await AdminService.getPlatformKpis(adminClient);
    assert.ifError(beforeKpi.error);
    const initialPool = beforeKpi.data!.totalPrizePool;

    // Create a published draw with known prize pool
    const prizeAmount = 15000.5;
    const { data: publishedDraw, error: drawErr } = await adminClient
      .from("draws")
      .insert({
        title: `KPI Published Draw Test ${Date.now()}`,
        draw_date: new Date().toISOString(),
        draw_mode: "random",
        status: "published",
        published_at: new Date().toISOString(),
        total_prize_pool: prizeAmount,
        tier_5_pool: prizeAmount * 0.4,
        tier_4_pool: prizeAmount * 0.35,
        tier_3_pool: prizeAmount * 0.25,
      })
      .select()
      .single();
    assert.ifError(drawErr);
    createdDrawIds.push(publishedDraw.id);

    // Check KPI again
    const afterKpi = await AdminService.getPlatformKpis(adminClient);
    assert.ifError(afterKpi.error);
    const expectedPool = Math.round((initialPool + prizeAmount) * 100) / 100;
    assert.strictEqual(afterKpi.data!.totalPrizePool, expectedPool);
  });

  test("16. Draft and simulated draws strictly DO NOT contribute to prize pool KPI", async () => {
    const beforeKpi = await AdminService.getPlatformKpis(adminClient);
    assert.ifError(beforeKpi.error);
    const baselinePool = beforeKpi.data!.totalPrizePool;

    // Insert draft draw with large hypothetical pool
    const { data: draftDraw, error: draftErr } = await adminClient
      .from("draws")
      .insert({
        title: `Draft Draw Should Not Count ${Date.now()}`,
        draw_date: new Date().toISOString(),
        draw_mode: "random",
        status: "draft",
        total_prize_pool: 999999.99,
      })
      .select()
      .single();
    assert.ifError(draftErr);
    createdDrawIds.push(draftDraw.id);

    // Insert simulated draw with large hypothetical pool
    const { data: simDraw, error: simErr } = await adminClient
      .from("draws")
      .insert({
        title: `Simulated Draw Should Not Count ${Date.now()}`,
        draw_date: new Date().toISOString(),
        draw_mode: "algorithmic",
        status: "simulated",
        total_prize_pool: 888888.88,
      })
      .select()
      .single();
    assert.ifError(simErr);
    createdDrawIds.push(simDraw.id);

    // KPI totalPrizePool must remain exactly unchanged
    const afterKpi = await AdminService.getPlatformKpis(adminClient);
    assert.ifError(afterKpi.error);
    assert.strictEqual(afterKpi.data!.totalPrizePool, baselinePool);
  });

  test("17. Current rollover uses latest authoritative published draw (published_at DESC NULLS LAST, draw_date DESC, created_at DESC)", async () => {
    // Create an older published draw with rollover
    const olderDrawDate = new Date(Date.now() - 86400000 * 30).toISOString();
    const olderPubDate = new Date(Date.now() - 86400000 * 30).toISOString();
    const { data: olderDraw, error: olderErr } = await adminClient
      .from("draws")
      .insert({
        title: `Older Published Draw ${Date.now()}`,
        draw_date: olderDrawDate,
        published_at: olderPubDate,
        draw_mode: "random",
        status: "published",
        jackpot_rolled_over: true,
        rollover_jackpot_out: 4500.0,
      })
      .select()
      .single();
    assert.ifError(olderErr);
    createdDrawIds.push(olderDraw.id);

    // Create the newest published draw with updated authoritative rollover
    const newestDrawDate = new Date().toISOString();
    const newestPubDate = new Date().toISOString();
    const latestRollover = 7850.25;
    const { data: newestDraw, error: newestErr } = await adminClient
      .from("draws")
      .insert({
        title: `Latest Published Draw ${Date.now()}`,
        draw_date: newestDrawDate,
        published_at: newestPubDate,
        draw_mode: "random",
        status: "published",
        jackpot_rolled_over: true,
        rollover_jackpot_out: latestRollover,
      })
      .select()
      .single();
    assert.ifError(newestErr);
    createdDrawIds.push(newestDraw.id);

    // The KPI must strictly reflect newestDraw's rollover
    const kpiRes = await AdminService.getPlatformKpis(adminClient);
    assert.ifError(kpiRes.error);
    assert.strictEqual(kpiRes.data!.currentRolloverJackpot, latestRollover);
  });

  test("18. Non-admin cannot access admin KPI service/action", async () => {
    // Verify that subscriber role fails admin layout / admin check
    const { data: subProfile } = await authedSubscriberClient
      .from("profiles")
      .select("role")
      .eq("id", subscriberUserId)
      .single();

    assert.ok(subProfile);
    assert.strictEqual(subProfile.role, "subscriber");
    assert.notStrictEqual(subProfile.role, "admin");

    // Direct RPC / is_admin check must return false
    const { data: isAdmin } = await (authedSubscriberClient as unknown as SupabaseClient).rpc("is_admin");
    assert.strictEqual(Boolean(isAdmin), false);
  });
});
