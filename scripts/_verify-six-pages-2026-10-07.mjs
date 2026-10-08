import { chromium } from "playwright";

const pages = [
  ["bluebell", "https://www.alanranger.com/photography-services-near-me/bluebell-woodlands-photography-workshops"],
  ["secrets", "https://www.alanranger.com/photo-workshops-uk/secrets-of-woodland-photography-workshop"],
  ["zoom", "https://www.alanranger.com/photography-services-near-me/private-online-photography-classes-zoom"],
  ["beginners", "https://www.alanranger.com/photography-services-near-me/beginners-photography-course"],
  ["lightroom", "https://www.alanranger.com/photography-services-near-me/lightroom-courses-for-beginners-coventry"],
  ["northyorks", "https://www.alanranger.com/photo-workshops-uk/north-yorkshire-landscape-photography"],
  ["mentoring", "https://www.alanranger.com/photography-mentoring-online-assignments"],
];

const browser = await chromium.launch({ headless: true });
for (const [label, url] of pages) {
  const page = await browser.newPage();
  await page.goto(url + (url.includes("?") ? "&" : "?") + "cb=" + Date.now(), {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(8000);
  try {
    await page.waitForFunction(
      () => document.getElementById("ar-github-product-schema") || document.querySelector(".ar-rating"),
      { timeout: 6000 }
    );
  } catch (_) {}
  const info = await page.evaluate(() => {
    const products = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try {
        const j = JSON.parse(s.textContent || "");
        const nodes = Array.isArray(j["@graph"]) ? j["@graph"] : [j];
        nodes.forEach((n) => {
          const t = n["@type"];
          const types = Array.isArray(t) ? t : [t];
          if (types.includes("Product") || types.includes("Service")) {
            const revs = Array.isArray(n.review) ? n.review : n.review ? [n.review] : [];
            products.push({
              type: types[0],
              id: s.id || "",
              count: n.aggregateRating?.reviewCount ?? null,
              rating: n.aggregateRating?.ratingValue ?? null,
              emit: revs.length,
              first: revs[0] ? { name: revs[0].author?.name, date: revs[0].datePublished, stars: revs[0].reviewRating?.ratingValue } : null,
              names: revs.map((r) => r.author?.name),
              cardStarsSample: revs.slice(0, 3).map((r) => Number(r.reviewRating?.ratingValue)),
            });
          }
        });
      } catch (_) {}
    });
    const cards = [...document.querySelectorAll("#ar-reviews .ar-rev .st")].slice(0, 5).map((el) => el.textContent.trim());
    const heading = document.querySelector("#ar-reviews .ar-sub")?.textContent?.trim()?.replace(/\s+/g, " ") || null;
    const badge = document.querySelector(".ar-rating")?.textContent?.trim()?.replace(/\s+/g, " ") || null;
    return { products, heading, badge, cards };
  });
  console.log(JSON.stringify({ label, ...info }, null, 2));
  await page.close();
}
await browser.close();
