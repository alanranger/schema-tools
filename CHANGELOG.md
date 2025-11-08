# Changelog

All notable changes to the Schema Tools project will be documented in this file.

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



