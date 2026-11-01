/**
 * Sweep 52 manifest product pages: Product JSON-LD, aggregateRating vs GitHub, removers present.
 * One-shot audit — does not mutate Squarespace.
 */
import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const MANIFEST =
  "G:/Dropbox/alan ranger photography/Website Code/Schema Tools/alanranger-schema/products-manifest.json";
const SCHEMA_ROOT =
  "G:/Dropbox/alan ranger photography/Website Code/Schema Tools/alanranger-schema";
const OUT =
  "G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/outputs/schema/product-schema-visibility-sweep-2026-10-07.json";

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
    reviewArray: Array.isArray(prod?.review) ? prod.review.length : 0,
    productId: prod?.["@id"] || null,
  };
}

function detectScripts(html, texts) {
  const blob = `${html}\n${texts.join("\n")}`;
  return {
    coreSuppressorV21: /Core Schema Suppressor v2\.1/i.test(blob),
    productSuppressorV13: /Product Schema Suppressor v1\.3|Remove Squarespace's built-in, short Product/i.test(blob),
    removeProductSchema: /removeProductSchema/i.test(blob),
    canonicalIdSuffixes: /CANONICAL_ID_SUFFIXES/i.test(blob),
    hasHashProductInSuffixList: /CANONICAL_ID_SUFFIXES[\s\S]{0,200}#product/i.test(blob),
  };
}

async function inspectPage(page, url) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(5000);
  return page.evaluate(() => {
    const scripts = [...document.querySelectorAll("script")];
    const ld = scripts.filter(
      (s) =>
        (s.getAttribute("type") || "").includes("ld+json") ||
        (s.getAttribute("data-type") || "").includes("ld+json")
    );
    const texts = scripts.map((s) => s.textContent || "");
    const html = document.documentElement.innerHTML.slice(0, 500000);
    const products = [];
    for (const el of ld) {
      const raw = (el.textContent || "").trim();
      if (!raw) continue;
      try {
        const json = JSON.parse(raw);
        const nodes = Array.isArray(json["@graph"]) ? json["@graph"] : [json];
        for (const n of nodes) {
          const t = n?.["@type"];
          const types = Array.isArray(t) ? t : [t];
          if (types.includes("Product")) {
            products.push({
              id: n["@id"] || null,
              reviewCount: n.aggregateRating?.reviewCount ?? null,
              ratingValue: n.aggregateRating?.ratingValue ?? null,
              reviewArray: Array.isArray(n.review) ? n.review.length : 0,
              scriptId: el.id || null,
            });
          }
        }
      } catch (_) {}
    }
    return { products, texts, htmlSnippet: html, ldCount: ld.length };
  });
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const rows = [];

for (const entry of manifest.entries) {
  const gh = githubAggregate(entry.schemaFileName);
  let live = {
    productPresent: false,
    products: [],
    scripts: {},
    error: null,
  };
  try {
    const inspected = await inspectPage(page, entry.url);
    live.products = inspected.products;
    live.productPresent = inspected.products.length > 0;
    live.scripts = detectScripts(inspected.htmlSnippet, inspected.texts);
    live.ldCount = inspected.ldCount;
  } catch (e) {
    live.error = String(e.message || e);
  }
  const liveAgg = live.products[0] || null;
  const countMatch =
    liveAgg &&
    gh.ok &&
    String(liveAgg.reviewCount) === String(gh.reviewCount);
  rows.push({
    pathKey: entry.pathKey,
    url: entry.url,
    schemaFileName: entry.schemaFileName,
    productPresent: live.productPresent,
    live_reviewCount: liveAgg?.reviewCount ?? null,
    live_ratingValue: liveAgg?.ratingValue ?? null,
    live_review_array: liveAgg?.reviewArray ?? null,
    live_productId: liveAgg?.id ?? null,
    github_reviewCount: gh.reviewCount,
    github_ratingValue: gh.ratingValue,
    github_review_array: gh.reviewArray,
    github_productId: gh.productId,
    aggregateMatchesGithub: !!countMatch,
    scripts: live.scripts,
    error: live.error,
  });
  console.log(
    `${live.productPresent ? "OK" : "MISSING"} ${entry.pathKey} live=${liveAgg?.reviewCount ?? "-"} gh=${gh.reviewCount}`
  );
}

await browser.close();
const summary = {
  generatedAt: new Date().toISOString(),
  total: rows.length,
  withProduct: rows.filter((r) => r.productPresent).length,
  missingProduct: rows.filter((r) => !r.productPresent).length,
  withCoreV21: rows.filter((r) => r.scripts?.coreSuppressorV21).length,
  missingAndCoreV21: rows.filter((r) => !r.productPresent && r.scripts?.coreSuppressorV21).length,
  rows,
};
fs.writeFileSync(OUT, JSON.stringify(summary, null, 2), "utf8");
console.log(`Wrote ${OUT}`);
console.log(
  `withProduct=${summary.withProduct} missing=${summary.missingProduct} coreV21=${summary.withCoreV21}`
);
