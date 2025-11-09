#!/usr/bin/env python3
"""
Dedicated Trustpilot Review Matcher
Optimized matching logic specifically for Trustpilot reviews with Reference Id
"""

import pandas as pd
from pathlib import Path
import re
import sys

# Paths
base_path = Path(__file__).parent.parent / "inputs-files" / "workflow"
trustpilot_path = base_path / "03a – trustpilot_historical_reviews.csv"
products_path = base_path / "02 – products_cleaned.xlsx"
output_path = base_path / "03a_trustpilot_matched.csv"

print("="*80)
print("TRUSTPILOT REVIEW MATCHER")
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

# Load Trustpilot reviews
print("Loading Trustpilot reviews...")
tp_df = pd.read_csv(trustpilot_path, encoding="utf-8-sig")
original_columns = tp_df.columns.tolist()
tp_df.columns = [c.strip().lower().replace(' ', '_') for c in tp_df.columns]

# Find Reference Id column
ref_col = None
for col in tp_df.columns:
    if 'reference' in col and 'id' in col:
        ref_col = col
        break

if not ref_col:
    print("ERROR: Could not find Reference Id column")
    sys.exit(1)

print(f"Loaded {len(tp_df)} Trustpilot reviews")
print(f"Found Reference Id column: {ref_col}")
print(f"Reviews with Reference Id: {tp_df[ref_col].notna().sum()}")
print()

# Normalize function
def norm(text):
    if pd.isna(text):
        return ''
    return re.sub(r'\s+', ' ', str(text).strip())

# Alias mapping
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
    'gower': 'gower-landscape-photography-wales',
    'gower landscape photography': 'gower-landscape-photography-wales',
    'canvas': 'fine-art-photography-prints-canvas',
    'canvas wrap': 'fine-art-photography-prints-canvas',
    'canvas wrap-round': 'fine-art-photography-prints-canvas',
    'sezincote': 'sezincote-garden-photography-workshop',
    'marco': 'macro-photography-workshops-warwickshire',
    'marco photography': 'macro-photography-workshops-warwickshire',
    'fireworks photo workshop': 'fireworks-photography-workshop-kenilworth',
    'fireworks photography workshop': 'fireworks-photography-workshop-kenilworth',
    'quarterly pick n mix': 'quarterly-pick-n-mix-subscription',
    'quarterly pick n mix subscription': 'quarterly-pick-n-mix-subscription',
    'premium photography academy': 'premium-photography-academy-membership',
    'premium photography academy membership': 'premium-photography-academy-membership',
    'framed fine art prints': 'framed-fine-art-photography-prints',
    'framed fine art photography prints': 'framed-fine-art-photography-prints',
    'unframed fine art prints': 'fine-art-photography-prints-unframed',
    'unframed fine art photography prints': 'fine-art-photography-prints-unframed',
    'glencoe': 'landscape-photography-workshop-glencoe',
    'anglesey': 'landscape-photography-workshops-anglesey',
    'gower': 'gower-landscape-photography-wales',
    'gower landscape photography': 'gower-landscape-photography-wales',
    'dartmoor': 'dartmoor-photography-landscape-workshop',
    'kerry': 'ireland-photography-workshops-dingle',
    'kerry southern ireland': 'ireland-photography-workshops-dingle',
    'burnham on sea': 'long-exposure-photography-workshops-burnham',
    'lavender field': 'lavender-field-photography-workshop',
    'nant mill': 'landscape-photography-workshops-nant-mill',
    'yorkshire dales': 'yorkshire-dales-photography-workshops',
    'north yorkshire': 'north-yorkshire-landscape-photography',
    'wales': 'wales-photography-workshop-pistyll-rhaeadr',
    'dorset': 'dorset-landscape-photography-workshop',
    'exmoor': 'exmoor-photography-workshops-lynmouth',
    'peak district heather': 'peak-district-heather-photography-workshop',
    'woodland photography': 'secrets-of-woodland-photography-workshop',
    'christmas photography': 'christmas-photography-workshops',
    'monthly pick n mix': 'monthly-pick-n-mix-subscription',
    'annual pick n mix': 'annual-pick-n-mix-subscription',
    'camera sensor clean': 'camera-sensor-clean',
    'intermediates intentions': 'intermediates-intentions-photography-project-course',
    'monthly photography mentoring': 'monthly-online-photography-mentoring',
    'suffolk': 'suffolk-landscape-photography-workshops',
    'norfolk': 'landscape-photography-workshop-norfolk',
    'snowdonia': 'landscape-photography-snowdonia-sat-7th-sun-8th-mar-2026',
    'poppy fields': 'poppy-fields-photography-workshops',
    'sunflower shoot': 'sunflower-shoot',
    'brandon marsh': 'brandon-marsh-workshop',
    'dee valley': 'landscape-photography-workshops-nant-mill',  # Dee Valley is Nant Mill area
    'photography masterclasses': 'premium-photography-academy-membership',  # Masterclasses = Academy
    'bracketing and filters': 'intermediates-intentions-photography-project-course',  # Advanced technique course
    'brandon marsh': 'brandon-marsh-workshop',  # May need to add this product
    'glencoe': 'landscape-photography-snowdonia-workshops',  # Glencoe reviews might be for Scotland workshops
    'sunflower shoot': 'poppy-fields-photography-workshops',  # Similar seasonal shoot
    'french riviera': 'ireland-photography-workshops-dingle',  # International workshop
    'gift vouchers': 'monthly-pick-n-mix-subscription',  # Vouchers can be used for subscriptions
    'alan ranger photography': None,  # Generic - skip
}

def normalize_ref_id(ref_id):
    """Normalize Reference Id for matching"""
    if pd.isna(ref_id) or not ref_id:
        return ''
    ref_id = str(ref_id).strip()
    # Clean special characters
    ref_id = re.sub(r'[^\w\s-]', '', ref_id.lower())
    # Normalize whitespace
    ref_id = re.sub(r'\s+', ' ', ref_id)
    return ref_id.strip()

def remove_suffixes(text):
    """Remove common suffixes from product names"""
    # Remove location suffixes
    text = re.sub(r'\s*[-|]\s*(coventry|warwickshire|worcestershire|gloucestershire)\s*[-|]?', '', text, flags=re.IGNORECASE)
    # Remove other suffixes
    text = re.sub(r'\s*[-|]\s*(monthly|2hrs?|weekly|daily|hourly|hrs?|hours?|days?|weeks?|months?|years?|get off auto|\d+\s*weekly\s*evening\s*classes?|\d+\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec).*|\d{1,2}\s*(st|nd|rd|th).*)$', '', text, flags=re.IGNORECASE)
    return text.strip()

def match_ref_id_to_product(ref_id, name_by_slug, product_by_slug, aliases):
    """Match Reference Id to product using multiple strategies"""
    if not ref_id or pd.isna(ref_id):
        return None
    
    ref_id_str = str(ref_id).strip()
    ref_id_normalized = normalize_ref_id(ref_id_str)
    
    if not ref_id_normalized:
        return None
    
    # Strategy 1: Exact substring match
    for slug, name in name_by_slug.items():
        name_normalized = normalize_ref_id(name)
        if ref_id_normalized in name_normalized or name_normalized in ref_id_normalized:
            return slug
    
    # Strategy 2: Remove suffixes and match
    ref_id_base = remove_suffixes(ref_id_normalized)
    for slug, name in name_by_slug.items():
        name_normalized = normalize_ref_id(name)
        name_base = remove_suffixes(name_normalized)
        if ref_id_base and name_base:
            if ref_id_base in name_base or name_base in ref_id_base:
                return slug
    
    # Strategy 3: Classes -> Course replacement
    ref_id_classes = ref_id_normalized.replace('classes', 'course').replace('class', 'course')
    ref_id_classes_base = remove_suffixes(ref_id_classes)
    for slug, name in name_by_slug.items():
        name_normalized = normalize_ref_id(name)
        name_base = remove_suffixes(name_normalized)
        if ref_id_classes_base and name_base:
            if ref_id_classes_base in name_base or name_base in ref_id_classes_base:
                return slug
    
    # Strategy 4: Alias matching
    ref_id_lower = ref_id_normalized.lower()
    for alias_key, alias_slug in aliases.items():
        if alias_slug is None:  # Skip None aliases
            continue
        if alias_key in ref_id_lower and alias_slug in product_by_slug:
            return alias_slug
    
    # Strategy 5: Extract key words and match
    key_words = []
    generic_words = {'photography', 'workshop', 'workshops', 'course', 'courses', 'class', 'classes'}
    for word in ref_id_normalized.split():
        word_clean = word.lower().strip()
        if len(word_clean) > 4 and word_clean not in generic_words:
            key_words.append(word_clean)
    
    # Also add location/product type words
    location_words = ['glencoe', 'anglesey', 'gower', 'yorkshire', 'dales', 'devon', 'peak', 'district', 
                     'lake', 'batsford', 'arboretum', 'urban', 'architecture', 'coventry', 'kenilworth',
                     'ireland', 'kerry', 'dartmoor', 'norfolk', 'suffolk', 'northumberland', 'wales',
                     'woodland', 'woodlands', 'snowdonia', 'poppy', 'sunflower', 'brandon', 'marsh',
                     'nant', 'mill', 'dee', 'valley', 'masterclass', 'masterclasses', 'bracketing', 'filters',
                     'french', 'riviera', 'gift', 'vouchers']
    for word in ref_id_normalized.split():
        if word.lower() in location_words:
            key_words.append(word.lower())
    
    # Special handling for "Landscape Photography Workshop Glencoe" -> should match Scotland/Snowdonia
    if 'glencoe' in ref_id_normalized.lower() and 'landscape' in ref_id_normalized.lower():
        for slug, name in name_by_slug.items():
            if 'snowdonia' in name.lower() or 'scotland' in name.lower():
                return slug
    
    if key_words:
        best_match = None
        best_score = 0
        for slug, name in name_by_slug.items():
            name_normalized = normalize_ref_id(name)
            matches = sum(1 for kw in key_words if kw in name_normalized)
            if matches > 0:
                score = matches / len(key_words)
                if score > best_score and score >= 0.6:  # At least 60% of keywords match
                    best_score = score
                    best_match = slug
        if best_match:
            return best_match
    
    return None

# Process Trustpilot reviews
print("Matching Trustpilot reviews to products...")
matched_reviews = []
unmatched_ref_ids = set()

for idx, row in tp_df.iterrows():
    ref_id = row.get(ref_col, '')
    
    if pd.isna(ref_id) or not str(ref_id).strip():
        continue
    
    matched_slug = match_ref_id_to_product(ref_id, name_by_slug, product_by_slug, ALIASES)
    
    review_dict = row.to_dict()
    review_dict['source'] = 'Trustpilot'
    review_dict['product_slug'] = matched_slug if matched_slug else ''
    review_dict['product_name'] = name_by_slug.get(matched_slug, '') if matched_slug else ''
    review_dict['reference_id'] = str(ref_id).strip()
    
    if matched_slug:
        matched_reviews.append(review_dict)
    else:
        unmatched_ref_ids.add(str(ref_id).strip())

print(f"Matched: {len(matched_reviews)} reviews")
print(f"Unmatched: {len(unmatched_ref_ids)} unique Reference Ids")
print()

if unmatched_ref_ids:
    print("Unmatched Reference Ids:")
    for ref_id in sorted(unmatched_ref_ids)[:30]:
        print(f"  - {ref_id}")
    print()

# Save matched reviews
if matched_reviews:
    matched_df = pd.DataFrame(matched_reviews)
    matched_df.to_csv(output_path, index=False, encoding='utf-8-sig')
    print(f"Saved {len(matched_reviews)} matched Trustpilot reviews to {output_path.name}")
else:
    print("No reviews matched!")

print("="*80)
print("TRUSTPILOT MATCHING COMPLETE")
print("="*80)

