# Schema Generator Path Update Summary

## Status: ✅ All Paths Already Correctly Configured

All schema generator scripts and tools have been verified to use the correct unified `alan-shared-resources` structure.

## Current Path Structure

### Input Paths (CSV Data)
- **Location**: `shared-resources/csv/` (flat structure, no subfolders)
- **Files**: All raw CSV files with original Squarespace export filenames
  - `01-blog-posts.csv`
  - `02 - www-alanranger-com__...__beginners-photography-lessons.csv` (original export name)
  - `03 - www-alanranger-com__...__photographic-workshops-near-me.csv` (original export name)
  - `raw-01-products*.csv`
  - `raw-03a-trustpilot-reviews-historical.csv`
  - `raw-03b-google-reviews.csv`
  - etc.

### Output Paths (JSON-LD Schemas)
- **Location**: `shared-resources/outputs/schema/` (flat structure, no category subfolders)
- **Files**: All generated schema files saved directly to this directory
  - `blog-schema.json`
  - `[Product_Slug]_schema_squarespace_ready.html` (product schemas)
  - `review_summary.csv` (QA summary)
  - etc.

## Files Verified

### ✅ Scripts with Correct Paths

1. **`scripts/generate-product-schema.py`**
   - **Input**: `shared-resources/csv/` (flat, uses glob patterns for flexible filename matching)
   - **Output**: `shared-resources/outputs/schema/` (flat, no subfolders)
   - **Status**: ✅ Correct
   - **Lines**: 1212-1215, 2148

2. **`scripts/generate-blog-schema.js`**
   - **Input**: `shared-resources/csv/01-blog-posts.csv`
   - **Output**: `shared-resources/outputs/schema/blog-schema.json`
   - **Status**: ✅ Correct
   - **Lines**: 22-24

3. **`scripts/fix-blog-schema.js`**
   - **Input/Output**: `shared-resources/outputs/schema/blog-schema.json`
   - **Status**: ✅ Correct
   - **Lines**: 10-11

4. **`scripts/validate-schemas.py`**
   - **Input**: `shared-resources/outputs/schema/` (recursively scans for .json and .html files)
   - **Status**: ✅ Correct
   - **Lines**: 21-22

### ✅ UI/HTML Files

5. **`index.html`**
   - **JavaScript Functions**: Use file inputs (no hardcoded CSV paths)
   - **Save Functions**: Save to `alanranger-schema/` folder (separate GitHub Pages repo, not part of shared-resources)
   - **Documentation**: All path references updated to reflect flat `csv/` structure
   - **Status**: ✅ Correct

## Path Resolution Pattern

All scripts use the following consistent pattern:

```python
# Python scripts
script_dir = Path(__file__).parent
project_root = script_dir.parent
shared_resources_dir = project_root.parent / 'alan-shared-resources'
csv_dir = shared_resources_dir / 'csv'  # Flat structure
csv_processed_dir = shared_resources_dir / 'csv processed'
outputs_dir = shared_resources_dir / 'outputs' / 'schema'  # Flat structure
```

```javascript
// JavaScript scripts
const sharedResourcesDir = path.resolve(__dirname, '../../alan-shared-resources');
const csvDir = path.join(sharedResourcesDir, 'csv');  // Flat structure
const outputsDir = path.join(sharedResourcesDir, 'outputs', 'schema');  // Flat structure
```

## Key Points

1. ✅ **No category-specific CSV folders**: All scripts read from flat `csv/` directory
2. ✅ **No category-specific output folders**: All schemas saved to flat `outputs/schema/` directory
3. ✅ **Flexible filename matching**: Scripts use glob patterns to find files by content (e.g., `*photographic-workshops-near-me*.csv`)
4. ✅ **Original filenames preserved**: Raw CSV files retain their original Squarespace export names
5. ✅ **Documentation updated**: All comments and docstrings reflect the correct path structure

## No Changes Required

All schema generator tools are already correctly configured to use the unified `alan-shared-resources` structure with flat `csv/` and `outputs/schema/` directories. No modifications were needed.

## Verification

- ✅ No references to `csv/products/`, `csv/workshops/`, `csv/lessons/`, `csv/events/`, `csv/reviews/`, or `csv/blog/` found
- ✅ All scripts use `csv/` (flat) for input
- ✅ All scripts use `outputs/schema/` (flat) for output
- ✅ Documentation accurately reflects current structure

---

**Generated**: 2025-01-27
**Status**: All paths verified and correct ✅

