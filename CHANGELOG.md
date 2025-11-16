# Changelog

All notable changes to the Schema Tools project will be documented in this file.

## [6.2.0] - 2025-01-XX

### Product Schema Generator - Schema Structure Fixes (Baseline Restore Point)

#### Fixed
- **Product Schema @type**:
  - Changed from `["Product", "Course"]` or `["Product", "Event"]` arrays to `"Product"` only
  - Product schema now strictly follows Schema.org Product type requirements
  - Removed Course and Event from Product @type (handled separately)
- **Product @id Format**:
  - Changed from `#schema` to `#product` format: `<canonical URL>#product`
  - Ensures proper identification and linking
- **Organization Block**:
  - Created separate standalone Organization block (removed from LocalBusiness @type array)
  - Organization has `@type: "Organization"` only (no multiple types)
  - Organization `@id: "https://www.alanranger.com#org"` (no duplicate URLs)
  - Organization includes: name, url, logo, image, telephone, email, address
- **LocalBusiness Block**:
  - Changed from `["LocalBusiness", "Organization"]` to `"LocalBusiness"` only
  - LocalBusiness has separate `@id: "https://www.alanranger.com/#localbusiness"`
  - Prevents duplicate field warnings between Organization and LocalBusiness
- **@graph Order**:
  - Updated to: Organization → LocalBusiness → BreadcrumbList → Product
  - Ensures proper schema hierarchy and validation
- **Prohibited Properties**:
  - Removed `event` property from Product schema (Event is separate JSON-LD block)
  - Removed `provider` property from Product schema (not valid for Product type)
  - Removed `mainEntityOfPage` from Product schema (not in required fields)
  - Validation now explicitly checks for and rejects prohibited properties
- **Event Schema**:
  - Event schema is now completely separate JSON-LD block (not nested in Product)
  - Event schema only included in `_squarespace_ready.html` files (inline)
  - Event schema NOT included in `_script_tag.html` files (Product validation only)
  - Event schema has its own `@id: "<url>#event"` format

#### Removed
- **Course Type Support**:
  - Removed `hasCourseInstance` property from Product schema
  - Product is Product only, Course information handled separately if needed
- **Event in Offers**:
  - Removed event object from inside Offer objects
  - Offers contain only: @type, price, priceCurrency, availability, url, seller, shippingDetails, hasMerchantReturnPolicy
- **Separate Event JSON Files**:
  - Removed generation of separate `_event_schema.json` files
  - Event schema is inline in HTML only (not fetched separately)

#### Improved
- **Validation Logic**:
  - Updated to validate Product @type is "Product" only (not array)
  - Validates @graph order: Organization → LocalBusiness → BreadcrumbList → Product
  - Validates Organization is first in @graph
  - Validates Product has no prohibited properties (event, provider)
  - Validates Offers have no event property
- **Schema Structure**:
  - Product schema contains only valid Product fields: @context, @type, @id, name, description, image, url, sku, brand, offers, review (optional), aggregateRating (optional)
  - Organization and LocalBusiness are separate blocks with distinct @id values
  - No duplicate URLs or overlapping type definitions

#### Technical Details
- `generate_product_schema_graph()` function updated to generate Product with @type: "Product" only
- `ORGANIZATION` constant created as separate block (not nested in LocalBusiness)
- `LOCAL_BUSINESS` constant updated to @type: "LocalBusiness" only
- `schema_to_script_tag_html()` function updated to exclude Event schema (Product only)
- `schema_to_html()` function generates separate Event JSON-LD block when event_schema exists
- Validation functions updated to match new structure requirements
- All 52 product schema files regenerated with new structure

#### Known Issues
- **Cosmetic Warnings**: Some duplicate field warnings between LocalBusiness and Organization are expected and cosmetic (not affecting functionality)
- These warnings are acceptable and do not require suppression code changes (would require regenerating 50+ product files)

## [4.3.1] - 2025-11-10

### Event Schema Generator - Major Fixes & Enhancements

#### Fixed
- **SKU Issue - Resolved**:
  - Added Products Excel file upload support (`02 – products_cleaned.xlsx`)
  - Integrated SheetJS (xlsx.js) library for Excel parsing
  - SKU extraction now prioritizes actual SKU values from `main_sku` column
  - All SKUs truncated to 40 characters to prevent validation errors
  - Result: Actual SKU values (e.g., `SQ3971373`, `SQ5697158`) are now used instead of URL slug fallback
- **Review Matching - Enhanced**:
  - Implemented 3-strategy review matching system:
    1. `matchProductUrl()` function (handles prefix differences)
    2. Direct slug matching (compares final slug segments)
    3. Substring matching (checks if slug appears anywhere in URL)
  - Lowered review threshold from `>= 3` to `>= 1` to include all products with reviews
  - Result: Reviews dictionary increased from 39 to 50 products, all events now match reviews correctly
- **Provider Property - Removed**:
  - Removed invalid `provider` property from Event schema (not recognized by Schema.org for Event type)
  - `organizer` property already provides the same information and is valid for Event schema
  - Result: All validation warnings for `provider` property resolved
- **Missing Offers Issue - Resolved**:
  - Fixed issue where 27 events were missing "offers" field
  - Root cause: Incomplete `event-product-mappings-*.csv` file (missing entries for 42 events)
  - Solution: User fixed ingest app to generate complete mappings CSV
  - Code updated to always add offers, even if price = 0 (logs data error in such cases)
  - Result: All events now have proper offers blocks

#### Added
- **Products Excel File Upload**:
  - New file input for `02 – products_cleaned.xlsx` in Event Schema tab
  - Provides actual SKU values from `main_sku` column
  - Prevents fallback to URL slug extraction
- **Enhanced Review Matching Debug**:
  - Expanded debug output to cover first 10 events without reviews
  - Specifically checks problematic event titles (Burnham, Fairy Glen, Exmoor, Dartmoor, Ireland, Peak District)
  - Shows detailed matching information including product slug and potential matches
- **UI Guidance Improvements**:
  - Updated instructions section with detailed file upload guidance
  - Added "What it does" and "How it works" sections
  - Expanded "Data Workflow Summary" with current workflow and notes

#### Improved
- **Review Matching Logic**:
  - Enhanced `findReviewData()` function with multiple matching strategies
  - Handles URL prefix differences (`/photo-workshops-uk/` vs direct domain)
  - More robust matching for events like Burnham on Sea, Fairy Glen, etc.
- **SKU Extraction**:
  - Priority order: `main_sku` → `sku` → URL slug (truncated to 40 chars)
  - Consistent truncation across all paths to prevent validation errors
- **Debug Logging**:
  - Enhanced debug output for review matching issues
  - Shows product URLs, slugs, and potential matches
  - Better diagnostics for troubleshooting

#### Technical Details
- Added SheetJS library (`xlsx@0.18.5`) for Excel file parsing
- `loadProductsData()` function loads products Excel and extracts SKU values
- `buildMappingsDict()` updated to use products data for SKU lookup
- `findReviewData()` enhanced with 3 matching strategies
- `buildReviewsDict()` threshold lowered from `>= 3` to `>= 1` reviews

## [4.3] - 2025-11-08

### Event Schema Generator - EventSeries Backlinking

#### Added
- **Stable @id Assignment**:
  - Every Event and EventSeries now has a stable `@id` based on URL
  - Format: `{eventUrl}#event` for events, `{baseUrl}#series-{slug}` for series
- **EventSeries Backlinking**:
  - `Event.superEvent` → `EventSeries(@id)` (forward link)
  - `EventSeries.subEvent` → `[Event(@id)]` (backward link)
  - Creates bidirectional relationship between events and their series
- **Field Verification Summary**:
  - Extended summary includes linkage statistics
  - Console debug output for linkage verification

#### Improved
- **EventSeries Detection**:
  - Keeps v4.2 detection & enrichment intact
  - No UI changes, only backend linkage improvements

## [4.2] - 2025-11-07

### Event Schema Generator - EventSeries Optimization

#### Added
- **EventSeries Detection**:
  - `detectEventSeries()` function for repeat workshop patterns
  - Groups multi-instance Bluebell & Batsford workshops into EventSeries
  - Adds `eventSchedule` + `subjectOf` ItemList linkage
- **Grouping Summary**:
  - Console + UI summary of detected series groups
  - Shows number of events per series

## [4.1] - 2025-11-06

### Event Schema Generator - Product+Event Hybrid Schema

#### Added
- **Hybrid Schema Type**:
  - Changed `@type` from `"Event"` to `["Product", "Event"]` hybrid
  - Validates with Schema.org and Google Rich Results
- **SKU Support**:
  - Added SKU to offers object (required for Product+Event hybrid)
  - SKU extracted from product URL slug (later improved to use products Excel)
- **Merchant Fields**:
  - Always adds offers (Google requirement)
  - Logs error if price = 0 (data issue, not fallback)
  - Added `shippingDetails`, `priceValidUntil`, `hasMerchantReturnPolicy`
- **UI Enhancements**:
  - Clear file upload guidance
  - Workflow diagram at top of page
  - Notes about Product+Event hybrid and SKU requirements

#### Removed
- Invalid Event-only fields: `thumbnailUrl`, `eventType`, `material`, `courseMode`, `isFamilyFriendly`, `learningResourceType`
- These fields are not valid for Event or Product+Event hybrid schema

#### Fixed
- Validation function updated to handle Product+Event hybrid schemas
- Updated validation to correctly filter for Event types including `["Product", "Event"]` arrays

## [1.5.3] - 2025-11-08

### Product Schema Generator - Schema Suppressor v1.3 Integration

#### Added
- **Schema Suppressor v1.3 (Code-Block Safe)**:
  - Automatically included in all generated HTML files
  - Removes duplicate Squarespace Product schemas to prevent conflicts
  - Uses MutationObserver to catch dynamically injected schemas
  - Runs immediately, on DOMContentLoaded, after page load, and continuously via MutationObserver
  - Detects Squarespace schemas by: length < 1500 chars, no aggregateRating/review, has offers/name, missing hasMerchantReturnPolicy
- **Post-build Injector Script** (`scripts/inject-schema-suppressor.js`):
  - Recursively injects suppressor block into HTML files
  - Idempotent: checks for marker comment before injecting
  - Supports custom directories (dist/, out/, outputs/)
  - npm scripts: `postbuild:inject-suppressor` and `postbuild:inject-suppressor:out`
- **Partial File** (`partials/schema-suppressor-v1.3.html`):
  - Standalone suppressor block for easy updates/removal
  - Marker comment: `<!-- Squarespace Product Schema Suppressor v1.3 (Code-Block Safe) -->`

#### Improved
- **Step 4 Schema Generation**:
  - Suppressor block automatically included in every generated HTML file
  - Cached loading (only loads once, not per product)
  - Logging shows suppressor status once at start
- **URL Validation**:
  - Step 2 now validates all URLs and fails if any return 404 errors
  - Ensures schema URLs are correct before generation
  - Reports invalid URLs with row numbers and error messages
- **URL Path Generation**:
  - Fixed URL construction to use full path from Product Page + Product URL columns
  - Generates unique slugs from product names when Product URL is generic (print, canvas, etc.)
  - Correct breadcrumb parent categories extracted from URL paths

#### Fixed
- **Error Detection**: Electron app now correctly handles URL validation warnings vs actual failures
- **Filename Convention**: Output files now use product name slugs instead of URL slugs for easier identification
- **Breadcrumb Generation**: Correctly extracts parent category from full URL paths

#### Technical Details
- Suppressor integrated into `schema_to_html()` function in `scripts/generate-product-schema.py`
- Suppressor block cached at module level to prevent repeated loading
- UI updated to document suppressor in Product Schema tab, Step 4 description, and Guide tab
- Success messages include suppressor information

## [1.5.2] - 2024-11-05

### Electron Desktop App Enhancement

#### Added
- **Step 0 - Initialize Local Executor**:
  - Pre-flight check for local server/Electron bridge status
  - Automatic detection of Electron vs browser vs web deployment environment
  - Visual status indicators (green/yellow/red) with clear messaging
  - Console output area for debugging and status logs
  - Action buttons for manual server start (browser mode)
  - Copy CLI command button for easy setup
  - Step 1 locked until Step 0 completes successfully

#### Improved
- **Vercel Build Compatibility**:
  - Build script now skips Electron builds for web deployments
  - Separate `build:electron` script for local Electron packaging
  - Web deployments use `build:web` script (no-op)
- **Browser Compatibility**:
  - Replaced optional chaining (`?.`) with compatible syntax for older browsers
  - Better error handling in Step 0 initialization
  - Graceful fallbacks for environment detection

#### Technical Details
- `initLocalExecutor()` function handles environment detection and server verification
- `unlockStep1()` and `lockStep1()` functions control Step 1 access
- Electron mode: Auto-detects and unlocks Step 1 after server confirmation
- Browser mode: Shows manual instructions and buttons
- Web mode: Shows read-only info message

## [1.5.1] - 2024-11-05

### Electron Desktop App Setup

#### Added
- **Electron Integration**:
  - `main.js` - Electron main process with auto-starting local server
  - `preload.js` - Secure Electron API exposure
  - Window title: "Alan Ranger Schema Tools v1.5.0"
  - Auto-starts local Node.js server on app launch
  - Graceful shutdown handling
- **Local Server Bridge**:
  - Express server runs automatically in Electron mode
  - No manual terminal commands needed
  - Python scripts execute seamlessly via bridge
- **Package Scripts**:
  - `npm start` - Launch Electron app
  - `npm run build` - Package Electron app for Windows
  - `npm run build:electron` - Explicit Electron build
  - `npm run build:web` - Web deployment build (no-op)

#### Technical Details
- Server auto-starts in Electron mode (no user intervention)
- All Python scripts verified: clean, fetch, merge, schema
- File outputs written to `/inputs-files/workflow/`
- Offline-first architecture

## [1.5.0] - 2024-11-05

### Schema Validator Tab Enhancements
  - Carousel detection from ≥3 Event items or Product/Course schemas
  - ReviewSnippet detection from aggregateRating, review, or reviews fields
  - MerchantListing (Google) detection for Product schemas with Merchant Center fields (offers, priceCurrency, availability, hasMerchantReturnPolicy)
- **Visual Enhancements**:
  - MerchantListing badge with green background (`#27AE60`) and white checkmark emoji
  - Compact badge design (0.85em font, reduced padding) to prevent column width issues
  - Inferred types displayed in italic gray text with special styling for MerchantListing
- **JSON-LD Detection Improvements**:
  - Squarespace pattern support: `script[data-type="application/ld+json"]`
  - Nested `<noscript>` tag detection for both standard and Squarespace patterns
  - HTML entity decoding (`&quot;`, `&apos;`, `&amp;`, `&#x2F;`, `\/`) before JSON parsing
  - Deduplication of found script tags
- **Duplicate Detection Enhancements**:
  - Multi-instance allowed types: Event, Product, Course, Article, Review, FAQPage, ListItem, Offer
  - Informational messages for expected multi-instance schemas (e.g., "✅ Multiple Event schemas detected (45) — expected for event listings.")
  - Accurate duplicate counting excluding multi-instance types
  - Friendly classification messages for duplicate issues

#### Fixed
- **Supabase Integration**:
  - Fixed Row-Level Security (RLS) policy violations (Code 42501)
  - Added RLS policies for `anon` and `authenticated` roles
  - Improved error handling for auto-save operations (suppresses RLS errors with warnings)
  - Better user feedback for save operations
- **Inferred Types Display**:
  - Fixed race condition where inferred types disappeared after scan completion
  - Ensured inferred types persist in table after row updates
  - Correct display of inferred types in schema type cell and modal

#### Improved
- **Debug Logging**:
  - Detailed logging for MerchantListing detection (shows missing fields)
  - Informational messages downgraded from `warn` to `info` level
  - Better console output for troubleshooting

#### Technical Details
- `detectInferredTypes()` function analyzes all schema nodes to identify implicit types
- `formatSchemaTypesWithInferred()` function formats inferred types with visual differentiation
- `detectMerchantListing()` function checks for Merchant Center compliance fields
- `findAllJsonLdScripts()` helper function expands JSON-LD detection coverage
- `decodeHTML()` helper function handles HTML entity decoding

## [1.4.0] - 2024-01-XX

### Code Quality Improvements
- **Refactored all functions** to reduce cognitive complexity below 15 (SonarLint requirement)
- **Modernized JavaScript syntax**:
  - Replaced `window` with `globalThis` (5 occurrences)
  - Converted `.forEach()` loops to `for...of` loops (19 occurrences)
  - Replaced `removeChild()` with `.remove()` method (5 occurrences)
  - Replaced `JSON.parse(JSON.stringify())` with `structuredClone()` (2 occurrences)
- **Improved error handling**:
  - Added proper exception logging to all catch blocks (6 occurrences)
  - Replaced silent catch blocks with `console.warn()` or `console.error()`
- **Code readability improvements**:
  - Extracted nested ternary operations into independent statements (3 occurrences)
  - Removed unnecessary escape characters in regex patterns (3 occurrences)
  - Fixed redundant variable assignments (3 occurrences)
  - Converted simple `for` loop to `for...of` (1 occurrence)
- **Accessibility improvements**:
  - Added `title` attributes to select elements for better screen reader support
- **Function refactoring**:
  - Extracted helper functions to reduce complexity
  - Improved function organization and maintainability

### Technical Details
- All functions now meet SonarLint cognitive complexity requirements (≤15)
- Improved cross-platform compatibility with `globalThis`
- Better performance with `for...of` loops instead of `.forEach()`
- Modern DOM manipulation with `.remove()` instead of `removeChild()`
- Proper deep cloning with `structuredClone()` instead of JSON serialization

## [1.3.0] - Previous Release

### Added
- Supabase integration for storing validation results
- Manual status input dropdowns for Google and Schema.org validators
- Notes textarea for each validation result
- "Save to Supabase" button functionality
- Toast notifications for save success/failure
- Automatic storage of schema JSON and validation metadata

## [1.2.1] - Previous Release

### Added
- Template CSV download button for easy setup
- Real-time progress indicators during validation
- Enhanced schema generation with @graph support for multiple schemas
- Downloads both JSON and HTML script tag formats
- Improved UI with status badges and better error handling
- Better table rendering with processing status updates

## [1.2.0] - Previous Release

### Added
- HTML UI for bulk validator (browser-based CSV upload)
- Schema validation capabilities in unified generator
- Bulk URL validation from CSV

## [1.0.0] - Initial Release

### Added
- Unified schema generator combining event and product generators
- Event schema generation from CSV
- Product schema generation from CSV
- Basic validation functionality



- **Package Scripts**:
  - `npm start` - Launch Electron app
  - `npm run build` - Package Electron app for Windows
  - `npm run build:electron` - Explicit Electron build
  - `npm run build:web` - Web deployment build (no-op)

#### Technical Details
- Server auto-starts in Electron mode (no user intervention)
- All Python scripts verified: clean, fetch, merge, schema
- File outputs written to `/inputs-files/workflow/`
- Offline-first architecture

## [1.5.0] - 2024-11-05

### Schema Validator Tab Enhancements
  - Carousel detection from ≥3 Event items or Product/Course schemas
  - ReviewSnippet detection from aggregateRating, review, or reviews fields
  - MerchantListing (Google) detection for Product schemas with Merchant Center fields (offers, priceCurrency, availability, hasMerchantReturnPolicy)
- **Visual Enhancements**:
  - MerchantListing badge with green background (`#27AE60`) and white checkmark emoji
  - Compact badge design (0.85em font, reduced padding) to prevent column width issues
  - Inferred types displayed in italic gray text with special styling for MerchantListing
- **JSON-LD Detection Improvements**:
  - Squarespace pattern support: `script[data-type="application/ld+json"]`
  - Nested `<noscript>` tag detection for both standard and Squarespace patterns
  - HTML entity decoding (`&quot;`, `&apos;`, `&amp;`, `&#x2F;`, `\/`) before JSON parsing
  - Deduplication of found script tags
- **Duplicate Detection Enhancements**:
  - Multi-instance allowed types: Event, Product, Course, Article, Review, FAQPage, ListItem, Offer
  - Informational messages for expected multi-instance schemas (e.g., "✅ Multiple Event schemas detected (45) — expected for event listings.")
  - Accurate duplicate counting excluding multi-instance types
  - Friendly classification messages for duplicate issues

#### Fixed
- **Supabase Integration**:
  - Fixed Row-Level Security (RLS) policy violations (Code 42501)
  - Added RLS policies for `anon` and `authenticated` roles
  - Improved error handling for auto-save operations (suppresses RLS errors with warnings)
  - Better user feedback for save operations
- **Inferred Types Display**:
  - Fixed race condition where inferred types disappeared after scan completion
  - Ensured inferred types persist in table after row updates
  - Correct display of inferred types in schema type cell and modal

#### Improved
- **Debug Logging**:
  - Detailed logging for MerchantListing detection (shows missing fields)
  - Informational messages downgraded from `warn` to `info` level
  - Better console output for troubleshooting

#### Technical Details
- `detectInferredTypes()` function analyzes all schema nodes to identify implicit types
- `formatSchemaTypesWithInferred()` function formats inferred types with visual differentiation
- `detectMerchantListing()` function checks for Merchant Center compliance fields
- `findAllJsonLdScripts()` helper function expands JSON-LD detection coverage
- `decodeHTML()` helper function handles HTML entity decoding

## [1.4.0] - 2024-01-XX

### Code Quality Improvements
- **Refactored all functions** to reduce cognitive complexity below 15 (SonarLint requirement)
- **Modernized JavaScript syntax**:
  - Replaced `window` with `globalThis` (5 occurrences)
  - Converted `.forEach()` loops to `for...of` loops (19 occurrences)
  - Replaced `removeChild()` with `.remove()` method (5 occurrences)
  - Replaced `JSON.parse(JSON.stringify())` with `structuredClone()` (2 occurrences)
- **Improved error handling**:
  - Added proper exception logging to all catch blocks (6 occurrences)
  - Replaced silent catch blocks with `console.warn()` or `console.error()`
- **Code readability improvements**:
  - Extracted nested ternary operations into independent statements (3 occurrences)
  - Removed unnecessary escape characters in regex patterns (3 occurrences)
  - Fixed redundant variable assignments (3 occurrences)
  - Converted simple `for` loop to `for...of` (1 occurrence)
- **Accessibility improvements**:
  - Added `title` attributes to select elements for better screen reader support
- **Function refactoring**:
  - Extracted helper functions to reduce complexity
  - Improved function organization and maintainability

### Technical Details
- All functions now meet SonarLint cognitive complexity requirements (≤15)
- Improved cross-platform compatibility with `globalThis`
- Better performance with `for...of` loops instead of `.forEach()`
- Modern DOM manipulation with `.remove()` instead of `removeChild()`
- Proper deep cloning with `structuredClone()` instead of JSON serialization

## [1.3.0] - Previous Release

### Added
- Supabase integration for storing validation results
- Manual status input dropdowns for Google and Schema.org validators
- Notes textarea for each validation result
- "Save to Supabase" button functionality
- Toast notifications for save success/failure
- Automatic storage of schema JSON and validation metadata

## [1.2.1] - Previous Release

### Added
- Template CSV download button for easy setup
- Real-time progress indicators during validation
- Enhanced schema generation with @graph support for multiple schemas
- Downloads both JSON and HTML script tag formats
- Improved UI with status badges and better error handling
- Better table rendering with processing status updates

## [1.2.0] - Previous Release

### Added
- HTML UI for bulk validator (browser-based CSV upload)
- Schema validation capabilities in unified generator
- Bulk URL validation from CSV

## [1.0.0] - Initial Release

### Added
- Unified schema generator combining event and product generators
- Event schema generation from CSV
- Product schema generation from CSV
- Basic validation functionality




