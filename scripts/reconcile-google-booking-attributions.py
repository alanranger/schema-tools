#!/usr/bin/env python3
"""
Reconcile ALL Google reviews against booking sheet (not just unmatched).

Step 2a in merge-reviews.py:
- Regenerates 13-unmatched-google-booking-proposals.csv
- Auto-corrects high-confidence booking mismatches in 03b_google_matched.csv
- Writes 15-google-booking-reconciliation-audit.csv for every mismatch
"""
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

import pandas as pd

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    import os
    os.environ["PYTHONIOENCODING"] = "utf-8"

SCRIPT_DIR = Path(__file__).parent
SHARED = SCRIPT_DIR.parent.parent / "alan-shared-resources"
BOOKINGS_DIR = SHARED / "bookings"
CSV_PROCESSED = SHARED / "csv processed"
RAW_GOOGLE = SHARED / "csv" / "raw-03b-google-reviews.csv"
MATCHED_GOOGLE = CSV_PROCESSED / "03b_google_matched.csv"
PRODUCTS = CSV_PROCESSED / "02 – products_cleaned.xlsx"
PROPOSALS_OUT = CSV_PROCESSED / "13-unmatched-google-booking-proposals.csv"
AUDIT_OUT = CSV_PROCESSED / "15-google-booking-reconciliation-audit.csv"

GEO_SLUG_PATTERNS = [
    (r"anglesey|llanddwyn", "landscape-photography-workshops-anglesey"),
    (r"northumb", "coastal-northumberland-photography-workshops"),
    (r"dartmoor", "dartmoor-photography-landscape-workshop"),
    (r"exmoor|lynmouth", "exmoor-photography-workshops-lynmouth"),
    (r"ireland|dingle|\bkerry\b", "ireland-photography-workshops-dingle"),
    (r"dorset|purbeck", "dorset-landscape-photography-workshop"),
    (r"snowdonia|snowdon", "landscape-photography-snowdonia-workshops"),
    (r"peak district|padley|heather", "peak-district-heather-photography-workshop"),
    (r"yorkshire dales|\bdales\b", "yorkshire-dales-photography-workshops"),
    (r"north yorkshire", "north-yorkshire-landscape-photography"),
    (r"lake district|\blakes\b", "lake-district-photography-workshop"),
    (r"suffolk|southwold", "suffolk-landscape-photography-workshops"),
    (r"norfolk", "landscape-photography-workshop-norfolk"),
    (r"glencoe|scotland", "landscape-photography-workshop-glencoe"),
    (r"hartland", "landscape-photography-devon-hartland-quay"),
    (r"pistyll|vyrnwy|dee valley", "wales-photography-workshop-pistyll-rhaeadr"),
    (r"gower", "landscape-photography-wales-photo-workshop"),
    (r"batsford|arboretum", "batsford-arboretum-photography-workshops"),
    (r"bluebell", "bluebell-woodlands-photography-workshops"),
    (r"woodland", "secrets-of-woodland-photography-workshop"),
    (r"macro|abstract|brandon marsh", "abstract-and-macro-photography-workshops"),
    (r"fireworks|kenilworth", "fireworks-photography-workshop-kenilworth"),
    (r"lavender", "photography-workshops-lavender-fields"),
    (r"poppy", "poppy-fields-photography-workshops"),
    (r"christmas", "christmas-photography-workshops"),
    (r"garden|sezincote", "garden-photography-workshop"),
    (r"urban|architecture", "urban-architecture-photography-workshops-coventry"),
    (r"fairy glen|betws", "long-exposure-photography-workshop-fairy-glen"),
    (r"chesterton|windmill", "photography-workshops-chesterton-windmill"),
    (r"brandon marsh", "brandon-marsh-workshop"),
    (r"nant mill", "landscape-photography-workshops-nant-mill"),
]

LOCATION_RULES = GEO_SLUG_PATTERNS + [
    (r"beginner|camera class|camera course|get off manual", "beginners-photography-course"),
    (r"lightroom", "lightroom-courses-for-beginners-coventry"),
    (r"mentor|mentoring|lrps|distinction", "monthly-online-photography-mentoring"),
    (r"sensor clean", "camera-sensor-clean"),
    (r"intentions|bracketing|stacking", "intermediates-intentions-photography-project-course"),
    (r"academy|pick n mix|subscription|online course", "premium-photography-academy-membership"),
]


def norm_name(s):
    return re.sub(r"[^a-z0-9 ]", "", str(s or "").lower()).strip()


def fuzzy_ratio(a, b):
    return SequenceMatcher(None, norm_name(a), norm_name(b)).ratio()


def names_match(reviewer, booking_name, strict=False):
    r, b = norm_name(reviewer), norm_name(booking_name)
    if not r or not b:
        return False, 0.0
    if r == b:
        return True, 1.0
    score = fuzzy_ratio(reviewer, booking_name)
    if score >= 0.95:
        return True, score
    parts = b.split()
    if len(parts) >= 2:
        first, last = parts[0], parts[-1]
        if len(last) > 2 and last in r:
            return True, max(score, 0.92)
        if not strict and len(first) > 3 and first in r and " " not in str(reviewer).strip():
            return True, max(score, 0.85)
    return False, score


def text_supports_slug(review_text, slug):
    if not slug:
        return False
    text = str(review_text or "").lower()
    for pat, s in GEO_SLUG_PATTERNS:
        if s == slug and re.search(pat, text):
            return True
    return False


def find_booking_for_review(reviewer, review_date, bookings):
    strict = find_booking_match(reviewer, review_date, bookings, strict=True)
    if strict:
        return strict
    if " " not in str(reviewer).strip():
        return find_booking_match(reviewer, review_date, bookings, strict=False)
    return None


def slug_from_location(loc):
    text = str(loc or "").lower()
    for pat, slug in LOCATION_RULES:
        if re.search(pat, text):
            return slug
    return ""


def load_workshop_bookings():
    rows = []
    if not BOOKINGS_DIR.exists():
        return pd.DataFrame()
    for path in sorted(BOOKINGS_DIR.glob("*.xlsm")):
        try:
            df = pd.read_excel(path, sheet_name="Workshops", engine="openpyxl")
        except Exception:
            continue
        cols = {str(c).strip(): c for c in df.columns}
        need = ["Event Date", "Workshop-Location/Theme", "First Name", "Last Name"]
        if not all(k in cols for k in need):
            continue
        sub = df[[cols[k] for k in need]].copy()
        sub.columns = need
        sub["event_date"] = pd.to_datetime(sub["Event Date"], errors="coerce")
        sub["participant_name"] = (
            sub["First Name"].astype(str).str.strip() + " " + sub["Last Name"].astype(str).str.strip()
        ).str.strip()
        sub["workshop_location"] = sub["Workshop-Location/Theme"].astype(str).str.strip()
        sub["suggested_slug"] = sub["workshop_location"].map(slug_from_location)
        sub["booking_file"] = path.name
        sub = sub[sub["event_date"].notna() & sub["participant_name"].astype(bool)]
        rows.append(sub[["event_date", "participant_name", "workshop_location", "suggested_slug", "booking_file"]])
    return pd.concat(rows, ignore_index=True) if rows else pd.DataFrame()


def find_booking_match(reviewer, review_date, bookings, strict=False):
    if pd.isna(review_date) or bookings.empty:
        return None
    best = None
    for _, b in bookings.iterrows():
        ok, name_score = names_match(reviewer, b["participant_name"], strict=strict)
        if not ok:
            continue
        days = (review_date - b["event_date"]).days
        if days < -14 or days > 120:
            continue
        conf = "high" if name_score >= 0.92 and 0 <= days <= 60 else "medium"
        row = {
            "name_score": round(name_score, 3),
            "days_after_event": days,
            "confidence": conf,
            "suggested_slug": b["suggested_slug"] or "",
            "workshop_location": b["workshop_location"],
            "event_date": b["event_date"].date().isoformat(),
            "participant_name": b["participant_name"],
            "booking_file": b["booking_file"],
        }
        if not best or row["name_score"] > best["name_score"]:
            best = row
    return best


def review_key(reviewer, date_val):
    d = str(date_val)[:10]
    return f"{norm_name(reviewer)}|{d}"


def load_slug_names():
    df = pd.read_excel(PRODUCTS)
    df["slug"] = df["url"].astype(str).str.rstrip("/").str.split("/").str[-1]
    return dict(zip(df["slug"], df["name"]))


def should_auto_correct(best, review_text, current_slug, booking_slug, reviewer):
    if not best or not booking_slug or booking_slug == current_slug:
        return False
    if text_supports_slug(review_text, current_slug) and not text_supports_slug(review_text, booking_slug):
        return False
    if best["name_score"] >= 0.92:
        return best["confidence"] in ("high", "medium")
    if " " not in str(reviewer).strip() and best["name_score"] >= 0.85:
        return best["confidence"] in ("high", "medium")
    return False


def main():
    if not RAW_GOOGLE.exists() or not MATCHED_GOOGLE.exists():
        print("Missing raw or matched Google CSV")
        sys.exit(1)

    raw = pd.read_csv(RAW_GOOGLE, encoding="utf-8-sig")
    matched = pd.read_csv(MATCHED_GOOGLE, encoding="utf-8-sig")
    bookings = load_workshop_bookings()
    slug_names = load_slug_names()

    matched_lookup = {}
    for _, r in matched.iterrows():
        matched_lookup[review_key(r.get("reviewer"), r.get("date"))] = str(r.get("product_slug") or "").strip()

    audit_rows = []
    proposal_rows = []
    corrections = 0

    for _, rev in raw.iterrows():
        reviewer = str(rev.get("reviewer", "")).strip()
        review_date = pd.to_datetime(rev.get("date"), errors="coerce")
        if not reviewer or pd.isna(review_date):
            continue
        key = review_key(reviewer, review_date)
        current_slug = matched_lookup.get(key, "")
        quote = str(rev.get("review", ""))
        best = find_booking_for_review(reviewer, review_date, bookings)
        booking_slug = best["suggested_slug"] if best else ""

        if best and booking_slug and current_slug and booking_slug != current_slug:
            action = "auto_correct" if should_auto_correct(best, quote, current_slug, booking_slug, reviewer) else "flag_manual"
            audit_rows.append({
                "reviewer_name": reviewer,
                "review_date": review_date.date().isoformat(),
                "current_slug": current_slug,
                "booking_slug": booking_slug,
                "name_score": best["name_score"],
                "confidence": best["confidence"],
                "days_after_event": best["days_after_event"],
                "participant_from_booking": best["participant_name"],
                "workshop_location": best["workshop_location"],
                "event_date": best["event_date"],
                "action": action,
            })
            if action == "auto_correct":
                idx = matched.apply(
                    lambda r, k=key: review_key(r.get("reviewer"), r.get("date")) == k, axis=1
                )
                matched.loc[idx, "product_slug"] = booking_slug
                matched.loc[idx, "product_name"] = slug_names.get(booking_slug, "")
                matched.loc[idx, "attribution_source"] = "booking_reconciled"
                matched_lookup[key] = booking_slug
                corrections += 1

        if key not in matched_lookup:
            loose = find_booking_match(reviewer, review_date, bookings, strict=False)
            booking_slug = loose["suggested_slug"] if loose else ""
            quote_snip = quote[:200]
            cat = "booking_match" if loose and booking_slug else "no_match"
            proposal_rows.append({
                "reviewer_name": reviewer,
                "review_date": review_date.date().isoformat(),
                "rating": rev.get("rating", ""),
                "category": cat,
                "match_confidence": loose["confidence"] if loose else "",
                "suggested_slug": booking_slug,
                "quote_location_hints": "",
                "workshop_location": loose["workshop_location"] if loose else "",
                "event_date": loose["event_date"] if loose else "",
                "participant_from_booking": loose["participant_name"] if loose else "",
                "days_after_event": loose["days_after_event"] if loose else "",
                "booking_file": loose["booking_file"] if loose else "",
                "review_snippet": quote_snip,
            })

    if corrections:
        matched.to_csv(MATCHED_GOOGLE, index=False, encoding="utf-8-sig")

    pd.DataFrame(audit_rows).to_csv(AUDIT_OUT, index=False, encoding="utf-8-sig")
    pd.DataFrame(proposal_rows).to_csv(PROPOSALS_OUT, index=False, encoding="utf-8-sig")

    print(f"Booking rows loaded: {len(bookings)}")
    print(f"Mismatches found: {len(audit_rows)} -> {AUDIT_OUT.name}")
    print(f"Auto-corrected: {corrections}")
    print(f"Unmatched proposals: {len(proposal_rows)} -> {PROPOSALS_OUT.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
