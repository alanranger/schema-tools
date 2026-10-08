# Schema Quality Rollout Framework

This folder defines the safe process for improving schema quality without breaking live output.

## Goal

Upgrade schema generation one page type at a time so output is:

- clean and deduplicated
- linked with stable canonical IDs
- optimized for AI/entity understanding
- still valid for Google rich results where applicable

## Non-Negotiable Rules

1. Change one page type per PR.
2. Keep old behavior available until sign-off.
3. Require baseline snapshots before code changes.
4. Pass all quality gates before rollout.
5. Record before/after metrics for traceability.

## Workflow

1. Create a page-type spec from `gold-standard-template.md`.
2. Capture baseline outputs and validator evidence.
3. Implement updates for that page type only.
4. Run `test-gate-checklist.md`.
5. Deploy canary subset and re-check.
6. Approve and promote.

## Initial Priority Order

1. About pages (pilot)
2. Service / landing pages
3. Product pages
4. Event pages
5. Blog post pages
6. Blog index pages

## Inputs Needed From You

For each page type, share:

- 10-50 representative URLs
- current generator output examples (before)
- known edge cases (duplicates, missing fields, Squarespace quirks)
- validator screenshots or exported results

We will use those inputs to score current output against the gold standard before touching code.
