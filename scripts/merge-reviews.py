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

def normalize_ref(text):
    """Normalize Reference Id for consistent matching with product slugs"""
    if not text or pd.isna(text):
        return ""
    text = str(text).lower().strip()
    # Remove URL prefixes
    text = re.sub(r"https?://(www\.)?alanranger\.com/", "", text)
    # Normalize separators: replace all non-alphanumeric with hyphens
    text = re.sub(r"[^a-z0-9]+", "-", text)
    # Collapse multiple dashes
    text = re.sub(r"-+", "-", text)
    return text.strip("-")

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
    """Match Google review to product using text content with improved keyword prioritization"""
    if not text:
        return None
    
    t = norm(text)
    t_lower = t.lower()
    
    # Check aliases first (case-insensitive substring match)
    for key, slug in aliases.items():
        if key.lower() in t_lower and slug in product_by_slug:
            return slug
    
    # Priority 1: Exact product name matches (highest priority)
    # Check if review text contains the full product name or key distinguishing words
    if name_by_slug:
        exact_matches = []
        for slug, name in name_by_slug.items():
            name_lower = norm(name).lower()
            name_words = name_lower.split()
            
            # Check for exact product name match (high priority)
            if name_lower in t_lower:
                exact_matches.append((slug, 100.0, name))
            # Check for key distinguishing words (e.g., "beginners", "black and white", "lightroom")
            # These are words that uniquely identify a product
            elif len(name_words) > 0:
                # Count how many significant words match
                significant_words = [w for w in name_words if len(w) > 4]
                if significant_words:
                    matches = sum(1 for word in significant_words if word in t_lower)
                    match_ratio = matches / len(significant_words)
                    # Prioritize matches with unique keywords (e.g., "beginners", "lightroom", "black")
                    # Include "marco" as typo variant of "macro"
                    unique_keywords = ['beginner', 'beginners', 'lightroom', 'black', 'white', 'portrait', 'macro', 'marco', 'landscape']
                    has_unique = any(kw in t_lower and (kw in name_lower or (kw == 'marco' and 'macro' in name_lower)) for kw in unique_keywords)
                    if match_ratio >= 0.5 or has_unique:
                        exact_matches.append((slug, match_ratio * 100 + (50 if has_unique else 0), name))
        
        # Return the best exact match (highest score)
        if exact_matches:
            best_exact = max(exact_matches, key=lambda x: x[1])
            if best_exact[1] >= 50.0:  # At least 50% match or has unique keyword
                return best_exact[0]
    
    # Priority 2: Keyword-based matching (check for specific product identifiers)
    if name_by_slug:
        keyword_matches = []
        for slug, name in name_by_slug.items():
            name_lower = norm(name).lower()
            name_words = name_lower.split()
            
            # Extract unique identifying keywords from product name
            unique_keywords = []
            for word in name_words:
                if len(word) > 4:
                    # Check if this word is unique to this product (not in many other products)
                    word_count = sum(1 for n in name_by_slug.values() if word in norm(n).lower())
                    if word_count <= 3:  # Word appears in 3 or fewer products
                        unique_keywords.append(word)
            
            # Check if review text contains these unique keywords
            if unique_keywords:
                matches = sum(1 for kw in unique_keywords if kw in t_lower)
                if matches > 0:
                    keyword_matches.append((slug, matches / len(unique_keywords), name))
        
        # Return best keyword match
        if keyword_matches:
            best_keyword = max(keyword_matches, key=lambda x: x[1])
            if best_keyword[1] >= 0.5:  # At least 50% of unique keywords match
                return best_keyword[0]
    
    # Priority 3: Fuzzy match on product names (fallback, higher threshold)
    if name_by_slug:
        best = max(
            ((slug, fuzzy(t, name_by_slug[slug])) for slug in name_by_slug),
            key=lambda x: x[1],
            default=(None, 0.0)
        )
        return best[0] if best[1] >= 0.80 else None  # Higher threshold for fuzzy matching (was 0.70)
    
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
        'lakes': 'lake-district-photography-workshop',
        'burnham on sea': 'long-exposure-photography-workshops-burnham',
        'hartland quay': 'landscape-photography-devon-hartland-quay',
        'devon': 'landscape-photography-devon-hartland-quay',
        'lavender field': 'lavender-field-photography-workshop',
        'lavender': 'lavender-field-photography-workshop',
        'fairy glen': 'long-exposure-photography-workshop-fairy-glen',
        'north yorkshire': 'north-yorkshire-landscape-photography',
        'yorkshire': 'north-yorkshire-landscape-photography',
        'bluebell': 'bluebell-woodlands-photography-workshops',
        'bluebells': 'bluebell-woodlands-photography-workshops',
        'chesterton windmill': 'photography-workshops-chesterton-windmill-warwickshire',
        'dorset': 'dorset-landscape-photography-workshop',
        'purbeck': 'dorset-landscape-photography-workshop',
        'northumberland': 'coastal-northumberland-workshops',
        'somerset': 'somerset-landscape-photography-workshops',
        'garden photography': 'garden-photography-workshop',
        'garden': 'garden-photography-workshop',
        'sezincote': 'sezincote-garden-photography-workshop',
        'marco': 'macro-photography-workshops-warwickshire',  # Typo alias: "Marco" -> "Macro"
        'marco photography': 'macro-photography-workshops-warwickshire',
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
        # Store original column names before normalization
        original_columns = trustpilot_df.columns.tolist()
        trustpilot_df.columns = [c.strip().lower().replace(' ', '_') for c in trustpilot_df.columns]
        print(f"✅ Loaded {len(trustpilot_df)} Trustpilot reviews")
        # Debug: Check for Reference Id column
        ref_id_cols = [c for c in original_columns if 'reference' in c.lower() and 'id' in c.lower()]
        if ref_id_cols:
            normalized_ref_col = ref_id_cols[0].strip().lower().replace(' ', '_')
            print(f"📋 Found Reference Id column: '{ref_id_cols[0]}' → '{normalized_ref_col}'")
            if normalized_ref_col in trustpilot_df.columns:
                ref_id_count = trustpilot_df[normalized_ref_col].notna().sum()
                print(f"   Reviews with Reference Id: {ref_id_count} / {len(trustpilot_df)}")
                sample_ref_ids = trustpilot_df[normalized_ref_col].dropna().head(5).tolist()
                if sample_ref_ids:
                    print(f"   Sample Reference Ids: {sample_ref_ids}")
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
        df['reviewBody'] = df[review_col].fillna('').astype(str)
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
    # IMPORTANT: Trustpilot Reference Id contains exact product names - preserve them!
    if 'reference_id' in valid_reviews.columns:
        # For Trustpilot, Reference Id IS the product name - use it directly
        trustpilot_mask = valid_reviews['source'] == 'Trustpilot'
        valid_reviews.loc[trustpilot_mask, "product_name"] = valid_reviews.loc[trustpilot_mask, "reference_id"].fillna('')
        # Only create slug if product_name is set
        valid_reviews.loc[trustpilot_mask, "product_slug"] = valid_reviews.loc[trustpilot_mask, "product_name"].fillna('').apply(lambda x: slugify(x) if x else '')
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
    ref_id_matches = 0  # Track Reference Id matches
    ref_id_total = 0  # Track total reviews with Reference Id
    
    for idx, row in valid_reviews.iterrows():
        source = row.get('source', '')
        existing_slug = row.get('product_slug', '') or ''
        
        matched_slug = None
        
        # Skip if already matched exactly (for Google or if Trustpilot Reference Id didn't match)
        if existing_slug and existing_slug in product_slugs:
            matched_slug = existing_slug
        
        if not matched_slug and source == 'Trustpilot':
            # Phase 0 – Trustpilot Reference Id direct match (highest priority)
            # Check all possible column name variations (check both row.index and valid_reviews.columns)
            ref_id = None
            ref_col_found = None
            
            # Check for Reference Id column (after normalization, it's "reference_id")
            # Check both normalized and original column names
            ref_col_names = ["reference_id", "referenceid", "ref_id", "Reference Id", "ReferenceId", "referenceId", "Ref Id"]
            
            for col_name in ref_col_names:
                if col_name in row.index:
                    ref_val = row.get(col_name)
                    if ref_val and pd.notna(ref_val) and str(ref_val).strip():
                        ref_id = str(ref_val).strip()
                        ref_col_found = col_name
                        break
            
            # If not found in row.index, check valid_reviews.columns
            if not ref_id and len(valid_reviews) > 0:
                for col_name in ref_col_names:
                    if col_name in valid_reviews.columns:
                        ref_val = row.get(col_name)
                        if ref_val and pd.notna(ref_val) and str(ref_val).strip():
                            ref_id = str(ref_val).strip()
                            ref_col_found = col_name
                            break
            
            if ref_id:
                ref_id_total += 1
                # Reference Id is usually a product name/description, not a slug
                # Try multiple matching strategies in order of strictness:
                
                # Strategy 1: Exact product name match (case-insensitive, ignore extra words)
                ref_id_lower = ref_id.lower().strip()
                ref_id_normalized = re.sub(r'\s+', ' ', ref_id_lower)  # Normalize whitespace
                for slug, name in name_by_slug.items():
                    name_lower = str(name).lower().strip()
                    name_normalized = re.sub(r'\s+', ' ', name_lower)
                    # Check if Reference Id is contained in product name or vice versa
                    # This handles cases like "URBAN ARCHITECTURE Photography Workshops" 
                    # matching "URBAN ARCHITECTURE Photography Workshops - Coventry 16 Apr"
                    if ref_id_normalized in name_normalized or name_normalized in ref_id_normalized:
                        matched_slug = slug
                        ref_id_matches += 1
                        break
                
                # Strategy 2: Extract key distinguishing words and require ALL to match
                # Key words are location names, unique identifiers (not generic words like "photography", "workshop")
                if not matched_slug:
                    # Extract significant words (longer than 4 chars, exclude generic terms)
                    generic_words = {'photography', 'workshop', 'workshops', 'course', 'courses', 'class', 'classes', 
                                    'beginners', 'beginner', 'advanced', 'intermediate', 'photo', 'photographic'}
                    ref_words = [w for w in ref_id_lower.split() 
                                if len(w) > 4 and w not in generic_words]
                    
                    if ref_words:  # Only proceed if we have distinguishing words
                        best_match = None
                        best_score = 0
                        for slug, name in name_by_slug.items():
                            name_lower = str(name).lower()
                            # Count how many key words match
                            matches = sum(1 for word in ref_words if word in name_lower)
                            # Require ALL key words to match (not just 50%)
                            if matches == len(ref_words) and matches > 0:
                                score = matches / len(ref_words) if ref_words else 0
                                if score > best_score:
                                    best_score = score
                                    best_match = slug
                        
                        if best_match:
                            matched_slug = best_match
                            ref_id_matches += 1
                
                # Strategy 3: Normalize and match against product slugs (exact)
                if not matched_slug:
                    norm_ref = normalize_ref(ref_id)
                    normalized_product_slugs = {normalize_ref(slug): slug for slug in product_by_slug.keys()}
                    if norm_ref in normalized_product_slugs:
                        matched_slug = normalized_product_slugs[norm_ref]
                        ref_id_matches += 1
                
                # Strategy 4: Fuzzy match Reference Id against product names (strict threshold)
                if not matched_slug and name_by_slug:
                    best_match = None
                    best_ratio = 0.0
                    for slug, name in name_by_slug.items():
                        ratio = fuzzy(ref_id, str(name))
                        if ratio > best_ratio:
                            best_ratio = ratio
                            best_match = slug
                    # Increased threshold to 0.80 to prevent false matches
                    if best_ratio >= 0.80:
                        matched_slug = best_match
                        ref_id_matches += 1
                
                # Strategy 5: Fuzzy match normalized Reference Id against normalized product slugs (strict)
                if not matched_slug:
                    norm_ref = normalize_ref(ref_id)
                    normalized_product_slugs = {normalize_ref(slug): slug for slug in product_by_slug.keys()}
                    best_match = None
                    best_ratio = 0.0
                    for norm_prod_slug, orig_prod_slug in normalized_product_slugs.items():
                        ratio = SequenceMatcher(None, norm_ref, norm_prod_slug).ratio()
                        if ratio > best_ratio:
                            best_ratio = ratio
                            best_match = orig_prod_slug
                    # Increased threshold to 0.80 to prevent false matches
                    if best_ratio >= 0.80:
                        matched_slug = best_match
                        ref_id_matches += 1
                
                # Final validation: Prevent obvious mismatches
                # Check if matched product contains conflicting location/keywords
                if matched_slug and ref_id:
                    ref_id_lower = ref_id.lower()
                    matched_name = name_by_slug.get(matched_slug, '').lower()
                    
                    # Extract location/keywords from Reference Id
                    ref_locations = []
                    ref_keywords = []
                    if 'urban' in ref_id_lower and 'architecture' in ref_id_lower:
                        ref_keywords.append('urban-architecture')
                    if 'batsford' in ref_id_lower or 'arboretum' in ref_id_lower:
                        ref_locations.append('batsford')
                    if 'peak' in ref_id_lower and 'district' in ref_id_lower:
                        ref_locations.append('peak-district')
                    if 'lake' in ref_id_lower and 'district' in ref_id_lower:
                        ref_locations.append('lake-district')
                    if 'yorkshire' in ref_id_lower and 'dales' in ref_id_lower:
                        ref_locations.append('yorkshire-dales')
                    
                    # Check for conflicts
                    conflict = False
                    if 'urban-architecture' in ref_keywords:
                        if 'batsford' in matched_name or 'arboretum' in matched_name:
                            conflict = True
                    if 'batsford' in ref_locations:
                        if 'urban' in matched_name and 'architecture' in matched_name:
                            conflict = True
                    if 'peak-district' in ref_locations:
                        if 'batsford' in matched_name or 'arboretum' in matched_name:
                            conflict = True
                    if 'lake-district' in ref_locations:
                        if 'batsford' in matched_name or 'arboretum' in matched_name:
                            conflict = True
                    if 'yorkshire-dales' in ref_locations:
                        if 'devon' in matched_name:
                            conflict = True
                    
                    if conflict:
                        # Reject the match - it's clearly wrong
                        matched_slug = None
            
            # Phase 1 – Try Tags column if Reference Id didn't match
            if not matched_slug:
                tags_value = row.get('tags', '') or row.get('Tags', '')
                matched_slug = match_via_tags(tags_value, ALIASES, product_by_slug, name_by_slug) if tags_value else None
            
            # Phase 2 – Fallback to text matching if Tags didn't match
            if not matched_slug:
                review_text = str(row.get("reviewBody", "") or row.get("review_text", "") or "")
                matched_slug = match_via_text(review_text, ALIASES, product_by_slug, name_by_slug)
        if not matched_slug and source == 'Google':
            # Use text matching for Google reviews
            # Combine review body and title for better matching
            # Check multiple column name variations
            review_text = str(row.get("reviewBody", "") or row.get("review", "") or row.get("review_text", "") or "")
            review_title = str(row.get("reviewTitle", "") or row.get("title", "") or "")
            combined_text = f"{review_title} {review_text}".strip()
            
            # Debug: Log Batsford-related reviews
            if 'batsford' in combined_text.lower():
                print(f"   🔍 Found Batsford mention: {combined_text[:100]}...")
            
            # Try matching with combined text first
            matched_slug = match_via_text(combined_text, ALIASES, product_by_slug, name_by_slug)
            
            # Debug: Log if Batsford review matched
            if 'batsford' in combined_text.lower() and matched_slug:
                print(f"   ✅ Matched Batsford review to: {matched_slug}")
            elif 'batsford' in combined_text.lower() and not matched_slug:
                print(f"   ⚠️ Batsford review NOT matched (text: {combined_text[:80]}...)")
            
            # If no match and review text is empty, try matching against all products with lower threshold
            # This handles Google reviews that mention products but don't have detailed text
            if not matched_slug and not review_text.strip():
                # Try fuzzy matching against product names with lower threshold
                if name_by_slug:
                    best = max(
                        ((slug, fuzzy(combined_text, name_by_slug[slug])) for slug in name_by_slug),
                        key=lambda x: x[1],
                        default=(None, 0.0)
                    )
                    if best[1] >= 0.60:  # Lower threshold for empty reviews
                        matched_slug = best[0]
        
        # Deduplication key
        reviewer = norm(str(row.get('reviewer', '') or row.get('author', '') or ''))
        date_str = str(row.get('date', '') or row.get('created_at', '') or '')
        review_text_norm = norm(str(row.get('reviewBody', '') or row.get('review_text', '') or ''))
        dedupe_key = (source, reviewer, date_str, review_text_norm)
        
        if dedupe_key in seen:
            continue
        
        seen.add(dedupe_key)
        
        # Create a copy of the row as a dict to preserve all fields
        row_dict = row.to_dict()
        
        # Update product_slug (keep canonical slug, don't re-normalize)
        row_dict['product_slug'] = matched_slug or ''
        if matched_slug:
            matched_count += 1
            # Get product name from dictionary
            if matched_slug in name_by_slug:
                row_dict['product_name'] = name_by_slug[matched_slug]
        
        final_reviews.append(row_dict)
    
    # Convert back to DataFrame
    valid_reviews = pd.DataFrame(final_reviews)
    
    if matched_count > 0:
        print(f"✅ Matched {matched_count} reviews to products using Reference Id + Tags + alias + text matching")
        
        # Show Reference Id matching stats
        if ref_id_total > 0:
            print(f"   📋 Reference Id matching: {ref_id_matches} / {ref_id_total} matched ({ref_id_matches/ref_id_total*100:.1f}%)")
        
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
    
    # Show breakdown by source
    if 'source' in valid_reviews.columns:
        google_matched = len(valid_reviews[(valid_reviews['source'] == 'Google') & valid_reviews['product_slug'].astype(bool)])
        trustpilot_matched = len(valid_reviews[(valid_reviews['source'] == 'Trustpilot') & valid_reviews['product_slug'].astype(bool)])
        google_total = len(valid_reviews[valid_reviews['source'] == 'Google'])
        trustpilot_total = len(valid_reviews[valid_reviews['source'] == 'Trustpilot'])
        print(f"   - Google: {google_matched} / {google_total} matched")
        print(f"   - Trustpilot: {trustpilot_matched} / {trustpilot_total} matched")
    
    # Merge with product data to get product names (only for rows with slugs)
    if 'product_slug' in valid_reviews.columns and len(products_df) > 0:
        # Create a mapping from product_slug to product_name
        product_map = dict(zip(products_df['product_slug'], products_df['name']))
        # Only update product_name for rows that have a product_slug
        mask = valid_reviews['product_slug'].astype(bool)
        valid_reviews.loc[mask, 'product_name'] = valid_reviews.loc[mask, 'product_slug'].map(product_map).fillna(valid_reviews.loc[mask, 'product_name'])
        print(f"✅ Linked {mask.sum()} reviews to product names")
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
