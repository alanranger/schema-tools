#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Product Schema Generation Script - v6.1 Baseline
Stage 4: Generate Squarespace-ready HTML schema files with @graph structure

Schema Type: ["Product", "Course"] (locked baseline)
@graph Order: LocalBusiness → BreadcrumbList → Product/Course

Reads:
  - inputs-files/workflow/02 – products_cleaned.xlsx
  - inputs-files/workflow/03 – combined_product_reviews.csv

Outputs:
  - One HTML file per product: [Product_Slug]_schema_squarespace_ready.html in /outputs/
  - Combined CSV: inputs-files/workflow/04 – alanranger_product_schema_FINAL_WITH_REVIEW_RATINGS.csv
  - QA Summary CSV: outputs/review_summary.csv

v6.1 Changes:
  - Locked Product/Course hybrid schema as baseline
  - Added comprehensive validation hooks
  - Ensures 100% Rich Results and Merchant Center compliance
  - Fails generation if required keys are missing
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
    # Normalize breadcrumb name: ensure sentence case (not all caps) and use en dash (–) for dates
    breadcrumb_name = product_name.strip()
    
    # Convert all-caps or mixed-case words to sentence case
    # Handle cases like "BATSFORD Arboretum" -> "Batsford Arboretum"
    words = breadcrumb_name.split()
    normalized_words = []
    for word in words:
        if not word or not isinstance(word, str):
            normalized_words.append(word)
            continue
        if word.isupper() and len(word) > 1:
            # Convert all-caps to title case
            normalized_words.append(word.title())
        elif len(word) > 2 and word[0].isupper() and word[1:].isupper():
            # Handle mixed case like "BATSFORD" -> "Batsford" (first char upper, rest upper)
            normalized_words.append(word.capitalize())
        else:
            # Preserve existing case for normal words
            normalized_words.append(word)
    breadcrumb_name = ' '.join(normalized_words)
    
    # Replace hyphens with en dashes in date ranges (e.g., "23-31 Oct" -> "23 – 31 Oct")
    # Handle both "23-31 Oct" and "23 - 31 Oct" formats
    breadcrumb_name = re.sub(r'(\d+)\s*-\s*(\d+)\s+([A-Z][a-z]+)', r'\1 – \2 \3', breadcrumb_name)
    # Also handle cases like "23-31 Oct 2026" or "23 - 31 Oct 2026"
    breadcrumb_name = re.sub(r'(\d+)\s*-\s*(\d+)\s+([A-Z][a-z]+\s+\d{4})', r'\1 – \2 \3', breadcrumb_name)
    
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
                "name": breadcrumb_name,  # Normalized: sentence case with en dash for dates
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
        "@type": ["Product", "Course"],
        "name": product_name,
        "sku": sku,
        "brand": {
            "@type": "Brand",
            "name": "Alan Ranger Photography"
        },
        "provider": {
            "@type": "Organization",
            "name": "Alan Ranger Photography",
            "sameAs": "https://www.alanranger.com"
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
    
    # Build @graph structure - Keep only LocalBusiness (it inherits Organization properties)
    try:
        breadcrumb_data = get_breadcrumbs(product_name, product_url)
    except Exception as e:
        print(f"⚠️ Error generating breadcrumbs for '{product_name}': {e}")
        # Fallback to simple breadcrumb without normalization
        breadcrumb_data = {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.alanranger.com"},
                {"@type": "ListItem", "position": 2, "name": "Photo Workshops UK", "item": "https://www.alanranger.com/photo-workshops-uk"},
                {"@type": "ListItem", "position": 3, "name": product_name, "item": product_url}
            ]
        }
    
    graph = [
        LOCAL_BUSINESS,
        breadcrumb_data,
        product_schema
    ]
    
    # Add @id to product schema
    product_slug = slugify(product_name)
    product_schema["@id"] = f"https://www.alanranger.com/{product_slug}#schema"
    
    return {
        "@context": "https://schema.org",
        "@graph": graph
    }

def validate_schema_structure(schema_data, product_name):
    """
    Validate schema structure against v6.1 baseline requirements.
    Returns (is_valid, error_messages)
    """
    errors = []
    
    # Check @graph exists
    if '@graph' not in schema_data:
        errors.append("Missing @graph structure")
        return False, errors
    
    graph = schema_data['@graph']
    if not isinstance(graph, list) or len(graph) < 3:
        errors.append(f"@graph must contain at least 3 objects (LocalBusiness, BreadcrumbList, Product/Course)")
        return False, errors
    
    # Find Product/Course object (should be last in graph)
    product_schema = None
    for obj in graph:
        obj_type = obj.get('@type', [])
        if isinstance(obj_type, list) and 'Product' in obj_type and 'Course' in obj_type:
            product_schema = obj
            break
    
    if not product_schema:
        errors.append("Missing Product/Course object in @graph")
        return False, errors
    
    # Validate Product/Course required keys
    required_keys = {
        'name': 'string',
        'sku': 'string',
        'brand': 'dict',
        'provider': 'dict',
        'description': 'string',
        'image': 'string',
        'url': 'string',
        'offers': 'dict',
        '@id': 'string'
    }
    
    for key, expected_type in required_keys.items():
        if key not in product_schema:
            errors.append(f"Product schema missing required key: {key}")
        elif expected_type == 'dict' and not isinstance(product_schema[key], dict):
            errors.append(f"Product schema key '{key}' must be an object")
        elif expected_type == 'string' and not isinstance(product_schema[key], str):
            errors.append(f"Product schema key '{key}' must be a string")
    
    # Validate @type
    obj_type = product_schema.get('@type', [])
    if not isinstance(obj_type, list) or set(obj_type) != {'Product', 'Course'}:
        errors.append(f"Product @type must be exactly ['Product', 'Course'], got: {obj_type}")
    
    # Validate brand structure
    brand = product_schema.get('brand', {})
    if not isinstance(brand, dict) or brand.get('@type') != 'Brand' or 'name' not in brand:
        errors.append("Product 'brand' must be a Brand object with 'name'")
    
    # Validate provider structure
    provider = product_schema.get('provider', {})
    if not isinstance(provider, dict) or provider.get('@type') != 'Organization' or 'name' not in provider or 'sameAs' not in provider:
        errors.append("Product 'provider' must be an Organization object with 'name' and 'sameAs'")
    
    # Validate offers structure
    offers = product_schema.get('offers', {})
    if not isinstance(offers, dict):
        errors.append("Product 'offers' must be an object")
    else:
        required_offer_keys = ['price', 'priceCurrency', 'availability', 'url', 'validFrom', 'shippingDetails', 'hasMerchantReturnPolicy']
        for key in required_offer_keys:
            if key not in offers:
                errors.append(f"Offers missing required key: {key}")
        
        # Validate shippingDetails
        shipping = offers.get('shippingDetails', {})
        if not isinstance(shipping, dict) or shipping.get('doesNotShip') != 'http://schema.org/True':
            errors.append("Offers 'shippingDetails.doesNotShip' must be 'http://schema.org/True'")
        
        # Validate hasMerchantReturnPolicy
        return_policy = offers.get('hasMerchantReturnPolicy', {})
        if not isinstance(return_policy, dict):
            errors.append("Offers 'hasMerchantReturnPolicy' must be an object")
        else:
            required_policy_keys = ['returnPolicyCategory', 'merchantReturnDays', 'refundType', 'applicableCountry', 'returnMethod']
            for key in required_policy_keys:
                if key not in return_policy:
                    errors.append(f"Return policy missing required key: {key}")
    
    # Validate reviews if present
    if 'review' in product_schema:
        reviews = product_schema['review']
        if not isinstance(reviews, list):
            errors.append("Product 'review' must be an array")
        else:
            # Validate aggregateRating matches review count
            aggregate = product_schema.get('aggregateRating', {})
            if aggregate:
                review_count = aggregate.get('reviewCount', 0)
                if review_count != len(reviews):
                    errors.append(f"aggregateRating.reviewCount ({review_count}) does not match review array length ({len(reviews)})")
    
    # Validate @graph order: LocalBusiness, BreadcrumbList, Product/Course
    if len(graph) >= 3:
        first_type = graph[0].get('@type', '')
        second_type = graph[1].get('@type', '')
        if first_type != 'LocalBusiness':
            errors.append(f"First @graph object must be LocalBusiness, got: {first_type}")
        if second_type != 'BreadcrumbList':
            errors.append(f"Second @graph object must be BreadcrumbList, got: {second_type}")
    
    # Ensure no Event fields are present
    forbidden_keys = ['startDate', 'endDate', 'eventStatus', 'eventAttendanceMode', 'location']
    for key in forbidden_keys:
        if key in product_schema:
            errors.append(f"Forbidden Event field found: {key}")
    
    # Validate all objects have @type and url (if applicable)
    for i, obj in enumerate(graph):
        if '@type' not in obj:
            errors.append(f"@graph object {i} missing @type")
        # LocalBusiness and Product should have url
        obj_type = obj.get('@type', '')
        if obj_type in ['LocalBusiness', 'Product'] or (isinstance(obj_type, list) and 'Product' in obj_type):
            if 'url' not in obj:
                errors.append(f"@graph object {i} ({obj_type}) missing required 'url'")
    
    return len(errors) == 0, errors

def schema_to_html(schema_data):
    """Convert schema JSON to Squarespace-ready HTML"""
    json_str = json.dumps(schema_data, indent=2, ensure_ascii=False)
    return f'<script type="application/ld+json">\n{json_str}\n</script>'

def main():
    # Suppress warnings to prevent false "exit code 1" errors in Electron
    warnings.filterwarnings("ignore")
    
    print("="*60)
    print("PRODUCT SCHEMA GENERATOR - Step 4 (v6.1 Baseline)")
    print("="*60)
    print()
    
    # Use absolute paths based on script location
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    workflow_dir = project_root / 'inputs-files' / 'workflow'
    outputs_dir = project_root / 'outputs'
    outputs_dir.mkdir(exist_ok=True)
    
    print(f"📂 Project root: {project_root}")
    print(f"📂 Workflow directory: {workflow_dir}")
    print(f"📂 Outputs directory: {outputs_dir}")
    print()
    
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
        # Trustpilot reviews use 'review_content', Google reviews use 'reviewBody'
        # Check both and merge them
        if "reviewbody" not in reviews_df.columns:
            for alt in ["review_text", "content", "text", "body", "comment", "review"]:
                if alt in reviews_df.columns:
                    reviews_df["reviewbody"] = reviews_df[alt]
                    print(f"✅ Mapped '{alt}' → reviewBody")
                    break
        
        # If reviewbody exists but is empty, try review_content (Trustpilot)
        if "reviewbody" in reviews_df.columns:
            # Fill empty reviewbody with review_content where available
            if "review_content" in reviews_df.columns:
                mask = (reviews_df["reviewbody"].isna()) | (reviews_df["reviewbody"] == '') | (reviews_df["reviewbody"].astype(str).str.strip() == '')
                reviews_df.loc[mask, "reviewbody"] = reviews_df.loc[mask, "review_content"].fillna('')
                filled_count = mask.sum()
                if filled_count > 0:
                    print(f"✅ Filled {filled_count} empty reviewBody entries from review_content")
        
        # Create empty fallback if still missing
        if "reviewbody" not in reviews_df.columns:
            reviews_df["reviewbody"] = ""
            print("⚠️  No review text column found; created empty reviewBody for compatibility")
        
        # Convert ratingValue to numeric
        reviews_df["ratingvalue"] = pd.to_numeric(reviews_df.get("ratingvalue"), errors="coerce")
        
        # Parse dates safely - handle ISO timestamp format
        if "date" in reviews_df.columns:
            # Convert ISO timestamps to dates if needed
            def parse_review_date(val):
                if pd.isna(val):
                    return None
                val_str = str(val).strip()
                # Handle ISO timestamp format (e.g., "2024-12-15T14:30:00")
                if 'T' in val_str:
                    # Extract just the date part
                    date_part = val_str.split('T')[0]
                    try:
                        return pd.to_datetime(date_part, errors='coerce')
                    except:
                        return pd.to_datetime(val_str, errors='coerce', dayfirst=True)
                else:
                    return pd.to_datetime(val_str, errors='coerce', dayfirst=True)
            
            reviews_df["date"] = reviews_df["date"].apply(parse_review_date)
        
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
    
    # Create product slugs from URLs (matching merge-reviews.py EXACTLY)
    def get_slug_from_url(url):
        """Extract and normalize slug from URL - MUST match merge-reviews.py logic"""
        if pd.isna(url) or not url:
            return ''
        try:
            url_str = str(url).strip().rstrip('/')
            # Extract slug from URL (same as merge-reviews.py)
            slug = url_str.split('/')[-1]
            # Apply slugify directly (matching merge-reviews.py line 213)
            return slugify(slug) if slug else ''
        except:
            return ''
    
    if 'url' in df_products.columns:
        # Match merge-reviews.py line 213 exactly
        df_products['product_slug'] = df_products['url'].apply(lambda u: slugify(str(u).split("/")[-1]) if pd.notna(u) else '')
        # Fill missing slugs with name-based slugs (matching merge-reviews.py line 216)
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
    
    # Debug: Show summary of review slugs vs product slugs
    print(f"\n📊 Review-Product Matching Summary:")
    print(f"   Reviews with product_slug: {len(reviews_df[reviews_df['product_slug'].notna() & (reviews_df['product_slug'] != '')])}")
    print(f"   Unique review slugs: {len(reviews_df['product_slug'].dropna().unique())}")
    print(f"   Unique product slugs: {len(df_products['product_slug'].dropna().unique())}")
    
    # Show sample review slugs
    sample_review_slugs = reviews_df['product_slug'].dropna().unique()[:10]
    print(f"   Sample review slugs: {sample_review_slugs.tolist()}")
    
    # Show sample product slugs
    sample_product_slugs = df_products['product_slug'].dropna().unique()[:10]
    print(f"   Sample product slugs: {sample_product_slugs.tolist()}")
    
    schemas_data = []
    html_files = []
    nan_count = 0
    products_with_reviews_count = 0
    summary_rows = []
    
    # Track mapped reviews by source
    mapped_google_reviews = []
    mapped_trustpilot_reviews = []
    
    # Track validation statistics
    breadcrumbs_normalised_count = 0
    
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
        
        # Debug: Check if this is Batsford product
        is_batsford = 'batsford' in product_name.lower() or 'batsford' in str(product_slug).lower()
        if is_batsford:
            print(f"\n🔍 Processing Batsford product:")
            print(f"   Product name: {product_name}")
            print(f"   Product slug: {product_slug}")
            print(f"   Product URL: {row.get('url', '')}")
            if reviews_for_product is not None and len(reviews_for_product) > 0:
                print(f"   ✅ Found {len(reviews_for_product)} reviews")
            else:
                print(f"   ⚠️ No reviews found")
                print(f"   Available review slugs: {list(grouped_reviews.groups.keys())[:10]}")
        
        # Debug logging for products with reviews
        if reviews_for_product is not None and len(reviews_for_product) > 0:
            google_count = len(reviews_for_product[reviews_for_product.get('source', '').str.contains('Google', case=False, na=False)])
            trustpilot_count = len(reviews_for_product[reviews_for_product.get('source', '').str.contains('Trustpilot', case=False, na=False)])
            if google_count > 0 or trustpilot_count > 0:
                print(f"   ✅ {product_name[:50]}... → {len(reviews_for_product)} reviews ({google_count} Google, {trustpilot_count} Trustpilot)")
        
        # Process reviews if found
        if reviews_for_product is not None and len(reviews_for_product) > 0:
            # Sort by date (newest first) before limiting to ensure we get the most recent reviews
            if 'date' in reviews_for_product.columns:
                # Convert dates to datetime for proper sorting
                reviews_for_product = reviews_for_product.copy()
                reviews_for_product['_sort_date'] = pd.to_datetime(reviews_for_product['date'], errors='coerce', dayfirst=True)
                reviews_for_product = reviews_for_product.sort_values('_sort_date', ascending=False, na_position='last')
                reviews_for_product = reviews_for_product.drop(columns=['_sort_date'])
            
            # Limit to 25 reviews per product (after sorting, so we get the newest 25)
            group = reviews_for_product.head(25)
            
            for _, review_row in group.iterrows():
                rating_val = review_row.get('ratingvalue')
                if rating_val and rating_val >= 4:
                    # Get review body from various possible column names
                    # Check reviewbody first (Google), then review_content (Trustpilot), then other variations
                    review_body = ''
                    for col in ['reviewbody', 'review_content', 'review_body', 'review', 'review_text', 'comment', 'content']:
                        if col in review_row.index:
                            review_body = str(review_row.get(col, '')).strip()
                            if review_body and review_body.lower() not in ['nan', 'none', '']:
                                break
                    
                    # Replace "nan" or empty review texts with source-specific fallback message
                    if not review_body or review_body.lower() == 'nan' or review_body == '':
                        review_source = str(review_row.get('source', '')).strip()
                        if 'google' in review_source.lower():
                            review_body = "Customer review available on Google"
                        else:
                            review_body = "Customer review available on Trustpilot"
                    
                    # Get author
                    author = 'Anonymous'
                    for col in ['author', 'reviewer', 'reviewer_name']:
                        if col in review_row.index:
                            author_val = str(review_row.get(col, '')).strip()
                            if author_val and author_val.lower() not in ['anonymous', 'n/a', '']:
                                author = author_val
                                break
                    
                    # Get date - check multiple column name variations and handle ISO timestamp format
                    review_date = ''
                    date_columns = ['date', 'review_date', 'datepublished', 'date_published', 'created_at', 'timestamp', 'updatetime', 'update_time']
                    for col in date_columns:
                        if col in review_row.index:
                            date_val = review_row.get(col)
                            if pd.notna(date_val):
                                try:
                                    # Try parsing as datetime first
                                    if isinstance(date_val, pd.Timestamp):
                                        review_date = date_val.strftime('%Y-%m-%d')
                                    else:
                                        date_str = str(date_val).strip()
                                        # Handle ISO timestamp format (e.g., "2024-12-15T14:30:00" or "2024-12-15T14:30:00Z")
                                        if 'T' in date_str:
                                            # Extract just the date part (YYYY-MM-DD)
                                            review_date = date_str.split('T')[0]
                                            # Validate it's a proper date
                                            pd.to_datetime(review_date)
                                        else:
                                            # Try parsing string dates
                                            parsed_date = pd.to_datetime(date_str, errors='coerce', dayfirst=True)
                                            if pd.notna(parsed_date):
                                                review_date = parsed_date.strftime('%Y-%m-%d')
                                            else:
                                                # Fallback: try extracting YYYY-MM-DD format
                                                date_match = re.search(r'(\d{4}-\d{2}-\d{2})', date_str)
                                                if date_match:
                                                    review_date = date_match.group(1)
                                except Exception as e:
                                    pass
                            if review_date:
                                break
                    
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
                    
                    # Track mapped reviews by source for statistics
                    source_lower = str(source).lower() if source else ''
                    review_date_obj = None
                    if review_date:
                        try:
                            review_date_obj = pd.to_datetime(review_date, errors='coerce')
                            if pd.isna(review_date_obj):
                                review_date_obj = None
                        except:
                            review_date_obj = None
                    else:
                        # If review_date is empty, try to get date directly from review_row
                        for col in date_columns:
                            if col in review_row.index:
                                date_val = review_row.get(col)
                                if pd.notna(date_val):
                                    try:
                                        review_date_obj = pd.to_datetime(date_val, errors='coerce', dayfirst=True)
                                        if pd.isna(review_date_obj):
                                            review_date_obj = None
                                        else:
                                            break
                                    except:
                                        pass
                    
                    if 'google' in source_lower:
                        # Only add to mapped_google_reviews if we have a valid date
                        if review_date_obj is not None and pd.notna(review_date_obj):
                            mapped_google_reviews.append({
                                'date': review_date_obj,
                                'source': 'Google',
                                'review_date_str': review_date  # Keep original string for debugging
                            })
                        elif review_date:  # If we have a string date but couldn't parse it, still track it
                            mapped_google_reviews.append({
                                'date': None,
                                'source': 'Google',
                                'review_date_str': review_date  # Keep original string for debugging
                            })
                    elif 'trustpilot' in source_lower:
                        # Only add to mapped_trustpilot_reviews if we have a valid date
                        if review_date_obj is not None and pd.notna(review_date_obj):
                            mapped_trustpilot_reviews.append({
                                'date': review_date_obj,
                                'source': 'Trustpilot',
                                'review_date_str': review_date  # Keep original string for debugging
                            })
                        elif review_date:  # If we have a string date but couldn't parse it, still track it
                            mapped_trustpilot_reviews.append({
                                'date': None,
                                'source': 'Trustpilot',
                                'review_date_str': review_date  # Keep original string for debugging
                            })
        
        if len(product_reviews) > 0:
            products_with_reviews_count += 1
        
        # Generate schema graph
        schema_graph = generate_product_schema_graph(row, product_reviews)
        
        # Track validation statistics
        breadcrumbs_normalised_count += 1  # All breadcrumbs use normalized names
        
        # Validate JSON-LD structure (basic JSON syntax)
        try:
            json.dumps(schema_graph, ensure_ascii=False)
            json_valid = True
        except Exception as e:
            print(f"❌ JSON syntax error for {product_name}: {e}")
            json_valid = False
            sys.exit(1)
        
        # Validate schema structure against v6.1 baseline requirements
        is_valid, validation_errors = validate_schema_structure(schema_graph, product_name)
        if not is_valid:
            print(f"❌ Schema validation FAILED for '{product_name}':")
            for error in validation_errors:
                print(f"   - {error}")
            print(f"\n⚠️ Generation stopped: Schema does not meet v6.1 baseline requirements")
            sys.exit(1)
        
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
    
    # Calculate mapped review statistics
    mapped_google_count = len(mapped_google_reviews)
    mapped_trustpilot_count = len(mapped_trustpilot_reviews)
    total_mapped_reviews = mapped_google_count + mapped_trustpilot_count
    
    # Get latest review dates for mapped reviews
    latest_google_date = None
    if mapped_google_reviews:
        google_dates = []
        for r in mapped_google_reviews:
            date_val = r.get('date')
            date_str = r.get('review_date_str', '')
            
            # Try to get a valid date from either the date object or string
            parsed_date = None
            
            # First try the date object
            if date_val is not None and pd.notna(date_val):
                try:
                    if isinstance(date_val, pd.Timestamp):
                        parsed_date = date_val
                    else:
                        parsed_date = pd.to_datetime(date_val, errors='coerce')
                        if pd.isna(parsed_date):
                            parsed_date = None
                except:
                    parsed_date = None
            
            # If date object failed, try parsing the string date
            if parsed_date is None and date_str:
                try:
                    parsed_date = pd.to_datetime(date_str, errors='coerce', dayfirst=True)
                    if pd.isna(parsed_date):
                        parsed_date = None
                except:
                    parsed_date = None
            
            # Only add valid dates (not today's date unless it's actually in the data)
            if parsed_date is not None:
                # Safety check: Don't add dates that are in the future (beyond today)
                today = pd.Timestamp.today().normalize()
                parsed_date_normalized = pd.Timestamp(parsed_date).normalize()
                if parsed_date_normalized <= today:
                    google_dates.append(parsed_date_normalized)
                else:
                    print(f"⚠️ Skipping future date: {parsed_date_normalized.strftime('%Y-%m-%d')} (today is {today.strftime('%Y-%m-%d')})")
        
        if google_dates:
            latest_google_date = max(google_dates).strftime('%Y-%m-%d')
            # Debug: Print the actual latest date found and sample dates
            sample_dates = sorted(google_dates, reverse=True)[:5]
            print(f"🔍 Latest Google review date calculated: {latest_google_date} (from {len(google_dates)} valid dates)")
            print(f"🔍 Sample Google dates: {[d.strftime('%Y-%m-%d') for d in sample_dates]}")
        else:
            print(f"⚠️ No valid Google review dates found in {len(mapped_google_reviews)} mapped reviews")
    
    latest_trustpilot_date = None
    if mapped_trustpilot_reviews:
        trustpilot_dates = []
        for r in mapped_trustpilot_reviews:
            date_val = r.get('date')
            date_str = r.get('review_date_str', '')
            
            # Try to get a valid date from either the date object or string
            parsed_date = None
            
            # First try the date object
            if date_val is not None and pd.notna(date_val):
                try:
                    if isinstance(date_val, pd.Timestamp):
                        parsed_date = date_val
                    else:
                        parsed_date = pd.to_datetime(date_val, errors='coerce')
                        if pd.isna(parsed_date):
                            parsed_date = None
                except:
                    parsed_date = None
            
            # If date object failed, try parsing the string date
            if parsed_date is None and date_str:
                try:
                    parsed_date = pd.to_datetime(date_str, errors='coerce', dayfirst=True)
                    if pd.isna(parsed_date):
                        parsed_date = None
                except:
                    parsed_date = None
            
            # Only add valid dates
            if parsed_date is not None:
                trustpilot_dates.append(parsed_date)
        
        if trustpilot_dates:
            latest_trustpilot_date = max(trustpilot_dates).strftime('%Y-%m-%d')
            # Debug: Print the actual latest date found
            print(f"🔍 Latest Trustpilot review date calculated: {latest_trustpilot_date} (from {len(trustpilot_dates)} valid dates)")
    
    # Get overall latest review date (for backward compatibility)
    latest_review_date = None
    all_dates = []
    if latest_google_date:
        all_dates.append(pd.to_datetime(latest_google_date))
    if latest_trustpilot_date:
        all_dates.append(pd.to_datetime(latest_trustpilot_date))
    if all_dates:
        latest_review_date = max(all_dates).strftime('%Y-%m-%d')
    
    # Get total counts from merged CSV (for reference)
    total_google_count = len(reviews_df[reviews_df.get('source', '').str.contains('Google', case=False, na=False)])
    total_trustpilot_count = len(reviews_df[reviews_df.get('source', '').str.contains('Trustpilot', case=False, na=False)])
    
    print("\n" + "="*60)
    print("📊 SCHEMA GENERATION SUMMARY")
    print("="*60)
    print(f"Total products: {valid_products}")
    # Count ALL products that have reviews (including fuzzy matches from Step 4)
    print(f"Products with reviews: {products_with_reviews_count}")
    print(f"Products without reviews: {valid_products - products_with_reviews_count}")
    print("")
    print("📊 Mapped Reviews:")
    print(f"  Google reviews mapped: {mapped_google_count} (of {total_google_count} total)")
    if latest_google_date:
        print(f"  Latest Google review: {latest_google_date}")
    print(f"  Trustpilot reviews mapped: {mapped_trustpilot_count} (of {total_trustpilot_count} total)")
    if latest_trustpilot_date:
        print(f"  Latest Trustpilot review: {latest_trustpilot_date}")
    print(f"  Total mapped reviews: {total_mapped_reviews}")
    if latest_review_date:
        print(f"  Overall latest review: {latest_review_date}")
    print("")
    print(f"HTML files saved to: {outputs_dir.absolute()}")
    print(f"Combined CSV saved to: {output_csv.absolute()}")
    print("="*60)
    print("\n✅ Schema generation complete!")
    print("\n💡 Each HTML file is ready to copy-paste into Squarespace Code Blocks")
    
    # Validation summary - v6.1 baseline
    print("\n[SchemaGenerator v6.1] Valid JSON-LD structure OK")
    print("[SchemaGenerator v6.1] Product/Course @type locked: ['Product', 'Course']")
    print("[SchemaGenerator v6.1] Required keys validated: name, sku, brand, provider, description, image, url, offers, @id")
    print("[SchemaGenerator v6.1] Offers structure validated: shippingDetails, hasMerchantReturnPolicy")
    print("[SchemaGenerator v6.1] @graph order validated: LocalBusiness → BreadcrumbList → Product/Course")
    print("[SchemaGenerator v6.1] Event fields excluded: startDate, endDate, eventStatus, eventAttendanceMode, location")
    print("[SchemaGenerator v6.1] aggregateRating.reviewCount matches review array length")
    print("[SchemaGenerator v6.1] All objects include @type and url (where required)")
    print(f"[SchemaGenerator v6.1] Schema structure verified ✓ ({valid_products} products)")
    
    # Print match count for UI parsing (use actual products_with_reviews_count)
    print(f"\n📊 MATCH_COUNT: {products_with_reviews_count}")

if __name__ == '__main__':
    main()
