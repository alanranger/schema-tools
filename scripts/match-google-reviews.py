#!/usr/bin/env python3
"""
Dedicated Google Review Matcher
Optimized matching logic specifically for Google reviews using:
1. Date-based matching (reviews clustered around event dates)
2. Text content matching
3. Alias matching
"""

import pandas as pd
from pathlib import Path
import re
import sys
from difflib import SequenceMatcher
from datetime import timedelta

# Paths
base_path = Path(__file__).parent.parent / "inputs-files" / "workflow"
google_path = base_path / "03b – google_reviews.csv"
products_path = base_path / "02 – products_cleaned.xlsx"
# Try multiple possible event file names
events_workshops_path = None
events_lessons_path = None
for possible_name in [
    "01 – workshops.csv",
    "03 - www-alanranger-com__5013f4b2c4aaa4752ac69b17__photographic-workshops-near-me.csv"
]:
    test_path = base_path / possible_name
    if test_path.exists():
        events_workshops_path = test_path
        break
for possible_name in [
    "01 – lessons.csv",
    "02 - www-alanranger-com__5013f4b2c4aaa4752ac69b17__beginners-photography-lessons.csv"
]:
    test_path = base_path / possible_name
    if test_path.exists():
        events_lessons_path = test_path
        break
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
google_df['date_parsed'] = pd.to_datetime(google_df['date'], errors='coerce')
print(f"Loaded {len(google_df)} Google reviews")
print(f"Reviews with valid dates: {google_df['date_parsed'].notna().sum()}")
print(f"Columns: {list(google_df.columns)}")
print()

# Load events for date-based matching
print("Loading events for date-based matching...")
events_list = []
if events_workshops_path and events_workshops_path.exists():
    workshops = pd.read_csv(events_workshops_path, encoding="utf-8-sig")
    if 'Start_Date' in workshops.columns:
        workshops['start_date_parsed'] = pd.to_datetime(workshops['Start_Date'], errors='coerce')
        workshops = workshops[workshops['start_date_parsed'].notna()].copy()
        events_list.append(workshops)
        print(f"Loaded {len(workshops)} workshop events")
if events_lessons_path and events_lessons_path.exists():
    lessons = pd.read_csv(events_lessons_path, encoding="utf-8-sig")
    if 'Start_Date' in lessons.columns:
        lessons['start_date_parsed'] = pd.to_datetime(lessons['Start_Date'], errors='coerce')
        lessons = lessons[lessons['start_date_parsed'].notna()].copy()
        events_list.append(lessons)
        print(f"Loaded {len(lessons)} lesson events")

if events_list:
    events_df = pd.concat(events_list, ignore_index=True)
    print(f"Total events with dates: {len(events_df)}")
    print()
else:
    events_df = pd.DataFrame()
    print("No event files found - will use date clustering instead")
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

def match_google_review_to_product(review_text, review_title, review_date, name_by_slug, product_by_slug, aliases, events_df=None, date_cluster_map=None):
    """Match Google review text to product using multiple strategies"""
    if not review_text and not review_title:
        return None
    
    combined_text = f"{review_title or ''} {review_text or ''}".strip()
    combined_lower = combined_text.lower()
    
    if not combined_lower:
        return None
    
    # Strategy 0a: Date cluster matching (if review is in a cluster with matched reviews)
    if review_date and pd.notna(review_date) and date_cluster_map:
        # Check if this review date falls within any cluster
        for cluster_date, cluster_product in date_cluster_map.items():
            days_diff = abs((review_date - cluster_date).days)
            if days_diff <= 7:  # Within 7 days of cluster
                if cluster_product and cluster_product in product_by_slug:
                    return cluster_product
    
    # Strategy 0b: Date-based matching with events (highest priority if date available)
    if review_date and pd.notna(review_date) and events_df is not None and len(events_df) > 0:
        # Find events within 14 days of review date
        nearby_events = events_df[
            (events_df['start_date_parsed'] >= review_date - timedelta(days=14)) &
            (events_df['start_date_parsed'] <= review_date + timedelta(days=14))
        ]
        
        if len(nearby_events) > 0:
            best_match = None
            best_score = 0
            
            for event_idx, event_row in nearby_events.iterrows():
                event_title = str(event_row.get('Event_Title', '')).lower()
                event_location = str(event_row.get('Location_Business_Name', '') or event_row.get('Location_Name', '') or '').lower()
                event_url = str(event_row.get('Event_URL', '')).strip()
                
                # Score based on:
                # 1. Text matching (0.4 weight)
                # 2. Date proximity (0.4 weight) - increased importance
                # 3. Location matching (0.2 weight)
                score = 0
                
                # Text matching
                if event_title:
                    title_words = [w for w in event_title.split() if len(w) > 4]
                    matches = sum(1 for word in title_words if word in combined_lower)
                    if matches > 0:
                        score += 0.4 * (matches / max(len(title_words), 1))
                
                # Date proximity (closer = higher score) - more weight
                days_diff = abs((event_row['start_date_parsed'] - review_date).days)
                date_score = 1.0 / (1 + days_diff / 5)  # Decay over 5 days (tighter)
                score += 0.4 * date_score
                
                # Location matching
                if event_location and event_location in combined_lower:
                    score += 0.2
                
                if score > best_score:
                    best_score = score
                    best_match = event_row
            
            # Lower threshold for date-based matching (score > 0.2)
            if best_match is not None and best_score > 0.2:
                event_url = str(best_match.get('Event_URL', '')).strip()
                if event_url:
                    # Extract product slug from event URL
                    event_slug = event_url.split('/')[-1].strip()
                    if event_slug in product_by_slug:
                        return event_slug
    
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

# Build date cluster map: Group reviews by date clusters and match clusters to products
print("Building date clusters for improved matching...")
google_sorted = google_df[google_df['date_parsed'].notna()].sort_values('date_parsed').copy()
date_cluster_map = {}  # Maps cluster center date to product slug

# First pass: Match reviews using text/alias matching
print("First pass: Text-based matching...")
first_pass_matches = {}
for idx, row in google_sorted.iterrows():
    review_text = str(row.get('review', '') or row.get('comment', '') or '').strip()
    review_title = str(row.get('title', '') or '').strip()
    review_date = row.get('date_parsed')
    
    matched_slug = match_google_review_to_product(review_text, review_title, review_date, name_by_slug, product_by_slug, ALIASES, events_df, None)
    if matched_slug:
        first_pass_matches[idx] = matched_slug

print(f"First pass matched: {len(first_pass_matches)} reviews")
print()

# Second pass: Use date clustering to match remaining reviews
print("Second pass: Date cluster matching...")
# Group reviews into date clusters (reviews within 3 days of each other)
clusters = []
current_cluster = []
for idx, row in google_sorted.iterrows():
    if not current_cluster:
        current_cluster = [idx]
    else:
        last_date = google_sorted.loc[current_cluster[-1], 'date_parsed']
        current_date = row['date_parsed']
        if pd.notna(last_date) and pd.notna(current_date):
            if (current_date - last_date).days <= 3:
                current_cluster.append(idx)
            else:
                if len(current_cluster) >= 2:  # Clusters with 2+ reviews
                    clusters.append(current_cluster)
                current_cluster = [idx]
        else:
            current_cluster.append(idx)
if len(current_cluster) >= 2:
    clusters.append(current_cluster)

print(f"Found {len(clusters)} date clusters")
print()

# For each cluster, if any review is matched, assign that product to all reviews in cluster
cluster_assignments = {}
for cluster in clusters:
    cluster_product = None
    cluster_center_date = None
    
    # Check if any review in cluster is already matched
    for review_idx in cluster:
        if review_idx in first_pass_matches:
            cluster_product = first_pass_matches[review_idx]
            cluster_center_date = google_sorted.loc[review_idx, 'date_parsed']
            break
    
    # If cluster has a product, assign it to all reviews in cluster
    if cluster_product:
        for review_idx in cluster:
            cluster_assignments[review_idx] = cluster_product
            if cluster_center_date:
                date_cluster_map[cluster_center_date] = cluster_product

print(f"Date clusters assigned products: {len(cluster_assignments)} reviews")
print()

# Process Google reviews (combine first pass + cluster assignments)
print("Matching Google reviews to products...")
matched_reviews = []
unmatched_count = 0
date_cluster_matched = 0

for idx, row in google_df.iterrows():
    review_text = str(row.get('review', '') or row.get('comment', '') or '').strip()
    review_title = str(row.get('title', '') or '').strip()
    review_date = row.get('date_parsed')
    
    # Check cluster assignment first
    matched_slug = cluster_assignments.get(idx)
    if matched_slug:
        date_cluster_matched += 1
    else:
        # Check first pass match
        matched_slug = first_pass_matches.get(idx)
        if not matched_slug:
            # Try full matching again with date cluster map
            matched_slug = match_google_review_to_product(review_text, review_title, review_date, name_by_slug, product_by_slug, ALIASES, events_df, date_cluster_map)
    
    review_dict = row.to_dict()
    review_dict['source'] = 'Google'
    review_dict['product_slug'] = matched_slug if matched_slug else ''
    review_dict['product_name'] = name_by_slug.get(matched_slug, '') if matched_slug else ''
    
    if matched_slug:
        matched_reviews.append(review_dict)
    else:
        unmatched_count += 1

print(f"Matched: {len(matched_reviews)} reviews")
print(f"  - Text/alias matching: {len(first_pass_matches)}")
print(f"  - Date cluster matching: {date_cluster_matched}")
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

