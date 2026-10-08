"""Recount gap with name fallback when PR review_date is null; improve slug from event_label."""
import json
import re
import unicodedata
from pathlib import Path
import pandas as pd

SHARED = Path(r"G:\Dropbox\alan ranger photography\Website Code\alan-shared-resources")
raw = pd.read_csv(SHARED / "csv" / "raw-03b-google-reviews.csv", encoding="utf-8-sig")
g = pd.read_csv(SHARED / "csv processed" / "03b_google_matched.csv", encoding="utf-8-sig")
pr = pd.DataFrame(json.loads(Path(r"C:\TEMP\pr-google.json").read_text(encoding="utf-8")))


def norm_name(s):
    s = unicodedata.normalize("NFKD", str(s or ""))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-z0-9\s]", " ", s.lower())
    return re.sub(r"\s+", " ", s).strip()


def rkey(name, date):
    d = str(date)[:10] if date is not None and str(date) not in ("None", "nan", "") else ""
    return f"{norm_name(name)}|{d}"


raw["_n"] = raw.reviewer.map(norm_name)
g["_n"] = g.reviewer.map(norm_name)
pr["_n"] = pr.reviewer_name.map(norm_name)
raw["_k"] = [rkey(a, b) for a, b in zip(raw.reviewer, raw.date)]
g["_k"] = [rkey(a, b) for a, b in zip(g.reviewer, g.date)]
pr["_k"] = [rkey(a, b) for a, b in zip(pr.reviewer_name, pr.review_date)]

pr_keys = set(pr["_k"])
pr_names = set(pr["_n"])
pr_null_date_names = set(pr.loc[pr.review_date.isna() | (pr.review_date.astype(str) == "None"), "_n"])


def in_pr_row(name_norm, key):
    if key in pr_keys:
        return True, "key"
    # PR has this name with null date only
    if name_norm in pr_null_date_names:
        return True, "name_null_date"
    return False, ""


# Classify each raw row
reasons = {
    "in_pr_keyed": 0,
    "in_pr_name_null_date": 0,
    "raw_no_text": 0,
    "not_in_03b_with_text": 0,
    "03b_blank_slug": 0,
    "03b_slug_but_ingest_skipped": 0,
}
detail = []
g_by_k = {r["_k"]: r for _, r in g.iterrows()}
g_keys = set(g["_k"])

for _, rr in raw.iterrows():
    ok, how = in_pr_row(rr["_n"], rr["_k"])
    if ok:
        reasons["in_pr_keyed" if how == "key" else "in_pr_name_null_date"] += 1
        continue
    text = rr["review"]
    has_text = pd.notna(text) and str(text).strip() not in ("", "nan")
    if rr["_k"] not in g_keys:
        if not has_text:
            reasons["raw_no_text"] += 1
            why = "raw_no_text"
        else:
            reasons["not_in_03b_with_text"] += 1
            why = "not_in_03b_with_text"
        slug = ""
        quote_len = len(str(text)) if has_text else 0
    else:
        gr = g_by_k[rr["_k"]]
        slug = gr["product_slug"]
        if pd.isna(slug) or str(slug) in ("", "nan"):
            reasons["03b_blank_slug"] += 1
            why = "03b_blank_slug"
            slug = ""
        else:
            reasons["03b_slug_but_ingest_skipped"] += 1
            why = "03b_slug_but_ingest_skipped"
        quote_len = len(str(gr["review"])) if pd.notna(gr["review"]) else 0
    detail.append(
        {
            "reviewer": rr["reviewer"],
            "date": str(rr["date"])[:10],
            "why": why,
            "slug": slug,
            "quote_len": quote_len,
            "rating": rr["rating"],
            "excerpt": str(text)[:80] if has_text else "",
        }
    )

print("GBP 282")
print("raw", len(raw))
print("reasons", reasons)
print("not in pr total", sum(reasons[k] for k in reasons if not k.startswith("in_pr")))
print("in pr total", reasons["in_pr_keyed"] + reasons["in_pr_name_null_date"])
print("not scraped estimate", 282 - len(raw))
# ingest skip reasons for slug-but-skipped
skipped = [d for d in detail if d["why"] == "03b_slug_but_ingest_skipped"]
print("slug_but_skipped", len(skipped))
for d in skipped:
    print(d)

Path(r"C:\TEMP\gap-detail.json").write_text(json.dumps({"reasons": reasons, "detail": detail}, indent=2), encoding="utf-8")
print("wrote gap-detail", len(detail))
