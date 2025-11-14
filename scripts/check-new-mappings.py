#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Check if new mappings file includes all previously missing events"""

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

# Load data (handle original Squarespace export filenames)
workshops_files = list(csv_dir.glob('*photographic-workshops-near-me*.csv'))
workshops = pd.read_csv(workshops_files[0]) if workshops_files else pd.DataFrame()

lessons_files = list(csv_dir.glob('*beginners-photography-lessons*.csv'))
lessons = pd.read_csv(lessons_files[0]) if lessons_files else pd.DataFrame()

# Load mappings (find most recent files)
old_mappings_files = sorted(csv_processed_dir.glob('event-product-mappings-2025-11-08*.csv'))
old_mappings = pd.read_csv(old_mappings_files[0]) if old_mappings_files else pd.DataFrame()

new_mappings_files = sorted(csv_processed_dir.glob('event-product-mappings-2025-11-10*.csv'))
new_mappings = pd.read_csv(new_mappings_files[0]) if new_mappings_files else pd.DataFrame()
all_events = pd.concat([workshops, lessons], ignore_index=True)

def normalize_url(url):
    """Match JavaScript normalizeUrl function exactly"""
    if pd.isna(url) or not url:
        return ''
    return str(url).lower().strip().rstrip('/')

# Build old and new mappings dictionaries
old_mappings_dict = {}
for idx, mapping in old_mappings.iterrows():
    event_url_norm = normalize_url(mapping['event_url'])
    product_url_norm = normalize_url(mapping['product_url'])
    if event_url_norm and product_url_norm:
        old_mappings_dict[event_url_norm] = {
            'price': mapping['price_gbp'] if pd.notna(mapping['price_gbp']) else None,
            'product_url': mapping['product_url']
        }

new_mappings_dict = {}
for idx, mapping in new_mappings.iterrows():
    event_url_norm = normalize_url(mapping['event_url'])
    product_url_norm = normalize_url(mapping['product_url'])
    if event_url_norm and product_url_norm:
        new_mappings_dict[event_url_norm] = {
            'price': mapping['price_gbp'] if pd.notna(mapping['price_gbp']) else None,
            'product_url': mapping['product_url']
        }

# Filter events (simulate JavaScript filtering)
today = datetime.now().strftime('%Y-%m-%d')
filtered_events = all_events[
    (all_events['Workflow_State'] == 'Published') &
    (all_events['Start_Date'] >= today)
]

# Find events that were missing in old mappings
previously_missing = []
for idx, event in filtered_events.iterrows():
    event_url_norm = normalize_url(event['Event_URL'])
    if event_url_norm not in old_mappings_dict:
        previously_missing.append({
            'title': event['Event_Title'],
            'url': event['Event_URL'],
            'url_norm': event_url_norm,
            'start_date': event['Start_Date'],
            'category': event.get('Category', 'N/A')
        })

print("=" * 80)
print("MAPPINGS FILE COMPARISON")
print("=" * 80)
print(f"\nOld mappings file: event-product-mappings-2025-11-08T21-21-59-228Z.csv")
print(f"   Total rows: {len(old_mappings)}")
print(f"   Unique event URLs: {old_mappings['event_url'].nunique()}")

print(f"\nNew mappings file: event-product-mappings-2025-11-10T11-44-25-698Z.csv")
print(f"   Total rows: {len(new_mappings)}")
print(f"   Unique event URLs: {new_mappings['event_url'].nunique()}")

print(f"\nPreviously missing events: {len(previously_missing)}")

# Check which previously missing events are now in new mappings
now_included = []
still_missing = []

for event in previously_missing:
    if event['url_norm'] in new_mappings_dict:
        now_included.append(event)
    else:
        still_missing.append(event)

print(f"\n✅ Now included in new mappings: {len(now_included)}")
print(f"❌ Still missing from new mappings: {len(still_missing)}")

# Check for duplicates in new mappings
print("\n\n" + "=" * 80)
print("DUPLICATE CHECK IN NEW MAPPINGS")
print("=" * 80)
duplicates = new_mappings[new_mappings.duplicated(subset=['event_url'], keep=False)]
if len(duplicates) > 0:
    print(f"⚠️ Found {len(duplicates)} duplicate event_url entries")
    duplicate_urls = duplicates['event_url'].unique()
    print(f"   {len(duplicate_urls)} unique URLs with duplicates")
    print("\n   Examples:")
    for url in duplicate_urls[:5]:
        dup_rows = duplicates[duplicates['event_url'] == url]
        print(f"     - {url}: {len(dup_rows)} duplicate rows")
else:
    print("✅ No duplicates found - all event URLs are unique")

# Batsford specific check
print("\n\n" + "=" * 80)
print("BATSFORD EVENTS CHECK")
print("=" * 80)
batsford_events = filtered_events[filtered_events['Event_Title'].str.contains('Batsford', case=False, na=False)]
batsford_new = new_mappings[new_mappings['event_url'].str.contains('batsford', case=False, na=False)]

print(f"\nBatsford events in CSV: {len(batsford_events)}")
print(f"Batsford entries in new mappings: {len(batsford_new)} rows")
print(f"Unique Batsford URLs in new mappings: {batsford_new['event_url'].nunique()}")

print("\nBatsford events status:")
for idx, event in batsford_events.iterrows():
    event_url_norm = normalize_url(event['Event_URL'])
    in_old = event_url_norm in old_mappings_dict
    in_new = event_url_norm in new_mappings_dict
    price = new_mappings_dict[event_url_norm]['price'] if in_new else None
    
    status_old = "✅" if in_old else "❌"
    status_new = "✅" if in_new else "❌"
    
    print(f"\n  {event['Event_Title']}")
    print(f"    URL: {event['Event_URL']}")
    print(f"    Old mappings: {status_old} | New mappings: {status_new}")
    if in_new:
        print(f"    Price: {price}")

# Detailed list of still missing events
if still_missing:
    print("\n\n" + "=" * 80)
    print("EVENTS STILL MISSING FROM NEW MAPPINGS")
    print("=" * 80)
    for i, event in enumerate(still_missing, 1):
        print(f"\n{i}. {event['title']}")
        print(f"   URL: {event['url']}")
        print(f"   Start Date: {event['start_date']}")

# Summary
print("\n\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"Total events after filtering: {len(filtered_events)}")
print(f"Events with mappings (old): {len(filtered_events) - len(previously_missing)}")
print(f"Events with mappings (new): {len(filtered_events) - len(still_missing)}")
print(f"Previously missing: {len(previously_missing)}")
print(f"Now fixed: {len(now_included)}")
print(f"Still missing: {len(still_missing)}")

if len(still_missing) == 0:
    print("\n🎉 SUCCESS! All previously missing events are now included!")
else:
    print(f"\n⚠️ {len(still_missing)} events still need mappings")


