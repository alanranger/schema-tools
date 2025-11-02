# Cursor AI Handover Notes: Schema Generator Tool

## Objective

This project builds browser-based tools to generate Google-compliant JSON-LD schema for:
- Products (with pricing, availability, reviews)
- Events (with dates, locations, performer, address)

It supports batch generation from CSV inputs and is tailored for Squarespace manual injection.

## Current Tools

### ✅ `product-schema-generator-v4-alanranger-WORKFLOW-UPDATED.html`
- Fully working UI
- Review integration logic (basic)
- Explains workflow inside UI

### ✅ `event-schema-generator-v3-FINAL-address-fixed.html`
- Accepts structured CSV input for events
- Injects fixed location, organizer, image
- Outputs valid Event + ItemList blocks

### ✅ `unified-schema-generator.html` (COMPLETE)
- Combines both generators into one file with tabbed interface
- Three tabs:
  - Event Schema Generator
  - Product Schema Generator  
  - Schema Validator (NEW!) - validates URLs from CSV, detects schema types, identifies missing fields, and generates enhanced schemas
- Includes built-in validation and enhancement logic
- Works entirely in browser (no server required)

## Goals for Next Tool Phase

✅ **COMPLETED:**
- Schema validation (built into unified generator)
- Bulk URL validation from CSV
- Schema enhancement with missing fields

### 🚀 Future Enhancements:
- Add cleanup and review-merging to CSV uploads
- Crawl live Squarespace URLs to ensure correct schema placement and detect outdated/incomplete pages
- Add progress indicators for large CSV files
- Export validation results to Excel/CSV format
- Add HTML UI for schema enhancer (currently CLI only)

## Folder Map

- `html-tools/` → Browser tools (HTML generators)
- `inputs-csv-files/` → CSV inputs (products, events, reviews)
- `js/` → Review data for Trustpilot/Squarespace widgets
- `readme-and-docs/` → README and handover notes

## Pitfalls to Avoid

- ❌ Do not paste all product schema into one page — each schema must match the product or event page
- ❌ Do not include reviews unless merged properly (review count must match)
- ⚠️ Keep CSV formats clean and mapped (column names must match expectations)

## Do's and Don'ts

✅ Use only relevant schema on each Squarespace product/event page  
✅ Confirm the review count and rating match what’s publicly visible  
✅ Use Google's tools to verify everything is indexed correctly  
✅ Keep your files versioned and backed up (use GitHub)  
❌ Don’t re-use stale review data across unrelated products

---