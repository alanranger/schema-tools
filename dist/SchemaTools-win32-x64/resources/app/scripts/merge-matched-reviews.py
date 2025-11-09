#!/usr/bin/env python3
"""
Combined Review Merger
Merges Trustpilot and Google reviews using dedicated matchers
"""

import pandas as pd
from pathlib import Path
import sys

base_path = Path(__file__).parent.parent / "inputs-files" / "workflow"
trustpilot_matched_path = base_path / "03a_trustpilot_matched.csv"
google_matched_path = base_path / "03b_google_matched.csv"
output_path = base_path / "03 – combined_product_reviews.csv"

print("="*80)
print("COMBINED REVIEW MERGER")
print("="*80)
print()

# Load matched reviews
print("Loading matched reviews...")
trustpilot_df = pd.read_csv(trustpilot_matched_path, encoding="utf-8-sig")
google_df = pd.read_csv(google_matched_path, encoding="utf-8-sig")

print(f"Trustpilot matched: {len(trustpilot_df)}")
print(f"Google matched: {len(google_df)}")
print()

# Filter by rating (>=4 stars)
print("Filtering by rating (>=4 stars)...")
rating_cols = ['rating', 'ratingValue', 'stars']
tp_rating_col = None
google_rating_col = None

for col in rating_cols:
    if col in trustpilot_df.columns:
        tp_rating_col = col
        break
for col in rating_cols:
    if col in google_df.columns:
        google_rating_col = col
        break

if tp_rating_col:
    # Convert to numeric, handling strings
    trustpilot_df[tp_rating_col] = pd.to_numeric(trustpilot_df[tp_rating_col], errors='coerce')
    trustpilot_df = trustpilot_df[trustpilot_df[tp_rating_col] >= 4].copy()
    print(f"Trustpilot after rating filter: {len(trustpilot_df)}")
if google_rating_col:
    # Convert string ratings like "FIVE", "FOUR" to numbers
    def convert_rating(rating):
        if pd.isna(rating):
            return None
        rating_str = str(rating).upper().strip()
        rating_map = {'FIVE': 5, 'FOUR': 4, 'THREE': 3, 'TWO': 2, 'ONE': 1,
                     '5': 5, '4': 4, '3': 3, '2': 2, '1': 1}
        if rating_str in rating_map:
            return rating_map[rating_str]
        # Try numeric conversion
        try:
            return float(rating_str)
        except:
            return None
    
    google_df['rating_numeric'] = google_df[google_rating_col].apply(convert_rating)
    google_df = google_df[google_df['rating_numeric'] >= 4].copy()
    print(f"Google after rating filter: {len(google_df)}")
print()

# Standardize columns
print("Standardizing columns...")
# Ensure both have source column
trustpilot_df['source'] = 'Trustpilot'
google_df['source'] = 'Google'

# Standardize rating column to 'ratingValue' (numeric)
if 'rating' in trustpilot_df.columns:
    trustpilot_df['ratingValue'] = pd.to_numeric(trustpilot_df['rating'], errors='coerce')
elif 'ratingValue' not in trustpilot_df.columns:
    # Try other rating columns
    for col in ['review_stars', 'stars', 'ratingValue']:
        if col in trustpilot_df.columns:
            trustpilot_df['ratingValue'] = pd.to_numeric(trustpilot_df[col], errors='coerce')
            break

if 'rating' in google_df.columns or 'rating_numeric' in google_df.columns:
    # Use rating_numeric if available (already converted), otherwise convert rating
    if 'rating_numeric' in google_df.columns:
        google_df['ratingValue'] = google_df['rating_numeric']
    else:
        google_df['ratingValue'] = pd.to_numeric(google_df['rating'], errors='coerce')
elif 'ratingValue' not in google_df.columns:
    # Try other rating columns
    for col in ['review_stars', 'stars']:
        if col in google_df.columns:
            google_df['ratingValue'] = pd.to_numeric(google_df[col], errors='coerce')
            break

# Standardize review text column to 'reviewBody'
if 'review' in trustpilot_df.columns:
    trustpilot_df['reviewBody'] = trustpilot_df['review'].fillna('')
elif 'review_content' in trustpilot_df.columns:
    trustpilot_df['reviewBody'] = trustpilot_df['review_content'].fillna('')
elif 'reviewBody' not in trustpilot_df.columns:
    trustpilot_df['reviewBody'] = ''

if 'review' in google_df.columns:
    google_df['reviewBody'] = google_df['review'].fillna('')
elif 'comment' in google_df.columns:
    google_df['reviewBody'] = google_df['comment'].fillna('')
elif 'reviewBody' not in google_df.columns:
    google_df['reviewBody'] = ''

# Ensure date column exists
if 'date' not in trustpilot_df.columns:
    # Try to find date column
    for col in ['review_created_(utc)', 'date', 'created_at']:
        if col in trustpilot_df.columns:
            trustpilot_df['date'] = trustpilot_df[col]
            break
if 'date' not in google_df.columns:
    google_df['date'] = ''

print("Column standardization complete")
print()

# Deduplicate
print("Deduplicating reviews...")
seen = set()
final_reviews = []

def get_dedup_key(row):
    """Create deduplication key"""
    reviewer = str(row.get('reviewer', '') or row.get('author', '') or '').strip()
    date = str(row.get('date', '') or row.get('review_created_(utc)', '') or '').strip()
    review_text = str(row.get('review', '') or row.get('reviewBody', '') or row.get('comment', '') or '').strip()[:100]
    return (row.get('source', ''), reviewer, date, review_text)

for idx, row in trustpilot_df.iterrows():
    key = get_dedup_key(row)
    if key not in seen:
        seen.add(key)
        final_reviews.append(row.to_dict())

for idx, row in google_df.iterrows():
    key = get_dedup_key(row)
    if key not in seen:
        seen.add(key)
        final_reviews.append(row.to_dict())

print(f"After deduplication: {len(final_reviews)} reviews")
print()

# Sort by date
print("Sorting by date...")
final_df = pd.DataFrame(final_reviews)
if 'date' in final_df.columns:
    final_df['date'] = pd.to_datetime(final_df['date'], errors='coerce')
    final_df = final_df.sort_values('date', ascending=False, na_position='last')
print()

# Save
print(f"Saving to {output_path.name}...")
final_df.to_csv(output_path, index=False, encoding='utf-8-sig')
print(f"Saved {len(final_df)} reviews")
print()

# Statistics
print("="*80)
print("STATISTICS")
print("="*80)
print(f"Total reviews: {len(final_df)}")
print(f"Trustpilot: {len(final_df[final_df['source'] == 'Trustpilot'])}")
print(f"Google: {len(final_df[final_df['source'] == 'Google'])}")
print(f"Matched reviews: {len(final_df[final_df['product_slug'].notna() & (final_df['product_slug'] != '')])}")
print(f"Unmatched reviews: {len(final_df[final_df['product_slug'].isna() | (final_df['product_slug'] == '')])}")
print()

# Products with reviews
products_with_reviews = set(final_df[final_df['product_slug'].notna() & (final_df['product_slug'] != '')]['product_slug'].unique())
print(f"Products with reviews: {len(products_with_reviews)}")
print()

print("="*80)
print("MERGE COMPLETE")
print("="*80)

