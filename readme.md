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

### 3. `unified_schema_generator.html` (Experimental)
- Combines both tools into one UI.
- Designed for future expansion with automatic validation and page scanning.

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

## Notes

- You must not inject multiple schema blocks on unrelated pages. Only paste the matching product’s schema on its correct Squarespace page.
- Be sure to test all generated schema using:
  - https://validator.schema.org
  - https://search.google.com/test/rich-results

---