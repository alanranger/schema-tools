#!/usr/bin/env python3
"""Apply durable 15-review-attribution-overrides.csv to 03b (highest priority)."""
from pathlib import Path
import pandas as pd

script_dir = Path(__file__).parent
shared = script_dir.parent.parent / "alan-shared-resources"
csv_processed = shared / "csv processed"
overrides_path = csv_processed / "15-review-attribution-overrides.csv"
out_path = csv_processed / "03b_google_matched.csv"

products_path = csv_processed / "02 – products_cleaned.xlsx"
if not products_path.exists():
    hits = [h for h in csv_processed.glob("02*products_cleaned.xlsx") if "backup" not in h.name.lower()]
    products_path = hits[0] if hits else products_path

products_df = pd.read_excel(products_path, engine="openpyxl")
products_df = products_df[products_df["name"].notna() & (products_df["name"] != "")]
products_df["slug"] = products_df["url"].apply(
    lambda u: str(u).split("/")[-1].strip() if pd.notna(u) else ""
)
name_by_slug = {row["slug"]: str(row["name"]) for _, row in products_df.iterrows() if row["slug"]}

out_df = pd.read_csv(out_path, encoding="utf-8-sig")
odf = pd.read_csv(overrides_path, encoding="utf-8-sig")
applied = 0
for _, ov in odf.iterrows():
    rn = str(ov.get("reviewer_name") or "").strip().lower()
    rd = str(ov.get("review_date") or "")[:10]
    scope = str(ov.get("scope") or "product").strip().lower()
    slug = "" if pd.isna(ov.get("product_slug")) else str(ov.get("product_slug")).strip()
    if not rn:
        continue
    mask = out_df["reviewer"].astype(str).str.strip().str.lower() == rn
    if rd:
        mask = mask & (out_df["date"].astype(str).str[:10] == rd)
    if not mask.any():
        continue
    if scope == "business_level" or not slug:
        out_df.loc[mask, "product_slug"] = ""
        out_df.loc[mask, "product_name"] = ""
        out_df.loc[mask, "attribution_source"] = "override_business_level"
    else:
        out_df.loc[mask, "product_slug"] = slug
        out_df.loc[mask, "product_name"] = name_by_slug.get(slug, out_df.loc[mask, "product_name"])
        out_df.loc[mask, "attribution_source"] = "override_15_attribution"
    applied += int(mask.sum())

out_df.to_csv(out_path, index=False, encoding="utf-8-sig")
print(f"Applied {applied} durable override row-hits from {overrides_path.name} → {out_path.name}")
