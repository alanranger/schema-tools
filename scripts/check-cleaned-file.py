import pandas as pd
import json
from pathlib import Path

# Updated to use shared-resources structure
script_dir = Path(__file__).parent
project_root = script_dir.parent
shared_resources_dir = project_root.parent / 'alan-shared-resources'
csv_dir = shared_resources_dir / 'csv'
csv_processed_dir = shared_resources_dir / 'csv processed'

# Check cleaned file
cleaned_file = csv_processed_dir / '02 – products_cleaned.xlsx'
if cleaned_file.exists():
    df_cleaned = pd.read_excel(cleaned_file)
    print("="*60)
    print("CLEANED FILE ANALYSIS")
    print("="*60)
    print(f"Total products: {len(df_cleaned)}")
    print(f"\nVariant counts:")
    print(df_cleaned['total_variants'].value_counts().sort_index())
    
    print(f"\nProducts with variants > 1:")
    multi = df_cleaned[df_cleaned['total_variants'] > 1]
    print(f"Count: {len(multi)}")
    if len(multi) > 0:
        print("\nSample products with multiple variants:")
        for idx, row in multi.head(5).iterrows():
            offers = json.loads(row['offers'])
            print(f"\n  {row['name'][:60]}")
            print(f"    Total variants: {row['total_variants']}")
            print(f"    Offers in JSON: {len(offers)}")
            print(f"    Price range: £{row['lowest_price']:.2f} - £{row['highest_price']:.2f}")
            print(f"    First 3 offers:")
            for i, offer in enumerate(offers[:3]):
                print(f"      {i+1}. SKU={offer.get('sku', 'N/A')}, Price=£{offer.get('price', 'N/A')}, Name={offer.get('name', 'N/A')[:40]}")
    
    print(f"\n\nFirst product details:")
    first = df_cleaned.iloc[0]
    offers = json.loads(first['offers'])
    print(f"  Name: {first['name']}")
    print(f"  Total variants: {first['total_variants']}")
    print(f"  Offers in JSON: {len(offers)}")
    print(f"  All offers:")
    for i, offer in enumerate(offers):
        print(f"    {i+1}. SKU={offer.get('sku', 'N/A')}, Price=£{offer.get('price', 'N/A')}, Name={offer.get('name', 'N/A')[:50]}")

# Check raw file (look for raw products CSV in csv root)
raw_file = csv_dir / 'raw-01-products-sqsp-export.csv'
if raw_file.exists():
    print("\n\n" + "="*60)
    print("RAW FILE ANALYSIS")
    print("="*60)
    df_raw = pd.read_csv(raw_file, encoding='utf-8')
    print(f"Total rows: {len(df_raw)}")
    
    main = df_raw[df_raw['Title'].astype(str).str.strip() != '']
    variants = df_raw[df_raw['Title'].astype(str).str.strip() == '']
    print(f"Main products: {len(main)}")
    print(f"Variants: {len(variants)}")
    
    print(f"\nFirst main product + following variants:")
    first_main_idx = main.index[0]
    first_main = main.iloc[0]
    print(f"  Main product at row {first_main_idx}: {first_main['Title']}")
    print(f"  SKU: {first_main.get('SKU', 'N/A')}")
    print(f"  Price: {first_main.get('Price', 'N/A')}")
    
    # Find variants that follow
    following_rows = []
    for idx in range(first_main_idx + 1, min(first_main_idx + 10, len(df_raw))):
        row = df_raw.iloc[idx]
        title = str(row.get('Title', '')).strip()
        if title:  # Hit another main product
            break
        following_rows.append((idx, row))
    
    print(f"\n  Following variants ({len(following_rows)}):")
    for idx, row in following_rows[:5]:
        sku = str(row.get('SKU', '')).strip()
        price = str(row.get('Price', '')).strip()
        option = str(row.get('Option Value 1', '')).strip()
        print(f"    Row {idx}: SKU={sku}, Price={price}, Option={option[:40]}")

