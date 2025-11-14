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
csv_dir = shared_resources_dir / 'csv'
csv_processed_dir = shared_resources_dir / 'csv processed'

# Load workshops (handle original Squarespace export filenames)
workshops_files = list(csv_dir.glob('*photographic-workshops-near-me*.csv'))
if not workshops_files:
    workshops_files = list(csv_dir.glob('*workshops*.csv'))
workshops = pd.read_csv(workshops_files[0], encoding="utf-8-sig") if workshops_files else pd.DataFrame()

# Check "4 x 2hr"
product_name = "4 x 2hr Private Photography Classes - Face to Face Coventry"
product_url = "https://www.alanranger.com/photography-services-near-me/four-private-photography-classes"
print(f"Checking: {product_name}")
print(f"URL: {product_url}")
print(f"URL contains 'photography-services-near-me': {'photography-services-near-me' in product_url.lower()}")
print()

# Check "FAIRY GLEN"
product_name2 = "FAIRY GLEN and Fairy Falls Long Exposure Photography"
df_products = pd.read_excel(csv_processed_dir / '02 – products_cleaned.xlsx', engine='openpyxl')
row = df_products[df_products['name'].str.contains('FAIRY GLEN', case=False, na=False)].iloc[0]
product_url2 = row.get('url', '')
print(f"Checking: {product_name2}")
print(f"URL: {product_url2}")
print(f"URL contains 'photo-workshops-uk': {'photo-workshops-uk' in str(product_url2).lower()}")
print()

# Check if FAIRY GLEN matches any workshop
product_name_lower = product_name2.lower()
product_url_slug = str(product_url2).split('/')[-1].strip().lower() if product_url2 else ''

print("Matching workshops for FAIRY GLEN:")
for idx, event_row in workshops.iterrows():
    event_url = str(event_row.get('Event_URL', '')).strip()
    event_url_slug = event_url.split('/')[-1].strip().lower() if event_url else ''
    event_title = str(event_row.get('Event_Title', '')).lower()
    
    if 'fairy' in event_title or 'fairy' in event_url_slug:
        print(f"  {event_title}")
        print(f"    URL slug: {event_url_slug}")
        print(f"    Product URL slug: {product_url_slug}")
        if product_url_slug == event_url_slug:
            print(f"    -> URL MATCH!")
        if 'fairy' in product_name_lower and 'fairy' in event_title:
            print(f"    -> Title contains 'fairy'")

