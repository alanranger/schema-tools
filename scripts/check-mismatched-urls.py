#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import pandas as pd
from pathlib import Path
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Updated to use shared-resources structure
script_dir = Path(__file__).parent
project_root = script_dir.parent
shared_resources_dir = project_root.parent / 'alan-shared-resources'
csv_processed_dir = shared_resources_dir / 'csv processed'

cleaned_file = csv_processed_dir / '02 – products_cleaned.xlsx'

df = pd.read_excel(cleaned_file)

mismatched = [
    "EXMOOR Photography Workshop",
    "PEAK DISTRICT HEATHER Photography Workshops",
    "The Secret of WOODLAND PHOTOGRAPHY"
]

print("Checking product URLs for mismatched events:")
print("=" * 80)
for keyword in mismatched:
    matches = df[df['name'].str.contains(keyword[:30], case=False, na=False)]
    if len(matches) > 0:
        row = matches.iloc[0]
        print(f"\n{row['name']}")
        print(f"  URL: {row['url']}")
        print(f"  Schema Type: {row['schema_type']}")
        
        # Check if URL contains workshop path
        url = str(row['url']).lower()
        if 'photo-workshops-uk' in url:
            print("  -> URL contains 'photo-workshops-uk'")
        elif 'photographic-workshops-near-me' in url:
            print("  -> URL contains 'photographic-workshops-near-me'")
        else:
            print("  -> URL does NOT contain workshop path!")

