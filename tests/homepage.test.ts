import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";
import { CharityService } from "../src/lib/services/charity.service";
import { DrawService } from "../src/lib/services/draw.service";
import {
  SCORE_MIN,
  SCORE_MAX,
  MAX_RETAINED_SCORES,
  DRAW_NUMBERS_COUNT,
  PRIZE_TIER_SPLITS,
  MIN_CHARITY_CONTRIBUTION_PCT,
  MAX_CHARITY_CONTRIBUTION_PCT,
} from "../src/lib/config/constants";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-anon-key";

describe("Phase F3.1: Public Experience & Homepage Tests", () => {
  const anonClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

  describe("1. Architectural Security & Import Boundaries", () => {
    it("public homepage does not import AdminService or admin client", () => {
      const homePath = path.join(process.cwd(), "src/app/page.tsx");
      const homeContent = fs.readFileSync(homePath, "utf-8");

      assert.doesNotMatch(homeContent, /AdminService/, "Homepage must not reference AdminService");
      assert.doesNotMatch(homeContent, /createAdminClient/, "Homepage must not reference createAdminClient");
      assert.doesNotMatch(homeContent, /SUPABASE_SERVICE_ROLE_KEY/, "Homepage must not reference service role key");
    });

    it("public charities directory does not import AdminService or admin client", () => {
      const charPath = path.join(process.cwd(), "src/app/charities/page.tsx");
      const charContent = fs.readFileSync(charPath, "utf-8");

      assert.doesNotMatch(charContent, /AdminService/, "Charities page must not reference AdminService");
      assert.doesNotMatch(charContent, /createAdminClient/, "Charities page must not reference createAdminClient");
    });

    it("public components do not import AdminService or authenticated mutation actions", () => {
      const publicDir = path.join(process.cwd(), "src/components/public");
      const files = fs.readdirSync(publicDir);

      for (const file of files) {
        const filePath = path.join(publicDir, file);
        const content = fs.readFileSync(filePath, "utf-8");
        assert.doesNotMatch(content, /AdminService/, `${file} must not reference AdminService`);
        assert.doesNotMatch(content, /createAdminClient/, `${file} must not reference createAdminClient`);
        assert.doesNotMatch(content, /createCheckoutSessionAction/, `${file} must not directly invoke authenticated checkout actions`);
      }
    });
  });

  describe("2. Authoritative Constants & Prize Mechanics Integrity", () => {
    it("exports authoritative score and draw parameters", () => {
      assert.equal(SCORE_MIN, 1, "SCORE_MIN must be 1");
      assert.equal(SCORE_MAX, 45, "SCORE_MAX must be 45");
      assert.equal(MAX_RETAINED_SCORES, 5, "MAX_RETAINED_SCORES must be 5");
      assert.equal(DRAW_NUMBERS_COUNT, 5, "DRAW_NUMBERS_COUNT must be 5");
    });

    it("enforces PRD tier splits (40% Tier 5, 35% Tier 4, 25% Tier 3)", () => {
      assert.equal(PRIZE_TIER_SPLITS.tier_5.share, 0.40, "Tier 5 share must be 40%");
      assert.equal(PRIZE_TIER_SPLITS.tier_5.rollover, true, "Tier 5 must have rollover enabled");

      assert.equal(PRIZE_TIER_SPLITS.tier_4.share, 0.35, "Tier 4 share must be 35%");
      assert.equal(PRIZE_TIER_SPLITS.tier_4.rollover, false, "Tier 4 must not roll over");

      assert.equal(PRIZE_TIER_SPLITS.tier_3.share, 0.25, "Tier 3 share must be 25%");
      assert.equal(PRIZE_TIER_SPLITS.tier_3.rollover, false, "Tier 3 must not roll over");

      const totalSplit =
        PRIZE_TIER_SPLITS.tier_5.share +
        PRIZE_TIER_SPLITS.tier_4.share +
        PRIZE_TIER_SPLITS.tier_3.share;
      assert.equal(Math.round(totalSplit * 100), 100, "Prize tier shares must sum to 100%");
    });

    it("enforces PRD charity contribution limits (10% to 100%)", () => {
      assert.equal(MIN_CHARITY_CONTRIBUTION_PCT, 10.0, "Min charity contribution must be 10%");
      assert.equal(MAX_CHARITY_CONTRIBUTION_PCT, 100.0, "Max charity contribution must be 100%");
    });
  });

  describe("3. Public Server-Side Data Fetching Capabilities", () => {
    it("anonymous public client can query featured charities without error", async () => {
      const res = await CharityService.getCharities(anonClient, { featuredOnly: true });
      assert.equal(res.error, undefined, "Anonymous charity fetch should not return RLS error");
      assert.ok(Array.isArray(res.data), "Expected charity data array");
    });

    it("anonymous public client can query latest published draw without error", async () => {
      const res = await DrawService.getLatestPublishedDraw(anonClient);
      assert.equal(res.error, undefined, "Anonymous draw fetch should not return RLS error");
      // res.data may be null if no draws are published or an object if published
      if (res.data) {
        assert.equal(res.data.status, "published", "Draw must have published status");
      }
    });
  });

  describe("4. Homepage Content & Navigation Verification", () => {
    it("homepage source includes required section anchors and semantic structure", () => {
      const homePath = path.join(process.cwd(), "src/app/page.tsx");
      const homeContent = fs.readFileSync(homePath, "utf-8");

      // Verify anchor IDs exist
      assert.ok(homeContent.includes('id="how-it-works"'), "Homepage must contain #how-it-works section");
      assert.ok(homeContent.includes('id="draw-mechanics"'), "Homepage must contain #draw-mechanics section");
      assert.ok(homeContent.includes('id="membership"'), "Homepage must contain #membership section");

      // Verify navigation links
      assert.ok(homeContent.includes('href="/signup"'), "Homepage must link to /signup");
      assert.ok(homeContent.includes('href="/charities"'), "Homepage must link to /charities");

      // Verify tier splits and constants are used
      assert.ok(homeContent.includes("PRIZE_TIER_SPLITS"), "Homepage must use authoritative PRIZE_TIER_SPLITS");
      assert.ok(homeContent.includes("SCORE_MIN"), "Homepage must use SCORE_MIN constant");
      assert.ok(homeContent.includes("SCORE_MAX"), "Homepage must use SCORE_MAX constant");

      // Verify CharityCard component reuse
      assert.ok(homeContent.includes("<CharityCard"), "Homepage must reuse CharityCard component");
    });

    it("public header provides required brand, anchor, and authentication links", () => {
      const headerPath = path.join(process.cwd(), "src/components/public/PublicHeader.tsx");
      const headerContent = fs.readFileSync(headerPath, "utf-8");

      assert.ok(headerContent.includes('href="/"'), "Header must contain home link");
      assert.ok(headerContent.includes('href="/#how-it-works"'), "Header must link to #how-it-works");
      assert.ok(headerContent.includes('href="/#draw-mechanics"'), "Header must link to #draw-mechanics");
      assert.ok(headerContent.includes('href="/charities"'), "Header must link to /charities");
      assert.ok(headerContent.includes('href="/#membership"'), "Header must link to #membership");
      assert.ok(headerContent.includes('href="/login"'), "Header must link to /login");
      assert.ok(headerContent.includes('href="/signup"'), "Header must link to /signup");
    });

    it("pricing cards route to signup with plan parameters", () => {
      const pricingPath = path.join(process.cwd(), "src/components/public/PricingCards.tsx");
      const pricingContent = fs.readFileSync(pricingPath, "utf-8");

      assert.ok(
        pricingContent.includes('href="/signup?plan=monthly"'),
        "Monthly card must link to /signup?plan=monthly"
      );
      assert.ok(
        pricingContent.includes('href="/signup?plan=yearly"'),
        "Annual card must link to /signup?plan=yearly"
      );
    });

    it("public footer contains mission, links, draw notice, and copyright", () => {
      const footerPath = path.join(process.cwd(), "src/components/public/PublicFooter.tsx");
      const footerContent = fs.readFileSync(footerPath, "utf-8");

      assert.ok(footerContent.includes("/charities"), "Footer must link to charities");
      assert.ok(footerContent.includes("/login"), "Footer must link to login");
      assert.ok(footerContent.includes("/signup"), "Footer must link to signup");
      assert.ok(footerContent.includes("Draw Participation Notice"), "Footer must contain draw transparency notice");
      assert.ok(footerContent.includes("Digital Heroes. All rights reserved"), "Footer must contain copyright notice");
    });
  });
});
