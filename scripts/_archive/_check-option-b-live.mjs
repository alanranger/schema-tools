import { chromium } from "playwright";

const urls = [
  "https://www.alanranger.com/photo-workshops-uk/batsford-arboretum-photography-workshops",
  "https://www.alanranger.com/photography-services-near-me/beginners-photography-course",
  "https://www.alanranger.com/photography-services-near-me/camera-sensor-clean/",
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

for (const url of urls) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(5000);
  const info = await page.evaluate(() => {
    const html = document.documentElement.innerHTML;
    const scripts = [...document.querySelectorAll("script[src]")].map((s) => s.src);
    const products = [];
    document
      .querySelectorAll('script[type="application/ld+json"], script[data-type="application/ld+json"]')
      .forEach((s) => {
        try {
          const j = JSON.parse(s.textContent || "");
          const nodes = Array.isArray(j["@graph"]) ? j["@graph"] : [j];
          for (const n of nodes) {
            const t = n["@type"];
            const types = Array.isArray(t) ? t : [t];
            if (types.includes("Product")) {
              products.push({
                id: n["@id"],
                count: n.aggregateRating?.reviewCount ?? null,
                scriptId: s.id || "",
              });
            }
          }
        } catch (_) {}
      });
    return {
      hasHostedLoader: scripts.some((s) => s.includes("loaders/product-page-loader.js")),
      hasGithubSchema: !!document.getElementById("ar-github-product-schema"),
      hasOldArNoReviews:
        html.includes("var AR_NO_REVIEWS = [") &&
        html.includes("fine-art-photography-prints-unframed"),
      productCount: products.length,
      products,
      badge: !!document.querySelector(".ar-rating, .ar-stars"),
    };
  });
  console.log(JSON.stringify({ url, ...info }));
}

await browser.close();
