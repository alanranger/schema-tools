#!/usr/bin/env python3
"""Check which Reference Ids are not matching"""

import pandas as pd
from pathlib import Path
import re

base_path = Path("inputs-files/workflow")
trustpilot_path = base_path / "03a – trustpilot_historical_reviews.csv"
combined_path = base_path / "03 – combined_product_reviews.csv"
products_path = base_path / "02 – products_cleaned.xlsx"

# Load products
products_df = pd.read_excel(products_path, engine='openpyxl')
products_df['product_slug'] = products_df['url'].apply(
    lambda u: str(u).split('/')[-1].strip() if pd.notna(u) else ''
)
name_by_slug = {row['product_slug']: str(row['name']) for _, row in products_df.iterrows() 
                if row['product_slug'] and pd.notna(row['name'])}

# Load Trustpilot reviews
trustpilot_df = pd.read_csv(trustpilot_path, encoding="utf-8-sig")
trustpilot_df.columns = [c.strip().lower().replace(' ', '_') for c in trustpilot_df.columns]

# Load combined reviews
combined_df = pd.read_csv(combined_path, encoding="utf-8-sig")

# Find Reference Id column
ref_col = None
for col in trustpilot_df.columns:
    if 'reference' in col and 'id' in col:
        ref_col = col
        break

if ref_col:
    # Get reviews with Reference Id
    tp_with_ref = trustpilot_df[trustpilot_df[ref_col].notna() & (trustpilot_df[ref_col] != '')].copy()
    
    # Check which ones don't have product_slug in combined file
    # Match by review content or other identifier
    unmatched_ref_ids = []
    
    for idx, row in tp_with_ref.iterrows():
        ref_id = str(row[ref_col]).strip()
        
        # Check if this Reference Id appears in combined file with a product_slug
        matching_reviews = combined_df[
            (combined_df['source'] == 'Trustpilot') & 
            (combined_df['product_slug'].notna()) & 
            (combined_df['product_slug'] != '')
        ]
        
        # Try to find if this Reference Id matches any product
        ref_id_lower = ref_id.lower().strip()
        ref_id_clean = re.sub(r'[^\w\s-]', '', ref_id_lower)
        ref_id_normalized = re.sub(r'\s+', ' ', ref_id_clean)
        
        matched = False
        for slug, name in name_by_slug.items():
            name_lower = str(name).lower().strip()
            name_normalized = re.sub(r'\s+', ' ', name_lower)
            
            # Check exact match
            if ref_id_normalized in name_normalized or name_normalized in ref_id_normalized:
                matched = True
                break
            
            # Check partial match (remove suffixes)
            ref_id_base = re.sub(r'\s*-\s*(monthly|2hrs?|weekly|daily|hourly|hrs?|hours?|days?|weeks?|months?|years?|\d+\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec).*|\d{1,2}\s*(st|nd|rd|th).*)$', '', ref_id_normalized, flags=re.IGNORECASE)
            ref_id_base = ref_id_base.strip()
            name_base = re.sub(r'\s*-\s*(monthly|2hrs?|weekly|daily|hourly|hrs?|hours?|days?|weeks?|months?|years?|\d+\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec).*|\d{1,2}\s*(st|nd|rd|th).*)$', '', name_normalized, flags=re.IGNORECASE)
            name_base = name_base.strip()
            
            if ref_id_base in name_base or name_base in ref_id_base:
                matched = True
                break
        
        if not matched:
            unmatched_ref_ids.append(ref_id)
    
    print("="*80)
    print("UNMATCHED REFERENCE IDS")
    print("="*80)
    print(f"Total unmatched Reference Ids: {len(unmatched_ref_ids)}")
    print()
    print("Sample unmatched Reference Ids:")
    for ref_id in unmatched_ref_ids[:30]:
        print(f"  - {ref_id}")
    print()


