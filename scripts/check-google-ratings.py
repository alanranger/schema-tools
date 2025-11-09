#!/usr/bin/env python3
"""Check Google reviews rating format"""

import pandas as pd
from pathlib import Path

google_path = Path("inputs-files/workflow/03b_google_matched.csv")
google = pd.read_csv(google_path, encoding="utf-8-sig")

print("Google reviews analysis:")
print(f"Total: {len(google)}")
print(f"Columns: {list(google.columns)}")
if 'rating' in google.columns:
    print(f"Rating column dtype: {google['rating'].dtype}")
    print(f"Sample ratings: {google['rating'].head(20).tolist()}")
    print(f"Unique ratings: {sorted(google['rating'].unique())}")
    print(f"Reviews with rating >= 4: {len(google[pd.to_numeric(google['rating'], errors='coerce') >= 4])}")

