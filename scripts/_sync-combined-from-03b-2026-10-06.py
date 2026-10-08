"""Sync combined 03 product_slug from 03b (normalized date keys)."""
from pathlib import Path
import pandas as pd

SHARED = Path(r"G:\Dropbox\alan ranger photography\Website Code\alan-shared-resources") / "csv processed"
g = pd.read_csv(SHARED / "03b_google_matched.csv", encoding="utf-8-sig")
combined_path = list(SHARED.glob("03*combined_product_reviews.csv"))[0]
comb = pd.read_csv(combined_path, encoding="utf-8-sig")

bk = combined_path.with_suffix(combined_path.suffix + ".pre-sync-2026-10-06")
if not bk.exists():
    comb.to_csv(bk, index=False, encoding="utf-8-sig")
    print("backed up", bk.name)


def norm_date(s):
    s = str(s).strip()
    return s[:10] if len(s) >= 10 else s


g2 = g.copy()
g2["_key"] = g2["reviewer"].astype(str).str.strip().str.lower() + "|" + g2["date"].map(norm_date)
slug_map = dict(zip(g2["_key"], g2["product_slug"]))
name_map = dict(zip(g2["_key"], g2["product_name"]))
attr_map = dict(zip(g2["_key"], g2["attribution_source"]))

is_google = comb["source"].astype(str).str.contains("Google", case=False, na=False)
goog = comb[is_google].copy()
non_g = comb[~is_google].copy()
goog["_key"] = goog["reviewer"].astype(str).str.strip().str.lower() + "|" + goog["date"].map(norm_date)
before = goog["product_slug"].fillna("").astype(str)
mapped = goog["_key"].map(slug_map)
miss = mapped.isna() | (mapped.astype(str) == "nan")
goog["product_slug"] = mapped.where(~miss, before)
goog["product_name"] = goog["_key"].map(name_map).fillna(goog.get("product_name"))
if "attribution_source" in goog.columns:
    goog["attribution_source"] = goog["_key"].map(attr_map).fillna(goog["attribution_source"])
changed = (before != goog["product_slug"].fillna("").astype(str)).sum()
print("google rows updated slug", int(changed), "of", len(goog))
print("key hits", int(goog["_key"].isin(slug_map).sum()))
goog = goog.drop(columns=["_key"], errors="ignore")
out = pd.concat([non_g, goog], ignore_index=True)
out.to_csv(combined_path, index=False, encoding="utf-8-sig")
print("wrote combined", len(out))

examples = [
    "Sam Franklin", "Simon Chatterley", "Kate Clay", "Harmit Kuner", "Michael White",
    "Mahmood Esmail", "Sue Green", "Dean Le Page", "Penelope Ulander", "Graham Rousell",
    "Roz", "Francisca", "Michael Auinger", "John Madigan",
]
print("EXAMPLES from 03b:")
for n in examples:
    hit = g[g["reviewer"].astype(str).str.contains(n, case=False, na=False)]
    if len(hit):
        r = hit.iloc[0]
        print(f"  {n} | {r['date']} | {r['product_slug']}")
    else:
        print(f"  {n} | NOT FOUND")

ch = pd.read_csv(SHARED / "16-review-reattribution-changes-2026-10-06.csv", encoding="utf-8-sig")
high = ch[(ch["confidence"] == "HIGH") & ch["new_slug"].notna() & (ch["new_slug"] != "")]
extra = ch[ch["reviewer"].astype(str).str.contains("Harmit", case=False, na=False)]
cur = pd.concat([high, extra]).drop_duplicates(subset=["reviewer", "date"], keep="last")
cur14 = pd.DataFrame({
    "reviewer_name": cur["reviewer"],
    "review_date": cur["date"],
    "product_slug": cur["new_slug"],
    "source_rule": cur["reason"],
    "category": "text_keyword_reattribution",
})
cur14.to_csv(SHARED / "14-google-curated-attributions.csv", index=False, encoding="utf-8-sig")
print("14 rows", len(cur14))
print("HIGH", int((ch.confidence == "HIGH").sum()), "LOW", int((ch.confidence == "LOW").sum()), "total", len(ch))
