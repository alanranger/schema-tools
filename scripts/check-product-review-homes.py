#!/usr/bin/env python3
"""
Guard (`npm run test:product-review-homes`, run after generate-product-schema.py):
every review emitted in a product _schema.json must carry that product's slug in the combined
reviews file. Fails if the generator attaches a review to a different (e.g. similar-named) product.
"""
import json
import re
import sys
from pathlib import Path

import pandas as pd

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

SHARED = Path(__file__).resolve().parents[2] / "alan-shared-resources"
COMBINED = SHARED / "csv processed" / "03 – combined_product_reviews.csv"
FINAL = SHARED / "csv processed" / "04 – alanranger_product_schema_FINAL_WITH_REVIEW_RATINGS.csv"
OUTPUTS = SHARED / "outputs" / "schema" / "products"


def key_text(value):
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()[:80]


def slugs_by_text():
    comb = pd.read_csv(COMBINED, encoding="utf-8-sig", dtype=str, keep_default_na=False)
    out = {}
    for _, r in comb.iterrows():
        text = r.get("reviewBody") or r.get("review_content") or r.get("review") or ""
        out.setdefault(key_text(text), set()).add(str(r.get("product_slug", "")).strip())
    return out


def emitted_reviews(schema_file):
    data = json.loads(schema_file.read_text(encoding="utf-8"))
    for node in data.get("@graph", [data]):
        reviews = node.get("review") if isinstance(node, dict) else None
        for rv in reviews if isinstance(reviews, list) else ([reviews] if reviews else []):
            yield rv


def main():
    known = slugs_by_text()
    final = pd.read_csv(FINAL, encoding="utf-8-sig", dtype=str, keep_default_na=False)
    problems = []
    checked = 0
    for _, row in final.iterrows():
        slug = row["url"].rstrip("/").split("/")[-1]
        path = OUTPUTS / row["json_file_name"]
        if not path.exists():
            continue
        for rv in emitted_reviews(path):
            checked += 1
            homes = known.get(key_text(rv.get("reviewBody")), set())
            if slug not in homes:
                problems.append(f"{slug}: {rv.get('author', {}).get('name', '')} belongs to {sorted(homes) or 'nothing'}")
    if problems:
        print(f"FAIL: {len(problems)} of {checked} emitted reviews are on a different product than their attribution")
        for p in problems[:25]:
            print(f"   {p}")
        return 1
    print(f"PASS: all {checked} emitted reviews sit on the product they are attributed to")
    return 0


if __name__ == "__main__":
    sys.exit(main())
