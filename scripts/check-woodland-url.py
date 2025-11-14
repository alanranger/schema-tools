#!/usr/bin/env python3
import pandas as pd

df = pd.read_excel('inputs-files/workflow/02 – products_cleaned.xlsx')
row = df[df['name'].str.contains('WOODLAND', case=False, na=False)]
print('Name:', row.iloc[0]['name'])
print('URL:', row.iloc[0]['url'])
print('Schema:', row.iloc[0]['schema_type'])
print('\nChecking URL pattern:')
url = str(row.iloc[0]['url']).lower()
print(f"  '/photo-workshops-uk/' in URL: {'/photo-workshops-uk/' in url}")

