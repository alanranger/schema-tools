#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Review Merger Script
Step 3b: Merge Trustpilot and Google reviews into a unified dataset

Combines reviews from both sources, filters low ratings, maps to products,
and outputs a clean CSV ready for schema generation.
"""

import os
import sys
import pandas as pd
from pathlib import Path
import re

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

try:
    from fuzzywuzzy import process, fuzz
except ImportError:
    print("⚠️ Warning: fuzzywuzzy not installed. Product matching will be disabled.")
    print("   Install with: pip install fuzzywuzzy python-Levenshtein")
    process = None

# File paths
workflow = Path("inputs-files/workflow")
trustpilot_path = workflow / "03a – trustpilot_historical_reviews.csv"
google_path = workflow / "03b – google_reviews.csv"
products_path = workflow / "02 – products_cleaned.xlsx"
output_path = workflow / "03 – combined_product_reviews.csv"

def clean_text(text):
    """Clean and normalize text"""
    if not isinstance(text, str):
        return ""
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def normalize_rating(rating):
    """Normalize rating to numeric value"""
    if pd.isna(rating):
        return None
    
    rating_str = str(rating).strip()
    
    # Handle numeric strings
    try:
        rating_num = float(rating_str)
        if 1 <= rating_num <= 5:
            return int(rating_num)
    except ValueError:
        pass
    
    # Handle star ratings (e.g., "5", "FIVE")
    if rating_str.upper() in ["FIVE", "5"]:
        return 5
    elif rating_str.upper() in ["FOUR", "4"]:
        return 4
    elif rating_str.upper() in ["THREE", "3"]:
        return 3
    elif rating_str.upper() in ["TWO", "2"]:
        return 2
    elif rating_str.upper() in ["ONE", "1"]:
        return 1
    
    return None

def read_reviews(path, source_name):
    """Read and normalize review CSV"""
    if not path.exists():
        print(f"⚠️ Missing file: {path.name}")
        return pd.DataFrame()
    
    try:
        df = pd.read_csv(path, encoding="utf-8-sig")
        
        # Normalize column names
        df.columns = [c.strip().lower().replace(' ', '_') for c in df.columns]
        
        # Ensure required columns exist
        required_cols = ['reviewer', 'rating', 'review', 'date', 'source', 'reference_id']
        existing_cols = df.columns.tolist()
        
        # Map common variations
        column_mapping = {
            'author': 'reviewer',
            'name': 'reviewer',
            'reviewer_name': 'reviewer',
            'comment': 'review',
            'text': 'review',
            'review_text': 'review',
            'star_rating': 'rating',
            'stars': 'rating',
            'review_date': 'date',
            'created_at': 'date',
            'source_type': 'source'
        }
        
        for old_col, new_col in column_mapping.items():
            if old_col in existing_cols and new_col not in existing_cols:
                df.rename(columns={old_col: new_col}, inplace=True)
        
        # Add missing columns
        for col in required_cols:
            if col not in df.columns:
                df[col] = ""
        
        # Set source
        df['source'] = source_name
        
        # Clean data
        df['review'] = df['review'].apply(clean_text)
        df['reviewer'] = df['reviewer'].astype(str).str.strip()
        
        # Normalize ratings
        df['rating'] = df['rating'].apply(normalize_rating)
        
        print(f"✅ Loaded {len(df)} reviews from {source_name}")
        return df
        
    except Exception as e:
        print(f"❌ Error reading {path.name}: {e}")
        import traceback
        traceback.print_exc()
        return pd.DataFrame()

def map_reference_ids(df, products_df):
    """Map reviews to products by matching keywords"""
    if process is None:
        print("⚠️ Fuzzy matching not available. Skipping product mapping.")
        return df
    
    print("🔗 Matching reviews to product names...")
    
    if products_df.empty or 'name' not in products_df.columns:
        print("⚠️ No products available for matching.")
        return df
    
    product_names = products_df['name'].dropna().astype(str).tolist()
    
    if not product_names:
        print("⚠️ No product names found.")
        return df
    
    matched_count = 0
    
    def find_product_match(review_text):
        if not isinstance(review_text, str) or len(review_text) < 10:
            return ""
        
        # Use fuzzy matching
        try:
            match, score = process.extractOne(review_text, product_names, scorer=fuzz.partial_ratio)
            if score >= 70:  # Lower threshold for partial matches
                return match
        except Exception as e:
            pass
        
        # Fallback: simple keyword matching
        review_lower = review_text.lower()
        for product_name in product_names:
            product_lower = product_name.lower()
            # Check if product name appears in review
            if product_lower in review_lower or any(word in review_lower for word in product_lower.split() if len(word) > 4):
                return product_name
        
        return ""
    
    # Apply matching
    df['reference_id'] = df['review'].apply(find_product_match)
    matched_count = df['reference_id'].astype(bool).sum()
    
    print(f"✅ Mapped {matched_count} reviews to products (out of {len(df)} total)")
    return df

def merge_reviews():
    """Main merge function"""
    print("="*60)
    print("REVIEW MERGER - Step 3b")
    print("="*60)
    print()
    
    # Read review files
    print("📥 Loading review sources...")
    tp_df = read_reviews(trustpilot_path, "Trustpilot")
    gg_df = read_reviews(google_path, "Google")
    
    if tp_df.empty and gg_df.empty:
        print("❌ No reviews found. Please ensure both review files exist.")
        sys.exit(1)
    
    total_tp = len(tp_df)
    total_gg = len(gg_df)
    print(f"📊 Loaded {total_tp} Trustpilot + {total_gg} Google reviews")
    print()
    
    # Combine datasets
    reviews = pd.concat([tp_df, gg_df], ignore_index=True)
    
    # Filter ratings < 4
    print("✨ Filtering reviews (keeping only ≥ 4★)...")
    initial_count = len(reviews)
    reviews = reviews[reviews['rating'] >= 4].copy()
    filtered_count = len(reviews)
    removed_count = initial_count - filtered_count
    
    print(f"✅ Filtered to {filtered_count} valid reviews (≥ 4★)")
    if removed_count > 0:
        print(f"   Removed {removed_count} reviews with rating < 4")
    print()
    
    # Load products for mapping
    products_df = pd.DataFrame()
    if products_path.exists():
        try:
            products_df = pd.read_excel(products_path, engine='openpyxl')
            print(f"📦 Loaded {len(products_df)} products for mapping")
        except Exception as e:
            print(f"⚠️ Could not load products file: {e}")
            print("   Continuing without product mapping...")
    else:
        print("⚠️ Products file not found. Continuing without product mapping...")
    
    # Map to products if reference_id is empty
    if not products_df.empty:
        reviews = map_reference_ids(reviews, products_df)
    else:
        # Ensure reference_id column exists
        if 'reference_id' not in reviews.columns:
            reviews['reference_id'] = ""
    
    # Add source_group column
    reviews['source_group'] = reviews['source']
    
    # Remove duplicates based on reviewer + review text
    print()
    print("🔍 Removing duplicate reviews...")
    before_dedup = len(reviews)
    reviews = reviews.drop_duplicates(subset=['reviewer', 'review'], keep='first')
    after_dedup = len(reviews)
    duplicates_removed = before_dedup - after_dedup
    
    if duplicates_removed > 0:
        print(f"✅ Removed {duplicates_removed} duplicate review(s)")
    else:
        print("✅ No duplicates found")
    print()
    
    # Sort by date (newest first)
    if 'date' in reviews.columns:
        reviews = reviews.sort_values(by='date', ascending=False, na_position='last')
        print("📅 Sorted reviews by date (newest first)")
    print()
    
    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Save merged dataset
    reviews.to_csv(output_path, index=False, encoding='utf-8-sig')
    
    print("="*60)
    print("✅ MERGE COMPLETE")
    print("="*60)
    print(f"📊 Total reviews: {len(reviews)}")
    print(f"   - Trustpilot: {len(reviews[reviews['source'] == 'Trustpilot'])}")
    print(f"   - Google: {len(reviews[reviews['source'] == 'Google'])}")
    print(f"📁 File saved: {output_path.name}")
    print(f"💡 Next step: Use this file in Step 4 - Generate Product Schema")
    print("="*60)

if __name__ == "__main__":
    try:
        merge_reviews()
    except KeyboardInterrupt:
        print("\n⚠️ Operation cancelled by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

