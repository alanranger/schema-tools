/**
 * Extract the full ar-pb / product header injection from a live store product page.
 */
import { chromium } from "playwright";
import fs from "fs";

const OUT_DIR =
  "G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/outputs/schema";

const targets = [
  {
    name: "workshops",
    url: "https://www.alanranger.com/photo-workshops-uk/batsford-arboretum-photography-workshops",
  },
  {
    name: "services",
    url: "https://www.alanranger.com/photography-services-near-me/beginners-photography-course",
  },
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

for (const t of targets) {
  await page.goto(t.url, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(3000);
  const extracted = await page.evaluate(() => {
    const html = document.documentElement.innerHTML;
    // Prefer the INSTALL comment block that marks the product header injection
    const markers = [
      "INSTALL: Squarespace > Pages > [store page",
      "SCHEMA_HOST: 'https://schema.alanranger.com/'",
      "var AR_NO_REVIEWS",
      "Core Schema Suppressor v2.1",
    ];
    const finds = {};
    for (const m of markers) finds[m] = html.indexOf(m);

    // Extract largest contiguous script that contains SCHEMA_HOST + AR_NO_REVIEWS
    let best = "";
    const scripts = [...document.querySelectorAll("script:not([src])")];
    for (const s of scripts) {
      const txt = s.textContent || "";
      if (txt.includes("SCHEMA_HOST") && txt.includes("AR_NO_REVIEWS")) {
        if (txt.length > best.length) best = txt;
      }
    }

    // Also capture HTML comments immediately before that script if present in raw HTML
    let commentPrefix = "";
    const installIdx = html.indexOf("INSTALL: Squarespace > Pages > [store page");
    if (installIdx >= 0) {
      commentPrefix = html.slice(Math.max(0, installIdx - 40), installIdx + 1200);
    }

    // Core suppressor separate script?
    let coreSuppressor = "";
    const coreIdx = html.indexOf("Core Schema Suppressor v2.1");
    if (coreIdx >= 0) {
      coreSuppressor = html.slice(coreIdx, coreIdx + 3500);
    }

    return {
      finds,
      scriptLen: best.length,
      script: best,
      commentPrefix,
      coreSuppressor,
      hasCoreOnPage: coreIdx >= 0,
    };
  });

  fs.writeFileSync(
    `${OUT_DIR}/extract-header-${t.name}-2026-10-07.js`,
    extracted.script,
    "utf8"
  );
  fs.writeFileSync(
    `${OUT_DIR}/extract-header-${t.name}-meta-2026-10-07.json`,
    JSON.stringify(
      {
        url: t.url,
        scriptLen: extracted.scriptLen,
        finds: extracted.finds,
        hasCoreOnPage: extracted.hasCoreOnPage,
        commentPrefix: extracted.commentPrefix.slice(0, 1500),
        coreSuppressorPreview: extracted.coreSuppressor.slice(0, 2000),
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(t.name, "scriptLen", extracted.scriptLen, "core", extracted.hasCoreOnPage);
}

await browser.close();
