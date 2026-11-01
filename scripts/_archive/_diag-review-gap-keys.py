import json
import re
import unicodedata
from pathlib import Path
import pandas as pd


def norm_name(s):
    s = unicodedata.normalize("NFKD", str(s or ""))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-z0-9\s]", " ", s.lower())
    return re.sub(r"\s+", " ", s).strip()


def rkey(name, date):
    return f"{norm_name(name)}|{str(date)[:10]}"


SHARED = Path(r"G:\Dropbox\alan ranger photography\Website Code\alan-shared-resources")
raw = pd.read_csv(SHARED / "csv" / "raw-03b-google-reviews.csv", encoding="utf-8-sig")
g = pd.read_csv(SHARED / "csv processed" / "03b_google_matched.csv", encoding="utf-8-sig")
pr = pd.DataFrame(json.loads(Path(r"C:\TEMP\pr-google.json").read_text(encoding="utf-8")))
raw["_k"] = [rkey(a, b) for a, b in zip(raw.reviewer, raw.date)]
g["_k"] = [rkey(a, b) for a, b in zip(g.reviewer, g.date)]
pr["_k"] = [rkey(a, b) for a, b in zip(pr.reviewer_name, pr.review_date)]
print("raw", len(raw), "03b", len(g), "pr", len(pr))
print("raw in pr", int(raw._k.isin(pr._k).sum()))
print("03b in pr", int(g._k.isin(pr._k).sum()))
print("pr in raw", int(pr._k.isin(raw._k).sum()))
miss = pr[~pr._k.isin(raw._k)][["reviewer_name", "review_date", "product_slug"]].head(15)
print("pr not in raw sample")
print(miss.to_string())
miss2 = raw[~raw._k.isin(pr._k)]
print("raw not in pr", len(miss2))
print(miss2[["reviewer", "date"]].head(25).to_string())
gs = g[g.product_slug.notna() & ~g.product_slug.astype(str).isin(["", "nan"])]
print("03b with slug", len(gs), "in pr", int(gs._k.isin(pr._k).sum()))
print("03b slug not in pr", len(gs[~gs._k.isin(pr._k)]))
print(gs[~gs._k.isin(pr._k)][["reviewer", "date", "product_slug"]].to_string())
# quote length for those
comb = list((SHARED / "csv processed").glob("03*combined_product_reviews.csv"))[0]
c = pd.read_csv(comb, encoding="utf-8-sig")
c["_k"] = [rkey(a, b) for a, b in zip(c.get("reviewer", c.get("review_username")), c.get("date", c.get("review_created_(utc)")))]
