import { chromium } from "playwright";

const urls = [
  "https://www.alanranger.com/photography-services-near-me/camera-sensor-clean",
  "https://www.alanranger.com/photography-services-near-me/photography-gift-vouchers",
  "https://www.alanranger.com/photography-services-near-me/beginners-photography-course",
];
const browser = await chromium.launch({ headless: true });
for (const u of urls) {
  const page = await browser.newPage();
  await page.goto(u + "?cb=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(8000);
  const info = await page.evaluate(() => ({
    path: location.pathname,
    github: !!document.getElementById("ar-github-product-schema"),
    rating: !!document.querySelector(".ar-rating"),
    ratingText: document.querySelector(".ar-rating")?.textContent?.trim()?.slice(0, 80) || null,
    reviews: !!document.getElementById("ar-reviews"),
    sub: document.querySelector("#ar-reviews .ar-sub")?.textContent?.trim()?.slice(0, 120) || null,
    accordion: document.querySelectorAll(".sqs-block-accordion").length,
    productItem: !!document.querySelector(".ProductItem"),
  }));
  console.log(JSON.stringify(info));
  await page.close();
}
await browser.close();
