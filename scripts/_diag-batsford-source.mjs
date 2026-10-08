import { chromium } from "playwright";
import fs from "fs";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(
  "https://www.alanranger.com/photo-workshops-uk/batsford-arboretum-photography-workshops",
  { waitUntil: "networkidle", timeout: 90000 }
);
await page.waitForTimeout(4000);
const live = await page.evaluate(() => {
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    const t = s.textContent || "";
    if (t.length > 10000 && t.includes("Product")) return t;
  }
  return null;
});
const gh = fs.readFileSync(
  "alanranger-schema/batsford-arboretum-autumn-photography-workshops-23-31-oct_schema.json",
  "utf8"
);
console.log("liveLen", live?.length, "ghLen", gh.length);
const lj = JSON.parse(live);
const gj = JSON.parse(gh);
const lp = lj["@graph"].find((n) => n["@type"] === "Product");
const gp = gj["@graph"].find((n) => n["@type"] === "Product");
console.log("live agg", lp.aggregateRating);
console.log("gh agg", gp.aggregateRating);
console.log("emit lens", (lp.review || []).length, (gp.review || []).length);
// Is injector creating ld+json? Search page source for marker near product script
const how = await page.evaluate(() => {
  const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
  const big = scripts.find((s) => (s.textContent || "").length > 10000);
  if (!big) return null;
  return {
    parentTag: big.parentElement?.tagName,
    prevComment: big.previousSibling?.textContent?.slice(0, 120) || null,
    nextId: big.nextElementSibling?.id || null,
    hasSuppressorNearby: document.documentElement.innerHTML.includes(
      "Product Schema Suppressor v1.3"
    ),
  };
});
console.log("how", how);
await browser.close();
