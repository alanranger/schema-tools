#!/usr/bin/env python3
"""Check which products match the unmatched Reference Ids"""

import pandas as pd
from pathlib import Path

products_path = Path("inputs-files/workflow/02 – products_cleaned.xlsx")
products = pd.read_excel(products_path, engine='openpyxl')
products['slug'] = products['url'].apply(lambda u: str(u).split('/')[-1].strip() if pd.notna(u) else '')

unmatched_refs = [
    'Alan Ranger Photography',
    'Bracketing and Filters',
    'Brandon Marsh Workshop',
    'Dee Valley Workshop',
    'French Riviera',
    'Gift Vouchers',
    'Landscape Photography Workshop Glencoe',
    'Photography Masterclasses-Learn and improve your photography',
    'Sunflower Shoot'
]

print("="*80)
print("CHECKING UNMATCHED REFERENCE IDS AGAINST PRODUCTS")
print("="*80)
print()

for ref in unmatched_refs:
    print(f"Reference Id: {ref}")
    # Try exact match
    exact = products[products['name'].str.contains(ref, case=False, na=False)]
    if len(exact) > 0:
        print(f"  Exact match: {exact['name'].tolist()}")
    else:
        # Try partial match
        words = ref.lower().split()
        for word in words:
            if len(word) > 4:
                partial = products[products['name'].str.contains(word, case=False, na=False)]
                if len(partial) > 0:
                    print(f"  Partial match ({word}): {partial['name'].tolist()}")
                    break
    print()

# Also list all products to see what we have
print("="*80)
print("ALL PRODUCTS")
print("="*80)
for idx, row in products.iterrows():
    if pd.notna(row['name']):
        print(f"{row['name']} -> {row['slug']}")

