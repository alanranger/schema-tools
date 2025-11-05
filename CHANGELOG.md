# Changelog

All notable changes to the Schema Tools project will be documented in this file.

## [1.5.0] - 2024-11-05

### Schema Validator Tab Enhancements

#### Added
- **Inferred Schema Type Detection**:
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



