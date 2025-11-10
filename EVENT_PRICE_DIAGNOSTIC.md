# Event Price Extraction - Diagnostic Report

## 🔍 Root Cause Analysis

### Current Price Extraction Logic (Line 6903-6905)

```javascript
const useMappingPrice = mappingData && mappingData.price;
const useMappingAvailability = mappingData && mappingData.availability;
const eventPrice = useMappingPrice ? parseFloat(mappingData.price) : parseFloat(event['Price'] || 0);
```

### Price Source Priority:
1. **First:** `mappingData.price` (from mappings CSV - columns: `price_gbp` or `json_price`)
2. **Fallback:** `event['Price']` (from events CSV)
3. **Default:** `0` (if both are missing/null)

### Why 27 Events Show Price = 0

**Scenario A: Missing Mappings Entries**
- Event URL doesn't exist in mappings CSV
- `mappingData` is `null` or `undefined`
- Falls back to `event['Price']` from events CSV
- If `event['Price']` is empty/null → defaults to `0`

**Scenario B: Empty Price Column in Events CSV**
- Events CSV `Price` column is empty/null for those 27 events
- Even if mappings exist, if `mappingData.price` is null, falls back to CSV
- CSV has no price → defaults to `0`

**Scenario C: Mappings CSV Missing Price Data**
- Mappings CSV has entries but `price_gbp` and `json_price` are both null/empty
- `mappingData.price` is `null`
- Falls back to events CSV `Price` column
- If CSV also empty → defaults to `0`

## 🔎 Investigation Needed

### Check 1: Mappings CSV Coverage
- How many events have entries in mappings CSV?
- Do the 27 events with missing offers have mappings entries?
- Are `price_gbp` and `json_price` columns populated?

### Check 2: Events CSV Price Column
- Does events CSV have a `Price` column?
- Are prices populated for all events?
- What format are prices in? (e.g., "£50.00", "50.00", "50")

### Check 3: Products CSV Connection
- User says all events have prices in `products_cleaned.xlsx`
- Events need to be matched to products to get prices
- Current code doesn't directly read from products CSV
- Mappings CSV is supposed to bridge events → products, but may be incomplete

## 💡 Likely Root Cause

**Most Likely:** The 27 events don't have entries in the mappings CSV, OR the mappings CSV entries don't have price data (`price_gbp` and `json_price` are both null).

**Secondary Issue:** Events CSV `Price` column may be missing or empty for those events.

**Solution Needed:** 
1. Match events directly to products CSV using URL matching
2. Extract price from products CSV `Price` column (or from offers JSON)
3. Use products CSV as primary source, mappings CSV as secondary, events CSV as last resort

## 📋 Recommended Fix Strategy

1. **Add Products CSV Upload** to Event Schema tab
2. **Build Products Dictionary** from products CSV: `{ product_url: { price, sku, ... } }`
3. **Match Event URL → Product URL** (via mappings CSV or direct URL matching)
4. **Extract Price Priority:**
   - Products CSV (from matched product)
   - Mappings CSV (`price_gbp` or `json_price`)
   - Events CSV (`Price` column)
   - Default: Log warning, don't add offers (or add with price: "0.00" for free events)

5. **Always Add Offers** - Even if price is 0, add offers with `price: "0.00"` and `isAccessibleForFree: true`


