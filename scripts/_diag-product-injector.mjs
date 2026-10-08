import { chromium } from "playwright";

const urls = [
  "https://www.alanranger.com/photo-workshops-uk/batsford-arboretum-photography-workshops",
  "https://www.alanranger.com/photo-workshops-uk/peak-district-heather-photography-workshop",
  "https://www.alanranger.com/photography-services-near-me/beginners-photography-course",
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

for (const url of urls) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(5000);
  const info = await page.evaluate(() => {
    const html = document.documentElement.innerHTML;
    const key = "products-manifest.json";
    const blocks = [];
    let from = 0;
    while (blocks.length < 4) {
      const i = html.indexOf(key, from);
      if (i < 0) break;
      blocks.push(html.slice(Math.max(0, i - 600), i + 900).replace(/\s+/g, " "));
      from = i + key.length;
    }
    const prods = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try {
        const j = JSON.parse(s.textContent || "");
        const nodes = Array.isArray(j["@graph"]) ? j["@graph"] : [j];
        nodes.forEach((n) => {
          const t = n["@type"];
          const types = Array.isArray(t) ? t : [t];
          if (types.includes("Product")) {
            prods.push({
              id: n["@id"],
              hasGraph: Array.isArray(j["@graph"]),
              scriptLen: (s.textContent || "").length,
              topType: j["@type"] || null,
            });
          }
        });
      } catch (_) {}
    });
    return {
      hasProductItem: !!document.querySelector(".ProductItem"),
      prods,
      blocks,
      coreV21: html.includes("Core Schema Suppressor v2.1"),
      suppressorV13: html.includes("Product Schema Suppressor v1.3"),
    };
  });
  console.log("\n====", url);
  console.log(
    "ProductItem",
    info.hasProductItem,
    "coreV21",
    info.coreV21,
    "v13",
    info.suppressorV13
  );
  console.log("prods", JSON.stringify(info.prods));
  info.blocks.forEach((b, i) => console.log("block" + i, b.slice(0, 700)));
}

await browser.close();
