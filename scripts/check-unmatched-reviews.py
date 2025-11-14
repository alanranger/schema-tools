#!/usr/bin/env python3
"""Check unmatched reviews and products without reviews"""

import pandas as pd
from pathlib import Path

# Updated to use shared-resources structure
script_dir = Path(__file__).parent
project_root = script_dir.parent
shared_resources_dir = project_root.parent / 'alan-shared-resources'
csv_dir = shared_resources_dir / 'csv'
csv_processed_dir = shared_resources_dir / 'csv processed'

combined_path = csv_processed_dir / "03 – combined_product_reviews.csv"
trustpilot_path = csv_dir / "raw-03a-trustpilot-reviews-historical.csv"
products_path = csv_processed_dir / "02 – products_cleaned.xlsx"

print("="*80)
print("ANALYZING UNMATCHED REVIEWS")
print("="*80)
print()

# Load combined reviews
combined_df = pd.read_csv(combined_path, encoding="utf-8-sig")
print(f"Total reviews in combined file: {len(combined_df)}")
print(f"Google reviews: {len(combined_df[combined_df['source'] == 'Google'])}")
print(f"Trustpilot reviews: {len(combined_df[combined_df['source'] == 'Trustpilot'])}")
print(f"Reviews without product_slug: {len(combined_df[combined_df['product_slug'].isna() | (combined_df['product_slug'] == '')])}")
print()

# Load Trustpilot reviews to check Reference Ids
trustpilot_df = pd.read_csv(trustpilot_path, encoding="utf-8-sig")
trustpilot_df.columns = [c.strip().lower().replace(' ', '_') for c in trustpilot_df.columns]

# Find Reference Id column
ref_col = None
for col in trustpilot_df.columns:
    if 'reference' in col and 'id' in col:
        ref_col = col
        break

if ref_col:
    print(f"Found Reference Id column: {ref_col}")
    # Get reviews with Reference Id that might not be matching
    tp_with_ref = trustpilot_df[trustpilot_df[ref_col].notna() & (trustpilot_df[ref_col] != '')]
    print(f"Trustpilot reviews with Reference Id: {len(tp_with_ref)}")
    print()
    print("Sample Reference Ids that might not be matching:")
    print(tp_with_ref[ref_col].head(30).tolist())
    print()

# Load products
products_df = pd.read_excel(products_path, engine='openpyxl')
print(f"Total products: {len(products_df)}")

# Get products without reviews
products_with_reviews = set(combined_df['product_slug'].dropna().unique())
products_with_reviews = {s for s in products_with_reviews if s and s != ''}

products_df['product_slug'] = products_df['url'].apply(
    lambda u: str(u).split('/')[-1].strip() if pd.notna(u) else ''
)

products_without_reviews = []
for idx, row in products_df.iterrows():
    product_name = str(row.get('name', '')).strip()
    product_slug = str(row.get('product_slug', '')).strip()
    
    if not product_name or product_name == '':
        continue
    
    has_reviews = product_slug in products_with_reviews
    
    if not has_reviews:
        products_without_reviews.append({
            'name': product_name,
            'slug': product_slug
        })

print(f"Products without reviews: {len(products_without_reviews)}")
print()
print("Products without reviews:")
for p in products_without_reviews[:30]:
    print(f"  - {p['name']}")
    print(f"    Slug: {p['slug']}")
    print()


