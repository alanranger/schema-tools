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

- [ ] Create a dropdown to choose between “Event” or “Product” mode
- [ ] Show different input fields based on selected mode
- [ ] Parse either event or product CSV based on context
- [ ] Generate correct structured data output
- [ ] Add a button to copy output to clipboard

---

### 🌍 SEO Validator Integration

- [ ] Add input field for a live URL (optional)
- [ ] Use API or form submission to test that URL with:
  - [ ] [Schema.org Validator](https://validator.schema.org)
  - [ ] [Google Rich Results Test](https://search.google.com/test/rich-results)
- [ ] Display test result summary or link to full results

---

### 🧪 Optional Enhancements

- [ ] Add CSV pre-cleaning checks: invalid rows, missing `Product ID`, etc.
- [ ] Show warning if CSV has invalid/missing fields
- [ ] Allow user to preview JSON-LD block in a collapsible box

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

