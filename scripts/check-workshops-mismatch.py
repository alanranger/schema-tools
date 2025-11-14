#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import pandas as pd
from pathlib import Path
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

workflow_dir = Path('inputs-files/workflow')

# Load workshops CSV
workshops_files = list(workflow_dir.glob('*workshops*.csv'))
if workshops_files:
    workshops_df = pd.read_csv(workshops_files[0])
    print(f"Loaded workshops CSV: {workshops_files[0].name}")
    print(f"Total rows: {len(workshops_df)}")
    
    # Check for the mismatched events
    mismatched = [
        "EXMOOR Photography Workshop",
        "PEAK DISTRICT HEATHER Photography Workshops",
        "The Secret of WOODLAND PHOTOGRAPHY"
    ]
    
    print("\n" + "=" * 80)
    print("Checking if mismatched events are in workshops CSV:")
    for keyword in mismatched:
        matches = workshops_df[workshops_df['Event_Title'].str.contains(keyword[:30], case=False, na=False)]
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
            # Try partial match
            partial = workshops_df[workshops_df['Event_Title'].str.contains(keyword.split()[0], case=False, na=False)]
            if len(partial) > 0:
                print(f"  But found {len(partial)} partial matches with '{keyword.split()[0]}'")
                for idx, row in partial.head(3).iterrows():
                    print(f"    - {row.get('Event_Title', 'N/A')}")
else:
    print("No workshops CSV found!")

