import { chromium } from "playwright";

const urls = [
  "https://www.alanranger.com/photography-services-near-me/beginners-photography-course",
  "https://www.alanranger.com/photography-services-near-me/lightroom-courses-for-beginners-coventry",
  "https://www.alanranger.com/photography-services-near-me/private-online-photography-classes-zoom",
];

function validateProduct(n) {
  const issues = [];
  if (!n.name) issues.push("missing name");
  if (!n["@id"]) issues.push("missing @id");
  const ar = n.aggregateRating;
  if (!ar) issues.push("missing aggregateRating");
  else {
    if (ar.ratingValue == null) issues.push("missing ratingValue");
    if (ar.reviewCount == null) issues.push("missing reviewCount");
    const rv = Number(ar.ratingValue);
    if (!(rv >= 1 && rv <= 5)) issues.push(`ratingValue out of range: ${ar.ratingValue}`);
  }
  const reviews = Array.isArray(n.review) ? n.review : n.review ? [n.review] : [];
  if (reviews.length > 25) issues.push(`review array >25 (${reviews.length})`);
  let sampleOk = 0;
  for (const r of reviews.slice(0, 5)) {
    if (r.author && r.reviewRating?.ratingValue) sampleOk += 1;
  }
  return {
    ok: issues.length === 0,
    issues,
    reviewEmit: reviews.length,
    aggCount: ar?.reviewCount ?? null,
    rating: ar?.ratingValue ?? null,
    id: n["@id"],
    name: n.name,
    sampleReviewsOk: sampleOk,
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

for (const url of urls) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(5000);
  const info = await page.evaluate(() => {
    const products = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try {
        const j = JSON.parse(s.textContent || "");
        const nodes = Array.isArray(j["@graph"]) ? j["@graph"] : [j];
        nodes.forEach((n) => {
          const t = n["@type"];
          const types = Array.isArray(t) ? t : [t];
          if (types.includes("Product")) products.push({ node: n, sid: s.id || "" });
        });
      } catch (_) {}
    });
    return {
      pathname: location.pathname,
      hasLoader: [...document.querySelectorAll("script[src]")].some((s) =>
        s.src.includes("product-page-loader")
      ),
      hasGithub: !!document.getElementById("ar-github-product-schema"),
      badge: !!document.querySelector(".ar-rating, .ar-stars"),
      productCount: products.length,
      products,
    };
  });
  const validations = info.products.map((p) => ({ sid: p.sid, ...validateProduct(p.node) }));
  console.log(
    JSON.stringify(
      {
        url,
        pathname: info.pathname,
        hasLoader: info.hasLoader,
        hasGithub: info.hasGithub,
        badge: info.badge,
        productCount: info.productCount,
        validations,
      },
      null,
      2
    )
  );
}

await browser.close();
