"""Dedupe change list + uncapped slug impact for RESPONSE."""
from pathlib import Path
import pandas as pd

SHARED = Path(r"G:\Dropbox\alan ranger photography\Website Code\alan-shared-resources") / "csv processed"
ch = pd.read_csv(SHARED / "16-review-reattribution-changes-2026-10-06.csv", encoding="utf-8-sig")
ch = ch.drop_duplicates(subset=["reviewer", "date", "old_slug", "new_slug"], keep="first")
hm = ch["reviewer"].astype(str).str.contains("Harmit", case=False, na=False)
if hm.sum() > 1:
    keep = ch[hm & ch["old_slug"].notna()].index[:1]
    ch = ch.drop(ch[hm].index.difference(keep))
ch.to_csv(SHARED / "16-review-reattribution-changes-2026-10-06.csv", index=False, encoding="utf-8-sig")
print("CHANGES", len(ch), "HIGH", int((ch.confidence == "HIGH").sum()),
      "MEDIUM", int((ch.confidence == "MEDIUM").sum()), "LOW", int((ch.confidence == "LOW").sum()))

pairs = ch[ch["new_slug"].notna() & (ch["new_slug"].astype(str) != "") & (ch["new_slug"].astype(str) != "nan")]
print("reattributed_with_slug", len(pairs))
for (o, n), g in pairs.groupby(["old_slug", "new_slug"]):
    print(f"PAIR|{o or '(blank)'}|{n}|{len(g)}")


def load_comb(path):
    df = pd.read_csv(path, encoding="utf-8-sig")
    df = df[df["product_slug"].notna() & (df["product_slug"].astype(str).str.len() > 0) & (df["product_slug"].astype(str) != "nan")]
    r = pd.to_numeric(df.get("ratingValue", df.get("rating")), errors="coerce")
    df = df.assign(_r=r)
    return df.groupby("product_slug").agg(n=("_r", "count"), avg=("_r", "mean")).reset_index()


oldp = [p for p in SHARED.glob("03*combined*") if p.name.endswith(".backup-2026-10-06")][0]
newp = [p for p in SHARED.glob("03*combined_product_reviews.csv") if "backup" not in p.name and "pre-sync" not in p.name][0]
print("old", oldp.name, "new", newp.name)
o = load_comb(oldp)
n = load_comb(newp)
m = o.merge(n, on="product_slug", how="outer", suffixes=("_old", "_new")).fillna(0)
chg = m[(m.n_old != m.n_new) | (m.avg_old.round(3) != m.avg_new.round(3))]
print("uncapped_changed", len(chg))
for _, r in chg.sort_values("product_slug").iterrows():
    print(f"UNCAPPED|{r.product_slug}|{int(r.n_old)}|{r.avg_old:.2f}|{int(r.n_new)}|{r.avg_new:.2f}")

# Schema CSV (capped) impact already known — reprint from 04
old4 = pd.read_csv(list(SHARED.glob("04*REVIEW_RATINGS.csv.backup-2026-10-06"))[0], encoding="utf-8-sig")
new4 = pd.read_csv([p for p in SHARED.glob("04*REVIEW_RATINGS.csv") if "backup" not in p.name][0], encoding="utf-8-sig")


def slug_from_url(u):
    u = str(u).rstrip("/")
    return u.split("/")[-1] if u and u != "nan" else ""


old4["slug"] = old4["url"].map(slug_from_url)
new4["slug"] = new4["url"].map(slug_from_url)
m4 = old4.merge(new4, on="slug", suffixes=("_old", "_new"))
chg4 = m4[
    (m4["review_count_old"].fillna(-1) != m4["review_count_new"].fillna(-1))
    | (m4["average_rating_old"].fillna(-1).round(3) != m4["average_rating_new"].fillna(-1).round(3))
]
print("schema_csv_changed", len(chg4))
for _, r in chg4.sort_values("slug").iterrows():
    print(
        f"SCHEMA|{r['slug']}|{int(r['review_count_old'] or 0)}|{r['average_rating_old']}|"
        f"{int(r['review_count_new'] or 0)}|{r['average_rating_new']}"
    )
