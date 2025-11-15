#!/usr/bin/env python3
"""
Check Trustpilot review mappings to identify mismatches
"""

import pandas as pd
from pathlib import Path
import sys
import os

# Updated to use shared-resources structure
script_dir = Path(__file__).parent
project_root = script_dir.parent
shared_resources_dir = project_root.parent / 'alan-shared-resources'
csv_dir = shared_resources_dir / 'csv'
csv_processed_dir = shared_resources_dir / 'csv processed'

# Find Trustpilot reviews CSV
trustpilot_path = None
if csv_dir.exists():
    for csv_file in csv_dir.glob('*trustpilot*.csv'):
        if 'raw-03a' in csv_file.name.lower() or 'trustpilot' in csv_file.name.lower():
            trustpilot_path = csv_file
            break

if not trustpilot_path or not trustpilot_path.exists():
    print("Error: Trustpilot reviews CSV not found")
    print(f"   Expected: {csv_dir.absolute()}/raw-03a-trustpilot-reviews-historical.csv")
    sys.exit(1)

combined_path = csv_processed_dir / "03 – combined_product_reviews.csv"
products_path = csv_processed_dir / "02 – products_cleaned.xlsx"

print("="*80)
print("TRUSTPILOT REVIEW MAPPING ANALYSIS")
print("="*80)
print()

# Load Trustpilot reviews
print("Loading Trustpilot reviews...")
trustpilot_df = pd.read_csv(trustpilot_path, encoding="utf-8-sig")
print(f"Loaded {len(trustpilot_df)} Trustpilot reviews")

# Normalize column names
trustpilot_df.columns = [c.strip().lower().replace(' ', '_') for c in trustpilot_df.columns]

# Load combined reviews
print("Loading combined reviews...")
combined_df = pd.read_csv(combined_path, encoding="utf-8-sig")
print(f"Loaded {len(combined_df)} combined reviews")

# Filter Trustpilot reviews from combined
trustpilot_combined = combined_df[combined_df['source'].str.lower() == 'trustpilot'].copy()
print(f"Found {len(trustpilot_combined)} Trustpilot reviews in combined file")
print()

# Load products to check which ones don't have reviews
print("Loading products...")
products_df = pd.read_excel(products_path, engine='openpyxl')
print(f"Loaded {len(products_df)} products")
print()

# Create a mapping from Review Id to product info
print("Analyzing mappings...")
print()

# Get Reference Id column name (normalized)
ref_id_col = None
for col in trustpilot_df.columns:
    if 'reference' in col.lower() and 'id' in col.lower():
        ref_id_col = col
        break

if not ref_id_col:
    print("ERROR: Could not find Reference Id column in Trustpilot file")
    sys.exit(1)

print(f"Using Reference Id column: '{ref_id_col}'")
print()

# Get Review Id column
review_id_col = None
for col in trustpilot_df.columns:
    if 'review_id' in col.lower() and 'id' in col.lower():
        review_id_col = col
        break

if not review_id_col:
    print("ERROR: Could not find Review Id column")
    sys.exit(1)

# Create mapping from Review Id to Reference Id in Trustpilot file
trustpilot_mapping = {}
for idx, row in trustpilot_df.iterrows():
    review_id = str(row.get(review_id_col, '')).strip()
    ref_id = str(row.get(ref_id_col, '')).strip()
    if review_id and ref_id:
        trustpilot_mapping[review_id] = ref_id

print(f"Created mapping for {len(trustpilot_mapping)} Trustpilot reviews")
print()

# Check combined file for Review Id column
combined_review_id_col = None
for col in combined_df.columns:
    if 'review_id' in col.lower() or 'reviewid' in col.lower():
        combined_review_id_col = col
        break

if not combined_review_id_col:
    # Try to find it by checking first few rows
    print("WARNING: Could not find Review Id column in combined file, checking structure...")
    print(f"   Columns: {list(combined_df.columns[:10])}")
    # Use index or another identifier
    combined_review_id_col = None

# Find mismatches
mismatches = []
urban_architecture_mismatches = []

print("Checking for mismatches...")
print()

# Check each Trustpilot review in combined file
for idx, row in trustpilot_combined.iterrows():
    # Try to find Review Id
    review_id = None
    if combined_review_id_col:
        review_id = str(row.get(combined_review_id_col, '')).strip()
    
    # If no Review Id column, try to match by other fields
    if not review_id or review_id == 'nan':
        # Try to match by author and date
        author = str(row.get('author', '') or row.get('reviewer_name', '')).strip()
        date = str(row.get('date', '') or row.get('review_created_(utc)', '')).strip()
        
        # Find matching Trustpilot review
        matching_tp = trustpilot_df[
            (trustpilot_df['author'].str.contains(author, case=False, na=False) if 'author' in trustpilot_df.columns else False) |
            (trustpilot_df['reviewer_name'].str.contains(author, case=False, na=False) if 'reviewer_name' in trustpilot_df.columns else False)
        ]
        
        if len(matching_tp) > 0:
            review_id = str(matching_tp.iloc[0].get(review_id_col, '')).strip()
    
    if review_id and review_id in trustpilot_mapping:
        original_ref_id = trustpilot_mapping[review_id]
        combined_product = str(row.get('product_name', '') or row.get('name', '')).strip()
        combined_slug = str(row.get('product_slug', '')).strip()
        
        # Check if they match
        original_ref_lower = original_ref_id.lower()
        combined_product_lower = combined_product.lower()
        
        # Check for Urban Architecture specifically
        if 'urban' in original_ref_lower and 'architecture' in original_ref_lower:
            if 'batsford' in combined_product_lower or 'arboretum' in combined_product_lower:
                urban_architecture_mismatches.append({
                    'review_id': review_id,
                    'original_ref_id': original_ref_id,
                    'combined_product': combined_product,
                    'combined_slug': combined_slug,
                    'author': str(row.get('author', '') or row.get('reviewer_name', '')),
                    'review_title': str(row.get('review_title', '') or row.get('title', ''))
                })
        
        # General mismatch check
        if original_ref_lower not in combined_product_lower and combined_product_lower not in original_ref_lower:
            # Check if slug matches
            original_slug = original_ref_id.lower().replace(' ', '-').replace('_', '-')
            if original_slug not in combined_slug.lower():
                mismatches.append({
                    'review_id': review_id,
                    'original_ref_id': original_ref_id,
                    'combined_product': combined_product,
                    'combined_slug': combined_slug,
                    'author': str(row.get('author', '') or row.get('reviewer_name', ''))
                })

print("="*80)
print("MISMATCH ANALYSIS RESULTS")
print("="*80)
print()

if urban_architecture_mismatches:
    print(f"ERROR: Found {len(urban_architecture_mismatches)} Urban Architecture reviews mapped to Batsford Arboretum:")
    print()
    for m in urban_architecture_mismatches:
        print(f"  Review ID: {m['review_id']}")
        print(f"  Original (Trustpilot): {m['original_ref_id']}")
        print(f"  Mapped to (Combined): {m['combined_product']}")
        print(f"  Slug: {m['combined_slug']}")
        print(f"  Author: {m['author']}")
        print(f"  Title: {m['review_title']}")
        print()
else:
    print("OK: No Urban Architecture -> Batsford Arboretum mismatches found")
    print()

if mismatches:
    print(f"WARNING: Found {len(mismatches)} total mismatches:")
    print()
    for m in mismatches[:20]:  # Show first 20
        print(f"  Review ID: {m['review_id']}")
        print(f"  Original: {m['original_ref_id']}")
        print(f"  Mapped to: {m['combined_product']}")
        print()
    
    if len(mismatches) > 20:
        print(f"  ... and {len(mismatches) - 20} more")
        print()
else:
    print("OK: No general mismatches found")
    print()

# Find products without reviews
print("="*80)
print("PRODUCTS WITHOUT REVIEWS")
print("="*80)
print()

# Get all product slugs from combined reviews
products_with_reviews = set(combined_df['product_slug'].dropna().unique())
products_with_reviews = {s for s in products_with_reviews if s}

# Get product slugs from products file
products_df['product_slug'] = products_df['url'].apply(
    lambda u: str(u).split('/')[-1].strip() if pd.notna(u) else ''
)
products_df['product_slug'] = products_df['product_slug'].apply(
    lambda s: s.lower().replace(' ', '-').replace('_', '-') if s else ''
)

products_without_reviews = []
for idx, row in products_df.iterrows():
    product_name = str(row.get('name', '')).strip()
    product_slug = str(row.get('product_slug', '')).strip()
    
    # Check if this product has any reviews
    has_reviews = False
    for slug in products_with_reviews:
        if slug in product_slug or product_slug in slug:
            has_reviews = True
            break
    
    # Also check by name
    if not has_reviews:
        matching_reviews = combined_df[
            combined_df['product_name'].str.contains(product_name[:20], case=False, na=False) 
            if 'product_name' in combined_df.columns else False
        ]
        if len(matching_reviews) > 0:
            has_reviews = True
    
    if not has_reviews:
        products_without_reviews.append({
            'name': product_name,
            'slug': product_slug,
            'url': str(row.get('url', ''))
        })

print(f"Total products: {len(products_df)}")
print(f"Products with reviews: {len(products_df) - len(products_without_reviews)}")
print(f"Products without reviews: {len(products_without_reviews)}")
print()

if products_without_reviews:
    print("Products without reviews:")
    print()
    for p in products_without_reviews:
        print(f"  - {p['name']}")
        print(f"    Slug: {p['slug']}")
        print(f"    URL: {p['url']}")
        print()
else:
    print("OK: All products have reviews!")
    print()

print("="*80)
print("ANALYSIS COMPLETE")
print("="*80)

