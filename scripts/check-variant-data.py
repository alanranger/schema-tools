#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Quick script to check variant data in 01 products file"""

import pandas as pd
from pathlib import Path

workflow_dir = Path('inputs-files/workflow')
csv_files = list(workflow_dir.glob('01*products*.csv'))

if not csv_files:
    print("❌ No 01 products file found")
    exit(1)

input_file = sorted(csv_files)[-1]
print(f"Reading: {input_file.name}\n")

df = pd.read_csv(input_file, encoding='utf-8')

print(f"Total rows: {len(df)}")
print(f"Total columns: {len(df.columns)}")
print(f"\nAll columns:")
for i, col in enumerate(df.columns, 1):
    print(f"  {i}. {col}")

# Find variant rows (empty Title)
variants = df[df['Title'].isna() | (df['Title'].astype(str).str.strip() == '')]
main_products = df[df['Title'].notna() & (df['Title'].astype(str).str.strip() != '')]

print(f"\nRow breakdown:")
print(f"  Main products (with Title): {len(main_products)}")
print(f"  Variant rows (empty Title): {len(variants)}")

if len(variants) > 0:
    print(f"\nVariant row analysis:")
    print(f"\nFirst variant row data:")
    variant_row = variants.iloc[0]
    for col in df.columns:
        val = variant_row.get(col)
        if pd.notna(val) and str(val).strip():
            print(f"  {col}: {val}")
    
    print(f"\nVariant columns with data:")
    variant_cols_with_data = []
    for col in df.columns:
        non_empty = variants[col].notna() & (variants[col].astype(str).str.strip() != '')
        count = non_empty.sum()
        if count > 0:
            variant_cols_with_data.append((col, count))
            print(f"  {col}: {count} variants have data")
    
    # Check if variants have Price
    if 'Price' in df.columns:
        prices = variants['Price'].dropna()
        print(f"\nVariant prices:")
        print(f"  Variants with prices: {len(prices)}")
        if len(prices) > 0:
            print(f"  Price range: £{prices.min():.2f} - £{prices.max():.2f}")
            print(f"  Sample prices: {sorted(prices.unique())[:10]}")
    
    # Check Product ID / Variant ID
    for id_col in ['Product ID [Non Editable]', 'Variant ID [Non Editable]', 'SKU']:
        if id_col in df.columns:
            print(f"\n{id_col}:")
            main_ids = main_products[id_col].dropna().unique()
            variant_ids = variants[id_col].dropna().unique()
            print(f"  Main products: {len(main_ids)} unique values")
            print(f"  Variants: {len(variant_ids)} unique values")
            if len(main_ids) > 0 and len(variant_ids) > 0:
                # Check if variants share Product ID with main products
                shared = set(main_ids) & set(variant_ids)
                print(f"  Shared IDs: {len(shared)}")
                if len(shared) > 0:
                    print(f"  Variants link to main products via Product ID")
                else:
                    print(f"  Note: Variants don't share Product IDs with main products")

print(f"\nSample main product row:")
main_row = main_products.iloc[0]
for col in ['Title', 'Product ID [Non Editable]', 'Variant ID [Non Editable]', 'SKU', 'Price', 'Product URL', 'Product Page']:
    if col in df.columns:
        val = main_row.get(col)
        print(f"  {col}: {val}")

# Check if variants link via Product URL instead
if len(variants) > 0 and 'Product URL' in df.columns:
    print(f"\nChecking variant linking via Product URL:")
    variant_urls = variants['Product URL'].dropna().unique()
    main_urls = main_products['Product URL'].dropna().unique()
    shared_urls = set(variant_urls) & set(main_urls)
    print(f"  Variants with Product URL: {len(variant_urls)}")
    print(f"  Main products with Product URL: {len(main_urls)}")
    print(f"  Shared URLs: {len(shared_urls)}")
    if len(shared_urls) > 0:
        print(f"  Variants link to main products via Product URL")

# Check position-based linking (variants follow main products)
print(f"\nChecking position-based linking:")
print(f"  First 10 rows structure:")
for i in range(min(10, len(df))):
    row = df.iloc[i]
    title = row.get('Title', '')
    price = row.get('Price', '')
    prod_id = row.get('Product ID [Non Editable]', '')
    variant_id = row.get('Variant ID [Non Editable]', '')
    sku = row.get('SKU', '')
    option = row.get('Option Value 1', '')
    
    title_str = str(title)[:30] if pd.notna(title) and str(title).strip() else "(empty - variant)"
    print(f"  Row {i+1}: Title={title_str}, Price={price}, SKU={sku}")
    if pd.notna(option) and str(option).strip():
        print(f"           Option: {str(option)[:50]}")

