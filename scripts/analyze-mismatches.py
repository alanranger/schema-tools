#!/usr/bin/env python3
"""
Detailed mismatch analysis to identify patterns
"""

import pandas as pd
from pathlib import Path

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
    import sys
    sys.exit(1)

combined_path = csv_processed_dir / "03 – combined_product_reviews.csv"
products_path = csv_processed_dir / "02 – products_cleaned.xlsx"

# Load data
trustpilot_df = pd.read_csv(trustpilot_path, encoding="utf-8-sig")
trustpilot_df.columns = [c.strip().lower().replace(' ', '_') for c in trustpilot_df.columns]

combined_df = pd.read_csv(combined_path, encoding="utf-8-sig")
trustpilot_combined = combined_df[combined_df['source'].str.lower() == 'trustpilot'].copy()

products_df = pd.read_excel(products_path, engine='openpyxl')

# Get Reference Id and Review Id columns
ref_id_col = None
review_id_col = None
for col in trustpilot_df.columns:
    if 'reference' in col.lower() and 'id' in col.lower():
        ref_id_col = col
    if 'review_id' in col.lower() and 'id' in col.lower():
        review_id_col = col

# Create mapping
trustpilot_mapping = {}
for idx, row in trustpilot_df.iterrows():
    review_id = str(row.get(review_id_col, '')).strip()
    ref_id = str(row.get(ref_id_col, '')).strip()
    if review_id and ref_id:
        trustpilot_mapping[review_id] = ref_id

# Find mismatches
mismatches = []
for idx, row in trustpilot_combined.iterrows():
    # Try to find Review Id
    review_id = None
    for col in combined_df.columns:
        if 'review_id' in col.lower() or 'reviewid' in col.lower():
            review_id = str(row.get(col, '')).strip()
            if review_id and review_id != 'nan':
                break
    
    if review_id and review_id in trustpilot_mapping:
        original_ref_id = trustpilot_mapping[review_id]
        combined_product = str(row.get('product_name', '') or row.get('name', '')).strip()
        combined_slug = str(row.get('product_slug', '')).strip()
        
        original_ref_lower = original_ref_id.lower()
        combined_product_lower = combined_product.lower()
        
        # Check if they match
        if original_ref_lower not in combined_product_lower and combined_product_lower not in original_ref_lower:
            # Check if slug matches
            original_slug = original_ref_id.lower().replace(' ', '-').replace('_', '-')
            if original_slug not in combined_slug.lower():
                mismatches.append({
                    'review_id': review_id,
                    'original_ref_id': original_ref_id,
                    'combined_product': combined_product,
                    'combined_slug': combined_slug,
                    'author': str(row.get('author', '') or row.get('reviewer_name', '')),
                    'review_title': str(row.get('review_title', '') or row.get('title', ''))
                })

print("="*80)
print("DETAILED MISMATCH ANALYSIS")
print("="*80)
print()

# Group by type
location_mismatches = []
product_type_mismatches = []
naming_variation_mismatches = []
completely_wrong = []

for m in mismatches:
    orig = m['original_ref_id'].lower()
    mapped = m['combined_product'].lower()
    
    # Extract locations
    locations = ['glencoe', 'anglesey', 'gower', 'yorkshire', 'dales', 'devon', 'peak', 'district', 
                'lake', 'batsford', 'arboretum', 'urban', 'architecture', 'coventry', 'kenilworth',
                'ireland', 'kerry', 'dartmoor', 'norfolk', 'suffolk', 'northumberland', 'wales']
    
    orig_locations = [loc for loc in locations if loc in orig]
    mapped_locations = [loc for loc in locations if loc in mapped]
    
    # Check for location mismatch
    if orig_locations and mapped_locations and set(orig_locations) != set(mapped_locations):
        location_mismatches.append(m)
    # Check for product type mismatch (framed vs unframed, beginners course vs lightroom)
    elif ('framed' in orig and 'unframed' in mapped) or ('unframed' in orig and 'framed' in mapped):
        product_type_mismatches.append(m)
    elif ('beginners photography course' in orig and 'lightroom' in mapped) or ('beginners photography classes' in orig and 'lightroom' in mapped):
        product_type_mismatches.append(m)
    # Check for naming variations (same product, different name)
    elif ('fireworks photo workshop' in orig and 'fireworks photography workshop' in mapped):
        naming_variation_mismatches.append(m)
    elif ('quarterly pick n mix' in orig and 'quarterly pick n mix subscription' in mapped):
        naming_variation_mismatches.append(m)
    elif ('premium photography academy' in orig and 'premium photography academy membership' in mapped):
        naming_variation_mismatches.append(m)
    # Completely wrong matches
    else:
        completely_wrong.append(m)

print(f"Location Mismatches ({len(location_mismatches)}):")
for m in location_mismatches:
    print(f"  {m['original_ref_id']} -> {m['combined_product']}")
print()

print(f"Product Type Mismatches ({len(product_type_mismatches)}):")
for m in product_type_mismatches:
    print(f"  {m['original_ref_id']} -> {m['combined_product']}")
print()

print(f"Naming Variations (acceptable) ({len(naming_variation_mismatches)}):")
for m in naming_variation_mismatches:
    print(f"  {m['original_ref_id']} -> {m['combined_product']}")
print()

print(f"Completely Wrong Matches ({len(completely_wrong)}):")
for m in completely_wrong:
    print(f"  {m['original_ref_id']} -> {m['combined_product']}")
    print(f"    Review: {m['review_title']}")
print()


