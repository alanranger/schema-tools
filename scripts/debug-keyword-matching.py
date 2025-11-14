#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import pandas as pd
from pathlib import Path
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

workflow_dir = Path('inputs-files/workflow')
workshops_file = workflow_dir / '03 - www-alanranger-com__5013f4b2c4aaa4752ac69b17__photographic-workshops-near-me.csv'
cleaned_file = workflow_dir / '02 – products_cleaned.xlsx'

workshops_df = pd.read_csv(workshops_file)
products_df = pd.read_excel(cleaned_file)

test_cases = [
    ("EXMOOR Photography Workshop", "exmoor"),
    ("PEAK DISTRICT HEATHER Photography Workshops", "peak district"),
    ("The Secret of WOODLAND PHOTOGRAPHY", "woodland")
]

print("Testing keyword matching:")
print("=" * 80)
for product_name, search_term in test_cases:
    product_row = products_df[products_df['name'].str.contains(product_name[:30], case=False, na=False)]
    if len(product_row) == 0:
        continue
    
    product_url = str(product_row.iloc[0]['url']).lower()
    product_name_lower = str(product_row.iloc[0]['name']).lower()
    
    print(f"\nProduct: {product_row.iloc[0]['name']}")
    print(f"  URL: {product_url}")
    
    # Find matching events
    matching_events = workshops_df[workshops_df['Event_Title'].str.contains(search_term, case=False, na=False)]
    print(f"  Found {len(matching_events)} events with '{search_term}'")
    
    for idx, event_row in matching_events.head(3).iterrows():
        event_title = str(event_row.get('Event_Title', '')).lower()
        event_url = str(event_row.get('Event_URL', '')).lower()
        
        # Extract keywords
        product_keywords = [w for w in product_name_lower.split() if len(w) >= 3 and w not in ['the', 'of', 'and', 'for', 'a', 'an', 'in', 'on', 'at', 'to', 'photography', 'workshop', 'workshops', 'photographic']]
        matches = sum(1 for kw in product_keywords[:5] if kw in event_title)
        
        print(f"    Event: {event_row.get('Event_Title', 'N/A')}")
        print(f"      Keywords: {product_keywords[:5]}")
        print(f"      Matches: {matches}/5")
        print(f"      URL: {event_url}")

