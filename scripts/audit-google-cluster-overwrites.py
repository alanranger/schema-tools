#!/usr/bin/env python3
"""Find Google reviews where date-cluster logic would override a text/alias match."""
import sys
from pathlib import Path

import pandas as pd

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

SCRIPT_DIR = Path(__file__).parent
SHARED = SCRIPT_DIR.parent.parent / "alan-shared-resources"
OUT = SHARED / "csv processed" / "11-google-cluster-overwrite-audit.csv"
MATCHER_SRC = SCRIPT_DIR / "match-google-reviews.py"

# Load only matcher helpers (not module-level pipeline execution)
matcher_chunk = MATCHER_SRC.read_text(encoding="utf-8").split("# Build date cluster map")[0]
matcher_chunk = matcher_chunk.split("# Normalize function")[1]
ns = {"pd": pd, "re": __import__("re"), "SequenceMatcher": __import__("difflib").SequenceMatcher, "timedelta": __import__("datetime").timedelta}
exec(matcher_chunk, ns)
match_google_review_to_product = ns["match_google_review_to_product"]
ALIASES = ns["ALIASES"]

products = pd.read_excel(SHARED / "csv processed/02 – products_cleaned.xlsx")
products["slug"] = products["url"].astype(str).str.rstrip("/").str.split("/").str[-1]
name_by_slug = dict(zip(products["slug"], products["name"]))
product_by_slug = set(products["slug"])

google_df = pd.read_csv(SHARED / "csv/raw-03b-google-reviews.csv")
google_df["date_parsed"] = pd.to_datetime(google_df["date"], errors="coerce")
google_sorted = google_df[google_df["date_parsed"].notna()].sort_values("date_parsed").copy()

first_pass = {}
for idx, row in google_sorted.iterrows():
    text = str(row.get("review", "") or "").strip()
    date = row.get("date_parsed")
    slug = match_google_review_to_product(
        text, "", date, name_by_slug, product_by_slug, ALIASES, None, None
    )
    if slug:
        first_pass[idx] = slug

clusters = []
current = [google_sorted.index[0]]
for idx in list(google_sorted.index)[1:]:
    last = google_sorted.loc[current[-1], "date_parsed"]
    cur = google_sorted.loc[idx, "date_parsed"]
    if pd.notna(last) and pd.notna(cur) and (cur - last).days <= 3:
        current.append(idx)
    else:
        if len(current) >= 2:
            clusters.append(current)
        current = [idx]
if len(current) >= 2:
    clusters.append(current)

cluster_assign = {}
for cluster in clusters:
    product = None
    for idx in cluster:
        if idx in first_pass:
            product = first_pass[idx]
            break
    if product:
        for idx in cluster:
            cluster_assign[idx] = product

matched_now = pd.read_csv(SHARED / "csv processed/03b_google_matched.csv")
matched_by_reviewer = {
    (str(r["reviewer"]).strip(), str(r["date"])[:10]): str(r.get("product_slug", ""))
    for _, r in matched_now.iterrows()
}

rows = []
for idx in google_sorted.index:
    text_slug = first_pass.get(idx)
    cluster_slug = cluster_assign.get(idx)
    reviewer = google_sorted.loc[idx, "reviewer"]
    date = str(google_sorted.loc[idx, "date"])[:10]
    current_slug = matched_by_reviewer.get((str(reviewer).strip(), date), "")

    if text_slug and cluster_slug and text_slug != cluster_slug:
        rows.append(
            {
                "reviewer": reviewer,
                "date": date,
                "text_match_slug": text_slug,
                "text_match_name": name_by_slug.get(text_slug, ""),
                "cluster_would_assign_slug": cluster_slug,
                "cluster_would_assign_name": name_by_slug.get(cluster_slug, ""),
                "current_matched_slug": current_slug,
                "fixed_by_priority_change": current_slug == text_slug,
                "review_snippet": str(google_sorted.loc[idx, "review"])[:200],
            }
        )

audit = pd.DataFrame(rows)
audit.to_csv(OUT, index=False, encoding="utf-8-sig")

print(f"Cluster-overwrite candidates: {len(audit)}")
print(f"Already corrected in current matched file: {audit['fixed_by_priority_change'].sum() if len(audit) else 0}")
print(f"Audit saved: {OUT}")
print()
for _, r in audit.iterrows():
    status = "FIXED" if r["fixed_by_priority_change"] else "CHECK"
    print(f"[{status}] {r['reviewer']} ({r['date']})")
    print(f"  text -> {r['text_match_slug']}")
    print(f"  cluster -> {r['cluster_would_assign_slug']}")
    print(f"  current -> {r['current_matched_slug']}")
    print()
