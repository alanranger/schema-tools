# Changelog

All notable changes to the Schema Tools project will be documented in this file.

## [1.4.0] - 2024-01-XX

### Code Quality Improvements
- **Refactored all functions** to reduce cognitive complexity below 15 (SonarLint requirement)
- **Modernized JavaScript syntax**:
  - Replaced `window` with `globalThis` (5 occurrences)
  - Converted `.forEach()` loops to `for...of` loops (19 occurrences)
  - Replaced `removeChild()` with `.remove()` method (5 occurrences)
  - Replaced `JSON.parse(JSON.stringify())` with `structuredClone()` (2 occurrences)
- **Improved error handling**:
  - Added proper exception logging to all catch blocks (6 occurrences)
  - Replaced silent catch blocks with `console.warn()` or `console.error()`
- **Code readability improvements**:
  - Extracted nested ternary operations into independent statements (3 occurrences)
  - Removed unnecessary escape characters in regex patterns (3 occurrences)
  - Fixed redundant variable assignments (3 occurrences)
  - Converted simple `for` loop to `for...of` (1 occurrence)
- **Accessibility improvements**:
  - Added `title` attributes to select elements for better screen reader support
- **Function refactoring**:
  - Extracted helper functions to reduce complexity
  - Improved function organization and maintainability

### Technical Details
- All functions now meet SonarLint cognitive complexity requirements (≤15)
- Improved cross-platform compatibility with `globalThis`
- Better performance with `for...of` loops instead of `.forEach()`
- Modern DOM manipulation with `.remove()` instead of `removeChild()`
- Proper deep cloning with `structuredClone()` instead of JSON serialization

## [1.3.0] - Previous Release

### Added
- Supabase integration for storing validation results
- Manual status input dropdowns for Google and Schema.org validators
- Notes textarea for each validation result
- "Save to Supabase" button functionality
- Toast notifications for save success/failure
- Automatic storage of schema JSON and validation metadata

## [1.2.1] - Previous Release

### Added
- Template CSV download button for easy setup
- Real-time progress indicators during validation
- Enhanced schema generation with @graph support for multiple schemas
- Downloads both JSON and HTML script tag formats
- Improved UI with status badges and better error handling
- Better table rendering with processing status updates

## [1.2.0] - Previous Release

### Added
- HTML UI for bulk validator (browser-based CSV upload)
- Schema validation capabilities in unified generator
- Bulk URL validation from CSV

## [1.0.0] - Initial Release

### Added
- Unified schema generator combining event and product generators
- Event schema generation from CSV
- Product schema generation from CSV
- Basic validation functionality

