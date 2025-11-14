import pandas as pd
from pathlib import Path

raw_file = Path('inputs-files/workflow/01 - products_Nov-05_04-25-26PM.csv')
df_raw = pd.read_csv(raw_file, encoding='utf-8')

print("="*60)
print("RAW FILE DETAILED ANALYSIS")
print("="*60)
print(f"Total rows: {len(df_raw)}")
print(f"\nChecking for variants by Title grouping:")

# Group by Title to see if there are multiple rows with same title
title_counts = df_raw['Title'].value_counts()
multi_title = title_counts[title_counts > 1]

print(f"\nTitles that appear multiple times: {len(multi_title)}")
if len(multi_title) > 0:
    print("\nSample products with multiple rows (variants?):")
    for title, count in multi_title.head(10).items():
        print(f"\n  '{title[:60]}' appears {count} times")
        rows = df_raw[df_raw['Title'] == title]
        for idx, row in rows.head(3).iterrows():
            sku = str(row.get('SKU', '')).strip()
            price = str(row.get('Price', '')).strip()
            option = str(row.get('Option Value 1', '')).strip()
            visible = str(row.get('Visible', '')).strip()
            print(f"    Row {idx}: SKU={sku}, Price={price}, Option={option[:30]}, Visible={visible}")

# Check for rows with empty Title
empty_title = df_raw[df_raw['Title'].astype(str).str.strip() == '']
print(f"\n\nRows with empty Title: {len(empty_title)}")
if len(empty_title) > 0:
    print("Sample empty Title rows:")
    for idx, row in empty_title.head(5).iterrows():
        sku = str(row.get('SKU', '')).strip()
        price = str(row.get('Price', '')).strip()
        option = str(row.get('Option Value 1', '')).strip()
        visible = str(row.get('Visible', '')).strip()
        print(f"  Row {idx}: SKU={sku}, Price={price}, Option={option[:30]}, Visible={visible}")

# Check Visible field distribution
print(f"\n\nVisible field distribution:")
print(df_raw['Visible'].value_counts())

# Check if variants might be identified by Product ID grouping
if 'Product ID [Non Editable]' in df_raw.columns:
    print(f"\n\nProduct ID grouping:")
    prod_id_counts = df_raw['Product ID [Non Editable]'].value_counts()
    multi_prod_id = prod_id_counts[prod_id_counts > 1]
    print(f"Product IDs with multiple rows: {len(multi_prod_id)}")
    if len(multi_prod_id) > 0:
        print("\nSample Product IDs with multiple rows:")
        for prod_id, count in multi_prod_id.head(5).items():
            print(f"\n  Product ID {prod_id}: {count} rows")
            rows = df_raw[df_raw['Product ID [Non Editable]'] == prod_id]
            for idx, row in rows.head(3).iterrows():
                title = str(row.get('Title', '')).strip()
                sku = str(row.get('SKU', '')).strip()
                price = str(row.get('Price', '')).strip()
                print(f"    Row {idx}: Title='{title[:40]}', SKU={sku}, Price={price}")

