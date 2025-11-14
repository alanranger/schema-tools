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
print('Columns:', list(df.columns))
print('\nSchema type column exists:', 'schema_type' in df.columns)

if 'schema_type' in df.columns:
    print('\nSchema type value counts:')
    print(df['schema_type'].value_counts())
    print('\nFirst 10 products with schema types:')
    print(df[['name', 'schema_type']].head(10))
else:
    print('\nNO schema_type COLUMN FOUND!')
    print('Available columns:', list(df.columns))

