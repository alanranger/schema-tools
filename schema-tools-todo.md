# 📋 Schema Tools — Unified Generator TODO List

This file outlines the current state, goals, and key implementation tasks for Cursor AI to complete the unified schema generator tool for events and products.

---

## ✅ Current Tools

### 1. `html-tools/event-schema-generator-v3-FINAL-address-fixed.html`
- Accepts event CSVs and generates valid `Event` + `ItemList` JSON-LD.
- Includes `image`, `organizer`, `location.address`, and `offers.validFrom`.

### 2. `html-tools/product-schema-generator-v4-alanranger-WORKFLOW-UPDATED.html`
- Accepts cleaned Squarespace product CSVs.
- Supports Trustpilot review matching by `Product ID`.
- Outputs `Product` JSON-LD with `aggregateRating`, `offers`, `shippingDetails`, `brand`, etc.

---

## 🎯 Goal

Build a **single HTML tool** that can:
- Accept both event and product CSVs
- Let user toggle between Event and Product modes
- Output correct JSON-LD markup
- Optionally test results via live URL validation on:
  - https://validator.schema.org/
  - https://search.google.com/test/rich-results

---

## ✅ Tasks for Cursor AI

### 🔧 UI/Logic

- [x] Create a dropdown to choose between "Event" or "Product" mode
- [x] Show different input fields based on selected mode
- [x] Parse either event or product CSV based on context
- [x] Generate correct structured data output
- [x] Add a button to copy output to clipboard

### 🎯 Current Status

**✅ Schema Validator Tab - COMPLETE (v1.5.2)**
- Inferred schema type detection (Carousel, ReviewSnippet, MerchantListing)
- Enhanced JSON-LD detection (Squarespace patterns, noscript tags)
- MerchantListing badge with green background and white checkmark
- Improved duplicate detection for multi-instance types
- Supabase RLS policy fixes
- Comprehensive schema details modal

**✅ Electron Desktop App - COMPLETE (v1.5.2)**
- Step 0 - Initialize Local Executor (pre-flight check)
- Auto-starts local server on Electron launch
- Fully automated workflow (Steps 1 → 2 → 3a → 3b → 4)
- No manual terminal commands needed
- Packageable as `.exe` for Windows

**✅ Event Schema Generator - COMPLETE (v4.3.1)**
- [x] Product+Event hybrid schema (`["Product", "Event"]`)
- [x] SKU extraction from products Excel file (`02 – products_cleaned.xlsx`)
- [x] Enhanced review matching with 3 strategies
- [x] Review threshold lowered to >=1 review
- [x] Provider property removed (not valid for Event schema)
- [x] Missing offers issue resolved (always add offers, even if price = 0)
- [x] EventSeries detection and backlinking (v4.2/v4.3)
- [x] UI guidance improvements with file upload instructions
- [x] Enhanced debug logging for review matching
- [x] All validation warnings resolved (0 errors, 0 warnings)
- [x] Automated workflow (Steps 1 → 2 → 3a → 3b → 4)
- [x] URL validation with 404 checking
- [x] Schema Suppressor v1.3 integration
- [x] Unique slug generation from product names
- [x] Correct breadcrumb generation from URL paths
- [x] v6.1 baseline schema structure (Product/Course only, no Event fields)
- [x] Comprehensive validation hooks

---

### 🌍 SEO Validator Integration

- [x] Add input field for a live URL (optional)
- [x] Use API or form submission to test that URL with:
  - [x] [Schema.org Validator](https://validator.schema.org)
  - [x] [Google Rich Results Test](https://search.google.com/test/rich-results)
- [x] Display test result summary or link to full results

---

### 📊 Bulk Schema Validator

- [x] Create `csv-schema-validator.js` module
- [x] Parse uploaded CSV (Column: `URL`, `Link`, or `Website`)
- [x] For each URL:
  - [x] Use Puppeteer/fetch to get HTML
  - [x] Extract all `<script type="application/ld+json">` blocks
  - [x] Determine schema `@type` (e.g. Event, Product, etc.)
  - [x] Log missing required and recommended fields per schema type
  - [x] Return summary: `Valid`, `Missing`, `Warnings`, etc.
- [x] Generate validator links for Schema.org and Google Rich Results
- [x] Output results as JSON or readable text summary
- [x] Add documentation to README.md

---

### 📊 Bulk Schema Validator

- [x] Create `csv-schema-validator.js` module
- [x] Parse uploaded CSV (Column: `URL`, `Link`, or `Website`)
- [x] For each URL:
  - [x] Use Puppeteer/fetch to get HTML
  - [x] Extract all `<script type="application/ld+json">` blocks
  - [x] Determine schema `@type` (e.g. Event, Product, etc.)
  - [x] Log missing required and recommended fields per schema type
  - [x] Return summary: `Valid`, `Missing`, `Warnings`, etc.
- [x] Generate validator links for Schema.org and Google Rich Results
- [x] Output results as JSON or readable text summary
- [x] Add documentation to README.md

---

### 🔧 Schema Enhancement Agent

- [x] Create `schema-enhancer.js` module
- [x] Accept validation results JSON file as input
- [x] Identify schema types from validation results
- [x] Generate enhanced JSON-LD with missing fields filled
- [x] Add placeholders for fields requiring manual input
- [x] Infer values from page URL when possible
- [x] Support export in JSON format
- [x] Support export as HTML script tags (ready for Squarespace)
- [x] Track what fields were added/modified
- [x] Support single URL enhancement (fetches fresh data)
- [x] Create Supabase schema design document (optional)
- [x] Add documentation to README.md

**Limitations:**
- Cannot automatically infer all field values (requires manual review)
- Placeholders must be replaced with actual data before deployment

---

### 🗃️ Supabase Integration (COMPLETE v1.3.0)

- [x] Create `schema_audit_logs` table in Supabase
- [x] Add Supabase JS client library to HTML tool
- [x] Configure Supabase credentials (URL and anonymous key)
- [x] Add status dropdowns for Google and Schema.org validators
- [x] Add notes textarea for each validation result
- [x] Implement "Save to Supabase" button functionality
- [x] Store validation results with all metadata
- [x] Toast notifications for save success/failure
- [x] Console logging for debugging
- [x] Update documentation (README.md and handover-cursor-ai.md)

**Table Schema:**
- `url` (text) - Validated page URL
- `timestamp` (timestamptz) - Validation timestamp
- `validator_google_status` (text) - Google Rich Results status
- `validator_schemaorg_status` (text) - Schema.org validator status
- `schema_type_detected` (text) - Detected schema types
- `schema_json_raw` (jsonb) - Raw schema JSON from page
- `schema_notes` (text) - Manual notes

---

### ✅ Schema Validator Tab (COMPLETE v1.5.2)

- [x] Add HTML UI for bulk validator (browser-based CSV upload) - **COMPLETED v1.2.0**
- [x] Add progress bar for bulk validation - **COMPLETED v1.2.1**
- [x] Template CSV download for easy setup - **COMPLETED v1.2.1**
- [x] Enhanced schema generation with multiple schema support - **COMPLETED v1.2.1**
- [x] Dual format downloads (JSON + HTML) - **COMPLETED v1.2.1**
- [x] Code quality improvements and refactoring - **COMPLETED v1.4.0**
  - Reduced cognitive complexity to ≤15 for all functions
  - Modernized JavaScript syntax (globalThis, for...of, structuredClone)
  - Improved error handling and accessibility
  - Enhanced code maintainability
- [x] **Inferred schema type detection** - **COMPLETED v1.5.0**
  - Carousel detection (from ≥3 Event items or Product/Course schemas)
  - ReviewSnippet detection (from aggregateRating, review, reviews fields)
  - MerchantListing (Google) detection (from Product schemas with Merchant Center fields)
- [x] **MerchantListing badge styling** - **COMPLETED v1.5.0**
  - Green background badge with white checkmark
  - Compact design to prevent column width issues
- [x] **Enhanced JSON-LD detection** - **COMPLETED v1.5.0**
  - Squarespace pattern support (`script[data-type="application/ld+json"]`)
  - Nested `<noscript>` tag detection
  - HTML entity decoding for proper JSON parsing
- [x] **Improved duplicate detection** - **COMPLETED v1.5.0**
  - Multi-instance allowed types (Event, Product, Course, Article, Review, FAQPage, ListItem, Offer)
  - Informational messages for expected multi-instance schemas
  - Accurate duplicate counting excluding multi-instance types
- [x] **Supabase RLS policy fixes** - **COMPLETED v1.5.0**
  - Fixed Row-Level Security policies for `anon` and `authenticated` roles
  - Improved error handling for auto-save operations
- [x] **Electron Desktop App** - **COMPLETED v1.5.2**
  - Step 0 pre-flight check for local executor
  - Auto-start local server in Electron mode
  - Fully automated workflow execution
  - Packageable as `.exe` for Windows
- [ ] Add CSV pre-cleaning checks: invalid rows, missing `Product ID`, etc.
- [ ] Show warning if CSV has invalid/missing fields
- [ ] Allow user to preview JSON-LD block in a collapsible box
- [ ] Support for Microdata validation
- [ ] Export validation results to CSV/Excel
- [ ] Add batch enhancement for all URLs at once
- [ ] Add filtering/sorting options in results table
- [ ] Change filter inputs to dropdowns with actual field values

- [x] Add HTML UI for bulk validator (browser-based CSV upload) - **COMPLETED v1.2.0**
- [x] Add progress bar for bulk validation - **COMPLETED v1.2.1**
- [x] Template CSV download for easy setup - **COMPLETED v1.2.1**
- [x] Enhanced schema generation with multiple schema support - **COMPLETED v1.2.1**
- [x] Dual format downloads (JSON + HTML) - **COMPLETED v1.2.1**
- [x] Code quality improvements and refactoring - **COMPLETED v1.4.0**
  - Reduced cognitive complexity to ≤15 for all functions
  - Modernized JavaScript syntax (globalThis, for...of, structuredClone)
  - Improved error handling and accessibility
  - Enhanced code maintainability
- [x] **Inferred schema type detection** - **COMPLETED v1.5.0**
  - Carousel detection (from ≥3 Event items or Product/Course schemas)
  - ReviewSnippet detection (from aggregateRating, review, reviews fields)
  - MerchantListing (Google) detection (from Product schemas with Merchant Center fields)
- [x] **MerchantListing badge styling** - **COMPLETED v1.5.0**
  - Green background badge with white checkmark
  - Compact design to prevent column width issues
- [x] **Enhanced JSON-LD detection** - **COMPLETED v1.5.0**
  - Squarespace pattern support (`script[data-type="application/ld+json"]`)
  - Nested `<noscript>` tag detection
  - HTML entity decoding for proper JSON parsing
- [x] **Improved duplicate detection** - **COMPLETED v1.5.0**
  - Multi-instance allowed types (Event, Product, Course, Article, Review, FAQPage, ListItem, Offer)
  - Informational messages for expected multi-instance schemas
  - Accurate duplicate counting excluding multi-instance types
- [x] **Supabase RLS policy fixes** - **COMPLETED v1.5.0**
  - Fixed Row-Level Security policies for `anon` and `authenticated` roles
  - Improved error handling for auto-save operations
- [ ] Add CSV pre-cleaning checks: invalid rows, missing `Product ID`, etc.
- [ ] Show warning if CSV has invalid/missing fields
- [ ] Allow user to preview JSON-LD block in a collapsible box
- [ ] Support for Microdata validation
- [ ] Export validation results to CSV/Excel
- [ ] Add batch enhancement for all URLs at once
- [ ] Add filtering/sorting options in results table
- [ ] Change filter inputs to dropdowns with actual field values

---

## ⚠️ DOs and DON’Ts

| ✅ DO                                     | ❌ DON’T                                           |
|------------------------------------------|----------------------------------------------------|
| Keep schema types minimal but complete   | Don’t generate untested or unstructured blocks     |
| Separate Event and Product logic cleanly | Don’t overlap fields between types                 |
| Use trusted reviews from real sources    | Don’t insert fabricated reviews or fake ratings    |
| Validate with both schema.org and Google | Don’t assume one validator is enough               |

---

## 📁 Folder Structure

Refer to `schema_tools_folder_structure.txt` for current layout.

