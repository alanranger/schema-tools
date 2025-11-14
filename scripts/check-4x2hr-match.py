#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import pandas as pd
from pathlib import Path
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

workflow_dir = Path('inputs-files/workflow')

# Load workshops
for possible_name in [
    "01 – workshops.csv",
    "03 - www-alanranger-com__5013f4b2c4aaa4752ac69b17__photographic-workshops-near-me.csv",
]:
    test_path = workflow_dir / possible_name
    if test_path.exists():
        workshops = pd.read_csv(test_path, encoding="utf-8-sig")
        break

product_name = "4 x 2hr Private Photography Classes - Face to Face Coventry"
product_url = "https://www.alanranger.com/photography-services-near-me/four-private-photography-classes"

print(f"Checking: {product_name}\n")
print(f"URL: {product_url}\n")
print("Matching events:\n")

product_url_slug = product_url.split('/')[-1].strip().lower()
product_name_lower = product_name.lower()

for idx, event_row in workshops.iterrows():
    event_url = str(event_row.get('Event_URL', '')).strip()
    event_url_slug = event_url.split('/')[-1].strip().lower() if event_url else ''
    event_title = str(event_row.get('Event_Title', '')).lower()
    
    # Check URL match
    if product_url_slug and event_url_slug and product_url_slug == event_url_slug:
        print(f"URL MATCH: {event_title}")
        print(f"  Event URL: {event_url}")
    
    # Check fuzzy match
    if event_title and product_name_lower:
        event_words = [w for w in event_title.split() if len(w) > 4]
        matches = sum(1 for word in event_words if word in product_name_lower)
        match_ratio = matches / len(event_words) if event_words else 0
        if matches >= 3 or match_ratio >= 0.6:
            print(f"FUZZY MATCH: {event_title}")
            print(f"  Matches: {matches}, Ratio: {match_ratio:.2f}")

