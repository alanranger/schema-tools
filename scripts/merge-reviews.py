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
project_root = script_dir.parent
shared_resources_dir = project_root.parent / 'alan-shared-resources'
base_path = shared_resources_dir / "csv processed"
base_path.mkdir(parents=True, exist_ok=True)

print("="*80)
print("REVIEW MERGER - Step 3b (Using Dedicated Matchers)")
print("="*80)
print()

# Step 1: Trustpilot is frozen history — copy the frozen attribution, never re-match
print("Step 1: Loading frozen Trustpilot reviews...")
print()
try:
    result = subprocess.run(
        [sys.executable, str(script_dir / "apply-frozen-trustpilot.py")],
        capture_output=True,
        text=True,
        encoding='utf-8'
    )
    print(result.stdout)
    if result.stderr:
        print(result.stderr)
    if result.returncode != 0:
        print(f"ERROR: Loading frozen Trustpilot failed with code {result.returncode}")
        sys.exit(1)
except Exception as e:
    print(f"ERROR loading frozen Trustpilot: {e}")
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

# Step 2a: Reconcile ALL matched reviews against booking sheet
print("Step 2a: Reconciling Google reviews with booking sheet...")
print()
try:
    result = subprocess.run(
        [sys.executable, str(script_dir / "reconcile-google-booking-attributions.py")],
        capture_output=True,
        text=True,
        encoding='utf-8'
    )
    print(result.stdout)
    if result.stderr:
        print(result.stderr)
    if result.returncode != 0:
        print(f"ERROR: Booking reconciliation failed with code {result.returncode}")
        sys.exit(1)
except Exception as e:
    print(f"ERROR running booking reconciliation: {e}")
    sys.exit(1)

print()

# Step 2b: Apply booking-curated + course/1-2-1 attributions
print("Step 2b: Applying curated Google attributions (booking sheet + courses)...")
print()
try:
    result = subprocess.run(
        [sys.executable, str(script_dir / "apply-curated-google-attributions.py")],
        capture_output=True,
        text=True,
        encoding='utf-8'
    )
    print(result.stdout)
    if result.stderr:
        print(result.stderr)
    if result.returncode != 0:
        print(f"ERROR: Curated attribution step failed with code {result.returncode}")
        sys.exit(1)
except Exception as e:
    print(f"ERROR running curated attribution script: {e}")
    sys.exit(1)

print()

# Step 2c: Durable Alan-approved overrides (highest priority — after matcher/reconcile/curated)
print("Step 2c: Applying durable review attribution overrides (15)...")
print()
try:
    result = subprocess.run(
        [sys.executable, str(script_dir / "apply-review-attribution-overrides.py")],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    print(result.stdout)
    if result.stderr:
        print(result.stderr)
    if result.returncode != 0:
        print(f"ERROR: Override step failed with code {result.returncode}")
        sys.exit(1)
except Exception as e:
    print(f"ERROR running override script: {e}")
    sys.exit(1)

print()


def run_step(label, script_name):
    """Run one pipeline script; stop the merge if it fails."""
    print(label)
    print()
    try:
        step = subprocess.run(
            [sys.executable, str(script_dir / script_name)],
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
    except Exception as e:
        print(f"ERROR running {script_name}: {e}")
        sys.exit(1)
    print(step.stdout)
    if step.stderr:
        print(step.stderr)
    if step.returncode != 0:
        print(f"ERROR: {script_name} failed with code {step.returncode}")
        sys.exit(1)
    print()


# Step 2d: Google append-only — DB keeps existing attributions; new reviews held for Alan
run_step("Step 2d: Locking Google attributions to the database (new reviews held as pending)...", "lock-google-attributions.py")

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

# Step 3b: Manual-paste products — pin reviews to 15-override allowlist (after combined write)
print("Step 3b: Applying manual-paste review allowlists...")
print()
try:
    result = subprocess.run(
        [sys.executable, str(script_dir / "apply-manual-paste-review-allowlist.py")],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    print(result.stdout)
    if result.stderr:
        print(result.stderr)
    if result.returncode != 0:
        print(f"ERROR: Manual-paste allowlist failed with code {result.returncode}")
        sys.exit(1)
except Exception as e:
    print(f"ERROR running manual-paste allowlist: {e}")
    sys.exit(1)

print()

# Step 4: Guard — the combined file must carry the frozen Trustpilot attribution exactly
run_step("Step 4: Checking Trustpilot against the frozen attribution...", "check-frozen-trustpilot.py")

print("="*80)
print("MERGE COMPLETE")
print("="*80)
print()
print(f"Output file: {base_path / '03 – combined_product_reviews.csv'}")
print()

