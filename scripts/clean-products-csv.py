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

def normalize_url(url):
    """Ensure URL has https://www.alanranger.com prefix if missing"""
    if pd.isna(url) or not url:
        return ''
    url = str(url).strip()
    if not url:
        return ''
    if url.startswith('http://') or url.startswith('https://'):
        return url
    # Remove leading slash if present
    if url.startswith('/'):
        url = url[1:]
    return f'https://www.alanranger.com/{url}'

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
    
    for idx, row in df.iterrows():
        # Map columns
        name = str(row.get('Title', '')).strip() if pd.notna(row.get('Title')) else ''
        description = strip_html(row.get('Description', ''))
        image = extract_first_image(row.get('Hosted Image URLs', ''))
        url = normalize_url(row.get('Product URL', ''))
        price = normalize_price(row.get('Price', ''))
        category = str(row.get('Categories', '')).strip() if pd.notna(row.get('Categories')) else ''
        
        cleaned_data.append({
            'name': name,
            'description': description,
            'image': image,
            'url': url,
            'price': price,
            'category': category
        })
    
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
    print("="*60)
    print(f"\n✅ Success! Cleaned file saved to: {output_file.absolute()}")

if __name__ == '__main__':
    main()

