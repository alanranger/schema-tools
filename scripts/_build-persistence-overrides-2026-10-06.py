"""Build durable attribution overrides + 02 product flags from current approved state."""
from pathlib import Path
import json
import shutil
import pandas as pd

CSV = Path(r"G:\Dropbox\alan ranger photography\Website Code\alan-shared-resources\csv processed")
SHARED = CSV.parent

# All Google rows that must persist after a raw re-match
g = pd.read_csv(CSV / "03b_google_matched.csv", encoding="utf-8-sig")

rows = []
for _, r in g.iterrows():
    slug = "" if pd.isna(r.get("product_slug")) else str(r.get("product_slug")).strip()
    reviewer = str(r.get("reviewer") or "").strip()
    date = str(r.get("date") or "")[:10]
    src = str(r.get("attribution_source") or "").strip()
    ref = "" if pd.isna(r.get("reference_id")) else str(r.get("reference_id")).strip()
    # Persist: approved / schema-fixes / f2f move / business-level / mentoring / academy / zoom retain
    keep = False
    scope = "product"
    if not slug and "business_level" in src:
        keep = True
        scope = "business_level"
    if src.startswith(
        (
            "approved_apply",
            "schema_fixes_",
            "f2f_move_",
            "business_level",
            "alan_confirmed",
            "booking_sheet_confirmed",
            "booking_reconciled",
        )
    ):
        keep = True
    # Always keep mentoring + academy + four-pack F2F names even if source string differs
    if slug in {
        "photography-mentoring-online-assignments",
        "free-online-photography-course",
        "four-private-photography-classes",
    }:
        keep = True
    if keep and reviewer:
        rows.append(
            {
                "source": "Google",
                "reviewer_name": reviewer,
                "review_date": date,
                "reference_id": ref,
                "product_slug": slug,
                "scope": scope if scope == "business_level" or not slug else "product",
                "priority": 100,
                "notes": src or "persisted_2026-10-06",
            }
        )

# Ensure Roz business-level
if not any(str(x["reviewer_name"]).lower() == "roz" for x in rows):
    rows.append(
        {
            "source": "Google",
            "reviewer_name": "Roz",
            "review_date": "",
            "reference_id": "",
            "product_slug": "",
            "scope": "business_level",
            "priority": 100,
            "notes": "business_level_org_2026-10-06",
        }
    )

out = pd.DataFrame(rows).drop_duplicates(subset=["source", "reviewer_name", "review_date"], keep="last")
# Fix scope for empty slug
out.loc[out["product_slug"].astype(str).str.strip() == "", "scope"] = "business_level"
path = CSV / "15-review-attribution-overrides.csv"
out.to_csv(path, index=False, encoding="utf-8-sig")
print("wrote", path.name, "n=", len(out))
print("four", (out.product_slug == "four-private-photography-classes").sum())
print("mentor", (out.product_slug == "photography-mentoring-online-assignments").sum())
print("academy", (out.product_slug == "free-online-photography-course").sum())
print("business", (out.scope == "business_level").sum())

# 02 flags
prod_path = list(CSV.glob("02*products*"))[0]
bk = prod_path.with_suffix(prod_path.suffix + ".backup-2026-10-06-persistence")
if not bk.exists():
    shutil.copy2(prod_path, bk)
df = pd.read_excel(prod_path, engine="openpyxl")
if "exclude_from_manifest" not in df.columns:
    df["exclude_from_manifest"] = False
if "manual_paste_page" not in df.columns:
    df["manual_paste_page"] = False

def flag_url(url, exclude=False, manual=False):
    m = df["url"].astype(str).str.rstrip("/").str.lower() == str(url).rstrip("/").lower()
    if exclude:
        df.loc[m, "exclude_from_manifest"] = True
    if manual:
        df.loc[m, "manual_paste_page"] = True

flag_url("https://www.alanranger.com/photography-services-near-me/2hr-private-photography-classes-2hr", exclude=True)
flag_url("https://www.alanranger.com/photography-mentoring-online-assignments", exclude=True, manual=True)
df.to_excel(prod_path, index=False, engine="openpyxl")
print("02 flags set", df["exclude_from_manifest"].sum(), "exclude;", df["manual_paste_page"].sum(), "manual")
