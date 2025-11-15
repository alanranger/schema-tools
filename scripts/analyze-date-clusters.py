#!/usr/bin/env python3
"""Analyze Google reviews dates and products for date-based matching

Reads:
  - shared-resources/csv/raw-03b-google-reviews.csv
  - shared-resources/csv processed/02 – products_cleaned.xlsx
  - shared-resources/csv/*beginners-photography-lessons*.csv or *photography-services-courses-mentoring*.csv
  - shared-resources/csv/*photographic-workshops-near-me*.csv or *photo-workshops-uk-landscape*.csv
"""

import pandas as pd
from pathlib import Path
from datetime import timedelta
import sys

# Updated to use shared-resources structure
script_dir = Path(__file__).parent
project_root = script_dir.parent
shared_resources_dir = project_root.parent / 'alan-shared-resources'
csv_dir = shared_resources_dir / 'csv'
csv_processed_dir = shared_resources_dir / 'csv processed'

# Find Google reviews CSV
google_path = None
if csv_dir.exists():
    for csv_file in csv_dir.glob('*google*.csv'):
        if 'raw-03b' in csv_file.name.lower() or 'google' in csv_file.name.lower():
            google_path = csv_file
            break

if not google_path or not google_path.exists():
    print("Error: Google reviews CSV not found")
    print(f"   Expected: {csv_dir.absolute()}/raw-03b-google-reviews.csv")
    sys.exit(1)

products_path = csv_processed_dir / "02 – products_cleaned.xlsx"

# Find event CSV files using flexible filename matching
events_lessons_path = None
events_workshops_path = None
if csv_dir.exists():
    # Check for lessons CSVs
    for csv_file in csv_dir.glob('*.csv'):
        csv_name_lower = csv_file.name.lower()
        if ('beginners-photography-lessons' in csv_name_lower or
            'photography-services-courses-mentoring' in csv_name_lower or
            ('lesson' in csv_name_lower and 'workshop' not in csv_name_lower and '02' in csv_name_lower)):
            events_lessons_path = csv_file
            break
    
    # Check for workshop CSVs
    for csv_file in csv_dir.glob('*.csv'):
        csv_name_lower = csv_file.name.lower()
        if ('photographic-workshops-near-me' in csv_name_lower or
            'photo-workshops-uk-landscape' in csv_name_lower or
            ('workshop' in csv_name_lower and 'lesson' not in csv_name_lower and '03' in csv_name_lower)):
            events_workshops_path = csv_file
            break

print("="*80)
print("ANALYZING DATE PATTERNS FOR GOOGLE REVIEW MATCHING")
print("="*80)
print()

# Load Google reviews
google = pd.read_csv(google_path, encoding="utf-8-sig")
google['date_parsed'] = pd.to_datetime(google['date'], errors='coerce')
google = google[google['date_parsed'].notna()].copy()
print(f"Google reviews with dates: {len(google)}")
print(f"Date range: {google['date_parsed'].min()} to {google['date_parsed'].max()}")
print()

# Load events
events_list = []
if events_lessons_path.exists():
    lessons = pd.read_csv(events_lessons_path, encoding="utf-8-sig")
    if 'Start_Date' in lessons.columns:
        lessons['start_date_parsed'] = pd.to_datetime(lessons['Start_Date'], errors='coerce')
        lessons = lessons[lessons['start_date_parsed'].notna()].copy()
        events_list.append(lessons)
        print(f"Loaded {len(lessons)} lesson events")
if events_workshops_path.exists():
    workshops = pd.read_csv(events_workshops_path, encoding="utf-8-sig")
    if 'Start_Date' in workshops.columns:
        workshops['start_date_parsed'] = pd.to_datetime(workshops['Start_Date'], errors='coerce')
        workshops = workshops[workshops['start_date_parsed'].notna()].copy()
        events_list.append(workshops)
        print(f"Loaded {len(workshops)} workshop events")

if events_list:
    events_df = pd.concat(events_list, ignore_index=True)
    print(f"Total events: {len(events_df)}")
    print(f"Event date range: {events_df['start_date_parsed'].min()} to {events_df['start_date_parsed'].max()}")
    print()
    
    # Show date clusters - reviews within 7 days of events
    print("Sample date clusters (reviews within 7 days of events):")
    for idx, row in events_df.head(10).iterrows():
        event_date = row['start_date_parsed']
        title = row.get('Event_Title', 'N/A')[:50]
        reviews_nearby = google[
            (google['date_parsed'] >= event_date - timedelta(days=7)) &
            (google['date_parsed'] <= event_date + timedelta(days=7))
        ]
        if len(reviews_nearby) > 0:
            print(f"  {event_date.date()}: {title}... ({len(reviews_nearby)} reviews)")
    print()

# Group Google reviews by date clusters
print("Google review date clusters:")
google['date_only'] = google['date_parsed'].dt.date
date_counts = google.groupby('date_only').size().sort_values(ascending=False)
print(f"Top 20 dates with most reviews:")
for date, count in date_counts.head(20).items():
    print(f"  {date}: {count} reviews")
print()

# Check for date clusters (reviews within 3 days of each other)
print("Identifying date clusters (reviews within 3 days)...")
google_sorted = google.sort_values('date_parsed')
clusters = []
current_cluster = []
for idx, row in google_sorted.iterrows():
    if not current_cluster:
        current_cluster = [row]
    else:
        last_date = current_cluster[-1]['date_parsed']
        current_date = row['date_parsed']
        if (current_date - last_date).days <= 3:
            current_cluster.append(row)
        else:
            if len(current_cluster) >= 3:  # Only show clusters with 3+ reviews
                clusters.append(current_cluster)
            current_cluster = [row]
if len(current_cluster) >= 3:
    clusters.append(current_cluster)

print(f"Found {len(clusters)} date clusters with 3+ reviews")
for i, cluster in enumerate(clusters[:10]):
    dates = [r['date_parsed'].date() for r in cluster]
    print(f"  Cluster {i+1}: {dates[0]} to {dates[-1]} ({len(cluster)} reviews)")
print()


