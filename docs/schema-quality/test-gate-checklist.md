# Test Gate Checklist (Before/After)

Run this checklist for each page type change.

---

## A) Baseline Capture (Before Any Code Change)

- [ ] Freeze URL test set (10-50 URLs).
- [ ] Save current generated schema outputs.
- [ ] Capture Schema.org validator results.
- [ ] Capture Google Rich Results results (where applicable).
- [ ] Capture AI GEO QA metrics:
  - [ ] block issue count
  - [ ] warning count
  - [ ] duplicate-type findings

## B) Implementation Safety

- [ ] Only one page type changed in this PR.
- [ ] Existing generator path preserved (rollback possible).
- [ ] New logic scoped to selected page type only.
- [ ] Canonical ID strategy documented.

## C) Automated/Scripted Checks

- [ ] Required fields test passes for target page type.
- [ ] Dedupe test passes.
- [ ] Deterministic output check passes (same input => same output).
- [ ] No syntax/parse errors in generated JSON-LD.

## D) Validator Checks (After Change)

- [ ] Schema.org validator: no new critical errors.
- [ ] Google Rich Results: no regression in valid items.
- [ ] AI GEO QA: block issues not worse than baseline.
- [ ] AI GEO QA: warning trend improved or justified.

## E) Manual Spot Checks

- [ ] About one high-authority URL verified.
- [ ] One edge-case URL verified.
- [ ] Live page source confirms expected schema is present.
- [ ] Duplicate/partial nodes reviewed manually.

## F) Release Gate

- [ ] Canary subset run and verified.
- [ ] Rollback path confirmed.
- [ ] Before/after evidence attached to PR.
- [ ] Sign-off recorded.

---

## PR Evidence Bundle (Required)

- URL test set used
- Before/after sample JSON-LD (at least 3 URLs)
- Validator screenshots/exports
- QA metrics delta table
- Any accepted exceptions with reason
