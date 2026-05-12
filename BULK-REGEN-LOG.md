# Bulk regeneration log — blog HowTo / FAQ

Append-only log for `npm run bulk:blog-howto-faq` (or `node scripts/bulk-regen-blog-howto-faq.mjs`).

Each line is ISO timestamp plus message. Processing uses batches (default 50 URLs); each batch ends with a git commit and push in `alanranger-schema` unless `--no-commit` is set. Runs halt if any batch exceeds a 10% error rate. Slugs containing `_event_` are skipped.

---
