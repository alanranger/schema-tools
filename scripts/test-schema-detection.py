#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import pandas as pd
from pathlib import Path
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Copy the exact function from clean-products-csv.py
def detect_schema_type(product_name, product_url, events_df):
    """
    Detect schema type by matching product to events CSV files.
    Returns: 'event', 'course', or 'product'
    
    Logic:
    1. Hardcoded list of 5 courses (exact match by name)
    2. Check URL path: if 'photo-workshops-uk' → 'event', if 'photography-services-near-me' → check course list
    3. Match remaining products to events CSV (workshops) → 'event'
    4. Default to 'product' if no match found
    """
    # Hardcoded list of 5 courses (exact match by name)
    course_names = [
        "Lightroom Courses for Beginners Photo Editing - Coventry",
        "RPS Courses - Independent RPS Mentoring for RPS Distinctions",
        "Beginners Photography Course | 3 Weekly Evening Classes",
        "Intermediates Intentions Photography Project Course",
        "Beginners Portrait Photography Course - Coventry - 1 Day"
    ]
    
    # Check if product is one of the 5 courses (exact match)
    if product_name in course_names:
        return 'course'
    
    # Check URL path to quickly identify events vs courses/products
    if product_url:
        url_lower = product_url.lower()
        # If URL contains 'photo-workshops-uk', it's definitely an event (workshop)
        if 'photo-workshops-uk' in url_lower:
            # But still verify it matches an event with dates
            if events_df is not None and len(events_df) > 0:
                product_url_slug = product_url.split('/')[-1].strip().lower()
                for _, event_row in events_df.iterrows():
                    event_url = str(event_row.get('Event_URL', '')).strip()
                    event_url_slug = event_url.split('/')[-1].strip().lower() if event_url else ''
                    if product_url_slug == event_url_slug:
                        if 'Start_Date' in event_row.index and pd.notna(event_row.get('Start_Date')):
                            start_date = pd.to_datetime(event_row.get('Start_Date'), errors='coerce')
                            if pd.notna(start_date):
                                return 'event'
            # If URL says workshop but no match found, still return event (URL is authoritative)
            return 'event'
        # If URL contains 'photography-services-near-me', check if it's a course
        elif 'photography-services-near-me' in url_lower:
            # Already checked course list above, so if we get here it's not a course
            # Products in this section are products (like "4 x 2hr Private Photography Classes")
            return 'product'
    
    # For all other products, try to match to events CSV (workshops)
    if events_df is None or len(events_df) == 0:
        return 'product'  # Default if no events loaded
    
    product_name_lower = product_name.lower() if product_name else ''
    product_url_slug = ''
    if product_url:
        product_url_slug = product_url.split('/')[-1].strip().lower()
    
    # Try to match by URL slug first (most reliable - exact match)
    matched_event = None
    for _, event_row in events_df.iterrows():
        event_url = str(event_row.get('Event_URL', '')).strip()
        event_url_slug = event_url.split('/')[-1].strip().lower() if event_url else ''
        
        # Match by URL slug (exact match required)
        if product_url_slug and event_url_slug and product_url_slug == event_url_slug:
            # CRITICAL: Only consider it a match if the event has dates
            if 'Start_Date' in event_row.index and pd.notna(event_row.get('Start_Date')):
                start_date = pd.to_datetime(event_row.get('Start_Date'), errors='coerce')
                if pd.notna(start_date):
                    matched_event = event_row
                    break
    
    # If no URL match, try VERY STRICT fuzzy match by Event_Title
    # This should be extremely strict - only match if titles are almost identical
    if matched_event is None:
        for _, event_row in events_df.iterrows():
            # CRITICAL: Only consider events with dates
            if 'Start_Date' not in event_row.index or pd.isna(event_row.get('Start_Date')):
                continue
            
            start_date = pd.to_datetime(event_row.get('Start_Date'), errors='coerce')
            if pd.isna(start_date):
                continue
            
            event_title = str(event_row.get('Event_Title', '')).lower()
            
            # VERY strict matching: require at least 4 significant words to match
            # AND at least 70% of event words must match
            if event_title and product_name_lower:
                event_words = [w for w in event_title.split() if len(w) > 4]
                
                if len(event_words) < 3:
                    continue  # Skip if event title is too short
                
                # Count matches
                matches = sum(1 for word in event_words if word in product_name_lower)
                
                # Require at least 4 matches AND at least 70% match ratio
                match_ratio = matches / len(event_words) if event_words else 0
                if matches >= 4 and match_ratio >= 0.7:
                    matched_event = event_row
                    break
    
    # If matched to an event, return 'event' (workshop)
    if matched_event is not None:
        return 'event'
    
    # If no match found, return 'product' (Product only)
    return 'product'

workflow_dir = Path('inputs-files/workflow')

# Load events (workshops only)
events_df = None
events_list = []

for possible_name in [
    "01 – workshops.csv",
    "03 - www-alanranger-com__5013f4b2c4aaa4752ac69b17__photographic-workshops-near-me.csv",
]:
    test_path = workflow_dir / possible_name
    if test_path.exists():
        workshops = pd.read_csv(test_path, encoding="utf-8-sig")
        events_list.append(workshops)
        print(f"Loaded {len(workshops)} workshop events")
        break

if events_list:
    events_df = pd.concat(events_list, ignore_index=True)

# Load products
df = pd.read_excel(workflow_dir / '02 – products_cleaned.xlsx', engine='openpyxl')

print("\nTesting schema type detection:\n")
print("="*80)

course_count = 0
event_count = 0
product_count = 0
mismatches = []

for idx, row in df.iterrows():
    product_name = row['name']
    product_url = row.get('url', '')
    current_type = row.get('schema_type', 'unknown')
    
    detected_type = detect_schema_type(product_name, product_url, events_df)
    
    if detected_type != current_type:
        mismatches.append((product_name, current_type, detected_type))
        print(f"MISMATCH: {product_name[:70]}")
        print(f"   Current: {current_type:8s} -> Should be: {detected_type}")
    else:
        print(f"OK {detected_type:8s}: {product_name[:70]}")
    
    if detected_type == 'course':
        course_count += 1
    elif detected_type == 'event':
        event_count += 1
    else:
        product_count += 1

print("\n" + "="*80)
print(f"Summary: course={course_count}, event={event_count}, product={product_count}")
print(f"Expected: course=5, event=34, product=11")
print(f"\nFound {len(mismatches)} mismatches")
