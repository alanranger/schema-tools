#!/usr/bin/env python3
"""
Step 2d of merge-reviews.py: Google reviews are append-only.

- A Google review already in product_reviews keeps its database product
  (csv processed/product-reviews-db-snapshot.csv, written by the review ingest).
- Alan-approved overrides (15-review-attribution-overrides.csv) still win.
- A review not yet in the database is held back: product_slug blank, the matcher's guess kept in
  suggested_product_slug, listed in 03b-google-pending-alan-review.csv until Alan confirms it
  (add it to the 15 overrides file).
- Star-only reviews (no text) are left as they are.
"""
import re
import sys
from pathlib import Path

import pandas as pd

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

PROC = Path(__file__).resolve().parents[2] / "alan-shared-resources" / "csv processed"
GOOGLE = PROC / "03b_google_matched.csv"
SNAPSHOT = PROC / "product-reviews-db-snapshot.csv"
PENDING = PROC / "03b-google-pending-alan-review.csv"
ALAN_APPROVED = {"override_15_attribution", "override_business_level", "override_exclude"}


def key_text(value):
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def review_key(name, quote):
    return f"google|{key_text(name)}|{key_text(quote)}"


def load_db_slugs():
    snap = pd.read_csv(SNAPSHOT, encoding="utf-8-sig", dtype=str, keep_default_na=False)
    snap = snap[snap["source"] == "Google"]
    return {review_key(r["reviewer_name"], r["quote"]): r["product_slug"] for _, r in snap.iterrows()}


def decide(row, db_slugs):
    """Return (product_slug, attribution_source) for one Google row, or None to leave it."""
    text = str(row.get("review", "")).strip()
    attribution = str(row.get("attribution_source", "")).strip()
    if not text or attribution in ALAN_APPROVED:
        return None
    key = review_key(row.get("reviewer", ""), text)
    if key in db_slugs:
        return db_slugs[key], "db_locked"
    return "", "pending_alan_review"


def main():
    if not SNAPSHOT.exists():
        print(f"ERROR: DB snapshot missing: {SNAPSHOT} (run ingest-product-reviews.mjs --snapshot-only)")
        return 1
    db_slugs = load_db_slugs()
    df = pd.read_csv(GOOGLE, encoding="utf-8-sig", dtype=str, keep_default_na=False)
    for col in ("attribution_source", "suggested_product_slug"):
        if col not in df.columns:
            df[col] = ""
    reverted, pending = [], []
    for idx, row in df.iterrows():
        result = decide(row, db_slugs)
        if result is None:
            continue
        slug, label = result
        current = str(row.get("product_slug", "")).strip()
        if label == "pending_alan_review":
            df.at[idx, "suggested_product_slug"] = current
            pending.append(idx)
        elif slug != current:
            reverted.append(f"{row.get('reviewer', '')}: {current or '(none)'} -> {slug} [{row.get('attribution_source', '') or 'matcher'}]")
        df.at[idx, "product_slug"] = slug
        df.at[idx, "attribution_source"] = label
        if label == "pending_alan_review" or slug != current:
            df.at[idx, "product_name"] = ""
    df.to_csv(GOOGLE, index=False, encoding="utf-8-sig")
    cols = [c for c in ("date", "reviewer", "rating", "suggested_product_slug", "review") if c in df.columns]
    df.loc[pending, cols].to_csv(PENDING, index=False, encoding="utf-8-sig")
    print(f"Google lock: {len(db_slugs)} DB attributions kept; {len(reverted)} reverted to DB; {len(pending)} new held as pending")
    for line in reverted:
        print(f"   reverted {line}")
    print(f"Pending list for Alan: {PENDING.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
