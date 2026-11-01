import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error" || /ar-|product-page|schema/i.test(msg.text())) {
    console.log("CONSOLE", msg.type(), msg.text().slice(0, 200));
  }
});
const url =
  "https://www.alanranger.com/photography-services-near-me/beginners-photography-course?cb=" +
  Date.now();
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(10000);
const info = await page.evaluate(() => {
  const scripts = [...document.querySelectorAll("script[src]")].map((s) => s.src).filter((s) => s.includes("schema") || s.includes("loader"));
  const ld = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    ld.push({ id: s.id || "", len: (s.textContent || "").length, head: (s.textContent || "").slice(0, 80) });
  });
  return {
    productItem: !!document.querySelector(".ProductItem"),
    h1: document.querySelector("h1")?.textContent?.trim()?.slice(0, 80) || null,
    scripts,
    ld,
    bodyClasses: document.body.className,
    arReviews: !!document.getElementById("ar-reviews"),
    arRating: !!document.querySelector(".ar-rating"),
    github: !!document.getElementById("ar-github-product-schema"),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
