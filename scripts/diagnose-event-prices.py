#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Diagnose why 27 events are missing offers"""

import pandas as pd
import sys
from pathlib import Path

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

workflow_dir = Path('inputs-files/workflow')

# Load events CSVs
workshops = pd.read_csv(workflow_dir / '03 - www-alanranger-com__5013f4b2c4aaa4752ac69b17__photographic-workshops-near-me.csv')
lessons = pd.read_csv(workflow_dir / '02 - www-alanranger-com__5013f4b2c4aaa4752ac69b17__beginners-photography-lessons.csv')
all_events = pd.concat([workshops, lessons], ignore_index=True)

# Load mappings CSV
mappings = pd.read_csv(workflow_dir / 'event-product-mappings-2025-11-08T21-21-59-228Z.csv')

# Load products CSV
products = pd.read_excel(workflow_dir / '02 – products_cleaned.xlsx', engine='openpyxl')

print("=" * 80)
print("EVENT PRICE DIAGNOSTIC REPORT")
print("=" * 80)

print(f"\n1. EVENTS CSV ANALYSIS")
print(f"   Total events: {len(all_events)}")
print(f"   Workshops: {len(workshops)}, Lessons: {len(lessons)}")
print(f"   Events CSV columns: {list(all_events.columns)}")
print(f"   Price column exists: {'Price' in all_events.columns}")

if 'Price' in all_events.columns:
    events_with_price = all_events['Price'].notna().sum()
    events_price_zero = (pd.to_numeric(all_events['Price'], errors='coerce') == 0).sum()
    events_price_missing = all_events['Price'].isna().sum()
    print(f"   Events with Price value: {events_with_price}")
    print(f"   Events with Price = 0: {events_price_zero}")
    print(f"   Events with Price missing: {events_price_missing}")
else:
    print(f"   ❌ NO PRICE COLUMN IN EVENTS CSV")

print(f"\n2. MAPPINGS CSV ANALYSIS")
print(f"   Total mappings: {len(mappings)}")
print(f"   Mappings columns: {list(mappings.columns)}")
print(f"   Mappings with price_gbp: {mappings['price_gbp'].notna().sum()}")
print(f"   Mappings with json_price: {mappings['json_price'].notna().sum()}")
print(f"   Mappings with price_currency: {mappings['price_currency'].notna().sum() if 'price_currency' in mappings.columns else 0}")

# Normalize URLs for matching
mappings['event_url_normalized'] = mappings['event_url'].astype(str).str.lower().str.strip().str.rstrip('/')
all_events['event_url_normalized'] = all_events['Event_URL'].astype(str).str.lower().str.strip().str.rstrip('/')

# Check mappings coverage
events_with_mappings = all_events[all_events['event_url_normalized'].isin(mappings['event_url_normalized'])]
events_without_mappings = all_events[~all_events['event_url_normalized'].isin(mappings['event_url_normalized'])]

print(f"\n3. MAPPINGS COVERAGE")
print(f"   Events WITH mappings: {len(events_with_mappings)}/{len(all_events)} ({len(events_with_mappings)/len(all_events)*100:.1f}%)")
print(f"   Events WITHOUT mappings: {len(events_without_mappings)}/{len(all_events)} ({len(events_without_mappings)/len(all_events)*100:.1f}%)")

if len(events_without_mappings) > 0:
    print(f"\n   Events WITHOUT mappings (first 30):")
    for idx, row in events_without_mappings.head(30).iterrows():
        print(f"      - {row['Event_Title']}")
        print(f"        URL: {row['Event_URL']}")

# Check events with mappings but missing price
events_with_mappings_dict = {}
for _, event_row in all_events.iterrows():
    event_url_norm = event_row['event_url_normalized']
    matching_mapping = mappings[mappings['event_url_normalized'] == event_url_norm]
    if len(matching_mapping) > 0:
        mapping_row = matching_mapping.iloc[0]
        events_with_mappings_dict[event_url_norm] = {
            'event_title': event_row['Event_Title'],
            'event_url': event_row['Event_URL'],
            'price_gbp': mapping_row.get('price_gbp'),
            'json_price': mapping_row.get('json_price'),
            'product_url': mapping_row.get('product_url')
        }

print(f"\n4. EVENTS WITH MAPPINGS BUT MISSING PRICE")
events_mapped_no_price = [e for e in events_with_mappings_dict.values() 
                          if pd.isna(e['price_gbp']) and pd.isna(e['json_price'])]
print(f"   Events with mappings but NO price: {len(events_mapped_no_price)}")
if len(events_mapped_no_price) > 0:
    for e in events_mapped_no_price[:10]:
        print(f"      - {e['event_title']}")
        print(f"        URL: {e['event_url']}")
        print(f"        Product URL: {e['product_url']}")

# Check products CSV
print(f"\n5. PRODUCTS CSV ANALYSIS")
print(f"   Total products: {len(products)}")
print(f"   Products columns: {list(products.columns)}")
price_cols = [c for c in products.columns if 'price' in c.lower()]
print(f"   Price-related columns: {price_cols}")
if price_cols:
    products_with_price = products[price_cols[0]].notna().sum()
    print(f"   Products with price: {products_with_price}/{len(products)}")

# Match events to products via mappings
print(f"\n6. EVENT → PRODUCT → PRICE CHAIN")
events_with_product_price = 0
events_missing_product_price = []
for event_url_norm, event_data in events_with_mappings_dict.items():
    product_url = event_data.get('product_url')
    if pd.notna(product_url) and product_url:
        # Try to find product in products CSV
        product_slug = str(product_url).split('/')[-1].strip()
        products['slug'] = products['url'].astype(str).apply(lambda x: x.split('/')[-1].strip() if pd.notna(x) else '')
        matching_product = products[products['slug'] == product_slug]
        if len(matching_product) > 0:
            events_with_product_price += 1
        else:
            events_missing_product_price.append({
                'event_title': event_data['event_title'],
                'event_url': event_data['event_url'],
                'product_url': product_url
            })

print(f"   Events with matching product in products CSV: {events_with_product_price}")
print(f"   Events with product URL but NOT in products CSV: {len(events_missing_product_price)}")
if len(events_missing_product_price) > 0:
    print(f"\n   First 10 events with product URL but not in products CSV:")
    for e in events_missing_product_price[:10]:
        print(f"      - {e['event_title']}")
        print(f"        Event URL: {e['event_url']}")
        print(f"        Product URL: {e['product_url']}")

print(f"\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"1. Events CSV has NO 'Price' column - this is why fallback fails")
print(f"2. {len(events_without_mappings)} events don't have mappings entries")
print(f"3. {len(events_mapped_no_price)} events have mappings but no price data")
print(f"4. Code logic: mappingData.price → event['Price'] → defaults to 0")
print(f"5. Since events CSV has no Price column, events without mappings get price = 0")
print(f"6. Since price = 0, offers are not added (line 6990: if eventPrice > 0)")


