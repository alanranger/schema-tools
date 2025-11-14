#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import pandas as pd
from pathlib import Path
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

workflow_dir = Path('inputs-files/workflow')

# Load lessons CSV
lessons_files = list(workflow_dir.glob('*lessons*.csv'))
if lessons_files:
    lessons_df = pd.read_csv(lessons_files[0])
    print(f"Loaded lessons CSV: {lessons_files[0].name}")
    print(f"Columns: {list(lessons_df.columns)}")
    print(f"Total rows: {len(lessons_df)}")
    
    # Check for the 5 courses
    course_keywords = [
        "Lightroom",
        "RPS",
        "Beginners Photography Course",
        "Intermediates Intentions",
        "Beginners Portrait"
    ]
    
    print("\n" + "=" * 80)
    print("Checking if courses are in lessons CSV:")
    for keyword in course_keywords:
        matches = lessons_df[lessons_df['Event_Title'].str.contains(keyword, case=False, na=False)]
        if len(matches) > 0:
            print(f"\nFOUND '{keyword}':")
            for idx, row in matches.iterrows():
                title = row.get('Event_Title', 'N/A')
                url = row.get('Event_URL', 'N/A')
                start_date = row.get('Start_Date', 'N/A')
                print(f"  Title: {title}")
                print(f"  URL: {url}")
                print(f"  Start Date: {start_date}")
        else:
            print(f"\nNOT FOUND: '{keyword}'")
else:
    print("No lessons CSV found!")

