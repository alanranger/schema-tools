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
from difflib import SequenceMatcher

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# ============================================================
# Utility Functions
# ============================================================

def slugify(text):
    """Standard slug generator for consistency between products and reviews."""
    if pd.isna(text) or not text:
        return ''
    return re.sub(r'[^a-z0-9]+', '-', str(text).lower().strip()).strip('-')

def find_best_slug_match(review_text, product_slugs):
    """Return the best fuzzy match for a review's related product text."""
    best_match = None
    best_ratio = 0.0
    for ps in product_slugs:
        ratio = SequenceMatcher(None, review_text, ps).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = ps
    return best_match if best_ratio > 0.74 else None  # threshold adjustable

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

def clean_text(text):
    """Clean and normalize text"""
    if not isinstance(text, str):
        return ""
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

# ============================================================
# Paths and Inputs
# ============================================================

base_path = Path("inputs-files/workflow")
products_path = base_path / "02 – products_cleaned.xlsx"
trustpilot_path = base_path / "03a – trustpilot_historical_reviews.csv"
google_path = base_path / "03b – google_reviews.csv"
output_path = base_path / "03 – combined_product_reviews.csv"

print("="*60)
print("REVIEW MERGER - Step 3b")
print("="*60)
print()

# Load product list to help map reviews
print("📦 Loading products for mapping...")
try:
    products_df = pd.read_excel(products_path, engine='openpyxl')
    # Create slugs from URLs (matching generate-product-schema.py)
    products_df["product_slug"] = products_df["url"].apply(lambda u: slugify(str(u).split("/")[-1]) if pd.notna(u) else '')
    # Fill missing slugs with name-based slugs
    missing_slugs = products_df['product_slug'].isna() | (products_df['product_slug'] == '')
    products_df.loc[missing_slugs, 'product_slug'] = products_df.loc[missing_slugs, 'name'].fillna('').apply(slugify)
    product_slugs = products_df["product_slug"].dropna().tolist()
    print(f"✅ Loaded {len(products_df)} products for mapping")
except Exception as e:
    print(f"⚠️ Could not load products file: {e}")
    products_df = pd.DataFrame()
    product_slugs = []

# ============================================================
# Load Review Sources
# ============================================================

print()
print("📥 Loading review sources...")

trustpilot_df = pd.DataFrame()
google_df = pd.DataFrame()

if trustpilot_path.exists():
    try:
        trustpilot_df = pd.read_csv(trustpilot_path, encoding="utf-8-sig")
        trustpilot_df.columns = [c.strip().lower().replace(' ', '_') for c in trustpilot_df.columns]
        print(f"✅ Loaded {len(trustpilot_df)} Trustpilot reviews")
    except Exception as e:
        print(f"⚠️ Error loading Trustpilot reviews: {e}")
else:
    print(f"⚠️ Missing file: {trustpilot_path.name}")

if google_path.exists():
    try:
        google_df = pd.read_csv(google_path, encoding="utf-8-sig")
        google_df.columns = [c.strip().lower().replace(' ', '_') for c in google_df.columns]
        print(f"✅ Loaded {len(google_df)} Google reviews")
    except Exception as e:
        print(f"⚠️ Error loading Google reviews: {e}")
else:
    print(f"⚠️ Missing file: {google_path.name}")

if trustpilot_df.empty and google_df.empty:
    print("❌ No reviews found. Please ensure both review files exist.")
    sys.exit(1)

# Normalize columns and clean review data
def clean_reviews(df, source):
    """Clean and normalize review dataframe"""
    df = df.copy()
    df["source"] = source
    
    # Normalize rating column
    rating_col = None
    for col in ['ratingvalue', 'rating', 'stars', 'review_stars', 'star_rating']:
        if col in df.columns:
            rating_col = col
            break
    
    if rating_col:
        df['ratingValue'] = df[rating_col].apply(normalize_rating)
    else:
        df['ratingValue'] = None
    
    # Normalize review body column
    review_col = None
    for col in ['reviewbody', 'review_body', 'review', 'review_text', 'content', 'comment', 'text']:
        if col in df.columns:
            review_col = col
            break
    
    if review_col:
        df['reviewBody'] = df[review_col].apply(clean_text)
    else:
        df['reviewBody'] = ''
    
    # Normalize author/reviewer column
    author_col = None
    for col in ['author', 'reviewer', 'reviewer_name', 'name', 'review_username']:
        if col in df.columns:
            author_col = col
            break
    
    if author_col:
        df['author'] = df[author_col].fillna('').astype(str).str.strip()
    else:
        df['author'] = 'Anonymous'
    
    # Normalize date column
    date_col = None
    for col in ['date', 'review_created_utc', 'review_created_(utc)', 'created_at', 'review_date']:
        if col in df.columns:
            date_col = col
            break
    
    if date_col:
        df['date'] = df[date_col]
    else:
        df['date'] = ''
    
    return df

trustpilot_df = clean_reviews(trustpilot_df, "Trustpilot")
google_df = clean_reviews(google_df, "Google")

# Combine
reviews_df = pd.concat([trustpilot_df, google_df], ignore_index=True)
print(f"📊 Loaded {len(reviews_df)} total reviews ({len(trustpilot_df)} Trustpilot + {len(google_df)} Google)")
print()

# ============================================================
# Filter reviews (≥4★)
# ============================================================

print("✨ Filtering reviews (keeping only ≥ 4★)...")
initial_count = len(reviews_df)
valid_reviews = reviews_df[reviews_df['ratingValue'] >= 4].copy()
filtered_count = len(valid_reviews)
removed_count = initial_count - filtered_count

print(f"✅ Filtered to {filtered_count} valid reviews (≥ 4★)")
if removed_count > 0:
    print(f"   Removed {removed_count} reviews with rating < 4")
print()

# ============================================================
# Match Reviews to Products
# ============================================================

if len(product_slugs) > 0:
    print("🔗 Matching reviews to product slugs...")
    
    # Try to get product_name from reference_id or other columns
    if 'reference_id' in valid_reviews.columns:
        valid_reviews["product_name"] = valid_reviews["reference_id"].fillna('')
    elif 'product_name' in valid_reviews.columns:
        pass  # Already exists
    else:
        valid_reviews["product_name"] = ''
    
    # Create slugs from product names
    valid_reviews["product_slug"] = valid_reviews["product_name"].fillna('').apply(slugify)
    
    # Check for exact matches
    review_slugs_set = set(valid_reviews["product_slug"].dropna())
    review_slugs_set = {s for s in review_slugs_set if s}  # Remove empty strings
    exact_matches = review_slugs_set & set(product_slugs)
    
    if len(exact_matches) == 0:
        print("⚠️ No exact matches found. Trying fuzzy mapping...")
        corrected = {}
        for rslug in review_slugs_set:
            if rslug:  # Skip empty slugs
                best = find_best_slug_match(rslug, product_slugs)
                if best:
                    corrected[rslug] = best
        
        if len(corrected) > 0:
            valid_reviews["matched_slug"] = valid_reviews["product_slug"].map(corrected)
            valid_reviews["product_slug"] = valid_reviews["matched_slug"].fillna(valid_reviews["product_slug"])
            print(f"✅ Fuzzy-matched {len(corrected)} reviews to products")
            print("🔍 Sample matches (review_slug → product_slug):")
            for i, (rs, ps) in enumerate(list(corrected.items())[:10]):
                print(f"   {rs} → {ps}")
        else:
            print("⚠️ No fuzzy matches found either. Reviews will have empty product_slug.")
    else:
        print(f"✅ Found {len(exact_matches)} exact matches between reviews and products")
    
    # Count matched reviews
    matched_count = valid_reviews['product_slug'].astype(bool).sum()
    unique_products = valid_reviews['product_slug'].nunique()
    print(f"✅ Matched {matched_count} reviews to {unique_products} unique products")
else:
    print("⚠️ No products available for matching. Reviews will have empty product_slug.")
    valid_reviews["product_slug"] = ''
    valid_reviews["product_name"] = valid_reviews.get("reference_id", '')

print()

# ============================================================
# Remove Duplicates, Sort and Save
# ============================================================

print("🔍 Removing duplicate reviews...")
before_dedup = len(valid_reviews)
# Deduplicate by reviewBody and product_slug (or just reviewBody if no product_slug)
dedup_cols = ['reviewbody', 'product_slug'] if 'product_slug' in valid_reviews.columns else ['reviewbody']
dedup_cols = [col for col in dedup_cols if col in valid_reviews.columns]
if len(dedup_cols) > 0:
    valid_reviews = valid_reviews.drop_duplicates(subset=dedup_cols, keep='first')
after_dedup = len(valid_reviews)
if before_dedup > after_dedup:
    print(f"✅ Removed {before_dedup - after_dedup} duplicate review(s)")
else:
    print("✅ No duplicates found")
print()

# Sort by date (newest first)
if 'date' in valid_reviews.columns:
    valid_reviews = valid_reviews.sort_values(by='date', ascending=False, na_position='last')
    print("📅 Sorted reviews by date (newest first)")
print()

# Ensure all expected columns exist before saving
expected_cols = ['product_name', 'product_slug', 'author', 'ratingValue', 'reviewBody', 'source', 'date']
for col in expected_cols:
    if col not in valid_reviews.columns:
        if col == 'author':
            valid_reviews[col] = valid_reviews.get('reviewer', 'Anonymous')
        elif col == 'reviewBody':
            valid_reviews[col] = valid_reviews.get('review', valid_reviews.get('review_text', ''))
        elif col == 'ratingValue':
            valid_reviews[col] = valid_reviews.get('rating', None)
        elif col == 'source':
            valid_reviews[col] = valid_reviews.get('source', 'Unknown')
        elif col == 'date':
            valid_reviews[col] = valid_reviews.get('date', '')
        else:
            valid_reviews[col] = ''

# Select columns to keep (expected + any additional useful ones)
columns_to_keep = expected_cols + [col for col in valid_reviews.columns if col not in expected_cols and col not in ['reviewer', 'review', 'review_text', 'rating', 'star_rating', 'stars', 'reference_id', 'matched_slug']]
valid_reviews = valid_reviews[[col for col in columns_to_keep if col in valid_reviews.columns]]

# Ensure output directory exists
output_path.parent.mkdir(parents=True, exist_ok=True)

# Save merged dataset
valid_reviews.to_csv(output_path, index=False, encoding='utf-8-sig')

# Show sample slugs for verification
sample_slugs = valid_reviews['product_slug'].head(5).tolist() if len(valid_reviews) > 0 else []
print(f"✅ Saved merged reviews: {len(valid_reviews)} rows with slugs like {sample_slugs}")

print("="*60)
print("✅ MERGE COMPLETE")
print("="*60)
print(f"📊 Total reviews: {len(valid_reviews)}")
print(f"   - Trustpilot: {len(valid_reviews[valid_reviews['source'] == 'Trustpilot'])}")
print(f"   - Google: {len(valid_reviews[valid_reviews['source'] == 'Google'])}")
print(f"📁 File saved: {output_path.name}")
print(f"💡 Next step: Use this file in Step 4 - Generate Product Schema")
print("="*60)

if __name__ == "__main__":
    try:
        pass  # Main logic already executed above
    except KeyboardInterrupt:
        print("\n⚠️ Operation cancelled by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
