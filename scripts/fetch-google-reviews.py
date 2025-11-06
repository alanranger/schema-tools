#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Google My Business Reviews Fetcher
Step 3a: Fetch reviews from Google My Business API

Authenticates with Google OAuth and fetches all reviews for "Alan Ranger Photography",
saving them as CSV for use in Step 3 of the Schema Generator workflow.
"""

import os
import json
import csv
import pandas as pd
from datetime import datetime
from pathlib import Path
import sys

try:
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    from google.auth.transport.requests import Request
except ImportError:
    print("❌ Error: Required Google API libraries not installed.")
    print("   Install with: pip install google-auth-oauthlib google-auth google-api-python-client pandas")
    sys.exit(1)

# Paths
CREDENTIALS_PATH = Path("inputs-files/workflow/credentials/client_secret_367492921794-ps8fhbtuf2gb5vhnp5p06qfhhiehlqmu.apps.googleusercontent.com.json")
TOKEN_PATH = Path("inputs-files/workflow/credentials/token.json")
OUTPUT_PATH = Path("inputs-files/workflow/03b – google_reviews.csv")

SCOPES = ["https://www.googleapis.com/auth/business.manage"]

def authenticate_google():
    """Authenticate with Google OAuth, refreshing token if needed"""
    print("🔐 Authenticating with Google API...")
    
    if not CREDENTIALS_PATH.exists():
        print(f"⚠️ API credentials missing: {CREDENTIALS_PATH}")
        print(f"   Please ensure your OAuth credentials file is in the credentials directory.")
        sys.exit(1)
    
    # Ensure credentials directory exists
    TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    creds = None
    
    if TOKEN_PATH.exists():
        try:
            creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
        except Exception as e:
            print(f"⚠️ Could not load existing token: {e}")
            creds = None
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("🔄 Refreshing expired token...")
            try:
                creds.refresh(Request())
            except Exception as e:
                print(f"⚠️ Token refresh failed: {e}")
                creds = None
        
        if not creds:
            print("🌐 Launching browser for authorization...")
            try:
                flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_PATH), SCOPES)
                creds = flow.run_local_server(port=0)
            except Exception as e:
                print(f"❌ Authorization failed: {e}")
                sys.exit(1)
        
        # Save token for future use
        with open(TOKEN_PATH, "w") as token:
            token.write(creds.to_json())
        print("✅ Token saved for future use.")
    
    print("✅ Authentication successful.")
    return creds

def list_locations(creds):
    """List all locations to find the correct location ID"""
    try:
        service = build("mybusinessaccountmanagement", "v1", credentials=creds)
        accounts = service.accounts().list().execute()
        
        if not accounts.get('accounts'):
            print("⚠️ No accounts found.")
            return None
        
        account_name = accounts['accounts'][0]['name']
        print(f"📋 Found account: {account_name}")
        
        # Get locations for this account
        # Note: read_mask parameter may not be supported in all API versions
        locations_service = build("mybusinessbusinessinformation", "v1", credentials=creds)
        try:
            # Try with read_mask first (if supported)
            locations = locations_service.accounts().locations().list(
                parent=account_name,
                readMask="name,title,storefrontAddress"
            ).execute()
        except TypeError:
            # Fallback: try without read_mask
            try:
                locations = locations_service.accounts().locations().list(
                    parent=account_name
                ).execute()
            except Exception as e2:
                print(f"⚠️ Could not list locations: {e2}")
                return None
        
        if not locations.get('locations'):
            print("⚠️ No locations found for this account.")
            return None
        
        print(f"📍 Found {len(locations['locations'])} location(s):")
        for loc in locations['locations']:
            print(f"   - {loc.get('title', 'Unknown')}: {loc.get('name', 'No ID')}")
        
        # Return first location (user can modify if needed)
        return locations['locations'][0]['name']
    except Exception as e:
        print(f"⚠️ Could not list locations: {e}")
        print("   You may need to manually set the location_id in the script.")
        return None

def fetch_reviews(creds, location_id=None):
    """Fetch all reviews from Google My Business"""
    print("📡 Fetching Google Business reviews...")
    
    try:
        # First, try to get location ID automatically if not provided
        if not location_id:
            location_id = list_locations(creds)
            if not location_id:
                print("⚠️ Could not determine location ID automatically.")
                print("   Please edit the script and set location_id manually.")
                return []
        
        # Use My Business API v4 for reviews
        # Note: The API service name might need to be discovered dynamically
        print("🔍 Building Google My Business API service...")
        service = None
        api_error_msg = None
        
        try:
            service = build("mybusiness", "v4", credentials=creds)
            print("✅ Successfully built mybusiness v4 service")
        except Exception as api_error:
            api_error_msg = str(api_error)
            print(f"⚠️ Could not build mybusiness v4 service: {api_error}")
            
            # The error might indicate the service doesn't exist or isn't enabled
            if "name: mybusiness" in api_error_msg.lower() or "version: v4" in api_error_msg.lower():
                print("   This usually means:")
                print("   1. The Google My Business API is not enabled in your Google Cloud project")
                print("   2. The API service name or version has changed")
                print("   3. Your OAuth credentials don't have access to this API")
                print("\n   Please check:")
                print("   - Enable 'Google My Business API' in Google Cloud Console")
                print("   - Verify your OAuth client has the correct API access")
                print("   - Check Google's API documentation for any changes")
            
            return []
        
        reviews = []
        next_page_token = None
        
        # Try different API paths for reviews
        try:
            # Method 1: Try the standard reviews endpoint
            while True:
                try:
                    # The reviews endpoint path might vary - try different structures
                    if hasattr(service, 'accounts') and hasattr(service.accounts(), 'locations'):
                        locations_resource = service.accounts().locations()
                        if hasattr(locations_resource, 'reviews'):
                            response = locations_resource.reviews().list(
                                parent=location_id,
                                pageToken=next_page_token,
                                pageSize=50
                            ).execute()
                        else:
                            # Try alternative path
                            response = service.accounts().locations().reviews().list(
                                name=location_id,
                                pageToken=next_page_token,
                                pageSize=50
                            ).execute()
                    else:
                        raise AttributeError("API structure not recognized")
                    
                    reviews_data = response.get("reviews", [])
                    
                    for r in reviews_data:
                        reviewer_info = r.get("reviewer", {})
                        reviewer = reviewer_info.get("displayName", "Anonymous")
                        
                        # Handle star rating (can be string or number)
                        star_rating = r.get("starRating", "UNSPECIFIED")
                        if star_rating == "UNSPECIFIED":
                            rating = "N/A"
                        elif isinstance(star_rating, str):
                            rating = star_rating
                        else:
                            rating = str(star_rating)
                        
                        comment = r.get("comment", "").replace("\n", " ").strip()
                        update_time = r.get("updateTime", "")
                        
                        # Parse date if available
                        date_str = ""
                        if update_time:
                            try:
                                # Google API returns ISO 8601 format
                                dt = datetime.fromisoformat(update_time.replace('Z', '+00:00'))
                                date_str = dt.strftime('%Y-%m-%dT%H:%M:%S')
                            except:
                                date_str = update_time
                        
                        reviews.append({
                            "reviewer": reviewer,
                            "rating": rating,
                            "review": comment,
                            "date": date_str,
                            "source": "Google",
                            "reference_id": ""
                        })
                    
                    next_page_token = response.get("nextPageToken")
                    if not next_page_token:
                        break
                        
                except Exception as e:
                    print(f"⚠️ Error fetching reviews page: {e}")
                    # If we got some reviews, return them; otherwise break
                    if reviews:
                        break
                    else:
                        raise
        except Exception as e:
            # If the standard method fails, try using Business Information API
            print(f"⚠️ Standard reviews API failed: {e}")
            print("   Trying Business Information API...")
            try:
                biz_service = build("mybusinessbusinessinformation", "v1", credentials=creds)
                # Business Information API doesn't have reviews endpoint directly
                # Reviews are typically in the mybusiness API
                print("   Business Information API doesn't support reviews directly.")
                print("   Reviews must be fetched via My Business API.")
                raise
            except Exception as e2:
                print(f"❌ Alternative API method also failed: {e2}")
        
        if reviews:
            print(f"✅ Fetched {len(reviews)} reviews.")
        return reviews
        
    except Exception as e:
        print(f"❌ Error fetching reviews: {e}")
        print("\nTroubleshooting:")
        print("1. Ensure your Google account has access to Google My Business")
        print("2. Check that the location ID is correct")
        print("3. Verify your OAuth credentials have the correct scopes")
        print("4. The Google My Business API may have changed - check Google's API documentation")
        import traceback
        traceback.print_exc()
        return []

def save_to_csv(reviews):
    """Save reviews to CSV file"""
    if not reviews:
        print("⚠️ No reviews to save.")
        return False
    
    # Ensure output directory exists
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    df = pd.DataFrame(reviews)
    df.to_csv(OUTPUT_PATH, index=False, encoding="utf-8-sig")
    
    print(f"💾 Saved {len(reviews)} reviews to {OUTPUT_PATH}")
    print(f"📁 File location: {OUTPUT_PATH.absolute()}")
    return True

def main():
    """Main execution function"""
    print("="*60)
    print("GOOGLE MY BUSINESS REVIEWS FETCHER")
    print("="*60)
    print()
    
    try:
        # Authenticate
        creds = authenticate_google()
        
        # Fetch reviews
        reviews = fetch_reviews(creds)
        
        if not reviews:
            print("❌ No reviews found or error occurred.")
            sys.exit(1)
        
        # Save to CSV
        if save_to_csv(reviews):
            print()
            print("="*60)
            print("✅ SUCCESS")
            print("="*60)
            print(f"📊 Total reviews: {len(reviews)}")
            print(f"📅 Date: {datetime.now().strftime('%d-%b-%Y')}")
            print(f"📁 File: {OUTPUT_PATH.name}")
            print(f"💡 Next step: Merge with Trustpilot reviews in Step 3b")
            print("="*60)
        else:
            print("❌ Failed to save reviews.")
            sys.exit(1)
            
    except FileNotFoundError as e:
        print(f"❌ File not found: {e}")
        print("   Please ensure all required files and directories exist.")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()

