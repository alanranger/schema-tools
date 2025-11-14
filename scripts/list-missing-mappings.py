#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""List all events missing from mappings CSV for validation"""

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

# Load mappings (find most recent file)
mappings_files = sorted(csv_processed_dir.glob('event-product-mappings-*.csv'), reverse=True)
mappings = pd.read_csv(mappings_files[0]) if mappings_files else pd.DataFrame()
all_events = pd.concat([workshops, lessons], ignore_index=True)

def normalize_url(url):
    """Match JavaScript normalizeUrl function exactly"""
    if pd.isna(url) or not url:
        return ''
    return str(url).lower().strip().rstrip('/')

# Build mappings dictionary
mappings_dict = {}
for idx, mapping in mappings.iterrows():
    event_url_norm = normalize_url(mapping['event_url'])
    product_url_norm = normalize_url(mapping['product_url'])
    if event_url_norm and product_url_norm:
        mappings_dict[event_url_norm] = {
            'price': mapping['price_gbp'] if pd.notna(mapping['price_gbp']) else None,
            'product_url': mapping['product_url']
        }

# Filter events (simulate JavaScript filtering)
today = datetime.now().strftime('%Y-%m-%d')
filtered_events = all_events[
    (all_events['Workflow_State'] == 'Published') &
    (all_events['Start_Date'] >= today)
]

# Find events without mappings
unmapped_events = []
for idx, event in filtered_events.iterrows():
    event_url_norm = normalize_url(event['Event_URL'])
    if event_url_norm not in mappings_dict:
        unmapped_events.append({
            'title': event['Event_Title'],
            'url': event['Event_URL'],
            'start_date': event['Start_Date'],
            'category': event.get('Category', 'N/A')
        })

print("=" * 80)
print("EVENTS MISSING FROM MAPPINGS CSV")
print("=" * 80)
print(f"\nTotal events after filtering: {len(filtered_events)}")
print(f"Events with mappings: {len(filtered_events) - len(unmapped_events)}")
print(f"Events WITHOUT mappings: {len(unmapped_events)}")
print(f"\nGoogle reported: 27 events with missing offers")
print(f"Found: {len(unmapped_events)} events without mappings\n")

print("=" * 80)
print("LIST OF EVENTS MISSING MAPPINGS")
print("=" * 80)

# Group by category for easier validation
workshop_events = [e for e in unmapped_events if 'photographic-workshops-near-me' in e['url']]
lesson_events = [e for e in unmapped_events if 'beginners-photography-lessons' in e['url']]

print(f"\n📸 WORKSHOP EVENTS ({len(workshop_events)}):")
for i, event in enumerate(workshop_events, 1):
    print(f"\n{i}. {event['title']}")
    print(f"   URL: {event['url']}")
    print(f"   Start Date: {event['start_date']}")
    print(f"   Category: {event['category']}")

print(f"\n\n📚 LESSON EVENTS ({len(lesson_events)}):")
for i, event in enumerate(lesson_events, 1):
    print(f"\n{i}. {event['title']}")
    print(f"   URL: {event['url']}")
    print(f"   Start Date: {event['start_date']}")
    print(f"   Category: {event['category']}")

# Also output as CSV-friendly format
print("\n\n" + "=" * 80)
print("CSV-FRIENDLY FORMAT (for validation)")
print("=" * 80)
print("\nEvent_Title,Event_URL,Start_Date,Category")
for event in unmapped_events:
    title = event['title'].replace(',', ';')  # Replace commas to avoid CSV issues
    url = event['url']
    date = event['start_date']
    category = str(event['category']).replace(',', ';')
    print(f"{title},{url},{date},{category}")

# Check for Batsford specifically
print("\n\n" + "=" * 80)
print("BATSFORD EVENTS BREAKDOWN")
print("=" * 80)
batsford_unmapped = [e for e in unmapped_events if 'batsford' in e['title'].lower() or 'batsford' in e['url'].lower()]
batsford_mapped = []
for idx, event in filtered_events.iterrows():
    if 'batsford' in event['Event_Title'].lower() or 'batsford' in event['Event_URL'].lower():
        event_url_norm = normalize_url(event['Event_URL'])
        if event_url_norm in mappings_dict:
            batsford_mapped.append(event['Event_Title'])

print(f"\nBatsford events WITH mappings: {len(batsford_mapped)}")
for title in batsford_mapped:
    print(f"  ✅ {title}")

print(f"\nBatsford events WITHOUT mappings: {len(batsford_unmapped)}")
for event in batsford_unmapped:
    print(f"  ❌ {event['title']}")
    print(f"     URL: {event['url']}")


