#!/usr/bin/env python3
"""Check which products have reviews and which don't"""

import pandas as pd
from pathlib import Path

base_path = Path("inputs-files/workflow")
combined_path = base_path / "03 – combined_product_reviews.csv"
products_path = base_path / "02 – products_cleaned.xlsx"

products = pd.read_excel(products_path, engine='openpyxl')
products = products[products['name'].notna() & (products['name'] != '')]
products['slug'] = products['url'].apply(lambda u: str(u).split('/')[-1].strip() if pd.notna(u) else '')
products = products[products['slug'] != '']

combined = pd.read_csv(combined_path, encoding="utf-8-sig")
products_with_reviews = set(combined[combined['product_slug'].notna() & (combined['product_slug'] != '')]['product_slug'].unique())

print("="*80)
print("PRODUCTS WITHOUT REVIEWS")
print("="*80)
print()

products_without = []
for idx, row in products.iterrows():
    slug = row['slug']
    if slug not in products_with_reviews:
        products_without.append({
            'name': row['name'],
            'slug': slug
        })

print(f"Total products: {len(products)}")
print(f"Products with reviews: {len(products_with_reviews)}")
print(f"Products without reviews: {len(products_without)}")
print()

if products_without:
    print("Products without reviews:")
    for p in products_without:
        print(f"  - {p['name']}")
        print(f"    Slug: {p['slug']}")
        print()


