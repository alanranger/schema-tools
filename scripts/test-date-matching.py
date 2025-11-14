#!/usr/bin/env python3
"""Match Google reviews to events/products using date clustering"""

import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta
import re
from difflib import SequenceMatcher

# Updated to use shared-resources structure
script_dir = Path(__file__).parent
project_root = script_dir.parent
shared_resources_dir = project_root.parent / 'alan-shared-resources'
csv_dir = shared_resources_dir / 'csv'
csv_processed_dir = shared_resources_dir / 'csv processed'

google_path = csv_dir / "raw-03b-google-reviews.csv"
products_path = csv_processed_dir / "02 – products_cleaned.xlsx"

# Handle original Squarespace export filenames
events_lessons_files = list(csv_dir.glob('*beginners-photography-lessons*.csv'))
events_lessons_path = events_lessons_files[0] if events_lessons_files else csv_dir / "01 – lessons.csv"

events_workshops_files = list(csv_dir.glob('*photographic-workshops-near-me*.csv'))
events_workshops_path = events_workshops_files[0] if events_workshops_files else csv_dir / "01 – workshops.csv"

print("="*80)
print("DATE-BASED GOOGLE REVIEW MATCHING")
print("="*80)
print()

# Load Google reviews
google = pd.read_csv(google_path, encoding="utf-8-sig")
google['date_parsed'] = pd.to_datetime(google['date'], errors='coerce')
google = google[google['date_parsed'].notna()].copy()
print(f"Google reviews with dates: {len(google)}")
print()

# Load events
events_list = []
if events_lessons_path.exists():
    lessons = pd.read_csv(events_lessons_path, encoding="utf-8-sig")
    lessons['csv_type'] = 'lessons'
    events_list.append(lessons)
    print(f"Loaded {len(lessons)} lesson events")
if events_workshops_path.exists():
    workshops = pd.read_csv(events_workshops_path, encoding="utf-8-sig")
    workshops['csv_type'] = 'workshops'
    events_list.append(workshops)
    print(f"Loaded {len(workshops)} workshop events")

if events_list:
    events_df = pd.concat(events_list, ignore_index=True)
    print(f"Total events: {len(events_df)}")
    print(f"Event columns: {list(events_df.columns)}")
    print()
    
    # Parse event dates
    if 'Start_Date' in events_df.columns:
        events_df['start_date_parsed'] = pd.to_datetime(events_df['Start_Date'], errors='coerce')
        events_df = events_df[events_df['start_date_parsed'].notna()].copy()
        print(f"Events with valid start dates: {len(events_df)}")
        print(f"Event date range: {events_df['start_date_parsed'].min()} to {events_df['start_date_parsed'].max()}")
        print()
        
        # Show date clusters
        print("Sample event dates:")
        for idx, row in events_df.head(20).iterrows():
            event_date = row['start_date_parsed']
            title = row.get('Event_Title', 'N/A')
            # Count reviews within 7 days of event
            reviews_nearby = google[
                (google['date_parsed'] >= event_date - timedelta(days=7)) &
                (google['date_parsed'] <= event_date + timedelta(days=7))
            ]
            print(f"  {event_date.date()}: {title[:50]}... ({len(reviews_nearby)} reviews within 7 days)")
        print()

# Load products
products = pd.read_excel(products_path, engine='openpyxl')
products = products[products['name'].notna() & (products['name'] != '')]
products['slug'] = products['url'].apply(lambda u: str(u).split('/')[-1].strip() if pd.notna(u) else '')
products = products[products['slug'] != '']

name_by_slug = {row['slug']: str(row['name']) for _, row in products.iterrows()}
product_by_slug = {row['slug']: row for _, row in products.iterrows()}

print(f"Products: {len(products)}")
print()

# Strategy: Match reviews to events by date, then map events to products
if events_list and 'start_date_parsed' in events_df.columns:
    print("Matching reviews to events by date...")
    print()
    
    # Create event-to-product mapping
    event_to_product = {}
    for idx, event_row in events_df.iterrows():
        event_title = str(event_row.get('Event_Title', '')).strip()
        event_url = str(event_row.get('Event_URL', '')).strip()
        
        # Try to find matching product
        if event_url:
            event_slug = event_url.split('/')[-1].strip()
            if event_slug in product_by_slug:
                event_to_product[event_title] = event_slug
    
    print(f"Events mapped to products: {len(event_to_product)}")
    print()
    
    # Match reviews to events by date (within 14 days)
    date_matches = []
    for idx, review_row in google.iterrows():
        review_date = review_row['date_parsed']
        review_text = str(review_row.get('review', '') or review_row.get('comment', '')).lower()
        
        # Find events within 14 days
        nearby_events = events_df[
            (events_df['start_date_parsed'] >= review_date - timedelta(days=14)) &
            (events_df['start_date_parsed'] <= review_date + timedelta(days=14))
        ]
        
        if len(nearby_events) > 0:
            # If multiple events, try to match by text content
            best_match = None
            best_score = 0
            
            for event_idx, event_row in nearby_events.iterrows():
                event_title = str(event_row.get('Event_Title', '')).lower()
                event_location = str(event_row.get('Location_Name', '') or event_row.get('Location', '')).lower()
                
                # Score based on text matching
                score = 0
                if event_title and any(word in review_text for word in event_title.split() if len(word) > 4):
                    score += 0.5
                if event_location and event_location in review_text:
                    score += 0.3
                
                # Prefer events closer in date
                days_diff = abs((event_row['start_date_parsed'] - review_date).days)
                date_score = 1.0 / (1 + days_diff / 7)  # Closer dates score higher
                score += date_score * 0.2
                
                if score > best_score:
                    best_score = score
                    best_match = event_row
            
            if best_match:
                event_title = str(best_match.get('Event_Title', ''))
                product_slug = event_to_product.get(event_title)
                if product_slug:
                    date_matches.append({
                        'review_idx': idx,
                        'event_title': event_title,
                        'product_slug': product_slug,
                        'days_diff': abs((best_match['start_date_parsed'] - review_date).days),
                        'score': best_score
                    })
    
    print(f"Reviews matched by date: {len(date_matches)}")
    print()
    
    # Show sample matches
    print("Sample date-based matches:")
    for match in sorted(date_matches, key=lambda x: x['days_diff'])[:10]:
        review_idx = match['review_idx']
        review = google.iloc[review_idx]
        print(f"  Review date: {review['date_parsed'].date()}")
        print(f"  Event: {match['event_title'][:50]}...")
        print(f"  Product: {name_by_slug.get(match['product_slug'], 'N/A')}")
        print(f"  Days difference: {match['days_diff']}")
        print()

