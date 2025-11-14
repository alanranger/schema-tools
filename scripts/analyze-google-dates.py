#!/usr/bin/env python3
"""Analyze Google reviews and products for date-based matching"""

import pandas as pd
from pathlib import Path
from datetime import datetime

base_path = Path("inputs-files/workflow")
google_path = base_path / "03b – google_reviews.csv"
products_path = base_path / "02 – products_cleaned.xlsx"
combined_path = base_path / "03 – combined_product_reviews.csv"

print("="*80)
print("GOOGLE REVIEWS DATE ANALYSIS")
print("="*80)
print()

# Load Google reviews
google = pd.read_csv(google_path, encoding="utf-8-sig")
print(f"Total Google reviews: {len(google)}")
print(f"Columns: {list(google.columns)}")
print()

# Check date column
if 'date' in google.columns:
    google['date_parsed'] = pd.to_datetime(google['date'], errors='coerce')
    print(f"Reviews with valid dates: {google['date_parsed'].notna().sum()}")
    print(f"Date range: {google['date_parsed'].min()} to {google['date_parsed'].max()}")
    print()
    
    # Group by date to see clusters
    google['date_only'] = google['date_parsed'].dt.date
    date_counts = google.groupby('date_only').size().sort_values(ascending=False)
    print("Top 20 dates with most reviews:")
    for date, count in date_counts.head(20).items():
        print(f"  {date}: {count} reviews")
    print()

# Load products to check event dates
products = pd.read_excel(products_path, engine='openpyxl')
print(f"Total products: {len(products)}")
print()

# Check if products have date columns
print("Product columns:")
print(list(products.columns))
print()

# Sample Google reviews with dates
print("Sample Google reviews with dates:")
for idx, row in google.head(10).iterrows():
    date = row.get('date', 'N/A')
    review = str(row.get('review', '') or row.get('comment', ''))[:80]
    print(f"  {date}: {review}...")
print()

# Check current matching
if combined_path.exists():
    combined = pd.read_csv(combined_path, encoding="utf-8-sig")
    google_matched = combined[combined['source'] == 'Google']
    print(f"Currently matched Google reviews: {len(google_matched)}")
    print(f"Unmatched Google reviews: {len(google) - len(google_matched)}")
    print()

