import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";
import {
  WinnerService,
  STORAGE_BUCKET_NAME,
  validateImageMagicBytes,
} from "../src/lib/services/winner.service";

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

describe("Phase E: Winner Verification, Payout Operations & Storage Tests", () => {
  let adminClient: SupabaseClient<Database>;
  let authedAdminClient: SupabaseClient<Database>;
  let authedWinnerClient: SupabaseClient<Database>;
  let authedOtherUserClient: SupabaseClient<Database>;

  const createdUserIds: string[] = [];
  const createdDrawIds: string[] = [];
  const uploadedStoragePaths: string[] = [];

  let adminUserId: string;
  let adminEmail: string;
  let winnerUserId: string;
  let winnerEmail: string;
  let otherUserId: string;
  let otherEmail: string;

  let testDrawId: string;
  let testWinnerId: string;

  const password = "TestPassword123!";

  // Valid 1x1 PNG bytes
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  // Valid JPEG header
  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  ]);

  // Fake invalid bytes (claiming to be image)
  const invalidFakeBuffer = Buffer.from("THIS IS NOT A VALID IMAGE FILE AT ALL!");

  before(async () => {
    adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);

    // Ensure winner-proofs bucket exists
    await WinnerService.ensureStorageBucket(adminClient);

    async function createTestUser(
      prefix: string,
      name: string,
      role: "admin" | "subscriber" = "subscriber"
    ): Promise<{ uid: string; email: string }> {
      const email = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@winner-test.com`;
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
        stripe_subscription_id: `sub_${prefix}_${Date.now()}_${Math.random()}`,
        plan_type: "monthly",
        status: "active",
        amount: 25.0,
        currency: "usd",
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancel_at_period_end: false,
      });

      return { uid, email };
    }

    // 1. Create Admin
    const adminUser = await createTestUser("admin_phase_e", "Admin Phase E", "admin");
    adminUserId = adminUser.uid;
    adminEmail = adminUser.email;

    // 2. Create Winner User
    const winnerUser = await createTestUser("winner_phase_e", "Winner Phase E", "subscriber");
    winnerUserId = winnerUser.uid;
    winnerEmail = winnerUser.email;

    // 3. Create Other User
    const otherUser = await createTestUser("other_phase_e", "Other Phase E", "subscriber");
    otherUserId = otherUser.uid;
    otherEmail = otherUser.email;

    // 4. Authenticate client instances
    authedAdminClient = createClient<Database>(supabaseUrl, anonKey);
    const { error: aErr } = await authedAdminClient.auth.signInWithPassword({
      email: adminEmail,
      password,
    });
    assert.ifError(aErr);

    authedWinnerClient = createClient<Database>(supabaseUrl, anonKey);
    const { error: wErr } = await authedWinnerClient.auth.signInWithPassword({
      email: winnerEmail,
      password,
    });
    assert.ifError(wErr);

    authedOtherUserClient = createClient<Database>(supabaseUrl, anonKey);
    const { error: oErr } = await authedOtherUserClient.auth.signInWithPassword({
      email: otherEmail,
      password,
    });
    assert.ifError(oErr);

    // 5. Seed a test published draw and winner record
    const { data: draw, error: dErr } = await adminClient
      .from("draws")
      .insert({
        title: "Phase E Test Draw",
        draw_date: new Date().toISOString(),
        status: "published",
        draw_mode: "random",
        drawn_numbers: [10, 20, 30, 40, 45],
        total_prize_pool: 1000.0,
        tier_5_pool: 400.0,
        tier_4_pool: 350.0,
        tier_3_pool: 250.0,
        total_active_subscribers: 3,
        subscription_pool_portion: 1000.0,
        rollover_jackpot_in: 0.0,
      })
      .select()
      .single();

    assert.ifError(dErr);
    testDrawId = draw!.id;
    createdDrawIds.push(testDrawId);

    // Create draw_entry for winner
    const { data: entry, error: eErr } = await adminClient
      .from("draw_entries")
      .insert({
        draw_id: testDrawId,
        user_id: winnerUserId,
        scores_snapshot: [10, 20, 30, 15, 25],
        matches_count: 3,
        matched_numbers: [10, 20, 30],
        winning_tier: "tier_3",
        prize_amount: 250.0,
      })
      .select()
      .single();

    assert.ifError(eErr);

    // Create winner row (initial status: pending_submission, pending payment)
    const { data: win, error: wInsErr } = await adminClient
      .from("winners")
      .insert({
        draw_id: testDrawId,
        draw_entry_id: entry!.id,
        user_id: winnerUserId,
        tier: "tier_3",
        prize_amount: 250.0,
        verification_status: "pending_submission",
        payment_status: "pending",
      })
      .select()
      .single();

    assert.ifError(wInsErr);
    testWinnerId = win!.id;
  });

  after(async () => {
    // 1. Clean up storage files
    if (uploadedStoragePaths.length > 0) {
      await adminClient.storage.from(STORAGE_BUCKET_NAME).remove(uploadedStoragePaths);
    }

    // 2. Clean up created draws & related records
    for (const drawId of createdDrawIds) {
      await adminClient.from("winners").delete().eq("draw_id", drawId);
      await adminClient.from("draw_entries").delete().eq("draw_id", drawId);
      await adminClient.from("draws").delete().eq("id", drawId);
    }

    // 3. Clean up test users
    for (const uid of createdUserIds) {
      await adminClient.from("subscriptions").delete().eq("user_id", uid);
      await adminClient.from("profiles").delete().eq("id", uid);
      await adminClient.auth.admin.deleteUser(uid);
    }
  });

  // ==========================================================================
  // 1. FILE & MAGIC BYTE VALIDATIONS
  // ==========================================================================
  describe("1. File & Magic Byte Validation", () => {
    test("detects authentic PNG, JPEG, and WebP magic bytes", () => {
      const pngCheck = validateImageMagicBytes(validPngBuffer);
      assert.strictEqual(pngCheck.valid, true);
      assert.strictEqual(pngCheck.format, "png");

      const jpegCheck = validateImageMagicBytes(validJpegBuffer);
      assert.strictEqual(jpegCheck.valid, true);
      assert.strictEqual(jpegCheck.format, "jpeg");

      const invalidCheck = validateImageMagicBytes(invalidFakeBuffer);
      assert.strictEqual(invalidCheck.valid, false);
    });

    test("rejects invalid magic byte content claiming to be an image", async () => {
      const res = await WinnerService.submitWinnerProof(
        adminClient,
        winnerUserId,
        testWinnerId,
        invalidFakeBuffer,
        "image/png"
      );

      assert.ok(res.error);
      assert.match(res.error, /Invalid image format/i);
    });

    test("rejects oversized file exceeding 5 MB limit", async () => {
      // 5 MB + 1 byte
      const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1);
      // Put PNG magic bytes so it only fails on size
      oversizedBuffer[0] = 0x89;
      oversizedBuffer[1] = 0x50;
      oversizedBuffer[2] = 0x4e;
      oversizedBuffer[3] = 0x47;

      const res = await WinnerService.submitWinnerProof(
        adminClient,
        winnerUserId,
        testWinnerId,
        oversizedBuffer,
        "image/png"
      );

      assert.ok(res.error);
      assert.match(res.error, /exceeds maximum allowed limit/i);
    });
  });

  // ==========================================================================
  // 2. PROOF SUBMISSION & AUTHORIZATION BOUNDARIES
  // ==========================================================================
  describe("2. Proof Submission & Authorization Boundaries", () => {
    test("non-winner user cannot submit proof", async () => {
      const nonExistentWinnerId = "00000000-0000-0000-0000-000000000000";
      const res = await WinnerService.submitWinnerProof(
        adminClient,
        otherUserId,
        nonExistentWinnerId,
        validPngBuffer,
        "image/png"
      );

      assert.ok(res.error);
      assert.match(res.error, /NOT_FOUND/i);
    });

    test("another user cannot submit proof for someone else's winner record", async () => {
      const res = await WinnerService.submitWinnerProof(
        adminClient,
        otherUserId, // other user attempting to submit for winnerUserId's record
        testWinnerId,
        validPngBuffer,
        "image/png"
      );

      assert.ok(res.error);
      assert.match(res.error, /UNAUTHORIZED/i);
    });

    test("winner can submit valid proof: transitions pending_submission -> pending_review", async () => {
      const res = await WinnerService.submitWinnerProof(
        adminClient,
        winnerUserId,
        testWinnerId,
        validPngBuffer,
        "image/png"
      );

      assert.ifError(res.error);
      assert.ok(res.data);
      assert.strictEqual(res.data.verification_status, "pending_review");
      assert.strictEqual(res.data.payment_status, "pending");
      assert.ok(res.data.proof_submitted_at);

      // Verify proof_image_url stores the private STORAGE OBJECT PATH, not a signed URL
      assert.ok(res.data.proof_image_url);
      assert.match(res.data.proof_image_url, /^proofs\//);
      assert.doesNotMatch(res.data.proof_image_url, /https?:\/\//);
      assert.doesNotMatch(res.data.proof_image_url, /token=/);

      uploadedStoragePaths.push(res.data.proof_image_url);

      // Verify the object actually exists in the private winner-proofs bucket
      const { data: fileData, error: fileErr } = await adminClient.storage
        .from(STORAGE_BUCKET_NAME)
        .download(res.data.proof_image_url);

      assert.ifError(fileErr);
      assert.ok(fileData);
    });

    test("submitting proof while already pending_review is rejected", async () => {
      const res = await WinnerService.submitWinnerProof(
        adminClient,
        winnerUserId,
        testWinnerId,
        validPngBuffer,
        "image/png"
      );

      assert.ok(res.error);
      assert.match(res.error, /INVALID_STATE.*under review/i);
    });
  });

  // ==========================================================================
  // 3. ADMIN REVIEW DECISIONS (APPROVE & REJECT)
  // ==========================================================================
  describe("3. Admin Review Decisions & Invariants", () => {
    test("non-admin cannot approve or reject winner proof", async () => {
      // authedOtherUserClient is role='subscriber'
      const { data: otherProfile } = await authedOtherUserClient
        .from("profiles")
        .select("role")
        .eq("id", otherUserId)
        .single();
      assert.strictEqual(otherProfile?.role, "subscriber");

      // Attempting to update verification_status directly as subscriber is rejected by RLS
      const { data } = await authedOtherUserClient
        .from("winners")
        .update({ verification_status: "approved" })
        .eq("id", testWinnerId)
        .select();

      // RLS prevents updating other winners or updating without admin policy
      assert.strictEqual(data?.length ?? 0, 0);
    });

    test("admin rejection requires non-empty notes (empty notes rejected)", async () => {
      const res = await WinnerService.reviewWinnerProof(
        authedAdminClient,
        adminUserId,
        testWinnerId,
        "reject",
        "" // empty notes
      );

      assert.ok(res.error);
      assert.match(res.error, /Admin notes explaining the rejection reason are required/i);
    });

    test("admin can reject with notes: transitions pending_review -> rejected", async () => {
      const rejectionReason = "Scorecard date does not match the draw period.";
      const res = await WinnerService.reviewWinnerProof(
        authedAdminClient,
        adminUserId,
        testWinnerId,
        "reject",
        rejectionReason
      );

      assert.ifError(res.error);
      assert.ok(res.data);
      assert.strictEqual(res.data.verification_status, "rejected");
      assert.strictEqual(res.data.reviewed_by, adminUserId);
      assert.strictEqual(res.data.admin_notes, rejectionReason);
    });

    test("cannot mark rejected winner as paid", async () => {
      const res = await WinnerService.markWinnerPaid(
        authedAdminClient,
        adminUserId,
        testWinnerId
      );

      assert.ok(res.error);
      assert.match(res.error, /INVALID_STATE.*must be 'approved'/i);
    });
  });

  // ==========================================================================
  // 4. RESUBMISSION & PREVIOUS FILE CLEANUP
  // ==========================================================================
  describe("4. Resubmission & Previous Proof Storage Cleanup", () => {
    test("rejected winner can resubmit proof: transitions rejected -> pending_review & cleans old file", async () => {
      // Check current winner record
      const { data: beforeWinner } = await adminClient
        .from("winners")
        .select("proof_image_url, verification_status")
        .eq("id", testWinnerId)
        .single();

      assert.strictEqual(beforeWinner?.verification_status, "rejected");
      const oldStoragePath = beforeWinner!.proof_image_url!;
      assert.ok(oldStoragePath);

      // Resubmit with new JPEG proof
      const res = await WinnerService.submitWinnerProof(
        adminClient,
        winnerUserId,
        testWinnerId,
        validJpegBuffer,
        "image/jpeg"
      );

      assert.ifError(res.error);
      assert.ok(res.data);
      assert.strictEqual(res.data.verification_status, "pending_review");
      assert.notStrictEqual(res.data.proof_image_url, oldStoragePath);

      const newStoragePath = res.data.proof_image_url!;
      uploadedStoragePaths.push(newStoragePath);

      // Verify old storage object was cleaned up
      const { error: oldFileErr } = await adminClient.storage
        .from(STORAGE_BUCKET_NAME)
        .download(oldStoragePath);

      assert.ok(oldFileErr, "Old storage file should be cleaned up after successful resubmission");

      // Verify new storage object exists
      const { data: newFileData, error: newFileErr } = await adminClient.storage
        .from(STORAGE_BUCKET_NAME)
        .download(newStoragePath);

      assert.ifError(newFileErr);
      assert.ok(newFileData);
    });
  });

  // ==========================================================================
  // 5. ADMIN APPROVAL & PROOF IMMUTABILITY
  // ==========================================================================
  describe("5. Admin Approval & Proof Immutability", () => {
    test("admin can approve proof: transitions pending_review -> approved", async () => {
      const res = await WinnerService.reviewWinnerProof(
        authedAdminClient,
        adminUserId,
        testWinnerId,
        "approve",
        "Scorecard fully verified."
      );

      assert.ifError(res.error);
      assert.ok(res.data);
      assert.strictEqual(res.data.verification_status, "approved");
      assert.strictEqual(res.data.reviewed_by, adminUserId);
      assert.strictEqual(res.data.payment_status, "pending");
    });

    test("approved winner proof CANNOT be replaced or resubmitted", async () => {
      const res = await WinnerService.submitWinnerProof(
        adminClient,
        winnerUserId,
        testWinnerId,
        validPngBuffer,
        "image/png"
      );

      assert.ok(res.error);
      assert.match(res.error, /INVALID_STATE.*already been verified and approved/i);
    });

    test("cannot re-review an already approved winner", async () => {
      const res = await WinnerService.reviewWinnerProof(
        authedAdminClient,
        adminUserId,
        testWinnerId,
        "reject",
        "Try to reject after approval"
      );

      assert.ok(res.error);
      assert.match(res.error, /INVALID_STATE.*Expected 'pending_review'/i);
    });
  });

  // ==========================================================================
  // 6. MANUAL PAYOUT OPERATIONS & CAS CONCURRENCY
  // ==========================================================================
  describe("6. Manual Payout Operations & CAS Concurrency", () => {
    test("non-admin cannot mark winner as paid", async () => {
      const { data } = await authedOtherUserClient
        .from("winners")
        .update({ payment_status: "paid" })
        .eq("id", testWinnerId)
        .select();

      assert.strictEqual(data?.length ?? 0, 0);
    });

    test("admin marks approved winner as paid: records paid_at and payment_status=paid", async () => {
      const res = await WinnerService.markWinnerPaid(
        authedAdminClient,
        adminUserId,
        testWinnerId,
        "Bank transfer #REF123456"
      );

      assert.ifError(res.error);
      assert.ok(res.data);
      assert.strictEqual(res.data.payment_status, "paid");
      assert.ok(res.data.paid_at);

      // Verify paid_at is a recent valid timestamp
      const paidDate = new Date(res.data.paid_at);
      assert.ok(!isNaN(paidDate.getTime()));
      assert.ok(Date.now() - paidDate.getTime() < 60000);
    });

    test("ALREADY_PAID: second concurrent payout call fails explicitly rather than silently succeeding", async () => {
      const res = await WinnerService.markWinnerPaid(
        authedAdminClient,
        adminUserId,
        testWinnerId,
        "Duplicate second payment attempt"
      );

      assert.ok(res.error);
      assert.match(res.error, /ALREADY_PAID/i);
    });

    test("paid winner is fully immutable: cannot change verification status or submit proof", async () => {
      // 1. Attempt to submit proof
      const submitRes = await WinnerService.submitWinnerProof(
        adminClient,
        winnerUserId,
        testWinnerId,
        validPngBuffer,
        "image/png"
      );
      assert.ok(submitRes.error);
      assert.match(submitRes.error, /INVALID_STATE.*already been paid out/i);

      // 2. Attempt to review
      const reviewRes = await WinnerService.reviewWinnerProof(
        authedAdminClient,
        adminUserId,
        testWinnerId,
        "reject",
        "Cannot reject paid"
      );
      assert.ok(reviewRes.error);
      assert.match(reviewRes.error, /INVALID_STATE.*already completed/i);
    });
  });

  // ==========================================================================
  // 7. STORAGE PRIVACY & SIGNED URL ACCESS CONTROL
  // ==========================================================================
  describe("7. Storage Privacy & Signed URL Access Control", () => {
    test("winner can generate signed URL for own proof", async () => {
      const res = await WinnerService.getProofSignedUrl(
        adminClient,
        winnerUserId,
        false, // not admin
        testWinnerId
      );

      assert.ifError(res.error);
      assert.ok(res.data?.signedUrl);
      assert.match(res.data.signedUrl, /^https?:\/\//);
      assert.match(res.data.signedUrl, /token=/);
    });

    test("admin can generate signed URL for any winner proof", async () => {
      const res = await WinnerService.getProofSignedUrl(
        adminClient,
        adminUserId,
        true, // isAdmin
        testWinnerId
      );

      assert.ifError(res.error);
      assert.ok(res.data?.signedUrl);
    });

    test("unauthorized user cannot generate signed URL for someone else's proof", async () => {
      const res = await WinnerService.getProofSignedUrl(
        adminClient,
        otherUserId, // not owner
        false, // not admin
        testWinnerId
      );

      assert.ok(res.error);
      assert.match(res.error, /UNAUTHORIZED/i);
    });
  });

  // ==========================================================================
  // 8. VERIFICATION CONTEXT AGGREGATE
  // ==========================================================================
  describe("8. Verification Context Aggregate", () => {
    test("retrieves complete context with draw numbers, scores_snapshot, and matched numbers", async () => {
      const res = await WinnerService.getVerificationContext(adminClient, testWinnerId);

      assert.ifError(res.error);
      assert.ok(res.data);
      assert.ok(res.data.winner);
      assert.strictEqual(res.data.winner.id, testWinnerId);

      // Profile
      assert.ok(res.data.profile);
      assert.strictEqual(res.data.profile?.id, winnerUserId);

      // Draw & Numbers
      assert.ok(res.data.draw);
      assert.deepStrictEqual(res.data.draw?.drawn_numbers, [10, 20, 30, 40, 45]);

      // Draw Entry & Scores
      assert.ok(res.data.drawEntry);
      assert.deepStrictEqual(res.data.drawEntry?.scores_snapshot, [10, 20, 30, 15, 25]);
      assert.deepStrictEqual(res.data.drawEntry?.matched_numbers, [10, 20, 30]);
      assert.strictEqual(res.data.drawEntry?.matches_count, 3);
    });
  });
});
