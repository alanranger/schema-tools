from pathlib import Path
import pandas as pd

CSV = Path(r"G:\Dropbox\alan ranger photography\Website Code\alan-shared-resources\csv processed")
olds = list(CSV.glob("04*REVIEW_RATINGS.csv.backup-2026-10-06-apply"))
if not olds:
    olds = list(CSV.glob("04*REVIEW_RATINGS.csv.backup-2026-10-06"))
news = [p for p in CSV.glob("04*REVIEW_RATINGS.csv") if "backup" not in p.name]
old = pd.read_csv(olds[0], encoding="utf-8-sig")
new = pd.read_csv(news[0], encoding="utf-8-sig")


def slug(u):
    u = str(u).rstrip("/")
    return u.split("/")[-1] if u and u != "nan" else ""


old["slug"] = old.url.map(slug)
new["slug"] = new.url.map(slug)
m = old.merge(new, on="slug", suffixes=("_old", "_new"))
chg = m[
    (m.review_count_old.fillna(-1) != m.review_count_new.fillna(-1))
    | (m.average_rating_old.fillna(-1).round(3) != m.average_rating_new.fillna(-1).round(3))
]
print("changed", len(chg))
for _, r in chg.sort_values("slug").iterrows():
    print(
        f"{r.slug}|{int(r.review_count_old or 0)}|{r.average_rating_old}|"
        f"{int(r.review_count_new or 0)}|{r.average_rating_new}"
    )
