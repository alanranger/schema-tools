#!/usr/bin/env python3
import re
from difflib import SequenceMatcher
from pathlib import Path

import pandas as pd

SHARED = Path(__file__).resolve().parents[2] / "alan-shared-resources"
BLOG_NAMES = [
    "Patricia Pearl", "Mary Hamilton", "Peter Orton", "John Simpson", "Alistair Willis",
    "Barbara Voules", "Ian Slater", "Janice Jordan", "Kirsten Pearce", "Max Dobres",
    "Dennis Jeffrey", "Janet Boulter", "Francis Peckham", "Vincenzo Albano", "Jacki Rosin",
    "Anne Watkinson", "Paul Kirby", "Joyce James",
]
RPS = "rps-mentoring-photography-course"


def norm(s):
    return re.sub(r"[^a-z0-9 ]", "", str(s).lower()).strip()


def match_name(blog_name, reviewer):
    b, r = norm(blog_name), norm(reviewer)
    if not b or not r:
        return 0
    if b == r:
        return 1.0
    if b in r or r in b:
        return 0.95
    parts = b.split()
    if len(parts) >= 2 and parts[-1] in r and (parts[0] in r or len(parts[0]) <= 3):
        return 0.9
    if len(parts) >= 2 and len(parts[0]) > 3 and parts[0] in r and " " not in str(reviewer).strip():
        return 0.85
    return SequenceMatcher(None, b, r).ratio()


def main():
    raw = pd.read_csv(SHARED / "csv/raw-03b-google-reviews.csv", encoding="utf-8-sig")
    matched = pd.read_csv(SHARED / "csv processed/03b_google_matched.csv", encoding="utf-8-sig")
    combined = pd.read_csv(SHARED / "csv processed/03 – combined_product_reviews.csv", encoding="utf-8-sig")
    rps = combined[combined["product_slug"] == RPS]
    print(f"RPS product: {len(rps)} total, {(rps['source'].str.lower() == 'google').sum()} Google")
    print("=" * 100)
    missing = []
    wrong = []
    ok = []
    for name in BLOG_NAMES:
        best = None
        for _, row in raw.iterrows():
            sc = match_name(name, row["reviewer"])
            if sc >= 0.82 and (not best or sc > best[0]):
                best = (sc, row)
        if not best:
            missing.append(name)
            print(f"{name:22} NO GOOGLE REVIEW")
            continue
        sc, row = best
        m = matched[matched["reviewer"].astype(str).str.lower() == str(row["reviewer"]).lower()]
        slug = m["product_slug"].iloc[0] if len(m) else "UNMATCHED"
        line = f"{name:22} | {row['reviewer']} | {str(row['date'])[:10]} | {slug}"
        if slug == RPS:
            ok.append(name)
            print(line + " | OK")
        else:
            wrong.append((name, row["reviewer"], slug, str(row["review"])[:120]))
            print(line + " | NEEDS RPS")
    print("\nSummary:")
    print(f"  Blog case studies: {len(BLOG_NAMES)}")
    print(f"  On RPS slug: {len(ok)}")
    print(f"  Wrong/missing slug: {len(wrong)}")
    print(f"  No Google review: {len(missing)}")
    if wrong:
        print("\nCandidates to move to RPS:")
        for w in wrong:
            print(f"  - {w[0]} ({w[1]}) currently {w[2]}")
            print(f"    {w[3]}")


if __name__ == "__main__":
    main()
