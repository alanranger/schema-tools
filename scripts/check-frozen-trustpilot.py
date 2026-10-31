#!/usr/bin/env python3
"""
Guard (last step of merge-reviews.py, and `npm run test:frozen-trustpilot`):
fails if any Trustpilot review in the combined file differs from the frozen attribution,
or if a frozen review is missing. Stops a product run from re-introducing re-matching.
"""
import sys
from pathlib import Path

import pandas as pd

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

SHARED = Path(__file__).resolve().parents[2] / "alan-shared-resources"
FROZEN = SHARED / "csv" / "raw-03a-trustpilot-attributed-FROZEN.csv"
COMBINED = SHARED / "csv processed" / "03 – combined_product_reviews.csv"


def slug_map(df):
    return {str(r["review_id"]).strip(): str(r["product_slug"]).strip() for _, r in df.iterrows()}


def main():
    frozen_df = pd.read_csv(FROZEN, encoding="utf-8-sig", dtype=str, keep_default_na=False)
    # Alan-approved exclusions stay in the frozen file as history; merge drops them from combined.
    frozen = slug_map(frozen_df[frozen_df["attribution_source"] != "override_exclude"])
    comb = pd.read_csv(COMBINED, encoding="utf-8-sig", dtype=str, keep_default_na=False)
    current = slug_map(comb[comb["source"] == "Trustpilot"])
    missing = sorted(set(frozen) - set(current))
    extra = sorted(set(current) - set(frozen))
    moved = sorted(k for k in frozen.keys() & current.keys() if frozen[k] != current[k])
    if missing or extra or moved:
        print(f"FAIL: Trustpilot differs from frozen file — missing {len(missing)}, extra {len(extra)}, moved {len(moved)}")
        for k in moved[:20]:
            print(f"   moved {k}: frozen {frozen[k]} -> combined {current[k]}")
        for k in missing[:20]:
            print(f"   missing {k} ({frozen[k]})")
        return 1
    print(f"PASS: {len(frozen)} Trustpilot reviews match the frozen attribution exactly")
    return 0


if __name__ == "__main__":
    sys.exit(main())
