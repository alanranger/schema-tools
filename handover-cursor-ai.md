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

### ✅ `index.html` (Unified Schema Generator - v1.5.0)
- Combines both generators into one file with tabbed interface
- Three tabs:
  - **Event Schema Generator** (🚧 In Development)
  - **Product Schema Generator** (🚧 In Development)
  - **Schema Validator** ✅ Complete - validates URLs from CSV, detects schema types, identifies missing fields, generates enhanced schemas, and detects inferred types
- Includes built-in validation and enhancement logic
- Works entirely in browser (no server required)
- **Schema Validator Tab (v1.5.0 - Complete):**
  - ✅ Inferred schema type detection (Carousel, ReviewSnippet, MerchantListing)
  - ✅ Enhanced JSON-LD detection (Squarespace patterns, noscript tags)
  - ✅ MerchantListing badge with green background and white checkmark
  - ✅ Improved duplicate detection for multi-instance types
  - ✅ Supabase RLS policy fixes
  - ✅ Comprehensive schema details modal
- **Previous Versions:**
  - **v1.2.1**: Template CSV download, progress indicators, @graph support, dual format downloads
  - **v1.3.0**: Supabase integration, manual status input, notes capture
  - **v1.4.0**: Code quality improvements (cognitive complexity ≤ 15, modernized syntax, better error handling)

## Current Status

✅ **Schema Validator Tab - COMPLETE (v1.5.0):**
- Schema validation (built into unified generator)
- Bulk URL validation from CSV
- Schema enhancement with missing fields
- Template CSV download for validator
- Real-time progress indicators
- Multiple schema support (@graph structure)
- Dual format downloads (JSON + HTML script tags)
- **Inferred schema type detection** (Carousel, ReviewSnippet, MerchantListing)
- **Enhanced JSON-LD detection** (Squarespace patterns, noscript tags)
- **MerchantListing badge** with green background and white checkmark
- **Improved duplicate detection** for multi-instance types
- **Supabase RLS policy fixes**

🚧 **Next Phase - Events & Products Tabs:**
- Complete Events tab functionality
- Complete Products tab functionality
- Ensure both tabs match the quality and features of the validation tab

### 🗃️ Supabase Integration (COMPLETE)
- **Table**: `schema_audit_logs` created and configured
- **Fields**: url, timestamp, validator_google_status, validator_schemaorg_status, schema_type_detected, schema_json_raw, schema_notes
- **Features**:
  - Browser-based saves using Supabase JS client
  - Manual status input for validators
  - Notes capture
  - Automatic schema JSON storage
  - Toast notifications for user feedback
- **Credentials**: Configured in unified-schema-generator.html
- **Usage**: Click "Save to Supabase" button after setting validation status and notes

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