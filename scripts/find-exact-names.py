#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import pandas as pd
from pathlib import Path
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

df = pd.read_excel('inputs-files/workflow/02 – products_cleaned.xlsx', engine='openpyxl')

# Find the 3 courses that are mismatched
courses_to_find = ['Beginners Photography Course', 'Intermediates Intentions', 'Beginners Portrait Photography']

print("Exact product names for courses:\n")
for idx, row in df.iterrows():
    name = row['name']
    if any(c in name for c in courses_to_find):
        print(f"'{name}'")

