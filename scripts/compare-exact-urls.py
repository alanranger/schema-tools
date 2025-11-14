#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Compare exact URLs between events CSV and mappings CSV"""

import pandas as pd
import sys
from pathlib import Path

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Updated to use shared-resources structure
script_dir = Path(__file__).parent
project_root = script_dir.parent
shared_resources_dir = project_root.parent / 'alan-shared-resources'
csv_dir = shared_resources_dir / 'csv'
csv_processed_dir = shared_resources_dir / 'csv processed'

# Load data (handle original Squarespace export filenames)
workshops_files = list(csv_dir.glob('*photographic-workshops-near-me*.csv'))
workshops = pd.read_csv(workshops_files[0]) if workshops_files else pd.DataFrame()

lessons_files = list(csv_dir.glob('*beginners-photography-lessons*.csv'))
lessons = pd.read_csv(lessons_files[0]) if lessons_files else pd.DataFrame()

mappings_files = sorted(csv_processed_dir.glob('event-product-mappings-*.csv'), reverse=True)
mappings = pd.read_csv(mappings_files[0]) if mappings_files else pd.DataFrame()
all_events = pd.concat([workshops, lessons], ignore_index=True)

def normalize_url(url):
    """Match JavaScript normalizeUrl function exactly"""
    if pd.isna(url) or not url:
        return ''
    return str(url).lower().strip().rstrip('/')

print("=" * 80)
print("EXACT URL COMPARISON")
print("=" * 80)

# Check Batsford events specifically
print("\n1. BATSFORD EVENTS - EXACT URL COMPARISON:")
batsford_events = all_events[all_events['Event_Title'].str.contains('Batsford', case=False, na=False)]

for idx, row in batsford_events.iterrows():
    event_url = row['Event_URL']
    event_norm = normalize_url(event_url)
    
    # Check exact match
    exact_match = mappings[mappings['event_url'].apply(normalize_url) == event_norm]
    
    print(f"\n  {row['Event_Title']}")
    print(f"    Event CSV URL: {event_url}")
    print(f"    Normalized:    {event_norm}")
    
    if len(exact_match) > 0:
        print(f"    ✅ EXACT MATCH FOUND")
        print(f"    Price: {exact_match.iloc[0]['price_gbp']}")
    else:
        print(f"    ❌ NO EXACT MATCH")
        # Check for similar URLs in mappings
        slug = event_url.split('/')[-1]
        similar = mappings[mappings['event_url'].str.contains(slug[:40], case=False, na=False)]
        if len(similar) > 0:
            print(f"    ⚠️ Similar URLs in mappings:")
            for _, sim_row in similar.head(3).iterrows():
                print(f"       - {sim_row['event_url']} (Price: {sim_row['price_gbp']})")
        else:
            print(f"    ⚠️ No similar URLs found")

# Check Camera Courses
print("\n\n2. CAMERA COURSES - EXACT URL COMPARISON:")
camera_events = all_events[all_events['Event_Title'].str.contains('Camera Courses For Beginners.*Week 1', case=False, na=False)]

for idx, row in camera_events.head(5).iterrows():
    event_url = row['Event_URL']
    event_norm = normalize_url(event_url)
    
    exact_match = mappings[mappings['event_url'].apply(normalize_url) == event_norm]
    
    print(f"\n  {row['Event_Title']}")
    print(f"    Event CSV URL: {event_url}")
    print(f"    Normalized:    {event_norm}")
    
    if len(exact_match) > 0:
        print(f"    ✅ EXACT MATCH FOUND")
        print(f"    Price: {exact_match.iloc[0]['price_gbp']}")
    else:
        print(f"    ❌ NO EXACT MATCH")
        slug = event_url.split('/')[-1]
        similar = mappings[mappings['event_url'].str.contains(slug[:40], case=False, na=False)]
        if len(similar) > 0:
            print(f"    ⚠️ Similar URLs in mappings:")
            for _, sim_row in similar.head(2).iterrows():
                print(f"       - {sim_row['event_url']} (Price: {sim_row['price_gbp']})")

# Check the buildMappingsDict logic - does it handle duplicates correctly?
print("\n\n3. MAPPINGS DICTIONARY BUILD LOGIC CHECK:")
print("   JavaScript code: dict[eventUrl] = {...}")
print("   If same event_url appears multiple times, LAST entry overwrites")
print("\n   Checking if duplicates cause issues...")

# Simulate the JavaScript logic
mappings_dict = {}
for idx, mapping in mappings.iterrows():
    event_url_norm = normalize_url(mapping['event_url'])
    if event_url_norm and pd.notna(mapping['product_url']):
        mappings_dict[event_url_norm] = {
            'price': mapping['price_gbp'] if pd.notna(mapping['price_gbp']) else None,
            'product_url': mapping['product_url']
        }

print(f"   Unique event URLs in dict: {len(mappings_dict)}")
print(f"   Total mappings rows: {len(mappings)}")

# Check if any events that SHOULD match are missing
print("\n\n4. EVENTS THAT SHOULD MATCH BUT DON'T:")
matched_count = 0
unmatched_count = 0
unmatched_examples = []

for idx, event in all_events.iterrows():
    event_url_norm = normalize_url(event['Event_URL'])
    if event_url_norm in mappings_dict:
        matched_count += 1
    else:
        unmatched_count += 1
        if len(unmatched_examples) < 10:
            unmatched_examples.append({
                'title': event['Event_Title'],
                'url': event['Event_URL'],
                'url_norm': event_url_norm
            })

print(f"   Matched: {matched_count}/{len(all_events)}")
print(f"   Unmatched: {unmatched_count}/{len(all_events)}")
print("\n   Unmatched examples:")
for ex in unmatched_examples:
    print(f"     - {ex['title']}")
    print(f"       URL: {ex['url']}")
    # Check if there's a similar URL in mappings
    slug = ex['url'].split('/')[-1]
    similar = mappings[mappings['event_url'].str.contains(slug[:30], case=False, na=False)]
    if len(similar) > 0:
        print(f"       ⚠️ Found similar: {similar.iloc[0]['event_url']}")


