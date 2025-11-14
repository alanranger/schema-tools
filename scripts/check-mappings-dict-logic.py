#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Check if buildMappingsDict overwrites entries"""

import pandas as pd
import sys
from pathlib import Path

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

workflow_dir = Path('inputs-files/workflow')

# Load data
mappings = pd.read_csv(workflow_dir / 'event-product-mappings-2025-11-08T21-21-59-228Z.csv')
workshops = pd.read_csv(workflow_dir / '03 - www-alanranger-com__5013f4b2c4aaa4752ac69b17__photographic-workshops-near-me.csv')

def normalize_url(url):
    """Match JavaScript normalizeUrl function exactly"""
    if pd.isna(url) or not url:
        return ''
    return str(url).lower().strip().rstrip('/')

print("=" * 80)
print("CHECKING buildMappingsDict LOGIC")
print("=" * 80)

# Simulate JavaScript buildMappingsDict
print("\n1. Simulating JavaScript buildMappingsDict()...")
print("   Code: dict[eventUrl] = {...}")
print("   If same event_url appears multiple times, LAST entry overwrites previous ones\n")

mappings_dict = {}
overwrites = []

for idx, mapping in mappings.iterrows():
    event_url = normalize_url(mapping['event_url'])
    product_url = normalize_url(mapping['product_url'])
    
    if event_url and product_url:
        if event_url in mappings_dict:
            overwrites.append({
                'row': idx + 2,
                'url': event_url,
                'old_price': mappings_dict[event_url]['price'],
                'new_price': mapping['price_gbp']
            })
        
        mappings_dict[event_url] = {
            'product_url': mapping['product_url'],
            'price': mapping['price_gbp'] if pd.notna(mapping['price_gbp']) else None,
            'availability': mapping['availability'] if pd.notna(mapping['availability']) else "https://schema.org/InStock"
        }

print(f"   Total mappings processed: {len(mappings)}")
print(f"   Unique URLs in dict: {len(mappings_dict)}")
print(f"   Overwrites: {len(overwrites)}")

if overwrites:
    print("\n   ⚠️ Overwrite examples:")
    for ov in overwrites[:5]:
        print(f"      Row {ov['row']}: {ov['url']}")
        print(f"        Old price: {ov['old_price']}, New price: {ov['new_price']}")

# Check Batsford specifically
print("\n\n2. BATSFORD EVENTS CHECK:")
batsford_events = workshops[workshops['Event_Title'].str.contains('Batsford', case=False, na=False)]
batsford_mappings = mappings[mappings['event_url'].str.contains('batsford', case=False, na=False)]

print(f"   Batsford events in CSV: {len(batsford_events)}")
print(f"   Batsford mappings rows: {len(batsford_mappings)}")
print(f"   Unique Batsford URLs in mappings CSV: {batsford_mappings['event_url'].nunique()}")

print("\n   Events CSV URLs:")
for idx, event in batsford_events.iterrows():
    event_url_norm = normalize_url(event['Event_URL'])
    in_dict = event_url_norm in mappings_dict
    price = mappings_dict[event_url_norm]['price'] if in_dict else None
    status = "✅ IN DICT" if in_dict else "❌ NOT IN DICT"
    print(f"     {event['Event_Title']}")
    print(f"       URL: {event['Event_URL']}")
    print(f"       Normalized: {event_url_norm}")
    print(f"       Status: {status}")
    if in_dict:
        print(f"       Price: {price}")

print("\n   Mappings CSV URLs:")
for url in batsford_mappings['event_url'].unique():
    url_norm = normalize_url(url)
    in_dict = url_norm in mappings_dict
    price = mappings_dict[url_norm]['price'] if in_dict else None
    print(f"     {url}")
    print(f"       Normalized: {url_norm}")
    print(f"       In dict: {in_dict}")
    print(f"       Price: {price}")

# Check if there's a mismatch
print("\n\n3. URL MISMATCH CHECK:")
events_urls = set(normalize_url(e['Event_URL']) for _, e in batsford_events.iterrows())
mappings_urls = set(normalize_url(u) for u in batsford_mappings['event_url'].unique())

missing_in_mappings = events_urls - mappings_urls
missing_in_events = mappings_urls - events_urls

print(f"   Events URLs: {len(events_urls)}")
print(f"   Mappings URLs: {len(mappings_urls)}")
print(f"   Missing in mappings: {len(missing_in_mappings)}")
if missing_in_mappings:
    print("     URLs in events but NOT in mappings:")
    for url in missing_in_mappings:
        matching_event = batsford_events[batsford_events['Event_URL'].apply(normalize_url) == url]
        if len(matching_event) > 0:
            print(f"       - {url} ({matching_event.iloc[0]['Event_Title']})")

print(f"   Missing in events: {len(missing_in_events)}")
if missing_in_events:
    print("     URLs in mappings but NOT in events:")
    for url in missing_in_events:
        print(f"       - {url}")


