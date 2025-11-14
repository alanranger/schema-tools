#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Diagnose URL matching between events CSV and mappings CSV"""

import pandas as pd
import sys
from pathlib import Path

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

workflow_dir = Path('inputs-files/workflow')

# Load data
workshops = pd.read_csv(workflow_dir / '03 - www-alanranger-com__5013f4b2c4aaa4752ac69b17__photographic-workshops-near-me.csv')
lessons = pd.read_csv(workflow_dir / '02 - www-alanranger-com__5013f4b2c4aaa4752ac69b17__beginners-photography-lessons.csv')
mappings = pd.read_csv(workflow_dir / 'event-product-mappings-2025-11-08T21-21-59-228Z.csv')
all_events = pd.concat([workshops, lessons], ignore_index=True)

def normalize_url(url):
    """Match JavaScript normalizeUrl function"""
    if pd.isna(url) or not url:
        return ''
    return str(url).lower().strip().rstrip('/')

# Normalize URLs
mappings['event_url_norm'] = mappings['event_url'].apply(normalize_url)
all_events['event_url_norm'] = all_events['Event_URL'].apply(normalize_url)

# Check specific events mentioned by Google
print("=" * 80)
print("URL MATCHING DIAGNOSTIC")
print("=" * 80)

# Batsford events
print("\n1. BATSFORD EVENTS:")
batsford_events = all_events[all_events['Event_Title'].str.contains('Batsford', case=False, na=False)]
for idx, row in batsford_events.iterrows():
    event_url = row['Event_URL']
    event_norm = normalize_url(event_url)
    matching = mappings[mappings['event_url_norm'] == event_norm]
    status = "✅ MATCHED" if len(matching) > 0 else "❌ NOT MATCHED"
    price = matching.iloc[0]['price_gbp'] if len(matching) > 0 else "N/A"
    print(f"\n  {row['Event_Title']}")
    print(f"    Event URL: {event_url}")
    print(f"    Normalized: {event_norm}")
    print(f"    Status: {status}")
    if len(matching) > 0:
        print(f"    Price: {price}")
    else:
        # Check for similar URLs
        slug = event_url.split('/')[-1]
        similar = mappings[mappings['event_url'].str.contains(slug[:30], case=False, na=False)]
        if len(similar) > 0:
            print(f"    ⚠️ Similar URL in mappings: {similar.iloc[0]['event_url']}")

# Camera Courses events
print("\n\n2. CAMERA COURSES EVENTS:")
camera_events = all_events[all_events['Event_Title'].str.contains('Camera Courses For Beginners.*Week 1', case=False, na=False)]
for idx, row in camera_events.head(5).iterrows():
    event_url = row['Event_URL']
    event_norm = normalize_url(event_url)
    matching = mappings[mappings['event_url_norm'] == event_norm]
    status = "✅ MATCHED" if len(matching) > 0 else "❌ NOT MATCHED"
    price = matching.iloc[0]['price_gbp'] if len(matching) > 0 else "N/A"
    print(f"\n  {row['Event_Title']}")
    print(f"    Event URL: {event_url}")
    print(f"    Normalized: {event_norm}")
    print(f"    Status: {status}")
    if len(matching) > 0:
        print(f"    Price: {price}")
    else:
        slug = event_url.split('/')[-1]
        similar = mappings[mappings['event_url'].str.contains(slug[:30], case=False, na=False)]
        if len(similar) > 0:
            print(f"    ⚠️ Similar URL in mappings: {similar.iloc[0]['event_url']}")

# Overall matching stats
matched = all_events[all_events['event_url_norm'].isin(mappings['event_url_norm'])]
unmatched = all_events[~all_events['event_url_norm'].isin(mappings['event_url_norm'])]

print("\n\n3. OVERALL STATISTICS:")
print(f"   Total events: {len(all_events)}")
print(f"   Matched: {len(matched)} ({len(matched)/len(all_events)*100:.1f}%)")
print(f"   Unmatched: {len(unmatched)} ({len(unmatched)/len(all_events)*100:.1f}%)")

# Check unmatched events that should have prices
print("\n\n4. UNMATCHED EVENTS (first 30):")
for idx, row in unmatched.head(30).iterrows():
    print(f"   - {row['Event_Title']}")
    print(f"     URL: {row['Event_URL']}")

# Check if mappings have duplicate event_urls (overwriting issue)
print("\n\n5. MAPPINGS DUPLICATE CHECK:")
duplicates = mappings[mappings.duplicated(subset=['event_url_norm'], keep=False)]
if len(duplicates) > 0:
    print(f"   ⚠️ Found {len(duplicates)} duplicate event_url entries in mappings")
    print("   This could cause overwriting in the dictionary!")
    print("\n   Duplicate examples:")
    for event_url_norm in duplicates['event_url_norm'].unique()[:5]:
        dup_rows = duplicates[duplicates['event_url_norm'] == event_url_norm]
        print(f"\n   Event URL: {event_url_norm}")
        for _, dup_row in dup_rows.iterrows():
            print(f"     - Price: {dup_row['price_gbp']}, Product: {dup_row['product_url']}")
else:
    print("   ✅ No duplicate event_urls found")

# Check the buildMappingsDict logic - last entry wins
print("\n\n6. MAPPINGS DICTIONARY BUILD LOGIC:")
print("   JavaScript code builds dict like: dict[eventUrl] = {...}")
print("   If same event_url appears multiple times, LAST entry overwrites previous ones")
print("   Checking if this is causing issues...")
duplicate_urls = mappings[mappings.duplicated(subset=['event_url_norm'], keep=False)]['event_url_norm'].unique()
if len(duplicate_urls) > 0:
    print(f"   ⚠️ Found {len(duplicate_urls)} event URLs with multiple mappings")
    print("   The LAST mapping entry will be used, previous ones will be overwritten")
    for url_norm in duplicate_urls[:3]:
        dup_rows = mappings[mappings['event_url_norm'] == url_norm]
        print(f"\n   URL: {url_norm}")
        print(f"   Number of entries: {len(dup_rows)}")
        print(f"   Last entry price: {dup_rows.iloc[-1]['price_gbp']}")
        if dup_rows.iloc[-1]['price_gbp'] != dup_rows.iloc[0]['price_gbp']:
            print(f"   ⚠️ Price changed! First: {dup_rows.iloc[0]['price_gbp']}, Last: {dup_rows.iloc[-1]['price_gbp']}")


