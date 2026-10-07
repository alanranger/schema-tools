#!/usr/bin/env python3
"""Apply durable 15-review-attribution-overrides.csv to 03a + 03b (highest priority)."""
from pathlib import Path
import pandas as pd

script_dir = Path(__file__).parent
shared = script_dir.parent.parent / "alan-shared-resources"
csv_processed = shared / "csv processed"
overrides_path = csv_processed / "15-review-attribution-overrides.csv"
google_path = csv_processed / "03b_google_matched.csv"
trustpilot_path = csv_processed / "03a_trustpilot_matched.csv"

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


def _norm_name(val) -> str:
    return str(val or "").strip().lower()


def _date_candidates(val):
    """Return possible YYYY-MM-DD parses (month-first and day-first)."""
    out = set()
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return out
    s = str(val).strip()
    if len(s) >= 10 and s[4] == "-":
        out.add(s[:10])
    for dayfirst in (False, True):
        dt = pd.to_datetime(val, errors="coerce", dayfirst=dayfirst)
        if pd.notna(dt):
            out.add(dt.strftime("%Y-%m-%d"))
    return out


def _norm_date(val) -> str:
    cands = sorted(_date_candidates(val))
    return cands[0] if cands else ""


def apply_to_frame(df: pd.DataFrame, name_cols, date_cols, source_label: str) -> int:
    odf = pd.read_csv(overrides_path, encoding="utf-8-sig")
    applied = 0
    name_series = None
    for col in name_cols:
        if col in df.columns:
            name_series = df[col].map(_norm_name)
            break
    if name_series is None:
        print(f"WARNING: no name column for {source_label}")
        return 0

    # Per-row date candidate sets for ambiguous DD/MM vs MM/DD
    date_cand_lists = []
    for idx in df.index:
        cands = set()
        for col in date_cols:
            if col in df.columns:
                cands |= _date_candidates(df.at[idx, col])
        date_cand_lists.append(cands)

    for _, ov in odf.iterrows():
        rn = _norm_name(ov.get("reviewer_name"))
        rd_cands = _date_candidates(ov.get("review_date"))
        scope = str(ov.get("scope") or "product").strip().lower()
        slug = "" if pd.isna(ov.get("product_slug")) else str(ov.get("product_slug")).strip()
        if not rn:
            continue
        mask_bits = []
        for i, idx in enumerate(df.index):
            if name_series.loc[idx] != rn:
                mask_bits.append(False)
                continue
            if rd_cands and not (date_cand_lists[i] & rd_cands):
                mask_bits.append(False)
                continue
            mask_bits.append(True)
        mask = pd.Series(mask_bits, index=df.index)
        if not mask.any():
            continue

        if scope == "exclude":
            if "product_slug" in df.columns:
                df.loc[mask, "product_slug"] = ""
            if "product_name" in df.columns:
                df.loc[mask, "product_name"] = ""
            if "attribution_source" in df.columns:
                df.loc[mask, "attribution_source"] = "override_exclude"
        elif scope == "business_level" or not slug:
            if "product_slug" in df.columns:
                df.loc[mask, "product_slug"] = ""
            if "product_name" in df.columns:
                df.loc[mask, "product_name"] = ""
            if "attribution_source" in df.columns:
                df.loc[mask, "attribution_source"] = "override_business_level"
        else:
            if "product_slug" in df.columns:
                df.loc[mask, "product_slug"] = slug
            if "product_name" in df.columns:
                df.loc[mask, "product_name"] = name_by_slug.get(slug, df.loc[mask, "product_name"])
            if "attribution_source" in df.columns:
                df.loc[mask, "attribution_source"] = "override_15_attribution"
        applied += int(mask.sum())
    return applied


out_df = pd.read_csv(google_path, encoding="utf-8-sig")
if "attribution_source" not in out_df.columns:
    out_df["attribution_source"] = ""
g_hits = apply_to_frame(out_df, ["reviewer", "reviewer_name", "author"], ["date", "date_parsed"], "Google")
out_df.to_csv(google_path, index=False, encoding="utf-8-sig")
print(f"Applied {g_hits} durable override row-hits → {google_path.name}")

tp_df = pd.read_csv(trustpilot_path, encoding="utf-8-sig")
if "attribution_source" not in tp_df.columns:
    tp_df["attribution_source"] = ""
if "product_name" not in tp_df.columns:
    tp_df["product_name"] = ""
t_hits = apply_to_frame(
    tp_df,
    ["review_username", "reviewer", "reviewer_name"],
    ["review_created_(utc)", "date", "date_parsed"],
    "Trustpilot",
)
tp_df.to_csv(trustpilot_path, index=False, encoding="utf-8-sig")
print(f"Applied {t_hits} durable override row-hits → {trustpilot_path.name}")
