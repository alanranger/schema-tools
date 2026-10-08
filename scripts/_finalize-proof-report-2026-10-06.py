import csv
import json
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

SHARED = Path(r"G:\Dropbox\alan ranger photography\Website Code\alan-shared-resources")
SCHEMA_DIR = SHARED / "outputs" / "schema" / "products"
SCRATCH = SHARED / "outputs" / "schema" / "products-scratch-proof-2026-10-06"
CSV_PATH = next((SHARED / "csv processed").glob("04*alanranger_product_schema_FINAL_WITH_REVIEW_RATINGS.csv"))
policy = json.loads((SCHEMA_DIR / "manifest-policy.json").read_text(encoding="utf-8"))
excludes = {str(k).lower() for k in policy.get("excludePathKeys") or []}

entries = []
with CSV_PATH.open(encoding="utf-8-sig", newline="") as f:
    reader = csv.DictReader(f)
    for row in reader:
        json_file = (row.get("json_file_name") or "").strip()
        url = (row.get("url") or "").strip()
        if not json_file.endswith("_schema.json"):
            continue
        if not (SCHEMA_DIR / json_file).exists():
            continue
        try:
            path_key = (urlparse(url).path or "/").rstrip("/").lower() or "/"
            parsed = urlparse(url)
            canonical = f"{parsed.scheme}://{parsed.netloc}{path_key}".lower()
        except Exception:
            continue
        if path_key in excludes:
            continue
        entries.append(
            {
                "url": canonical,
                "pathKey": path_key,
                "schemaFileName": json_file,
                "faqFileName": "",
            }
        )

dedup = {}
for e in entries:
    dedup.setdefault(e["pathKey"], e)
entries = list(dedup.values())
local_man = {
    "generatedAt": "proof",
    "totalProducts": len(entries),
    "entries": entries,
}
(SCRATCH / "products-manifest.json").write_text(json.dumps(local_man, indent=2), encoding="utf-8")

cdn = json.loads(
    urllib.request.urlopen("https://schema.alanranger.com/products-manifest.json", timeout=30).read()
)
lk = {e["pathKey"] for e in entries}
ck = {e["pathKey"] for e in cdn["entries"]}
only_l = sorted(lk - ck)
only_c = sorted(ck - lk)
print("local", len(lk), "cdn", len(ck))
print("excludes", sorted(excludes))
print("only_local", only_l)
print("only_cdn", only_c)
print("manifest_match", not only_l and not only_c)

# Final CDN review proof on manifest files + org
files = sorted({e["schemaFileName"] for e in cdn["entries"]})
files += ["organization-about-reviews.json", "organization-homepage-reviews.json"]
repo = Path(r"G:\Dropbox\alan ranger photography\Website Code\Schema Tools\alanranger-schema")


def sig(obj):
    graph = obj.get("@graph") or [obj]
    node = None
    for n in graph:
        t = n.get("@type")
        types = t if isinstance(t, list) else [t]
        if "Product" in types or "Organization" in types:
            node = n
            break
    if not node:
        return None
    reviews = node.get("review") or []
    names = sorted(
        [
            (
                str((rv.get("author") or {}).get("name") or "").strip().lower(),
                str(rv.get("datePublished") or "")[:10],
                str((rv.get("reviewRating") or {}).get("ratingValue") or ""),
            )
            for rv in reviews
            if isinstance(rv, dict)
        ]
    )
    ar = node.get("aggregateRating") or {}
    return {
        "n": len(reviews),
        "agg": ar.get("reviewCount"),
        "rating": str(ar.get("ratingValue")),
        "names": names,
    }


mism = []
for fn in files:
    lp = SCRATCH / fn
    if not lp.exists():
        lp = SCHEMA_DIR / fn
    if not lp.exists():
        lp = repo / fn
    remote = json.loads(
        urllib.request.urlopen(f"https://schema.alanranger.com/{fn}", timeout=30).read().decode()
    )
    local = json.loads(lp.read_text(encoding="utf-8"))
    if sig(local) != sig(remote):
        mism.append(fn)

print("review_mismatches", len(mism), mism[:10])
report = {
    "cdn_files_checked": len(files),
    "review_rating_diffs": mism,
    "manifest_only_local": only_l,
    "manifest_only_cdn": only_c,
    "manifest_counts": {"local": len(lk), "cdn": len(ck)},
    "manifest_policy": policy,
    "pass_reviews": len(mism) == 0,
    "pass_manifest_pathkeys": not only_l and not only_c,
}
out = SHARED / "outputs" / "schema" / "persistence-proof-report-2026-10-06.json"
out.write_text(json.dumps(report, indent=2), encoding="utf-8")
print("PASS_REVIEWS", report["pass_reviews"], "PASS_MANIFEST", report["pass_manifest_pathkeys"])
print("wrote", out)
