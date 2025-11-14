#!/usr/bin/env python3
"""Test matching logic for specific cases"""

import pandas as pd
from pathlib import Path
import re

base_path = Path("inputs-files/workflow")
products_path = base_path / "02 – products_cleaned.xlsx"

# Load products
products_df = pd.read_excel(products_path, engine='openpyxl')
products_df['product_slug'] = products_df['url'].apply(
    lambda u: str(u).split('/')[-1].strip() if pd.notna(u) else ''
)
name_by_slug = {row['product_slug']: str(row['name']) for _, row in products_df.iterrows() 
                if row['product_slug'] and pd.notna(row['name'])}

# Test cases
test_ref_ids = [
    "Beginners Photography Classes - Coventry - Get Off Auto",
    "Beginners Photography Course | 3 Weekly Evening Classes",
    "WARWICKSHIRE Woodland PHOTOGRAPHY WALKS",
    "Landscape Photography Workshop Glencoe",
    "Sunflower Shoot",
    "Poppy Fields Photography Workshops | Worcestershire"
]

print("="*80)
print("TESTING MATCHING LOGIC")
print("="*80)
print()

for ref_id in test_ref_ids:
    print(f"Testing: {ref_id}")
    
    ref_id_lower = ref_id.lower().strip()
    ref_id_clean = re.sub(r'[^\w\s-]', '', ref_id_lower)
    ref_id_normalized = re.sub(r'\s+', ' ', ref_id_clean)
    
    matched = False
    
    # Strategy 1: Exact match
    for slug, name in name_by_slug.items():
        name_lower = str(name).lower().strip()
        name_normalized = re.sub(r'\s+', ' ', name_lower)
        if ref_id_normalized in name_normalized or name_normalized in ref_id_normalized:
            print(f"  ✅ Exact match: {name}")
            matched = True
            break
    
    # Strategy 2: Partial match (remove suffixes)
    if not matched:
        ref_id_base = re.sub(r'\s*[-|]\s*(monthly|2hrs?|weekly|daily|hourly|hrs?|hours?|days?|weeks?|months?|years?|get off auto|coventry|warwickshire|worcestershire|\d+\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec).*|\d{1,2}\s*(st|nd|rd|th).*|\d+\s*weekly\s*evening\s*classes?)$', '', ref_id_normalized, flags=re.IGNORECASE)
        ref_id_base = ref_id_base.strip()
        print(f"  Base after suffix removal: '{ref_id_base}'")
        
        for slug, name in name_by_slug.items():
            name_lower = str(name).lower().strip()
            name_base = re.sub(r'\s*[-|]\s*(monthly|2hrs?|weekly|daily|hourly|hrs?|hours?|days?|weeks?|months?|years?|get off auto|coventry|warwickshire|worcestershire|\d+\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec).*|\d{1,2}\s*(st|nd|rd|th).*|\d+\s*weekly\s*evening\s*classes?)$', '', name_lower, flags=re.IGNORECASE)
            name_base = name_base.strip()
            
            if ref_id_base in name_base or name_base in ref_id_base:
                print(f"  ✅ Partial match: {name}")
                print(f"     Product base: '{name_base}'")
                matched = True
                break
    
    # Strategy 3: Classes -> Course replacement
    if not matched:
        ref_id_normalized_classes = ref_id_normalized.replace('classes', 'course').replace('class', 'course')
        print(f"  After classes->course: '{ref_id_normalized_classes}'")
        
        for slug, name in name_by_slug.items():
            name_lower = str(name).lower().strip()
            name_normalized = re.sub(r'\s+', ' ', name_lower)
            if ref_id_normalized_classes in name_normalized or name_normalized in ref_id_normalized_classes:
                print(f"  ✅ Classes->Course match: {name}")
                matched = True
                break
    
    if not matched:
        print(f"  ❌ No match found")
    
    print()


