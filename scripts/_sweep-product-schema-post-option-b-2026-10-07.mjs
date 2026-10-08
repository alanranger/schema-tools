/**
 * Post-Option-B sweep: Product JSON-LD, aggregate vs GitHub, badge, duplicates.
 */
import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const MANIFEST =
  "G:/Dropbox/alan ranger photography/Website Code/Schema Tools/alanranger-schema/products-manifest.json";
const SCHEMA_ROOT =
  "G:/Dropbox/alan ranger photography/Website Code/Schema Tools/alanranger-schema";
const OUT =
  "G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/outputs/schema/product-schema-visibility-sweep-post-option-b-2026-10-07.json";

function productFromGraph(data) {
  const nodes = Array.isArray(data?.["@graph"]) ? data["@graph"] : [data];
  return (
    nodes.find((n) => {
      const t = n?.["@type"];
      const types = Array.isArray(t) ? t : [t];
      return types.includes("Product");
    }) || null
  );
}

function githubAggregate(schemaFileName) {
  const fp = path.join(SCHEMA_ROOT, schemaFileName);
  if (!fs.existsSync(fp)) return { ok: false };
  const data = JSON.parse(fs.readFileSync(fp, "utf8"));
  const prod = productFromGraph(data);
  const agg = prod?.aggregateRating || null;
  return {
    ok: true,
    reviewCount: agg?.reviewCount ?? null,
    ratingValue: agg?.ratingValue ?? null,
  };
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const rows = [];

for (const entry of manifest.entries) {
  const gh = githubAggregate(entry.schemaFileName);
  const row = {
    pathKey: entry.pathKey,
    url: entry.url,
    schemaFileName: entry.schemaFileName,
    productPresent: false,
    productCount: 0,
    live_reviewCount: null,
    live_ratingValue: null,
    github_reviewCount: gh.reviewCount,
    github_ratingValue: gh.ratingValue,
    aggregateMatchesGithub: false,
    badgeVisible: false,
    badgeText: null,
    hasHostedLoader: false,
    hasGithubSchemaId: false,
    error: null,
  };
  try {
    await page.goto(entry.url, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(5000);
    const live = await page.evaluate(() => {
      const scripts = [...document.querySelectorAll("script[src]")].map((s) => s.src);
      const products = [];
      document
        .querySelectorAll(
          'script[type="application/ld+json"], script[data-type="application/ld+json"]'
        )
        .forEach((s) => {
          try {
            const j = JSON.parse(s.textContent || "");
            const nodes = Array.isArray(j["@graph"]) ? j["@graph"] : [j];
            for (const n of nodes) {
              const t = n["@type"];
              const types = Array.isArray(t) ? t : [t];
              if (types.includes("Product")) {
                products.push({
                  id: n["@id"] || null,
                  reviewCount: n.aggregateRating?.reviewCount ?? null,
                  ratingValue: n.aggregateRating?.ratingValue ?? null,
                  scriptId: s.id || "",
                });
              }
            }
          } catch (_) {}
        });
      const badgeEl = document.querySelector(".ar-rating") || document.querySelector(".ar-stars");
      return {
        products,
        hasHostedLoader: scripts.some((s) => s.includes("loaders/product-page-loader.js")),
        hasGithubSchemaId: !!document.getElementById("ar-github-product-schema"),
        badgeVisible: !!badgeEl,
        badgeText: badgeEl ? (badgeEl.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120) : null,
      };
    });
    row.productCount = live.products.length;
    row.productPresent = live.products.length === 1;
    row.hasHostedLoader = live.hasHostedLoader;
    row.hasGithubSchemaId = live.hasGithubSchemaId;
    row.badgeVisible = live.badgeVisible;
    row.badgeText = live.badgeText;
    if (live.products[0]) {
      row.live_reviewCount = live.products[0].reviewCount;
      row.live_ratingValue = live.products[0].ratingValue;
      row.aggregateMatchesGithub =
        String(live.products[0].reviewCount) === String(gh.reviewCount);
    }
  } catch (e) {
    row.error = String(e.message || e);
  }
  rows.push(row);
  const mark = row.productPresent ? "OK1" : row.productCount > 1 ? `DUP${row.productCount}` : "MISS";
  console.log(
    `${mark} badge=${row.badgeVisible ? "Y" : "N"} live=${row.live_reviewCount ?? "-"} gh=${row.github_reviewCount} ${entry.pathKey}`
  );
}

await browser.close();

const withReviews = rows.filter((r) => Number(r.github_reviewCount) >= 1);
const summary = {
  generatedAt: new Date().toISOString(),
  total: rows.length,
  productExactlyOne: rows.filter((r) => r.productPresent).length,
  productMissing: rows.filter((r) => r.productCount === 0).length,
  productDuplicates: rows.filter((r) => r.productCount > 1).length,
  aggregateMatches: rows.filter((r) => r.aggregateMatchesGithub).length,
  hostedLoader: rows.filter((r) => r.hasHostedLoader).length,
  badgeVisible: rows.filter((r) => r.badgeVisible).length,
  withReviews: withReviews.length,
  badgeWhenHasReviews: withReviews.filter((r) => r.badgeVisible).length,
  rows,
};
fs.writeFileSync(OUT, JSON.stringify(summary, null, 2), "utf8");
console.log(`Wrote ${OUT}`);
console.log(
  `exactly1=${summary.productExactlyOne} miss=${summary.productMissing} dup=${summary.productDuplicates} match=${summary.aggregateMatches} badge=${summary.badgeVisible}/${summary.withReviews}`
);
