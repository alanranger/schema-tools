#!/usr/bin/env python3
import pandas as pd
from pathlib import Path

# Updated to use shared-resources structure
script_dir = Path(__file__).parent
project_root = script_dir.parent
shared_resources_dir = project_root.parent / 'alan-shared-resources'
csv_processed_dir = shared_resources_dir / 'csv processed'

df = pd.read_excel(csv_processed_dir / '02 – products_cleaned.xlsx', engine='openpyxl')

print("Current schema_type counts:")
print(df['schema_type'].value_counts())
print("\n" + "="*80)
print("All products with schema_type:")
print("="*80)
for idx, row in df.iterrows():
    print(f"{row['schema_type']:8s}: {row['name'][:70]}")

