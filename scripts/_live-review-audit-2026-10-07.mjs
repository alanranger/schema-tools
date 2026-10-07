/**
 * Live audit of product/manual pages after final reviews fixes.
 * Cache-busted navigation; checks Product JSON-LD, badge, heading, newest-first.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const MANIFEST =
  "G:/Dropbox/alan ranger photography/Website Code/Schema Tools/alanranger-schema/products-manifest.json";
const COMBINED =
  "G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/csv processed/03 – combined_product_reviews.csv";
const OUT =
  "G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/outputs/schema/live-review-audit-2026-10-07.json";

const EXTRA = [
  { pathKey: "/photography-mentoring-online-assignments", url: "https://www.alanranger.com/photography-mentoring-online-assignments", kind: "manual" },
  { pathKey: "/free-online-photography-course", url: "https://www.alanranger.com/free-online-photography-course", kind: "manual" },
  { pathKey: "/", url: "https://www.alanranger.com/", kind: "manual" },
  { pathKey: "/about-alan-ranger", url: "https://www.alanranger.com/about-alan-ranger", kind: "manual" },
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(field);
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    if (row.some((x) => x !== "")) rows.push(row);
  }
  const headers = rows[0];
  return rows.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, i) => (o[h] = r[i] ?? ""));
    return o;
  });
}

function ratingNum(v) {
  if (v == null || v === "") return null;
  const s = String(v).trim().toUpperCase();
  const map = { FIVE: 5, FOUR: 4, THREE: 3, TWO: 2, ONE: 1 };
  if (map[s] != null) return map[s];
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function dataTotalsBySlug(rows) {
  const map = new Map();
  for (const r of rows) {
    const slug = String(r.product_slug || "").trim().split("/").pop();
    if (!slug) continue;
    const rating = ratingNum(r.ratingValue ?? r.rating ?? r.review_stars);
    if (rating == null) continue;
    if (!map.has(slug)) map.set(slug, { count: 0, sum: 0, newestText: null });
    const e = map.get(slug);
    e.count += 1;
    e.sum += rating;
    const body = String(r.reviewBody || r.review_content || r.review || "").trim();
    const author = String(r.reviewer || r.review_username || r.author || "").trim();
    const date = String(r.date || r.date_parsed || r["review_created_(utc)"] || "").slice(0, 10);
    if (body && body.toLowerCase() !== "nan") {
      const ts = Date.parse(date) || 0;
      if (!e.newestText || ts >= (Date.parse(e.newestText.date) || 0)) {
        e.newestText = { author, date, body: body.slice(0, 120) };
      }
    }
  }
  return map;
}

const PRODUCT_HINTS = [
  [/sensor\s*clean/i, "camera-sensor-clean"],
  [/intro\s+3\s+week|beginners?\s+(photography\s+)?(course|class)|3\s*hr\s+beginner/i, "beginners-photography-course"],
  [/\blightroom\b/i, "lightroom-courses-for-beginners-coventry"],
  [/\bbatsford\b/i, "batsford-arboretum-photography-workshops"],
  [/\bbluebell\b/i, "bluebell-woodlands-photography-workshops"],
  [/\bgift\s+voucher/i, "photography-gift-vouchers"],
];

function proposedSlug(body, currentSlug) {
  for (const [re, slug] of PRODUCT_HINTS) {
    if (re.test(body) && slug !== currentSlug && !(slug.startsWith("beginners") && currentSlug.startsWith("beginners"))) {
      return slug;
    }
  }
  return null;
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const combined = parseCsv(fs.readFileSync(COMBINED, "utf8"));
const dataMap = dataTotalsBySlug(combined);

const pages = [
  ...manifest.entries.map((e) => ({
    pathKey: e.pathKey,
    url: e.url,
    schemaFileName: e.schemaFileName,
    kind: "product",
    slug: String(e.pathKey || "").replace(/\/+$/, "").split("/").pop(),
  })),
  ...EXTRA.map((e) => ({ ...e, slug: e.pathKey.replace(/\/+$/, "").split("/").pop() || "home" })),
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const results = [];
const exceptions = [];
const redirects = [];

for (const pageInfo of pages) {
  const page = await context.newPage();
  const bust = pageInfo.url.includes("?") ? `&cb=${Date.now()}` : `?cb=${Date.now()}`;
  const target = pageInfo.url + bust;
  let finalUrl = target;
  try {
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 90000 });
    finalUrl = page.url();
    await page.waitForTimeout(8000);
    try {
      await page.waitForFunction(
        () =>
          document.getElementById("ar-github-product-schema") ||
          document.querySelector(".ar-rating") ||
          document.querySelectorAll('script[type="application/ld+json"]').length > 1,
        { timeout: 8000 }
      );
    } catch (_) {}
    const info = await page.evaluate(() => {
      const products = [];
      const orgs = [];
      const services = [];
      document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
        try {
          const j = JSON.parse(s.textContent || "");
          const nodes = Array.isArray(j["@graph"]) ? j["@graph"] : [j];
          nodes.forEach((n) => {
            const t = n["@type"];
            const types = Array.isArray(t) ? t : [t];
            if (types.includes("Product")) products.push({ n, sid: s.id || "" });
            if (types.includes("Organization") || types.includes("LocalBusiness")) orgs.push({ n, sid: s.id || "" });
            if (types.includes("Service")) services.push({ n, sid: s.id || "" });
          });
        } catch (_) {}
      });
      const badgeEl = document.querySelector(".ar-rating");
      const badgeText = badgeEl ? badgeEl.textContent.trim().replace(/\s+/g, " ") : "";
      const sub = document.querySelector("#ar-reviews .ar-sub");
      const heading = sub ? sub.textContent.trim().replace(/\s+/g, " ") : "";
      const cards = [...document.querySelectorAll("#ar-reviews .ar-rev")].map((el) => {
        const w = el.querySelector(".w");
        const name = w ? w.childNodes[0]?.textContent?.trim() : "";
        const body = el.querySelector("p")?.textContent?.trim() || "";
        return { name, body };
      });
      const product = products[0]?.n || null;
      const revs = product && product.review ? (Array.isArray(product.review) ? product.review : [product.review]) : [];
      return {
        pathname: location.pathname,
        productCount: products.length,
        orgCount: orgs.length,
        serviceCount: services.length,
        productIds: products.map((p) => p.n["@id"] || p.sid),
        agg: product?.aggregateRating || null,
        reviews: revs.map((r) => ({
          author: r.author?.name || "",
          date: r.datePublished || "",
          body: String(r.reviewBody || ""),
        })),
        badgeText,
        heading,
        cards,
        hasLoader: [...document.querySelectorAll("script[src]")].some((s) => s.src.includes("product-page-loader")),
        hasGithub: !!document.getElementById("ar-github-product-schema"),
      };
    });

    const redirected =
      pageInfo.kind === "product" &&
      !finalUrl.replace(/[?#].*$/, "").includes(pageInfo.slug) &&
      (finalUrl.includes("/photography-services-near-me/") || finalUrl.includes("/photo-workshops-uk/")) &&
      finalUrl.replace(/[?#].*$/, "").split("/").filter(Boolean).length <= 1 + (finalUrl.includes("photography-services-near-me") || finalUrl.includes("photo-workshops-uk") ? 1 : 0);

    // simpler redirect detect for known two
    const isCollectionRedirect =
      /\/photography-services-near-me\/?(\?|$)/.test(finalUrl) &&
      pageInfo.pathKey.includes("/photography-services-near-me/") &&
      pageInfo.pathKey !== "/photography-services-near-me";

    if (isCollectionRedirect || (info.pathname.replace(/\/+$/, "") !== pageInfo.pathKey.replace(/\/+$/, "") && info.productCount === 0 && pageInfo.kind === "product")) {
      redirects.push({ pathKey: pageInfo.pathKey, finalUrl: finalUrl.replace(/[?#].*$/, ""), pathname: info.pathname });
      results.push({
        pathKey: pageInfo.pathKey,
        kind: pageInfo.kind,
        status: "REDIRECT",
        badgeTotal: null,
        jsonLdTotal: null,
        dataTotal: dataMap.get(pageInfo.slug)?.count ?? null,
        headingOK: null,
        newestFirstOK: null,
        firstReview: null,
        note: `redirect → ${info.pathname}`,
      });
      await page.close();
      continue;
    }

    const data = dataMap.get(pageInfo.slug);
    const dataTotal = data?.count ?? null;
    const jsonLdTotal = info.agg?.reviewCount != null ? Number(info.agg.reviewCount) : null;
    const badgeMatch = badgeTextMatch(info.badgeText, jsonLdTotal, info.agg?.ratingValue);
    const emit = info.reviews;
    const expectsReviewsUi =
      pageInfo.kind === "product" &&
      (pageInfo.pathKey.startsWith("/photo-workshops-uk/") ||
        pageInfo.pathKey.startsWith("/photography-services-near-me/"));
    const headingOK = !expectsReviewsUi
      ? true
      : emit.length === 0
        ? true
        : !!info.heading &&
          info.heading.includes("most recent") &&
          (jsonLdTotal == null || info.heading.includes(String(jsonLdTotal))) &&
          info.heading.includes(String(emit.length));
    const newestFirstOK = isNewestFirst(emit);
    const first = emit[0] ? `${emit[0].author} ${emit[0].date}` : null;
    const placeholders = emit.filter((r) => /Customer review available/i.test(r.body));
    const dupes = findDupes(emit);

    // entity count expectations
    let entityOK = true;
    if (pageInfo.kind === "product") entityOK = info.productCount === 1;
    // manual pages: at least one org/service/product as appropriate
    if (pageInfo.pathKey === "/free-online-photography-course") entityOK = info.productCount === 1;
    if (pageInfo.pathKey === "/photography-mentoring-online-assignments") {
      entityOK = info.productCount + info.serviceCount >= 1;
      const expectedMentoring = 8;
      const mentoringCount = Number(info.jsonLdTotal || info.dataTotal || 0);
      if (entityOK && mentoringCount > 0 && mentoringCount !== expectedMentoring) {
        entityOK = false;
        info.mentoringCountMismatch = { expected: expectedMentoring, actual: mentoringCount };
      }
    }
    if (pageInfo.pathKey === "/" || pageInfo.pathKey === "/about-alan-ranger") entityOK = info.orgCount >= 1;

    const totalsMatch =
      pageInfo.kind !== "product" ||
      dataTotal == null ||
      jsonLdTotal == null ||
      Number(jsonLdTotal) === Number(dataTotal);

    let status = "PASS";
    const fails = [];
    if (!entityOK) fails.push(`entityCount product=${info.productCount}`);
    if (pageInfo.kind === "product" && !totalsMatch) fails.push(`totals badge/json/data mismatch data=${dataTotal} json=${jsonLdTotal}`);
    if (pageInfo.kind === "product" && info.hasLoader && jsonLdTotal != null && !badgeMatch.ok && dataTotal >= 1) fails.push(`badge ${info.badgeText}`);
    if (pageInfo.kind === "product" && emit.length && !headingOK) fails.push(`heading "${info.heading}"`);
    if (emit.length && !newestFirstOK) fails.push("newest-first");
    if (placeholders.length) fails.push("placeholder text");
    if (dupes.length) fails.push(`dupes ${dupes.join("|")}`);
    if (fails.length) status = "FAIL";

    // misattribution scan on emitted text
    for (const r of emit) {
      const prop = proposedSlug(r.body, pageInfo.slug);
      if (prop) {
        exceptions.push({
          type: "misattribution_candidate",
          pathKey: pageInfo.pathKey,
          author: r.author,
          date: r.date,
          proposed_slug: prop,
          excerpt: r.body.slice(0, 160),
        });
      }
    }
    if (status === "FAIL") {
      exceptions.push({ type: "fail", pathKey: pageInfo.pathKey, fails, heading: info.heading, badgeText: info.badgeText });
    }

    // expected newest text author check (product pages)
    if (pageInfo.kind === "product" && data?.newestText && emit[0]) {
      const expect = data.newestText.author.toLowerCase();
      const got = (emit[0].author || "").toLowerCase();
      if (expect && got && expect !== got) {
        // soft note only if dates also disagree
        if ((data.newestText.date || "").slice(0, 10) !== (emit[0].date || "").slice(0, 10)) {
          exceptions.push({
            type: "newest_mismatch",
            pathKey: pageInfo.pathKey,
            expected: data.newestText,
            got: emit[0],
          });
        }
      }
    }

    results.push({
      pathKey: pageInfo.pathKey,
      kind: pageInfo.kind,
      status,
      badgeTotal: badgeMatch.count,
      jsonLdTotal,
      dataTotal,
      headingOK,
      newestFirstOK,
      firstReview: first,
      emitCount: emit.length,
      ratingValue: info.agg?.ratingValue ?? null,
      note: fails.join("; ") || "",
    });
  } catch (e) {
    results.push({
      pathKey: pageInfo.pathKey,
      kind: pageInfo.kind,
      status: "FAIL",
      badgeTotal: null,
      jsonLdTotal: null,
      dataTotal: dataMap.get(pageInfo.slug)?.count ?? null,
      headingOK: false,
      newestFirstOK: false,
      firstReview: null,
      note: String(e.message || e),
    });
    exceptions.push({ type: "error", pathKey: pageInfo.pathKey, error: String(e.message || e) });
  }
  await page.close();
}

await browser.close();

function badgeTextMatch(text, jsonTotal, ratingValue) {
  if (!text) return { ok: jsonTotal == null || Number(jsonTotal) === 0, count: null };
  const m =
    String(text).match(/(\d+)\s*reviews?/i) ||
    String(text).match(/from\s+(\d+)/i) ||
    String(text).match(/·\s*(\d+)/) ||
    String(text).match(/(\d+)\s*$/);
  const count = m ? Number(m[1]) : null;
  const ok = count != null && jsonTotal != null && count === Number(jsonTotal);
  return { ok, count };
}

function isNewestFirst(revs) {
  const dates = revs.map((r) => r.date).filter(Boolean);
  if (dates.length < 2) return true;
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] > dates[i - 1]) return false;
  }
  return true;
}

function findDupes(revs) {
  const seen = new Set();
  const d = [];
  for (const r of revs) {
    const k = `${(r.author || "").toLowerCase()}|${r.date}|${(r.body || "").slice(0, 80)}`;
    if (seen.has(k)) d.push(k);
    seen.add(k);
  }
  return d;
}

const pass = results.filter((r) => r.status === "PASS").length;
const fail = results.filter((r) => r.status === "FAIL").length;
const redir = results.filter((r) => r.status === "REDIRECT").length;
const out = {
  generatedAt: new Date().toISOString(),
  summary: { total: results.length, pass, fail, redirect: redir, exceptions: exceptions.length },
  redirects,
  results,
  exceptions,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.summary));
console.log("redirects", redirects);
console.log("FAILS", results.filter((r) => r.status === "FAIL").map((r) => `${r.pathKey}: ${r.note}`));
console.log("wrote", OUT);
