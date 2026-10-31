#!/usr/bin/env python3
"""
Explain combined reviews (03 – combined_product_reviews.csv) against product_reviews (DB snapshot),
row by row, and print one JSON object. Used by the Update-all reviews step.

  combined = db - excluded_dropped - removed_from_google - gone_from_google + business_level + star_only + new_not_in_db

Standing rule (Alan, 31 Oct 2026): a Google review no longer returned by the fetch is excluded automatically
("removed from Google (auto, <date>)"); if it comes back, the automatic exclusion is lifted. The plan is in
`to_exclude` / `to_unexclude` (DB ids); the runner applies it.
"""
import json
import re
import sys
from pathlib import Path

import pandas as pd

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

PROC = Path(__file__).resolve().parents[2] / "alan-shared-resources" / "csv processed"


def key_text(value):
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()[:60]


def combined_rows():
    df = pd.read_csv(PROC / "03 – combined_product_reviews.csv", encoding="utf-8-sig", dtype=str, keep_default_na=False)
    for _, r in df.iterrows():
        name = r.get("reviewer") or r.get("review_username")
        text = r.get("review") or r.get("review_content") or r.get("reviewBody")
        yield r["source"], key_text(name), key_text(text), r


def classify_extra(row, text_key):
    if row.get("attribution_source") == "override_business_level":
        return "business_level"
    if not text_key:
        return "star_only"
    return "new_not_in_db"


AUTO_REASON = "removed from Google (auto,"


def label(r):
    return f"{r['source']} {r['reviewer_name']} ({r['review_date']})"


def ref(r):
    return {"id": r.get("id", ""), "name": label(r)}


def removed_from_google(r):
    return str(r.get("exclude_reason", "")).lower().startswith("removed from google")


def split_missing(missing, excluded_names):
    """DB rows not in combined: excluded by Alan, already excluded as removed from Google, or newly gone."""
    alan = lambda r: (r["source"], key_text(r["reviewer_name"])) in excluded_names
    removed = [r for r in missing if r["is_excluded"] == "yes" and removed_from_google(r)]
    excluded = [r for r in missing if r not in removed and (r["is_excluded"] == "yes" or alan(r))]
    gone = [r for r in missing if r not in removed and r not in excluded]
    return excluded, removed, gone


def main():
    db = pd.read_csv(PROC / "product-reviews-db-snapshot.csv", encoding="utf-8-sig", dtype=str, keep_default_na=False)
    db_keys = {(r["source"], key_text(r["reviewer_name"]), key_text(r["quote"])): r.to_dict() for _, r in db.iterrows()}
    seen, counts, names = set(), {"business_level": 0, "star_only": 0, "new_not_in_db": 0}, {"new_not_in_db": []}
    total = 0
    for source, name, text, row in combined_rows():
        total += 1
        seen.add((source, name, text))
        if (source, name, text) not in db_keys:
            kind = classify_extra(row, text)
            counts[kind] += 1
            if kind == "new_not_in_db":
                names[kind].append(f"{source} {row.get('reviewer') or row.get('review_username')}")
    overrides = pd.read_csv(PROC / "15-review-attribution-overrides.csv", encoding="utf-8-sig", dtype=str, keep_default_na=False)
    excluded_names = {(o["source"], key_text(o["reviewer_name"])) for _, o in overrides.iterrows() if o["scope"] == "exclude"}
    missing = [r for k, r in db_keys.items() if k not in seen]
    excluded, removed, gone = split_missing(missing, excluded_names)
    back = [r for k, r in db_keys.items() if k in seen and str(r.get("exclude_reason", "")).startswith(AUTO_REASON)]
    out = {"combined": total, "db": len(db), **counts, "excluded_dropped": len(excluded),
           "removed_from_google": len(removed), "gone_from_google": len(gone),
           "excluded_names": [label(r) for r in excluded], "removed_names": [label(r) for r in removed],
           "gone_names": [label(r) for r in gone], "new_names": names["new_not_in_db"],
           "to_exclude": [ref(r) for r in gone if r["source"] == "Google"],
           "to_unexclude": [ref(r) for r in back]}
    out["balanced"] = out["db"] - out["excluded_dropped"] - out["removed_from_google"] - out["gone_from_google"] \
        + out["business_level"] + out["star_only"] + out["new_not_in_db"] == total
    print(json.dumps(out))


if __name__ == "__main__":
    main()
