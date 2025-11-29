# Blog Schema Validation Guide

## Quick Validation (3 Methods)

### Method 1: Using the UI Button (Electron App Only)
1. Generate blog schema: Click **"Generate Blog Index Schema"**
2. Save test version: Click **"🧪 Save TEST Version"**
3. Validate: Click **"✅ Validate TEST Version"**
4. Check debug log for results

### Method 2: Terminal Command (Recommended)
```bash
# After saving test version, run:
node test-patch-requirements.js
```

This will test all 15 patch plan requirements and show:
- ✅ Passed tests
- ❌ Failed tests with details
- Final summary

### Method 3: Full Test Suite
```bash
# Comprehensive validation (all fields, structure, etc.)
node test-blog-schema.js
```

## What Gets Tested

The `test-patch-requirements.js` script validates:

1. ✅ **mainEntityOfPage** - Must be WebPage object with @type
2. ✅ **isPartOf** - Must point to WebSite (not Blog)
3. ✅ **Image** - Must be ImageObject (not string) with width/height
4. ✅ **thumbnailUrl** - Must be present
5. ✅ **inLanguage** - Must be "en-GB"
6. ✅ **discussionUrl** - Must end with "#comments"
7. ✅ **keywords** - Must be array
8. ✅ **wordCount** - Must be number
9. ✅ **about** - Must be array
10. ✅ **mentions** - Must be array
11. ✅ **Assignments** - Must have `teaches` and `learningResourceType: "Practice Assignment"`
12. ✅ **articleSection** - Must be present
13. ✅ **URL Normalization** - No trailing slashes
14. ✅ **Author** - Must have @id
15. ✅ **Publisher Logo** - Must have width/height

## Workflow

1. **Generate** → Click "Generate Blog Index Schema"
2. **Save Test** → Click "🧪 Save TEST Version"
3. **Validate** → Run `node test-patch-requirements.js` OR click "✅ Validate TEST Version"
4. **Fix Errors** → If validation fails, check debug log and fix issues
5. **Test in Google** → Copy JSON from test file and paste into Google Rich Results Test
6. **Deploy** → Only after all tests pass, click "🚀 Export JSON & Deploy to GitHub"

## Expected Output

```
🧪 TESTING ALL PATCH PLAN REQUIREMENTS
============================================================

📊 Testing 220 BlogPosting objects

=== TEST 1: mainEntityOfPage ===
✅ All 220 posts have correct mainEntityOfPage (WebPage object)

=== TEST 2: isPartOf ===
✅ All 220 posts have correct isPartOf (WebSite object)

...

============================================================
=== FINAL SUMMARY ===
Passed Tests: 15
Failed Tests: 0
Total Errors: 0
Total Warnings: 0

✅ ALL PATCH PLAN REQUIREMENTS PASSED!
```

## Troubleshooting

**"Test schema not found"**
- Make sure you clicked "🧪 Save TEST Version" first
- Check that `outputs/blog-schema-test.json` exists

**Validation fails**
- Check the debug log for specific errors
- Each error shows which post failed and why
- Fix the generator logic and regenerate

**Button not visible**
- Refresh the page (F5) or reload Electron app
- Make sure you're on the "Blog Schema" tab

