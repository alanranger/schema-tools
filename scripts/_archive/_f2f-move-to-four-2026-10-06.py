"""Move 8 F2F Google reviews from 2hr → four-pack; rebuild combined."""
from pathlib import Path
import shutil
import pandas as pd

CSV = Path(r"G:\Dropbox\alan ranger photography\Website Code\alan-shared-resources\csv processed")
STAMP = "2026-10-06-f2f-to-four"
MOVE = {
    "andrew morris",
    "chris brown",
    "ian burns",
    "ash routen",
    "ian mchardy",
    "claire hannis",
    "john grubb",
    "barbara bett",
}
FOUR_SLUG = "four-private-photography-classes"
FOUR_NAME = "4 x 2hr Private Photography Classes - Face to Face Coventry"


def backup(p: Path):
    bk = p.with_suffix(p.suffix + f".backup-{STAMP}")
    if not bk.exists():
        shutil.copy2(p, bk)
        print("backup", bk.name)


def main():
    g_path = CSV / "03b_google_matched.csv"
    backup(g_path)
    g = pd.read_csv(g_path, encoding="utf-8-sig")
    moved = 0
    for i, row in g.iterrows():
        nn = str(row["reviewer"]).strip().lower()
        if nn in MOVE:
            g.at[i, "product_slug"] = FOUR_SLUG
            g.at[i, "product_name"] = FOUR_NAME
            g.at[i, "attribution_source"] = "f2f_move_to_four_2026-10-06"
            moved += 1
    g.to_csv(g_path, encoding="utf-8-sig", index=False)
    print("moved", moved, "to four; remaining 2hr", (g.product_slug == "2hr-private-photography-classes-2hr").sum())
    print("four google", (g.product_slug == FOUR_SLUG).sum())

    comb_path = [p for p in CSV.glob("03*combined_product_reviews.csv") if "backup" not in p.name][0]
    backup(comb_path)
    comb = pd.read_csv(comb_path, encoding="utf-8-sig")
    is_g = comb["source"].astype(str).str.contains("Google", case=False, na=False)
    non_g = comb[~is_g].copy()
    google_rows = []
    for _, r in g.iterrows():
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
    if "reviewBody" in out.columns:
        empty = out["reviewBody"].isna() | out["reviewBody"].astype(str).str.strip().isin(["", "nan", "None"])
        if "review" in out.columns:
            out.loc[empty, "reviewBody"] = out.loc[empty, "review"]
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
