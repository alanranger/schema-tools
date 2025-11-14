#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Verify the new mappings file covers all events"""

import pandas as pd
import sys
from datetime import datetime
from pathlib import Path

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Updated to use shared-resources structure
script_dir = Path(__file__).parent
project_root = script_dir.parent
shared_resources_dir = project_root.parent / 'alan-shared-resources'
csv_dir = shared_resources_dir / 'csv'
csv_processed_dir = shared_resources_dir / 'csv processed'

# Load events CSVs from csv root (handle original Squarespace export filenames)
# Find workshops CSV (matches pattern: *photographic-workshops-near-me*)
workshops_files = list(csv_dir.glob('*photographic-workshops-near-me*.csv'))
if not workshops_files:
    workshops_files = list(csv_dir.glob('*workshops*.csv'))
workshops = pd.read_csv(workshops_files[0]) if workshops_files else pd.DataFrame()

# Find lessons CSV (matches pattern: *beginners-photography-lessons*)
lessons_files = list(csv_dir.glob('*beginners-photography-lessons*.csv'))
if not lessons_files:
    lessons_files = list(csv_dir.glob('*lessons*.csv'))
lessons = pd.read_csv(lessons_files[0]) if lessons_files else pd.DataFrame()
all_events = pd.concat([workshops, lessons], ignore_index=True)

# Load new mappings CSV from csv processed
# Note: This script uses a hardcoded timestamp - update as needed
new_mappings = pd.read_csv(csv_processed_dir / 'event-product-mappings-2025-11-10T14-23-49-474Z.csv')

def normalize_url(url):
    """Match JavaScript normalizeUrl function exactly"""
    if pd.isna(url) or not url:
        return None
    return str(url).lower().strip().rstrip('/')

# Build mappings dictionary
mappings_dict = {}
for idx, mapping in new_mappings.iterrows():
    event_url_norm = normalize_url(mapping['event_url'])
    product_url_norm = normalize_url(mapping['product_url'])
    if event_url_norm and product_url_norm:
        mappings_dict[event_url_norm] = {
            'price': mapping['price_gbp'] if pd.notna(mapping['price_gbp']) else None,
            'product_url': mapping['product_url'],
            'price_gbp': mapping['price_gbp'] if pd.notna(mapping['price_gbp']) else 0
        }

# Filter events (simulate JavaScript filtering)
today = datetime.now().strftime('%Y-%m-%d')
filtered_events = all_events[
    (all_events['Workflow_State'] == 'Published') &
    (all_events['Start_Date'] >= today)
]

# Find events without mappings
unmapped_events = []
mapped_events = []
events_with_zero_price = []

for idx, event in filtered_events.iterrows():
    event_url_norm = normalize_url(event['Event_URL'])
    if event_url_norm in mappings_dict:
        mapping = mappings_dict[event_url_norm]
        mapped_events.append({
            'title': event['Event_Title'],
            'url': event['Event_URL'],
            'price': mapping['price_gbp'],
            'product_url': mapping['product_url']
        })
        if mapping['price_gbp'] == 0 or pd.isna(mapping['price_gbp']):
            events_with_zero_price.append({
                'title': event['Event_Title'],
                'url': event['Event_URL'],
                'price': mapping['price_gbp']
            })
    else:
        unmapped_events.append({
            'title': event['Event_Title'],
            'url': event['Event_URL'],
            'start_date': event['Start_Date'],
            'category': event.get('Category', 'N/A')
        })

print("=" * 80)
print("NEW MAPPINGS FILE VERIFICATION")
print("=" * 80)
print(f"\nMappings file: event-product-mappings-2025-11-10T14-23-49-474Z.csv")
print(f"   Total rows: {len(new_mappings)}")
print(f"   Unique event URLs: {new_mappings['event_url'].nunique()}")

print(f"\nEvents CSV Analysis:")
print(f"   Total events: {len(all_events)}")
print(f"   Workshops: {len(workshops)}, Lessons: {len(lessons)}")
print(f"   Published future events: {len(filtered_events)}")

print(f"\n" + "=" * 80)
print("COVERAGE ANALYSIS")
print("=" * 80)
print(f"\n✅ Events WITH mappings: {len(mapped_events)}")
print(f"❌ Events WITHOUT mappings: {len(unmapped_events)}")
print(f"⚠️  Events with price = 0: {len(events_with_zero_price)}")

if len(unmapped_events) > 0:
    print(f"\n" + "=" * 80)
    print("EVENTS STILL MISSING MAPPINGS")
    print("=" * 80)
    for i, event in enumerate(unmapped_events, 1):
        print(f"\n{i}. {event['title']}")
        print(f"   URL: {event['url']}")
        print(f"   Start Date: {event['start_date']}")
        print(f"   Category: {event['category']}")
else:
    print(f"\n✅ SUCCESS: All {len(filtered_events)} published future events have mappings!")

if len(events_with_zero_price) > 0:
    print(f"\n" + "=" * 80)
    print("EVENTS WITH PRICE = 0 (DATA ERROR)")
    print("=" * 80)
    print(f"\n⚠️  These events have mappings but price = 0 (will be logged as data error):")
    for i, event in enumerate(events_with_zero_price, 1):
        print(f"\n{i}. {event['title']}")
        print(f"   URL: {event['url']}")
        print(f"   Price: {event['price']}")
else:
    print(f"\n✅ SUCCESS: All mapped events have valid prices (> 0)!")

# Check for duplicates in mappings
duplicate_urls = new_mappings[new_mappings.duplicated(subset=['event_url'], keep=False)]
if len(duplicate_urls) > 0:
    print(f"\n" + "=" * 80)
    print("DUPLICATE EVENT URLS IN MAPPINGS")
    print("=" * 80)
    print(f"\n⚠️  Found {len(duplicate_urls)} duplicate event URLs:")
    for url in duplicate_urls['event_url'].unique():
        dup_rows = duplicate_urls[duplicate_urls['event_url'] == url]
        print(f"\n   URL: {url}")
        print(f"   Occurrences: {len(dup_rows)}")
        for idx, row in dup_rows.iterrows():
            print(f"      - Price: {row['price_gbp']}, Product: {row['product_url']}")
else:
    print(f"\n✅ SUCCESS: No duplicate event URLs in mappings file!")

# Summary
print(f"\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"\n📊 Coverage: {len(mapped_events)}/{len(filtered_events)} events mapped ({len(mapped_events)/len(filtered_events)*100:.1f}%)")
print(f"💰 Price coverage: {len(mapped_events) - len(events_with_zero_price)}/{len(mapped_events)} with valid prices ({((len(mapped_events) - len(events_with_zero_price))/len(mapped_events)*100) if len(mapped_events) > 0 else 0:.1f}%)")
print(f"🔄 Duplicates: {len(duplicate_urls)} duplicate event URLs")

if len(unmapped_events) == 0 and len(events_with_zero_price) == 0 and len(duplicate_urls) == 0:
    print(f"\n🎉 PERFECT: All events mapped with valid prices and no duplicates!")
elif len(unmapped_events) == 0:
    print(f"\n✅ All events are mapped! (Some have price = 0 or duplicates to review)")

