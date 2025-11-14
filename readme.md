# Schema Tools

This repository contains tools to generate JSON-LD schema markup for **products** and **events**, tailored for use with Squarespace websites.

## Tools Included

### 1. `product-schema-generator-v4-alanranger-WORKFLOW-UPDATED.html`
- Generates Google-compliant Product schema blocks.
- Supports review aggregation and filtering (excludes reviews below 4 stars).
- Injects dynamic fields from product CSV exports (e.g., name, price, URL, availability).
- Optionally includes review metadata (rating count, average rating).
- Workflow guide included in the HTML UI.

### 2. `event-schema-generator-v3-FINAL-address-fixed.html`
- Generates Event and ItemList schema blocks for photography workshops.
- Accepts structured CSV files for batch generation.
- Injects performer, organizer, address, validFrom, and location fields.
- Fully structured schema output compliant with Google's Rich Results.

### 3. `index.html` (Unified Schema Generator v4.3.1)
- Combines both tools into one UI with multiple tabs:
  - **Event Schema**: ✅ Complete - Generate Event schemas from CSV with Product+Event hybrid schema
  - **Product Schema**: ✅ Complete - Generate Product schemas with review support
  - **Blog Index Schema**: ✅ Complete - Generate Blog and ItemList schema for blog index pages
  - **Schema Validator**: ✅ Complete validation and enhancement system with inferred type detection
- **Event Schema Generator Features (v4.3.1 - Latest)**:
  - Product+Event hybrid schema (`["Product", "Event"]`) for workshops/courses
  - Products Excel file upload for actual SKU values (`02 – products_cleaned.xlsx`)
  - Enhanced review matching with 3 strategies (exact match, slug match, substring match)
  - Review threshold lowered to >=1 review (includes all products with reviews)
  - Provider property removed (not valid for Event schema, organizer used instead)
  - Missing offers issue resolved (always adds offers, even if price = 0)
  - EventSeries detection and backlinking (v4.2/v4.3)
  - UI guidance improvements with detailed file upload instructions
  - Enhanced debug logging for review matching issues
  - All validation warnings resolved (0 errors, 0 warnings)
- **Blog Index Schema Generator Features**:
  - CSV upload for blog posts
  - Generates Blog and ItemList schema
  - Includes BlogPosting entries with proper dates, authors, and URLs
  - Copy and save functionality
  - Test links to Google Rich Results Test
- **Schema Validator Features (v1.5.2 - Complete)**:
  - Single URL and batch CSV validation
  - Inferred schema type detection (Carousel, ReviewSnippet, MerchantListing)
  - Enhanced JSON-LD detection (Squarespace patterns, noscript tags)
  - MerchantListing badge with green background and white checkmark
  - Improved duplicate detection for multi-instance types
  - Supabase integration for audit logging
  - Comprehensive schema details modal
- **Electron Desktop App (v1.5.2 - New)**:
  - Fully offline desktop application
  - Auto-starts local server on launch
  - Step 0 pre-flight check for local executor
  - Automatic workflow execution (Steps 1 → 2 → 3a → 3b → 4)
  - No terminal commands needed
  - Run with `npm start` or double-click packaged `.exe`

### 4. `schema-validator.js` (Schema Validator Agent)
- Automated CLI tool to validate schema markup on live URLs.
- Tests against Schema.org validator and Google Rich Results Test.
- Supports single URL or batch processing.
- Provides detailed validation reports with errors and warnings.
- See `schema-validator-README.md` for full documentation.

### 5. `csv-schema-validator.js` (Bulk Schema Validator)
- Accepts CSV files with URLs for bulk validation.
- For each URL, checks:
  - Whether schema markup exists
  - Schema types present (Product, Event, etc.)
  - Missing required and recommended fields
  - Overall validity status
- Generates validator links for Schema.org and Google Rich Results Test.
- Outputs readable JSON or text summary with pass/fail/warnings.
- See "Bulk Schema Validation" section below for usage.

### 6. `schema-enhancer.js` (Schema Enhancement Agent)
- Takes validation results and generates enhanced schema blocks.
- Automatically fills missing required and recommended fields.
- Provides placeholders for fields that need manual input.
- Supports export in JSON or HTML script tag format.
- Can enhance schemas from validation results or fetch fresh from pages.
- See "Schema Enhancement" section below for usage.

## Input Files

- CSV exports from Squarespace (Products & Services panel).
- Review export files from Trustpilot or Squarespace (where available).
- Cleaned and pre-processed versions must match expected schema field mappings.

## Folder Structure

```
schema-tools/
│
├── html-tools/                  # Contains HTML tools
│   ├── product-schema-generator-v4-alanranger-WORKFLOW-UPDATED.html
│   ├── event-schema-generator-v3-FINAL-address-fixed.html
│   └── unified_schema_generator.html
│
├── inputs-csv-files/           # Source CSVs for schema generation
│
├── js/                         # Review JS files for widget rendering (optional)
│
├── readme-and-docs/
│   ├── README.md               # This file
│   └── handover-cursor-ai.md   # Detailed onboarding notes
```

## Workflow Summary

1. Export product list from Squarespace to CSV (`products_*.csv`).
2. Clean fields manually or use future cleanup tool (in development).
3. Merge with review dataset (if reviews available).
4. Load HTML schema generator.
5. Select or paste the CSV file.
6. Generate JSON-LD.
7. Paste each block into the corresponding Squarespace product or event page (not all in one).

## Unified Schema Generator (Browser Tool)

The `unified-schema-generator.html` tool provides three tabs in one interface:

### Event Schema Tab
- Upload CSV file with event data
- Filter by category
- Generate Event + ItemList schema blocks
- Copy to clipboard for Squarespace deployment

### Product Schema Tab
- Upload CSV file with product data
- Automatically filter reviews (4+ stars only)
- Generate Product schema blocks with reviews
- ✅ **Schema Suppressor v1.3** - Automatically included in all generated HTML files to prevent duplicate Squarespace Product schemas
- Copy to clipboard for Squarespace deployment

### Schema Validator Tab (NEW!)
- **Single URL Validation**: Quick validation for individual pages
  - Enter a URL and click "Run Validation"
  - Opens both Schema.org and Google Rich Results validators in new tabs
  - Perfect for quick checks before deploying schema
  
- **Batch CSV Validation**: Validate multiple URLs at once
  - Upload CSV file with page URLs
  - Automatically validates each URL:
    - Checks for schema markup presence
    - Identifies schema types (Product, Event, etc.)
    - Detects missing required and recommended fields
    - Shows validation status (✅ Valid / ⚠️ Issues / ❌ No Schema)
  - Generate enhanced schemas with missing fields filled
  - Download enhanced schemas as JSON and HTML files
  - Works entirely in browser (no server required)

**Usage:**
1. Open `unified-schema-generator.html` in your browser
2. Switch to the "Schema Validator" tab
3. **For single URL validation:**
   - Enter a URL in the "Validate a Single URL" field
   - Click "Run Validation" to open both validators in new tabs
4. **For batch validation:**
   - Click "Download Template CSV" to get a sample CSV file with the correct format
   - Fill in your URLs in the CSV file
   - Upload the CSV file
   - Click "Validate URLs" to start processing
   - Review results in the table
   - Click "Generate Enhanced" button for any URL to download improved schema (JSON and HTML formats)
   - Use "Schema.org" and "Google" buttons in the Actions column to manually validate specific URLs

**CSV Format for Validator:**
```csv
URL,Page Name,Category
https://www.example.com/product-1,Product One,Products
https://www.example.com/product-2,Product Two,Products
```

**Features (v1.2.1):**
- ✅ Single URL validation with one-click access to both validators
- ✅ Real-time progress indicator during batch validation
- ✅ Template CSV download for easy setup
- ✅ Enhanced schema generation with multiple schema support (@graph structure)
- ✅ Downloads both JSON and HTML script tag formats
- ✅ Improved table UI with status badges and validator links
- ✅ Better error handling and processing status display
- ✅ Collapsible help section explaining validators
- ✅ Validator links in results table for quick manual validation

**Code Quality Improvements (v1.4.0):**
- ✅ Refactored to reduce cognitive complexity (all functions ≤ 15)
- ✅ Replaced `window` with `globalThis` for better cross-platform compatibility
- ✅ Converted `.forEach()` loops to `for...of` loops for better performance
- ✅ Replaced `removeChild()` with modern `.remove()` method
- ✅ Improved error handling with proper exception logging
- ✅ Replaced `JSON.parse(JSON.stringify())` with `structuredClone()` for deep cloning
- ✅ Extracted nested ternary operations for better readability
- ✅ Removed unnecessary escape characters in regex patterns
- ✅ Fixed redundant variable assignments
- ✅ Added accessibility attributes (`title`) to select elements
- ✅ Improved code maintainability and readability throughout

**Schema Validator Enhancements (v1.5.0):**
- ✅ Inferred schema type detection (Carousel, ReviewSnippet, MerchantListing)
- ✅ Enhanced JSON-LD detection for Squarespace-specific patterns
- ✅ MerchantListing badge with green background and white checkmark
- ✅ Improved duplicate detection with multi-instance type support
- ✅ Fixed Supabase RLS policy violations
- ✅ Comprehensive schema details modal with inferred types section

## Schema Validation

After deploying schema to your Squarespace pages, use the Schema Validator Agent to automatically test:

### Single URL Validation

```bash
# Install dependencies (first time only)
npm install

# Validate a single URL
node scripts/schema-validator.js https://www.alanranger.com/shop/product-name

# Validate multiple URLs from text file
node scripts/schema-validator.js --batch urls.txt --json --output results.json
```

### Bulk CSV Validation

Validate multiple URLs from a CSV file:

```bash
# CSV file must have a column named: URL, Link, or Website
node scripts/csv-schema-validator.js urls.csv

# Save results to JSON file
node scripts/csv-schema-validator.js urls.csv --output results.json

# Output as JSON
node scripts/csv-schema-validator.js urls.csv --json

# Skip validator checks (faster, just analyzes schema markup)
node scripts/csv-schema-validator.js urls.csv --skip-validators
```

**CSV Format Example:**
```csv
URL,Product Name,Category
https://www.example.com/product-1,Product One,Workshops
https://www.example.com/product-2,Product Two,Gear
```

The bulk validator checks:
- ✅ Schema markup presence
- ✅ Schema types (Product, Event, etc.)
- ✅ Missing required fields
- ✅ Missing recommended fields
- ✅ Generates validator links for manual testing

**Output Format:**
```json
[
  {
    "url": "https://www.example.com/product-123",
    "schemaType": "Product",
    "valid": true,
    "missingFields": [],
    "warnings": ["Missing recommended field: brand"],
    "validatorLinks": {
      "schema": "https://validator.schema.org/#url=...",
      "google": "https://search.google.com/test/rich-results?url=..."
    }
  }
]
```

The validator automatically tests against:
- https://validator.schema.org
- https://search.google.com/test/rich-results

### Schema Enhancement

After validation, use the Schema Enhancement Agent to generate improved schema blocks with missing fields filled:

```bash
# Enhance schemas from validation results
node scripts/schema-enhancer.js validation-results.json

# Save enhanced schemas to file
node scripts/schema-enhancer.js validation-results.json --output enhanced-schemas.json

# Export as HTML script tags (ready to paste into Squarespace)
node scripts/schema-enhancer.js validation-results.json --format html --output enhanced.html

# Enhance a single URL (fetches fresh data from page)
node scripts/schema-enhancer.js --single-url https://www.alanranger.com/shop/product-name

# Fetch fresh data from pages instead of using validation results
node scripts/schema-enhancer.js validation-results.json --use-page-data
```

**Complete Workflow:**

```bash
# Step 1: Validate URLs
node scripts/csv-schema-validator.js urls.csv --output validation-results.json

# Step 2: Enhance schemas based on validation results
node scripts/schema-enhancer.js validation-results.json --format html --output enhanced-schemas.html

# Step 3: Review enhanced schemas and replace placeholders
# Step 4: Copy HTML script tags and paste into Squarespace pages
```

**Enhancement Features:**
- ✅ Fills missing required fields with placeholders or inferred values
- ✅ Adds recommended fields where defaults exist (e.g., Event organizer, Product brand)
- ✅ Infers values from page URL when possible
- ✅ Preserves existing schema structure
- ✅ Tracks what fields were added
- ✅ Outputs ready-to-use HTML script tags

**Output Example:**
```json
[
  {
    "url": "https://www.example.com/product",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "enhancedSchemas": [
      {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "[REPLACE WITH PRODUCT NAME]",
        "url": "https://www.example.com/product",
        "brand": {
          "@type": "Brand",
          "name": "[REPLACE WITH BRAND NAME]"
        },
        "offers": {
          "@type": "Offer",
          "price": "[REPLACE WITH PRICE]",
          "priceCurrency": "GBP",
          "availability": "https://schema.org/InStock",
          "url": "https://www.example.com/product"
        }
      }
    ],
    "addedFields": ["brand", "offers", "description"],
    "notes": []
  }
]
```

## Supabase Integration (Schema Audit Logs)

The unified schema generator includes Supabase integration to store validation results and audit logs. This allows you to track schema validation history over time.

### Setup

1. **Supabase Table Created**: The `schema_audit_logs` table has been created automatically with the following schema:
   - `url` (text) - The validated page URL
   - `timestamp` (timestamp) - When the validation was performed
   - `validator_google_status` (text) - Status from Google Rich Results Test (✅ Passed / ❌ Failed / 🚫 Skipped)
   - `validator_schemaorg_status` (text) - Status from Schema.org Validator (✅ Passed / ❌ Failed / 🚫 Skipped)
   - `schema_type_detected` (text) - Detected schema types (e.g., "Product", "Event")
   - `schema_json_raw` (jsonb) - The raw schema JSON found on the page
   - `schema_notes` (text) - Manual notes about the validation

2. **Configuration**: Supabase credentials are already configured in `unified-schema-generator.html`:
   - Supabase URL: `https://igzvwbvgvmzvvzoclufx.supabase.co`
   - Uses anonymous key for browser-based access

### Usage

1. **Validate URLs**: Use the Schema Validator tab to validate URLs from CSV
2. **Set Status**: Use the dropdown menus to set Google and Schema.org validation status
3. **Add Notes**: Enter notes in the textarea for each URL
4. **Save to Supabase**: Click "Save to Supabase" button for each row
5. **View Results**: Check Supabase dashboard or query the `schema_audit_logs` table

### Table Schema

```sql
CREATE TABLE schema_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  validator_google_status TEXT,
  validator_schemaorg_status TEXT,
  schema_type_detected TEXT,
  schema_json_raw JSONB,
  schema_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Features

- ✅ Manual status input for Google and Schema.org validators
- ✅ Notes field for each validation
- ✅ Automatic storage of detected schema JSON
- ✅ Toast notifications for save success/failure
- ✅ Console logging for debugging

### Querying Results

```sql
-- Get all validations for a specific URL
SELECT * FROM schema_audit_logs 
WHERE url = 'https://www.example.com/page' 
ORDER BY timestamp DESC;

-- Get all failed validations
SELECT * FROM schema_audit_logs 
WHERE validator_google_status = '❌ Failed' 
   OR validator_schemaorg_status = '❌ Failed'
ORDER BY timestamp DESC;

-- Get validation history
SELECT url, validator_google_status, validator_schemaorg_status, timestamp 
FROM schema_audit_logs 
ORDER BY timestamp DESC 
LIMIT 100;
```

## Code Quality & Standards

This project follows modern JavaScript best practices and meets SonarLint code quality standards:

- ✅ All functions have cognitive complexity ≤ 15
- ✅ Uses modern JavaScript syntax (`globalThis`, `for...of`, `structuredClone`)
- ✅ Proper error handling with exception logging
- ✅ Accessibility attributes included for screen readers
- ✅ Clean, maintainable code structure

See `CHANGELOG.md` for detailed version history and improvements.

## Notes

- You must not inject multiple schema blocks on unrelated pages. Only paste the matching product's schema on its correct Squarespace page.
- Always validate your schema after deployment using the Schema Validator Agent or manually:
  - https://validator.schema.org
  - https://search.google.com/test/rich-results

---This project follows modern JavaScript best practices and meets SonarLint code quality standards:

- ✅ All functions have cognitive complexity ≤ 15
- ✅ Uses modern JavaScript syntax (`globalThis`, `for...of`, `structuredClone`)
- ✅ Proper error handling with exception logging
- ✅ Accessibility attributes included for screen readers
- ✅ Clean, maintainable code structure

See `CHANGELOG.md` for detailed version history and improvements.

## Notes

- You must not inject multiple schema blocks on unrelated pages. Only paste the matching product's schema on its correct Squarespace page.
- Always validate your schema after deployment using the Schema Validator Agent or manually:
  - https://validator.schema.org
  - https://search.google.com/test/rich-results

---
