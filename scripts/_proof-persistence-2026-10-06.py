#!/usr/bin/env python3
"""Proof run: normal merge + generate into scratch; diff vs live CDN. Does NOT push."""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(r"G:\Dropbox\alan ranger photography\Website Code\Schema Tools")
SHARED = ROOT.parent / "alan-shared-resources"
SCRIPTS = ROOT / "scripts"
PRODUCTS = SHARED / "outputs" / "schema" / "products"
SCRATCH = SHARED / "outputs" / "schema" / "products-scratch-proof-2026-10-06"
CDN = "https://schema.alanranger.com"
REPORT = SHARED / "outputs" / "schema" / "persistence-proof-report-2026-10-06.json"

KEY_SLUGS = [
    "4-x-2hr-private-photography-classes-face-to-face-coventry",
    "four-private-photography-classes",
    "private-online-photography-classes-zoom",
    "photography-mentor-online-monthly-mentoring",
    "2hr-private-photography-classes-2hr",
    "secrets-of-woodland-photography-workshop",
    "peak-district-heather-photography-workshop",
    "landscape-peak-district-photography-workshops-derbyshire",
    "professional-commercial-photographer-coventry",
    "batsford-arboretum-photography-workshops",
    "landscape-photography-devon-hartland-quay",
    "organization-about-reviews",
    "organization-homepage-reviews",
]


def run(cmd, cwd=None):
    print(">>", " ".join(str(c) for c in cmd))
    p = subprocess.run(cmd, cwd=cwd, text=True, encoding="utf-8", errors="replace")
    if p.returncode != 0:
        raise SystemExit(f"command failed ({p.returncode}): {cmd}")


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "schema-persistence-proof/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def review_sig(obj):
    """Normalize review/rating signature for comparison."""
    if isinstance(obj, list):
        graph = obj
    else:
        graph = obj.get("@graph") or [obj]
    product = None
    for n in graph:
        t = n.get("@type")
        if t == "Product" or (isinstance(t, list) and "Product" in t):
            product = n
            break
    if not product:
        return {"error": "no_product"}
    reviews = product.get("review") or []
    names = sorted(
        [
            (
                str((rv.get("author") or {}).get("name") or rv.get("author") or "").strip().lower(),
                str((rv.get("datePublished") or ""))[:10],
                str((rv.get("reviewRating") or {}).get("ratingValue") or ""),
            )
            for rv in reviews
            if isinstance(rv, dict)
        ]
    )
    ar = product.get("aggregateRating") or {}
    return {
        "reviewCount": len(reviews),
        "aggCount": ar.get("reviewCount"),
        "aggRating": ar.get("ratingValue"),
        "reviewers": names,
    }


def main():
    if SCRATCH.exists():
        shutil.rmtree(SCRATCH)
    SCRATCH.mkdir(parents=True)

    # 1) Normal pipeline: match + merge (includes 15 overrides at highest priority)
    run([sys.executable, str(SCRIPTS / "merge-reviews.py")])

    # 2) Generate into normal products dir, then copy to scratch (no CDN push)
    run([sys.executable, str(SCRIPTS / "generate-product-schema.py")])

    # Copy generated artifacts to scratch
    for p in PRODUCTS.iterdir():
        if p.is_file() and (
            p.suffix in {".json", ".html"}
            or p.name in {"products-manifest.json", "manifest-policy.json"}
        ):
            shutil.copy2(p, SCRATCH / p.name)

    # Also copy org/localbusiness if present at products or parent
    for name in (
        "organization.json",
        "localbusiness.json",
        "alanranger-organization.json",
        "alanranger-localbusiness.json",
    ):
        for base in (PRODUCTS, PRODUCTS.parent, SHARED / "outputs" / "schema"):
            src = base / name
            if src.exists():
                shutil.copy2(src, SCRATCH / name)

    # Manual paste mentoring node
    paste = SHARED / "outputs" / "manual-paste" / "mentoring-service-node.json"
    if paste.exists():
        dest = SCRATCH / "_manual-paste-mentoring-service-node.json"
        shutil.copy2(paste, dest)

    # 3) Diff vs CDN
    diffs = []
    checked = []
    manifest_local = SCRATCH / "products-manifest.json"
    if not manifest_local.exists():
        # generator may write under products with different name
        hits = list(PRODUCTS.glob("*manifest*.json"))
        print("manifest candidates", [h.name for h in hits])

    # Compare key product schemas + all *_schema.json review signatures where CDN has them
    schema_files = sorted(SCRATCH.glob("*_schema.json"))
    print(f"Scratch schema files: {len(schema_files)}")

    # Prefer KEY_SLUGS first, then sample rest via manifest pathKeys if available
    targets = []
    for slug in KEY_SLUGS:
        f = SCRATCH / f"{slug}_schema.json"
        if f.exists():
            targets.append(f)
    # Add org-ish
    for name in ("organization_schema.json", "localbusiness_schema.json"):
        f = SCRATCH / name
        if f.exists():
            targets.append(f)

    # Full pass: every product schema in scratch vs CDN same filename
    for f in schema_files:
        url = f"{CDN}/{f.name}"
        try:
            remote = json.loads(fetch(url).decode("utf-8"))
        except Exception as e:
            diffs.append({"file": f.name, "issue": f"cdn_fetch_failed: {e}"})
            continue
        local = json.loads(f.read_text(encoding="utf-8"))
        ls, rs = review_sig(local), review_sig(remote)
        checked.append(f.name)
        if ls != rs:
            diffs.append(
                {
                    "file": f.name,
                    "issue": "review_rating_mismatch",
                    "local": {
                        "reviewCount": ls.get("reviewCount"),
                        "aggCount": ls.get("aggCount"),
                        "aggRating": ls.get("aggRating"),
                    },
                    "cdn": {
                        "reviewCount": rs.get("reviewCount"),
                        "aggCount": rs.get("aggCount"),
                        "aggRating": rs.get("aggRating"),
                    },
                    "local_only": sorted(set(ls.get("reviewers") or []) - set(rs.get("reviewers") or [])),
                    "cdn_only": sorted(set(rs.get("reviewers") or []) - set(ls.get("reviewers") or [])),
                }
            )

    # Manifest exclude check
    policy = SCRATCH / "manifest-policy.json"
    policy_data = json.loads(policy.read_text(encoding="utf-8")) if policy.exists() else {}
    manifest_path = PRODUCTS / "products-manifest.json"
    if not manifest_path.exists():
        # deployed name sometimes products-manifest.json inside alanranger-schema
        alt = list(PRODUCTS.glob("products-manifest.json"))
        manifest_path = alt[0] if alt else manifest_path
    man_issues = []
    if manifest_path.exists():
        man = json.loads(manifest_path.read_text(encoding="utf-8"))
        entries = man if isinstance(man, list) else man.get("products") or man.get("entries") or []
        keys = set()
        for e in entries:
            if isinstance(e, dict):
                keys.add(str(e.get("pathKey") or e.get("path") or "").rstrip("/").lower())
            elif isinstance(e, str):
                keys.add(e.rstrip("/").lower())
        for ex in policy_data.get("excludePathKeys") or [
            "/photography-services-near-me/2hr-private-photography-classes-2hr",
            "/photography-mentoring-online-assignments",
        ]:
            if ex.rstrip("/").lower() in keys:
                man_issues.append(f"excluded path still in manifest: {ex}")

    report = {
        "checked_schema_files": len(checked),
        "review_rating_diffs": len(diffs),
        "diffs": diffs[:50],
        "manifest_issues": man_issues,
        "manifest_policy": policy_data,
        "scratch_dir": str(SCRATCH),
        "cdn": CDN,
        "key_slugs_present": [s for s in KEY_SLUGS if (SCRATCH / f"{s}_schema.json").exists()],
    }
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("checked_schema_files", "review_rating_diffs", "manifest_issues", "key_slugs_present")}, indent=2))
    print("Wrote", REPORT)
    if diffs or man_issues:
        print("PROOF: DIFFERENCES FOUND")
        sys.exit(2)
    print("PROOF: PASS — zero review/rating differences vs CDN; manifest excludes OK")


if __name__ == "__main__":
    main()
