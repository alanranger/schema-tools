# Event Schema Issues - Analysis & Solutions

## 🔍 Issues Identified

### 1. Missing 'offers' Field (27 events)
**Problem:** Events with price = 0 or missing price don't get offers added.
**Current Code:** Line 6990 - `if (eventPrice > 0)` condition prevents offers for free events.
**Google Requirement:** ALL events need offers, even free ones (price: "0.00").

### 2. Invalid Fields for Pure Event Schema
**Problem:** Event schema generator creates pure `"@type": "Event"` instead of `["Product", "Event"]` hybrid.
**Invalid Fields Currently Added:**
- `sku` (line 7054) - Only valid for Product
- `brand` (line 7057) - Only valid for Product  
- `thumbnailUrl` (line 6934) - Not valid for Event
- `eventType` (line 6976) - Not valid for Event
- `material` (line 6977) - Not valid for Event
- `courseMode` (line 6982) - Not valid for Event
- `isFamilyFriendly` - Not valid for Event
- `aggregateRating` (line 7064) - Only valid for Product

### 3. SKU Source Issue
**Problem:** SKU is extracted from product URL slug (line 6196), but should come from products_cleaned.xlsx `main_sku` column.
**Current:** `const sku = productSlug.toUpperCase().replace(/-/g, '-').replace(/[^A-Z0-9-]/g, '');`
**Should Be:** Read from products CSV file `main_sku` column (like product generator does).

### 4. Offers Missing SKU
**Problem:** Offers object doesn't include SKU field (required for Product+Event hybrid).
**Current:** Offers only has price, priceCurrency, availability, url, validFrom, seller.
**Required:** Offers should include `sku` field (max 40 chars).

## ✅ Solutions

### Solution 1: Change to Product+Event Hybrid Schema
**Change:** Line 6927 from `"@type": "Event"` to `"@type": ["Product", "Event"]`
**Benefit:** Makes SKU, brand, aggregateRating valid (they're Product fields).

### Solution 2: Always Add Offers (Even Free Events)
**Change:** Line 6990 - Remove `if (eventPrice > 0)` condition, always add offers.
**For free events:** Set `price: "0.00"` and `isAccessibleForFree: true`.

### Solution 3: Remove Invalid Event-Only Fields
**Remove:**
- `thumbnailUrl` (line 6934) - Use `image` only
- `eventType` (line 6976) - Not valid
- `material` (line 6977) - Not valid  
- `courseMode` (line 6982) - Not valid

**Keep but move to Product part:**
- `sku` - Valid in Product+Event
- `brand` - Valid in Product+Event
- `aggregateRating` - Valid in Product+Event

### Solution 4: Add SKU to Offers
**Add:** `sku` field to offers object (line 6992-7004).
**Source:** From products_cleaned.xlsx `main_sku` column (via mappings or direct lookup).

### Solution 5: Load Products CSV for SKU Lookup
**Option A:** Add products_cleaned.xlsx upload to Event Schema tab.
**Option B:** Use existing mappings CSV to get SKU (if available).
**Option C:** Match event URL to product URL and extract SKU from products CSV.

## 📋 Implementation Plan

1. **Change @type to Product+Event hybrid** (Line 6927)
2. **Always add offers** - Remove price > 0 condition (Line 6990)
3. **Add SKU to offers** - Include in offers object (Line 6992-7004)
4. **Remove invalid fields** - thumbnailUrl, eventType, material, courseMode
5. **Add products CSV upload** - For SKU lookup (if needed)
6. **Update SKU extraction** - Use products CSV main_sku column instead of URL slug

## 🔗 Schema.org Reference

- **Event Schema:** https://schema.org/Event
- **Product Schema:** https://schema.org/Product
- **Offer Schema:** https://schema.org/Offer
- **Product+Event Hybrid:** Valid - allows Product fields (SKU, brand) + Event fields (startDate, location)

## ⚠️ Important Notes

- Product+Event hybrid is CORRECT for workshops/courses (they're both products AND events)
- SKU belongs in Product part, not Event part
- Offers must always be present (Google requirement)
- Free events need `price: "0.00"` + `isAccessibleForFree: true`


