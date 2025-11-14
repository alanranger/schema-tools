#!/usr/bin/env python3
"""Check merged reviews file columns"""

import pandas as pd
from pathlib import Path

df = pd.read_csv("inputs-files/workflow/03 – combined_product_reviews.csv", encoding="utf-8-sig", nrows=5)
print("Columns:", list(df.columns))
print("\nSample row:")
if len(df) > 0:
    row = df.iloc[0]
    print(f"ratingValue: {row.get('ratingValue', 'NOT FOUND')}")
    print(f"rating: {row.get('rating', 'NOT FOUND')}")
    print(f"reviewBody: {row.get('reviewBody', 'NOT FOUND')[:50] if row.get('reviewBody') else 'NOT FOUND'}")
    print(f"review: {row.get('review', 'NOT FOUND')[:50] if row.get('review') else 'NOT FOUND'}")
    print(f"product_slug: {row.get('product_slug', 'NOT FOUND')}")

