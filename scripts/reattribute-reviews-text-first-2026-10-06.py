#!/usr/bin/env python3
"""
Re-attribute Google (+ Trustpilot from combined) reviews: TEXT keywords first.
Outputs change list CSV and regenerates 03b / combined 03 / 14 stubs.
"""
from __future__ import annotations

import re
import shutil
from pathlib import Path
from datetime import datetime

import pandas as pd

SHARED = Path(r"G:\Dropbox\alan ranger photography\Website Code\alan-shared-resources\csv processed")
STAMP = "2026-10-06"

# Longest-first keyword → slug. Ambiguous / no catalog slug → None (LOW).
TEXT_RULES = [
    (r"kenilworth|kennelworth", "long-exposure-photography-kenilworth", "HIGH", "named Kenilworth long-exposure workshop"),
    (r"hartland", "landscape-photography-devon-hartland-quay", "HIGH", "named Hartland Quay"),
    (r"anglesey", "landscape-photography-workshops-anglesey", "HIGH", "named Anglesey residential"),
    (r"lightroom", "lightroom-courses-for-beginners-coventry", "HIGH", "named Lightroom course"),
    (r"sensor\s*clean|dark spots|dust spots|sensor", "camera-sensor-clean", "HIGH", "sensor clean service language"),
    (r"lavender", "photography-workshops-lavender-fields", "HIGH", "named lavender fields"),
    (r"bluebell", "bluebell-woodlands-photography-workshops", "HIGH", "named bluebell"),
    (r"sezincote", "sezincote-garden-photography-workshop", "HIGH", "named Sezincote"),
    (r"\bzoom\b|1-1 zoom|1:1 zoom|online.*(class|session|lesson)", "private-online-photography-classes-zoom", "HIGH", "Zoom / online 1-1"),
    (r"intro\s*3\s*week|beginners?\s*(photography\s*)?course|3 week(ly)?\s*(evening\s*)?course", "beginners-photography-course", "HIGH", "beginners course"),
    (r"good,\s*friendly tuition|highly recommended", None, "LOW", "generic praise — use booking/date peer only; flagged"),
    (r"batsford", "batsford-arboretum-photography-workshops", "HIGH", "named Batsford"),
    (r"peak\s*district|hope\s*valley", None, "LOW", "Peak/Hope named but multi-product — flag"),
    (r"new orleans|location shoot|commercial shoot|brand photos|product photos for|needed a location|photos are excellent and were sent|before the session, alan made sure", None, "LOW", "commercial/service — no product slug in catalog"),
    (r"rps\s*associate|rps\s*mentoring", None, "LOW", "RPS mentoring — confirm slug"),
]


def backup(path: Path) -> None:
    if not path.exists():
        return
    dest = path.with_name(path.name + f".backup-{STAMP}")
    if not dest.exists():
        shutil.copy2(path, dest)
        print("backed up", dest.name)


def text_match(text: str):
    t = (text or "").lower()
    if not t.strip():
        return None, "LOW", "empty text"
    for pat, slug, conf, reason in TEXT_RULES:
        if re.search(pat, t, re.I):
            return slug, conf, reason
    return None, "LOW", "no strong text keyword"


def main():
    google_path = SHARED / "03b_google_matched.csv"
    combined_hits = list(SHARED.glob("03*combined_product_reviews.csv"))
    combined_path = combined_hits[0] if combined_hits else None
    curated_path = SHARED / "14-google-curated-attributions.csv"

    backup(google_path)
    if combined_path:
        backup(combined_path)
    backup(curated_path)

    g = pd.read_csv(google_path, encoding="utf-8-sig")
    changes = []
    new_slugs = []
    for _, row in g.iterrows():
        old = str(row.get("product_slug") or "").strip()
        review = str(row.get("review") or "")
        slug, conf, reason = text_match(review)
        if slug is None and conf == "LOW":
            # Spec: LOW confidence → blank new_slug, flag for Alan (do not guess)
            if reason.startswith("no strong"):
                new_slugs.append(old)  # retain prior attribution when text is silent
                continue
            new_slugs.append("")
            changes.append({
                "reviewer": row.get("reviewer"),
                "date": row.get("date"),
                "old_slug": old,
                "new_slug": "",
                "reason": reason,
                "confidence": "LOW",
                "source": "Google",
                "evidence": review[:160].replace("\n", " "),
            })
            continue
        if slug and slug != old:
            changes.append({
                "reviewer": row.get("reviewer"),
                "date": row.get("date"),
                "old_slug": old,
                "new_slug": slug,
                "reason": reason,
                "confidence": conf,
                "source": "Google",
                "evidence": review[:160].replace("\n", " "),
            })
            new_slugs.append(slug)
        else:
            new_slugs.append(slug or old)

    g = g.copy()
    g["product_slug"] = new_slugs

    # Same-day peer fill: if blank LOW and another Google review that day has HIGH text slug, copy (tie-break)
    g["_day"] = pd.to_datetime(g["date"], errors="coerce").dt.strftime("%Y-%m-%d")
    for day, grp in g.groupby("_day"):
        peers = [s for s in grp["product_slug"].tolist() if s]
        if len(set(peers)) != 1:
            continue
        peer = peers[0]
        for ix in grp.index:
            if not str(g.at[ix, "product_slug"]).strip():
                g.at[ix, "product_slug"] = peer
                changes.append({
                    "reviewer": g.at[ix, "reviewer"],
                    "date": g.at[ix, "date"],
                    "old_slug": "",
                    "new_slug": peer,
                    "reason": f"same-day peer text match → {peer}",
                    "confidence": "MEDIUM",
                    "source": "Google",
                    "evidence": "tie-break via co-dated review with strong text keyword",
                })
    g = g.drop(columns=["_day"], errors="ignore")
    # refresh product_name where possible from products workbook
    prods = list(SHARED.glob("02*products*"))[0]
    pdf = pd.read_excel(prods, engine="openpyxl")
    pdf["slug"] = pdf["url"].astype(str).str.split("/").str[-1]
    name_by = {r.slug: r["name"] for _, r in pdf.iterrows()}
    g["product_name"] = g["product_slug"].map(lambda s: name_by.get(s, ""))
    g["attribution_source"] = g.apply(
        lambda r: "text_keyword_2026-10-06" if any(c["reviewer"] == r["reviewer"] and str(c["date"]) == str(r["date"]) for c in changes) else r.get("attribution_source", "retained"),
        axis=1,
    )
    g.to_csv(google_path, index=False, encoding="utf-8-sig")
    print("wrote", google_path.name, "rows", len(g))

    # Rebuild combined: keep Trustpilot rows; replace Google rows from 03b
    if combined_path:
        comb = pd.read_csv(combined_path, encoding="utf-8-sig")
        src_col = "source" if "source" in comb.columns else "source_of_review"
        is_google = comb[src_col].astype(str).str.contains("Google", case=False, na=False)
        # Map 03b into combined-like columns where possible
        # Keep non-google; for google rebuild lightly from 03b into existing schema
        non_g = comb[~is_google].copy()
        # Update google subset product fields if present
        if "product_slug" in comb.columns or "product_url" in comb.columns:
            # Try merge on reviewer+date
            def _norm_date(s):
                s = str(s).strip()
                return s[:10] if len(s) >= 10 else s

            g2 = g.copy()
            g2["_key"] = g2["reviewer"].astype(str).str.strip().str.lower() + "|" + g2["date"].map(_norm_date)
            goog = comb[is_google].copy()
            # Google rows in combined use reviewer + date (not Trustpilot username/created)
            reviewer_col = "reviewer" if "reviewer" in goog.columns else "review_username"
            date_col = "date" if "date" in goog.columns else "review_created_(utc)"
            goog["_key"] = goog[reviewer_col].astype(str).str.strip().str.lower() + "|" + goog[date_col].map(_norm_date)
            slug_map = dict(zip(g2["_key"], g2["product_slug"]))
            if "product_slug" in goog.columns:
                before = goog["product_slug"].copy()
                goog["product_slug"] = goog["_key"].map(slug_map).fillna(goog["product_slug"])
            goog = goog.drop(columns=["_key"], errors="ignore")
            out = pd.concat([non_g, goog], ignore_index=True)
            out.to_csv(combined_path, index=False, encoding="utf-8-sig")
            print("wrote combined", combined_path.name, "rows", len(out))
        else:
            print("combined has no product_slug column — left as-is; 03b is source of truth for Google")

    # Curated 14: rewrite from HIGH changes
    curated_rows = [
        {
            "reviewer_name": c["reviewer"],
            "review_date": c["date"],
            "product_slug": c["new_slug"],
            "source_rule": c["reason"],
            "category": "text_keyword_reattribution",
        }
        for c in changes
        if c["confidence"] == "HIGH" and c["new_slug"]
    ]
    pd.DataFrame(curated_rows).to_csv(curated_path, index=False, encoding="utf-8-sig")
    print("wrote", curated_path.name, "rows", len(curated_rows))

    ch_path = SHARED / f"16-review-reattribution-changes-{STAMP}.csv"
    pd.DataFrame(changes).to_csv(ch_path, index=False, encoding="utf-8-sig")
    print("wrote", ch_path.name, "changes", len(changes))
    print("HIGH", sum(1 for c in changes if c["confidence"] == "HIGH"),
          "LOW", sum(1 for c in changes if c["confidence"] == "LOW"))

    # Print the 13 examples
    examples = [
        "Sam Franklin", "Simon Chatterley", "Kate Clay", "Harmit Kuner", "Michael White",
        "Mahmood Esmail", "Sue Green", "Dean Le Page", "Penelope Ulander", "Graham Rousell",
        "Roz", "Francisca", "Michael Auinger", "John Madigan",
    ]
    print("\nEXAMPLES")
    for n in examples:
        hit = g[g["reviewer"].astype(str).str.contains(n, case=False, na=False)]
        if len(hit):
            r = hit.iloc[0]
            print(f"{n} | {r['date']} | {r['product_slug']}")


if __name__ == "__main__":
    main()
