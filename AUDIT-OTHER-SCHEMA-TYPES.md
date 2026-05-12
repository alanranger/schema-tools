# Audit: other blog schema artefact types (read-only review)

**Repository:** [schema-tools](https://github.com/alanranger/schema-tools) (`index.html` and related helpers)  
**Output repository:** [alanranger-schema](https://github.com/alanranger/alanranger-schema) (root-level `{slug}_*.json` files)  
**Date:** 2026-05-12  

This document satisfies Task 2 of the HowTo remediation brief: a read-only audit of remaining artefact generators **before** any bulk regeneration. No generator code was changed for this audit (except the separate HowTo fix already committed).

---

## `_blogposting.json`

- **Generator:** `generateBlogPostingSchema` — `index.html` (approximately lines 10257–10327).  
- **Primary input:** `buildEnrichedBlogPosting(csvRow, providedHtml)` which merges **Supabase `page` entity fields** (title, meta description, dates, image URL, dimensions) with **HTML-derived `articleBody`** (stripped and cleaned) and optional **embedded `VideoObject`** payloads from the live HTML.  
- **Sample:** [what-is-aperture-in-photography_blogposting.json](https://github.com/alanranger/alanranger-schema/blob/main/what-is-aperture-in-photography_blogposting.json) — `headline`, `description`, ISO dates, `articleBody`, `wordCount`, `image` `@id`, `inLanguage: en-GB`, optional `video`.  
- **Verdict:** **Clean** — content is article-specific from Supabase + page HTML, not a canned FAQ-style template.  
- **Notes:** `articleBody` quality depends on `cleanFullArticleBody`; that is long-text hygiene, not a “fake schema” pattern. Watch for rare navigation bleed-through if cleaning regresses.

---

## `_image.json`

- **Generator:** `generateImageObjectSchema` — `index.html` (approximately lines 10978+ in current tree, immediately after FAQ helpers).  
- **Primary input:** `blogPosting.thumbnailUrl` / `blogPosting.image` / `csvRow.imageUrl`, plus dimensions from entity or CDN URL patterns.  
- **Sample:** [what-is-aperture-in-photography_image.json](https://github.com/alanranger/alanranger-schema/blob/main/what-is-aperture-in-photography_image.json) — real Squarespace CDN `url`, `width` / `height`, `caption`, `inLanguage: en-GB`.  
- **Verdict:** **Clean** — uses real image URLs; default 1500×1000 only applies when dimensions cannot be inferred.  
- **Notes:** If no image is found, the generator returns `null` and no file is emitted (safe).

---

## `_breadcrumb.json`

- **Generator:** `generateBreadcrumbSchema` — `index.html` (approximately lines 10331–10352).  
- **Primary input:** `csvRow.url` and `csvRow.title` (fixed “Blog” parent + current post title).  
- **Sample:** [what-is-aperture-in-photography_breadcrumb.json](https://github.com/alanranger/alanranger-schema/blob/main/what-is-aperture-in-photography_breadcrumb.json) — two `ListItem` entries: blog index URL and the article URL.  
- **Verdict:** **Clean** — structure is deterministic and matches the site section; not prose-heavy.  
- **Notes:** Titles come from the CSV row; if the CSV title is stale versus the live H1, the breadcrumb **name** could drift, but that is a data issue, not a template spam pattern.

---

## `_schema.json` (WebPage only)

- **Generator:** `generateWebPageSchema` — `index.html` (approximately lines 10224–10250).  
- **Primary input:** Same `buildEnrichedBlogPosting` object for `name` / `description`; `url` from the row.  
- **Sample:** [what-is-aperture-in-photography_schema.json](https://github.com/alanranger/alanranger-schema/blob/main/what-is-aperture-in-photography_schema.json) — `WebPage` with `mainEntity` pointing at `#blogposting`.  
- **Verdict:** **Mostly clean** — headline and meta description are real when Supabase/entity data is present.  
- **Notes:** There is a **fallback description string** (`Webpage for a blog article on Alan Ranger Photography.`) when both `blogPosting.description` and `csvRow.metaDescription` are empty (see `generateWebPageSchema`). That is a **harmless placeholder** for edge cases, not cross-article duplicate body spam. Flag as **templated but harmless** only when that branch fires.

---

## `_event_schema.json` / `_event_faq.json`

- **Generator:** Event workflow lives in separate tabs/blocks in `index.html` (event CSV pipeline; filenames such as `${slug}_event_schema.json` appear around line 13821 in the event export path).  
- **Primary input:** Squarespace **events export CSV**, optional **event–product mappings**, **reviews** enrichment — not the blog article HTML pipeline.  
- **Sample:** Inspect any `*_event_schema.json` in [alanranger-schema](https://github.com/alanranger/alanranger-schema) (root).  
- **Verdict:** **Separate system** — blog FAQ extraction (`scripts/faq-extraction.mjs` + `generateFAQSchema`) does **not** drive event FAQ files; event FAQ is produced by the event generator path. No evidence in this audit that it shares the removed blog HowTo template bug.  
- **Notes:** Event output should still be sanity-checked periodically (dates, `offers`, geo), but that is outside the blog HowTo/FAQ scope.

---

## Red-flag checklist (summary)

| Red flag | BlogPosting | ImageObject | BreadcrumbList | WebPage | Event artefacts |
|----------|-------------|-------------|----------------|---------|-------------------|
| Generic multi-article prose templates | Not observed | N/A | N/A | Fallback description only | Not audited in depth here |
| HTML inside JSON strings | Low risk (`articleBody` is plain text) | Low risk | N/A | Low risk | Unknown without spot files |
| 400+ char “step” blobs | N/A | N/A | N/A | N/A | N/A for events in this pass |

---

## Conclusion

After the **HowTo** generator fix, the remaining **blog** artefacts reviewed here (`_blogposting.json`, `_image.json`, `_breadcrumb.json`, `_schema.json`) are **article- or URL-grounded** and do **not** mirror the old FAQ/HowTo failure mode (canned Q&A or random paragraph “steps”). **Event** outputs use a different pipeline; treat them as a separate QA surface.

**Recommendation:** Proceed with **single-URL** regeneration smoke tests per type after deploy; defer **bulk** regeneration until HowTo outputs have been spot-checked on a few procedural posts.
