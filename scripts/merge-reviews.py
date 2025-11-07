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

def norm(s: str) -> str:
    """Normalize text for matching: lowercase, strip, normalize whitespace"""
    return re.sub(r'\s+', ' ', (s or '')).strip().lower()

def fuzzy(a: str, b: str) -> float:
    """Calculate similarity ratio between two strings"""
    return SequenceMatcher(None, norm(a), norm(b)).ratio()

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

def match_via_tags(tags_value: str, aliases: dict, product_by_slug: dict, name_by_slug: dict):
    """Match review to product using Trustpilot Tags column"""
    if not tags_value or pd.isna(tags_value):
        return None
    
    tags = re.split(r'[|;,/]+', str(tags_value))
    for t in tags:
        t_norm = norm(t)
        if not t_norm:
            continue
        
        # Check aliases first
        for key, slug in aliases.items():
            if key in t_norm and slug in product_by_slug:
                return slug
        
        # Fuzzy match to product names
        if name_by_slug:
            best = max(
                ((slug, fuzzy(t_norm, name_by_slug[slug])) for slug in name_by_slug),
                key=lambda x: x[1],
                default=(None, 0.0)
            )
            if best[1] >= 0.85:
                return best[0]
    
    return None

def match_via_text(text: str, aliases: dict, product_by_slug: dict, name_by_slug: dict):
    """Match Google review to product using text content"""
    if not text:
        return None
    
    t = norm(text)
    
    # Check aliases first
    for key, slug in aliases.items():
        if key in t and slug in product_by_slug:
            return slug
    
    # Partial keyword match on product names
    if name_by_slug:
        best = max(
            ((slug, fuzzy(t, name_by_slug[slug])) for slug in name_by_slug),
            key=lambda x: x[1],
            default=(None, 0.0)
        )
        return best[0] if best[1] >= 0.80 else None
    
    return None

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
    
    # Build product dictionaries
    product_rows = products_df[['name', 'url', 'product_slug']].dropna(subset=['name', 'url'])
    slug_from_url = lambda u: slugify(str(u).rstrip('/').split('/')[-1]) if pd.notna(u) else ''
    product_rows['slug'] = product_rows['url'].apply(slug_from_url)
    # Use product_slug if available, otherwise use slug from URL
    product_rows['slug'] = product_rows['product_slug'].fillna(product_rows['slug'])
    
    product_by_slug = {row['slug']: row for _, row in product_rows.iterrows() if row['slug']}
    name_by_slug = {row['slug']: str(row['name']) for _, row in product_rows.iterrows() if row['slug'] and pd.notna(row['name'])}
    
    # Location/venue aliases -> canonical product slug
    ALIASES = {
        'batsford': 'batsford-arboretum-photography-workshops',
        'batsford arboretum': 'batsford-arboretum-photography-workshops',
        'lake district': 'lake-district-photography-workshop',
        'burnham on sea': 'long-exposure-photography-workshops-burnham',
        'hartland quay': 'landscape-photography-devon-hartland-quay',
        'lavender field': 'lavender-field-photography-workshop',
        'fairy glen': 'long-exposure-photography-workshop-fairy-glen',
        'north yorkshire': 'north-yorkshire-landscape-photography',
        'bluebell': 'bluebell-woodlands-photography-workshops',
        'chesterton windmill': 'photography-workshops-chesterton-windmill-warwickshire',
    }
    
    print(f"📋 Built product dictionary with {len(product_by_slug)} products")
    print(f"📋 Added {len(ALIASES)} location aliases")
    
except Exception as e:
    print(f"⚠️ Could not load products file: {e}")
    products_df = pd.DataFrame()
    product_slugs = []
    product_by_slug = {}
    name_by_slug = {}
    ALIASES = {}

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
    
    # Initialize product_slug column
    valid_reviews["product_slug"] = ''
    valid_reviews["product_name"] = ''
    
    # Try to get product_name from reference_id or other columns first
    if 'reference_id' in valid_reviews.columns:
        valid_reviews["product_name"] = valid_reviews["reference_id"].fillna('')
        valid_reviews["product_slug"] = valid_reviews["product_name"].fillna('').apply(slugify)
    elif 'product_name' in valid_reviews.columns:
        valid_reviews["product_slug"] = valid_reviews["product_name"].fillna('').apply(slugify)
    
    # Check for exact matches first
    review_slugs_set = set(valid_reviews["product_slug"].dropna())
    review_slugs_set = {s for s in review_slugs_set if s}  # Remove empty strings
    exact_matches = review_slugs_set & set(product_slugs)
    
    if len(exact_matches) > 0:
        print(f"✅ Found {len(exact_matches)} exact matches between reviews and products")
    
    # ============================================================
    # Improved matching using Tags (Trustpilot) and text (Google)
    # ============================================================
    
    # Process reviews row by row with improved matching
    matched_count = 0
    seen = set()  # For deduplication
    final_reviews = []
    
    for idx, row in valid_reviews.iterrows():
        source = row.get('source', '')
        existing_slug = row.get('product_slug', '') or ''
        
        # Skip if already matched exactly
        if existing_slug and existing_slug in product_slugs:
            matched_slug = existing_slug
        elif source == 'Trustpilot':
            # Try Tags column first
            tags_value = row.get('tags', '') or row.get('Tags', '')
            matched_slug = match_via_tags(tags_value, ALIASES, product_by_slug, name_by_slug) if tags_value else None
            
            # Fallback to existing logic if Tags didn't match
            if not matched_slug:
                review_text = str(row.get("reviewBody", "") or row.get("review_text", "") or "")
                matched_slug = match_via_text(review_text, ALIASES, product_by_slug, name_by_slug)
        elif source == 'Google':
            # Use text matching for Google reviews
            review_text = str(row.get("reviewBody", "") or row.get("review_text", "") or "")
            matched_slug = match_via_text(review_text, ALIASES, product_by_slug, name_by_slug)
        else:
            matched_slug = None
        
        # Deduplication key
        reviewer = norm(str(row.get('reviewer', '') or row.get('author', '') or ''))
        date_str = str(row.get('date', '') or row.get('created_at', '') or '')
        review_text_norm = norm(str(row.get('reviewBody', '') or row.get('review_text', '') or ''))
        dedupe_key = (source, reviewer, date_str, review_text_norm)
        
        if dedupe_key in seen:
            continue
        
        seen.add(dedupe_key)
        
        # Update product_slug
        row['product_slug'] = matched_slug or ''
        if matched_slug:
            matched_count += 1
            # Get product name from dictionary
            if matched_slug in name_by_slug:
                row['product_name'] = name_by_slug[matched_slug]
        
        final_reviews.append(row)
    
    # Convert back to DataFrame
    valid_reviews = pd.DataFrame(final_reviews)
    
    if matched_count > 0:
        print(f"✅ Matched {matched_count} reviews to products using Tags + alias + text matching")
        
        # Show sample matches
        sample_matches = []
        matched_rows = valid_reviews[valid_reviews['product_slug'].astype(bool)]
        for i, (_, row) in enumerate(matched_rows.head(5).iterrows()):
            review_text_preview = str(row.get('reviewBody', ''))[:50]
            slug = row.get('product_slug', '')
            product_name = row.get('product_name', slug)
            sample_matches.append(f"   '{review_text_preview}...' → {slug} ({product_name[:30]}...)")
        
        if sample_matches:
            print("🔍 Sample matches (review → product_slug):")
            for match in sample_matches:
                print(match)
    
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

# Deduplication already handled above with seen set
print(f"✅ Deduplication complete: {len(valid_reviews)} unique reviews")
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
