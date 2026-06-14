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

ALAN_CONFIRMED = [
    ("Shelly Soo", "2024-12-15", "lake-district-photography-workshop"),
]

TEXT_RULES = [
    (r"\b(sensor clean|dust free|camera is dust)\b", "camera-sensor-clean"),
    (r"\b(lightroom|lr classic|lrc\b|light room)\b", "lightroom-courses-for-beginners-coventry"),
    (r"\b(bracketing|stacking|intentions)\b", "intermediates-intentions-photography-project-course"),
    (r"\b(pick n mix|online courses|academy membership)\b", "premium-photography-academy-membership"),
    (
        r"\b(lrps|rps mentoring|rps course|royal photographic|distinction panel|"
        r"distinction qualification|distinction submission|working towards a distinction)\b",
        "rps-mentoring-photography-course",
    ),
    (r"\b(mentoring|1-2-1|1-1|one to one|one-to-one|monthly session|feedback session|tutor)\b", "monthly-online-photography-mentoring"),
    (r"\b(beginner|get off manual|basic photography|camera class|camera course|novice|auto mode)\b", "beginners-photography-course"),
    (r"\b(zoom class|webinar|online teaching)\b", "lightroom-courses-for-beginners-coventry"),
]

RPS_SLUG = "rps-mentoring-photography-course"
RPS_TEXT_RULES = TEXT_RULES[4:5]

# From https://www.alanranger.com/photography-news-blog/?tag=rps%20distinctions (18 case studies, full scrape)
RPS_BLOG_CLIENTS = [
    "Patricia Pearl", "Mary Hamilton", "Peter Orton", "John Simpson", "Alistair Willis",
    "Barbara Voules", "Ian Slater", "Janice Jordan", "Kirsten Pearce", "Max Dobres",
    "Dennis Jeffrey", "Janet Boulter", "Francis Peckham", "Vincenzo Albano", "Jacki Rosin",
    "Anne Watkinson", "Paul Kirby", "Joyce James",
]

WORKSHOP_REVIEW_PATTERNS = [
    r"northumbria", r"northumberland", r"woodland masterclass", r"woodland walk",
    r"\b3 day workshop\b", r"workshop in the", r"residential workshop",
]

RPS_SERVICE_PATTERNS = [
    r"\b(lrps|rps|distinction|panel|royal photographic)\b",
    r"\b(1-2-1|one to one|mentor|mentoring|tutor|tuition|webinar|zoom)\b",
    r"processing instruction", r"highly recommended.*tutor",
]


def norm_name(s):
    return re.sub(r"[^a-z0-9 ]", "", str(s or "").lower()).strip()


def blog_client_match(reviewer, client_name):
    r, c = norm_name(reviewer), norm_name(client_name)
    if not r or not c:
        return False
    if r == c or c in r or r in c:
        return True
    parts = c.split()
    if len(parts) >= 2 and parts[0] in r:
        rparts = r.split()
        if parts[-1] in r or (rparts and rparts[-1] == parts[-1][:1]):
            return True
    return False


def is_workshop_review(text):
    t = str(text or "").lower()
    if re.search(r"\b(lrps|rps mentoring|distinction panel|distinction qualification)\b", t):
        return False
    return any(re.search(p, t) for p in WORKSHOP_REVIEW_PATTERNS)


def is_rps_service_review(text):
    t = str(text or "").lower()
    return any(re.search(p, t) for p in RPS_SERVICE_PATTERNS)


def apply_rps_blog_client_routing(matched, raw, name_by_slug):
    raw_by_key = {review_key(r.get("reviewer"), r.get("date")): r for _, r in raw.iterrows()}
    matched_keys = {review_key(r.get("reviewer"), r.get("date")) for _, r in matched.iterrows()}
    added = 0
    updated = 0
    for _, raw_row in raw.iterrows():
        reviewer = str(raw_row.get("reviewer", "")).strip()
        if not reviewer:
            continue
        if not any(blog_client_match(reviewer, client) for client in RPS_BLOG_CLIENTS):
            continue
        text = str(raw_row.get("review", "") or "")
        if is_workshop_review(text) or not is_rps_service_review(text):
            continue
        key = review_key(reviewer, raw_row.get("date"))
        row_dict = raw_row.to_dict()
        row_dict["source"] = "Google"
        row_dict["product_slug"] = RPS_SLUG
        row_dict["product_name"] = name_by_slug.get(RPS_SLUG, "")
        row_dict["attribution_source"] = "rps_blog_client"
        if key in matched_keys:
            idx = matched.apply(lambda r, k=key: review_key(r.get("reviewer"), r.get("date")) == k, axis=1)
            if str(matched.loc[idx, "product_slug"].iloc[0]) == RPS_SLUG:
                continue
            for col, val in row_dict.items():
                matched.loc[idx, col] = val
            updated += 1
        else:
            matched = pd.concat([matched, pd.DataFrame([row_dict])], ignore_index=True)
            matched_keys.add(key)
            added += 1
    return matched, added, updated


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


def apply_rps_text_routing(matched, raw, name_by_slug):
    raw_by_key = {review_key(r.get("reviewer"), r.get("date")): r for _, r in raw.iterrows()}
    updates = 0
    for idx, row in matched.iterrows():
        key = review_key(row.get("reviewer"), row.get("date"))
        raw_row = raw_by_key.get(key)
        if raw_row is None:
            continue
        text = str(raw_row.get("review", "") or "")
        for pat, slug in RPS_TEXT_RULES:
            if not re.search(pat, text, re.I):
                continue
            if slug not in name_by_slug:
                break
            if str(row.get("product_slug", "")) == slug:
                break
            matched.loc[idx, "product_slug"] = slug
            matched.loc[idx, "product_name"] = name_by_slug.get(slug, "")
            matched.loc[idx, "attribution_source"] = "text_rps_routed"
            updates += 1
            break
    return updates


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

    for reviewer, date, slug in ALAN_CONFIRMED:
        if len(curated) > 0:
            mask = (
                curated["reviewer_name"].str.lower().eq(reviewer.lower())
                & curated["review_date"].astype(str).str.startswith(date)
            )
            if mask.any():
                curated.loc[mask, "product_slug"] = slug
                curated.loc[mask, "source_rule"] = "alan_confirmed"
                continue
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

    routed = apply_rps_text_routing(matched, raw, name_by_slug)
    if routed:
        print(f"RPS text routing: {routed} reviews -> {RPS_SLUG}")

    matched, blog_added, blog_updated = apply_rps_blog_client_routing(matched, raw, name_by_slug)
    if blog_added or blog_updated:
        print(f"RPS blog client routing: +{blog_added} added, {blog_updated} updated -> {RPS_SLUG}")

    matched.to_csv(MATCHED_GOOGLE, index=False, encoding="utf-8-sig")
    print(f"Google matched file: +{added} added, {updated} updated -> {len(matched)} total")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
