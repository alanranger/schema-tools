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
- Supabase integration not yet implemented (schema design provided)

---

### 🧪 Optional Enhancements

- [x] Add HTML UI for bulk validator (browser-based CSV upload) - **COMPLETED v1.2.0**
- [x] Add progress bar for bulk validation - **COMPLETED v1.2.1**
- [x] Template CSV download for easy setup - **COMPLETED v1.2.1**
- [x] Enhanced schema generation with multiple schema support - **COMPLETED v1.2.1**
- [x] Dual format downloads (JSON + HTML) - **COMPLETED v1.2.1**
- [ ] Add CSV pre-cleaning checks: invalid rows, missing `Product ID`, etc.
- [ ] Show warning if CSV has invalid/missing fields
- [ ] Allow user to preview JSON-LD block in a collapsible box
- [ ] Support for Microdata validation
- [ ] Export validation results to CSV/Excel
- [ ] Add batch enhancement for all URLs at once
- [ ] Add filtering/sorting options in results table

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

