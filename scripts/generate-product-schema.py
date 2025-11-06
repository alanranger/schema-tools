#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Product Schema Generation Script
Stage 4: Generate JSON-LD schema files from merged product data

Reads:
  - inputs-files/workflow/03 – products_with_review_data_final.xlsx

Outputs:
  - Individual .json files to outputs/
  - Individual .html files (script tags) to outputs/
  - Combined CSV: inputs-files/workflow/04 – alanranger_product_schema_FINAL_WITH_REVIEW_RATINGS.csv
"""

import pandas as pd
import json
from pathlib import Path
import sys
import os
from datetime import datetime
import re

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

def sanitize_filename(name):
    """Convert product name to safe filename"""
    if not name:
        return 'product'
    # Remove special characters and replace spaces with underscores
    name = re.sub(r'[^\w\s-]', '', str(name))
    name = re.sub(r'[-\s]+', '_', name)
    return name[:50]  # Limit length

def generate_product_schema(product_row):
    """Generate JSON-LD schema for a single product"""
    schema = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": str(product_row.get('name', '')).strip(),
    }
    
    # Add optional fields
    if product_row.get('description'):
        schema["description"] = str(product_row.get('description', '')).strip()
    
    if product_row.get('image'):
        schema["image"] = str(product_row.get('image', '')).strip()
    
    if product_row.get('url'):
        schema["url"] = str(product_row.get('url', '')).strip()
    
    # Add offers if price is available
    price = product_row.get('price')
    if price and pd.notna(price):
        schema["offers"] = {
            "@type": "Offer",
            "price": str(price),
            "priceCurrency": "GBP",
            "availability": "https://schema.org/InStock",
            "url": schema.get("url", "")
        }
    
    # Add reviews if available
    reviews_json = product_row.get('reviews', '[]')
    review_count = product_row.get('review_count', 0)
    average_rating = product_row.get('average_rating')
    
    if review_count and review_count > 0 and average_rating:
        try:
            reviews = json.loads(reviews_json) if isinstance(reviews_json, str) else reviews_json
            
            schema["aggregateRating"] = {
                "@type": "AggregateRating",
                "ratingValue": str(average_rating),
                "reviewCount": int(review_count)
            }
            
            if reviews:
                schema["review"] = []
                for r in reviews:
                    review_obj = {
                        "@type": "Review",
                        "reviewRating": {
                            "@type": "Rating",
                            "ratingValue": str(r.get('rating', 5)),
                            "bestRating": "5",
                            "worstRating": "1"
                        },
                        "reviewBody": str(r.get('body', '')).strip()
                    }
                    if r.get('author'):
                        review_obj["author"] = {
                            "@type": "Person",
                            "name": str(r.get('author', 'Anonymous'))
                        }
                    schema["review"].append(review_obj)
        except (json.JSONDecodeError, TypeError) as e:
            print(f"⚠️  Warning: Could not parse reviews for {schema.get('name', 'unknown')}: {e}")
    
    return schema

def schema_to_html(schema_json):
    """Convert schema JSON to HTML script tag"""
    return f'<script type="application/ld+json">\n{json.dumps(schema_json, indent=2, ensure_ascii=False)}\n</script>'

def main():
    workflow_dir = Path('inputs-files/workflow')
    outputs_dir = Path('outputs')
    outputs_dir.mkdir(exist_ok=True)
    
    # Find input file - check for both Excel and CSV files from Step 3
    input_files = []
    patterns = ['03*.xlsx', 'products_with_review_data_final*.xlsx', '03*.csv', 'combined_product_reviews*.csv']
    for pattern in patterns:
        input_files.extend(list(workflow_dir.glob(pattern)))
    
    if not input_files:
        print("❌ Error: No input file found")
        print(f"   Expected: {workflow_dir.absolute()}/03 – products_with_review_data_final.xlsx")
        print(f"   Or: {workflow_dir.absolute()}/03 – combined_product_reviews.csv")
        sys.exit(1)
    
    input_file = sorted(input_files)[-1]
    print(f"📂 Reading: {input_file.name}")
    
    try:
        # Try Excel first, then CSV
        if input_file.suffix.lower() == '.xlsx':
            df = pd.read_excel(input_file, engine='openpyxl')
        elif input_file.suffix.lower() == '.csv':
            df = pd.read_csv(input_file, encoding='utf-8-sig')
            print("ℹ️ Reading CSV file (from Step 3b merge)")
        else:
            print(f"❌ Unsupported file format: {input_file.suffix}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        sys.exit(1)
    
    print(f"✅ Loaded {len(df)} products")
    
    # Generate schemas
    schemas_data = []
    json_files = []
    html_files = []
    
    for idx, row in df.iterrows():
        product_name = str(row.get('name', '')).strip()
        if not product_name:
            continue
        
        # Generate schema
        schema = generate_product_schema(row)
        
        # Save individual JSON file
        safe_name = sanitize_filename(product_name)
        json_filename = f"{safe_name}_{idx}.json"
        json_path = outputs_dir / json_filename
        
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(schema, f, indent=2, ensure_ascii=False)
        
        json_files.append(json_filename)
        
        # Save individual HTML file
        html_filename = f"{safe_name}_{idx}.html"
        html_path = outputs_dir / html_filename
        
        html_content = schema_to_html(schema)
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        html_files.append(html_filename)
        
        # Prepare for combined CSV
        schemas_data.append({
            'product_name': product_name,
            'url': row.get('url', ''),
            'schema_json': json.dumps(schema, ensure_ascii=False),
            'schema_html': html_content,
            'review_count': row.get('review_count', 0),
            'average_rating': row.get('average_rating', ''),
            'has_reviews': 'Yes' if row.get('review_count', 0) > 0 else 'No'
        })
    
    print(f"✅ Generated {len(json_files)} JSON files")
    print(f"✅ Generated {len(html_files)} HTML files")
    
    # Save combined CSV
    schemas_df = pd.DataFrame(schemas_data)
    output_csv = workflow_dir / '04 – alanranger_product_schema_FINAL_WITH_REVIEW_RATINGS.csv'
    
    try:
        schemas_df.to_csv(output_csv, index=False, encoding='utf-8')
        print(f"✅ Saved combined CSV: {output_csv.name}")
    except Exception as e:
        print(f"❌ Error saving CSV: {e}")
        sys.exit(1)
    
    # Summary
    products_with_reviews = len(schemas_df[schemas_df['has_reviews'] == 'Yes'])
    print("\n" + "="*60)
    print("📊 SCHEMA GENERATION SUMMARY")
    print("="*60)
    print(f"Total products: {len(schemas_df)}")
    print(f"Products with reviews: {products_with_reviews}")
    print(f"Products without reviews: {len(schemas_df) - products_with_reviews}")
    print(f"JSON files saved to: {outputs_dir.absolute()}")
    print(f"HTML files saved to: {outputs_dir.absolute()}")
    print(f"Combined CSV saved to: {output_csv.absolute()}")
    print("="*60)
    print("\n✅ Schema generation complete!")

if __name__ == '__main__':
    main()

