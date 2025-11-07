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

# Try to import fuzzywuzzy for better matching, fall back to SequenceMatcher if not available
try:
    from fuzzywuzzy import fuzz, process
    FUZZYWUZZY_AVAILABLE = True
except ImportError:
    FUZZYWUZZY_AVAILABLE = False
    print("⚠️  fuzzywuzzy not installed. Using basic fuzzy matching.")
    print("   Install with: pip install fuzzywuzzy python-Levenshtein")

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

def clean_text_for_match(text):
    """Lowercase, remove punctuation, and simplify text for keyword matching."""
    if not isinstance(text, str):
        return ""
    text = re.sub(r"[^a-zA-Z0-9\s-]", "", text.lower())
    return " ".join(text.split())

def find_best_match(slug, product_slugs, threshold=70):
    """Find closest product slug for a given review slug using fuzzy logic."""
    if not isinstance(slug, str) or not slug.strip():
        return None
    
    if FUZZYWUZZY_AVAILABLE:
        try:
            best_match, score = process.extractOne(slug, product_slugs, scorer=fuzz.token_set_ratio)
            return best_match if score >= threshold else None
        except Exception:
            pass
    
    # Fallback to SequenceMatcher
    best_match = None
    best_ratio = 0.0
    for ps in product_slugs:
        ratio = SequenceMatcher(None, slug, ps).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = ps
    return best_match if best_ratio >= (threshold / 100.0) else None

def match_review_to_product(review_text, review_title, products_dict):
    """
    Match a review to a product using multiple strategies:
    1. Exact slug match
    2. Partial name match (substring)
    3. Fuzzy token match (≥85% similarity)
    
    Args:
        review_text: Review body text
        review_title: Review title (if available)
        products_dict: Dict mapping product_slug -> product_name
    
    Returns:
        product_slug if match found, None otherwise
    """
    if not review_text and not review_title:
        return None
    
    # Combine review text and title for matching
    combined_text = f"{review_title or ''} {review_text or ''}".strip()
    if not combined_text:
        return None
    
    # Normalize text for matching
    combined_text_lower = clean_text_for_match(combined_text)
    
    # Strategy 1: Exact slug match
    for product_slug, product_name in products_dict.items():
        if product_slug in combined_text_lower:
            return product_slug
    
    # Strategy 2: Partial name match (substring in text)
    for product_slug, product_name in products_dict.items():
        if not product_name:
            continue
        
        product_name_lower = clean_text_for_match(str(product_name))
        # Check if product name or key parts appear in review text
        name_words = product_name_lower.split()
        # Look for significant words (length > 4) from product name
        significant_words = [w for w in name_words if len(w) > 4]
        
        if significant_words:
            # Check if any significant word appears in review text
            if any(word in combined_text_lower for word in significant_words):
                return product_slug
        
        # Also check if product name substring appears
        if product_name_lower in combined_text_lower or combined_text_lower in product_name_lower:
            return product_slug
    
    # Strategy 3: Keyword matching from slug
    for product_slug, product_name in products_dict.items():
        keywords = re.split(r"[-_]", product_slug)
        # Look for keywords longer than 4 characters
        significant_keywords = [k for k in keywords if len(k) > 4]
        if significant_keywords and any(k in combined_text_lower for k in significant_keywords):
            return product_slug
    
    # Strategy 4: Fuzzy token match (≥85% similarity)
    if FUZZYWUZZY_AVAILABLE:
        best_match = None
        best_score = 0
        
        for product_slug, product_name in products_dict.items():
            if not product_name:
                continue
            
            product_name_lower = clean_text_for_match(str(product_name))
            
            # Use partial_ratio for substring matching
            score = fuzz.partial_ratio(product_name_lower, combined_text_lower)
            if score > best_score:
                best_score = score
                best_match = product_slug
        
        if best_score >= 85:
            return best_match
    
    # Fallback: Use basic fuzzy matching
    best_match = find_best_match(combined_text_lower, list(products_dict.keys()), threshold=85)
    return best_match

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
    
    # Normalize review title column (if available)
    title_col = None
    for col in ['title', 'review_title', 'headline', 'subject']:
        if col in df.columns:
            title_col = col
            break
    
    if title_col:
        df['reviewTitle'] = df[title_col].apply(clean_text)
    else:
        df['reviewTitle'] = ''
    
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
# Match Reviews to Products (Improved Fuzzy Matching)
# ============================================================

if len(product_slugs) > 0:
    print("🔗 Matching reviews to product slugs...")
    print(f"🧩 Product slugs loaded for matching: {len(product_slugs)}")
    
    # Build products dictionary (slug -> name) for improved matching
    products_dict = {}
    if len(products_df) > 0:
        for _, row in products_df.iterrows():
            slug = row.get('product_slug', '')
            name = row.get('name', '')
            if slug:
                products_dict[slug] = str(name) if pd.notna(name) else ''
    print(f"📋 Built product dictionary with {len(products_dict)} products")
    
    # Try to get product_name from reference_id or other columns
    if 'reference_id' in valid_reviews.columns:
        valid_reviews["product_name"] = valid_reviews["reference_id"].fillna('')
    elif 'product_name' in valid_reviews.columns:
        pass  # Already exists
    else:
        valid_reviews["product_name"] = ''
    
    # Create slugs from product names (for Trustpilot reviews that have product names)
    valid_reviews["product_slug"] = valid_reviews["product_name"].fillna('').apply(slugify)
    
    # Check for exact matches first
    review_slugs_set = set(valid_reviews["product_slug"].dropna())
    review_slugs_set = {s for s in review_slugs_set if s}  # Remove empty strings
    exact_matches = review_slugs_set & set(product_slugs)
    
    if len(exact_matches) > 0:
        print(f"✅ Found {len(exact_matches)} exact matches between reviews and products")
    
    # ============================================================
    # Improved fuzzy matching for Google + Trustpilot reviews
    # ============================================================
    
    # For reviews without product_slug (especially Google reviews), match by review text
    unmatched_reviews = valid_reviews[
        (valid_reviews["product_slug"].isna()) | 
        (valid_reviews["product_slug"] == '') |
        (~valid_reviews["product_slug"].isin(product_slugs))
    ].copy()
    
    if len(unmatched_reviews) > 0:
        print(f"🔍 Attempting improved keyword + fuzzy matching for {len(unmatched_reviews)} unmatched reviews...")
        print("   Using strategies: exact slug → partial name → keyword → fuzzy (≥85%)")
        
        # Apply improved matching logic to review text and title
        matched_products = []
        for idx, row in unmatched_reviews.iterrows():
            review_text = str(row.get("reviewBody", "") or row.get("review_text", "") or "")
            review_title = str(row.get("reviewTitle", "") or row.get("title", "") or "")
            matched_slug = match_review_to_product(review_text, review_title, products_dict)
            matched_products.append(matched_slug)
        
        # Update product_slug for unmatched reviews
        valid_reviews.loc[unmatched_reviews.index, "product_slug"] = matched_products
        
        # Count successful matches
        matched_count = sum(1 for p in matched_products if p is not None)
        if matched_count > 0:
            print(f"✅ Matched {matched_count} reviews to products using improved matching logic")
            
            # Show sample matches
            sample_matches = []
            for i, slug in enumerate(matched_products):
                if slug:
                    review_idx = unmatched_reviews.index[i]
                    review_text_preview = str(valid_reviews.loc[review_idx, "reviewBody"])[:50]
                    product_name = products_dict.get(slug, slug)
                    sample_matches.append(f"   '{review_text_preview}...' → {slug} ({product_name[:30]}...)")
                    if len(sample_matches) >= 5:
                        break
            
            if sample_matches:
                print("🔍 Sample matches (review text → product_slug):")
                for match in sample_matches:
                    print(match)
        else:
            print("⚠️ No matches found with improved logic. Check review text content.")
    
    # Count total matched reviews
    matched_count = valid_reviews['product_slug'].astype(bool).sum()
    unique_products = valid_reviews['product_slug'].nunique()
    print(f"✅ Total matched: {matched_count} reviews to {unique_products} unique products")
    
    # Merge with product data to get product names
    if 'product_slug' in valid_reviews.columns and len(products_df) > 0:
        # Create a mapping from product_slug to product_name
        product_map = dict(zip(products_df['product_slug'], products_df['name']))
        valid_reviews['product_name'] = valid_reviews['product_slug'].map(product_map).fillna(valid_reviews.get('product_name', ''))
        print(f"✅ Linked {valid_reviews['product_name'].notna().sum()} reviews to product names")
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
