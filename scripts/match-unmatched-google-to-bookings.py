#!/usr/bin/env python3
"""Match unmatched Google reviews to booking sheet attendees."""
import re
import sys
from datetime import timedelta
from difflib import SequenceMatcher
from pathlib import Path

import pandas as pd

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

SHARED = Path(__file__).resolve().parents[2] / "alan-shared-resources"
BOOKINGS_DIR = SHARED / "bookings"
CSV_PROCESSED = SHARED / "csv processed"
RAW_GOOGLE = SHARED / "csv" / "raw-03b-google-reviews.csv"
MATCHED_GOOGLE = CSV_PROCESSED / "03b_google_matched.csv"
PRODUCTS = CSV_PROCESSED / "02 – products_cleaned.xlsx"
MAPPINGS = CSV_PROCESSED / "05-event-product-mappings-latest.csv"
OUT = CSV_PROCESSED / "13-unmatched-google-booking-proposals.csv"

# Workshop location keywords -> product slug (fallback when mapping file misses)
LOCATION_SLUG_HINTS = [
    (r"anglesey|ynys mon|llanddwyn", "landscape-photography-workshops-anglesey"),
    (r"northumb|northumberland|craster|bamburgh|dunstanburgh", "coastal-northumberland-photography-workshops"),
    (r"dartmoor", "dartmoor-photography-landscape-workshop"),
    (r"exmoor|lynmouth", "exmoor-photography-workshops-lynmouth"),
    (r"dingle|kerry|ireland", "ireland-photography-workshops-dingle"),
    (r"dorset|purbeck|jurassic", "dorset-landscape-photography-workshop"),
    (r"snowdonia|snowdon", "landscape-photography-snowdonia-workshops"),
    (r"peak district|padley|derbyshire heather", "peak-district-heather-photography-workshop"),
    (r"yorkshire dales|ribblehead", "yorkshire-dales-photography-workshops"),
    (r"lake district|lakes workshop", "lake-district-photography-workshop"),
    (r"suffolk", "suffolk-landscape-photography-workshops"),
    (r"norfolk", "landscape-photography-workshop-norfolk"),
    (r"glencoe|scotland", "landscape-photography-workshop-glencoe"),
    (r"hartland|devon", "landscape-photography-devon-hartland-quay"),
    (r"pistyll|vyrnwy|dee valley", "wales-photography-workshop-pistyll-rhaeadr"),
    (r"gower", "landscape-photography-wales-photo-workshop"),
    (r"batsford|arboretum", "batsford-arboretum-photography-workshops"),
    (r"bluebell", "bluebell-woodlands-photography-workshops"),
    (r"woodland|secrets of woodland", "secrets-of-woodland-photography-workshop"),
    (r"macro|abstract", "abstract-and-macro-photography-workshops"),
    (r"kenilworth|fireworks", "fireworks-photography-workshop-kenilworth"),
    (r"lavender", "photography-workshops-lavender-fields"),
    (r"poppy", "poppy-fields-photography-workshops"),
    (r"christmas", "christmas-photography-workshops"),
    (r"garden|sezincote", "garden-photography-workshop"),
    (r"urban|architecture|coventry", "urban-architecture-photography-workshops-coventry"),
    (r"fairy glen|betws", "long-exposure-photography-workshop-fairy-glen"),
    (r"chesterton|windmill", "photography-workshops-chesterton-windmill"),
    (r"brandon marsh", "brandon-marsh-workshop"),
    (r"nant mill|dee valley", "landscape-photography-workshops-nant-mill"),
    (r"beginners|camera class|camera course", "beginners-photography-course"),
    (r"lightroom", "lightroom-courses-for-beginners-coventry"),
    (r"mentoring", "monthly-online-photography-mentoring"),
    (r"sensor clean", "camera-sensor-clean"),
    (r"academy|pick n mix|subscription", "premium-photography-academy-membership"),
]


def norm_name(s):
    s = re.sub(r"\s+", " ", str(s or "").strip().lower())
    s = re.sub(r"[^a-z0-9 ]", "", s)
    return s


def name_score(a, b):
    a, b = norm_name(a), norm_name(b)
    if not a or not b:
        return 0
    if a == b:
        return 1.0
    if a in b or b in a:
        return 0.92
    return SequenceMatcher(None, a, b).ratio()


def slug_from_location(text):
    t = str(text or "").lower()
    for pat, slug in LOCATION_SLUG_HINTS:
        if re.search(pat, t):
            return slug
    return ""


def load_bookings():
    rows = []
    for path in sorted(BOOKINGS_DIR.glob("*.xlsm")):
        try:
            xl = pd.ExcelFile(path, engine="openpyxl")
        except Exception as e:
            print(f"Skip {path.name}: {e}")
            continue
        for sheet in xl.sheet_names:
            if "booking" not in sheet.lower() and sheet.lower() not in ("bookings", "sheet1"):
                continue
            try:
                df = pd.read_excel(path, sheet_name=sheet, engine="openpyxl")
            except Exception:
                continue
            if df.empty or df.shape[1] < 3:
                continue
            cols = {str(c).strip().lower(): c for c in df.columns}
            date_col = next((cols[k] for k in cols if "date" in k and "review" not in k), None)
            name_col = next((cols[k] for k in cols if k in ("name", "participant", "client", "customer", "attendee")), None)
            loc_col = next((cols[k] for k in cols if any(x in k for x in ("workshop", "location", "event", "course", "product"))), None)
            if not name_col:
                # guess: often column with most string names
                for c in df.columns:
                    sample = df[c].dropna().astype(str).head(20)
                    if sample.str.contains(r"[A-Za-z]{3,}\s+[A-Za-z]{3,}", regex=True).sum() >= 3:
                        name_col = c
                        break
            if not date_col or not name_col:
                continue
            sub = df[[date_col, name_col] + ([loc_col] if loc_col else [])].copy()
            sub.columns = ["event_date", "participant_name"] + (["workshop_location"] if loc_col else [])
            sub["booking_file"] = path.name
            sub["event_date"] = pd.to_datetime(sub["event_date"], errors="coerce")
            sub = sub[sub["event_date"].notna() & sub["participant_name"].notna()]
            rows.append(sub)
    if not rows:
        return pd.DataFrame()
    out = pd.concat(rows, ignore_index=True)
    out["participant_norm"] = out["participant_name"].map(norm_name)
    return out


def main():
    raw = pd.read_csv(RAW_GOOGLE)
    matched = pd.read_csv(MATCHED_GOOGLE)
    matched_keys = set(
        zip(
            matched["reviewer"].astype(str).str.strip(),
            pd.to_datetime(matched["date"], errors="coerce").dt.date.astype(str),
        )
    )
    raw["review_date"] = pd.to_datetime(raw["date"], errors="coerce")
    raw["key"] = list(
        zip(raw["reviewer"].astype(str).str.strip(), raw["review_date"].dt.date.astype(str))
    )
    unmatched = raw[~raw["key"].isin(matched_keys)].copy()
    print(f"Unmatched Google reviews: {len(unmatched)} / {len(raw)}")

    bookings = load_bookings()
    print(f"Booking rows loaded: {len(bookings)}")

    products = pd.read_excel(PRODUCTS)
    products["slug"] = products["url"].astype(str).str.rstrip("/").str.split("/").str[-1]
    slug_names = dict(zip(products["slug"], products["name"]))

    proposals = []
    for _, rev in unmatched.iterrows():
        rname = str(rev["reviewer"]).strip()
        rdate = rev["review_date"]
        if pd.isna(rdate):
            continue
        rnorm = norm_name(rname)
        candidates = []
        for _, b in bookings.iterrows():
            ns = name_score(rname, b["participant_name"])
            if ns < 0.82:
                continue
            days = (rdate - b["event_date"]).days
            if days < -7 or days > 120:
                continue
            loc = str(b.get("workshop_location", "") or "")
            slug = slug_from_location(loc)
            conf = "high" if ns >= 0.95 and 0 <= days <= 45 else "medium"
            candidates.append(
                {
                    "name_score": round(ns, 3),
                    "days_after_event": days,
                    "confidence": conf,
                    "suggested_slug": slug,
                    "workshop_location": loc,
                    "event_date": b["event_date"].date().isoformat(),
                    "participant_name": b["participant_name"],
                    "booking_file": b["booking_file"],
                }
            )
        candidates.sort(key=lambda x: (-x["name_score"], abs(x["days_after_event"])))
        best = candidates[0] if candidates else None
        proposals.append(
            {
                "reviewer_name": rname,
                "review_date": rdate.date().isoformat(),
                "rating": rev.get("rating", ""),
                "review_snippet": str(rev.get("review", ""))[:180],
                "booking_match_found": bool(best),
                "match_confidence": best["confidence"] if best else "",
                "suggested_slug": best["suggested_slug"] if best else "",
                "suggested_product": slug_names.get(best["suggested_slug"], "") if best and best["suggested_slug"] else "",
                "workshop_location": best["workshop_location"] if best else "",
                "event_date": best["event_date"] if best else "",
                "participant_from_booking": best["participant_name"] if best else "",
                "days_after_event": best["days_after_event"] if best else "",
                "name_score": best["name_score"] if best else "",
                "booking_file": best["booking_file"] if best else "",
                "alt_matches": len(candidates),
            }
        )

    prop_df = pd.DataFrame(proposals).sort_values(["booking_match_found", "review_date"], ascending=[False, False])
    prop_df.to_csv(OUT, index=False, encoding="utf-8-sig")

    matched_count = prop_df["booking_match_found"].sum()
    with_slug = prop_df[(prop_df["booking_match_found"]) & (prop_df["suggested_slug"] != "")].shape[0]
    print(f"Booking name matches: {matched_count}")
    print(f"With suggested workshop slug: {with_slug}")
    print(f"Saved: {OUT}")

    print("\n=== NO BOOKING MATCH (names only) ===")
    for _, r in prop_df[~prop_df["booking_match_found"]].iterrows():
        print(f"- {r['reviewer_name']} ({r['review_date']}) — {r['review_snippet'][:80]}...")

    print("\n=== PROPOSED MATCHES FOR CONFIRMATION ===")
    for _, r in prop_df[prop_df["booking_match_found"]].head(40).iterrows():
        slug = r["suggested_slug"] or "??? (need manual slug)"
        print(
            f"[{r['match_confidence'].upper()}] {r['reviewer_name']} ({r['review_date']}) "
            f"→ {slug} | event {r['event_date']} {r['workshop_location'][:50]}"
        )


if __name__ == "__main__":
    main()
