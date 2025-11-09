#!/usr/bin/env python3
"""
Dedicated Google Review Matcher
Optimized matching logic specifically for Google reviews using text content
"""

import pandas as pd
from pathlib import Path
import re
import sys
from difflib import SequenceMatcher

# Paths
base_path = Path(__file__).parent.parent / "inputs-files" / "workflow"
google_path = base_path / "03b – google_reviews.csv"
products_path = base_path / "02 – products_cleaned.xlsx"
output_path = base_path / "03b_google_matched.csv"

print("="*80)
print("GOOGLE REVIEW MATCHER")
print("="*80)
print()

# Load products
print("Loading products...")
products_df = pd.read_excel(products_path, engine='openpyxl')
products_df = products_df[products_df['name'].notna() & (products_df['name'] != '')]
products_df['slug'] = products_df['url'].apply(lambda u: str(u).split('/')[-1].strip() if pd.notna(u) else '')
products_df = products_df[products_df['slug'] != '']

product_by_slug = {row['slug']: row for _, row in products_df.iterrows()}
name_by_slug = {row['slug']: str(row['name']) for _, row in products_df.iterrows()}
product_slugs = list(product_by_slug.keys())

print(f"Loaded {len(products_df)} products")
print()

# Load Google reviews
print("Loading Google reviews...")
google_df = pd.read_csv(google_path, encoding="utf-8-sig")
print(f"Loaded {len(google_df)} Google reviews")
print(f"Columns: {list(google_df.columns)}")
print()

# Normalize function
def norm(text):
    if pd.isna(text):
        return ''
    return re.sub(r'\s+', ' ', str(text).strip())

# Alias mapping (same as Trustpilot)
ALIASES = {
    'batsford': 'batsford-arboretum-photography-workshops',
    'batsford arboretum': 'batsford-arboretum-photography-workshops',
    'lake district': 'lake-district-photography-workshop',
    'lakes': 'lake-district-photography-workshop',
    'burnham on sea': 'long-exposure-photography-workshops-burnham',
    'devon': 'landscape-photography-devon-hartland-quay',
    'lavender field': 'lavender-field-photography-workshop',
    'yorkshire': 'north-yorkshire-landscape-photography',
    'bluebell': 'bluebell-woodlands-photography-workshops',
    'dorset': 'dorset-landscape-photography-workshop',
    'garden photography': 'garden-photography-workshop',
    'glencoe': 'landscape-photography-workshop-glencoe',
    'anglesey': 'landscape-photography-workshops-anglesey',
    'gower': 'landscape-photography-wales-photo-workshop',
    'gower landscape photography': 'landscape-photography-wales-photo-workshop',
    'canvas': 'fine-art-photography-prints-canvas',
    'canvas wrap': 'fine-art-photography-prints-canvas',
    'fine art': 'framed-fine-art-photography-prints',
    'prints': 'framed-fine-art-photography-prints',
    'dartmoor': 'dartmoor-photography-landscape-workshop',
    'kerry': 'ireland-photography-workshops-dingle',
    'suffolk': 'suffolk-landscape-photography-workshops',
    'norfolk': 'landscape-photography-workshop-norfolk',
    'snowdonia': 'landscape-photography-snowdonia-sat-7th-sun-8th-mar-2026',
    'poppy fields': 'poppy-fields-photography-workshops',
    'urban architecture': 'urban-architecture-photography-workshops-coventry',
    'beginners': 'beginners-photography-course',
    'lightroom': 'lightroom-courses-for-beginners-coventry',
    'macro': 'macro-photography-workshops-warwickshire',
    'woodland': 'secrets-of-woodland-photography-workshop',
    'christmas': 'christmas-photography-workshops',
    'fireworks': 'fireworks-photography-workshop-kenilworth',
    'exmoor': 'exmoor-photography-workshops-lynmouth',
    'peak district': 'peak-district-photography-workshops-may-oct-and-nov',
    'peak district heather': 'peak-district-heather-photography-workshop',
    'sezincote': 'sezincote-garden-photography-workshop',
    'wales': 'wales-photography-workshop-pistyll-rhaeadr',
    'north yorkshire': 'north-yorkshire-landscape-photography',
    'yorkshire dales': 'yorkshire-dales-photography-workshops',
}

def fuzzy_match(text1, text2):
    """Calculate similarity ratio between two texts"""
    return SequenceMatcher(None, str(text1).lower(), str(text2).lower()).ratio()

def match_google_review_to_product(review_text, review_title, name_by_slug, product_by_slug, aliases):
    """Match Google review text to product using multiple strategies"""
    if not review_text and not review_title:
        return None
    
    combined_text = f"{review_title or ''} {review_text or ''}".strip()
    combined_lower = combined_text.lower()
    
    if not combined_lower:
        return None
    
    # Strategy 1: Check aliases in review text
    for alias_key, alias_slug in aliases.items():
        if alias_key in combined_lower and alias_slug in product_by_slug:
            return alias_slug
    
    # Strategy 2: Extract key words and match
    key_words = []
    generic_words = {'photography', 'workshop', 'workshops', 'course', 'courses', 'class', 'classes', 
                    'photo', 'photographic', 'great', 'excellent', 'good', 'amazing', 'wonderful',
                    'recommend', 'recommended', 'highly', 'very', 'really', 'much', 'many', 'some',
                    'alan', 'ranger', 'service', 'experience', 'would', 'definitely', 'again'}
    
    for word in combined_lower.split():
        word_clean = word.strip('.,!?;:()[]{}')
        if len(word_clean) > 4 and word_clean not in generic_words:
            key_words.append(word_clean)
    
    # Add location/product type words (even if shorter)
    location_words = ['glencoe', 'anglesey', 'gower', 'yorkshire', 'dales', 'devon', 'peak', 'district',
                     'lake', 'batsford', 'arboretum', 'urban', 'architecture', 'coventry', 'kenilworth',
                     'ireland', 'kerry', 'dartmoor', 'norfolk', 'suffolk', 'northumberland', 'wales',
                     'woodland', 'woodlands', 'snowdonia', 'poppy', 'sunflower', 'brandon', 'marsh',
                     'beginners', 'lightroom', 'macro', 'christmas', 'fireworks', 'exmoor', 'sezincote',
                     'lavender', 'bluebell', 'fairy', 'glen', 'chesterton', 'windmill', 'north', 'south',
                     'east', 'west', 'coastal', 'landscape', 'portrait', 'long', 'exposure', 'garden',
                     'canvas', 'prints', 'mentoring', 'sensor', 'clean', 'rps', 'academy', 'masterclass']
    
    for word in combined_lower.split():
        word_clean = word.strip('.,!?;:()[]{}')
        if word_clean in location_words:
            key_words.append(word_clean)
    
    if key_words:
        best_match = None
        best_score = 0
        for slug, name in name_by_slug.items():
            name_lower = str(name).lower()
            matches = sum(1 for kw in key_words if kw in name_lower)
            if matches > 0:
                score = matches / len(key_words)
                if score > best_score and score >= 0.5:  # At least 50% of keywords match
                    best_score = score
                    best_match = slug
        if best_match:
            return best_match
    
    # Strategy 3: Fuzzy match against product names
    best_match = None
    best_ratio = 0.0
    for slug, name in name_by_slug.items():
        ratio = fuzzy_match(combined_text, name)
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = slug
    
    if best_ratio >= 0.55:  # Lower threshold to 55% for Google reviews
        return best_match
    
    return None

# Process Google reviews
print("Matching Google reviews to products...")
matched_reviews = []
unmatched_count = 0

for idx, row in google_df.iterrows():
    review_text = str(row.get('review', '') or row.get('comment', '') or '').strip()
    review_title = str(row.get('title', '') or '').strip()
    
    matched_slug = match_google_review_to_product(review_text, review_title, name_by_slug, product_by_slug, ALIASES)
    
    review_dict = row.to_dict()
    review_dict['source'] = 'Google'
    review_dict['product_slug'] = matched_slug if matched_slug else ''
    review_dict['product_name'] = name_by_slug.get(matched_slug, '') if matched_slug else ''
    
    if matched_slug:
        matched_reviews.append(review_dict)
    else:
        unmatched_count += 1

print(f"Matched: {len(matched_reviews)} reviews")
print(f"Unmatched: {unmatched_count} reviews")
print()

# Save matched reviews
if matched_reviews:
    matched_df = pd.DataFrame(matched_reviews)
    matched_df.to_csv(output_path, index=False, encoding='utf-8-sig')
    print(f"Saved {len(matched_reviews)} matched Google reviews to {output_path.name}")
else:
    print("No reviews matched!")

print("="*80)
print("GOOGLE MATCHING COMPLETE")
print("="*80)

