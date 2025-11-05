# Google Reviews Fetcher - Quick Start Guide

## Overview
This script fetches all reviews from your Google My Business account and saves them as a CSV file for use in the Product Schema Generator workflow.

## Prerequisites

1. **Install Required Libraries**
   ```bash
   pip install google-auth-oauthlib google-auth google-api-python-client pandas
   ```

2. **OAuth Credentials**
   - Your credentials file should be located at:
     ```
     /inputs-files/workflow/credentials/client_secret_367492921794-ps8fhbtuf2gb5vhnp5p06qfhhiehlqmu.apps.googleusercontent.com.json
     ```
   - Ensure this file exists before running the script

## Running the Script

### First Time Setup
1. Open terminal/Cursor in the project directory
2. Run:
   ```bash
   python scripts/fetch-google-reviews.py
   ```
3. A browser window will open for OAuth authorization
4. Select your Google account and grant permissions
5. The script will save your token for future use

### Subsequent Runs
- Simply run: `python scripts/fetch-google-reviews.py`
- The script will use your saved token automatically
- If the token expires, it will refresh automatically

## Output

The script saves reviews to:
```
/inputs-files/workflow/03b – google_reviews.csv
```

### CSV Format
- `reviewer`: Reviewer's display name
- `rating`: Star rating (1-5 or "N/A")
- `review`: Review text content
- `date`: Review date (ISO format)
- `source`: "Google"
- `reference_id`: Empty (for future use)

## Troubleshooting

### "API credentials missing"
- Ensure the credentials JSON file exists in the correct location
- Check that the filename matches exactly

### "No locations found"
- The script will try to automatically detect your location
- If it fails, you may need to manually set the `location_id` in the script
- List your locations first using the Google My Business API

### "Authorization failed"
- Check your internet connection
- Ensure the OAuth credentials are valid
- Verify you have access to Google My Business

### "No reviews found"
- Verify your Google My Business account has reviews
- Check that the location ID is correct
- Ensure your account has the necessary permissions

## Next Steps

After fetching Google reviews:
1. The CSV file will be saved to `/inputs-files/workflow/03b – google_reviews.csv`
2. Continue with Step 3b: Merge Reviews and Generate Merged Dataset
3. Merge with Trustpilot reviews and other data sources

## Notes

- The script handles pagination automatically (can fetch >200 reviews)
- Token is saved locally for future use (no need to re-authorize each time)
- First-time authorization requires browser access
- Reviews are filtered to include only valid entries

