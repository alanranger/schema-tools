# Landing Pages Pattern Cross-Check

Purpose: verify whether the About-page issues are repeated in landing/service pages before changing generator logic.

## How Many Pages

- Target sample: 2-5 landing/service pages first
- Expand to 10+ if mixed patterns appear

## URLs Under Review

- [x] URL 1: `https://www.alanranger.com/`
- [x] URL 2: `https://www.alanranger.com/photography-courses-coventry`
- [ ] URL 3:
- [ ] URL 4:
- [ ] URL 5:

## Pattern Checklist (Per URL)

Mark Y/N per page:

- Duplicate `WebSite` node present?
- Partial `Service` node missing `@id` or `name`?
- Missing `LocalBusiness.address`?
- Missing canonical `@id` on core entities?
- Mixed/duplicated `@context` style?
- Non-absolute image/URL fields?
- Rich Results valid?
- AI GEO QA: block/warn counts

## Results Table

| URL | Dup WebSite | Partial Service | Missing Address | Missing IDs | Context Mixed | Absolute URLs OK | Rich Results | QA Block | QA Warn | Notes |
|---|---|---|---|---|---|---|---|---:|---:|---|
| `https://www.alanranger.com/` | Y | Y | Y (LocalBusiness) | Y (Service `@id`) | Y | N (`//` image URL) | Pass (6 valid items) | Pending | Pending | Same pattern family as About page: duplicate WebSite, partial Service node, mixed context style |
| `https://www.alanranger.com/photography-courses-coventry` | Y | Y | Y (LocalBusiness) | Y (generic Service `@id`) | Y | N (`//` image URL) | Pass (7 valid items) | Pending | Pending | Same repeating pattern: duplicate WebSite + generic partial Service plus page-level Service node |
| URL 3 |  |  |  |  |  |  |  |  |  |  |
| URL 4 |  |  |  |  |  |  |  |  |  |  |
| URL 5 |  |  |  |  |  |  |  |  |  |  |

## Decision Rule

Only proceed with generator changes when:

1. At least 2 repeated patterns appear across multiple pages, and
2. Rich Results are preserved in all test pages after simulated fixes.

## Interim Finding (After URL 1)

Confirmed repeated issues (also seen on About page):

- duplicate `WebSite` nodes
- partial `Service` node without full canonical fields
- missing `LocalBusiness.address`
- protocol-relative image URL (`//...`)
- mixed context style inside `@graph`

This strongly suggests generator-level normalization is needed, but we will validate 1-2 more pages before implementation.

## Updated Finding (After URL 2)

Pattern is now confirmed across multiple page types (homepage + service/landing page + about page baseline):

- duplicate `WebSite` generation is systematic
- generic `Service` node is partially populated (missing canonical completeness)
- `LocalBusiness` node is consistently missing address data
- mixed context style appears repeatedly
- protocol-relative image URL appears repeatedly

At this point we have sufficient confidence to implement a small, low-risk normalization patch for shared graph generation before deeper page-type-specific enhancements.

## Proposed First Change Set (If Patterns Confirmed)

- Deduplicate `WebSite` node generation.
- Enforce minimal required fields on canonical `Service` nodes.
- Normalize canonical IDs and absolute URLs in generated output.
- Keep patch scoped to relevant page type branch only.
