#!/usr/bin/env python3
"""Analyze Google reviews dates and products for date-based matching"""

import pandas as pd
from pathlib import Path
from datetime import timedelta

base_path = Path("inputs-files/workflow")
google_path = base_path / "03b – google_reviews.csv"
products_path = base_path / "02 – products_cleaned.xlsx"
events_lessons_path = base_path / "01 – lessons.csv"
events_workshops_path = base_path / "01 – workshops.csv"

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


