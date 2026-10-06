#!/usr/bin/env python3
"""For manual_paste_page products, keep only reviews listed in 15 overrides for that slug."""
from pathlib import Path
import pandas as pd

SHARED = Path(__file__).resolve().parents[2] / "alan-shared-resources"
PROC = SHARED / "csv processed"
OV = PROC / "15-review-attribution-overrides.csv"
COMB = next(PROC.glob("03*combined_product_reviews.csv"))
PROD = next(p for p in PROC.glob("02*products_cleaned.xlsx") if "backup" not in p.name.lower())

products = pd.read_excel(PROD, engine="openpyxl")
manual_slugs = set()
for _, row in products.iterrows():
    v = row.get("manual_paste_page")
    if not (bool(v) and str(v).strip().lower() not in {"", "0", "false", "nan", "none"}):
        continue
    url = str(row.get("url") or "").strip()
    if url:
        manual_slugs.add(url.rstrip("/").split("/")[-1].lower())

odf = pd.read_csv(OV, encoding="utf-8-sig")
allow = {}
for _, ov in odf.iterrows():
    slug = "" if pd.isna(ov.get("product_slug")) else str(ov.get("product_slug")).strip().lower()
    if not slug or slug not in manual_slugs:
        continue
    rn = str(ov.get("reviewer_name") or "").strip().lower()
    rd = str(ov.get("review_date") or "")[:10]
    allow.setdefault(slug, set()).add((rn, rd))

comb = pd.read_csv(COMB, encoding="utf-8-sig")
before = len(comb)
keep_mask = pd.Series(True, index=comb.index)
for slug, pairs in allow.items():
    is_slug = comb["product_slug"].astype(str).str.strip().str.lower() == slug
    if not is_slug.any():
        continue
    reviewers = comb["reviewer"].astype(str).str.strip().str.lower()
    dates = comb["date"].astype(str).str[:10]
    ok = reviewers.combine(dates, lambda r, d: (r, d) in pairs)
    # also allow blank date match on reviewer only if override date blank
    drop = is_slug & ~ok
    keep_mask &= ~drop
    print(f"{slug}: kept {int((is_slug & ok).sum())} / {int(is_slug.sum())} (allowlist {len(pairs)})")

out = comb[keep_mask].copy()
out.to_csv(COMB, index=False, encoding="utf-8-sig")
print(f"Wrote combined {len(out)} (removed {before - len(out)})")
