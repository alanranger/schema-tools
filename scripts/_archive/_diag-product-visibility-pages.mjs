import { chromium } from "playwright";

const urls = [
  "https://www.alanranger.com/photography-services-near-me/beginners-photography-course",
  "https://www.alanranger.com/photo-workshops-uk/batsford-arboretum-photography-workshops",
  "https://www.alanranger.com/photo-workshops-uk/peak-district-heather-photography-workshop",
  "https://www.alanranger.com/photo-workshops-uk/bluebell-woodlands-photography-workshops",
  "https://www.alanranger.com/free-online-photography-course",
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

for (const url of urls) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(6000);
  const info = await page.evaluate(() => {
    const html = document.documentElement.innerHTML;
    const markers = [
      "Core Schema Suppressor v2.1",
      "Product Schema Suppressor v1.3",
      "removeProductSchema",
      "schema.alanranger.com",
      "products-manifest",
      "arp-critical-schema",
      "CANONICAL_ID_SUFFIXES",
    ].map((m) => [m, html.includes(m)]);

    const products = [];
    for (const s of document.querySelectorAll(
      'script[type="application/ld+json"], script[data-type="application/ld+json"]'
    )) {
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
              len: (s.textContent || "").length,
            });
          }
        }
      } catch (_) {}
    }

    let remSnippet = "";
    const idx = html.indexOf("removeProductSchema");
    if (idx >= 0) remSnippet = html.slice(Math.max(0, idx - 100), idx + 500);

    let loaderSnippet = "";
    const li = html.indexOf("schema.alanranger.com");
    if (li >= 0) loaderSnippet = html.slice(Math.max(0, li - 120), li + 400);

    const ldIds = [...document.querySelectorAll("script")]
      .filter((s) => (s.type || "").includes("ld+json") || s.id === "arp-critical-schema")
      .map((s) => ({ id: s.id || "", type: s.type || "", len: (s.textContent || "").length }));

    return { markers, products, remSnippet, loaderSnippet, ldIds };
  });

  console.log("\n====", url);
  console.log("products", JSON.stringify(info.products));
  console.log(
    "markers",
    info.markers.filter((x) => x[1]).map((x) => x[0]).join(", ")
  );
  console.log("ldIds", JSON.stringify(info.ldIds.slice(0, 12)));
  console.log("rem", info.remSnippet.replace(/\s+/g, " ").slice(0, 400));
  console.log("loader", info.loaderSnippet.replace(/\s+/g, " ").slice(0, 400));
}

await browser.close();
