#!/usr/bin/env python3
"""
Guard (`npm run test:review-dates`, run after generate-product-schema.py): every review emitted in a
product _schema.json must carry the database review_date as datePublished. Catches month-first
parsing of Trustpilot DD/MM/YYYY dates (12 Jan published as 1 Dec).
"""
import json
import re
import sys
from pathlib import Path

import pandas as pd

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

SHARED = Path(__file__).resolve().parents[2] / "alan-shared-resources"
SNAPSHOT = SHARED / "csv processed" / "product-reviews-db-snapshot.csv"
FINAL = SHARED / "csv processed" / "04 – alanranger_product_schema_FINAL_WITH_REVIEW_RATINGS.csv"
OUTPUTS = SHARED / "outputs" / "schema" / "products"


def key_text(value):
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()[:80]


def db_dates():
    snap = pd.read_csv(SNAPSHOT, encoding="utf-8-sig", dtype=str, keep_default_na=False)
    out = {}
    for _, r in snap.iterrows():
        out.setdefault((key_text(r["reviewer_name"]), key_text(r["quote"])), set()).add(str(r["review_date"])[:10])
    return out


def emitted_reviews():
    files = pd.read_csv(FINAL, encoding="utf-8-sig", dtype=str)["json_file_name"].dropna().unique()
    for name in files:
        path = OUTPUTS / name
        if not path.exists():
            continue
        graph = json.loads(path.read_text(encoding="utf-8")).get("@graph", [])
        for node in graph:
            for review in node.get("review", []) if isinstance(node, dict) else []:
                yield name, review


def main():
    dates = db_dates()
    checked, mismatches, unmatched = 0, [], 0
    for name, review in emitted_reviews():
        key = (key_text(review.get("author", {}).get("name")), key_text(review.get("reviewBody")))
        if key not in dates:
            unmatched += 1
            continue
        checked += 1
        published = str(review.get("datePublished", ""))[:10]
        if published not in dates[key]:
            mismatches.append(f"{name}: {review.get('author', {}).get('name')} published {published or '(none)'}, DB {sorted(dates[key])}")
    for line in mismatches[:40]:
        print(f"FAIL {line}")
    print(f"{checked} emitted reviews checked against the database ({unmatched} without a DB match); {len(mismatches)} date mismatches")
    if not mismatches:
        print("PASS: every emitted datePublished equals the database review_date")
    return 1 if mismatches else 0


if __name__ == "__main__":
    sys.exit(main())
