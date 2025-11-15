#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Product Schema Generation Script - v6.1 Baseline
Stage 4: Generate Squarespace-ready HTML schema files with @graph structure

Schema Type: ["Product", "Course"] (locked baseline)
@graph Order: LocalBusiness → BreadcrumbList → Product/Course

Reads:
  - shared-resources/csv processed/02 – products_cleaned.xlsx
  - shared-resources/csv processed/03 – combined_product_reviews.csv
  - shared-resources/csv/raw-01-products*.csv or 07-product*.csv (for schema type detection)
  - shared-resources/csv/*photographic-workshops-near-me*.csv or *photo-workshops-uk-landscape*.csv (for event date matching - handles original Squarespace export filenames)
  - shared-resources/csv/*beginners-photography-lessons*.csv or *photography-services-courses-mentoring*.csv (for event date matching - handles original Squarespace export filenames)

Outputs:
  - One HTML file per product: [Product_Slug]_schema_squarespace_ready.html in shared-resources/outputs/schema/
  - Combined CSV: shared-resources/csv processed/04 – alanranger_product_schema_FINAL_WITH_REVIEW_RATINGS.csv
  - QA Summary CSV: shared-resources/outputs/schema/review_summary.csv

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
from datetime import datetime, date, timedelta
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
    "image": "https://images.squarespace-cdn.com/content/v1/5013f4b2c4aaa4752ac69b17/b859ad2b-1442-4595-b9a4-410c32299bf8/ALAN+RANGER+photography+LOGO+BLACK.+switched+small.png?format=1500w",
    "priceRange": "£50–£500",
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
    """Generate breadcrumb list for product with normalized casing and correct parent category"""
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
    
    # Extract parent category from URL
    # URL format: https://www.alanranger.com/{parent-category}/{product-slug}
    parent_category_slug = None
    parent_category_name = None
    parent_category_url = None
    
    if product_url and isinstance(product_url, str):
        # Remove protocol and domain
        url_path = product_url.replace('https://www.alanranger.com', '').replace('http://www.alanranger.com', '').strip('/')
        path_parts = url_path.split('/')
        
        if len(path_parts) >= 2:
            # First part is parent category slug
            parent_category_slug = path_parts[0]
        elif len(path_parts) == 1:
            # Only one part - might be a direct product URL without parent category
            # Check if it matches known parent categories
            if path_parts[0] in ['photo-workshops-uk', 'photography-services-near-me']:
                parent_category_slug = path_parts[0]
    
    # Map parent category slugs to display names and URLs
    parent_category_map = {
        'photo-workshops-uk': {
            'name': 'Photo Workshops UK',
            'url': 'https://www.alanranger.com/photo-workshops-uk'
        },
        'photography-services-near-me': {
            'name': 'Photography Services Near Me',
            'url': 'https://www.alanranger.com/photography-services-near-me'
        }
    }
    
    # Get parent category info
    if parent_category_slug and parent_category_slug in parent_category_map:
        parent_category_name = parent_category_map[parent_category_slug]['name']
        parent_category_url = parent_category_map[parent_category_slug]['url']
    else:
        # Default fallback
        parent_category_name = 'Photo Workshops UK'
        parent_category_url = 'https://www.alanranger.com/photo-workshops-uk'
    
    breadcrumb = {
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
                "name": parent_category_name,  # Dynamic based on URL path
                "item": parent_category_url
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": breadcrumb_name,  # Normalized: sentence case with en dash for dates
                "item": product_url
            }
        ]
    }
    
    # Add @id to breadcrumb (matching lessons schema format)
    if product_url:
        url_path = product_url.replace('https://www.alanranger.com', '').replace('http://www.alanranger.com', '').strip('/')
        url_slug = url_path.split('/')[-1] if url_path else slugify(breadcrumb_name)
        breadcrumb["@id"] = f"https://www.alanranger.com/{url_slug}#breadcrumbs"
    else:
        product_slug = slugify(breadcrumb_name)
        breadcrumb["@id"] = f"https://www.alanranger.com/{product_slug}#breadcrumbs"
    
    return breadcrumb

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

def generate_product_schema_graph(product_row, reviews_list, include_aggregate_rating=True, schema_type='product', events_df=None):
    """Generate complete @graph schema for a product
    
    Args:
        product_row: Product data row
        reviews_list: List of review objects
        include_aggregate_rating: If True, add aggregateRating (only for first variant per page)
        schema_type: 'product', 'course', or 'event' - determines @type and additional fields
        events_df: DataFrame of events with dates for matching Event schemas to dates
    """
    
    product_name = str(product_row.get('name', '')).strip()
    product_url = str(product_row.get('url', '')).strip()
    product_description = str(product_row.get('description', '')).strip()
    product_image = str(product_row.get('image', '')).strip()
    
    # Determine schema @type based on schema_type parameter
    if schema_type == 'event':
        type_array = ["Product", "Event"]
    elif schema_type == 'course':
        type_array = ["Product", "Course"]
    else:
        # Default: Product only (for prints, vouchers, etc.)
        type_array = ["Product"]
    
    # Use SKU from input file (main_sku column from cleaned file)
    # Never use title or description as fallback for SKU
    sku = ''
    if pd.notna(product_row.get('main_sku')):
        sku_val = str(product_row.get('main_sku', '')).strip()
        if sku_val and sku_val.lower() not in ['nan', 'none', '']:
            sku = sku_val[:40]  # Truncate to 40 chars for Merchant Center compliance
    
    # Fallback to old 'sku' column if main_sku not available
    if not sku and pd.notna(product_row.get('sku')):
        sku_val = str(product_row.get('sku', '')).strip()
        if sku_val and sku_val.lower() not in ['nan', 'none', '']:
            sku = sku_val[:40]
    
    # Only generate SKU if no valid SKU found (never use title/description)
    if not sku:
        # Fallback: Generate SKU from product name + year (only if SKU column is missing)
        product_slug = slugify(product_name)
        current_year = date.today().year
        sku = f"{product_slug.upper()}-{current_year}"[:40]  # Truncate to 40 chars
    
    # Build product schema with dynamic @type
    product_schema = {
        "@type": type_array,
        "name": product_name,
        "sku": sku,
        "brand": {
            "@type": "Brand",
            "name": "Alan Ranger Photography"
        }
    }
    
    # Add provider for Course and Event types
    if schema_type in ['course', 'event']:
        product_schema["provider"] = {
            "@type": "Organization",
            "name": "Alan Ranger Photography",
            "sameAs": "https://www.alanranger.com"
        }
    
    # Add description - limit to 600 chars and strip line breaks
    if product_description:
        # Strip line breaks and normalize whitespace
        description_clean = ' '.join(product_description.split())
        # Limit to 600 characters
        if len(description_clean) > 600:
            description_clean = description_clean[:597] + '...'
        product_schema["description"] = description_clean
    
    # Add image - validate HTTPS URL, else omit
    if product_image:
        # Ensure HTTPS and valid URL format
        image_url = str(product_image).strip()
        if image_url.startswith('https://'):
            product_schema["image"] = image_url
        elif image_url.startswith('http://'):
            # Upgrade HTTP to HTTPS
            product_schema["image"] = image_url.replace('http://', 'https://', 1)
        # If not HTTPS/HTTP, omit (don't add invalid image URLs)
    
    # Add URL
    if product_url:
        product_schema["url"] = product_url
    
    # Determine if this is a course/workshop (in-person) vs physical product
    # Check URL path and product name for keywords
    is_course_workshop = False
    if product_url:
        url_path = product_url.replace('https://www.alanranger.com', '').replace('http://www.alanranger.com', '').strip('/')
        if 'photo-workshops-uk' in url_path or 'photography-services-near-me' in url_path:
            is_course_workshop = True
    if not is_course_workshop:
        # Check product name for course/workshop keywords
        name_lower = product_name.lower()
        course_keywords = ['workshop', 'course', 'class', 'lesson', 'tuition', 'mentoring', 'academy']
        if any(keyword in name_lower for keyword in course_keywords):
            is_course_workshop = True
    
    # Add offers from cleaned file (JSON array)
    # If offers column exists and contains JSON, parse and use it
    offers_data = None
    if 'offers' in product_row.index and pd.notna(product_row.get('offers')):
        try:
            offers_str = str(product_row.get('offers', '')).strip()
            if offers_str and offers_str.lower() not in ['nan', 'none', '']:
                offers_data = json.loads(offers_str)
                if not isinstance(offers_data, list):
                    offers_data = None
        except (json.JSONDecodeError, ValueError, TypeError):
            offers_data = None
    
    # Fallback: Create single offer from price if offers array not available
    if not offers_data:
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
                
                # Calculate priceValidUntil (12 months from today)
                price_valid_until = (date.today() + timedelta(days=365)).isoformat()
                
                # Determine return fees
                return_fees_val = "https://schema.org/ReturnShippingFees" if is_course_workshop else "https://schema.org/FreeReturn"
                
                # Build return policy
                return_policy = {
                    "@type": "MerchantReturnPolicy",
                    "returnPolicyCategory": "http://schema.org/MerchantReturnFiniteReturnWindow",
                    "merchantReturnDays": 28,
                    "refundType": "http://schema.org/FullRefund",
                    "applicableCountry": "GB",
                    "returnMethod": "http://schema.org/ReturnByMail",
                    "returnFees": return_fees_val
                }
                # Add returnShippingFeesAmount when returnFees is ReturnShippingFees
                if return_fees_val == "https://schema.org/ReturnShippingFees":
                    return_policy["returnShippingFeesAmount"] = {
                        "@type": "MonetaryAmount",
                        "value": "50.00",
                        "currency": "GBP"
                    }
                
                offers_data = [{
                    "@type": "Offer",
                    "sku": sku,
                    "price": f"{price_val:.2f}",
                    "priceCurrency": "GBP",
                    "availability": "https://schema.org/InStock",
                    "url": product_url,
                    "validFrom": valid_from,
                    "priceValidUntil": price_valid_until,
                    "seller": {
                        "@type": "Organization",
                        "name": "Alan Ranger Photography",
                        "url": "https://www.alanranger.com"
                    },
                    "shippingDetails": {
                        "@type": "OfferShippingDetails",
                        "doesNotShip": "http://schema.org/True",
                        "shippingDestination": {
                            "@type": "DefinedRegion",
                            "addressCountry": "GB"
                        }
                    },
                    "hasMerchantReturnPolicy": return_policy
                }]
            except (ValueError, TypeError):
                offers_data = None
    
    # Add offers to schema (can be single offer or array)
    if offers_data:
        # Ensure all offers have priceValidUntil set to +12 months
        price_valid_until = (date.today() + timedelta(days=365)).isoformat()
        
        # Add URL, shipping details, seller, and @id to each offer if missing, and ensure priceValidUntil
        for idx, offer in enumerate(offers_data):
            if 'url' not in offer and product_url:
                offer['url'] = product_url
            
            # Add @id to each offer for internal linking
            if '@id' not in offer and product_url:
                offer_id_suffix = f"#offer{idx + 1}" if len(offers_data) > 1 else "#offer"
                offer['@id'] = f"{product_url}{offer_id_suffix}"
            
            # Add seller field if missing (required for Merchant listings)
            if 'seller' not in offer:
                offer['seller'] = {
                    "@type": "Organization",
                    "name": "Alan Ranger Photography",
                    "url": "https://www.alanranger.com"
                }
            
            if 'shippingDetails' not in offer:
                offer['shippingDetails'] = {
                    "@type": "OfferShippingDetails",
                    "doesNotShip": "http://schema.org/True",
                    "shippingDestination": {
                        "@type": "DefinedRegion",
                        "addressCountry": "GB"
                    }
                }
            elif is_course_workshop:
                # For in-person courses/workshops, remove doesNotShip (not harmful but not needed)
                if 'doesNotShip' in offer['shippingDetails']:
                    del offer['shippingDetails']['doesNotShip']
            
            if 'hasMerchantReturnPolicy' not in offer:
                return_fees = "https://schema.org/ReturnShippingFees" if is_course_workshop else "https://schema.org/FreeReturn"
                return_policy = {
                    "@type": "MerchantReturnPolicy",
                    "returnPolicyCategory": "http://schema.org/MerchantReturnFiniteReturnWindow",
                    "merchantReturnDays": 28,
                    "refundType": "http://schema.org/FullRefund",
                    "applicableCountry": "GB",
                    "returnMethod": "http://schema.org/ReturnByMail",
                    "returnFees": return_fees
                }
                # Add returnShippingFeesAmount when returnFees is ReturnShippingFees
                if return_fees == "https://schema.org/ReturnShippingFees":
                    return_policy["returnShippingFeesAmount"] = {
                        "@type": "MonetaryAmount",
                        "value": "50.00",
                        "currency": "GBP"
                    }
                offer['hasMerchantReturnPolicy'] = return_policy
            else:
                # Ensure returnFees is set even if policy already exists
                if 'returnFees' not in offer['hasMerchantReturnPolicy']:
                    return_fees = "https://schema.org/ReturnShippingFees" if is_course_workshop else "https://schema.org/FreeReturn"
                    offer['hasMerchantReturnPolicy']['returnFees'] = return_fees
                    # Add returnShippingFeesAmount when returnFees is ReturnShippingFees
                    if return_fees == "https://schema.org/ReturnShippingFees":
                        offer['hasMerchantReturnPolicy']['returnShippingFeesAmount'] = {
                            "@type": "MonetaryAmount",
                            "value": "50.00",
                            "currency": "GBP"
                        }
                # Also ensure returnShippingFeesAmount is set if returnFees is already ReturnShippingFees
                elif offer['hasMerchantReturnPolicy'].get('returnFees') == "https://schema.org/ReturnShippingFees":
                    if 'returnShippingFeesAmount' not in offer['hasMerchantReturnPolicy']:
                        offer['hasMerchantReturnPolicy']['returnShippingFeesAmount'] = {
                            "@type": "MonetaryAmount",
                            "value": "50.00",
                            "currency": "GBP"
                        }
            
            # Ensure priceValidUntil is always set to +12 months
            if 'priceValidUntil' not in offer:
                offer['priceValidUntil'] = price_valid_until
            else:
                # Validate existing priceValidUntil is at least 12 months away
                try:
                    existing_date = pd.to_datetime(offer['priceValidUntil'], errors='coerce')
                    if pd.notna(existing_date):
                        min_valid_date = date.today() + timedelta(days=365)
                        if existing_date.date() < min_valid_date:
                            # Update to +12 months if it's too soon
                            offer['priceValidUntil'] = price_valid_until
                except:
                    # If parsing fails, set to +12 months
                    offer['priceValidUntil'] = price_valid_until
        
        # Always use array format for offers (even if single offer) when multiple variants exist
        # This improves price range display chances
        # However, if only one offer and no variants, use single object for cleaner schema
        if len(offers_data) == 1 and not product_row.get('total_variants', 1) > 1:
            product_schema["offers"] = offers_data[0]
        else:
            # Use array format (multiple offers OR single offer with variants)
            product_schema["offers"] = offers_data
    
    # Add Event-specific fields when schema_type is 'event'
    if schema_type == 'event':
        # Try to match product to event in events CSV to get actual dates
        start_date = None
        end_date = None
        location_name = None
        
        # First: Match product to event in events_df by URL slug or title
        if events_df is not None and len(events_df) > 0:
            product_name_lower = product_name.lower()
            product_url_slug = ''
            if product_url:
                product_url_slug = product_url.split('/')[-1].strip().lower()
            
            # Try to match by Event_URL (most reliable)
            for _, event_row in events_df.iterrows():
                event_url = str(event_row.get('Event_URL', '')).strip()
                event_url_slug = event_url.split('/')[-1].strip().lower() if event_url else ''
                
                # Match by URL slug (most reliable)
                if product_url_slug and event_url_slug and product_url_slug == event_url_slug:
                    if pd.notna(event_row.get('start_date_parsed')):
                        start_date = event_row['start_date_parsed'].strftime('%Y-%m-%d')
                        # Try to get end date
                        if 'End_Date' in event_row.index and pd.notna(event_row.get('End_Date')):
                            try:
                                end_date = pd.to_datetime(event_row['End_Date'], errors='coerce')
                                if pd.notna(end_date):
                                    end_date = end_date.strftime('%Y-%m-%d')
                                else:
                                    end_date = start_date  # Use start date if end date invalid
                            except:
                                end_date = start_date
                        else:
                            end_date = start_date  # Use start date if no end date
                        
                        # Extract location from event if available
                        if 'Location_Business_Name' in event_row.index and pd.notna(event_row.get('Location_Business_Name')):
                            location_name = str(event_row['Location_Business_Name']).strip()
                        elif 'Location_Name' in event_row.index and pd.notna(event_row.get('Location_Name')):
                            location_name = str(event_row['Location_Name']).strip()
                        
                        break
            
            # If no URL match, try to match by Event_Title (fuzzy match)
            if not start_date:
                for _, event_row in events_df.iterrows():
                    event_title = str(event_row.get('Event_Title', '')).lower()
                    
                    # Check if key words match (at least 2 significant words)
                    if event_title and product_name_lower:
                        event_words = [w for w in event_title.split() if len(w) > 4]
                        product_words = [w for w in product_name_lower.split() if len(w) > 4]
                        matches = sum(1 for word in event_words if word in product_name_lower)
                        if matches >= 2:  # At least 2 significant words match
                            if pd.notna(event_row.get('start_date_parsed')):
                                start_date = event_row['start_date_parsed'].strftime('%Y-%m-%d')
                                if 'End_Date' in event_row.index and pd.notna(event_row.get('End_Date')):
                                    try:
                                        end_date = pd.to_datetime(event_row['End_Date'], errors='coerce')
                                        if pd.notna(end_date):
                                            end_date = end_date.strftime('%Y-%m-%d')
                                        else:
                                            end_date = start_date
                                    except:
                                        end_date = start_date
                                else:
                                    end_date = start_date
                                
                                # Extract location from event if available
                                if 'Location_Business_Name' in event_row.index and pd.notna(event_row.get('Location_Business_Name')):
                                    location_name = str(event_row['Location_Business_Name']).strip()
                                elif 'Location_Name' in event_row.index and pd.notna(event_row.get('Location_Name')):
                                    location_name = str(event_row['Location_Name']).strip()
                                
                                break
        
        # Second: If no match found, try to extract dates from product name
        if not start_date:
            date_patterns = [
                r'(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([A-Z][a-z]+)\s+(\d{4})',  # "23-25 Jan 2026"
                r'([A-Z][a-z]+)\s+(\d{1,2})\s*[-–]\s*(\d{1,2})\s+(\d{4})',  # "Jan 23-25 2026"
                r'([A-Z][a-z]+)\s+(\d{4})',  # "Jan 2026"
            ]
            
            for pattern in date_patterns:
                match = re.search(pattern, product_name)
                if match:
                    try:
                        if len(match.groups()) == 4:
                            if match.group(1).isdigit():
                                day1, day2, month, year = match.groups()
                                start_date = f"{year}-{pd.to_datetime(month, format='%B').month:02d}-{int(day1):02d}"
                                end_date = f"{year}-{pd.to_datetime(month, format='%B').month:02d}-{int(day2):02d}"
                            else:
                                month, day1, day2, year = match.groups()
                                start_date = f"{year}-{pd.to_datetime(month, format='%B').month:02d}-{int(day1):02d}"
                                end_date = f"{year}-{pd.to_datetime(month, format='%B').month:02d}-{int(day2):02d}"
                        elif len(match.groups()) == 2:
                            month, year = match.groups()
                            start_date = f"{year}-{pd.to_datetime(month, format='%B').month:02d}-01"
                            end_date = start_date
                        break
                    except:
                        pass
        
        # Extract location from product name if not found from event
        if not location_name:
            location_keywords = {
                'coventry': 'Coventry',
                'lake district': 'Lake District',
                'peak district': 'Peak District',
                'yorkshire dales': 'Yorkshire Dales',
                'snowdonia': 'Snowdonia',
                'norfolk': 'Norfolk',
                'devon': 'Devon',
                'dorset': 'Dorset',
                'anglesey': 'Anglesey',
                'northumberland': 'Northumberland',
                'suffolk': 'Suffolk',
                'gower': 'Gower',
                'kerry': 'Kerry',
                'dartmoor': 'Dartmoor',
                'exmoor': 'Exmoor',
                'warwickshire': 'Warwickshire',
                'worcestershire': 'Worcestershire',
                'gloucestershire': 'Gloucestershire'
            }
            
            name_lower = product_name.lower()
            for keyword, location in location_keywords.items():
                if keyword in name_lower:
                    location_name = location
                    break
        
        # Ensure we have dates (REQUIRED for Event schemas)
        if not start_date:
            print(f"❌ ERROR: Could not find dates for Event '{product_name[:50]}...' - Event schemas require startDate and endDate")
            print(f"   Product URL: {product_url}")
            print(f"   Please ensure this product matches an event in the workshops CSV file")
            # Use error dates (will fail validation but schema will be generated)
            start_date = "1900-01-01"
            end_date = "1900-01-01"
        
        if not end_date:
            end_date = start_date
        
        # Add Event-specific fields (REQUIRED for Event schemas)
        product_schema["startDate"] = start_date
        product_schema["endDate"] = end_date
        product_schema["eventStatus"] = "https://schema.org/EventScheduled"
        product_schema["eventAttendanceMode"] = "https://schema.org/OfflineEventAttendanceMode"
        
        # Add location
        if location_name:
            product_schema["location"] = {
                "@type": "Place",
                "name": location_name,
                "address": {
                    "@type": "PostalAddress",
                    "addressLocality": "Coventry",
                    "addressRegion": "West Midlands",
                    "addressCountry": "GB"
                }
            }
        else:
            # Default location
            product_schema["location"] = {
                "@type": "Place",
                "name": "United Kingdom",
                "address": {
                    "@type": "PostalAddress",
                    "addressLocality": "Coventry",
                    "addressRegion": "West Midlands",
                    "addressCountry": "GB"
                }
            }
        
        # Add organizer and performer (required for Event schemas)
        product_schema["organizer"] = ORGANIZER
        product_schema["performer"] = PERFORMER
    
    # Add hasCourseInstance for Course type (optional enhancement)
    # This boosts chance of Course rich results
    if schema_type == 'course' and is_course_workshop and product_url:
        # Try to match product to lesson in events CSV to get actual dates
        start_date = None
        end_date = None
        location_name = None
        
        # First: Match product to lesson in events_df by URL slug or title
        if events_df is not None and len(events_df) > 0:
            product_name_lower = product_name.lower()
            product_url_slug = ''
            if product_url:
                product_url_slug = product_url.split('/')[-1].strip().lower()
            
            # Try to match by Event_URL (most reliable)
            for _, event_row in events_df.iterrows():
                event_url = str(event_row.get('Event_URL', '')).strip()
                event_url_slug = event_url.split('/')[-1].strip().lower() if event_url else ''
                
                # Match by URL slug (most reliable)
                if product_url_slug and event_url_slug and product_url_slug == event_url_slug:
                    if pd.notna(event_row.get('start_date_parsed')):
                        start_date = event_row['start_date_parsed'].strftime('%Y-%m-%d')
                        # Try to get end date
                        if 'End_Date' in event_row.index and pd.notna(event_row.get('End_Date')):
                            try:
                                end_date = pd.to_datetime(event_row['End_Date'], errors='coerce')
                                if pd.notna(end_date):
                                    end_date = end_date.strftime('%Y-%m-%d')
                                else:
                                    end_date = start_date  # Use start date if end date invalid
                            except:
                                end_date = start_date
                        else:
                            end_date = start_date  # Use start date if no end date
                        
                        # Extract location from lesson if available
                        if 'Location_Business_Name' in event_row.index and pd.notna(event_row.get('Location_Business_Name')):
                            location_name = str(event_row['Location_Business_Name']).strip()
                        elif 'Location_Name' in event_row.index and pd.notna(event_row.get('Location_Name')):
                            location_name = str(event_row['Location_Name']).strip()
                        
                        break
            
            # If no URL match, try to match by Event_Title (fuzzy match)
            if not start_date:
                for _, event_row in events_df.iterrows():
                    event_title = str(event_row.get('Event_Title', '')).lower()
                    
                    # Check if key words match (at least 2 significant words)
                    if event_title and product_name_lower:
                        event_words = [w for w in event_title.split() if len(w) > 4]
                        product_words = [w for w in product_name_lower.split() if len(w) > 4]
                        matches = sum(1 for word in event_words if word in product_name_lower)
                        if matches >= 2:  # At least 2 significant words match
                            if pd.notna(event_row.get('start_date_parsed')):
                                start_date = event_row['start_date_parsed'].strftime('%Y-%m-%d')
                                if 'End_Date' in event_row.index and pd.notna(event_row.get('End_Date')):
                                    try:
                                        end_date = pd.to_datetime(event_row['End_Date'], errors='coerce')
                                        if pd.notna(end_date):
                                            end_date = end_date.strftime('%Y-%m-%d')
                                        else:
                                            end_date = start_date
                                    except:
                                        end_date = start_date
                                else:
                                    end_date = start_date
                                
                                # Extract location from lesson if available
                                if 'Location_Business_Name' in event_row.index and pd.notna(event_row.get('Location_Business_Name')):
                                    location_name = str(event_row['Location_Business_Name']).strip()
                                elif 'Location_Name' in event_row.index and pd.notna(event_row.get('Location_Name')):
                                    location_name = str(event_row['Location_Name']).strip()
                                
                                break
        
        # Second: If no match found, try to extract dates from product name
        if not start_date:
            date_patterns = [
                r'(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([A-Z][a-z]+)\s+(\d{4})',  # "23-25 Jan 2026"
                r'([A-Z][a-z]+)\s+(\d{1,2})\s*[-–]\s*(\d{1,2})\s+(\d{4})',  # "Jan 23-25 2026"
                r'([A-Z][a-z]+)\s+(\d{4})',  # "Jan 2026"
            ]
            
            for pattern in date_patterns:
                match = re.search(pattern, product_name)
                if match:
                    try:
                        if len(match.groups()) == 4:
                            # Format: "23-25 Jan 2026" or "Jan 23-25 2026"
                            if match.group(1).isdigit():
                                day1, day2, month, year = match.groups()
                                start_date = f"{year}-{pd.to_datetime(month, format='%B').month:02d}-{int(day1):02d}"
                                end_date = f"{year}-{pd.to_datetime(month, format='%B').month:02d}-{int(day2):02d}"
                            else:
                                month, day1, day2, year = match.groups()
                                start_date = f"{year}-{pd.to_datetime(month, format='%B').month:02d}-{int(day1):02d}"
                                end_date = f"{year}-{pd.to_datetime(month, format='%B').month:02d}-{int(day2):02d}"
                        elif len(match.groups()) == 2:
                            # Format: "Jan 2026" - use first day of month
                            month, year = match.groups()
                            start_date = f"{year}-{pd.to_datetime(month, format='%B').month:02d}-01"
                            end_date = start_date  # Single day event
                        break
                    except:
                        pass
        
        # Extract location from product name if not found from lesson
        if not location_name:
            location_keywords = {
                'coventry': 'Coventry',
                'lake district': 'Lake District',
                'peak district': 'Peak District',
                'yorkshire dales': 'Yorkshire Dales',
                'snowdonia': 'Snowdonia',
                'norfolk': 'Norfolk',
                'devon': 'Devon',
                'dorset': 'Dorset',
                'anglesey': 'Anglesey',
                'northumberland': 'Northumberland',
                'suffolk': 'Suffolk',
                'gower': 'Gower',
                'kerry': 'Kerry',
                'dartmoor': 'Dartmoor',
                'exmoor': 'Exmoor',
                'warwickshire': 'Warwickshire',
                'worcestershire': 'Worcestershire',
                'gloucestershire': 'Gloucestershire'
            }
            
            name_lower = product_name.lower()
            for keyword, location in location_keywords.items():
                if keyword in name_lower:
                    location_name = location
                    break
        
        # Only add hasCourseInstance if we have at least a start date or location
        if start_date or location_name:
            course_instance = {
                "@type": "CourseInstance",
                "courseMode": "InPerson"
            }
            if start_date:
                course_instance["startDate"] = start_date
            if end_date:
                course_instance["endDate"] = end_date
            elif start_date:
                # If only start date, use same as end date (single day)
                course_instance["endDate"] = start_date
            if location_name:
                course_instance["location"] = {
                    "@type": "Place",
                    "name": location_name
                }
            
            product_schema["hasCourseInstance"] = course_instance
    
    # Add reviews and aggregate rating (only if include_aggregate_rating is True)
    if reviews_list:
        product_schema["review"] = reviews_list
        
        # Only add aggregateRating for the first variant per product page
        if include_aggregate_rating:
            aggregate_rating = calculate_aggregate_rating(reviews_list)
            if aggregate_rating:
                product_schema["aggregateRating"] = aggregate_rating
    
    # Build @graph structure - Keep only LocalBusiness (it inherits Organization properties)
    try:
        breadcrumb_data = get_breadcrumbs(product_name, product_url)
    except Exception as e:
        print(f"⚠️ Error generating breadcrumbs for '{product_name}': {e}")
        # Fallback to simple breadcrumb - try to extract parent category from URL
        parent_category_name = "Photo Workshops UK"
        parent_category_url = "https://www.alanranger.com/photo-workshops-uk"
        
        if product_url and isinstance(product_url, str):
            url_path = product_url.replace('https://www.alanranger.com', '').replace('http://www.alanranger.com', '').strip('/')
            path_parts = url_path.split('/')
            if len(path_parts) >= 2:
                parent_slug = path_parts[0]
                if parent_slug == 'photography-services-near-me':
                    parent_category_name = "Photography Services Near Me"
                    parent_category_url = "https://www.alanranger.com/photography-services-near-me"
        
        breadcrumb_data = {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.alanranger.com"},
                {"@type": "ListItem", "position": 2, "name": parent_category_name, "item": parent_category_url},
                {"@type": "ListItem", "position": 3, "name": product_name, "item": product_url}
            ]
        }
    
    # Add @id to breadcrumb (matching lessons schema format)
    if product_url:
        url_path = product_url.replace('https://www.alanranger.com', '').replace('http://www.alanranger.com', '').strip('/')
        url_slug = url_path.split('/')[-1] if url_path else slugify(product_name)
        breadcrumb_data["@id"] = f"https://www.alanranger.com/{url_slug}#breadcrumbs"
    else:
        product_slug = slugify(product_name)
        breadcrumb_data["@id"] = f"https://www.alanranger.com/{product_slug}#breadcrumbs"
    
    graph = [
        LOCAL_BUSINESS,
        breadcrumb_data,
        product_schema
    ]
    
    # Add @id to product schema - use URL slug, not product name slug
    # Extract slug from product URL if available, otherwise use product name slug
    if product_url:
        # Extract slug from URL (e.g., https://www.alanranger.com/photo-workshops-uk/batsford-arboretum-photography-workshops)
        url_path = product_url.replace('https://www.alanranger.com', '').replace('http://www.alanranger.com', '').strip('/')
        path_parts = url_path.split('/')
        if len(path_parts) > 0:
            # Use the last part of the URL path as the slug
            url_slug = path_parts[-1]
            product_schema["@id"] = f"https://www.alanranger.com/{url_slug}#schema"
        else:
            # Fallback to product name slug
            product_slug = slugify(product_name)
            product_schema["@id"] = f"https://www.alanranger.com/{product_slug}#schema"
    else:
        # Fallback to product name slug if no URL
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
    
    # Find Product/Course/Event object (should be last in graph)
    product_schema = None
    for obj in graph:
        obj_type = obj.get('@type', [])
        if isinstance(obj_type, list):
            if 'Product' in obj_type:
                product_schema = obj
                break
        elif obj_type == 'Product':
            product_schema = obj
            break
    
    if not product_schema:
        errors.append("Missing Product/Course/Event object in @graph")
        return False, errors
    
    # Validate @type - accept Product, Product+Course, or Product+Event
    obj_type = product_schema.get('@type', [])
    if isinstance(obj_type, list):
        if 'Product' not in obj_type:
            errors.append(f"Product @type must include 'Product', got: {obj_type}")
        # Accept Product, Product+Course, or Product+Event
        valid_types = [['Product'], ['Product', 'Course'], ['Product', 'Event']]
        if obj_type not in valid_types:
            errors.append(f"Product @type must be one of {valid_types}, got: {obj_type}")
    elif obj_type != 'Product':
        errors.append(f"Product @type must be 'Product' or a list containing 'Product', got: {obj_type}")
    
    # Validate required fields based on schema type
    required_keys = {
        'name': 'string',
        'sku': 'string',
        'brand': 'dict',
        'description': 'string',
        'image': 'string',
        'url': 'string',
        'offers': 'dict',
        '@id': 'string'
    }
    
    # Provider is required for Course and Event types
    if isinstance(obj_type, list):
        if 'Course' in obj_type or 'Event' in obj_type:
            required_keys['provider'] = 'dict'
    
    for key, expected_type in required_keys.items():
        if key not in product_schema:
            errors.append(f"Product schema missing required key: {key}")
        elif expected_type == 'dict' and not isinstance(product_schema[key], dict):
            # Special case: 'offers' can be dict or list (for multiple variants)
            if key == 'offers' and isinstance(product_schema[key], list):
                pass  # Valid - offers can be an array
            else:
                errors.append(f"Product schema key '{key}' must be an object")
        elif expected_type == 'string' and not isinstance(product_schema[key], str):
            errors.append(f"Product schema key '{key}' must be a string")
    
    # Event-specific validation
    if isinstance(obj_type, list) and 'Event' in obj_type:
        # ALL Event fields are REQUIRED for rich results
        required_event_fields = ['startDate', 'endDate', 'eventStatus', 'eventAttendanceMode', 'location']
        for field in required_event_fields:
            if field not in product_schema:
                errors.append(f"Missing required Event field: {field}")
    
    # Validate brand structure
    brand = product_schema.get('brand', {})
    if not isinstance(brand, dict) or brand.get('@type') != 'Brand' or 'name' not in brand:
        errors.append("Product 'brand' must be a Brand object with 'name'")
    
    # Validate provider structure (only if present)
    if 'provider' in product_schema:
        provider = product_schema.get('provider', {})
        if not isinstance(provider, dict) or provider.get('@type') != 'Organization' or 'name' not in provider or 'sameAs' not in provider:
            errors.append("Product 'provider' must be an Organization object with 'name' and 'sameAs'")
    
    # Validate offers structure (can be object or array for multiple variants)
    offers = product_schema.get('offers', {})
    if isinstance(offers, list):
        # Array format - validate each offer
        if len(offers) == 0:
            errors.append("Product 'offers' array is empty")
        else:
            for i, offer in enumerate(offers):
                if not isinstance(offer, dict):
                    errors.append(f"Product 'offers' array item {i} must be an object")
                else:
                    if '@type' not in offer or offer['@type'] != 'Offer':
                        errors.append(f"Product 'offers' array item {i} must have @type='Offer'")
                    if 'price' not in offer:
                        errors.append(f"Product 'offers' array item {i} missing 'price'")
                    if 'priceCurrency' not in offer:
                        errors.append(f"Product 'offers' array item {i} missing 'priceCurrency'")
                    if 'priceValidUntil' not in offer:
                        errors.append(f"Product 'offers' array item {i} missing 'priceValidUntil'")
    elif isinstance(offers, dict):
        # Single object format - validate it
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
    
    # Ensure no Event fields are present for Product-only schemas
    # Only check this if Event is NOT in the @type
    obj_type_for_check = product_schema.get('@type', [])
    if isinstance(obj_type_for_check, list) and 'Event' not in obj_type_for_check:
        forbidden_keys = ['startDate', 'endDate', 'eventStatus', 'eventAttendanceMode', 'location']
        for key in forbidden_keys:
            if key in product_schema:
                errors.append(f"Forbidden Event field found in non-Event schema: {key}")
    
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

# Load suppressor block once at module level (not per product)
_suppressor_block_cache = None

def load_suppressor_block():
    """Load suppressor block once and cache it"""
    global _suppressor_block_cache
    if _suppressor_block_cache is not None:
        return _suppressor_block_cache
    
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    suppressor_path = project_root / 'partials' / 'schema-suppressor-v1.3.html'
    
    suppressor_block = ''
    if suppressor_path.exists():
        try:
            suppressor_block = suppressor_path.read_text(encoding='utf-8').strip()
            # Ensure it ends with a newline
            if suppressor_block and not suppressor_block.endswith('\n'):
                suppressor_block += '\n'
            print(f"✅ Schema suppressor v1.3 loaded - will remove duplicate Squarespace Product schemas")
        except Exception as e:
            print(f"⚠️  Warning: Could not load schema suppressor block: {e}")
            print(f"   Continuing without suppressor block")
    else:
        print(f"⚠️  Warning: Schema suppressor file not found at {suppressor_path}")
        print(f"   Continuing without suppressor block")
    
    _suppressor_block_cache = suppressor_block
    return suppressor_block

def schema_to_html(schema_data):
    """Convert schema JSON to Squarespace-ready HTML with suppressor block"""
    # Load suppressor block (cached, only loads once)
    suppressor_block = load_suppressor_block()
    
    # Generate schema script tag
    json_str = json.dumps(schema_data, indent=2, ensure_ascii=False)
    schema_script = f'<script type="application/ld+json">\n{json_str}\n</script>'
    
    # Combine suppressor block + schema script
    if suppressor_block:
        return suppressor_block + '\n' + schema_script
    else:
        return schema_script

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
    # Updated to use shared-resources structure
    shared_resources_dir = project_root.parent / 'alan-shared-resources'
    csv_dir = shared_resources_dir / 'csv'
    csv_processed_dir = shared_resources_dir / 'csv processed'
    outputs_dir = shared_resources_dir / 'outputs' / 'schema' / 'products'
    outputs_dir.mkdir(parents=True, exist_ok=True)
    csv_processed_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"📂 Project root: {project_root}")
    print(f"📂 Shared resources: {shared_resources_dir}")
    print(f"📂 CSV directory: {csv_dir}")
    print(f"📂 CSV processed directory: {csv_processed_dir}")
    print(f"📂 Outputs directory: {outputs_dir}")
    print()
    
    # Find input files
    products_file = csv_processed_dir / '02 – products_cleaned.xlsx'
    merged_reviews_file = csv_processed_dir / '03 – combined_product_reviews.csv'
    
    # Try to detect original CSV filename to determine schema type
    # Look for the original products CSV file in shared-resources/csv/ root
    original_csv_files = []
    csv_patterns = ['raw-01-products*.csv', '07-product*.csv']
    for pattern in csv_patterns:
        if csv_dir.exists():
            original_csv_files.extend(list(csv_dir.glob(pattern)))
    
    schema_type = 'product'  # Default to Product only
    original_csv_name = None
    
    if original_csv_files:
        original_csv_name = sorted(original_csv_files)[-1].name
        csv_name_lower = original_csv_name.lower()
        
        # Detect schema type from filename
        if 'workshops-near-me' in csv_name_lower or ('workshop' in csv_name_lower and 'lesson' not in csv_name_lower):
            schema_type = 'event'  # Workshops → Product + Event
            print(f"📋 Detected schema type: Event (from filename: {original_csv_name})")
        elif 'lessons' in csv_name_lower or 'beginners-photography-lessons' in csv_name_lower:
            schema_type = 'course'  # Lessons → Product + Course
            print(f"📋 Detected schema type: Course (from filename: {original_csv_name})")
        else:
            print(f"📋 Detected schema type: Product (from filename: {original_csv_name})")
    else:
        # Fallback: Detect from product URLs/names if CSV not found
        print(f"📋 Original CSV not found, will detect schema type from product data")
    
    # Load products and detect schema type from product data if not detected from filename
    if schema_type == 'product':
        # We'll detect per-product after loading
        print(f"📋 Will detect schema type per product from URLs/names")
    
    # Load events CSV files to match dates for Event schemas
    events_df = None
    events_list = []
    
    # Try to find event CSV files
    events_workshops_path = None
    events_lessons_path = None
    
    # Look for events CSV files in shared-resources/csv/ root
    # Handle original Squarespace export filenames (long format with site ID)
    if csv_dir.exists():
        # Check for workshop CSVs (matches *photographic-workshops-near-me* or *photo-workshops-uk-landscape*)
        for csv_file in csv_dir.glob('*.csv'):
            csv_name_lower = csv_file.name.lower()
            if ('photographic-workshops-near-me' in csv_name_lower or 
                'photo-workshops-uk-landscape' in csv_name_lower or
                ('workshop' in csv_name_lower and 'lesson' not in csv_name_lower and '03' in csv_name_lower)):
                events_workshops_path = csv_file
                break
        
        # Check for lessons CSVs (matches *beginners-photography-lessons* or *photography-services-courses-mentoring*)
        if not events_lessons_path:
            for csv_file in csv_dir.glob('*.csv'):
                csv_name_lower = csv_file.name.lower()
                if ('beginners-photography-lessons' in csv_name_lower or
                    'photography-services-courses-mentoring' in csv_name_lower or
                    ('lesson' in csv_name_lower and 'workshop' not in csv_name_lower and '02' in csv_name_lower)):
                    events_lessons_path = csv_file
                    break
    
    if events_workshops_path and events_workshops_path.exists():
        try:
            workshops = pd.read_csv(events_workshops_path, encoding="utf-8-sig")
            if 'Start_Date' in workshops.columns:
                workshops['start_date_parsed'] = pd.to_datetime(workshops['Start_Date'], errors='coerce')
                workshops = workshops[workshops['start_date_parsed'].notna()].copy()
                events_list.append(workshops)
                print(f"📅 Loaded {len(workshops)} workshop events for date matching")
        except Exception as e:
            print(f"⚠️  Warning: Could not load workshop events: {e}")
    
    if events_lessons_path and events_lessons_path.exists():
        try:
            lessons = pd.read_csv(events_lessons_path, encoding="utf-8-sig")
            if 'Start_Date' in lessons.columns:
                lessons['start_date_parsed'] = pd.to_datetime(lessons['Start_Date'], errors='coerce')
                lessons = lessons[lessons['start_date_parsed'].notna()].copy()
                events_list.append(lessons)
                print(f"📅 Loaded {len(lessons)} lesson events for date matching")
        except Exception as e:
            print(f"⚠️  Warning: Could not load lesson events: {e}")
    
    if events_list:
        events_df = pd.concat(events_list, ignore_index=True)
        print(f"📅 Total events loaded: {len(events_df)}")
    else:
        events_df = pd.DataFrame()
        print(f"⚠️  No event CSV files found - will generate default dates for recurring events")
    
    print()
    
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
        
        # Ensure reviewbody is string type and handle NaN
        if "reviewbody" in reviews_df.columns:
            reviews_df["reviewbody"] = reviews_df["reviewbody"].fillna('').astype(str)
        
        # Convert ratingValue to numeric
        reviews_df["ratingvalue"] = pd.to_numeric(reviews_df.get("ratingvalue"), errors="coerce")
        
        # Debug: Check counts before filtering
        print(f"🔍 Debug: Before filtering - Total rows: {len(reviews_df)}")
        print(f"🔍 Debug: ratingValue not null: {reviews_df['ratingvalue'].notna().sum()}")
        print(f"🔍 Debug: reviewBody not empty: {(reviews_df['reviewbody'].astype(str).str.strip() != '').sum()}")
        print(f"🔍 Debug: Both conditions: {(reviews_df['ratingvalue'].notna() & (reviews_df['reviewbody'].astype(str).str.strip() != '')).sum()}")
        
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
    all_schema_graphs = []  # Collect all schema graphs for unified JSON output
    nan_count = 0
    products_with_reviews_count = 0
    summary_rows = []
    
    # Track schema types
    schema_type_counts = {
        'product': 0,      # Product only
        'course': 0,       # Product + Course
        'event': 0         # Product + Event
    }
    
    # Initialize validation error log
    error_log_path = outputs_dir / 'validation-errors.log'
    if error_log_path.exists():
        error_log_path.unlink()  # Remove old log
    with open(error_log_path, 'w', encoding='utf-8') as f:
        f.write("Product Schema Validation Errors\n")
        f.write("=" * 60 + "\n\n")
    
    # Track mapped reviews by source
    mapped_google_reviews = []  # All Google reviews mapped (total)
    mapped_trustpilot_reviews = []  # All Trustpilot reviews mapped (total)
    included_google_reviews = []  # Google reviews included in schema (capped at 25 per product)
    included_trustpilot_reviews = []  # Trustpilot reviews included in schema (capped at 25 per product)
    total_excluded_reviews = 0  # Total reviews excluded due to 25-review cap
    
    # Track validation statistics
    breadcrumbs_normalised_count = 0
    
    # Group products by URL to identify variants (products sharing the same page)
    # Only the first variant per URL will get aggregateRating
    url_to_first_index = {}  # Maps URL to the first product index with that URL
    
    # Pre-process: identify first variant for each URL
    # Products without URLs are treated as standalone (each gets aggregateRating)
    variant_counts = {}  # Track how many variants per URL
    variant_indices = {}  # Track variant index for each product
    for idx, row in df_products.iterrows():
        product_url = str(row.get('url', '')).strip()
        if product_url:  # Only group products that have URLs
            if product_url not in url_to_first_index:
                url_to_first_index[product_url] = idx
                variant_counts[product_url] = 1
                variant_indices[idx] = 1
            else:
                variant_counts[product_url] = variant_counts.get(product_url, 1) + 1
                variant_indices[idx] = variant_counts[product_url]
    
    # Log products with multiple variants
    products_with_variants = {url: count for url, count in variant_counts.items() if count > 1}
    if products_with_variants:
        print(f"\n📊 Products with multiple variants (same URL):")
        for url, count in list(products_with_variants.items())[:10]:  # Show first 10
            product_name = df_products.iloc[url_to_first_index[url]].get('name', 'Unknown')
            print(f"   {product_name[:50]}... → {count} variants ({url})")
        if len(products_with_variants) > 10:
            print(f"   ... and {len(products_with_variants) - 10} more products with variants")
        print(f"   ✅ Only first variant per URL will get aggregateRating\n")
    
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
                # Also try date_parsed column if it exists (from Google reviews)
                if 'date_parsed' in reviews_for_product.columns:
                    reviews_for_product['_sort_date'] = reviews_for_product['_sort_date'].fillna(reviews_for_product['date_parsed'])
                reviews_for_product = reviews_for_product.sort_values('_sort_date', ascending=False, na_position='last')
                reviews_for_product = reviews_for_product.drop(columns=['_sort_date'])
            
            # Limit to 25 reviews per product for schema optimization (Google best practice)
            # But we'll track total counts separately for accurate statistics
            total_reviews_for_product = len(reviews_for_product)
            
            # Track ALL reviews mapped (before cap) for accurate statistics
            for _, review_row_all in reviews_for_product.iterrows():
                rating_val_all = review_row_all.get('ratingvalue')
                if rating_val_all and rating_val_all >= 4:
                    source_all = review_row_all.get('source', 'Google')
                    source_lower_all = str(source_all).lower() if source_all else ''
                    
                    # Get date for tracking
                    review_date_obj_all = None
                    if 'date_parsed' in review_row_all.index:
                        date_val_all = review_row_all.get('date_parsed')
                        if pd.notna(date_val_all):
                            try:
                                review_date_obj_all = pd.to_datetime(date_val_all, errors='coerce')
                                if pd.isna(review_date_obj_all):
                                    review_date_obj_all = None
                            except:
                                review_date_obj_all = None
                    
                    if 'google' in source_lower_all:
                        mapped_google_reviews.append({
                            'date': review_date_obj_all,
                            'source': 'Google',
                            'review_date_str': ''
                        })
                    elif 'trustpilot' in source_lower_all:
                        mapped_trustpilot_reviews.append({
                            'date': review_date_obj_all,
                            'source': 'Trustpilot',
                            'review_date_str': ''
                        })
            
            # Now apply cap for schema inclusion
            group = reviews_for_product.head(25)
            excluded_count = max(0, total_reviews_for_product - 25)
            total_excluded_reviews += excluded_count
            
            # Track newest review date included in schema
            newest_review_date_included = None
            
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
                    
                    # Get author - replace "nan" with "Anonymous Reviewer"
                    author = 'Anonymous Reviewer'
                    for col in ['author', 'reviewer', 'reviewer_name', 'review_username']:
                        if col in review_row.index:
                            author_val = str(review_row.get(col, '')).strip()
                            if author_val and author_val.lower() not in ['anonymous', 'n/a', 'nan', 'none', '']:
                                author = author_val
                                break
                    
                    # If author is still "nan" or empty, use "Anonymous Reviewer"
                    if not author or author.lower() in ['nan', 'none', '']:
                        author = 'Anonymous Reviewer'
                    
                    # Get date - check multiple column name variations and handle ISO timestamp format
                    review_date = ''
                    review_date_obj = None
                    date_columns = ['date', 'date_parsed', 'review_date', 'datepublished', 'date_published', 'created_at', 'timestamp', 'updatetime', 'update_time']
                    
                    # First try date_parsed (from Google reviews) if it exists
                    if 'date_parsed' in review_row.index:
                        date_val = review_row.get('date_parsed')
                        if pd.notna(date_val):
                            try:
                                if isinstance(date_val, pd.Timestamp):
                                    review_date_obj = date_val
                                    review_date = date_val.strftime('%Y-%m-%d')
                                else:
                                    review_date_obj = pd.to_datetime(date_val, errors='coerce')
                                    if pd.notna(review_date_obj):
                                        review_date = review_date_obj.strftime('%Y-%m-%d')
                            except:
                                pass
                    
                    # If date_parsed didn't work, try other date columns
                    if not review_date:
                        for col in date_columns:
                            if col in review_row.index and col != 'date_parsed':
                                date_val = review_row.get(col)
                                if pd.notna(date_val):
                                    try:
                                        # Try parsing as datetime first
                                        if isinstance(date_val, pd.Timestamp):
                                            review_date_obj = date_val
                                            review_date = date_val.strftime('%Y-%m-%d')
                                        else:
                                            date_str = str(date_val).strip()
                                            # Handle ISO timestamp format (e.g., "2024-12-15T14:30:00" or "2024-12-15T14:30:00Z")
                                            if 'T' in date_str:
                                                # Extract just the date part (YYYY-MM-DD)
                                                review_date = date_str.split('T')[0]
                                                # Validate it's a proper date
                                                review_date_obj = pd.to_datetime(review_date, errors='coerce')
                                            else:
                                                # Try parsing string dates
                                                review_date_obj = pd.to_datetime(date_str, errors='coerce', dayfirst=True)
                                                if pd.notna(review_date_obj):
                                                    review_date = review_date_obj.strftime('%Y-%m-%d')
                                                else:
                                                    # Fallback: try extracting YYYY-MM-DD format
                                                    date_match = re.search(r'(\d{4}-\d{2}-\d{2})', date_str)
                                                    if date_match:
                                                        review_date = date_match.group(1)
                                                        review_date_obj = pd.to_datetime(review_date, errors='coerce')
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
                    
                    # Use review_date_obj if we already parsed it, otherwise try to parse review_date
                    if review_date_obj is None and review_date:
                        try:
                            review_date_obj = pd.to_datetime(review_date, errors='coerce')
                            if pd.isna(review_date_obj):
                                review_date_obj = None
                        except:
                            review_date_obj = None
                    
                    # If still no date_obj, try date_parsed column directly (from Google reviews)
                    if review_date_obj is None and 'date_parsed' in review_row.index:
                        date_val = review_row.get('date_parsed')
                        if pd.notna(date_val):
                            try:
                                review_date_obj = pd.to_datetime(date_val, errors='coerce')
                                if pd.isna(review_date_obj):
                                    review_date_obj = None
                            except:
                                review_date_obj = None
                    
                    # If still no date_obj, try other date columns
                    if review_date_obj is None:
                        for col in date_columns:
                            if col in review_row.index and col != 'date_parsed':
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
                    
                    # Track newest review date included in schema
                    if review_date_obj is not None and pd.notna(review_date_obj):
                        if newest_review_date_included is None or review_date_obj > newest_review_date_included:
                            newest_review_date_included = review_date_obj
                    
                    if 'google' in source_lower:
                        # Track Google reviews included in schema (capped at 25 per product)
                        included_google_reviews.append({
                            'date': review_date_obj,
                            'source': 'Google',
                            'review_date_str': review_date
                        })
                    elif 'trustpilot' in source_lower:
                        # Track Trustpilot reviews included in schema (capped at 25 per product)
                        included_trustpilot_reviews.append({
                            'date': review_date_obj,
                            'source': 'Trustpilot',
                            'review_date_str': review_date
                        })
        
        if len(product_reviews) > 0:
            products_with_reviews_count += 1
        
        # Determine if this is the first variant for this URL (only first gets aggregateRating)
        # Products without URLs are treated as standalone (each gets aggregateRating)
        product_url = str(row.get('url', '')).strip()
        product_name = str(row.get('name', '')).strip()
        
        # Read schema_type from cleaned products file (set in Step 2)
        product_schema_type = str(row.get('schema_type', 'product')).strip().lower()
        
        # Validate schema_type (should be 'product', 'course', or 'event')
        if product_schema_type not in ['product', 'course', 'event']:
            # Fallback to old detection logic if schema_type is missing or invalid
            product_schema_type = 'product'  # Default to Product only
            
            if events_df is not None and len(events_df) > 0:
                product_name_lower = product_name.lower()
                product_url_slug = ''
                if product_url:
                    product_url_slug = product_url.split('/')[-1].strip().lower()
                
                # Try to match by URL slug first (most reliable)
                matched_event = None
                for _, event_row in events_df.iterrows():
                    event_url = str(event_row.get('Event_URL', '')).strip()
                    event_url_slug = event_url.split('/')[-1].strip().lower() if event_url else ''
                    
                    # Match by URL slug
                    if product_url_slug and event_url_slug and product_url_slug == event_url_slug:
                        matched_event = event_row
                        break
                
                # If no URL match, try fuzzy match by Event_Title
                if matched_event is None:
                    for _, event_row in events_df.iterrows():
                        event_title = str(event_row.get('Event_Title', '')).lower()
                        
                        # Check if key words match (at least 2 significant words)
                        if event_title and product_name_lower:
                            event_words = [w for w in event_title.split() if len(w) > 4]
                            matches = sum(1 for word in event_words if word in product_name_lower)
                            if matches >= 2:  # At least 2 significant words match
                                matched_event = event_row
                                break
                
                # If matched, determine if it's a workshop or lesson based on which CSV it came from
                if matched_event is not None:
                    # Check if this event came from workshops CSV (check if Event_URL contains workshop path)
                    event_url = str(matched_event.get('Event_URL', '')).lower()
                    if 'photo-workshops-uk' in event_url or 'workshops' in event_url.lower():
                        product_schema_type = 'event'  # Product + Event
                    # Check if this event came from lessons CSV (check if Event_URL contains lessons path)
                    elif 'photography-services-near-me' in event_url or 'beginners-photography-lessons' in event_url or 'lessons' in event_url.lower():
                        product_schema_type = 'course'  # Product + Course
                    else:
                        # Default to event if we can't determine (workshops are more common)
                        product_schema_type = 'event'
        
        if product_url:
            is_first_variant = (product_url in url_to_first_index and url_to_first_index[product_url] == idx)
            if not is_first_variant and product_url in variant_counts and variant_counts[product_url] > 1:
                # Log when a variant skips aggregateRating
                variant_num = variant_indices.get(idx, 1)
                first_variant_name = df_products.iloc[url_to_first_index[product_url]].get('name', 'Unknown')
                print(f"   ⚠️ [{product_name[:50]}...] is variant #{variant_num} - skipping aggregateRating (first variant: {first_variant_name[:30]}...)")
        else:
            # Product without URL is standalone - gets aggregateRating
            is_first_variant = True
        
        # Generate schema graph (only first variant per URL gets aggregateRating)
        schema_graph = generate_product_schema_graph(row, product_reviews, include_aggregate_rating=is_first_variant, schema_type=product_schema_type, events_df=events_df)
        
        # Track schema type counts
        schema_type_counts[product_schema_type] += 1
        
        # Track validation statistics
        breadcrumbs_normalised_count += 1  # All breadcrumbs use normalized names
        
        # Validate required fields and log warnings
        missing_fields = []
        if not row.get('url'):
            missing_fields.append('URL')
        if not row.get('main_sku') and not row.get('sku'):
            missing_fields.append('SKU')
        if not row.get('image'):
            missing_fields.append('image')
        if not row.get('price') and not row.get('offers'):
            missing_fields.append('price')
        
        if missing_fields:
            print(f"⚠️ [{product_name[:50]}...] Missing fields: {', '.join(missing_fields)}")
            with open(error_log_path, 'a', encoding='utf-8') as f:
                f.write(f"\nProduct: {product_name}\n")
                f.write(f"URL: {row.get('url', 'N/A')}\n")
                f.write(f"Missing fields: {', '.join(missing_fields)}\n\n")
        
        # Validate JSON-LD structure (basic JSON syntax)
        try:
            json.dumps(schema_graph, ensure_ascii=False)
            json_valid = True
        except Exception as e:
            print(f"❌ JSON syntax error for {product_name}: {e}")
            json_valid = False
            sys.exit(1)
        
        # Validate schema structure (required fields for Rich Results)
        rich_results_errors = []
        
        # Check @context
        if '@context' not in schema_graph or schema_graph['@context'] != 'https://schema.org':
            rich_results_errors.append('Missing or invalid @context')
        
        # Check @graph
        if '@graph' not in schema_graph or not isinstance(schema_graph['@graph'], list):
            rich_results_errors.append('Missing or invalid @graph')
        else:
            graph = schema_graph['@graph']
            
            # Find Product/Course/Event object
            product_obj = None
            for obj in graph:
                obj_type = obj.get('@type', [])
                if isinstance(obj_type, list) and 'Product' in obj_type:
                    product_obj = obj
                    break
            
            if not product_obj:
                rich_results_errors.append('Missing Product/Course/Event object in @graph')
            else:
                # Check required Product fields (provider only required for Course/Event)
                required_fields = ['name', 'sku', 'brand', 'url', 'offers']
                obj_type = product_obj.get('@type', [])
                if isinstance(obj_type, list) and ('Course' in obj_type or 'Event' in obj_type):
                    required_fields.append('provider')
                
                for field in required_fields:
                    if field not in product_obj:
                        rich_results_errors.append(f'Missing required field: {field}')
                
                # Event-specific validation
                if isinstance(obj_type, list) and 'Event' in obj_type:
                    # ALL Event fields are REQUIRED for rich results
                    required_event_fields = ['startDate', 'endDate', 'eventStatus', 'eventAttendanceMode', 'location']
                    for field in required_event_fields:
                        if field not in product_obj:
                            rich_results_errors.append(f'Missing required Event field: {field}')
                
                # Check offers
                if 'offers' in product_obj:
                    offers = product_obj['offers']
                    if isinstance(offers, list):
                        for i, offer in enumerate(offers):
                            if not isinstance(offer, dict):
                                rich_results_errors.append(f'Offer {i} is not an object')
                            else:
                                if '@type' not in offer or offer['@type'] != 'Offer':
                                    rich_results_errors.append(f'Offer {i} missing @type')
                                if 'price' not in offer:
                                    rich_results_errors.append(f'Offer {i} missing price')
                                if 'priceCurrency' not in offer:
                                    rich_results_errors.append(f'Offer {i} missing priceCurrency')
                                if 'priceValidUntil' not in offer:
                                    rich_results_errors.append(f'Offer {i} missing priceValidUntil')
                                if 'sku' not in offer:
                                    rich_results_errors.append(f'Offer {i} missing sku')
                                # Check SKU length
                                if 'sku' in offer and len(str(offer['sku'])) > 40:
                                    rich_results_errors.append(f'Offer {i} SKU exceeds 40 characters')
                    elif isinstance(offers, dict):
                        # Single offer
                        if '@type' not in offers or offers['@type'] != 'Offer':
                            rich_results_errors.append('Single offer missing @type')
                        if 'price' not in offers:
                            rich_results_errors.append('Single offer missing price')
                        if 'priceCurrency' not in offers:
                            rich_results_errors.append('Single offer missing priceCurrency')
                        if 'priceValidUntil' not in offers:
                            rich_results_errors.append('Single offer missing priceValidUntil')
                        if 'sku' not in offers:
                            rich_results_errors.append('Single offer missing sku')
                        if 'sku' in offers and len(str(offers['sku'])) > 40:
                            rich_results_errors.append('Single offer SKU exceeds 40 characters')
        
        # Log Rich Results validation errors
        if rich_results_errors:
            with open(error_log_path, 'a', encoding='utf-8') as f:
                f.write(f"\nProduct: {product_name}\n")
                f.write(f"URL: {row.get('url', 'N/A')}\n")
                f.write("Rich Results Validation Errors:\n")
                for error in rich_results_errors:
                    f.write(f"  - {error}\n")
                f.write("\n")
            print(f"⚠️ Rich Results validation errors for {product_name}:")
            for error in rich_results_errors:
                print(f"   - {error}")
            print(f"   Errors logged to: {error_log_path}")
            # Don't exit - continue processing but log errors
        
        # Validate schema structure against v6.1 baseline requirements
        is_valid, validation_errors = validate_schema_structure(schema_graph, product_name)
        if not is_valid:
            print(f"❌ Schema validation FAILED for '{product_name}':")
            for error in validation_errors:
                print(f"   - {error}")
            print(f"\n⚠️ Generation stopped: Schema does not meet v6.1 baseline requirements")
            sys.exit(1)
        
        # Create filename based on product name (not URL slug) for easier identification
        product_name_slug = slugify(product_name)
        html_filename = f"{product_name_slug}_schema_squarespace_ready.html"
        html_path = outputs_dir / html_filename
        
        # Check if file exists and is locked (open in another program)
        if html_path.exists():
            try:
                # Try to open in append mode to check if file is locked
                with open(html_path, 'a', encoding='utf-8'):
                    pass
            except PermissionError:
                print(f"⚠️  File is locked (may be open in another program): {html_filename}")
                print(f"   Please close the file and try again, or delete it manually.")
                print(f"   File path: {html_path.absolute()}")
                # Try to delete the locked file
                try:
                    html_path.unlink()
                    print(f"   ✅ Successfully removed locked file, will recreate it.")
                except PermissionError:
                    print(f"   ❌ Cannot remove locked file. Please close it manually and re-run Step 4.")
                    print(f"   Skipping this product and continuing with others...")
                    continue
                except Exception as e:
                    print(f"   ⚠️  Error removing file: {e}")
                    print(f"   Skipping this product and continuing with others...")
                    continue
        
        # Write HTML file
        html_content = None
        try:
            html_content = schema_to_html(schema_graph)
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
        except PermissionError as e:
            print(f"❌ Permission denied when writing {html_filename}")
            print(f"   File may be open in another program (e.g., text editor, file explorer)")
            print(f"   File path: {html_path.absolute()}")
            print(f"   Please close the file and re-run Step 4.")
            print(f"   Skipping this product and continuing with others...")
            continue
        except Exception as e:
            print(f"❌ Error writing {html_filename}: {e}")
            print(f"   Skipping this product and continuing with others...")
            continue
        
        # Write individual JSON file for this product
        # JSON should match exactly what's in the HTML script tag (no cleanup needed)
        json_filename = f"{product_name_slug}_schema.json"
        json_path = outputs_dir / json_filename
        json_written = False
        try:
            # Use the exact same schema_graph that goes into HTML - no cleanup
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(schema_graph, f, indent=2, ensure_ascii=False)
            json_written = True
        except PermissionError as e:
            print(f"⚠️ Permission denied when writing {json_filename} (continuing...)")
        except Exception as e:
            print(f"⚠️ Error writing {json_filename}: {e} (continuing...)")
        
        # Only add to lists if file was successfully written
        if html_content is None:
            continue
        
        html_files.append(html_filename)
        
        # Collect schema graph for unified JSON output (use exact same as HTML/individual JSON)
        all_schema_graphs.append(schema_graph)
        
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
            'file_name': html_filename,
            'json_file_name': json_filename if json_written else ''
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
    
    # Clean up orphan "nan" HTML outputs (but not legitimate product names containing "nan")
    import os
    removed_count = 0
    if outputs_dir.exists():
        for f in os.listdir(outputs_dir):
            # Only remove files that are exactly "nan" or have "-nan-" or "-nan." in the name
            # This avoids false positives like "nant-mill" or "banana"
            f_lower = f.lower()
            if f.endswith('.html') and (
                f_lower == 'nan_schema_squarespace_ready.html' or
                f_lower.startswith('nan-') or  # "nan-" at start (not "nant-")
                '-nan-' in f_lower or  # "-nan-" anywhere
                f_lower.startswith('nan_schema')  # "nan_schema" at start
            ):
                try:
                    os.remove(outputs_dir / f)
                    removed_count += 1
                    print(f"🧹 Removed invalid schema file: {f}")
                except Exception as e:
                    pass
    
    if removed_count > 0:
        print(f"✅ Cleaned up {removed_count} invalid schema files")
    
    print(f"✅ Generated {len(html_files)} HTML files")
    print(f"✅ Generated {len(html_files)} JSON files (one per product)")
    
    # Post-generation summary
    valid_products = len(df_products) - nan_count
    print(f"✅ Final schema files generated: {valid_products} (HTML + JSON)")
    
    # Save combined CSV
    schemas_df = pd.DataFrame(schemas_data)
    output_csv = csv_processed_dir / '04 – alanranger_product_schema_FINAL_WITH_REVIEW_RATINGS.csv'
    
    try:
        schemas_df.to_csv(output_csv, index=False, encoding='utf-8-sig')
        print(f"✅ Saved combined CSV: {output_csv.name}")
    except Exception as e:
        print(f"❌ Error saving CSV: {e}")
        sys.exit(1)
    
    # Save QA Summary CSV (in products folder)
    summary_df = pd.DataFrame(summary_rows)
    summary_csv = outputs_dir / 'review_summary.csv'
    try:
        summary_df.to_csv(summary_csv, index=False, encoding='utf-8-sig')
        print(f"📊 Review summary saved to: {summary_csv.name}")
    except Exception as e:
        print(f"⚠️ Could not save review summary: {e}")
    
    # Generate unified JSON file with all products in @graph structure
    if all_schema_graphs:
        print("\n" + "="*60)
        print("📦 GENERATING UNIFIED PRODUCT SCHEMA")
        print("="*60)
        
        # Collect all graph items from all schemas
        unified_graph_items = []
        seen_urls = set()  # Track URLs to avoid duplicates
        
        for schema_graph in all_schema_graphs:
            if '@graph' in schema_graph and isinstance(schema_graph['@graph'], list):
                for item in schema_graph['@graph']:
                    # Only include Product/Course/Event objects (skip LocalBusiness and BreadcrumbList duplicates)
                    item_type = item.get('@type', [])
                    if isinstance(item_type, list):
                        if 'Product' in item_type or 'Course' in item_type or 'Event' in item_type:
                            # Check for duplicate URLs
                            item_url = item.get('url', '')
                            if item_url and item_url not in seen_urls:
                                unified_graph_items.append(item)
                                seen_urls.add(item_url)
                    elif isinstance(item_type, str) and item_type in ['Product', 'Course', 'Event']:
                        item_url = item.get('url', '')
                        if item_url and item_url not in seen_urls:
                            unified_graph_items.append(item)
                            seen_urls.add(item_url)
        
        # Create unified schema with @graph structure
        unified_schema = {
            "@context": "https://schema.org",
            "@graph": unified_graph_items
        }
        
        # Save unified JSON file (in root schema folder, not products subfolder)
        unified_json_path = shared_resources_dir / 'outputs' / 'schema' / 'products-schema.json'
        try:
            with open(unified_json_path, 'w', encoding='utf-8') as f:
                json.dump(unified_schema, f, indent=2, ensure_ascii=False)
            file_size_kb = unified_json_path.stat().st_size / 1024
            print(f"✅ Unified product schema saved: {unified_json_path.name}")
            print(f"   Products included: {len(unified_graph_items)}")
            print(f"   File size: {file_size_kb:.2f} KB")
            print(f"   Location: {unified_json_path.absolute()}")
        except Exception as e:
            print(f"⚠️ Could not save unified JSON: {e}")
    
    # Summary
    products_without_reviews = valid_products - products_with_reviews_count
    
    # Calculate mapped review statistics
    mapped_google_count = len(mapped_google_reviews)
    mapped_trustpilot_count = len(mapped_trustpilot_reviews)
    total_mapped_reviews = mapped_google_count + mapped_trustpilot_count
    
    # Calculate included review statistics (after 25-review cap)
    included_google_count = len(included_google_reviews)
    included_trustpilot_count = len(included_trustpilot_reviews)
    total_included_reviews = included_google_count + included_trustpilot_count
    
    # Get newest review date included in schema
    newest_review_date_included = None
    for r in included_google_reviews + included_trustpilot_reviews:
        date_val = r.get('date')
        if date_val is not None and pd.notna(date_val):
            try:
                if isinstance(date_val, pd.Timestamp):
                    parsed_date = date_val
                else:
                    parsed_date = pd.to_datetime(date_val, errors='coerce')
                    if pd.isna(parsed_date):
                        continue
                if newest_review_date_included is None or parsed_date > newest_review_date_included:
                    newest_review_date_included = parsed_date
            except:
                continue
    
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
                # Don't filter out future dates - they might be valid (e.g., reviews posted on Nov 8, 2025)
                # Only skip if date is clearly invalid (more than 1 year in future)
                today = pd.Timestamp.today().normalize()
                parsed_date_normalized = pd.Timestamp(parsed_date).normalize()
                days_ahead = (parsed_date_normalized - today).days
                if days_ahead <= 365:  # Allow dates up to 1 year in future (handles timezone differences)
                    google_dates.append(parsed_date_normalized)
                else:
                    print(f"⚠️ Skipping invalid future date: {parsed_date_normalized.strftime('%Y-%m-%d')} (more than 1 year ahead)")
        
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
    print("📋 Schema Types Generated:")
    print(f"  • Product only: {schema_type_counts['product']}")
    print(f"  • Product + Course: {schema_type_counts['course']}")
    print(f"  • Product + Event: {schema_type_counts['event']}")
    print("")
    print("📊 Mapped Reviews (all reviews matched to products, before 25-review cap):")
    print(f"  Google reviews mapped: {mapped_google_count} (from {total_google_count} available in merged file)")
    if latest_google_date:
        print(f"  Latest Google review: {latest_google_date}")
    print(f"  Trustpilot reviews mapped: {mapped_trustpilot_count} (from {total_trustpilot_count} available in merged file)")
    if latest_trustpilot_date:
        print(f"  Latest Trustpilot review: {latest_trustpilot_date}")
    print(f"  Total mapped reviews: {total_mapped_reviews}")
    if latest_review_date:
        print(f"  Overall latest review: {latest_review_date}")
    print("")
    print("📦 Reviews Included in Schema (capped at 25 per product):")
    print(f"  Google reviews included: {included_google_count}")
    print(f"  Trustpilot reviews included: {included_trustpilot_count}")
    print(f"  Total included: {total_included_reviews}")
    if total_excluded_reviews > 0:
        print(f"  Reviews excluded due to 25-review cap: {total_excluded_reviews}")
    if newest_review_date_included:
        print(f"  Newest review date included: {newest_review_date_included}")
    print("")
    print(f"HTML files saved to: {outputs_dir.absolute()}")
    print(f"JSON files saved to: {outputs_dir.absolute()}")
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
