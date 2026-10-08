# Pilot: About Pages (Phase 1)

This is the first controlled rollout using the framework.

## Scope

- Page type: About pages
- Primary reference URL: `https://www.alanranger.com/about-alan-ranger`
- Target: clean canonical graph with no harmful duplicates and no rich-result regression

## Inputs To Fill In

### URL Set

- [x] Primary URL captured: `https://www.alanranger.com/about-alan-ranger`
- [ ] Add 2-5 additional about/brand profile URLs (if available)

### Current Output Samples (Before)

- [x] Generator output pasted for reference URL
- [ ] Paste/export 2 additional sample outputs

### Current Validator Results (Before)

- [x] Schema.org results attached (screenshot)
- [x] Rich Results results attached (screenshot)
- [x] AI GEO QA row attached (8 issues: 5 block, 3 warning)

## Gold Standard for This Pilot (Draft)

Canonical expectations:

- `Organization` canonical node: `@id`, `name`, `url` required
- `LocalBusiness` canonical node: `@id`, `name`, `address`, `telephone` required
- `Person` canonical node for Alan: stable `@id`, `name`, `jobTitle` recommended
- `WebPage` linked to canonical entity nodes via ID references
- duplicate partial nodes removed or normalized

## Current State Scorecard (Reference URL)

URL: `https://www.alanranger.com/about-alan-ranger`

### Pass

- Rich Results currently valid (3 items detected: Breadcrumbs, LocalBusiness, Organization)
- Canonical org/person IDs are partially in place (`#org`, `#person`)
- Person node includes strong `sameAs` profile links

### Gaps (Needs Improvement)

- Duplicate `WebSite` nodes (should be one canonical node)
- One partial `Service` node missing `@id` and `name`
- `LocalBusiness` missing `address` (required by current QA gate)
- Mixed context style (`@context` repeated inside nodes)
- `Person.url` may not match canonical about URL
- One description field contains HTML markup
- One image uses protocol-relative URL (`//...`) instead of absolute `https://...`

### QA Baseline Snapshot

- QA status: `block_deploy`
- Block issues: `5`
- Warning issues: `3`
- Top issue families:
  - `missing_required_field`
  - `missing_id`

## Pass/Fail Gates

- [x] No drop in Rich Results validity (baseline recorded)
- [ ] Required canonical fields complete
- [ ] Duplicate entity nodes reduced
- [ ] QA block issues improved vs baseline

## Decision

- Status: `baseline_complete`
- Notes:
  - Generator output is usable and not fundamentally broken for rich results.
  - Output is not yet "gold standard" due to duplicate/partial nodes and canonical completeness gaps.
  - Proceed with cautious, page-type-only fixes after landing-page pattern cross-check.

## Planned Safe Fixes (About Page Only)

1. Keep one canonical `WebSite` node (`#website`) and remove duplicate.
2. Keep one canonical org/local business identity node (`#org`) with complete required fields.
3. Remove or complete partial `Service` node (must include `@id`, `name`, `provider`).
4. Normalize canonical URLs (`Person.url`, page URL references).
5. Ensure all URLs/images are absolute (`https://...`).

## Pattern Validation Before Coding

Before implementing generator changes, run the same scorecard on 2-5 landing/service pages to confirm these are repeated patterns and not About-page-only quirks.
