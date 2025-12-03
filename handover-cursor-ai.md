# Cursor AI Handover Notes: Schema Generator Tool

## Objective

This project builds browser-based tools to generate Google-compliant JSON-LD schema for:
- Products (with pricing, availability, reviews)
- Events (with dates, locations, performer, address)

It supports batch generation from CSV inputs and is tailored for Squarespace manual injection.

## Cursor Instruction — Standard Schema Injection Policy (v6.2)

### Objective:
Ensure every generated product HTML file includes, at the very top of the `<head>`, a self-contained Squarespace Product Schema Suppressor v1.3 block followed by the unified LocalBusiness → BreadcrumbList → Product/Course JSON-LD schema structure exactly as shown.

### Implementation Requirements:

1. **Insert the v1.3 suppressor `<script>` block before any JSON-LD in the HTML output.**
2. **Keep it as a distinct block, separated by at least one line break, and do not merge it into the main schema script.**
3. **Always preserve the header comment:**
   ```html
   <!-- Squarespace Product Schema Suppressor v1.3 (Code-Block Safe) -->
   ```
   This acts as a unique marker for later updates or removals.
4. **Ensure the main schema block immediately follows the suppressor block.**
5. **Never minify or alter the suppressor script.**
6. **Never inject duplicate copies — check for the marker before adding.**

### Optional Diagnostic Check:

After build, scan final HTML for:
```bash
grep -R "<!-- Squarespace Product Schema Suppressor v1.3" dist/
```
and ensure it appears exactly once per file.

### Outcome:

Each product page starts with:
1. The suppressor block
2. The unified JSON-LD schema block
3. No duplicate Product schema detected in Google's Rich Results Test

### Current Implementation:

- **Location**: `partials/schema-suppressor-v1.3.html`
- **Integration**: `scripts/generate-product-schema.py` → `schema_to_html()` function
- **Caching**: Suppressor block loaded once at module level (not per product)
- **Logging**: Shows "✅ Schema suppressor v1.3 loaded" once at start of Step 4

---

## Current Tools

### ✅ `product-schema-generator-v4-alanranger-WORKFLOW-UPDATED.html`
- Fully working UI
- Review integration logic (basic)
- Explains workflow inside UI

### ✅ `event-schema-generator-v3-FINAL-address-fixed.html`
- Accepts structured CSV input for events
- Injects fixed location, organizer, image
- Outputs valid Event + ItemList blocks

### ✅ `index.html` (Unified Schema Generator - v1.5.2)
- Combines both generators into one file with tabbed interface
- Three tabs:
  - **Event Schema Generator** (🚧 In Development)
  - **Product Schema Generator** (🚧 In Development)
  - **Schema Validator** ✅ Complete - validates URLs from CSV, detects schema types, identifies missing fields, generates enhanced schemas, and detects inferred types
- Includes built-in validation and enhancement logic
- Works entirely in browser (no server required)
- **Schema Validator Tab (v1.5.2 - Complete):**
  - ✅ Inferred schema type detection (Carousel, ReviewSnippet, MerchantListing)
  - ✅ Enhanced JSON-LD detection (Squarespace patterns, noscript tags)
  - ✅ MerchantListing badge with green background and white checkmark
  - ✅ Improved duplicate detection for multi-instance types
  - ✅ Supabase RLS policy fixes
  - ✅ Comprehensive schema details modal
- **Electron Desktop App (v1.5.2 - New):**
  - ✅ Step 0 - Initialize Local Executor (pre-flight check)
  - ✅ Auto-starts local server in Electron mode
  - ✅ Fully automated workflow execution
  - ✅ No manual terminal commands needed
  - ✅ Packageable as `.exe` for Windows
- **Previous Versions:**
  - **v1.2.1**: Template CSV download, progress indicators, @graph support, dual format downloads
  - **v1.3.0**: Supabase integration, manual status input, notes capture
  - **v1.4.0**: Code quality improvements (cognitive complexity ≤ 15, modernized syntax, better error handling)
  - **v1.5.0**: Inferred schema types, enhanced JSON-LD detection, MerchantListing badge
  - **v1.5.1**: Electron desktop app setup with auto-starting server
  - **v1.5.2**: Step 0 pre-flight check, improved browser compatibility

## Current Status

✅ **Schema Validator Tab - COMPLETE (v1.5.2):**
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

✅ **Electron Desktop App - COMPLETE (v1.5.2):**
- Step 0 pre-flight check for local executor
- Auto-starts local server in Electron mode
- Fully automated workflow execution (Steps 1 → 2 → 3a → 3b → 4)
- No manual terminal commands needed
- Packageable as `.exe` for Windows
- Vercel build compatibility (skips Electron builds for web)

## ⚠️ CRITICAL: Electron App Build Process - MANDATORY READING

**THIS IS A CRITICAL WORKFLOW REQUIREMENT - FAILURE TO FOLLOW THIS CAUSED HOURS OF DEBUGGING**

### The Problem

The Electron app runs a **packaged version** that is built from source code. The user does NOT run the source files directly. They run a packaged `.exe` file located at `%LOCALAPPDATA%\SchemaTools\SchemaTools-win32-x64\SchemaTools.exe`.

### The Build Process

1. **Source Code**: All source files are in the project root:
   - `index.html` (main UI and logic)
   - `main.js` (Electron main process)
   - `preload.js` (Electron preload script)
   - Other source files

2. **Build Command**: The packaged app is built using:
   - `npm run build:desktop` OR
   - `Open-PowerShell-Here.bat` file (downloaded from Product Schema tab)

3. **Build Output**: The build process uses `electron-packager` to:
   - Copy ALL source files to `%LOCALAPPDATA%\SchemaTools\SchemaTools-win32-x64\resources\app\`
   - Package them into a standalone `.exe` application

4. **User Execution**: The user runs the packaged `.exe`, NOT the source files

### ⚠️ MANDATORY WORKFLOW: Rebuild After Code Changes

**EVERY TIME you make changes to source code, you MUST:**

1. ✅ **Update source files** (e.g., `index.html` in project root)
2. ✅ **Commit changes to Git** (optional but recommended)
3. ✅ **Rebuild the packaged app**:
   - Close any running Electron apps
   - Run `Open-PowerShell-Here.bat` OR `npm run build:desktop`
   - Wait for build to complete
4. ✅ **User must run the newly built app** from `%LOCALAPPDATA%\SchemaTools\`

### What NOT to Do

- ❌ **DO NOT** edit files in `dist/` folder - they get overwritten on rebuild
- ❌ **DO NOT** expect source changes to appear in running app without rebuild
- ❌ **DO NOT** skip the rebuild step - changes will NOT be live
- ❌ **DO NOT** tell user to "just restart the app" - they must rebuild

### Why This Caused Hours of Debugging

**Real incident (2025-01-XX):**
- Multiple fixes were applied to source `index.html`
- Fixes were committed and pushed to GitHub
- User reported fixes were not working
- Root cause: User was running packaged app that still had old code
- Solution: User needed to rebuild packaged app after source changes
- Time lost: Several hours of debugging

### Verification Steps

After rebuilding, verify changes are in packaged app:
```bash
# Check that packaged app has latest source code
# File: %LOCALAPPDATA%\SchemaTools\SchemaTools-win32-x64\resources\app\index.html
# Should match: G:\Dropbox\...\Schema Tools\index.html (source)
```

### For Cursor AI / Future Developers

**ALWAYS:**
1. Update source files in project root
2. Tell user to rebuild using `Open-PowerShell-Here.bat`
3. Verify changes are in packaged app location
4. Never assume source changes are automatically in running app

**NEVER:**
1. Edit files in `dist/` or packaged app location directly
2. Tell user to "just restart" without rebuilding
3. Skip verification that changes are in packaged app

✅ **Product Schema Generator - COMPLETE (v1.5.3):**
- Automated workflow (Steps 1 → 2 → 3a → 3b → 4)
- URL validation with 404 checking
- **Schema Suppressor v1.3** - Automatically included in all generated HTML files
- Unique slug generation from product names
- Correct breadcrumb generation from URL paths
- v6.1 baseline schema structure (Product/Course only, no Event fields)
- Comprehensive validation hooks

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