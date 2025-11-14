#!/usr/bin/env python3
"""Check if merged reviews have valid ratingValue and reviewBody"""

import pandas as pd
from pathlib import Path

# Updated to use shared-resources structure
script_dir = Path(__file__).parent
project_root = script_dir.parent
shared_resources_dir = project_root.parent / 'alan-shared-resources'
csv_processed_dir = shared_resources_dir / 'csv processed'

df = pd.read_csv(csv_processed_dir / "03 – combined_product_reviews.csv", encoding="utf-8-sig")
print(f"Total rows: {len(df)}")
print(f"Columns: {list(df.columns)}")

# Normalize column names like schema generator does
df.columns = [c.strip().lower().replace(' ', '_') for c in df.columns]

# Check ratingValue
if 'ratingvalue' in df.columns:
    df['ratingvalue'] = pd.to_numeric(df['ratingvalue'], errors='coerce')
    print(f"\nratingValue column:")
    print(f"  Non-null: {df['ratingvalue'].notna().sum()}")
    print(f"  Null: {df['ratingvalue'].isna().sum()}")
    print(f"  >= 4: {(df['ratingvalue'] >= 4).sum()}")
else:
    print("\nratingValue column NOT FOUND")

# Check reviewBody
if 'reviewbody' in df.columns:
    df['reviewbody'] = df['reviewbody'].fillna('').astype(str)
    non_empty = (df['reviewbody'].str.strip() != '').sum()
    print(f"\nreviewBody column:")
    print(f"  Non-empty: {non_empty}")
    print(f"  Empty: {len(df) - non_empty}")
else:
    print("\nreviewBody column NOT FOUND")

# Check both conditions
if 'ratingvalue' in df.columns and 'reviewbody' in df.columns:
    df['reviewbody'] = df['reviewbody'].fillna('').astype(str)
    valid = df[
        df['ratingvalue'].notna() &
        (df['reviewbody'].str.strip() != '')
    ]
    print(f"\nValid reviews (ratingValue not null AND reviewBody not empty): {len(valid)}")
    print(f"  With ratingValue >= 4: {(valid['ratingvalue'] >= 4).sum()}")

