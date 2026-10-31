#!/usr/bin/env python3
"""Tests for the removed-from-Google split in reconcile-combined-vs-db.py (run: npm run test:reconcile-reviews)."""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("reconcile", Path(__file__).with_name("reconcile-combined-vs-db.py"))
reconcile = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reconcile)


def row(name, excluded="no", reason="", source="Google", rid="1"):
    return {"id": rid, "source": source, "reviewer_name": name, "review_date": "2023-10-22",
            "is_excluded": excluded, "exclude_reason": reason}


def test_split():
    alan = {("Trustpilot", "irene matthews")}
    missing = [
        row("Irene Matthews", source="Trustpilot"),
        row("Louise Rickitt", "yes", "removed from Google; about a print, not the workshop"),
        row("Auto Gone", "yes", "removed from Google (auto, 2026-11-01)"),
        row("Other Excluded", "yes", "quote_too_short"),
        row("Newly Gone"),
    ]
    excluded, removed, gone = reconcile.split_missing(missing, alan)
    assert [r["reviewer_name"] for r in excluded] == ["Irene Matthews", "Other Excluded"]
    assert [r["reviewer_name"] for r in removed] == ["Louise Rickitt", "Auto Gone"]
    assert [r["reviewer_name"] for r in gone] == ["Newly Gone"]


def test_auto_reason_only_lifts_automatic_exclusions():
    assert "removed from Google (auto, 2026-11-01)".startswith(reconcile.AUTO_REASON)
    assert not "removed from Google; about a print, not the workshop".startswith(reconcile.AUTO_REASON)


if __name__ == "__main__":
    test_split()
    test_auto_reason_only_lifts_automatic_exclusions()
    print("✅ reconcile removed-from-Google tests passed")
