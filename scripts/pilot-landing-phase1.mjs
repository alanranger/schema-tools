import puppeteer from 'puppeteer';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_TARGET_URLS = [
  'https://www.alanranger.com/about-alan-ranger',
  'https://www.alanranger.com/photography-services-near-me',
  'https://www.alanranger.com/newsletter-signup-form',
  'https://www.alanranger.com/photography-courses-coventry',
  'https://www.alanranger.com/home',
  'https://www.alanranger.com/landscape-photography-workshops'
];

async function fetchFailingLandingUrlsFromApi() {
  const endpoint = 'https://ai-geo-audit.vercel.app/api/aigeo/content-extractability?mode=full&tier=landing';
  const response = await fetch(endpoint, {
    headers: { 'User-Agent': 'SchemaTools-Pilot/1.0' }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch landing failures (${response.status})`);
  }
  const payload = await response.json();
  const rows = Array.isArray(payload?.data?.rows) ? payload.data.rows : [];
  return rows
    .filter((row) => row && row.pass === false && typeof row.url === 'string' && row.url.startsWith('http'))
    .map((row) => row.url);
}

async function runPilot() {
  const args = new Set(process.argv.slice(2).map((value) => String(value || '').trim()));
  let targetUrls = DEFAULT_TARGET_URLS;
  if (args.has('--landing-fails')) {
    const fromApi = await fetchFailingLandingUrlsFromApi();
    if (!fromApi.length) {
      throw new Error('No failing landing URLs returned from API.');
    }
    targetUrls = fromApi;
  }

  const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 0 });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    const indexPath = path.resolve(process.cwd(), 'index.html');
    const fileUrl = pathToFileURL(indexPath).toString();
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });

    const hasFunctions = await page.evaluate(() => {
      return {
        fetchProductPage: typeof window.fetchProductPage === 'function',
        enrichHtmlWithSnippetLoaderContent: typeof window.enrichHtmlWithSnippetLoaderContent === 'function',
        htmlToPlainText: typeof window.htmlToPlainText === 'function',
        hasExistingFAQBlockWithSnippets: typeof window.hasExistingFAQBlockWithSnippets === 'function',
        generateLandingFaqSchema: typeof window.generateLandingFaqSchema === 'function',
        buildLandingTldrSummary: typeof window.buildLandingTldrSummary === 'function'
      };
    });
    if (Object.values(hasFunctions).some((ok) => !ok)) {
      throw new Error(`Required functions missing on page context: ${JSON.stringify(hasFunctions)}`);
    }

    const diagnostics = [];
    for (const url of targetUrls) {
      // Evaluate each URL individually to avoid long single CDP call timeouts.
      // eslint-disable-next-line no-await-in-loop
      const row = await page.evaluate(async (candidateUrl) => {
        try {
          const html = await window.fetchProductPage(candidateUrl);
          const htmlForScan = await window.enrichHtmlWithSnippetLoaderContent(candidateUrl, html);
          const plain = window.htmlToPlainText(htmlForScan || html || '');
          const hasFaq = await window.hasExistingFAQBlockWithSnippets(candidateUrl, htmlForScan || html, plain);
          const fallbackFaq = hasFaq
            ? null
            : window.generateLandingFaqSchema(candidateUrl, 'Pilot Landing Title', 'Pilot description for landing page diagnostics.', 'Service');
          const tldr = window.buildLandingTldrSummary('Pilot Landing Title', 'Pilot description for landing page diagnostics.', 'Service');
          return {
            url: candidateUrl,
            htmlLength: Number((html || '').length),
            hasFaqSignal: Boolean(hasFaq),
            fallbackFaqGenerated: Boolean(fallbackFaq && fallbackFaq['@type'] === 'FAQPage'),
            fallbackFaqQuestionCount: Array.isArray(fallbackFaq?.mainEntity) ? fallbackFaq.mainEntity.length : 0,
            tldrLength: Number((tldr || '').length),
            tldrPreview: String(tldr || '').slice(0, 100)
          };
        } catch (error) {
          return {
            url: candidateUrl,
            error: String(error?.message || error)
          };
        }
      }, url);
      diagnostics.push(row);
    }

    const withErrors = diagnostics.filter((row) => row.error || row.fatal);
    const noFaqSignal = diagnostics.filter((row) => row.hasFaqSignal === false && !row.error && !row.fatal).length;
    const generatedFaq = diagnostics.filter((row) => row.fallbackFaqGenerated === true).length;
    const skippedFaq = diagnostics.filter((row) => row.hasFaqSignal === true).length;

    console.log('Landing Phase 1 Pilot Dry Run');
    console.log('=============================');
    console.log(`Checked URLs: ${diagnostics.length}`);
    console.log(`Errors: ${withErrors.length}`);
    console.log(`No FAQ signal detected: ${noFaqSignal}`);
    console.log(`Fallback FAQ generated: ${generatedFaq}`);
    console.log(`FAQ generation skipped (existing FAQ signal): ${skippedFaq}`);
    console.log('');
    diagnostics.forEach((row) => {
      if (row.error || row.fatal) {
        console.log(`ERROR | ${row.url || 'N/A'} | ${row.error || row.fatal}`);
        return;
      }
      console.log(
        `OK | ${row.url} | faqSignal=${row.hasFaqSignal} | fallbackFaq=${row.fallbackFaqGenerated} (${row.fallbackFaqQuestionCount}) | tldrLen=${row.tldrLength}`
      );
    });
  } finally {
    await browser.close();
  }
}

runPilot().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
