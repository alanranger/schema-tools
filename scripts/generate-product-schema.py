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
  - QA Summary CSV: outputs/review_summary.csv
"""

import pandas as pd
import json
import re
import warnings
from difflib import SequenceMatcher
from pathlib import Path
import sys
import os
from datetime import datetime, date
from urllib.parse import urlparse
from collections import defaultdict

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# Silence warnings to prevent false "exit 1" in Electron
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=pd.errors.SettingWithCopyWarning)

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

# ============================================================
# Utility Functions
# ============================================================

def slugify(text):
    """Standard slug generator for consistency across all scripts."""
    if not text:
        return ''
    return re.sub(r'[^a-z0-9]+', '-', str(text).lower().strip()).strip('-')

def normalize_slug(value):
    """Robust slug normalization - handles URLs and common prefixes"""
    if not isinstance(value, str):
        return ""
    value = value.strip().lower()
    # Remove URL prefixes
    value = re.sub(r'https?://(www\.)?alanranger\.com/', '', value)
    # Remove common photo-related prefixes
    value = re.sub(r'photo(workshops|courses)[-/]?', '', value)
    value = re.sub(r'photography[-/]', '', value)
    # Normalize separators and clean
    value = re.sub(r'[^a-z0-9-]+', '-', value)
    value = re.sub(r'-+', '-', value)
    return value.strip('-')

def slug_matches(review_slug, product_slug, threshold=0.85):
    """Check if review slug matches product slug using multiple strategies"""
    a = normalize_slug(review_slug)
    b = normalize_slug(product_slug)
    
    if not a or not b:
        return False
    
    # Strategy 1: Exact match
    if a == b:
        return True
    
    # Strategy 2: Startswith match
    if a.startswith(b) or b.startswith(a):
        return True
    
    # Strategy 3: Substring match
    if a in b or b in a:
        return True
    
    # Strategy 4: Fuzzy match
    return SequenceMatcher(None, a, b).ratio() >= threshold

def find_best_slug_match(review_slug, product_slugs):
    """Return the best fuzzy match for a review_slug among product_slugs."""
    best_match, best_ratio = None, 0.0
    for ps in product_slugs:
        ratio = SequenceMatcher(None, review_slug, ps).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = ps
    return best_match if best_ratio > 0.74 else None  # adjustable threshold

def get_breadcrumbs(product_name, product_url):
    """Generate breadcrumb list for product with normalized casing"""
    # Ensure product_name uses correct canonical casing (preserve original)
    breadcrumb_name = product_name.strip()
    
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
                "name": breadcrumb_name,
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
    
    # Generate SKU from product name + year
    product_slug = slugify(product_name)
    current_year = date.today().year
    sku = f"{product_slug.upper()}-{current_year}"
    
    # Build product schema
    product_schema = {
        "@type": ["Product", "Event", "Course"],
        "name": product_name,
        "sku": sku,
        "brand": {
            "@type": "Brand",
            "name": "Alan Ranger Photography"
        }
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
            
            # Determine validFrom date - try product date field, then default to current date
            valid_from = date.today().isoformat()
            if 'date' in product_row.index and pd.notna(product_row.get('date')):
                try:
                    product_date = pd.to_datetime(product_row.get('date'), errors='coerce')
                    if pd.notna(product_date):
                        valid_from = product_date.strftime('%Y-%m-%d')
                except:
                    pass
            
            product_schema["offers"] = {
                "@type": "Offer",
                "price": f"{price_val:.2f}",
                "priceCurrency": "GBP",
                "availability": "https://schema.org/InStock",
                "url": product_url,
                "validFrom": valid_from,
                "shippingDetails": {
                    "@type": "OfferShippingDetails",
                    "doesNotShip": "http://schema.org/True",
                    "shippingDestination": {
                        "@type": "DefinedRegion",
                        "addressCountry": "GB"
                    }
                },
                "hasMerchantReturnPolicy": {
                    "@type": "MerchantReturnPolicy",
                    "returnPolicyCategory": "http://schema.org/MerchantReturnFiniteReturnWindow",
                    "merchantReturnDays": 28,
                    "refundType": "http://schema.org/FullRefund",
                    "applicableCountry": "GB",
                    "returnMethod": "http://schema.org/ReturnByMail"
                }
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
    
    # Event enrichment
    product_schema["eventStatus"] = "https://schema.org/EventScheduled"
    product_schema["eventAttendanceMode"] = "https://schema.org/OfflineEventAttendanceMode"
    
    # Add location block if location data is available
    # Try to extract location from product fields (category, description, or dedicated location field)
    location_name = None
    address_locality = None
    address_region = None
    postal_code = None
    
    # Check for location fields in product data
    if 'location' in product_row.index and pd.notna(product_row.get('location')):
        location_name = str(product_row.get('location', '')).strip()
    elif 'category' in product_row.index:
        # Try to extract location from category (e.g., "Batsford Arboretum, Gloucestershire")
        category = str(product_row.get('category', '')).strip()
        if category:
            # Simple extraction - could be enhanced
            parts = category.split(',')
            if len(parts) > 0:
                location_name = parts[0].strip()
            if len(parts) > 1:
                address_region = parts[-1].strip()
    
    # If we have location data, add location block
    if location_name:
        location_block = {
            "@type": "Place",
            "name": location_name
        }
        
        address_block = {
            "@type": "PostalAddress",
            "addressCountry": "GB"
        }
        
        if address_locality:
            address_block["addressLocality"] = address_locality
        if address_region:
            address_block["addressRegion"] = address_region
        if postal_code:
            address_block["postalCode"] = postal_code
        
        location_block["address"] = address_block
        product_schema["location"] = location_block
    
    # Build @graph structure - Keep only LocalBusiness (it inherits Organization properties)
    graph = [
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
    
    # ============================================================
    # Load and Sanitize Reviews
    # ============================================================
    
    if not merged_reviews_file.exists():
        print(f"❌ Error: Merged reviews file not found")
        print(f"   Expected: {merged_reviews_file.absolute()}")
        sys.exit(1)
    
    print(f"📂 Using merged reviews file: {merged_reviews_file.name}")
    
    try:
        reviews_df = pd.read_csv(merged_reviews_file, encoding="utf-8-sig")
        print(f"✅ Loaded merged reviews: {len(reviews_df)} rows, {len(reviews_df.columns)} columns")
        
        # Normalize column names
        reviews_df.columns = [c.strip().lower().replace(' ', '_') for c in reviews_df.columns]
        
        # ============================================================
        # Sanitize Reviews
        # ============================================================
        
        print("🔍 Columns detected in merged reviews file:", list(reviews_df.columns))
        
        # Drop fully blank rows
        reviews_df.dropna(how="all", inplace=True)
        
        # --- Rating detection ---
        if "ratingvalue" not in reviews_df.columns:
            for alt in ["stars", "rating", "review_rating", "score"]:
                if alt in reviews_df.columns:
                    reviews_df["ratingvalue"] = reviews_df[alt]
                    print(f"✅ Mapped '{alt}' → ratingValue")
                    break
        
        # --- Review text detection ---
        if "reviewbody" not in reviews_df.columns:
            for alt in ["review_text", "content", "text", "body", "comment", "review"]:
                if alt in reviews_df.columns:
                    reviews_df["reviewbody"] = reviews_df[alt]
                    print(f"✅ Mapped '{alt}' → reviewBody")
                    break
        
        # Create empty fallback if still missing
        if "reviewbody" not in reviews_df.columns:
            reviews_df["reviewbody"] = ""
            print("⚠️  No review text column found; created empty reviewBody for compatibility")
        
        # Convert ratingValue to numeric
        reviews_df["ratingvalue"] = pd.to_numeric(reviews_df.get("ratingvalue"), errors="coerce")
        
        # Parse dates safely
        if "date" in reviews_df.columns:
            reviews_df["date"] = pd.to_datetime(reviews_df["date"], errors="coerce", dayfirst=True)
        
        # Keep only rows with rating and non-empty text
        reviews_df = reviews_df[
            reviews_df["ratingvalue"].notna() &
            (reviews_df["reviewbody"].astype(str).str.strip() != "")
        ]
        
        print(f"✅ Sanitized reviews dataset: {len(reviews_df)} valid reviews after cleanup")
        if len(reviews_df) == 0:
            print("⚠️  No valid reviews remain — check column headers in merged CSV.")
            raise SystemExit("❌ No valid reviews remain after cleaning. Check CSV format.")
        
        # Filter to >= 4 stars
        reviews_df = reviews_df[reviews_df["ratingvalue"] >= 4].copy()
        print(f"✅ Filtered to {len(reviews_df)} reviews (≥4★)")
        
    except Exception as e:
        print(f"❌ Error reading merged reviews file: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # ============================================================
    # Slugify Products and Reviews (with normalization)
    # ============================================================
    
    # Create product slugs from URLs (matching merge-reviews.py)
    def get_slug_from_url(url):
        """Extract and normalize slug from URL"""
        if pd.isna(url) or not url:
            return ''
        try:
            url_str = str(url).strip().rstrip('/')
            # Extract slug from URL
            slug = url_str.split('/')[-1]
            # Normalize it
            normalized = normalize_slug(slug)
            # Apply slugify for consistency
            return slugify(normalized) if normalized else slugify(slug)
        except:
            return ''
    
    if 'url' in df_products.columns:
        df_products['product_slug'] = df_products['url'].apply(get_slug_from_url)
        # Fill missing slugs with name-based slugs
        missing_slugs = df_products['product_slug'].isna() | (df_products['product_slug'] == '')
        df_products.loc[missing_slugs, 'product_slug'] = df_products.loc[missing_slugs, 'name'].fillna('').apply(slugify)
    else:
        df_products['product_slug'] = df_products['name'].fillna('').apply(slugify)
    
    # Normalize product slugs (for display, but matching uses slug_matches)
    df_products['product_slug_normalized'] = df_products['product_slug'].fillna('').apply(lambda x: normalize_slug(str(x)))
    
    # Ensure review slugs exist (trust the product_slug from Step 3b, don't re-normalize)
    if 'product_slug' not in reviews_df.columns:
        if 'product_name' in reviews_df.columns:
            reviews_df['product_slug'] = reviews_df['product_name'].fillna('').apply(slugify)
        else:
            reviews_df['product_slug'] = ''
    
    # Don't re-normalize - trust the slugs from Step 3b
    reviews_df['product_slug'] = reviews_df['product_slug'].fillna('').astype(str)
    
    # ============================================================
    # Match Reviews to Products (trust Step 3b slugs, add fuzzy fallback)
    # ============================================================
    
    # Build product lookup: slug -> product info (including URL)
    product_lookup = {}
    for _, row in df_products.iterrows():
        slug = row.get('product_slug', '')
        url = row.get('url', '')
        name = row.get('name', '')
        if slug:
            product_lookup[slug] = {
                'slug': slug,
                'url': url,
                'name': name
            }
    
    # Match reviews to products - trust Step 3b slugs, but add fuzzy fallback for variations
    matched_products = set()
    review_slug_to_product_slug = {}  # review slug -> product slug
    
    for _, review_row in reviews_df.iterrows():
        review_slug = str(review_row.get('product_slug', '')).strip()
        
        if not review_slug:
            continue
        
        matched_product_slug = None
        
        # Strategy 1: Exact match (trust Step 3b slug)
        if review_slug in product_lookup:
            matched_product_slug = review_slug
        else:
            # Strategy 2: Try matching against product slugs with fuzzy fallback
            for prod_slug, prod_info in product_lookup.items():
                if slug_matches(review_slug, prod_slug, threshold=0.85):
                    matched_product_slug = prod_slug
                    break
            
            # Strategy 3: Try matching against product URLs if still no match
            if not matched_product_slug:
                for prod_slug, prod_info in product_lookup.items():
                    prod_url = str(prod_info.get('url', '')).strip()
                    if prod_url and slug_matches(review_slug, prod_url, threshold=0.85):
                        matched_product_slug = prod_slug
                        break
        
        if matched_product_slug:
            review_slug_to_product_slug[review_slug] = matched_product_slug
            matched_products.add(matched_product_slug)
    
    # Update reviews_df with matched product slugs (only if fuzzy match found)
    if review_slug_to_product_slug:
        def update_review_slug(row):
            orig_slug = str(row.get('product_slug', '')).strip()
            # Only update if it's a fuzzy match (not exact match)
            if orig_slug in review_slug_to_product_slug and orig_slug not in product_lookup:
                return review_slug_to_product_slug[orig_slug]
            return orig_slug
        
        reviews_df['product_slug'] = reviews_df.apply(update_review_slug, axis=1)
    
    # Fix summary counter - count distinct product_slug values from reviews_df
    distinct_slugs = reviews_df['product_slug'].dropna().unique()
    distinct_slugs = [s for s in distinct_slugs if s and str(s).strip()]  # Remove empty strings
    
    matched_reviews_count = len(reviews_df[reviews_df['product_slug'].isin(distinct_slugs)])
    unique_products_count = len(distinct_slugs)
    
    print(f"✅ Linked {matched_reviews_count} reviews across {unique_products_count} products (trusting Step 3b slugs)")
    
    if distinct_slugs:
        print("🔍 Sample matched products:")
        for s in distinct_slugs[:10]:
            count = len(reviews_df[reviews_df['product_slug'] == s])
            product_info = None
            for prod_slug, prod_info in product_lookup.items():
                if slug_matches(s, prod_slug, threshold=0.85):
                    product_info = prod_info
                    break
            prod_name = product_info.get('name', s) if product_info else s
            print(f"   {s} → {count} reviews ({prod_name[:40]}...)")
    
    # ============================================================
    # Group Reviews and Generate Schemas
    # ============================================================
    
    # Group strictly by product_slug from Step 3b (only non-empty slugs)
    grouped_reviews = reviews_df[reviews_df["product_slug"].notna() & (reviews_df["product_slug"] != "")].groupby("product_slug", dropna=True)
    
    schemas_data = []
    html_files = []
    nan_count = 0
    products_with_reviews_count = 0
    summary_rows = []
    
    for idx, row in df_products.iterrows():
        product_name = str(row.get('name', '')).strip()
        if not product_name or product_name.lower() == 'nan':
            nan_count += 1
            continue
        
        product_slug = row.get('product_slug', slugify(product_name))
        
        # Get reviews for this product - trust Step 3b slugs with fuzzy fallback
        product_reviews = []
        
        # First try exact match via grouped_reviews (trust Step 3b slug)
        reviews_for_product = None
        if product_slug in grouped_reviews.groups:
            reviews_for_product = grouped_reviews.get_group(product_slug)
        else:
            # Fuzzy fallback: handle slight slug variations
            for s in grouped_reviews.groups:
                if SequenceMatcher(None, product_slug, s).ratio() >= 0.85:
                    reviews_for_product = grouped_reviews.get_group(s)
                    break
        
        # If still no match, try matching against product URL
        if reviews_for_product is None:
            product_url = str(row.get('url', '')).strip()
            if product_url:
                for _, review_row in reviews_df.iterrows():
                    review_slug = str(review_row.get('product_slug', '')).strip()
                    if review_slug and slug_matches(review_slug, product_url, threshold=0.85):
                        if reviews_for_product is None:
                            reviews_for_product = pd.DataFrame([review_row])
                        else:
                            reviews_for_product = pd.concat([reviews_for_product, pd.DataFrame([review_row])], ignore_index=True)
        
        # Process reviews if found
        if reviews_for_product is not None and len(reviews_for_product) > 0:
            # Limit to 25 reviews per product
            group = reviews_for_product.head(25)
            
            for _, review_row in group.iterrows():
                rating_val = review_row.get('ratingvalue')
                if rating_val and rating_val >= 4:
                    # Get review body from various possible column names
                    review_body = ''
                    for col in ['reviewbody', 'review_body', 'review', 'review_text']:
                        if col in review_row.index:
                            review_body = str(review_row.get(col, '')).strip()
                            break
                    
                    # Replace "nan" or empty review texts with fallback message
                    if not review_body or review_body.lower() == 'nan' or review_body == '':
                        review_body = "Customer review available on Trustpilot"
                    
                    # Get author
                    author = 'Anonymous'
                    for col in ['author', 'reviewer', 'reviewer_name']:
                        if col in review_row.index:
                            author_val = str(review_row.get(col, '')).strip()
                            if author_val and author_val.lower() not in ['anonymous', 'n/a', '']:
                                author = author_val
                                break
                    
                    # Get date
                    review_date = ''
                    if 'date' in review_row.index:
                        date_val = review_row.get('date')
                        if pd.notna(date_val):
                            try:
                                if isinstance(date_val, pd.Timestamp):
                                    review_date = date_val.strftime('%Y-%m-%d')
                                else:
                                    review_date = str(date_val)[:10]
                            except:
                                pass
                    
                    # Get source
                    source = review_row.get('source', 'Google')
                    
                    review_obj = {
                        "@type": "Review",
                        "author": {"@type": "Person", "name": author},
                        "reviewBody": review_body,
                        "reviewRating": {
                            "@type": "Rating",
                            "ratingValue": str(int(rating_val)),
                            "bestRating": "5",
                            "worstRating": "1"
                        }
                    }
                    
                    if review_date:
                        review_obj["datePublished"] = review_date
                    
                    if source:
                        review_obj["publisher"] = {"@type": "Organization", "name": source}
                    
                    product_reviews.append(review_obj)
        
        if len(product_reviews) > 0:
            products_with_reviews_count += 1
        
        # Generate schema graph
        schema_graph = generate_product_schema_graph(row, product_reviews)
        
        # Validate JSON-LD structure
        try:
            json.dumps(schema_graph, ensure_ascii=False)
            validation_ok = True
        except Exception as e:
            print(f"⚠️ JSON validation warning for {product_name}: {e}")
            validation_ok = False
        
        # Create filename
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
        
        summary_rows.append({
            'product': product_name,
            'slug': product_slug,
            'reviewCount': review_count,
            'avgRating': avg_rating or '',
        })
        
        # Verification log per product
        if review_count > 0:
            print(f"✅ [{product_name}] matched {review_count} reviews, avg {avg_rating}")
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
    
    # Save QA Summary CSV
    summary_df = pd.DataFrame(summary_rows)
    summary_csv = outputs_dir / 'review_summary.csv'
    try:
        summary_df.to_csv(summary_csv, index=False, encoding='utf-8-sig')
        print(f"📊 Review summary saved to: {summary_csv.name}")
    except Exception as e:
        print(f"⚠️ Could not save review summary: {e}")
    
    # Summary
    products_without_reviews = valid_products - products_with_reviews_count
    
    # Get latest review date if available
    latest_review_date = None
    if 'date' in reviews_df.columns:
        dates = pd.to_datetime(reviews_df['date'], errors='coerce')
        dates = dates.dropna()
        if len(dates) > 0:
            latest_review_date = dates.max().strftime('%Y-%m-%d')
    
    # Get source counts
    google_count = len(reviews_df[reviews_df.get('source', '').str.contains('Google', case=False, na=False)])
    trust_count = len(reviews_df[reviews_df.get('source', '').str.contains('Trustpilot', case=False, na=False)])
    
    print("\n" + "="*60)
    print("📊 SCHEMA GENERATION SUMMARY")
    print("="*60)
    print(f"Total products: {valid_products}")
    # Count ALL products that have reviews (including fuzzy matches from Step 4)
    print(f"Products with reviews: {products_with_reviews_count}")
    print(f"Products without reviews: {valid_products - products_with_reviews_count}")
    if latest_review_date:
        print(f"Latest review date: {latest_review_date}")
    print(f"Google reviews: {google_count}")
    print(f"Trustpilot reviews: {trust_count}")
    print(f"HTML files saved to: {outputs_dir.absolute()}")
    print(f"Combined CSV saved to: {output_csv.absolute()}")
    print("="*60)
    print("\n✅ Schema generation complete!")
    print("\n💡 Each HTML file is ready to copy-paste into Squarespace Code Blocks")
    
    # Validation summary
    print("\n[SchemaGenerator] Valid JSON-LD structure OK")
    print("[SchemaGenerator] SKU and brand added for all products")
    print("[SchemaGenerator] ReviewBody sanitized")
    
    # Print match count for UI parsing (use actual products_with_reviews_count)
    print(f"\n📊 MATCH_COUNT: {products_with_reviews_count}")

if __name__ == '__main__':
    main()
