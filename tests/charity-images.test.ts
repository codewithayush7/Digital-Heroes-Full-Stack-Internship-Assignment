import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

describe("Charity Image System & Resilience Verification", () => {
  test("All active charities have live, valid image URLs resolving with HTTP 200", async () => {
    const { data: charities, error } = await supabase
      .from("charities")
      .select("id, slug, name, logo_url, cover_image_url, gallery_images");

    assert.equal(error, null, "Supabase query should not error");
    assert.ok(charities && charities.length >= 4, "Should have at least 4 charities");

    for (const charity of charities) {
      // Check logo URL
      if (charity.logo_url) {
        const res = await fetch(charity.logo_url, { method: "HEAD" });
        assert.equal(
          res.status,
          200,
          `Charity ${charity.name} logo (${charity.logo_url}) must return HTTP 200`
        );
        const contentType = res.headers.get("content-type") || "";
        assert.ok(
          contentType.startsWith("image/"),
          `Charity ${charity.name} logo content-type must be image/*, got ${contentType}`
        );
      }

      // Check cover image URL
      if (charity.cover_image_url) {
        const res = await fetch(charity.cover_image_url, { method: "HEAD" });
        assert.equal(
          res.status,
          200,
          `Charity ${charity.name} cover (${charity.cover_image_url}) must return HTTP 200`
        );
        const contentType = res.headers.get("content-type") || "";
        assert.ok(
          contentType.startsWith("image/"),
          `Charity ${charity.name} cover content-type must be image/*, got ${contentType}`
        );
      }

      // Check gallery images
      if (charity.gallery_images && Array.isArray(charity.gallery_images)) {
        for (let i = 0; i < charity.gallery_images.length; i++) {
          const imgUrl: string = charity.gallery_images[i];
          const res = await fetch(imgUrl, { method: "HEAD" });
          assert.equal(
            res.status,
            200,
            `Charity ${charity.name} gallery[${i}] (${imgUrl}) must return HTTP 200`
          );
          const contentType = res.headers.get("content-type") || "";
          assert.ok(
            contentType.startsWith("image/"),
            `Charity ${charity.name} gallery[${i}] content-type must be image/*, got ${contentType}`
          );
        }
      }
    }
  });

  test("CharityCard uses resilient CharityCoverImage and CharityLogoImage with fallback support", () => {
    const cardFilePath = resolve(process.cwd(), "src/components/charity/CharityCard.tsx");
    const content = readFileSync(cardFilePath, "utf-8");

    assert.ok(
      content.includes("CharityCoverImage"),
      "CharityCard must use CharityCoverImage"
    );
    assert.ok(
      content.includes("CharityLogoImage"),
      "CharityCard must use CharityLogoImage"
    );
  });

  test("CharityDetailPage uses resilient CharityCoverImage, CharityLogoImage, and CharityGalleryImage", () => {
    const detailFilePath = resolve(process.cwd(), "src/app/charities/[slug]/page.tsx");
    const content = readFileSync(detailFilePath, "utf-8");

    assert.ok(
      content.includes("CharityCoverImage"),
      "CharityDetailPage must use CharityCoverImage"
    );
    assert.ok(
      content.includes("CharityLogoImage"),
      "CharityDetailPage must use CharityLogoImage"
    );
    assert.ok(
      content.includes("CharityGalleryImage"),
      "CharityDetailPage must use CharityGalleryImage"
    );
  });

  test("CharityImage component exports onError handling and fallback UI", () => {
    const imageComponentPath = resolve(process.cwd(), "src/components/charity/CharityImage.tsx");
    const content = readFileSync(imageComponentPath, "utf-8");

    assert.ok(content.includes('"use client"'), "CharityImage must be a client component");
    assert.ok(content.includes("onError"), "CharityImage must handle onError");
    assert.ok(content.includes("setHasError"), "CharityImage must track error state");
    assert.ok(content.includes("CharityCoverImage"), "CharityImage must export CharityCoverImage");
    assert.ok(content.includes("CharityLogoImage"), "CharityImage must export CharityLogoImage");
    assert.ok(content.includes("CharityGalleryImage"), "CharityImage must export CharityGalleryImage");
  });
});
