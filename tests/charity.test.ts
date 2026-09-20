import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CharityService, type Charity } from "../src/lib/services/charity.service";
import type { Database } from "../src/types/database.types";

const envContent = fs.readFileSync(".env.local", "utf-8");
const env = Object.fromEntries(
  envContent
    .split("\n")
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY!;

describe("Milestone 1D: Charity Directory, Profiles, and Selection Tests", () => {
  let adminClient: SupabaseClient<Database>;
  let clientA: SupabaseClient<Database>;
  let clientB: SupabaseClient<Database>;
  let anonClient: SupabaseClient<Database>;

  let userAId: string;
  let userBId: string;
  let availableCharities: Charity[] = [];

  const emailA = `charity_hero_a_${Date.now()}@gmail.com`;
  const emailB = `charity_hero_b_${Date.now()}@gmail.com`;
  const password = "TestPassword123!";

  before(async () => {
    adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);
    anonClient = createClient<Database>(supabaseUrl, supabaseAnonKey);

    // Create User A
    const { data: userAData, error: errA } =
      await adminClient.auth.admin.createUser({
        email: emailA,
        password,
        email_confirm: true,
        user_metadata: { full_name: "Hero Charity Donor Alpha" },
      });
    assert.ifError(errA);
    userAId = userAData.user.id;

    // Create User B
    const { data: userBData, error: errB } =
      await adminClient.auth.admin.createUser({
        email: emailB,
        password,
        email_confirm: true,
        user_metadata: { full_name: "Hero Charity Donor Beta" },
      });
    assert.ifError(errB);
    userBId = userBData.user.id;

    // Authenticate Client A
    clientA = createClient<Database>(supabaseUrl, supabaseAnonKey);
    const { error: signInErrA } = await clientA.auth.signInWithPassword({
      email: emailA,
      password,
    });
    assert.ifError(signInErrA);

    // Authenticate Client B
    clientB = createClient<Database>(supabaseUrl, supabaseAnonKey);
    const { error: signInErrB } = await clientB.auth.signInWithPassword({
      email: emailB,
      password,
    });
    assert.ifError(signInErrB);
  });

  after(async () => {
    if (userAId) {
      await adminClient.auth.admin.deleteUser(userAId);
    }
    if (userBId) {
      await adminClient.auth.admin.deleteUser(userBId);
    }
  });

  // 1. Public charity retrieval
  test("1. public charity retrieval returns available charities without authentication", async () => {
    const res = await CharityService.getCharities(anonClient);
    assert.ifError(res.error);
    assert.ok(res.data);
    assert.ok(res.data.length >= 4, "Should retrieve at least 4 seeded charities");

    availableCharities = res.data;
    const first = res.data[0];
    assert.ok(first.name);
    assert.ok(first.slug);
    assert.ok(first.description);
    assert.ok(typeof first.total_funds_raised === "number");
  });

  // 2. Charity search/filter behavior
  test("2. charity search and filter behavior correctly isolates matches", async () => {
    // Search query for "Clean Waters"
    const searchRes = await CharityService.getCharities(anonClient, {
      search: "Clean Waters",
    });
    assert.ifError(searchRes.error);
    assert.ok(searchRes.data);
    assert.strictEqual(searchRes.data.length, 1);
    assert.strictEqual(searchRes.data[0].slug, "clean-waters-global");

    // Filter query for featured charities only
    const featuredRes = await CharityService.getCharities(anonClient, {
      featuredOnly: true,
    });
    assert.ifError(featuredRes.error);
    assert.ok(featuredRes.data);
    assert.ok(featuredRes.data.length >= 1);
    for (const c of featuredRes.data) {
      assert.strictEqual(c.is_featured, true);
    }
  });

  // 3. Charity detail retrieval
  test("3. charity detail retrieval by slug includes upcoming events", async () => {
    const slug = "nextgen-youth-sports";
    const res = await CharityService.getCharityBySlug(anonClient, slug);

    assert.ifError(res.error);
    assert.ok(res.data);
    assert.strictEqual(res.data.charity.slug, slug);
    assert.ok(res.data.events.length >= 1, "Should retrieve upcoming events for charity");

    const event = res.data.events[0];
    assert.strictEqual(event.charity_id, res.data.charity.id);
    assert.ok(event.title);
    assert.ok(event.event_date);
  });

  test("3b. charity detail returns clean error on unknown slug", async () => {
    const res = await CharityService.getCharityBySlug(anonClient, "non-existent-cause-slug");
    assert.ok(res.error);
    assert.strictEqual(res.error, "Charity not found");
  });

  // 4. Contribution below 10% is rejected
  test("4. contribution below 10% is rejected", async () => {
    const targetCharity = availableCharities[0];
    assert.ok(targetCharity);

    const res = await CharityService.updateSubscriberCharity(
      adminClient,
      userAId,
      {
        charityId: targetCharity.id,
        charityContributionPct: 9, // Below 10% minimum
      }
    );

    assert.ok(res.error);
    assert.ok(
      res.error.includes("Charity contribution must be at least 10%"),
      `Expected error about 10% minimum, got: ${res.error}`
    );
  });

  // 5. Contribution at 10% succeeds
  test("5. contribution at 10% succeeds", async () => {
    const targetCharity = availableCharities[0];
    assert.ok(targetCharity);

    const res = await CharityService.updateSubscriberCharity(
      adminClient,
      userAId,
      {
        charityId: targetCharity.id,
        charityContributionPct: 10,
      }
    );

    assert.ifError(res.error);
    assert.ok(res.data);
    assert.strictEqual(res.data.charity_id, targetCharity.id);
    assert.strictEqual(res.data.charity_contribution_pct, 10);
  });

  // 6. Contribution at 100% succeeds
  test("6. contribution at 100% succeeds", async () => {
    const targetCharity = availableCharities[1];
    assert.ok(targetCharity);

    const res = await CharityService.updateSubscriberCharity(
      adminClient,
      userAId,
      {
        charityId: targetCharity.id,
        charityContributionPct: 100,
      }
    );

    assert.ifError(res.error);
    assert.ok(res.data);
    assert.strictEqual(res.data.charity_id, targetCharity.id);
    assert.strictEqual(res.data.charity_contribution_pct, 100);
  });

  // 7. Authenticated user can select/update their own charity
  test("7. authenticated user can select and update their own charity", async () => {
    const targetCharity = availableCharities[2];
    assert.ok(targetCharity);

    const res = await CharityService.updateSubscriberCharity(
      adminClient,
      userAId,
      {
        charityId: targetCharity.id,
        charityContributionPct: 25,
      }
    );

    assert.ifError(res.error);
    assert.strictEqual(res.data?.charity_id, targetCharity.id);
    assert.strictEqual(res.data?.charity_contribution_pct, 25);

    // Verify stored in profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("charity_id, charity_contribution_pct")
      .eq("id", userAId)
      .single();

    assert.strictEqual(profile?.charity_id, targetCharity.id);
    assert.strictEqual(Number(profile?.charity_contribution_pct), 25);
  });

  // 8. User cannot update another user's profile/charity selection
  test("8. user cannot update another user's profile/charity selection", async () => {
    const targetCharity = availableCharities[3];

    // Client B attempts to directly update User A's profile row
    const { data } = await clientB
      .from("profiles")
      .update({
        charity_id: targetCharity.id,
        charity_contribution_pct: 50,
      })
      .eq("id", userAId)
      .select();

    // Under RLS (no user update policy), client-side update returns 0 rows updated
    assert.strictEqual(
      data?.length ?? 0,
      0,
      "Client B must not be able to update User A's profile"
    );

    // Verify User A's profile was not modified by User B
    const { data: profileA } = await adminClient
      .from("profiles")
      .select("charity_id, charity_contribution_pct")
      .eq("id", userAId)
      .single();

    assert.notStrictEqual(profileA?.charity_id, targetCharity.id);
    assert.strictEqual(Number(profileA?.charity_contribution_pct), 25);
  });

  // 9. Subscriber role cannot be changed through the user-facing flow
  test("9. subscriber role cannot be changed through the user-facing flow", async () => {
    // Attempt to inject role = 'admin' into the update payload
    const maliciousPayload = {
      charityId: availableCharities[0].id,
      charityContributionPct: 20,
      role: "admin", // Malicious role injection attempt
    };

    const res = await CharityService.updateSubscriberCharity(
      adminClient,
      userAId,
      maliciousPayload
    );

    assert.ifError(res.error);

    // Verify User A's role remains strictly 'subscriber'
    const { data: profileA } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", userAId)
      .single();

    assert.strictEqual(
      profileA?.role,
      "subscriber",
      "User role must remain 'subscriber' and cannot be escalated via charity updates"
    );
  });
});
