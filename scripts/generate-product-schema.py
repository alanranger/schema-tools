#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Product Schema Generation Script - Refactored
Stage 4: Generate Squarespace-ready HTML schema files with @graph structure

Reads:
  - inputs-files/workflow/02 – products_cleaned.xlsx
  - inputs-files/workflow/03 – combined_product_reviews.csv

Outputs:
  - One HTML file per product: [Product_Slug]_schema_squarespace_ready.html in /outputs/
  - Combined CSV: inputs-files/workflow/04 – alanranger_product_schema_FINAL_WITH_REVIEW_RATINGS.csv
"""

import pandas as pd
import json
from pathlib import Path
import sys
import os
from datetime import datetime
import re
from urllib.parse import urlparse
from collections import defaultdict

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# Static schema blocks
ORGANIZER = {
    "@type": "Organization",
    "name": "Alan Ranger Photography",
    "url": "https://www.alanranger.com",
    "logo": "https://images.squarespace-cdn.com/content/v1/5013f4b2c4aaa4752ac69b17/b859ad2b-1442-4595-b9a4-410c32299bf8/ALAN+RANGER+photography+LOGO+BLACK.+switched+small.png?format=1500w",
    "email": "info@alanranger.com",
    "telephone": "+44 781 701 7994",
    "address": {
        "@type": "PostalAddress",
        "streetAddress": "45 Hathaway Road",
        "addressLocality": "Coventry",
        "addressRegion": "West Midlands",
        "postalCode": "CV4 9HW",
        "addressCountry": "GB"
    }
}

PERFORMER = {
    "@type": "Person",
    "name": "Alan Ranger"
}

LOCAL_BUSINESS = {
    "@type": "LocalBusiness",
    "name": "Alan Ranger Photography",
    "url": "https://www.alanranger.com",
    "logo": ORGANIZER["logo"],
    "email": ORGANIZER["email"],
    "telephone": ORGANIZER["telephone"],
    "address": ORGANIZER["address"]
}

def slugify(text):
    """Convert text to URL-friendly slug"""
    if not text:
        return 'product'
    # Convert to lowercase and replace spaces with hyphens
    slug = re.sub(r'[^\w\s-]', '', str(text))
    slug = re.sub(r'[-\s]+', '-', slug)
    slug = slug.lower().strip('-')
    return slug[:100]  # Limit length

def get_breadcrumbs(product_name, product_url):
    """Generate breadcrumb list for product"""
    return {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": "https://www.alanranger.com"
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": "Photo Workshops UK",
                "item": "https://www.alanranger.com/photo-workshops-uk"
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": product_name,
                "item": product_url
            }
        ]
    }

def load_reviews(reviews_path):
    """Load and group reviews by product name"""
    if not reviews_path.exists():
        print(f"⚠️  Reviews file not found: {reviews_path.name}")
        return defaultdict(list)
    
    try:
        df_reviews = pd.read_csv(reviews_path, encoding='utf-8-sig')
        print(f"✅ Loaded {len(df_reviews)} reviews from {reviews_path.name}")
        
        # Normalize column names
        df_reviews.columns = [c.strip().lower().replace(' ', '_') for c in df_reviews.columns]
        
        # Group reviews by product_name
        reviews_by_product = defaultdict(list)
        
        for _, row in df_reviews.iterrows():
            product_name = str(row.get('product_name', '')).strip()
            if not product_name:
                continue
            
            # Only include reviews with rating >= 4
            rating = row.get('rating')
            try:
                rating_val = float(rating) if pd.notna(rating) else 0
                if rating_val < 4:
                    continue
            except (ValueError, TypeError):
                continue
            
            review_obj = {
                "@type": "Review",
                "reviewRating": {
                    "@type": "Rating",
                    "ratingValue": str(int(rating_val)),
                    "bestRating": "5",
                    "worstRating": "1"
                },
                "reviewBody": str(row.get('review', row.get('review_text', ''))).strip()
            }
            
            # Add author if available
            reviewer = row.get('reviewer', row.get('author', ''))
            if reviewer and str(reviewer).strip():
                review_obj["author"] = {
                    "@type": "Person",
                    "name": str(reviewer).strip()
                }
            
            reviews_by_product[product_name].append(review_obj)
        
        print(f"✅ Grouped reviews for {len(reviews_by_product)} products")
        return reviews_by_product
        
    except Exception as e:
        print(f"⚠️  Error loading reviews: {e}")
        return defaultdict(list)

def calculate_aggregate_rating(reviews):
    """Calculate aggregate rating from reviews"""
    if not reviews:
        return None
    
    total_rating = 0
    count = 0
    
    for review in reviews:
        try:
            rating_value = review.get('reviewRating', {}).get('ratingValue')
            if rating_value:
                total_rating += float(rating_value)
                count += 1
        except (ValueError, TypeError):
            continue
    
    if count == 0:
        return None
    
    avg_rating = total_rating / count
    return {
        "@type": "AggregateRating",
        "ratingValue": f"{avg_rating:.1f}",
        "reviewCount": count
    }

def generate_product_schema_graph(product_row, reviews_list):
    """Generate complete @graph schema for a product"""
    
    product_name = str(product_row.get('name', '')).strip()
    product_url = str(product_row.get('url', '')).strip()
    product_description = str(product_row.get('description', '')).strip()
    product_image = str(product_row.get('image', '')).strip()
    
    # Build product schema
    product_schema = {
        "@type": ["Product", "Event", "Course"],
        "name": product_name,
    }
    
    # Add description
    if product_description:
        product_schema["description"] = product_description
    
    # Add image
    if product_image:
        product_schema["image"] = product_image
    
    # Add URL
    if product_url:
        product_schema["url"] = product_url
    
    # Add offers if price is available
    price = product_row.get('price')
    if price and pd.notna(price):
        try:
            price_val = float(price)
            product_schema["offers"] = {
                "@type": "Offer",
                "price": f"{price_val:.2f}",
                "priceCurrency": "GBP",
                "availability": "https://schema.org/InStock",
                "url": product_url
            }
        except (ValueError, TypeError):
            pass
    
    # Add reviews and aggregate rating
    if reviews_list:
        product_schema["review"] = reviews_list
        
        aggregate_rating = calculate_aggregate_rating(reviews_list)
        if aggregate_rating:
            product_schema["aggregateRating"] = aggregate_rating
    
    # Add performer and organizer
    product_schema["performer"] = PERFORMER
    product_schema["organizer"] = ORGANIZER
    
    # Build @graph structure
    graph = [
        ORGANIZER,
        LOCAL_BUSINESS,
        get_breadcrumbs(product_name, product_url),
        product_schema
    ]
    
    # Add @id to product schema
    product_slug = slugify(product_name)
    product_schema["@id"] = f"https://www.alanranger.com/{product_slug}#schema"
    
    return {
        "@context": "https://schema.org",
        "@graph": graph
    }

def schema_to_html(schema_data):
    """Convert schema JSON to Squarespace-ready HTML"""
    json_str = json.dumps(schema_data, indent=2, ensure_ascii=False)
    return f'<script type="application/ld+json">\n{json_str}\n</script>'

def main():
    # Use absolute paths based on script location
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    workflow_dir = project_root / 'inputs-files' / 'workflow'
    outputs_dir = project_root / 'outputs'
    outputs_dir.mkdir(exist_ok=True)
    
    # Find input files
    products_file = workflow_dir / '02 – products_cleaned.xlsx'
    reviews_file = workflow_dir / '03 – combined_product_reviews.csv'
    
    if not products_file.exists():
        print(f"❌ Error: Products file not found")
        print(f"   Expected: {products_file.absolute()}")
        sys.exit(1)
    
    print(f"📂 Reading products: {products_file.name}")
    
    try:
        df_products = pd.read_excel(products_file, engine='openpyxl')
        print(f"✅ Loaded {len(df_products)} products")
    except Exception as e:
        print(f"❌ Error reading products file: {e}")
        sys.exit(1)
    
    # Load reviews
    reviews_by_product = load_reviews(reviews_file)
    
    # Generate schemas
    schemas_data = []
    html_files = []
    
    for idx, row in df_products.iterrows():
        product_name = str(row.get('name', '')).strip()
        if not product_name:
            continue
        
        # Get reviews for this product
        product_reviews = reviews_by_product.get(product_name, [])
        
        # Generate schema graph
        schema_graph = generate_product_schema_graph(row, product_reviews)
        
        # Create filename
        product_slug = slugify(product_name)
        html_filename = f"{product_slug}_schema_squarespace_ready.html"
        html_path = outputs_dir / html_filename
        
        # Write HTML file
        html_content = schema_to_html(schema_graph)
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        html_files.append(html_filename)
        
        # Prepare for combined CSV
        review_count = len(product_reviews)
        avg_rating = None
        if product_reviews:
            aggregate = calculate_aggregate_rating(product_reviews)
            if aggregate:
                avg_rating = aggregate.get('ratingValue')
        
        schemas_data.append({
            'product_name': product_name,
            'url': row.get('url', ''),
            'schema_html': html_content,
            'review_count': review_count,
            'average_rating': avg_rating or '',
            'has_reviews': 'Yes' if review_count > 0 else 'No',
            'file_name': html_filename
        })
    
    print(f"✅ Generated {len(html_files)} HTML files")
    
    # Save combined CSV
    schemas_df = pd.DataFrame(schemas_data)
    output_csv = workflow_dir / '04 – alanranger_product_schema_FINAL_WITH_REVIEW_RATINGS.csv'
    
    try:
        schemas_df.to_csv(output_csv, index=False, encoding='utf-8-sig')
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
    print(f"HTML files saved to: {outputs_dir.absolute()}")
    print(f"Combined CSV saved to: {output_csv.absolute()}")
    print("="*60)
    print("\n✅ Schema generation complete!")
    print("\n💡 Each HTML file is ready to copy-paste into Squarespace Code Blocks")

if __name__ == '__main__':
    main()
