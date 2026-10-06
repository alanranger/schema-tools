#!/usr/bin/env python3
"""
Dedicated Google Review Matcher
Optimized matching logic specifically for Google reviews using:
1. Date-based matching (reviews clustered around event dates)
2. Text content matching
3. Alias matching

Reads:
  - shared-resources/csv/raw-03b-google-reviews.csv
  - shared-resources/csv processed/02 ÔÇô products_cleaned.xlsx
  - shared-resources/csv/*photographic-workshops-near-me*.csv or *photo-workshops-uk-landscape*.csv
  - shared-resources/csv/*beginners-photography-lessons*.csv or *photography-services-courses-mentoring*.csv

Outputs:
  - shared-resources/csv processed/03b_google_matched.csv
"""

import pandas as pd
from pathlib import Path
import re
import sys
from difflib import SequenceMatcher
from datetime import timedelta

# Updated to use shared-resources structure
script_dir = Path(__file__).parent
project_root = script_dir.parent
shared_resources_dir = project_root.parent / 'alan-shared-resources'
csv_dir = shared_resources_dir / 'csv'
csv_processed_dir = shared_resources_dir / 'csv processed'
csv_processed_dir.mkdir(parents=True, exist_ok=True)

# Find Google reviews CSV
google_path = None
if csv_dir.exists():
    for csv_file in csv_dir.glob('*google*.csv'):
        if 'raw-03b' in csv_file.name.lower() or 'google' in csv_file.name.lower():
            google_path = csv_file
            break

if not google_path or not google_path.exists():
    print("Error: Google reviews CSV not found")
    print(f"   Expected: {csv_dir.absolute()}/raw-03b-google-reviews.csv")
    sys.exit(1)

# Products file
products_path = csv_processed_dir / '02 – products_cleaned.xlsx'
if not products_path.exists():
    # Fallback: glob for en-dash / hyphen variants Dropbox may normalize differently
    hits = list(csv_processed_dir.glob('02*products_cleaned.xlsx'))
    hits = [h for h in hits if 'backup' not in h.name.lower()]
    if hits:
        products_path = hits[0]

# Find event CSV files using flexible filename matching
events_workshops_path = None
events_lessons_path = None
if csv_dir.exists():
    # Check for workshop CSVs
    for csv_file in csv_dir.glob('*.csv'):
        csv_name_lower = csv_file.name.lower()
        if ('photographic-workshops-near-me' in csv_name_lower or
            'photo-workshops-uk-landscape' in csv_name_lower or
            ('workshop' in csv_name_lower and 'lesson' not in csv_name_lower and '03' in csv_name_lower)):
            events_workshops_path = csv_file
            break
    
    # Check for lessons CSVs
    for csv_file in csv_dir.glob('*.csv'):
        csv_name_lower = csv_file.name.lower()
        if ('beginners-photography-lessons' in csv_name_lower or
            'photography-services-courses-mentoring' in csv_name_lower or
            ('lesson' in csv_name_lower and 'workshop' not in csv_name_lower and '02' in csv_name_lower)):
            events_lessons_path = csv_file
            break

output_path = csv_processed_dir / "03b_google_matched.csv"

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
    'macro': 'abstract-and-macro-photography-workshops',
    'macro photography': 'abstract-and-macro-photography-workshops',
    'abstract and macro': 'abstract-and-macro-photography-workshops',
    'abstract macro': 'abstract-and-macro-photography-workshops',
    'macro abstract': 'abstract-and-macro-photography-workshops',
    'northumberland': 'coastal-northumberland-photography-workshops',
    'coastal northumberland': 'coastal-northumberland-photography-workshops',
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
    'rps mentoring': 'rps-mentoring-photography-course',
    'rps course': 'rps-mentoring-photography-course',
    'royal photographic': 'rps-mentoring-photography-course',
    'lrps': 'rps-mentoring-photography-course',
    'distinction panel': 'rps-mentoring-photography-course',
    'distinction qualification': 'rps-mentoring-photography-course',
    'distinction submission': 'rps-mentoring-photography-course',
    'working towards a distinction': 'rps-mentoring-photography-course',
}

def fuzzy_match(text1, text2):
    """Calculate similarity ratio between two texts"""
    return SequenceMatcher(None, str(text1).lower(), str(text2).lower()).ratio()

def match_google_review_to_product(review_text, review_title, review_date, name_by_slug, product_by_slug, aliases, events_df=None, date_cluster_map=None):
    """Match Google review: TEXT/alias first; date cluster/events only as fallback."""
    if not review_text and not review_title:
        return None

    combined_text = f"{review_title or ''} {review_text or ''}".strip()
    combined_lower = combined_text.lower()
    if not combined_lower:
        return None

    # Strategy 1: aliases (longest first)
    for alias_key, alias_slug in sorted(aliases.items(), key=lambda x: len(x[0]), reverse=True):
        if alias_key in combined_lower and alias_slug in product_by_slug:
            return alias_slug

    # Strategy 2: keyword overlap with product names
    key_words = []
    generic_words = {
        'photography', 'workshop', 'workshops', 'course', 'courses', 'class', 'classes',
        'photo', 'photographic', 'great', 'excellent', 'good', 'amazing', 'wonderful',
        'recommend', 'recommended', 'highly', 'very', 'really', 'much', 'many', 'some',
        'alan', 'ranger', 'service', 'experience', 'would', 'definitely', 'again'
    }
    location_words = [
        'glencoe', 'anglesey', 'gower', 'yorkshire', 'dales', 'devon', 'peak', 'district',
        'lake', 'batsford', 'arboretum', 'urban', 'architecture', 'coventry', 'kenilworth',
        'ireland', 'kerry', 'dartmoor', 'norfolk', 'suffolk', 'northumberland', 'wales',
        'woodland', 'woodlands', 'snowdonia', 'poppy', 'sunflower', 'brandon', 'marsh',
        'beginners', 'lightroom', 'macro', 'christmas', 'fireworks', 'exmoor', 'sezincote',
        'lavender', 'bluebell', 'fairy', 'glen', 'chesterton', 'windmill', 'north', 'south',
        'east', 'west', 'coastal', 'landscape', 'portrait', 'long', 'exposure', 'garden',
        'canvas', 'prints', 'mentoring', 'sensor', 'clean', 'rps', 'academy', 'masterclass'
    ]
    for word in combined_lower.split():
        word_clean = word.strip('.,!?;:()[]{}')
        if len(word_clean) > 4 and word_clean not in generic_words:
            key_words.append(word_clean)
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
                if score > best_score and score >= 0.5:
                    best_score = score
                    best_match = slug
        if best_match:
            return best_match

    # Strategy 3: fuzzy product name
    best_match = None
    best_ratio = 0.0
    for slug, name in name_by_slug.items():
        ratio = fuzzy_match(combined_text, name)
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = slug
    if best_ratio >= 0.55:
        return best_match

    # Strategy 4: date-cluster fallback (±7 days) — never overrides text
    if review_date and pd.notna(review_date) and date_cluster_map:
        for cluster_date, cluster_product in date_cluster_map.items():
            days_diff = abs((review_date - cluster_date).days)
            if days_diff <= 7 and cluster_product and cluster_product in product_by_slug:
                return cluster_product

    # Strategy 5: nearby events (±30 days) requiring text/location signal
    if review_date and pd.notna(review_date) and events_df is not None and len(events_df) > 0:
        nearby_events = events_df[
            (events_df['start_date_parsed'] >= review_date - timedelta(days=30)) &
            (events_df['start_date_parsed'] <= review_date + timedelta(days=30))
        ]
        best_event = None
        best_score = 0.0
        for _, event_row in nearby_events.iterrows():
            event_title = str(event_row.get('Event_Title', '')).lower()
            event_location = str(
                event_row.get('Location_Business_Name', '')
                or event_row.get('Location_Name', '')
                or ''
            ).lower()
            score = 0.0
            if event_title:
                title_words = [w for w in event_title.split() if len(w) > 4]
                matches = sum(1 for word in title_words if word in combined_lower)
                if matches > 0:
                    score += 0.5 * (matches / max(len(title_words), 1))
            days_diff = abs((event_row['start_date_parsed'] - review_date).days)
            score += 0.3 / (1 + days_diff / 14)
            if event_location and event_location in combined_lower:
                score += 0.2
            if score > best_score and score >= 0.35:
                best_score = score
                best_event = event_row
        if best_event is not None:
            event_url = str(best_event.get('Event_URL', '')).strip()
            if event_url:
                event_slug = event_url.split('/')[-1].strip()
                if event_slug in product_by_slug:
                    return event_slug

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
# NAME-FIRST overrides from curated attributions (Alan-approved / booking-led)
curated_path = csv_processed_dir / "14-google-curated-attributions.csv"
name_date_overrides = {}
if curated_path.exists():
    cdf = pd.read_csv(curated_path, encoding="utf-8-sig")
    for _, cr in cdf.iterrows():
        rn = str(cr.get("reviewer_name") or "").strip().lower()
        rd = str(cr.get("review_date") or "")[:10]
        slug = str(cr.get("product_slug") or "").strip()
        if rn and rd and slug:
            name_date_overrides[f"{rn}|{rd}"] = slug
    print(f"Loaded {len(name_date_overrides)} curated name+date overrides from 14-…")

print("Matching Google reviews to products...")
all_reviews = []
matched_count = 0
unmatched_count = 0
date_cluster_matched = 0
curated_matched = 0

for idx, row in google_df.iterrows():
    review_text = str(row.get('review', '') or row.get('comment', '') or '').strip()
    review_title = str(row.get('title', '') or '').strip()
    review_date = row.get('date_parsed')
    reviewer = str(row.get('reviewer', '') or '').strip()

    # NAME FIRST: curated / approved booking attributions
    matched_slug = None
    ov_key = f"{reviewer.lower()}|{str(row.get('date', ''))[:10]}"
    if ov_key in name_date_overrides:
        matched_slug = name_date_overrides[ov_key]
        curated_matched += 1

    # Prefer text/alias first-pass matches; date clusters only fill gaps.
    if not matched_slug:
        matched_slug = first_pass_matches.get(idx)
    if not matched_slug:
        matched_slug = cluster_assignments.get(idx)
        if matched_slug:
            date_cluster_matched += 1
    if not matched_slug:
        matched_slug = match_google_review_to_product(
            review_text, review_title, review_date, name_by_slug, product_by_slug, ALIASES, events_df, date_cluster_map
        )

    review_dict = row.to_dict()
    review_dict['source'] = 'Google'
    review_dict['product_slug'] = matched_slug if matched_slug else ''
    review_dict['product_name'] = name_by_slug.get(matched_slug, '') if matched_slug else ''
    all_reviews.append(review_dict)
    if matched_slug:
        matched_count += 1
    else:
        unmatched_count += 1

print(f"Matched: {matched_count} reviews")
print(f"  - Curated name+date: {curated_matched}")
print(f"  - Text/alias matching: {len(first_pass_matches)}")
print(f"  - Date cluster matching: {date_cluster_matched}")
print(f"Unmatched (still written): {unmatched_count} reviews")
print()

# Save ALL reviews (matched + unmatched) — fixes prior leak that dropped ~44 text rows
out_df = pd.DataFrame(all_reviews)

# Highest-priority durable overrides (Alan-approved). Applied AFTER matcher.
# File: csv processed/15-review-attribution-overrides.csv
overrides_path = csv_processed_dir / "15-review-attribution-overrides.csv"
if overrides_path.exists() and len(out_df):
    odf = pd.read_csv(overrides_path, encoding="utf-8-sig")
    applied = 0
    for _, ov in odf.iterrows():
        rn = str(ov.get("reviewer_name") or "").strip().lower()
        rd = str(ov.get("review_date") or "")[:10]
        scope = str(ov.get("scope") or "product").strip().lower()
        slug = "" if pd.isna(ov.get("product_slug")) else str(ov.get("product_slug")).strip()
        if not rn:
            continue
        mask = out_df["reviewer"].astype(str).str.strip().str.lower() == rn
        if rd:
            mask = mask & (out_df["date"].astype(str).str[:10] == rd)
        if not mask.any():
            continue
        if scope == "business_level" or not slug:
            out_df.loc[mask, "product_slug"] = ""
            out_df.loc[mask, "product_name"] = ""
            out_df.loc[mask, "attribution_source"] = "override_business_level"
        else:
            out_df.loc[mask, "product_slug"] = slug
            out_df.loc[mask, "product_name"] = name_by_slug.get(slug, out_df.loc[mask, "product_name"])
            out_df.loc[mask, "attribution_source"] = "override_15_attribution"
        applied += int(mask.sum())
    print(f"Applied {applied} durable override row-hits from 15-review-attribution-overrides.csv")

out_df.to_csv(output_path, index=False, encoding='utf-8-sig')
print(f"Saved {len(out_df)} Google reviews to {output_path.name} (includes unmatched)")

print("="*80)
print("GOOGLE MATCHING COMPLETE")
print("="*80)

