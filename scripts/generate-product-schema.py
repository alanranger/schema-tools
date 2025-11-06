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
from datetime import datetime, date
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
        return ''
    import re
    # More aggressive slugify - only alphanumeric and hyphens
    slug = re.sub(r'[^a-z0-9]+', '-', str(text).lower().strip())
    return slug.strip('-')

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

def normalize_rating(rating):
    """Normalize rating to numeric value"""
    if pd.isna(rating):
        return None
    
    rating_str = str(rating).strip()
    
    # Handle numeric strings
    try:
        rating_num = float(rating_str)
        if 1 <= rating_num <= 5:
            return rating_num
    except ValueError:
        pass
    
    # Handle star ratings (e.g., "5", "FIVE", "FIVE_STAR")
    rating_upper = rating_str.upper()
    if "FIVE" in rating_upper or rating_str == "5":
        return 5.0
    elif "FOUR" in rating_upper or rating_str == "4":
        return 4.0
    elif "THREE" in rating_upper or rating_str == "3":
        return 3.0
    elif "TWO" in rating_upper or rating_str == "2":
        return 2.0
    elif "ONE" in rating_upper or rating_str == "1":
        return 1.0
    
    return None

def load_and_merge_reviews(google_path, trustpilot_path, products_df):
    """Load reviews from both sources, merge, filter, and match to products"""
    google_df = pd.DataFrame()
    trust_df = pd.DataFrame()
    
    # Load Google reviews
    if google_path.exists():
        try:
            google_df = pd.read_csv(google_path, encoding='utf-8-sig')
            google_df.columns = [c.strip().lower().replace(' ', '_') for c in google_df.columns]
            print(f"✅ Loaded {len(google_df)} reviews from Google")
        except Exception as e:
            print(f"⚠️  Error loading Google reviews: {e}")
    else:
        print(f"⚠️  Google reviews file not found: {google_path.name}")
    
    # Load Trustpilot reviews
    if trustpilot_path.exists():
        try:
            trust_df = pd.read_csv(trustpilot_path, encoding='utf-8-sig')
            trust_df.columns = [c.strip().lower().replace(' ', '_') for c in trust_df.columns]
            print(f"✅ Loaded {len(trust_df)} reviews from Trustpilot")
        except Exception as e:
            print(f"⚠️  Error loading Trustpilot reviews: {e}")
    else:
        print(f"⚠️  Trustpilot reviews file not found: {trustpilot_path.name}")
    
    # Merge both dataframes
    if google_df.empty and trust_df.empty:
        print("⚠️  No reviews found from either source")
        return defaultdict(list)
    
    reviews_df = pd.concat([google_df, trust_df], ignore_index=True)
    print(f"✅ Merged {len(reviews_df)} total reviews ({len(google_df)} Google + {len(trust_df)} Trustpilot)")
    
    # Normalize rating column
    rating_col = None
    for col in ['rating', 'ratingvalue', 'star_rating', 'stars']:
        if col in reviews_df.columns:
            rating_col = col
            break
    
    if rating_col:
        reviews_df['ratingValue'] = reviews_df[rating_col].apply(normalize_rating)
    else:
        reviews_df['ratingValue'] = None
    
    # Filter reviews with rating >= 4
    before_filter = len(reviews_df)
    reviews_df = reviews_df[reviews_df['ratingValue'] >= 4].copy()
    filtered_count = before_filter - len(reviews_df)
    if filtered_count > 0:
        print(f"✅ Filtered to {len(reviews_df)} reviews (≥4★), removed {filtered_count} low ratings")
    
    # Clean review body
    review_col = None
    for col in ['review', 'reviewbody', 'review_text', 'comment', 'text']:
        if col in reviews_df.columns:
            review_col = col
            break
    
    if review_col:
        reviews_df['reviewBody'] = reviews_df[review_col].fillna("").astype(str).str.strip()
    else:
        reviews_df['reviewBody'] = ""
    
    # Get author/reviewer name
    author_col = None
    for col in ['reviewer', 'author', 'reviewer_name', 'name']:
        if col in reviews_df.columns:
            author_col = col
            break
    
    if author_col:
        reviews_df['author'] = reviews_df[author_col].fillna("").astype(str).str.strip()
    else:
        reviews_df['author'] = ""
    
    # Match reviews to products using the merged CSV if available
    # Otherwise, try to match by product name from products_df
    reviews_by_product = defaultdict(list)
    
    # First, try to use product_name if it exists (from merged CSV)
    if 'product_name' in reviews_df.columns:
        for product_name, group in reviews_df.groupby('product_name'):
            product_name = str(product_name).strip()
            if not product_name:
                continue
            
            for _, row in group.iterrows():
                review_obj = {
                    "@type": "Review",
                    "reviewRating": {
                        "@type": "Rating",
                        "ratingValue": str(int(row['ratingValue'])),
                        "bestRating": "5",
                        "worstRating": "1"
                    },
                    "reviewBody": str(row['reviewBody'])
                }
                
                author_name = str(row['author']).strip()
                if author_name and author_name.lower() not in ['anonymous', 'n/a', '']:
                    review_obj["author"] = {
                        "@type": "Person",
                        "name": author_name
                    }
                else:
                    review_obj["author"] = {
                        "@type": "Person",
                        "name": "Anonymous"
                    }
                
                reviews_by_product[product_name].append(review_obj)
    else:
        # If no product_name column, try fuzzy matching (simplified - use exact match on reference_id or review text)
        # For now, assign all reviews to a generic bucket - in production, you'd use fuzzy matching
        print("⚠️  No product_name column found. Reviews will need manual matching.")
        # This is a fallback - ideally reviews should be pre-matched in Step 3b
    
    google_count = len(google_df[google_df.get('ratingValue', pd.Series([0]*len(google_df))) >= 4]) if 'ratingValue' in google_df.columns else len(google_df)
    trust_count = len(trust_df[trust_df.get('ratingValue', pd.Series([0]*len(trust_df))) >= 4]) if 'ratingValue' in trust_df.columns else len(trust_df)
    
    today = date.today()
    print(f"✅ Reviews merged — {len(reviews_df)} total ({len(google_df)} Google + {len(trust_df)} Trustpilot) on {today}")
    print(f"✅ Grouped reviews for {len(reviews_by_product)} products")
    
    return reviews_by_product

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
    
    avg_rating = round(total_rating / count, 2)
    return {
        "@type": "AggregateRating",
        "ratingValue": str(avg_rating),
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
    google_reviews_file = workflow_dir / '03b – google_reviews.csv'
    trustpilot_reviews_file = workflow_dir / '03a – trustpilot_historical_reviews.csv'
    merged_reviews_file = workflow_dir / '03 – combined_product_reviews.csv'
    
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
    
    # Load reviews - prefer merged CSV (has product_name already mapped from Step 3b)
    # But also load source files to show counts in console message
    reviews_by_product = defaultdict(list)
    
    # Load source files for console message
    google_df_source = pd.DataFrame()
    trust_df_source = pd.DataFrame()
    
    if google_reviews_file.exists():
        try:
            google_df_source = pd.read_csv(google_reviews_file, encoding='utf-8-sig')
            google_df_source.columns = [c.strip().lower().replace(' ', '_') for c in google_df_source.columns]
        except:
            pass
    
    if trustpilot_reviews_file.exists():
        try:
            trust_df_source = pd.read_csv(trustpilot_reviews_file, encoding='utf-8-sig')
            trust_df_source.columns = [c.strip().lower().replace(' ', '_') for c in trust_df_source.columns]
        except:
            pass
    
    # Create product slugs for matching - use URL-based slugs for better accuracy
    def get_slug_from_url(url):
        """Extract slug from URL"""
        if pd.isna(url) or not url:
            return ''
        try:
            url_str = str(url).strip().rstrip('/')
            return slugify(url_str.split('/')[-1])
        except:
            return ''
    
    # Use URL-based slugs if available, fallback to name-based
    if 'url' in df_products.columns:
        df_products['product_slug'] = df_products['url'].apply(get_slug_from_url)
        # Fill any missing slugs with name-based slugs
        missing_slugs = df_products['product_slug'].isna() | (df_products['product_slug'] == '')
        df_products.loc[missing_slugs, 'product_slug'] = df_products.loc[missing_slugs, 'name'].fillna('').apply(slugify)
    else:
        df_products['product_slug'] = df_products['name'].fillna('').apply(slugify)
    
    # Use merged CSV if available (has product_name/product_slug already mapped)
    if merged_reviews_file.exists():
        print(f"📂 Using merged reviews file: {merged_reviews_file.name}")
        try:
            merged_df = pd.read_csv(merged_reviews_file, encoding='utf-8-sig')
            print(f"✅ Loaded merged reviews: {merged_df.shape[0]} rows, {merged_df.shape[1]} columns")
            
            # Fail-safe for malformed CSV (only reviewBody header)
            if merged_df.columns.tolist() == ['reviewBody'] or len(merged_df.columns) == 1:
                print("⚠️ Detected malformed CSV (only 'reviewBody' header or single column). Skipping this file.")
                merged_df = pd.DataFrame()
            else:
                # Normalize column names
                merged_df.columns = [c.strip().lower().replace(' ', '_') for c in merged_df.columns]
                
                # Verify essential columns
                required = {'product_name', 'product_slug', 'ratingvalue', 'reviewbody'}
                missing = required - set(merged_df.columns)
                if missing:
                    print(f"⚠️ Missing columns {missing} — falling back to manual matching.")
                    merged_df = pd.DataFrame()
            
            if not merged_df.empty:
                # Sanitize dataset: Drop any NaN, blanks, or invalid mappings
                before_sanitize = len(merged_df)
                merged_df = merged_df.dropna(subset=['product_slug'])
                merged_df = merged_df[merged_df['product_slug'].astype(str).str.strip() != '']
                merged_df = merged_df.drop_duplicates(subset=['product_slug', 'author', 'reviewBody'], keep='first')
                # Remove outlier rows with very short review bodies
                if 'reviewBody' in merged_df.columns:
                    merged_df = merged_df[merged_df['reviewBody'].astype(str).str.len() > 10]
                elif 'review' in merged_df.columns:
                    merged_df = merged_df[merged_df['review'].astype(str).str.len() > 10]
                after_sanitize = len(merged_df)
                if before_sanitize > after_sanitize:
                    print(f"✅ Sanitized reviews dataset: {after_sanitize} valid reviews (removed {before_sanitize - after_sanitize} invalid/duplicate rows)")
            
            # Normalize rating
            rating_col = None
            for col in ['rating', 'ratingvalue', 'star_rating', 'stars']:
                if col in merged_df.columns:
                    rating_col = col
                    break
            
            if rating_col:
                merged_df['ratingValue'] = merged_df[rating_col].apply(normalize_rating)
            else:
                merged_df['ratingValue'] = None
            
            # Filter reviews >= 4
            merged_df = merged_df[merged_df['ratingValue'] >= 4].copy()
            
            # Ensure product_slug exists and normalize
            if 'product_slug' not in merged_df.columns:
                if 'product_name' in merged_df.columns:
                    merged_df['product_slug'] = merged_df['product_name'].fillna('').apply(slugify)
                elif 'reference_id' in merged_df.columns:
                    merged_df['product_slug'] = merged_df['reference_id'].fillna('').apply(slugify)
                else:
                    merged_df['product_slug'] = ''
            
            # Regenerate slugs for consistency
            merged_df['product_slug'] = merged_df['product_slug'].fillna('').apply(slugify)
            
            # Ensure author and reviewBody columns exist
            if 'author' not in merged_df.columns:
                merged_df['author'] = merged_df.get('reviewer', 'Anonymous')
            if 'reviewBody' not in merged_df.columns:
                merged_df['reviewBody'] = merged_df.get('review', merged_df.get('review_text', ''))
            
            # Group reviews by product_slug (dropna=True to exclude invalid slugs)
            reviews_grouped = merged_df.groupby('product_slug', dropna=True)
            
            # Match reviews to products using slugs
            matched_reviews_count = 0
            matched_products = set()
            
            for _, product_row in df_products.iterrows():
                product_slug = product_row['product_slug']
                if not product_slug or pd.isna(product_slug):
                    continue
                
                if product_slug in reviews_grouped.groups:
                    group = reviews_grouped.get_group(product_slug)
                    product_name = str(product_row.get('name', '')).strip()
                    
                    # Limit to 25 reviews per product to prevent inflation
                    group = group.head(25)
                    
                    for _, review_row in group.iterrows():
                        rating_val = review_row.get('ratingValue')
                        if rating_val and rating_val >= 4:
                            review_obj = {
                                "@type": "Review",
                                "reviewRating": {
                                    "@type": "Rating",
                                    "ratingValue": str(int(rating_val)),
                                    "bestRating": "5",
                                    "worstRating": "1"
                                },
                                "reviewBody": str(review_row.get('reviewBody', review_row.get('review', review_row.get('review_text', '')))).strip()
                            }
                            
                            reviewer = str(review_row.get('author', review_row.get('reviewer', ''))).strip()
                            if reviewer and reviewer.lower() not in ['anonymous', 'n/a', '']:
                                review_obj["author"] = {"@type": "Person", "name": reviewer}
                            else:
                                review_obj["author"] = {"@type": "Person", "name": "Anonymous"}
                            
                            reviews_by_product[product_name].append(review_obj)
                            matched_reviews_count += 1
                    
                    if product_name not in matched_products:
                        matched_products.add(product_name)
                        
                    # Log per product
                    avg = round(group['ratingValue'].mean(), 2)
                    count = len(group)
                    print(f"✅ [{product_name}] matched {count} reviews, avg {avg}")
                
            # Show console message with source file counts
            google_count = len(google_df_source) if not google_df_source.empty else 0
            trust_count = len(trust_df_source) if not trust_df_source.empty else 0
            total_reviews = len(merged_df)
            today = date.today()
            print(f"✅ Reviews merged — {total_reviews} total ({google_count} Google + {trust_count} Trustpilot) on {today}")
            print(f"✅ Matched {matched_reviews_count} reviews to {len(matched_products)} products")
        except Exception as e:
            print(f"⚠️  Error reading merged file: {e}")
            import traceback
            traceback.print_exc()
            print("📂 Falling back to source files...")
            reviews_by_product = load_and_merge_reviews(google_reviews_file, trustpilot_reviews_file, df_products)
    else:
        print(f"📂 Loading reviews from source files...")
        reviews_by_product = load_and_merge_reviews(google_reviews_file, trustpilot_reviews_file, df_products)
    
    # Generate schemas
    schemas_data = []
    html_files = []
    nan_count = 0
    
    for idx, row in df_products.iterrows():
        product_name = str(row.get('name', '')).strip()
        if not product_name or product_name.lower() == 'nan':
            nan_count += 1
            continue
        
        # Get reviews for this product
        product_reviews = reviews_by_product.get(product_name, [])
        
        # Generate schema graph
        schema_graph = generate_product_schema_graph(row, product_reviews)
        
        # Create filename
        product_slug = row.get('product_slug', slugify(product_name))
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
        
        # Verification log per product
        if review_count > 0:
            print(f"✅ [{product_name}] schema generated ({review_count} reviews, avg {avg_rating})")
        else:
            print(f"⚠️ [{product_name}] schema generated (no reviews)")
    
    # Post-generation validation
    if nan_count > 0:
        print(f"⚠️ {nan_count} product entries missing names (skipped).")
    
    # Clean up orphan "nan" HTML outputs
    import os
    removed_count = 0
    if outputs_dir.exists():
        for f in os.listdir(outputs_dir):
            if 'nan' in f.lower() and f.endswith('.html'):
                try:
                    os.remove(outputs_dir / f)
                    removed_count += 1
                    print(f"🧹 Removed invalid schema file: {f}")
                except Exception as e:
                    pass
    
    if removed_count > 0:
        print(f"✅ Cleaned up {removed_count} invalid schema files")
    
    print(f"✅ Generated {len(html_files)} HTML files")
    
    # Post-generation summary
    valid_products = len(df_products) - nan_count
    print(f"✅ Final schema files generated: {valid_products}")
    
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
    products_without_reviews = len(schemas_df) - products_with_reviews
    
    # Get latest review date if available
    latest_review_date = None
    if merged_reviews_file.exists():
        try:
            merged_df_summary = pd.read_csv(merged_reviews_file, encoding='utf-8-sig')
            if 'date' in merged_df_summary.columns:
                dates = pd.to_datetime(merged_df_summary['date'], errors='coerce')
                dates = dates.dropna()
                if len(dates) > 0:
                    latest_review_date = dates.max().strftime('%Y-%m-%d')
        except:
            pass
    
    # Get source counts
    google_count = len(google_df_source) if not google_df_source.empty else 0
    trust_count = len(trust_df_source) if not trust_df_source.empty else 0
    
    print("\n" + "="*60)
    print("📊 SCHEMA GENERATION SUMMARY")
    print("="*60)
    print(f"Total products: {len(schemas_df)}")
    print(f"Products with reviews: {products_with_reviews}")
    print(f"Products without reviews: {products_without_reviews}")
    if latest_review_date:
        print(f"Latest review date: {latest_review_date}")
    print(f"Google reviews: {google_count}")
    print(f"Trustpilot reviews: {trust_count}")
    print(f"HTML files saved to: {outputs_dir.absolute()}")
    print(f"Combined CSV saved to: {output_csv.absolute()}")
    print("="*60)
    print("\n✅ Schema generation complete!")
    print("\n💡 Each HTML file is ready to copy-paste into Squarespace Code Blocks")

if __name__ == '__main__':
    main()
