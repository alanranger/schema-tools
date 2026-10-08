"""
Apply Alan-approved review attributions (2026-10-06).
Updates 03b + combined 03 + curated 14 only. Does NOT touch product_reviews/schema itself.
"""
from __future__ import annotations

import re
import unicodedata
from pathlib import Path

import pandas as pd

SHARED = Path(r"G:\Dropbox\alan ranger photography\Website Code\alan-shared-resources")
CSV = SHARED / "csv processed"
RAW = SHARED / "csv" / "raw-03b-google-reviews.csv"
STAMP = "2026-10-06-apply"


def norm_name(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s or ""))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-z0-9\s]", " ", s.lower())
    return re.sub(r"\s+", " ", s).strip()


def key(name, date) -> str:
    return f"{norm_name(name)}|{str(date)[:10]}"


# HIGH+MEDIUM from 17-
FROM_17 = [
    ("Richard Johnson", "2026-03-27", "private-online-photography-classes-zoom"),
    ("Francisca Solis Puello", "2026-03-14", "professional-commercial-photographer-coventry"),
    ("Michael Auinger", "2025-05-23", "professional-commercial-photographer-coventry"),
    ("Adrian Thomas", "2026-07-18", "photography-workshops-lavender-fields"),
    ("Tony Yeaman", "2025-12-12", "private-online-photography-classes-zoom"),
    ("kim pratt", "2025-11-08", "abstract-and-macro-photography-workshops"),
    ("john simpson", "2025-07-29", "private-online-photography-classes-zoom"),
    ("Kirsty Lilley", "2024-08-18", "private-online-photography-classes-zoom"),
    ("Gillian Taylor", "2025-05-29", "landscape-peak-district-photography-workshops-derbyshire"),
    ("Patricia Pearl", "2025-12-15", "rps-mentoring-photography-course"),
    ("Jason Read", "2026-08-02", "secrets-of-woodland-photography-workshop"),
    ("Michael Simm", "2025-08-24", "intermediates-intentions-photography-project-course"),
    ("Chris Dunn", "2025-05-07", "batsford-arboretum-photography-workshops"),
    ("Barbara Bett", "2025-05-01", "private-online-photography-classes-zoom"),
    ("Jane Harris", "2024-04-22", "bluebell-woodlands-photography-workshops"),
]

PEAK = "landscape-peak-district-photography-workshops-derbyshire"
WOOD = "secrets-of-woodland-photography-workshop"
BLUE = "bluebell-woodlands-photography-workshops"
BATS = "batsford-arboretum-photography-workshops"
BEG = "beginners-photography-course"
F2F = "private-photography-lessons"  # service landing page
ZOOM = "private-online-photography-classes-zoom"
LR = "lightroom-courses-for-beginners-coventry"
MENTOR = "photography-mentoring-online-assignments"
RPS = "rps-mentoring-photography-course"
COMM = "professional-commercial-photographer-coventry"
FREE = "free-online-photography-course"

FROM_B = [
    ("Colin Whittaker", "2026-05-16", PEAK),
    ("Alex McDonald", "2026-05-16", PEAK),
    ("Garry Mumford", "2021-10-19", PEAK),
    ("Joanne Tapp", "2025-08-29", PEAK),
    ("Philip Hart", "2025-10-20", PEAK),
    ("Paul Jackson", "2025-05-26", WOOD),
    ("Martin Millington", "2026-01-11", WOOD),
    ("Or Shachar", "2025-04-23", BLUE),
    ("Orr Shachar", "2025-10-26", BATS),
    ("Ergin Taşdelen", "2025-10-16", BEG),
    ("Ergin Tasdelen", "2025-10-16", BEG),
    ("Richard Hill", "2025-03-10", BEG),
    ("Holly McDonnell", "2023-08-18", BEG),
    ("Karen & Dave", "2025-03-25", BEG),
    ("Andrew Morris", "2025-08-24", F2F),
    ("chris brown", "2022-11-10", F2F),
    ("Matthew Payton", "2022-01-24", F2F),
    ("Ian Burns", "2025-03-21", F2F),
    ("Ash Routen", "2020-06-27", F2F),
    ("Ian McHardy", "2026-05-07", F2F),
    ("Claire Hannis", "2021-09-28", F2F),
    ("John Grubb", "2025-05-01", F2F),
    ("Nicholas Barber", "2021-08-11", ZOOM),
    ("Nick DeCianti", "2021-05-14", ZOOM),
    ("Sean Bruen", "2020-05-26", ZOOM),
    ("Chris Burnard", "2020-04-21", ZOOM),
    ("Daren Baker", "2021-04-09", LR),
    ("Chris Johnson", "2020-04-27", LR),
    ("John Flack", "2020-04-24", MENTOR),
    ("Patricia Willis", "2021-11-10", MENTOR),
    ("John Ellis", "2025-12-09", MENTOR),
    ("Jan & Gary Boulter", "2020-04-11", MENTOR),
    ("Scott Dance", "2021-12-18", RPS),
    ("Peter Hagger", "2021-08-11", RPS),
    ("Roz", "2026-03-20", COMM),
]

FROM_C = [
    ("Catalina Christensen", "2025-08-25", FREE),
    ("Bruce Radebaugh", "2025-08-24", FREE),
    ("Andrew Blaxhall", "2025-08-24", FREE),
]

BUSINESS = {
    norm_name(n)
    for n in [
        "jill harrison",
        "Slothman118",
        "Sean",
        "re wu",
        "Mike",
        "seun adeusi",
        "dp",
        "George H",
        "Anne Veal",
    ]
}


def backup(path: Path):
    import shutil

    bk = path.with_suffix(path.suffix + f".backup-{STAMP}")
    if not bk.exists():
        shutil.copy2(path, bk)
        print("backed up", bk.name)


def main():
    raw = pd.read_csv(RAW, encoding="utf-8-sig")
    g_path = CSV / "03b_google_matched.csv"
    backup(g_path)
    g = pd.read_csv(g_path, encoding="utf-8-sig")

    # Ensure all raw reviews exist in 03b (fix 44 leak)
    g["_k"] = [key(a, b) for a, b in zip(g["reviewer"], g["date"])]
    raw["_k"] = [key(a, b) for a, b in zip(raw["reviewer"], raw["date"])]
    missing = raw[~raw["_k"].isin(set(g["_k"]))].copy()
    if len(missing):
        add = missing[["reviewer", "rating", "review", "date", "source", "reference_id"]].copy()
        add["date_parsed"] = add["date"]
        add["product_slug"] = ""
        add["product_name"] = ""
        add["attribution_source"] = "imported_from_raw_2026-10-06"
        g = pd.concat([g, add], ignore_index=True)
        g["_k"] = [key(a, b) for a, b in zip(g["reviewer"], g["date"])]
        print("added missing raw rows to 03b", len(add))

    # Product names from workbook
    prods = list(CSV.glob("02*products*"))[0]
    pdf = pd.read_excel(prods, engine="openpyxl")
    pdf["slug"] = pdf["url"].astype(str).str.rstrip("/").str.split("/").str[-1]
    name_by = {r.slug: r["name"] for _, r in pdf.iterrows()}
    # Extra service pages not in product workbook
    name_by.update(
        {
            F2F: "Private Photography Lessons (Face to Face)",
            MENTOR: "Photography Mentoring Online Assignments",
            COMM: "Professional Commercial Photographer Coventry",
            FREE: "Free Online Photography Course (Academy)",
        }
    )

    applies = {}
    for reviewer, date, slug in FROM_17 + FROM_B + FROM_C:
        applies[key(reviewer, date)] = (slug, "approved_apply_2026-10-06")

    # Also match by normalised name only when date key misses (unicode variants)
    name_to_slug = {}
    for reviewer, date, slug in FROM_17 + FROM_B + FROM_C:
        name_to_slug.setdefault(norm_name(reviewer), []).append((str(date)[:10], slug))

    applied = 0
    business_rows = []
    star_only = []

    for i, row in g.iterrows():
        k = row["_k"]
        nn = norm_name(row["reviewer"])
        text = row.get("review")
        has_text = pd.notna(text) and str(text).strip() not in ("", "nan")

        if nn in BUSINESS:
            g.at[i, "product_slug"] = ""
            g.at[i, "product_name"] = ""
            g.at[i, "attribution_source"] = "business_level_org_2026-10-06"
            business_rows.append(
                {
                    "reviewer": row["reviewer"],
                    "date": str(row["date"])[:10],
                    "rating": row.get("rating"),
                    "review": text if has_text else "",
                    "scope": "business_level",
                }
            )
            continue

        slug = None
        if k in applies:
            slug = applies[k][0]
        elif nn in name_to_slug:
            # prefer exact date, else unique name mapping
            opts = name_to_slug[nn]
            exact = [s for d, s in opts if d == str(row["date"])[:10]]
            if exact:
                slug = exact[0]
            elif len({s for _, s in opts}) == 1:
                slug = opts[0][1]

        if slug:
            g.at[i, "product_slug"] = slug
            g.at[i, "product_name"] = name_by.get(slug, "")
            g.at[i, "attribution_source"] = "approved_apply_2026-10-06"
            applied += 1
        elif not has_text:
            # star-only: keep existing slug if any; flag
            star_only.append(
                {
                    "reviewer": row["reviewer"],
                    "date": str(row["date"])[:10],
                    "rating": row.get("rating"),
                    "product_slug": row.get("product_slug") if pd.notna(row.get("product_slug")) else "",
                    "scope": "star_only",
                }
            )

    g = g.drop(columns=["_k"], errors="ignore")
    g.to_csv(g_path, index=False, encoding="utf-8-sig")
    print("wrote 03b", len(g), "applied_slots", applied)

    # Rebuild combined: Trustpilot keep + Google from 03b (normalized date keys)
    comb_path = list(CSV.glob("03*combined_product_reviews.csv"))[0]
    backup(comb_path)
    comb = pd.read_csv(comb_path, encoding="utf-8-sig")
    is_g = comb["source"].astype(str).str.contains("Google", case=False, na=False)
    non_g = comb[~is_g].copy()
    goog = comb[is_g].copy()

    def nd(s):
        s = str(s).strip()
        return s[:10] if len(s) >= 10 else s

    g2 = pd.read_csv(g_path, encoding="utf-8-sig")
    g2["_k"] = g2["reviewer"].map(norm_name) + "|" + g2["date"].map(nd)
    # Build google frame from 03b fully (source of truth)
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
    # Align columns with combined
    for c in comb.columns:
        if c not in goog_new.columns:
            goog_new[c] = None
    goog_new = goog_new.reindex(columns=list(comb.columns))
    out = pd.concat([non_g, goog_new], ignore_index=True)
    out.to_csv(comb_path, index=False, encoding="utf-8-sig")
    print("wrote combined", len(out), "google", len(goog_new), "trustpilot", len(non_g))

    # Curated 14: approved applies with slug
    curated = []
    for reviewer, date, slug in FROM_17 + FROM_B + FROM_C:
        curated.append(
            {
                "reviewer_name": reviewer,
                "review_date": date,
                "product_slug": slug,
                "source_rule": "alan_approved_2026-10-06",
                "category": "approved_apply",
            }
        )
    c14 = CSV / "14-google-curated-attributions.csv"
    backup(c14)
    pd.DataFrame(curated).to_csv(c14, index=False, encoding="utf-8-sig")

    pd.DataFrame(business_rows).to_csv(CSV / "18-business-level-google-reviews-2026-10-06.csv", index=False, encoding="utf-8-sig")
    pd.DataFrame(star_only).to_csv(CSV / "18-star-only-google-reviews-2026-10-06.csv", index=False, encoding="utf-8-sig")
    print("business", len(business_rows), "star_only", len(star_only), "curated14", len(curated))
    blank = (g["product_slug"].isna()) | (g["product_slug"].astype(str).isin(["", "nan"]))
    print("03b with slug", int((~blank).sum()), "blank", int(blank.sum()))


if __name__ == "__main__":
    main()
