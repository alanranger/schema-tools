# Schema Tools: how blog FAQ schema is generated

This describes the **Blog Posts** workflow in the **Unified Schema Generator** ([schema-tools-six.vercel.app](https://schema-tools-six.vercel.app/)). The behaviour is implemented in `index.html` in this repository (browser bundle shared with the Vercel deploy).

## Summary

- The tool can emit a separate **`{slug}_faq.json`** file (alongside other per-post artefacts such as `*_schema.json`).
- **Whether** a FAQ file is created uses **real page signals** (HTML, main content, optional snippet loads) to **avoid duplicating** an existing FAQ on the page.
- **What** goes into that file, when generated, is **mostly a fixed template** of generic photography Q&As. The post **title/headline** is woven into the first answer; the rest does not parse the article body for real Q&As.

## Flow

1. During blog generation, `generateFAQSchema` runs with the CSV row (URL, title, etc.), the built **BlogPosting** object, **`articleBody`**, and page **HTML**.

2. **Duplicate avoidance** runs first via `hasExistingFAQBlock` and `hasExistingFAQBlockWithSnippets`. Signals include:
   - Existing **`FAQPage` JSON-LD** in the HTML.
   - **`<h2>` / `<h3>`** headings that match FAQ patterns.
   - Squarespace-style **FAQ block** selectors (e.g. classes / `data-section-type`).
   - Strict **main-content** text markers (e.g. “frequently asked questions”).
   - **Snippet-loader** targets: extra HTML may be fetched and scanned so lazy-loaded FAQ content is not missed.

   If an existing FAQ is detected, the function returns **`null`** and **no** `{slug}_faq.json` is produced.

3. If no existing FAQ is detected, the tool builds a **`FAQPage`** with **eight hard-coded `Question` / `Answer` pairs** (commented in source as a “generic” pattern). Only the **headline** parameter customises wording (notably in the first answer).

## Source references

FAQ generation (skip vs template):

```10908:11018:G:\Dropbox\alan ranger photography\Website Code\Schema Tools\index.html
  async function generateFAQSchema(csvRow, blogPosting, articleBody, html) {
    // ... detection via hasExistingFAQBlockWithSnippets ...
    // If hasFAQ → return null; else build faqItems + FAQPage
  }
```

FAQ detection on the live page HTML / content:

```10600:10742:G:\Dropbox\alan ranger photography\Website Code\Schema Tools\index.html
  function hasExistingFAQBlock(html, plainText, debugLog = null) {
    // FAQPage in JSON-LD, h2/h3 FAQ headings, block selectors, main content markers, etc.
  }
```

## Is it specific to each article’s topic and content?

**Mostly no.** The Q&A text is **reused** across posts. The main article-specific input is the **post title / headline** in one answer line. The implementation does **not** extract factual Q&A from the article headings or paragraphs to populate `mainEntity`.

## Editorial / Google notes

FAQ rich results expect the structured data to reflect **FAQ content that is visible on the page**. A generic template may not match on-page content. See Google’s FAQ documentation and guidelines:

- [FAQ structured data (`FAQPage`)](https://developers.google.com/search/docs/appearance/structured-data/faqpage)

For production use, prefer **real** FAQs (either authored on the page and mirrored in markup, or generated only from extracted on-page Q&A)—and keep the duplicate-detection path so two FAQ blocks are not asserted for the same URL.

## Related

- Detection regression / batch checks: `scripts/test-faq-detection.js` (logic aligned with extraction from `index.html`).
