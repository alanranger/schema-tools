"""Scan 38 product pages: visible Q&A vs hosted FAQ schema count."""
import importlib.util
import json
import sys
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_DIR = ROOT / "alanranger-schema"
MANIFEST = SCHEMA_DIR / "products-manifest.json"

spec = importlib.util.spec_from_file_location(
    "gps", Path(__file__).parent / "generate-product-schema.py"
)
gps = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gps)


def faq_schema_count(faq_name):
    if not faq_name:
        return 0
    path = SCHEMA_DIR / faq_name
    if not path.exists():
        return 0
    data = json.loads(path.read_text(encoding="utf-8"))
    me = data.get("mainEntity") or []
    return len(me) if isinstance(me, list) else (1 if me else 0)


def post_scan(rows, misses):
    payload = {
        "tool": "schema-tools",
        "flow": "product-faq-visible-scan",
        "items_processed": len(rows),
        "not_published": [r["url"] for r in misses],
        "errors": 0,
        "summary": {
            "pages": len(rows),
            "misses": len(misses),
            "rows": rows,
        },
    }
    try:
        req = Request(
            "https://ai-geo-audit.vercel.app/api/aigeo/tool-run-report",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urlopen(req, timeout=8).read()
        print("posted tool_run_reports")
    except Exception as err:
        print("post skipped:", err)


def main():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    entries = manifest.get("entries") or []
    cache = {}
    rows = []
    misses = []
    print("pathKey\tvisible\tschema\tfaqFile")
    for entry in entries:
        path_key = str(entry.get("pathKey") or "")
        url = "https://www.alanranger.com" + path_key
        snapshot = gps.fetch_page_snapshot(url, cache)
        visible = gps.scrape_visible_faq_pairs(snapshot.get("html", ""))
        schema_n = faq_schema_count(entry.get("faqFileName") or "")
        row = {
            "url": url,
            "pathKey": path_key,
            "visible": len(visible),
            "schema": schema_n,
            "faqFileName": entry.get("faqFileName") or "",
            "fetched_ok": snapshot.get("fetched_ok"),
        }
        rows.append(row)
        if len(visible) > schema_n:
            misses.append(row)
        print(f"{path_key}\t{len(visible)}\t{schema_n}\t{row['faqFileName']}")
    print(f"\nmisses (visible > schema): {len(misses)}")
    for row in misses:
        print(f"  {row['pathKey']} visible={row['visible']} schema={row['schema']}")
    post_scan(rows, misses)
    out = ROOT / "scripts" / "_product-faq-scan-latest.json"
    out.write_text(json.dumps({"rows": rows, "misses": misses}, indent=2), encoding="utf-8")
    print("wrote", out)
    return 0 if not misses else 1


if __name__ == "__main__":
    sys.exit(main())
