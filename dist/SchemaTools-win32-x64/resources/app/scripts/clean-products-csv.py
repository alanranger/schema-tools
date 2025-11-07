#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Squarespace Product Export Normalization Script
Stage 1: Clean and standardize Squarespace product export CSV

Reads: inputs-files/workflow/01 – products_<date/time>.csv
Outputs: inputs-files/workflow/02 – products_cleaned.xlsx
"""

import pandas as pd
import re
import html
from pathlib import Path
import sys
import os
import urllib.request
import urllib.error
from urllib.parse import urlparse

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
    """Build full URL from Product Page (parent category) and Product URL (slug)
    
    If Product URL is generic (like 'print', 'canvas'), generate unique slug from product name.
    """
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
        # Fallback: if no Product Page, just use Product URL
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

def main():
    # Find the input CSV file
    workflow_dir = Path('inputs-files/workflow')
    # Try multiple patterns for the dash character
    csv_files = []
    patterns = ['01 – products_*.csv', '01 - products_*.csv', '01–products_*.csv', '01-products_*.csv']
    for pattern in patterns:
        csv_files.extend(list(workflow_dir.glob(pattern)))
    
    if not csv_files:
        print("Error: No CSV file found matching pattern '01 [dash] products_*.csv'")
        print(f"   Expected location: {workflow_dir.absolute()}")
        print(f"   Looking for files starting with '01' and containing 'products'")
        sys.exit(1)
    
    # Use the most recent file if multiple exist
    input_file = sorted(csv_files)[-1]
    print(f"📂 Reading: {input_file.name}")
    
    # Read CSV
    try:
        df = pd.read_csv(input_file, encoding='utf-8')
    except Exception as e:
        print(f"❌ Error reading CSV: {e}")
        sys.exit(1)
    
    print(f"✅ Loaded {len(df)} rows, {len(df.columns)} columns")
    
    # Verify it's a Squarespace export
    expected_columns = ['Title', 'Product URL', 'Description', 'Hosted Image URLs', 'Price']
    missing_columns = [col for col in expected_columns if col not in df.columns]
    if missing_columns:
        print(f"⚠️  Warning: Missing expected columns: {missing_columns}")
        print(f"   Available columns: {list(df.columns)[:10]}...")
    
    # Create cleaned DataFrame
    cleaned_data = []
    url_errors = []
    
    print("\n🔍 Processing products and validating URLs...")
    
    for idx, row in df.iterrows():
        # Map columns
        name = str(row.get('Title', '')).strip() if pd.notna(row.get('Title')) else ''
        description = strip_html(row.get('Description', ''))
        image = extract_first_image(row.get('Hosted Image URLs', ''))
        # Build full URL from Product Page (parent category) + Product URL (slug)
        # Pass product name to generate unique slugs for generic URLs
        url = normalize_url(row.get('Product Page', ''), row.get('Product URL', ''), product_name=name)
        price = normalize_price(row.get('Price', ''))
        category = str(row.get('Categories', '')).strip() if pd.notna(row.get('Categories')) else ''
        
        # Validate URL
        if url:
            is_valid, error_msg = validate_url(url)
            if not is_valid:
                url_errors.append({
                    'row': idx + 1,
                    'name': name[:50],
                    'url': url,
                    'error': error_msg
                })
        
        cleaned_data.append({
            'name': name,
            'description': description,
            'image': image,
            'url': url,
            'price': price,
            'category': category
        })
    
    # Report URL errors
    if url_errors:
        print(f"\n⚠️  URL VALIDATION ERRORS ({len(url_errors)} found):")
        print("="*60)
        for error in url_errors[:20]:  # Show first 20 errors
            print(f"Row {error['row']}: {error['name']}")
            print(f"  URL: {error['url']}")
            print(f"  Error: {error['error']}")
            print()
        if len(url_errors) > 20:
            print(f"... and {len(url_errors) - 20} more errors")
        print("="*60)
    else:
        print("✅ All URLs validated successfully")
    
    cleaned_df = pd.DataFrame(cleaned_data)
    
    # Save as Excel
    output_file = workflow_dir / '02 – products_cleaned.xlsx'
    try:
        cleaned_df.to_excel(output_file, index=False, engine='openpyxl')
        print(f"✅ Saved: {output_file.name}")
    except ImportError:
        print("❌ Error: openpyxl library not installed. Install with: pip install openpyxl")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error saving Excel file: {e}")
        sys.exit(1)
    
    # Summary
    print("\n" + "="*60)
    print("📊 CLEANED FILE SUMMARY")
    print("="*60)
    print(f"Rows: {len(cleaned_df)}")
    print(f"Columns: {len(cleaned_df.columns)}")
    print(f"Columns: {', '.join(cleaned_df.columns)}")
    print("\n📋 Sample (first 3 rows):")
    print("-"*60)
    for idx in range(min(3, len(cleaned_df))):
        row = cleaned_df.iloc[idx]
        print(f"\nRow {idx + 1}:")
        print(f"  name: {row['name'][:50]}..." if len(str(row['name'])) > 50 else f"  name: {row['name']}")
        print(f"  description: {row['description'][:50]}..." if len(str(row['description'])) > 50 else f"  description: {row['description']}")
        print(f"  image: {row['image']}")
        print(f"  url: {row['url']}")
        print(f"  price: {row['price']}")
        print(f"  category: {row['category']}")
    
    # Show URL validation summary
    if url_errors:
        print(f"\n⚠️  URL Errors: {len(url_errors)} products have invalid URLs")
        print("   Check the error list above for details")
    print("="*60)
    print(f"\n✅ Success! Cleaned file saved to: {output_file.absolute()}")

if __name__ == '__main__':
    main()

