# Gold Standard Template (Per Page Type)

Use this file as a copy template for each page type.

---

## 1) Page Type

- Name:
- URL pattern(s):
- Example URLs:

## 2) Purpose

- Primary search intent:
- AI citation/entity intent:
- Rich result intent (if any):

## 3) Required Nodes (Hard Requirement)

List required schema node types for this page type.

Example:

- `WebPage`
- `Organization`
- `LocalBusiness` (if location/service context applies)
- `Person` (for About/author contexts)

## 4) Required Fields by Node (Block If Missing)

Define strict minimum fields.

Example format:

- `Organization`: `@id`, `name`, `url`
- `LocalBusiness`: `@id`, `name`, `address`, `telephone`
- `Service`: `@id`, `name`, `provider`
- `WebPage`: `@id`, `url`, `name`

## 5) Recommended Fields (Warning If Missing)

Fields that improve quality/AI understanding but do not block deploy.

Example:

- `Organization`: `logo`, `sameAs`
- `Person`: `jobTitle`, `sameAs`, `affiliation`
- `Service`: `areaServed`, `offers`, `serviceType`

## 6) Graph Linking Rules

Define canonical entity IDs and links.

- Canonical `Organization @id`:
- Canonical `LocalBusiness @id`:
- Canonical `Person @id`:
- Link requirements:
  - `WebPage.publisher -> Organization @id`
  - `WebPage.about -> Person @id` (About pages)
  - `Service.provider -> Organization/Person @id`

## 7) Deduplication Rules

- One canonical top-level node per entity type unless intentionally multi-instance.
- Remove duplicate partial nodes.
- If multi-instance is valid, require unique `@id` and clear differentiation.

## 8) Rich Results Compatibility

- Eligible rich result types for this page type:
- Must not regress from current pass state.
- Validation tools to check:
  - Google Rich Results Test
  - Schema.org Validator

## 9) AI Visibility Enhancements

Entity clarity requirements:

- Stable, absolute `@id` URIs.
- Consistent entity naming across pages.
- `sameAs` profiles where confidence-helpful.
- Clear page-to-entity mapping (`mainEntity`, `about`, `publisher`, `provider`).

## 10) Edge Cases

- JS-injected schema
- inherited/listing schema
- noindex/private pages
- missing CMS fields

## 11) Acceptance Criteria

All must pass:

- No new rich-results regressions.
- Required fields complete for canonical nodes.
- Duplicate entity nodes reduced/eliminated.
- QA block issues reduced vs baseline.
- Output deterministic for same input.
