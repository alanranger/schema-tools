import { chromium } from "playwright";

const cases = [
  "https://www.alanranger.com/photography-services-near-me/photography-masterclasses-coventry",
  "https://www.alanranger.com/photography-services-near-me/black-and-white-photography-course",
  "https://www.alanranger.com/free-online-photography-course",
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

for (const url of cases) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(6000);
  const info = await page.evaluate(async () => {
    const html = document.documentElement.innerHTML;
    let manifestHit = null;
    try {
      const manifest = await fetch("https://schema.alanranger.com/products-manifest.json").then((r) =>
        r.json()
      );
      const norm = (p) =>
        decodeURIComponent(String(p || ""))
          .toLowerCase()
          .replace(/\/+$/, "") || "/";
      const pk = norm(location.pathname);
      const entry = (manifest.entries || []).find((e) => norm(e.pathKey) === pk);
      manifestHit = entry || null;
    } catch (e) {
      manifestHit = { error: String(e) };
    }
    const products = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try {
        const j = JSON.parse(s.textContent || "");
        const nodes = Array.isArray(j["@graph"]) ? j["@graph"] : [j];
        nodes.forEach((n) => {
          const t = n["@type"];
          const types = Array.isArray(t) ? t : [t];
          if (types.includes("Product")) {
            products.push({
              id: n["@id"],
              count: n.aggregateRating?.reviewCount ?? null,
              sid: s.id || "",
            });
          }
        });
      } catch (_) {}
    });
    return {
      pathname: location.pathname,
      hasProductItem: !!document.querySelector(".ProductItem"),
      hasLoader: [...document.querySelectorAll("script[src]")].some((s) =>
        s.src.includes("product-page-loader")
      ),
      hasGithub: !!document.getElementById("ar-github-product-schema"),
      badge: !!document.querySelector(".ar-rating, .ar-stars"),
      manifestHit,
      products,
      hasArPbStyle: !!document.getElementById("ar-pb-style"),
    };
  });
  console.log(JSON.stringify({ url, ...info }, null, 2));
}

await browser.close();
