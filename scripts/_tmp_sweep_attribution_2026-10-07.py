"""Sweep 52 products for missing approved overrides and wrong-product review text."""
from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd

shared = Path(r"G:\Dropbox\alan ranger photography\Website Code\alan-shared-resources")
csv_dir = shared / "csv processed"
products_dir = shared / "outputs" / "schema" / "products"
manifest = json.loads(
    (Path(r"G:\Dropbox\alan ranger photography\Website Code\Schema Tools\alanranger-schema") / "products-manifest.json").read_text(
        encoding="utf-8"
    )
)

overrides = pd.read_csv(csv_dir / "15-review-attribution-overrides.csv", encoding="utf-8-sig")
combined = pd.read_csv(csv_dir / "03 – combined_product_reviews.csv", encoding="utf-8-sig")

# Build slug -> schema file from manifest
entries = manifest.get("entries") or []
schema_by_slug = {}
for e in entries:
    path_key = e.get("pathKey") or ""
    slug = path_key.rstrip("/").split("/")[-1]
    schema_by_slug[slug] = e.get("schemaFileName")

# Product keyword heuristics (clear wrong-product text)
PRODUCT_HINTS = [
    (r"\bsensor\s*clean", "camera-sensor-clean"),
    (r"\bcamera\s*sensor\b", "camera-sensor-clean"),
    (r"\bbeginners?\s+(photography\s+)?(course|class)", "beginners-photography-course"),
    (r"\bintro\s+3\s+week", "beginners-photography-course"),
    (r"\blightroom\b", "lightroom-courses-for-beginners-coventry"),
    (r"\bzoom\b", "private-online-photography-classes-zoom"),
    (r"\b1[- ]?2[- ]?1\b|\bone[- ]to[- ]one\b|\bprivate\s+(online\s+)?(class|tuition)", "private-online-photography-classes-zoom"),
    (r"\bmentoring\b|\bmentor\b", "rps-mentoring-photography-course"),
    (r"\bgift\s+voucher", "photography-gift-vouchers"),
    (r"\bbluebell\b", "bluebell-woodlands-photography-workshops"),
    (r"\bbatsford\b", "batsford-arboretum-photography-workshops"),
    (r"\bwoodland\b", "secrets-of-woodland-photography-workshop"),
    (r"\bheather\b", "peak-district-heather-photography-workshop"),
    (r"\bfireworks?\b", "fireworks-photography-workshop-kenilworth"),
]


def load_product(schema_file: str):
    p = products_dir / schema_file
    if not p.exists():
        return None, [], None
    d = json.loads(p.read_text(encoding="utf-8"))
    for n in d.get("@graph", []):
        t = n.get("@type")
        types = t if isinstance(t, list) else [t]
        if "Product" in types:
            revs = n.get("review") or []
            return n.get("aggregateRating"), revs, n.get("@id")
    return None, [], None


def oldest_emitted(revs):
    dates = [r.get("datePublished") for r in revs if r.get("datePublished")]
    return min(dates) if dates else None


missing_overrides = []
wrong_product = []

# Class A: approved product-scope overrides missing from emit when newer than oldest emit
for _, ov in overrides.iterrows():
    scope = str(ov.get("scope") or "product").strip().lower()
    slug = "" if pd.isna(ov.get("product_slug")) else str(ov.get("product_slug")).strip()
    if scope != "product" or not slug:
        continue
    name = str(ov.get("reviewer_name") or "").strip()
    date = str(ov.get("review_date") or "")[:10]
    schema = schema_by_slug.get(slug)
    if not schema:
        # try fuzzy via combined product files
        continue
    agg, revs, _ = load_product(schema)
    if not revs:
        continue
    names_dates = {
        ((r.get("author") or {}).get("name") or "", (r.get("datePublished") or "")[:10]) for r in revs
    }
    if (name, date) in names_dates:
        continue
    oldest = oldest_emitted(revs)
    # only flag if override date is newer than oldest emitted (should have displaced older)
    if oldest and date and date >= oldest:
        missing_overrides.append(
            {
                "reviewer": name,
                "date": date,
                "slug": slug,
                "schema": schema,
                "oldest_emitted": oldest,
                "emit_count": len(revs),
                "notes": ov.get("notes"),
            }
        )

# Class B: emitted review text clearly names a different product
for e in entries:
    path_key = e.get("pathKey") or ""
    slug = path_key.rstrip("/").split("/")[-1]
    schema = e.get("schemaFileName")
    agg, revs, _ = load_product(schema)
    for r in revs:
        body = str(r.get("reviewBody") or "")
        author = (r.get("author") or {}).get("name")
        date = r.get("datePublished")
        for pat, hinted in PRODUCT_HINTS:
            if re.search(pat, body, re.I):
                # allow if hinted slug matches current or is a close alias
                if hinted == slug:
                    continue
                # beginners aliases
                if hinted.startswith("beginners") and slug.startswith("beginners"):
                    continue
                wrong_product.append(
                    {
                        "slug": slug,
                        "author": author,
                        "date": date,
                        "hinted_slug": hinted,
                        "pattern": pat,
                        "excerpt": re.sub(r"\s+", " ", body)[:160],
                    }
                )
                break

out = {
    "missing_overrides_newer_than_oldest_emitted": missing_overrides,
    "wrong_product_text": wrong_product,
    "counts": {
        "missing_overrides": len(missing_overrides),
        "wrong_product_text": len(wrong_product),
    },
}
out_path = shared / "outputs" / "schema" / "review-attribution-sweep-2026-10-07.json"
out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
print(json.dumps(out["counts"], indent=2))
print("--- missing overrides ---")
for row in missing_overrides:
    print(row)
print("--- wrong product (first 30) ---")
for row in wrong_product[:30]:
    print(row)
print("wrote", out_path)
