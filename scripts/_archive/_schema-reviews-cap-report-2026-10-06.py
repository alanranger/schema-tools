"""Before/after ≤25 review-cap report for all products."""
from pathlib import Path
import pandas as pd
from collections import defaultdict

CSV = Path(r"G:\Dropbox\alan ranger photography\Website Code\alan-shared-resources\csv processed")
OUT = CSV / "20-review-cap-before-after-2026-10-06.csv"

F2F = {
    "2hr-private-photography-classes-2hr",
    "four-private-photography-classes",
}


def parse_old(val):
    if pd.isna(val):
        return pd.NaT
    s = str(val).strip()
    if "T" in s:
        s = s.split("T")[0]
        return pd.to_datetime(s, errors="coerce")
    return pd.to_datetime(s, errors="coerce", dayfirst=True)


def parse_new(val):
    if pd.isna(val):
        return pd.NaT
    s = str(val).strip()
    if not s or s.lower() in {"nan", "none", "nat"}:
        return pd.NaT
    if "T" in s:
        s = s.split("T")[0]
    dt = pd.to_datetime(s, errors="coerce", format="mixed")
    if pd.isna(dt):
        dt = pd.to_datetime(s, errors="coerce", dayfirst=True)
    return dt


def source_bucket(src):
    s = str(src or "").lower()
    if "google" in s:
        return "Google"
    if "trustpilot" in s:
        return "Trustpilot"
    return "Other"


def select_cap(df, date_col, n=25):
    d = df.copy()
    d = d.sort_values(date_col, ascending=False, na_position="last")
    return d.head(n)


def summarize(label, comb, products, parse_fn):
    rows = []
    comb = comb.copy()
    comb["_dt"] = comb["date"].map(parse_fn)
    comb["product_slug"] = comb["product_slug"].fillna("").astype(str).str.strip()
    comb = comb[comb["product_slug"] != ""]

    # Exact F2F: do not fuzzy-merge twins
    for _, prow in products.iterrows():
        slug = str(prow.get("product_slug") or "").strip()
        if not slug:
            url = str(prow.get("url") or "")
            slug = url.rstrip("/").split("/")[-1] if url else ""
        name = str(prow.get("name") or slug)
        if slug in F2F:
            matched = comb[comb["product_slug"] == slug]
        else:
            matched = comb[comb["product_slug"] == slug]
            if matched.empty:
                # light fuzzy for non-F2F: startswith only
                matched = comb[comb["product_slug"].str.contains(slug, case=False, na=False) |
                              comb["product_slug"].apply(lambda s: slug in s or s in slug if s else False)]

        total = len(matched)
        capped = select_cap(matched, "_dt", 25) if total else matched
        g = int((capped["source"].map(source_bucket) == "Google").sum()) if total else 0
        t = int((capped["source"].map(source_bucket) == "Trustpilot").sum()) if total else 0
        newest = capped["_dt"].max() if total and capped["_dt"].notna().any() else None
        oldest = capped["_dt"].min() if total and capped["_dt"].notna().any() else None
        nat_rate = float(matched["_dt"].isna().mean()) if total else None
        rows.append({
            "phase": label,
            "product_slug": slug,
            "product_name": name[:80],
            "total_matched": total,
            "emitted": len(capped),
            "google_in_25": g,
            "trustpilot_in_25": t,
            "newest_emitted": newest.strftime("%Y-%m-%d") if pd.notna(newest) else "",
            "oldest_emitted": oldest.strftime("%Y-%m-%d") if pd.notna(oldest) else "",
            "nat_date_rate": round(nat_rate, 3) if nat_rate is not None else "",
        })
    return rows


def main():
    products = pd.read_excel(list(CSV.glob("02*products*"))[0], engine="openpyxl")
    products["product_slug"] = products["url"].astype(str).str.rstrip("/").str.split("/").str[-1]

    before_path = list(CSV.glob("03*combined_product_reviews.csv.backup-2026-10-06-schema-fixes"))[0]
    after_path = list(CSV.glob("03*combined_product_reviews.csv"))[0]
    # Prefer non-backup
    after_path = [p for p in CSV.glob("03*combined_product_reviews.csv") if "backup" not in p.name][0]

    before = pd.read_csv(before_path, encoding="utf-8-sig")
    after = pd.read_csv(after_path, encoding="utf-8-sig")

    rows = []
    rows += summarize("BEFORE", before, products, parse_old)
    rows += summarize("AFTER", after, products, parse_new)
    out = pd.DataFrame(rows)
    out.to_csv(OUT, index=False, encoding="utf-8-sig")
    print("wrote", OUT)
    # Highlight F2F + mentoring + academy + products with >25
    focus = out[out["product_slug"].isin(F2F | {
        "photography-mentoring-online-assignments",
        "free-online-photography-course",
    }) | (out["total_matched"] > 25)]
    print(focus.to_string(index=False))
    # summary delta for capped products
    piv = out.pivot_table(index="product_slug", columns="phase", values=["google_in_25", "trustpilot_in_25", "newest_emitted"], aggfunc="first")
    changed = 0
    for slug in out["product_slug"].unique():
        b = out[(out.phase == "BEFORE") & (out.product_slug == slug)].iloc[0]
        a = out[(out.phase == "AFTER") & (out.product_slug == slug)].iloc[0]
        if (b.google_in_25, b.trustpilot_in_25, b.newest_emitted) != (a.google_in_25, a.trustpilot_in_25, a.newest_emitted):
            changed += 1
    print("products with cap-composition change:", changed, "/", out.product_slug.nunique())


if __name__ == "__main__":
    main()
