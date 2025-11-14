#!/usr/bin/env python3
import pandas as pd
from pathlib import Path

# Updated to use shared-resources structure
script_dir = Path(__file__).parent
project_root = script_dir.parent
shared_resources_dir = project_root.parent / 'alan-shared-resources'
csv_processed_dir = shared_resources_dir / 'csv processed'

df = pd.read_excel(csv_processed_dir / '02 – products_cleaned.xlsx')
row = df[df['name'].str.contains('WOODLAND', case=False, na=False)]
print('Name:', row.iloc[0]['name'])
print('URL:', row.iloc[0]['url'])
print('Schema:', row.iloc[0]['schema_type'])
print('\nChecking URL pattern:')
url = str(row.iloc[0]['url']).lower()
print(f"  '/photo-workshops-uk/' in URL: {'/photo-workshops-uk/' in url}")

