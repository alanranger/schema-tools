#!/usr/bin/env python3
"""Check Google reviews rating format"""

import pandas as pd
from pathlib import Path

# Updated to use shared-resources structure
script_dir = Path(__file__).parent
project_root = script_dir.parent
shared_resources_dir = project_root.parent / 'alan-shared-resources'
csv_processed_dir = shared_resources_dir / 'csv processed'

google_path = csv_processed_dir / "03b_google_matched.csv"
google = pd.read_csv(google_path, encoding="utf-8-sig")

print("Google reviews analysis:")
print(f"Total: {len(google)}")
print(f"Columns: {list(google.columns)}")
if 'rating' in google.columns:
    print(f"Rating column dtype: {google['rating'].dtype}")
    print(f"Sample ratings: {google['rating'].head(20).tolist()}")
    print(f"Unique ratings: {sorted(google['rating'].unique())}")
    print(f"Reviews with rating >= 4: {len(google[pd.to_numeric(google['rating'], errors='coerce') >= 4])}")


