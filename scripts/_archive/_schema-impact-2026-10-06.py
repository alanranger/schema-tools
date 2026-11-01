"""Schema impact: old vs new 04 aggregateRating counts."""
from pathlib import Path
import pandas as pd
import re

SHARED = Path(r"G:\Dropbox\alan ranger photography\Website Code\alan-shared-resources") / "csv processed"
old = pd.read_csv(list(SHARED.glob("04*REVIEW_RATINGS.csv.backup-2026-10-06"))[0], encoding="utf-8-sig")
new = pd.read_csv([p for p in SHARED.glob("04*REVIEW_RATINGS.csv") if "backup" not in p.name][0], encoding="utf-8-sig")


def slug_from_url(u):
    u = str(u).rstrip("/")
    return u.split("/")[-1] if u and u != "nan" else ""


old["slug"] = old["url"].map(slug_from_url)
new["slug"] = new["url"].map(slug_from_url)
m = old.merge(new, on="slug", suffixes=("_old", "_new"))
changed = m[
    (m["review_count_old"].fillna(-1) != m["review_count_new"].fillna(-1))
    | (m["average_rating_old"].fillna(-1).round(3) != m["average_rating_new"].fillna(-1).round(3))
].copy()
changed = changed.sort_values("slug")
print(f"changed_products {len(changed)}")
for _, r in changed.iterrows():
    print(
        f"{r['slug']}|{int(r['review_count_old']) if pd.notna(r['review_count_old']) else 0}|"
        f"{r['average_rating_old']}|{int(r['review_count_new']) if pd.notna(r['review_count_new']) else 0}|"
        f"{r['average_rating_new']}"
    )

# Change list summary
ch = pd.read_csv(SHARED / "16-review-reattribution-changes-2026-10-06.csv", encoding="utf-8-sig")
print("CHANGES total", len(ch))
print("HIGH", int((ch.confidence == "HIGH").sum()), "LOW", int((ch.confidence == "LOW").sum()), "MEDIUM", int((ch.confidence == "MEDIUM").sum()))
pairs = ch[ch["new_slug"].notna() & (ch["new_slug"].astype(str) != "") & (ch["new_slug"].astype(str) != "nan")]
print("reattributed_with_slug", len(pairs))
print("by_old_to_new:")
for (o, n), g in pairs.groupby(["old_slug", "new_slug"]):
    print(f"  {o or '(blank)'} -> {n}: {len(g)}")
