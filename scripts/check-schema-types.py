#!/usr/bin/env python3
import pandas as pd
from pathlib import Path

workflow_dir = Path('inputs-files/workflow')
df = pd.read_excel(workflow_dir / '02 – products_cleaned.xlsx', engine='openpyxl')

print("Current schema_type counts:")
print(df['schema_type'].value_counts())
print("\n" + "="*80)
print("All products with schema_type:")
print("="*80)
for idx, row in df.iterrows():
    print(f"{row['schema_type']:8s}: {row['name'][:70]}")

