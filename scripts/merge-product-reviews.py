#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Product Reviews Merge Script
Stage 2: Merge cleaned products with review data

Reads:
  - inputs-files/workflow/02 – products_cleaned.xlsx (from Step 1)
  - inputs-files/combined product_reviews.csv
  - inputs-files/event_mappings_with_reviewer.csv

Outputs:
  - inputs-files/workflow/products_with_review_data_final.xlsx
"""

import pandas as pd
import json
from pathlib import Path
import sys
import os
from datetime import datetime

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

def normalize_string(s):
    """Normalize strings for matching (lowercase, strip whitespace)"""
    if pd.isna(s) or not s:
        return ''
    return str(s).strip().lower()

def fuzzy_match_name(product_name, event_name):
    """Fuzzy match product name with event name"""
    product_norm = normalize_string(product_name)
    event_norm = normalize_string(event_name)
    
    # Exact match
    if product_norm == event_norm:
        return True
    
    # Check if product name contains event name or vice versa
    if event_norm in product_norm or product_norm in event_norm:
        return True
    
    # Check if key words match (e.g., "Lightroom Course" matches "Lightroom Courses for Beginners")
    product_words = set(product_norm.split())
    event_words = set(event_norm.split())
    
    # If at least 2 significant words match, consider it a match
    common_words = {'the', 'a', 'an', 'and', 'or', 'for', 'with', 'to', 'of', 'in', 'on', 'at'}
    product_words = {w for w in product_words if w not in common_words and len(w) > 3}
    event_words = {w for w in event_words if w not in common_words and len(w) > 3}
    
    if len(product_words) >= 2 and len(event_words) >= 2:
        matches = product_words.intersection(event_words)
        if len(matches) >= 2:
            return True
    
    return False

def load_event_mappings(mapping_file):
    """Load event mappings and create lookup dictionaries"""
    try:
        df_mappings = pd.read_csv(mapping_file, encoding='utf-8')
        # Create mapping from event name to reviewer
        event_to_reviewer = {}
        if 'Original Event' in df_mappings.columns and 'Reviewer' in df_mappings.columns:
            for _, row in df_mappings.iterrows():
                event = normalize_string(row.get('Original Event', ''))
                reviewer = str(row.get('Reviewer', '')).strip()
                if event and reviewer:
                    event_to_reviewer[event] = reviewer
        return event_to_reviewer
    except Exception as e:
        print(f"⚠️  Warning: Could not load event mappings: {e}")
        return {}

def filter_reviews_by_rating(reviews_df, min_rating=4):
    """Filter reviews to only include ratings >= min_rating"""
    reviews_df = reviews_df.copy()
    reviews_df['rating'] = pd.to_numeric(reviews_df['rating'], errors='coerce')
    return reviews_df[reviews_df['rating'] >= min_rating].copy()

def format_reviews_for_product(reviews_list):
    """Format reviews list as JSON string for Excel storage"""
    if not reviews_list:
        return '[]'
    try:
        return json.dumps(reviews_list, ensure_ascii=False)
    except Exception as e:
        print(f"⚠️  Warning: Error formatting reviews: {e}")
        return '[]'

def main():
    workflow_dir = Path('inputs-files/workflow')
    inputs_dir = Path('inputs-files')
    
    # Find cleaned products file
    cleaned_files = list(workflow_dir.glob('02*.xlsx'))
    if not cleaned_files:
        print("❌ Error: No cleaned products file found")
        print(f"   Expected: {workflow_dir.absolute()}/02 – products_cleaned.xlsx")
        print(f"   Please run Step 1 first (clean-products-csv.py)")
        sys.exit(1)
    
    cleaned_file = sorted(cleaned_files)[-1]
    print(f"📂 Reading cleaned products: {cleaned_file.name}")
    
    # Load cleaned products
    try:
        products_df = pd.read_excel(cleaned_file, engine='openpyxl')
    except Exception as e:
        print(f"❌ Error reading cleaned products file: {e}")
        sys.exit(1)
    
    print(f"✅ Loaded {len(products_df)} products")
    
    # Load reviews
    reviews_file = inputs_dir / 'combined product_reviews.csv'
    if not reviews_file.exists():
        print(f"❌ Error: Reviews file not found: {reviews_file}")
        sys.exit(1)
    
    print(f"📂 Reading reviews: {reviews_file.name}")
    try:
        reviews_df = pd.read_csv(reviews_file, encoding='utf-8')
    except Exception as e:
        print(f"❌ Error reading reviews file: {e}")
        sys.exit(1)
    
    print(f"✅ Loaded {len(reviews_df)} total reviews")
    
    # Filter reviews >= 4★
    reviews_df = filter_reviews_by_rating(reviews_df, min_rating=4)
    print(f"✅ Filtered to {len(reviews_df)} reviews with rating >= 4★")
    
    # Load event mappings
    mappings_file = inputs_dir / 'event_mappings_with_reviewer.csv'
    event_to_reviewer = {}
    if mappings_file.exists():
        print(f"📂 Reading event mappings: {mappings_file.name}")
        event_to_reviewer = load_event_mappings(mappings_file)
        print(f"✅ Loaded {len(event_to_reviewer)} event mappings")
    
    # Merge reviews with products
    merged_data = []
    
    for idx, product in products_df.iterrows():
        product_name = str(product.get('name', '')).strip()
        if not product_name:
            continue
        
        # Find matching reviews
        matching_reviews = []
        
        # Try to match by event name (from reviews)
        for _, review in reviews_df.iterrows():
            event_name = str(review.get('event', '')).strip()
            reviewer = str(review.get('reviewer', '')).strip()
            body = str(review.get('body', '')).strip()
            rating = review.get('rating', 0)
            date = review.get('date', '')
            source = str(review.get('source', '')).strip()
            
            # Match product name with event name
            if fuzzy_match_name(product_name, event_name):
                matching_reviews.append({
                    'author': reviewer or 'Anonymous',
                    'rating': int(rating),
                    'body': body,
                    'date': date if pd.notna(date) else '',
                    'source': source
                })
        
        # Calculate review stats
        review_count = len(matching_reviews)
        average_rating = None
        if review_count > 0:
            average_rating = sum(r['rating'] for r in matching_reviews) / review_count
            average_rating = round(average_rating, 1)
        
        # Format reviews as JSON
        reviews_json = format_reviews_for_product(matching_reviews)
        
        # Create merged row
        merged_row = {
            'name': product_name,
            'description': str(product.get('description', '')).strip(),
            'image': str(product.get('image', '')).strip(),
            'url': str(product.get('url', '')).strip(),
            'price': product.get('price', None),
            'category': str(product.get('category', '')).strip(),
            'review_count': review_count,
            'average_rating': average_rating,
            'reviews': reviews_json
        }
        
        merged_data.append(merged_row)
    
    merged_df = pd.DataFrame(merged_data)
    
    # Generate output filename with version tag
    date_tag = datetime.now().strftime('%Y%m%d')
    output_file = workflow_dir / f'products_with_review_data_final_v{date_tag}.xlsx'
    
    # Also create a non-versioned file for easy access
    output_file_main = workflow_dir / 'products_with_review_data_final.xlsx'
    
    try:
        merged_df.to_excel(output_file, index=False, engine='openpyxl')
        merged_df.to_excel(output_file_main, index=False, engine='openpyxl')
        print(f"✅ Saved: {output_file.name}")
        print(f"✅ Saved: {output_file_main.name}")
    except Exception as e:
        print(f"❌ Error saving Excel file: {e}")
        sys.exit(1)
    
    # Summary
    print("\n" + "="*60)
    print("📊 MERGE SUMMARY")
    print("="*60)
    print(f"Total products: {len(merged_df)}")
    products_with_reviews = len(merged_df[merged_df['review_count'] > 0])
    print(f"Products with reviews (4★+): {products_with_reviews}")
    print(f"Products without reviews: {len(merged_df) - products_with_reviews}")
    print(f"Total reviews matched: {merged_df['review_count'].sum()}")
    
    if products_with_reviews > 0:
        avg_rating_all = merged_df[merged_df['average_rating'].notna()]['average_rating'].mean()
        print(f"Average rating (products with reviews): {avg_rating_all:.2f}")
    
    print("\n📋 Sample products with reviews:")
    print("-"*60)
    sample_with_reviews = merged_df[merged_df['review_count'] > 0].head(3)
    for idx, row in sample_with_reviews.iterrows():
        print(f"\n{row['name']}:")
        print(f"  Reviews: {row['review_count']}, Rating: {row['average_rating']}")
        print(f"  URL: {row['url']}")
    
    print("="*60)
    print(f"\n✅ Success! Merged file saved to: {output_file.absolute()}")

if __name__ == '__main__':
    main()

