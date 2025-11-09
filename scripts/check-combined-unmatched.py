#!/usr/bin/env python3
"""Check unmatched reviews in combined file"""

import pandas as pd
from pathlib import Path

base_path = Path("inputs-files/workflow")
combined_path = base_path / "03 – combined_product_reviews.csv"

combined_df = pd.read_csv(combined_path, encoding="utf-8-sig")

print("="*80)
print("UNMATCHED REVIEWS IN COMBINED FILE")
print("="*80)
print()

# Get reviews without product_slug
unmatched = combined_df[
    (combined_df['product_slug'].isna()) | 
    (combined_df['product_slug'] == '') |
    (combined_df['product_slug'].astype(str).str.strip() == '')
]

print(f"Total reviews: {len(combined_df)}")
print(f"Matched reviews: {len(combined_df[combined_df['product_slug'].notna() & (combined_df['product_slug'] != '')])}")
print(f"Unmatched reviews: {len(unmatched)}")
print()

if len(unmatched) > 0:
    print("Unmatched reviews:")
    print()
    
    # Group by source
    for source in unmatched['source'].unique():
        source_unmatched = unmatched[unmatched['source'] == source]
        print(f"{source} unmatched: {len(source_unmatched)}")
        
        # Show sample Reference Ids or review text
        if 'reference_id' in source_unmatched.columns:
            ref_ids = source_unmatched['reference_id'].dropna().unique()[:10]
            if len(ref_ids) > 0:
                print("  Sample Reference Ids:")
                for ref_id in ref_ids:
                    print(f"    - {ref_id}")
        elif 'product_name' in source_unmatched.columns:
            names = source_unmatched['product_name'].dropna().unique()[:10]
            if len(names) > 0:
                print("  Sample product names:")
                for name in names:
                    print(f"    - {name}")
        
        # Show sample review text
        if 'reviewbody' in source_unmatched.columns:
            samples = source_unmatched['reviewbody'].dropna().head(5)
            if len(samples) > 0:
                print("  Sample review text:")
                for idx, text in samples.items():
                    print(f"    - {str(text)[:80]}...")
        print()

