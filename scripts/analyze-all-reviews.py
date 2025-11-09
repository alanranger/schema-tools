#!/usr/bin/env python3
"""Comprehensive analysis of review sources and products"""

import pandas as pd
from pathlib import Path

base_path = Path("inputs-files/workflow")
trustpilot_path = base_path / "03a – trustpilot_historical_reviews.csv"
google_path = base_path / "03b – google_reviews.csv"
products_path = base_path / "02 – products_cleaned.xlsx"
combined_path = base_path / "03 – combined_product_reviews.csv"

print("="*80)
print("COMPREHENSIVE REVIEW ANALYSIS")
print("="*80)
print()

# Load Trustpilot
print("Loading Trustpilot reviews...")
tp = pd.read_csv(trustpilot_path, encoding="utf-8-sig")
print(f"Total Trustpilot reviews: {len(tp)}")
tp.columns = [c.strip().lower().replace(' ', '_') for c in tp.columns]
ref_col = [c for c in tp.columns if 'reference' in c and 'id' in c]
if ref_col:
    ref_col = ref_col[0]
    tp_with_ref = tp[tp[ref_col].notna() & (tp[ref_col] != '')]
    print(f"Trustpilot reviews with Reference Id: {len(tp_with_ref)}")
    print(f"Sample Reference Ids:")
    for ref_id in tp_with_ref[ref_col].unique()[:20]:
        print(f"  - {ref_id}")
print()

# Load Google
print("Loading Google reviews...")
google = pd.read_csv(google_path, encoding="utf-8-sig")
print(f"Total Google reviews: {len(google)}")
print(f"Google columns: {list(google.columns)}")
if 'comment' in google.columns:
    print(f"Google reviews with comment text: {google['comment'].notna().sum()}")
print()

# Load Products
print("Loading products...")
products = pd.read_excel(products_path, engine='openpyxl')
products = products[products['name'].notna() & (products['name'] != '')]
products['slug'] = products['url'].apply(lambda u: str(u).split('/')[-1].strip() if pd.notna(u) else '')
products = products[products['slug'] != '']
print(f"Products with names and slugs: {len(products)}")
print(f"Sample products:")
for idx, row in products.head(10).iterrows():
    print(f"  - {row['name']}")
    print(f"    Slug: {row['slug']}")
print()

# Load Combined
if combined_path.exists():
    print("Loading combined reviews...")
    combined = pd.read_csv(combined_path, encoding="utf-8-sig")
    print(f"Total in combined: {len(combined)}")
    print(f"Google in combined: {len(combined[combined['source'] == 'Google'])}")
    print(f"Trustpilot in combined: {len(combined[combined['source'] == 'Trustpilot'])}")
    print(f"Matched reviews: {len(combined[combined['product_slug'].notna() & (combined['product_slug'] != '')])}")
    print(f"Unmatched reviews: {len(combined[combined['product_slug'].isna() | (combined['product_slug'] == '')])}")
print()

print("="*80)
print("ANALYSIS COMPLETE")
print("="*80)

