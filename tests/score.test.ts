import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ScoreService } from "../src/lib/services/score.service";
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

describe("Milestone 1C: Golf Score Management & PRD Rules Verification", () => {
  let adminClient: SupabaseClient<Database>;
  let clientA: SupabaseClient<Database>;
  let clientB: SupabaseClient<Database>;

  let userAId: string;
  let userBId: string;

  const emailA = `score_hero_a_${Date.now()}@gmail.com`;
  const emailB = `score_hero_b_${Date.now()}@gmail.com`;
  const password = "TestPassword123!";

  before(async () => {
    adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);

    // Create User A via Admin API (email confirmed, no SMTP rate limit)
    const { data: userAData, error: errA } =
      await adminClient.auth.admin.createUser({
        email: emailA,
        password,
        email_confirm: true,
        user_metadata: { full_name: "Hero Golfer Alpha" },
      });
    assert.ifError(errA);
    userAId = userAData.user.id;

    // Create User B via Admin API
    const { data: userBData, error: errB } =
      await adminClient.auth.admin.createUser({
        email: emailB,
        password,
        email_confirm: true,
        user_metadata: { full_name: "Hero Golfer Beta" },
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
    // Cleanup test users and cascade scores
    if (userAId) {
      await adminClient.auth.admin.deleteUser(userAId);
    }
    if (userBId) {
      await adminClient.auth.admin.deleteUser(userBId);
    }
  });

  // 1. Valid score 1 succeeds
  test("1. valid score 1 succeeds", async () => {
    const res = await ScoreService.addScore(clientA, userAId, {
      score: 1,
      playedDate: "2026-03-01",
    });

    assert.ifError(res.error);
    assert.ok(res.data);
    assert.strictEqual(res.data.score, 1);
    assert.strictEqual(res.data.played_date, "2026-03-01");
  });

  // 2. Valid score 45 succeeds
  test("2. valid score 45 succeeds", async () => {
    const res = await ScoreService.addScore(clientA, userAId, {
      score: 45,
      playedDate: "2026-03-02",
    });

    assert.ifError(res.error);
    assert.ok(res.data);
    assert.strictEqual(res.data.score, 45);
    assert.strictEqual(res.data.played_date, "2026-03-02");
  });

  // 3. Score 0 fails
  test("3. score 0 fails", async () => {
    const res = await ScoreService.addScore(clientA, userAId, {
      score: 0,
      playedDate: "2026-03-03",
    });

    assert.ok(res.error);
    assert.ok(res.error.includes("Score must be at least 1"));
  });

  // 4. Score 46 fails
  test("4. score 46 fails", async () => {
    const res = await ScoreService.addScore(clientA, userAId, {
      score: 46,
      playedDate: "2026-03-04",
    });

    assert.ok(res.error);
    assert.ok(res.error.includes("Score cannot exceed 45"));
  });

  // 5. Duplicate user + played_date is rejected
  test("5. duplicate user + played_date is rejected/handled correctly", async () => {
    // Attempt to add score on 2026-03-01 which was already added in test 1
    const res = await ScoreService.addScore(clientA, userAId, {
      score: 30,
      playedDate: "2026-03-01",
    });

    assert.ok(res.error);
    assert.ok(
      res.error.includes("Only one score entry is permitted per date"),
      `Expected duplicate error, got: ${res.error}`
    );
  });

  // 6. Fewer than 5 scores are all retained
  test("6. fewer than 5 scores are all retained", async () => {
    // Add a 3rd score
    await ScoreService.addScore(clientA, userAId, {
      score: 36,
      playedDate: "2026-03-05",
    });

    const { data: scores } = await ScoreService.getUserScores(clientA, userAId);
    assert.ok(scores);
    assert.strictEqual(scores.length, 3, "All 3 scores should be retained");
  });

  // 7. Adding a 6th newer score removes the oldest score
  test("7. adding a 6th newer score removes the oldest score", async () => {
    // User A currently has scores on: 2026-03-01, 2026-03-02, 2026-03-05
    // Add 4th score:
    await ScoreService.addScore(clientA, userAId, {
      score: 38,
      playedDate: "2026-03-06",
    });
    // Add 5th score:
    await ScoreService.addScore(clientA, userAId, {
      score: 40,
      playedDate: "2026-03-07",
    });

    // Verify exactly 5 scores retained
    const beforeSixth = await ScoreService.getUserScores(clientA, userAId);
    assert.strictEqual(beforeSixth.data?.length, 5);
    const oldestBefore = beforeSixth.data?.[beforeSixth.data.length - 1];
    assert.strictEqual(oldestBefore?.played_date, "2026-03-01");

    // Add 6th newer score: 2026-03-10
    const addSixth = await ScoreService.addScore(clientA, userAId, {
      score: 42,
      playedDate: "2026-03-10",
    });
    assert.ifError(addSixth.error);

    const afterSixth = await ScoreService.getUserScores(clientA, userAId);
    assert.ok(afterSixth.data);
    assert.strictEqual(
      afterSixth.data.length,
      5,
      "Only 5 scores should be retained"
    );

    // Oldest score (2026-03-01) must have been removed
    const has20260301 = afterSixth.data.some(
      (s) => s.played_date === "2026-03-01"
    );
    assert.strictEqual(has20260301, false, "Oldest score (2026-03-01) should be pruned");

    // Newest score (2026-03-10) must be present
    const has20260310 = afterSixth.data.some(
      (s) => s.played_date === "2026-03-10"
    );
    assert.strictEqual(has20260310, true, "Newest score (2026-03-10) must be retained");
  });

  // 8. Scores are ordered by played_date descending
  test("8. scores are ordered by played_date descending", async () => {
    const { data: scores } = await ScoreService.getUserScores(clientA, userAId);
    assert.ok(scores);
    assert.strictEqual(scores.length, 5);

    for (let i = 0; i < scores.length - 1; i++) {
      assert.ok(
        scores[i].played_date > scores[i + 1].played_date,
        `Score at index ${i} (${scores[i].played_date}) should be newer than index ${i + 1} (${scores[i + 1].played_date})`
      );
    }
  });

  // 9. Inserting an old played_date later does NOT displace newer retained scores
  test("9. inserting an old played_date later does NOT displace newer retained scores", async () => {
    const beforeOld = await ScoreService.getUserScores(clientA, userAId);
    assert.ok(beforeOld.data);
    const expectedDates = beforeOld.data.map((s) => s.played_date);

    // Insert a much older date: 2026-01-10 (older than all 5 retained scores)
    await ScoreService.addScore(clientA, userAId, {
      score: 35,
      playedDate: "2026-01-10",
    });

    const afterOld = await ScoreService.getUserScores(clientA, userAId);
    assert.ok(afterOld.data);
    assert.strictEqual(afterOld.data.length, 5);

    const resultingDates = afterOld.data.map((s) => s.played_date);

    // The 5 newer retained scores must remain completely intact
    assert.deepStrictEqual(
      resultingDates,
      expectedDates,
      "The 5 newer scores must not be displaced by an older date"
    );
  });

  // 10. Editing a score works
  test("10. editing a score works", async () => {
    const { data: scores } = await ScoreService.getUserScores(clientA, userAId);
    assert.ok(scores && scores.length > 0);
    const targetScore = scores[0];

    const res = await ScoreService.updateScore(clientA, userAId, {
      scoreId: targetScore.id,
      score: 44,
    });

    assert.ifError(res.error);
    assert.strictEqual(res.data?.score, 44);

    const refreshed = await ScoreService.getUserScores(clientA, userAId);
    const updated = refreshed.data?.find((s) => s.id === targetScore.id);
    assert.strictEqual(updated?.score, 44);
  });

  // 11. Deleting a score works
  test("11. deleting a score works", async () => {
    const { data: scores } = await ScoreService.getUserScores(clientA, userAId);
    assert.ok(scores && scores.length > 0);
    const scoreToDelete = scores[scores.length - 1]; // delete oldest

    const res = await ScoreService.deleteScore(
      clientA,
      userAId,
      scoreToDelete.id
    );
    assert.ifError(res.error);
    assert.strictEqual(res.data, true);

    const refreshed = await ScoreService.getUserScores(clientA, userAId);
    assert.strictEqual(refreshed.data?.length, 4);
    assert.ok(!refreshed.data.some((s) => s.id === scoreToDelete.id));
  });

  // 12. Users cannot access another user's scores (RLS / ownership enforcement)
  test("12. users cannot access another user's scores", async () => {
    // Client B attempts to query User A's scores
    const { data: bViewingA } = await clientB
      .from("golf_scores")
      .select("*")
      .eq("user_id", userAId);

    // Under RLS, Client B receives an empty array
    assert.ok(bViewingA);
    assert.strictEqual(
      bViewingA.length,
      0,
      "User B must not be able to view User A's scores under RLS"
    );

    // Client B attempts to delete User A's remaining score
    const { data: aScores } = await ScoreService.getUserScores(clientA, userAId);
    assert.ok(aScores && aScores.length > 0);
    const aScoreId = aScores[0].id;

    // Delete attempt by User B
    await ScoreService.deleteScore(clientB, userBId, aScoreId);

    // Verify User A's score is still intact
    const verifyStillExists = await clientA
      .from("golf_scores")
      .select("id")
      .eq("id", aScoreId)
      .single();

    assert.ok(
      verifyStillExists.data,
      "User A's score must not be deletable by User B"
    );
  });
});
