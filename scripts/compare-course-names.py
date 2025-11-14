#!/usr/bin/env python3
import pandas as pd
from pathlib import Path

# Updated to use shared-resources structure
script_dir = Path(__file__).parent
project_root = script_dir.parent
shared_resources_dir = project_root.parent / 'alan-shared-resources'
csv_processed_dir = shared_resources_dir / 'csv processed'

cleaned_file = csv_processed_dir / '02 – products_cleaned.xlsx'

df = pd.read_excel(cleaned_file)

course_names = [
    "Lightroom Courses for Beginners Photo Editing - Coventry",
    "RPS Courses - Independent RPS Mentoring for RPS Distinctions",
    "Beginners Photography Course | 3 Weekly Evening Classes",
    "Intermediates Intentions Photography Project Course",
    "Beginners Portrait Photography Course - Coventry - 1 Day"
]

print("Actual product names vs hardcoded course names:")
print("=" * 80)
for course_name in course_names:
    # Find products that might match
    matches = df[df['name'].str.contains(course_name[:30], case=False, na=False)]
    if len(matches) > 0:
        actual_name = matches.iloc[0]['name']
        print(f"\nHardcoded: {course_name}")
        print(f"Actual:    {actual_name}")
        print(f"Match:     {course_name == actual_name}")
        print(f"Schema:    {matches.iloc[0]['schema_type']}")

