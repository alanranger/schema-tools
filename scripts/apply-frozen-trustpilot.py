#!/usr/bin/env python3
"""
Step 1 of merge-reviews.py: Trustpilot is frozen history.

Copies alan-shared-resources/csv/raw-03a-trustpilot-attributed-FROZEN.csv to
csv processed/03a_trustpilot_matched.csv. Trustpilot reviews are never re-matched, so hiding
or renaming a product can no longer drop or move them. To change one attribution, edit the
FROZEN file by hand (it is the source of truth).
"""
import sys
from pathlib import Path

import pandas as pd

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

SHARED = Path(__file__).resolve().parents[2] / "alan-shared-resources"
FROZEN = SHARED / "csv" / "raw-03a-trustpilot-attributed-FROZEN.csv"
OUT = SHARED / "csv processed" / "03a_trustpilot_matched.csv"


def main():
    if not FROZEN.exists():
        print(f"ERROR: frozen Trustpilot file missing: {FROZEN}")
        return 1
    df = pd.read_csv(FROZEN, encoding="utf-8-sig", dtype=str, keep_default_na=False)
    blank = df[df["product_slug"].str.strip() == ""]
    if df["review_id"].duplicated().any() or len(blank):
        print(f"ERROR: frozen file invalid (duplicate ids or {len(blank)} blank slugs)")
        return 1
    df.to_csv(OUT, index=False, encoding="utf-8-sig")
    print(f"Trustpilot frozen: {len(df)} reviews copied to {OUT.name} (no re-matching)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
