#!/usr/bin/env python3
"""
Apply booking-curated + quote-inferred Google review attributions after match-google-reviews.py.

Reads proposals CSV (13) and adds/updates rows in 03b_google_matched.csv.
Runs automatically from merge-reviews.py Step 2b.
"""
import re
import sys
from pathlib import Path

import pandas as pd

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    import os
    os.environ["PYTHONIOENCODING"] = "utf-8"

SCRIPT_DIR = Path(__file__).parent
SHARED = SCRIPT_DIR.parent.parent / "alan-shared-resources"
CSV_PROCESSED = SHARED / "csv processed"
RAW_GOOGLE = SHARED / "csv" / "raw-03b-google-reviews.csv"
MATCHED_GOOGLE = CSV_PROCESSED / "03b_google_matched.csv"
PROPOSALS = CSV_PROCESSED / "13-unmatched-google-booking-proposals.csv"
CURATED_OUT = CSV_PROCESSED / "14-google-curated-attributions.csv"
PRODUCTS = CSV_PROCESSED / "02 – products_cleaned.xlsx"

TEXT_RULES = [
    (r"\b(sensor clean|dust free|camera is dust)\b", "camera-sensor-clean"),
    (r"\b(lightroom|lr classic|lrc\b|light room)\b", "lightroom-courses-for-beginners-coventry"),
    (r"\b(bracketing|stacking|intentions)\b", "intermediates-intentions-photography-project-course"),
    (r"\b(pick n mix|online courses|academy membership)\b", "premium-photography-academy-membership"),
    (r"\b(lrps|distinction|mentoring|1-2-1|1-1|one to one|one-to-one|monthly session|feedback session|tutor)\b", "monthly-online-photography-mentoring"),
    (r"\b(beginner|get off manual|basic photography|camera class|camera course|novice|auto mode)\b", "beginners-photography-course"),
    (r"\b(zoom class|webinar|online teaching)\b", "lightroom-courses-for-beginners-coventry"),
]


def norm_reviewer(s):
    return re.sub(r"\s+", " ", str(s or "").strip().lower())


def review_key(reviewer, date_str):
    d = str(date_str)[:10]
    return f"{norm_reviewer(reviewer)}|{d}"


def slug_from_quote(text):
    t = str(text or "").lower()
    for pat, slug in TEXT_RULES:
        if re.search(pat, t, re.I):
            return slug
    return ""


def load_products():
    df = pd.read_excel(PRODUCTS)
    df["slug"] = df["url"].astype(str).str.rstrip("/").str.split("/").str[-1]
    return dict(zip(df["slug"], df["name"]))


def build_curated_rows(proposals_df):
    rows = []
    for _, p in proposals_df.iterrows():
        reviewer = str(p["reviewer_name"]).strip()
        date = str(p["review_date"])[:10]
        cat = str(p.get("category", ""))
        slug = str(p.get("suggested_slug", "") or "").strip()
        hints = str(p.get("quote_location_hints", "") or "").strip()
        snippet = str(p.get("review_snippet", "") or "")

        if cat == "booking_match" and slug:
            rule = "booking_sheet_confirmed"
        elif cat in ("quote_only_no_booking", "non_workshop_likely"):
            slug = slug or (hints.split("|")[0] if hints else "") or slug_from_quote(snippet)
            rule = "quote_hint" if hints else "quote_inferred"
        elif cat == "no_match":
            slug = slug_from_quote(snippet)
            rule = "quote_inferred_no_booking" if slug else ""

        if not slug:
            continue
        rows.append({
            "reviewer_name": reviewer,
            "review_date": date,
            "product_slug": slug,
            "source_rule": rule,
            "category": cat,
        })
    return pd.DataFrame(rows)


def main():
    if not RAW_GOOGLE.exists():
        print(f"Missing {RAW_GOOGLE}")
        sys.exit(1)
    if not MATCHED_GOOGLE.exists():
        print(f"Missing {MATCHED_GOOGLE} — run match-google-reviews.py first")
        sys.exit(1)

    raw = pd.read_csv(RAW_GOOGLE, encoding="utf-8-sig")
    matched = pd.read_csv(MATCHED_GOOGLE, encoding="utf-8-sig")
    name_by_slug = load_products()

    curated = pd.DataFrame()
    if PROPOSALS.exists():
        proposals = pd.read_csv(PROPOSALS, encoding="utf-8-sig")
        curated = build_curated_rows(proposals)

        # Explicit overrides (Alan confirmed)
        for reviewer, date, slug in [
            ("Shelly Soo", "2024-12-15", "lake-district-photography-workshop"),
            ("Dennis Jeffrey", "2020-04-27", "lake-district-photography-workshop"),
        ]:
            mask = (curated["reviewer_name"].str.lower() == reviewer.lower()) & (
                curated["review_date"].astype(str).str.startswith(date)
            )
            if mask.any():
                curated.loc[mask, "product_slug"] = slug
                curated.loc[mask, "source_rule"] = "alan_confirmed"
            else:
                curated = pd.concat([curated, pd.DataFrame([{
                    "reviewer_name": reviewer,
                    "review_date": date,
                    "product_slug": slug,
                    "source_rule": "alan_confirmed",
                    "category": "booking_match",
                }])], ignore_index=True)

    if len(curated):
        curated = curated.drop_duplicates(subset=["reviewer_name", "review_date", "product_slug"], keep="last")
        curated.to_csv(CURATED_OUT, index=False, encoding="utf-8-sig")
        print(f"Curated attributions: {len(curated)} -> {CURATED_OUT.name}")

    raw_by_key = {}
    for _, r in raw.iterrows():
        raw_by_key[review_key(r.get("reviewer"), r.get("date"))] = r

    matched_keys = {review_key(r.get("reviewer"), r.get("date")) for _, r in matched.iterrows()}
    added = 0
    updated = 0

    for _, c in curated.iterrows():
        key = review_key(c["reviewer_name"], c["review_date"])
        slug = c["product_slug"]
        if slug not in name_by_slug:
            print(f"  Skip unknown slug {slug} for {c['reviewer_name']}")
            continue
        raw_row = raw_by_key.get(key)
        if raw_row is None:
            print(f"  Skip missing raw row for {c['reviewer_name']} {c['review_date']}")
            continue

        row_dict = raw_row.to_dict()
        row_dict["source"] = "Google"
        row_dict["product_slug"] = slug
        row_dict["product_name"] = name_by_slug.get(slug, "")
        row_dict["attribution_source"] = c.get("source_rule", "curated")

        if key in matched_keys:
            idx = matched.apply(
                lambda r: review_key(r.get("reviewer"), r.get("date")) == key, axis=1
            )
            for col, val in row_dict.items():
                matched.loc[idx, col] = val
            updated += 1
        else:
            matched = pd.concat([matched, pd.DataFrame([row_dict])], ignore_index=True)
            matched_keys.add(key)
            added += 1

    matched.to_csv(MATCHED_GOOGLE, index=False, encoding="utf-8-sig")
    print(f"Google matched file: +{added} added, {updated} updated -> {len(matched)} total")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
