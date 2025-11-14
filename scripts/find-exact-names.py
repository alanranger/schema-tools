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
csv_processed_dir = shared_resources_dir / 'csv processed'

df = pd.read_excel(csv_processed_dir / '02 – products_cleaned.xlsx', engine='openpyxl')

# Find the 3 courses that are mismatched
courses_to_find = ['Beginners Photography Course', 'Intermediates Intentions', 'Beginners Portrait Photography']

print("Exact product names for courses:\n")
for idx, row in df.iterrows():
    name = row['name']
    if any(c in name for c in courses_to_find):
        print(f"'{name}'")

