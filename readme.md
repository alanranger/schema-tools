
---

## 🛠️ Main Tools

### 1. `html-tools/event-schema-generator-v2-fixed-FINAL.html`
- Accepts an exported CSV of events (e.g. workshops).
- Allows filtering by category (1-day, 2+ days, etc.)
- Outputs valid `Event` + `ItemList` JSON-LD.
- Includes: `image`, `organizer`, `location.address`, `offers.validFrom`.

### 2. `html-tools/product-schema-generator-v1-FINAL.html`
- Accepts cleaned Squarespace product CSV.
- Adds optional Trustpilot reviews via `Product ID`.
- Outputs `Product` schema including `aggregateRating`, `shippingDetails`, `offers`, `brand`, etc.

---

## 📦 Workflow

### Step 1: Export Raw Product Data
- From Squarespace: Export all products to CSV.
  - Filename format: `products_YYYY-MM-DD_HH-MM-SS.csv`

### Step 2: Clean CSV (not yet automated)
- Remove:
  - Variants (rows without `Product ID`)
  - Inactive products
- Add:
  - Trusted review data (match by `Product ID` from Trustpilot)

➡️ Clean file should go into `/inputs-csv-files/`  
➡️ Matching review file should go into `/data/` or same folder.

### Step 3: Open Product Schema Generator
- Load cleaned CSV in `product-schema-generator.html`
- Generates `Product` schema for each item.
- Copy only **one schema block** into each **relevant product page** in Squarespace.

> ⚠️ **Important**:  
> Do **not** paste all product schemas into all products.  
> Each Squarespace product page should include **only its own schema block**.

---

## 🧪 Review Inspector Tool (Planned)
This will:
- Let you upload Trustpilot CSV reviews
- Match `Reference Id` to products
- Calculate star ratings, count, extract review excerpts
- Let you select which reviews to inject
- Output `aggregateRating` + `review` objects per product

---

## ✅ Status
- [x] Product Schema Generator – working
- [x] Event Schema Generator – working
- [x] Trustpilot JS Parser – done
- [ ] CSV cleaning tool – planned
- [ ] Review Inspector Tool – planned

---

## 👤 Author
Alan Ranger  
www.alanranger.com

---

