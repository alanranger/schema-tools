#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Squarespace Product Export Normalization Script - v2.0
Stage 1: Clean and group products with variants into offers arrays

Reads: inputs-files/workflow/01 – products_<date/time>.csv
Outputs: inputs-files/workflow/02 – products_cleaned.xlsx

New in v2.0:
- Groups products by Title (main product + variants)
- Creates offers JSON array for each product
- Includes all variant details (SKU, Price, Option Value, etc.)
"""

import pandas as pd
import json
import re
import html
from pathlib import Path
import sys
import os
import urllib.request
import urllib.error
from urllib.parse import urlparse
from datetime import date, timedelta

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

def strip_html(text):
    """Remove HTML tags and decode HTML entities"""
    if pd.isna(text) or not text:
        return ''
    text = str(text)
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Decode HTML entities
    text = html.unescape(text)
    # Clean up whitespace
    text = ' '.join(text.split())
    return text.strip()

def extract_first_image(image_urls):
    """Extract first valid HTTPS URL from image URLs column"""
    if pd.isna(image_urls) or not image_urls:
        return ''
    urls = str(image_urls).split()
    for url in urls:
        url = url.strip()
        if url.startswith('https://'):
            return url
    return ''

def normalize_price(price_str):
    """Convert price string to numeric (remove £, GBP, etc.)"""
    if pd.isna(price_str) or not price_str:
        return None
    price_str = str(price_str).strip()
    # Remove currency symbols and text
    price_str = re.sub(r'[£GBP,\s]', '', price_str)
    try:
        return float(price_str)
    except ValueError:
        return None

def slugify(text):
    """Convert text to URL-friendly slug"""
    if not text:
        return ''
    # Convert to lowercase, replace spaces and special chars with hyphens
    slug = re.sub(r'[^a-z0-9]+', '-', str(text).lower().strip())
    # Remove leading/trailing hyphens and multiple consecutive hyphens
    slug = re.sub(r'-+', '-', slug).strip('-')
    return slug

def normalize_url(product_page, product_url, product_name=None):
    """Build full URL from Product Page (parent category) and Product URL (slug)"""
    # Handle Product Page (parent category slug)
    if pd.isna(product_page) or not product_page:
        product_page = ''
    else:
        product_page = str(product_page).strip()
    
    # Handle Product URL (product slug)
    if pd.isna(product_url) or not product_url:
        product_url = ''
    else:
        product_url = str(product_url).strip()
    
    # If Product URL already contains full URL, return as-is
    if product_url.startswith('http://') or product_url.startswith('https://'):
        return product_url
    
    # List of generic slugs that should be replaced with name-based slugs
    generic_slugs = ['print', 'canvas', 'framed', 'unframed', 'mounted', 'service']
    
    # If Product URL is generic and we have a product name, generate slug from name
    if product_url.lower() in generic_slugs and product_name:
        product_url = slugify(product_name)
    
    # Remove leading/trailing slashes
    product_page = product_page.strip('/')
    product_url = product_url.strip('/')
    
    # Build full URL: https://www.alanranger.com/{Product Page}/{Product URL}
    if product_page and product_url:
        return f'https://www.alanranger.com/{product_page}/{product_url}'
    elif product_url:
        return f'https://www.alanranger.com/{product_url}'
    else:
        return ''

def validate_url(url, timeout=5):
    """Check if URL returns 200 OK (not 404)"""
    if not url or not url.startswith('http'):
        return False, 'Invalid URL format'
    
    try:
        req = urllib.request.Request(url, method='HEAD')
        req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        with urllib.request.urlopen(req, timeout=timeout) as response:
            status_code = response.getcode()
            if status_code == 200:
                return True, 'OK'
            else:
                return False, f'HTTP {status_code}'
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False, '404 Not Found'
        return False, f'HTTP {e.code}'
    except urllib.error.URLError as e:
        return False, f'URL Error: {str(e)}'
    except Exception as e:
        return False, f'Error: {str(e)}'

def create_offer_from_row(row):
    """Create an Offer object from a CSV row"""
    sku = str(row.get('SKU', '')).strip() if pd.notna(row.get('SKU')) else ''
    if not sku or sku.lower() in ['nan', 'none', '']:
        return None
    
    sku = sku[:40]  # Truncate to 40 chars for Merchant Center compliance
    
    price = normalize_price(row.get('Price', ''))
    if price is None or price <= 0:
        return None
    
    sale_price = normalize_price(row.get('Sale Price', ''))
    on_sale = str(row.get('On Sale', '')).strip().lower() == 'yes'
    
    # Use sale price if on sale and sale price is valid
    final_price = sale_price if (on_sale and sale_price and sale_price > 0) else price
    
    # Get option value for offer name
    option_value = str(row.get('Option Value 1', '')).strip() if pd.notna(row.get('Option Value 1')) else ''
    if not option_value or option_value.lower() == 'nan':
        option_value = ''  # Will use SKU as fallback
    
    # Determine availability
    stock = row.get('Stock', '')
    if pd.notna(stock):
        try:
            stock_val = int(float(stock))
            availability = "https://schema.org/InStock" if stock_val > 0 else "https://schema.org/OutOfStock"
        except:
            availability = "https://schema.org/InStock"
    else:
        availability = "https://schema.org/InStock"
    
    # Calculate dates
    valid_from = date.today().isoformat()
    price_valid_until = (date.today() + timedelta(days=365)).isoformat()
    
    offer = {
        "@type": "Offer",
        "sku": sku,
        "price": f"{final_price:.2f}",
        "priceCurrency": "GBP",
        "availability": availability,
        "validFrom": valid_from,
        "priceValidUntil": price_valid_until
    }
    
    # Add name if option value exists
    if option_value:
        offer["name"] = option_value
    
    # Add priceSpecification if on sale
    if on_sale and sale_price and sale_price > 0 and sale_price != price:
        offer["priceSpecification"] = {
            "price": f"{sale_price:.2f}",
            "priceCurrency": "GBP"
        }
    
    return offer

def main():
    # Find the input CSV file
    workflow_dir = Path('inputs-files/workflow')
    csv_files = []
    patterns = ['01 – products_*.csv', '01 - products_*.csv', '01–products_*.csv', '01-products_*.csv']
    for pattern in patterns:
        csv_files.extend(list(workflow_dir.glob(pattern)))
    
    if not csv_files:
        print("Error: No CSV file found matching pattern '01 [dash] products_*.csv'")
        print(f"   Expected location: {workflow_dir.absolute()}")
        sys.exit(1)
    
    input_file = sorted(csv_files)[-1]
    print(f"Reading: {input_file.name}")
    
    # Read CSV
    try:
        df = pd.read_csv(input_file, encoding='utf-8')
    except Exception as e:
        print(f"Error reading CSV: {e}")
        sys.exit(1)
    
    print(f"Loaded {len(df)} rows, {len(df.columns)} columns")
    
    # Step 1: Filter out rows without SKU first (applies to both main products and variants)
    if 'SKU' in df.columns:
        df = df[df['SKU'].notna()]
        print(f"After filtering SKU not null: {len(df)} rows")
    
    # Step 2: Normalize field types BEFORE filtering Visible (so we can check variants properly)
    df = df.fillna("")
    for col in df.columns:
        if df[col].dtype == 'object':
            df[col] = df[col].apply(lambda x: str(x).strip() if pd.notna(x) else '')
    
    # Step 3: Group by Product Title using position-based linking
    # Variants follow their main product immediately after in CSV
    print(f"\nProduct breakdown:")
    main_count = len(df[df['Title'].astype(str).str.strip() != ''])
    variant_count = len(df[df['Title'].astype(str).str.strip() == ''])
    print(f"  Main products (with Title): {main_count}")
    print(f"  Variant rows (empty Title): {variant_count}")
    
    # Group variants by position (they follow their main product)
    grouped_data = []
    
    # Reset index to use position-based matching
    df_reset = df.reset_index(drop=True)
    
    i = 0
    while i < len(df_reset):
        row = df_reset.iloc[i]
        title = str(row.get('Title', '')).strip()
        
        # Skip if not a main product
        if not title:
            i += 1
            continue
        
        # Check if main product is visible (skip hidden products and their variants)
        if 'Visible' in df.columns:
            visible = str(row.get('Visible', '')).strip().lower()
            if visible != 'yes':
                # Skip this hidden main product and its variants
                i += 1
                # Skip all variants that follow
                while i < len(df_reset):
                    next_row = df_reset.iloc[i]
                    next_title = str(next_row.get('Title', '')).strip()
                    if next_title:  # Hit another main product, stop
                        break
                    i += 1
                continue
        
        # This is a visible main product - get its details
        description = strip_html(row.get('Description', ''))
        image = extract_first_image(row.get('Hosted Image URLs', ''))
        product_page = str(row.get('Product Page', '')).strip()
        product_url_slug = str(row.get('Product URL', '')).strip()
        url = normalize_url(product_page, product_url_slug, product_name=title)
        category = str(row.get('Categories', '')).strip() if pd.notna(row.get('Categories')) else ''
        
        # Get main product SKU
        main_sku = str(row.get('SKU', '')).strip() if pd.notna(row.get('SKU')) else ''
        if main_sku:
            main_sku = main_sku[:40]
        
        # Find variants that follow this main product (position-based)
        product_variants = []
        i += 1  # Move to next row
        # Get next rows until we hit another main product
        while i < len(df_reset):
            next_row = df_reset.iloc[i]
            next_title = str(next_row.get('Title', '')).strip()
            if next_title:  # Hit another main product, stop
                break
            # This is a variant (empty Title), add it
            product_variants.append(next_row.to_dict())
            i += 1
        
        # Create offers array
        offers = []
        
        # Add main product as first offer
        main_offer = create_offer_from_row(row)
        if main_offer:
            offers.append(main_offer)
        
        # Add variant offers
        for variant_row in product_variants:
            variant_offer = create_offer_from_row(pd.Series(variant_row))
            if variant_offer:
                offers.append(variant_offer)
        
        if not offers:
            continue  # Skip products with no valid offers
        
        # Calculate price range
        prices = [float(offer['price']) for offer in offers]
        lowest_price = min(prices)
        highest_price = max(prices)
        
        # Get all SKUs
        skus = [offer['sku'] for offer in offers]
        skus_str = ', '.join(skus)
        
        # Validate URL
        url_valid = True
        if url:
            is_valid, error_msg = validate_url(url)
            if not is_valid:
                url_valid = False
                print(f"Warning: Invalid URL for '{title[:50]}': {error_msg}")
        
        grouped_data.append({
            'name': title,
            'description': description,
            'image': image,
            'url': url,
            'category': category,
            'offers': json.dumps(offers, ensure_ascii=False),  # Store as JSON string
            'total_variants': len(offers),
            'lowest_price': lowest_price,
            'highest_price': highest_price,
            'skus': skus_str,
            'main_sku': main_sku
        })
    
    if not grouped_data:
        print("Error: No products found after grouping")
        sys.exit(1)
    
    cleaned_df = pd.DataFrame(grouped_data)
    
    # Save as Excel
    output_file = workflow_dir / '02 – products_cleaned.xlsx'
    
    # Check if file exists and might be locked
    if output_file.exists():
        print(f"\nOutput file already exists: {output_file.name}")
        print(f"Attempting to overwrite...")
        try:
            output_file.unlink()
            print(f"Removed existing file")
        except PermissionError:
            print(f"\nERROR: Cannot overwrite file - it may be open in Excel")
            print(f"File: {output_file.absolute()}")
            print(f"\nSOLUTION:")
            print(f"1. Close the Excel file if it's open")
            print(f"2. Close any Windows Explorer windows showing this folder")
            print(f"3. Try running Step 2 again")
            sys.exit(1)
        except Exception as e:
            print(f"Could not remove existing file: {e}")
    
    try:
        cleaned_df.to_excel(output_file, index=False, engine='openpyxl')
        print(f"\nSaved: {output_file.name}")
    except ImportError:
        print("Error: openpyxl library not installed. Install with: pip install openpyxl")
        sys.exit(1)
    except PermissionError as e:
        print(f"\nERROR: Permission denied when saving Excel file")
        print(f"File: {output_file.absolute()}")
        print(f"\nSOLUTION:")
        print(f"1. Close the Excel file if it's open in Excel or another program")
        print(f"2. Close any Windows Explorer windows showing this folder")
        print(f"3. Check if another process is using the file (Task Manager)")
        print(f"4. Try running Step 2 again")
        sys.exit(1)
    except Exception as e:
        print(f"Error saving Excel file: {e}")
        print(f"File: {output_file.absolute()}")
        sys.exit(1)
    
    # Summary
    print("\n" + "="*60)
    print("CLEANED FILE SUMMARY")
    print("="*60)
    print(f"Products: {len(cleaned_df)}")
    print(f"Total offers: {cleaned_df['total_variants'].sum()}")
    print(f"Columns: {', '.join(cleaned_df.columns)}")
    print("\nSample (first product):")
    print("-"*60)
    if len(cleaned_df) > 0:
        row = cleaned_df.iloc[0]
        print(f"Name: {row['name']}")
        print(f"Variants: {row['total_variants']}")
        print(f"Price range: £{row['lowest_price']:.2f} - £{row['highest_price']:.2f}")
        print(f"SKUs: {row['skus'][:80]}...")
        offers_sample = json.loads(row['offers'])
        print(f"First offer: SKU={offers_sample[0]['sku']}, Price=£{offers_sample[0]['price']}")
    print("="*60)
    print(f"\nSuccess! Cleaned file saved to: {output_file.absolute()}")

if __name__ == '__main__':
    main()

