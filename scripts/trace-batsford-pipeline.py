#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Trace Batsford events through the entire pipeline"""

import pandas as pd
import sys
from datetime import datetime
from pathlib import Path

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

workflow_dir = Path('inputs-files/workflow')

# Load data
workshops = pd.read_csv(workflow_dir / '03 - www-alanranger-com__5013f4b2c4aaa4752ac69b17__photographic-workshops-near-me.csv')
mappings = pd.read_csv(workflow_dir / 'event-product-mappings-2025-11-08T21-21-59-228Z.csv')

def normalize_url(url):
    """Match JavaScript normalizeUrl function exactly"""
    if pd.isna(url) or not url:
        return ''
    return str(url).lower().strip().rstrip('/')

print("=" * 80)
print("BATSFORD EVENT PIPELINE TRACE")
print("=" * 80)

# Step 1: Check Batsford events in CSV
print("\nSTEP 1: Events CSV")
batsford_events = workshops[workshops['Event_Title'].str.contains('Batsford', case=False, na=False)]
print(f"   Found {len(batsford_events)} Batsford events")
for idx, event in batsford_events.iterrows():
    print(f"\n   Event: {event['Event_Title']}")
    print(f"     URL: {event['Event_URL']}")
    print(f"     Start_Date: {event['Start_Date']}")
    print(f"     Workflow_State: {event['Workflow_State']}")
    print(f"     Category: {event.get('Category', 'N/A')}")

# Step 2: Check filtering logic
print("\n\nSTEP 2: Filtering Logic (JavaScript simulation)")
today = datetime.now().strftime('%Y-%m-%d')
print(f"   Today's date: {today}")
print(f"   Filter conditions:")
print(f"     1. Workflow_State === 'Published'")
print(f"     2. Start_Date >= today ({today})")
print(f"     3. Category match (if filter selected)")

filtered_batsford = batsford_events[
    (batsford_events['Workflow_State'] == 'Published') &
    (batsford_events['Start_Date'] >= today)
]

print(f"\n   After filtering:")
print(f"     Total Batsford events: {len(batsford_events)}")
print(f"     Filtered Batsford events: {len(filtered_batsford)}")
if len(filtered_batsford) < len(batsford_events):
    excluded = batsford_events[~batsford_events.index.isin(filtered_batsford.index)]
    print(f"     EXCLUDED events:")
    for idx, event in excluded.iterrows():
        print(f"       - {event['Event_Title']}")
        print(f"         Start_Date: {event['Start_Date']} (vs today: {today})")
        print(f"         Workflow_State: {event['Workflow_State']}")

# Step 3: Check mappings
print("\n\nSTEP 3: Mappings CSV")
batsford_mappings = mappings[mappings['event_url'].str.contains('batsford', case=False, na=False)]
print(f"   Found {len(batsford_mappings)} Batsford mapping entries")
unique_batsford_urls = batsford_mappings['event_url'].apply(normalize_url).unique()
print(f"   Unique Batsford URLs in mappings: {len(unique_batsford_urls)}")
for url in unique_batsford_urls:
    matching = batsford_mappings[batsford_mappings['event_url'].apply(normalize_url) == url]
    print(f"     - {url}")
    print(f"       Price: {matching.iloc[0]['price_gbp']}")
    print(f"       Product: {matching.iloc[0]['product_url']}")

# Step 4: Simulate JavaScript matching
print("\n\nSTEP 4: JavaScript Matching Simulation")
print("   Building mappings dictionary (like buildMappingsDict)...")

mappings_dict = {}
for idx, mapping in mappings.iterrows():
    event_url_norm = normalize_url(mapping['event_url'])
    product_url_norm = normalize_url(mapping['product_url'])
    
    if event_url_norm and product_url_norm:
        mappings_dict[event_url_norm] = {
            'product_url': mapping['product_url'],
            'price': mapping['price_gbp'] if pd.notna(mapping['price_gbp']) else None,
            'availability': mapping['availability'] if pd.notna(mapping['availability']) else "https://schema.org/InStock"
        }

print(f"   Mappings dictionary built: {len(mappings_dict)} entries")

# Step 5: Match filtered events to mappings
print("\n\nSTEP 5: Matching Filtered Events to Mappings")
for idx, event in filtered_batsford.iterrows():
    event_url = event['Event_URL']
    event_url_norm = normalize_url(event_url)
    
    print(f"\n   {event['Event_Title']}")
    print(f"     Event URL: {event_url}")
    print(f"     Normalized: {event_url_norm}")
    
    if event_url_norm in mappings_dict:
        mapping_data = mappings_dict[event_url_norm]
        print(f"     ✅ MAPPING FOUND")
        print(f"        Price: {mapping_data['price']}")
        print(f"        Product URL: {mapping_data['product_url']}")
        
        # Simulate price extraction
        use_mapping_price = mapping_data['price'] is not None
        event_price = float(mapping_data['price']) if use_mapping_price else 0.0
        print(f"        useMappingPrice: {use_mapping_price}")
        print(f"        eventPrice: {event_price}")
        
        if event_price > 0:
            print(f"        ✅ Offers will be added (price > 0)")
        else:
            print(f"        ❌ Offers will NOT be added (price = 0)")
    else:
        print(f"     ❌ NO MAPPING FOUND")
        print(f"        Price extraction: mappingData.price → event['Price'] → defaults to 0")
        print(f"        eventPrice: 0")
        print(f"        ❌ Offers will NOT be added (price = 0)")

print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"1. Total Batsford events in CSV: {len(batsford_events)}")
print(f"2. After filtering (Published + Start_Date >= today): {len(filtered_batsford)}")
print(f"3. Batsford URLs in mappings: {len(unique_batsford_urls)}")
print(f"4. Filtered events with mappings: {sum(1 for _, e in filtered_batsford.iterrows() if normalize_url(e['Event_URL']) in mappings_dict)}")


