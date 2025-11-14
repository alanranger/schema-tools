#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Schema Validation Script
Validates all JSON-LD schema files in shared-resources/outputs/schema/
against schema.org requirements for Event, Product, Course, and BlogPosting types.
"""

import json
import sys
import re
from pathlib import Path
from typing import Dict, List, Set, Any, Optional, Tuple

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Updated to use shared-resources structure
script_dir = Path(__file__).parent
project_root = script_dir.parent
shared_resources_dir = project_root.parent / 'alan-shared-resources'
schema_output_dir = shared_resources_dir / 'outputs' / 'schema'

# Required fields by schema type (based on schema.org requirements)
REQUIRED_FIELDS = {
    'Event': ['name', 'startDate'],
    'Product': ['name'],
    'Course': ['name', 'provider'],
    'BlogPosting': ['headline', 'datePublished'],
    'Blog': ['name', 'url'],
    'LocalBusiness': ['name'],
    'BreadcrumbList': ['itemListElement'],
    'ItemList': ['itemListElement'],
    'ListItem': ['position', 'item'],
    'Offer': ['price'],
    'Organization': ['name'],
    'Person': ['name'],
    'Brand': ['name'],
    'ImageObject': ['url'],
    'AggregateRating': ['ratingValue', 'reviewCount'],
    'Review': ['reviewRating', 'author']
}

# Recommended but non-critical fields
RECOMMENDED_FIELDS = {
    'Event': ['description', 'location', 'endDate', 'image', 'url', 'offers'],
    'Product': ['description', 'image', 'url', 'brand', 'offers', 'aggregateRating', 'review'],
    'Course': ['description', 'image', 'url', 'courseCode', 'educationalCredentialAwarded'],
    'BlogPosting': ['description', 'image', 'url', 'author', 'publisher'],
    'Blog': ['description', 'publisher', 'author', 'inLanguage'],
    'Offer': ['priceCurrency', 'availability', 'url', 'validFrom', 'validThrough'],
    'Organization': ['url', 'logo', 'sameAs'],
    'Person': ['url', 'jobTitle', 'sameAs'],
    'AggregateRating': ['bestRating', 'worstRating'],
    'Review': ['reviewBody', 'datePublished']
}

def extract_json_ld_from_html(html_content: str) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """Extract JSON-LD scripts from HTML content. Returns (schemas, parent_context)."""
    schemas = []
    parent_context = None
    # Find all script tags with type="application/ld+json"
    pattern = r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>'
    matches = re.findall(pattern, html_content, re.DOTALL | re.IGNORECASE)
    
    for match in matches:
        try:
            data = json.loads(match.strip())
            # Handle @graph format (array of schemas with parent @context)
            if isinstance(data, dict) and '@graph' in data:
                parent_context = data.get('@context')
                schemas.extend(data['@graph'])
            # Handle array of schemas
            elif isinstance(data, list):
                schemas.extend(data)
            # Handle single schema object
            elif isinstance(data, dict):
                schemas.append(data)
        except json.JSONDecodeError as e:
            print(f"  ⚠️  JSON parse error: {e}")
    
    return schemas, parent_context

def get_schema_types(schema: Dict[str, Any]) -> List[str]:
    """Extract @type(s) from schema (handles both string and array)."""
    schema_type = schema.get('@type')
    if isinstance(schema_type, list):
        return schema_type
    elif isinstance(schema_type, str):
        return [schema_type]
    return []

def validate_schema_object(schema: Dict[str, Any], file_path: Path, obj_index: int = 0, parent_context: Optional[str] = None) -> Tuple[bool, List[str]]:
    """Validate a single schema object."""
    errors = []
    warnings = []
    
    # Check @context (may be in schema or inherited from parent)
    context = schema.get('@context') or parent_context
    if not context:
        errors.append("Missing required @context")
    elif context != 'https://schema.org':
        warnings.append(f"@context is '{context}', expected 'https://schema.org'")
    
    # Check @type
    schema_types = get_schema_types(schema)
    if not schema_types:
        errors.append("Missing required @type")
        return False, errors + warnings
    
    # Validate each type
    for schema_type in schema_types:
        # Skip validation for types we don't have rules for
        if schema_type not in REQUIRED_FIELDS and schema_type not in RECOMMENDED_FIELDS:
            continue
        
        # Check required fields
        required = REQUIRED_FIELDS.get(schema_type, [])
        for field in required:
            if field not in schema:
                errors.append(f"Missing required field '{field}' for @type '{schema_type}'")
            elif schema[field] is None or (isinstance(schema[field], str) and not schema[field].strip()):
                errors.append(f"Required field '{field}' is empty for @type '{schema_type}'")
        
        # Check recommended fields
        recommended = RECOMMENDED_FIELDS.get(schema_type, [])
        for field in recommended:
            if field not in schema:
                warnings.append(f"Missing recommended field '{field}' for @type '{schema_type}'")
            elif schema[field] is None or (isinstance(schema[field], str) and not schema[field].strip()):
                warnings.append(f"Recommended field '{field}' is empty for @type '{schema_type}'")
    
    # Special validation for nested objects
    if 'offers' in schema:
        offers = schema['offers']
        if isinstance(offers, dict):
            offer_type = get_schema_types(offers)
            if 'Offer' in offer_type:
                if 'price' not in offers:
                    errors.append("Offer missing required 'price' field")
                if 'priceCurrency' not in offers:
                    warnings.append("Offer missing recommended 'priceCurrency' field")
        elif isinstance(offers, list):
            for i, offer in enumerate(offers):
                if isinstance(offer, dict):
                    offer_type = get_schema_types(offer)
                    if 'Offer' in offer_type:
                        if 'price' not in offer:
                            errors.append(f"Offer[{i}] missing required 'price' field")
                        if 'priceCurrency' not in offer:
                            warnings.append(f"Offer[{i}] missing recommended 'priceCurrency' field")
    
    if 'aggregateRating' in schema:
        rating = schema['aggregateRating']
        if isinstance(rating, dict):
            rating_type = get_schema_types(rating)
            if 'AggregateRating' in rating_type:
                if 'ratingValue' not in rating:
                    errors.append("AggregateRating missing required 'ratingValue' field")
                if 'reviewCount' not in rating:
                    errors.append("AggregateRating missing required 'reviewCount' field")
    
    if 'review' in schema:
        reviews = schema['review']
        if isinstance(reviews, dict):
            reviews = [reviews]
        for i, review in enumerate(reviews if isinstance(reviews, list) else []):
            if isinstance(review, dict):
                review_type = get_schema_types(review)
                if 'Review' in review_type:
                    if 'reviewRating' not in review:
                        errors.append(f"Review[{i}] missing required 'reviewRating' field")
                    if 'author' not in review:
                        errors.append(f"Review[{i}] missing required 'author' field")
    
    is_valid = len(errors) == 0
    return is_valid, errors + warnings

def validate_file(file_path: Path) -> Tuple[bool, List[str], int]:
    """Validate a single file (JSON or HTML)."""
    all_errors = []
    all_warnings = []
    schema_count = 0
    parent_context = None
    
    try:
        if file_path.suffix == '.json':
            # Load JSON file
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Handle different JSON structures
            if isinstance(data, dict):
                if '@graph' in data:
                    parent_context = data.get('@context')
                    schemas = data['@graph']
                else:
                    schemas = [data]
            elif isinstance(data, list):
                schemas = data
            else:
                all_errors.append(f"Unexpected JSON structure: {type(data)}")
                return False, all_errors, 0
            
        elif file_path.suffix == '.html':
            # Extract JSON-LD from HTML
            with open(file_path, 'r', encoding='utf-8') as f:
                html_content = f.read()
            schemas, parent_context = extract_json_ld_from_html(html_content)
            
            if not schemas:
                all_errors.append("No JSON-LD found in HTML file")
                return False, all_errors, 0
        else:
            all_errors.append(f"Unsupported file type: {file_path.suffix}")
            return False, all_errors, 0
        
        schema_count = len(schemas)
        
        # Validate each schema object
        for i, schema in enumerate(schemas):
            if not isinstance(schema, dict):
                all_errors.append(f"Schema[{i}] is not a dictionary")
                continue
            
            is_valid, issues = validate_schema_object(schema, file_path, i, parent_context)
            
            # Separate errors and warnings
            for issue in issues:
                if issue.startswith("Missing required") or issue.startswith("Required field") or issue.startswith("Offer missing required") or issue.startswith("AggregateRating missing required") or (issue.startswith("Review[") and "missing required" in issue):
                    all_errors.append(f"Schema[{i}]: {issue}")
                else:
                    all_warnings.append(f"Schema[{i}]: {issue}")
        
    except json.JSONDecodeError as e:
        all_errors.append(f"JSON decode error: {e}")
    except Exception as e:
        all_errors.append(f"Error reading file: {e}")
    
    is_valid = len(all_errors) == 0
    return is_valid, all_errors + all_warnings, schema_count

def main():
    """Main validation function."""
    if not schema_output_dir.exists():
        print(f"❌ Schema output directory not found: {schema_output_dir}")
        sys.exit(1)
    
    print("=" * 80)
    print("JSON-LD SCHEMA VALIDATION")
    print("=" * 80)
    print(f"Scanning: {schema_output_dir}")
    print()
    
    # Find all JSON and HTML files
    json_files = list(schema_output_dir.rglob('*.json'))
    html_files = list(schema_output_dir.rglob('*.html'))
    all_files = json_files + html_files
    
    if not all_files:
        print("❌ No JSON or HTML files found in schema output directory")
        sys.exit(1)
    
    print(f"Found {len(all_files)} file(s) to validate")
    print()
    
    # Validate each file
    results = []
    total_files = len(all_files)
    passed_files = 0
    failed_files = 0
    
    for file_path in sorted(all_files):
        relative_path = file_path.relative_to(schema_output_dir)
        print(f"Validating: {relative_path}")
        
        is_valid, issues, schema_count = validate_file(file_path)
        
        if is_valid:
            status = "✅ PASS"
            passed_files += 1
        else:
            status = "❌ FAIL"
            failed_files += 1
        
        print(f"  Status: {status} ({schema_count} schema object(s))")
        
        # Print errors
        errors = [i for i in issues if "required" in i.lower() or "Missing required" in i or "missing required" in i]
        if errors:
            print(f"  Errors ({len(errors)}):")
            for error in errors[:10]:  # Limit to first 10 errors
                print(f"    - {error}")
            if len(errors) > 10:
                print(f"    ... and {len(errors) - 10} more error(s)")
        
        # Print warnings
        warnings = [i for i in issues if i not in errors]
        if warnings:
            print(f"  Warnings ({len(warnings)}):")
            for warning in warnings[:5]:  # Limit to first 5 warnings
                print(f"    ⚠️  {warning}")
            if len(warnings) > 5:
                print(f"    ... and {len(warnings) - 5} more warning(s)")
        
        results.append({
            'file': relative_path,
            'valid': is_valid,
            'errors': len(errors),
            'warnings': len(warnings),
            'schema_count': schema_count
        })
        print()
    
    # Summary
    print("=" * 80)
    print("VALIDATION SUMMARY")
    print("=" * 80)
    print(f"Total files: {total_files}")
    print(f"✅ Passed: {passed_files}")
    print(f"❌ Failed: {failed_files}")
    print()
    
    if failed_files > 0:
        print("Failed files:")
        for result in results:
            if not result['valid']:
                print(f"  ❌ {result['file']} ({result['errors']} error(s), {result['warnings']} warning(s))")
        print()
        sys.exit(1)
    else:
        print("🎉 All files passed validation!")
        sys.exit(0)

if __name__ == '__main__':
    main()

