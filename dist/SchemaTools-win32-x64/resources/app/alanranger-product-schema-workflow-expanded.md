# Alan Ranger Product Schema Generation Workflow (Expanded)

This document outlines the complete workflow to create valid Product Schema for Squarespace pages with optional review data.

---

## 🟦 Step 1: Export from Squarespace Products & Services

**Filename:** `products_Nov-02_11-15-24AM.csv`

- Export all services/products from Squarespace → Commerce → Products → Export.
- File includes product name, type, image, price, etc.
- Note: Variants are included as extra rows (not needed for schema).

---

## 🟦 Step 2: Clean Product File for Unique Products

**Filename:** `products_Jul-21_01-43-36PM cleaned.xlsx`

- Remove all non-product rows (e.g. variants).
- Keep only unique rows with valid product titles and one primary image.
- Extract essential columns: `Product Name`, `Product ID`, `Image`, `URL`, `Price`.

---

## 🟨 Step 3: Inject Review Data

**Filename:** `products_with_review_data_final.xlsx`

- Review data gathered manually or via OCR from Squarespace product pages.
- Only reviews **4★ or higher** are retained.
- Each product matched by name/title.
- New columns added:
  - `Review Count`, `Average Rating`, `Parsed Reviews` (JSON-ready)

---

## 🟥 Step 4: Generate Schema

**Filename:** `alanranger_product_schema_FINAL_WITH_REVIEW_RATINGS.xlsx`

- Generates valid Product schema block per row.
- Includes all required attributes and optional ratings/reviews.
- ✅ **Automatically includes Schema Suppressor v1.3** - removes duplicate Squarespace Product schemas
- Output available in Excel or using HTML generator tool.
- Each HTML file includes:
  1. Schema Suppressor v1.3 block (at the top)
  2. Unified JSON-LD schema block (LocalBusiness → BreadcrumbList → Product/Course)

---

## ✅ Step 5: Paste into Squarespace

- Use either:
  - **Header Code Injection** (Page Settings → Advanced)
  - OR a **Code Block** directly in the product body
- ⚠️ Only paste the schema that matches that product on its product page.

---

## Summary Diagram

```
Step 1: Export Squarespace CSV → products_Nov-02_11-15-24AM.csv
     ↓
Step 2: Clean rows → products_Jul-21_01-43-36PM cleaned.xlsx
     ↓
Step 3: Add reviews (filtered) → products_with_review_data_final.xlsx
     ↓
Step 4: Generate Schema → alanranger_product_schema_FINAL_WITH_REVIEW_RATINGS.xlsx
     ↓
Step 5: Paste into Squarespace on the correct product page
```