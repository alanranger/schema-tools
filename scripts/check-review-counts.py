#!/usr/bin/env python3
"""Check review counts to understand the mismatch"""

import pandas as pd
from pathlib import Path

workflow_dir = Path(__file__).parent.parent / 'inputs-files' / 'workflow'

# Load merged reviews
merged_path = workflow_dir / '03 – combined_product_reviews.csv'
if merged_path.exists():
    merged_df = pd.read_csv(merged_path, encoding='utf-8-sig')
    print(f"Merged file: {len(merged_df)} reviews")
    google_total = len(merged_df[merged_df.get('source', '').str.contains('Google', case=False, na=False)])
    trustpilot_total = len(merged_df[merged_df.get('source', '').str.contains('Trustpilot', case=False, na=False)])
    print(f"  Google: {google_total}")
    print(f"  Trustpilot: {trustpilot_total}")
    print()

# Check Google reviews file
google_path = workflow_dir / '03b – google_reviews.csv'
if google_path.exists():
    google_df = pd.read_csv(google_path, encoding='utf-8-sig')
    google_df['date_parsed'] = pd.to_datetime(google_df['date'], errors='coerce')
    print(f"Google reviews file: {len(google_df)} reviews")
    
    # Check for future dates
    today = pd.Timestamp.today().normalize()
    future_reviews = google_df[google_df['date_parsed'].notna()].copy()
    future_reviews['date_normalized'] = pd.to_datetime(future_reviews['date_parsed']).dt.normalize()
    future_reviews = future_reviews[future_reviews['date_normalized'] > today]
    print(f"  Reviews with future dates: {len(future_reviews)}")
    if len(future_reviews) > 0:
        print("\n  Future dated reviews:")
        for idx, row in future_reviews.head(10).iterrows():
            print(f"    {row.get('reviewer', 'Unknown')}: {row.get('date', 'N/A')} - {str(row.get('review', ''))[:50]}...")
    
    # Check for macro/Kim reviews
    macro_reviews = google_df[
        google_df['review'].str.contains('macro', case=False, na=False) | 
        google_df['reviewer'].str.contains('kim', case=False, na=False)
    ]
    print(f"\n  Macro/Kim reviews: {len(macro_reviews)}")
    if len(macro_reviews) > 0:
        print("\n  Macro/Kim review details:")
        for idx, row in macro_reviews.head(10).iterrows():
            print(f"    {row.get('reviewer', 'Unknown')}: {row.get('date', 'N/A')} - {str(row.get('review', ''))[:80]}...")
    
    # Latest dates
    valid_dates = google_df[google_df['date_parsed'].notna()]
    if len(valid_dates) > 0:
        latest = valid_dates.nlargest(5, 'date_parsed')
        print(f"\n  Latest 5 Google review dates:")
        for idx, row in latest.iterrows():
            print(f"    {row.get('date_parsed')}: {row.get('reviewer', 'Unknown')} - {str(row.get('review', ''))[:60]}...")
    print()

# Check matched Google reviews
matched_google_path = workflow_dir / '03b_google_matched.csv'
if matched_google_path.exists():
    matched_df = pd.read_csv(matched_google_path, encoding='utf-8-sig')
    print(f"Matched Google reviews: {len(matched_df)}")
    macro_matched = matched_df[matched_df['product_slug'].str.contains('macro', case=False, na=False)]
    print(f"  Macro reviews matched: {len(macro_matched)}")
    if len(macro_matched) > 0:
        print(f"  Macro product slugs: {macro_matched['product_slug'].unique()}")
    print()

