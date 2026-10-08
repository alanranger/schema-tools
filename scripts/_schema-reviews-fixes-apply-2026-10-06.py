"""Apply schema-reviews-fixes items 1,6 (+ sync combined)."""
from pathlib import Path
import json
import shutil
import pandas as pd

CSV = Path(r"G:\Dropbox\alan ranger photography\Website Code\alan-shared-resources\csv processed")
SHARED = CSV.parent
STAMP = "2026-10-06-schema-fixes"

# From booking evidence + review text
RESLUG = {
    # reviewer lower -> (new_slug, evidence)
    "andrew morris": ("2hr-private-photography-classes-2hr", "pre-review bookings May 2025 = 1hr F2F single; 4x package only booked 2026-10-06 after review"),
    "chris brown": ("2hr-private-photography-classes-2hr", "no ledger hit; review says single practical 1-2-1 session"),
    "matthew payton": ("four-private-photography-classes", "review text: 'block of 4 two hour 1-1 sessions'"),
    "ian burns": ("2hr-private-photography-classes-2hr", "booking 2025-05-06 1-2-1 Single Session 1hr F2F £50"),
    "ash routen": ("2hr-private-photography-classes-2hr", "no ledger hit; review: one-to-one tutorial session"),
    "ian mchardy": ("2hr-private-photography-classes-2hr", "Diane McHardy 2026-03-27 2hr f2f 1-2-1 £120 (household); review describes morning F2F"),
    "claire hannis": ("2hr-private-photography-classes-2hr", "no ledger hit; review describes ongoing sessions → single-session product page"),
    "john grubb": ("2hr-private-photography-classes-2hr", "no ledger hit; review describes single landscape session"),
    "barbara bett": ("2hr-private-photography-classes-2hr", "booking 2025-03-30 BARBARA BETT Warwickshire 2hr F2F £250; review outdoor practical"),
}

NAME_BY = {
    "2hr-private-photography-classes-2hr": "1 x 2hr Private Photography Classes - Face to Face Coventry",
    "four-private-photography-classes": "4 x 2hr Private Photography Classes - Face to Face Coventry",
}


def backup(p: Path):
    bk = p.with_suffix(p.suffix + f".backup-{STAMP}")
    if not bk.exists():
        shutil.copy2(p, bk)
        print("backup", bk.name)


def main():
    g_path = CSV / "03b_google_matched.csv"
    backup(g_path)
    g = pd.read_csv(g_path, encoding="utf-8-sig")
    evidence_rows = []

    for i, row in g.iterrows():
        nn = str(row["reviewer"]).strip().lower()
        if nn in RESLUG:
            slug, ev = RESLUG[nn]
            g.at[i, "product_slug"] = slug
            g.at[i, "product_name"] = NAME_BY.get(slug, "")
            g.at[i, "attribution_source"] = "schema_fixes_f2f_2026-10-06"
            evidence_rows.append(
                {
                    "reviewer": row["reviewer"],
                    "review_date": str(row["date"])[:10],
                    "new_slug": slug,
                    "evidence": ev,
                }
            )
        # Roz -> business level
        if nn == "roz":
            g.at[i, "product_slug"] = ""
            g.at[i, "product_name"] = ""
            g.at[i, "attribution_source"] = "business_level_org_2026-10-06"

    # Ensure mentoring / academy slugs stay on those reviews
    for i, row in g.iterrows():
        nn = str(row["reviewer"]).strip().lower()
        if nn in {"john flack", "patricia willis", "john ellis", "jan & gary boulter"}:
            g.at[i, "product_slug"] = "photography-mentoring-online-assignments"
            g.at[i, "product_name"] = "Photography Mentor Online — Monthly Mentoring"
            g.at[i, "attribution_source"] = "schema_fixes_mentoring_2026-10-06"
        if nn in {"catalina christensen", "bruce radebaugh", "andrew blaxhall"}:
            g.at[i, "product_slug"] = "free-online-photography-course"
            g.at[i, "product_name"] = "Free Online Photography Course"
            g.at[i, "attribution_source"] = "schema_fixes_academy_2026-10-06"
        # Richard Johnson stays Zoom
        if nn == "richard johnson":
            g.at[i, "product_slug"] = "private-online-photography-classes-zoom"
            g.at[i, "product_name"] = "Online Photography Classes 121 - Zoom - Package Options"
            g.at[i, "attribution_source"] = "schema_fixes_zoom_retain_2026-10-06"

    g.to_csv(g_path, index=False, encoding="utf-8-sig")
    pd.DataFrame(evidence_rows).to_csv(CSV / "19-f2f-reslug-evidence-2026-10-06.csv", index=False, encoding="utf-8-sig")
    print("wrote 03b; f2f evidence", len(evidence_rows))

    # Update business-level file to include Roz if missing
    biz_path = CSV / "18-business-level-google-reviews-2026-10-06.csv"
    if biz_path.exists():
        biz = pd.read_csv(biz_path, encoding="utf-8-sig")
    else:
        biz = pd.DataFrame(columns=["reviewer", "date", "rating", "review", "scope"])
    roz = g[g["reviewer"].astype(str).str.lower() == "roz"]
    if len(roz) and not (biz["reviewer"].astype(str).str.lower() == "roz").any():
        r = roz.iloc[0]
        biz = pd.concat(
            [
                biz,
                pd.DataFrame(
                    [
                        {
                            "reviewer": r["reviewer"],
                            "date": str(r["date"])[:10],
                            "rating": r.get("rating"),
                            "review": r.get("review"),
                            "scope": "business_level",
                        }
                    ]
                ),
            ],
            ignore_index=True,
        )
        biz.to_csv(biz_path, index=False, encoding="utf-8-sig")
        print("added Roz to business-level csv")

    # Rebuild combined Google rows from 03b
    comb_path = list(CSV.glob("03*combined_product_reviews.csv"))[0]
    backup(comb_path)
    comb = pd.read_csv(comb_path, encoding="utf-8-sig")
    is_g = comb["source"].astype(str).str.contains("Google", case=False, na=False)
    non_g = comb[~is_g].copy()
    g2 = pd.read_csv(g_path, encoding="utf-8-sig")
    google_rows = []
    for _, r in g2.iterrows():
        google_rows.append(
            {
                "source": "Google",
                "reviewer": r["reviewer"],
                "date": str(r["date"])[:10],
                "rating": r.get("rating"),
                "review": r.get("review"),
                "reviewBody": r.get("review"),
                "ratingValue": r.get("rating"),
                "product_slug": "" if pd.isna(r.get("product_slug")) else r.get("product_slug"),
                "product_name": "" if pd.isna(r.get("product_name")) else r.get("product_name"),
                "attribution_source": r.get("attribution_source"),
                "reference_id": r.get("reference_id"),
            }
        )
    goog_new = pd.DataFrame(google_rows)
    for c in comb.columns:
        if c not in goog_new.columns:
            goog_new[c] = None
    goog_new = goog_new.reindex(columns=list(comb.columns))
    # Normalize ratingValue words → numbers for ALL rows
    m = {"ONE": 1, "TWO": 2, "THREE": 3, "FOUR": 4, "FIVE": 5}

    def norm_rating(v):
        if pd.isna(v):
            return None
        s = str(v).strip().upper()
        if s in m:
            return float(m[s])
        try:
            f = float(s)
            return f if 1 <= f <= 5 else None
        except Exception:
            return None

    out = pd.concat([non_g, goog_new], ignore_index=True)
    out["ratingValue"] = out.get("ratingValue").map(norm_rating)
    if "rating" in out.columns:
        out["ratingValue"] = out["ratingValue"].fillna(out["rating"].map(norm_rating))
    # Ensure reviewBody filled
    if "reviewBody" in out.columns:
        empty = out["reviewBody"].isna() | out["reviewBody"].astype(str).str.strip().isin(["", "nan", "None"])
        if "review" in out.columns:
            out.loc[empty, "reviewBody"] = out.loc[empty, "review"]
        if "review_content" in out.columns:
            empty = out["reviewBody"].isna() | out["reviewBody"].astype(str).str.strip().isin(["", "nan", "None"])
            out.loc[empty, "reviewBody"] = out.loc[empty, "review_content"]
    # Normalize dates to ISO date strings where possible (fix mixed parse)
    def norm_date(v):
        if pd.isna(v):
            return None
        dt = pd.to_datetime(v, errors="coerce", format="mixed")
        if pd.isna(dt):
            return v
        return dt.strftime("%Y-%m-%d")

    if "date" in out.columns:
        out["date"] = out["date"].map(norm_date)
    out.to_csv(comb_path, index=False, encoding="utf-8-sig")
    print("wrote combined", len(out))


if __name__ == "__main__":
    main()
