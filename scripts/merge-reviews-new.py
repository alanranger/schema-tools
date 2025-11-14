#!/usr/bin/env python3
"""
Updated Review Merger Script - Uses dedicated matchers
Step 3b: Merge Trustpilot and Google reviews into a unified dataset

This script now uses dedicated matching scripts for better accuracy:
- match-trustpilot-reviews.py for Trustpilot reviews
- match-google-reviews.py for Google reviews
"""

import os
import sys
import subprocess
from pathlib import Path

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

script_dir = Path(__file__).parent
base_path = script_dir.parent / "inputs-files" / "workflow"

print("="*80)
print("REVIEW MERGER - Step 3b (Using Dedicated Matchers)")
print("="*80)
print()

# Step 1: Run Trustpilot matcher
print("Step 1: Matching Trustpilot reviews...")
print()
try:
    result = subprocess.run(
        [sys.executable, str(script_dir / "match-trustpilot-reviews.py")],
        capture_output=True,
        text=True,
        encoding='utf-8'
    )
    print(result.stdout)
    if result.stderr:
        print(result.stderr)
    if result.returncode != 0:
        print(f"ERROR: Trustpilot matching failed with code {result.returncode}")
        sys.exit(1)
except Exception as e:
    print(f"ERROR running Trustpilot matcher: {e}")
    sys.exit(1)

print()

# Step 2: Run Google matcher
print("Step 2: Matching Google reviews...")
print()
try:
    result = subprocess.run(
        [sys.executable, str(script_dir / "match-google-reviews.py")],
        capture_output=True,
        text=True,
        encoding='utf-8'
    )
    print(result.stdout)
    if result.stderr:
        print(result.stderr)
    if result.returncode != 0:
        print(f"ERROR: Google matching failed with code {result.returncode}")
        sys.exit(1)
except Exception as e:
    print(f"ERROR running Google matcher: {e}")
    sys.exit(1)

print()

# Step 3: Merge matched reviews
print("Step 3: Merging matched reviews...")
print()
try:
    result = subprocess.run(
        [sys.executable, str(script_dir / "merge-matched-reviews.py")],
        capture_output=True,
        text=True,
        encoding='utf-8'
    )
    print(result.stdout)
    if result.stderr:
        print(result.stderr)
    if result.returncode != 0:
        print(f"ERROR: Merge failed with code {result.returncode}")
        sys.exit(1)
except Exception as e:
    print(f"ERROR running merge script: {e}")
    sys.exit(1)

print()
print("="*80)
print("MERGE COMPLETE")
print("="*80)
print()
print(f"Output file: {base_path / '03 – combined_product_reviews.csv'}")
print()


