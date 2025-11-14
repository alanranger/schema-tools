#!/usr/bin/env python3
import pandas as pd
from pathlib import Path

workflow_dir = Path('inputs-files/workflow')
cleaned_file = workflow_dir / '02 – products_cleaned.xlsx'

df = pd.read_excel(cleaned_file)

course_names = [
    "Lightroom Courses for Beginners Photo Editing - Coventry",
    "RPS Courses - Independent RPS Mentoring for RPS Distinctions",
    "Beginners Photography Course | 3 Weekly Evening Classes",
    "Intermediates Intentions Photography Project Course",
    "Beginners Portrait Photography Course - Coventry - 1 Day"
]

print("Checking course products:")
print("=" * 80)
for course_name in course_names:
    # Find products that start with this course name (in case of truncation)
    matches = df[df['name'].str.startswith(course_name[:40], na=False)]
    if len(matches) > 0:
        row = matches.iloc[0]
        print(f"{course_name[:60]:60} -> {row['schema_type']}")
    else:
        # Try exact match
        exact = df[df['name'] == course_name]
        if len(exact) > 0:
            print(f"{course_name[:60]:60} -> {exact.iloc[0]['schema_type']}")
        else:
            print(f"{course_name[:60]:60} -> NOT FOUND")

print("\n" + "=" * 80)
print("Schema type counts:")
print(df['schema_type'].value_counts())

