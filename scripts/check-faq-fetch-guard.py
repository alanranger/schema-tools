#!/usr/bin/env python3
"""
Guard (`npm run test:faq-fetch-guard`):
- a product page whose FAQ snippet can't be fetched must be reported as "FAQ unknown" (fetched_ok
  False), never as "no visible FAQ" — otherwise the generator deletes the FAQ file and the deploy
  drops the manifest mapping (the 27 Oct 23 -> 6 loss);
- only Q&As inside a visible FAQ section become FAQPage (no page-wide '?' headings, no HTML comments).
"""
import importlib.util
import sys
from pathlib import Path
from urllib.error import HTTPError

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

GEN = Path(__file__).resolve().parent / "generate-product-schema.py"
spec = importlib.util.spec_from_file_location("gen_product_schema", GEN)
gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)

PAGE = "https://www.alanranger.com/photo-workshops-uk/example-workshop"
SNIPPET = "https://www.alanranger.com/one-day-workshops-product-snippet"
PAGE_HTML = f'<html><title>Example</title><div data-wm-plugin="load" data-target="{SNIPPET}"></div></html>'
SNIPPET_HTML = "<h2>Frequently asked questions</h2><ul><li><p><strong>Do I need a tripod?</strong><br> Yes, bring a sturdy tripod please.</p></li></ul>"


def run(snippet_fails):
    def fake_fetch(url, timeout_sec=12):
        if url == SNIPPET and snippet_fails:
            raise HTTPError(url, 429, "Too Many Requests", {}, None)
        return SNIPPET_HTML if url == SNIPPET else PAGE_HTML

    gen.fetch_html = fake_fetch
    gen.FETCH_GAP_SECONDS = 0
    gen.FETCH_BACKOFF_SECONDS = (0, 0)
    gen._HTML_CACHE.clear()
    snap = gen.fetch_page_snapshot(PAGE, {})
    return snap, gen.scrape_visible_faq_pairs(snap.get("html", ""))


SCOPE_CASES = [
    ("HTML comment with a heading tag + nav '?'", 0,
     "<!-- turns <h2> into a span, leaving the real H1 --><nav>About ?</nav><h2>Prints</h2><p>Lovely giclee prints in seven sizes.</p>"),
    ("'?' heading outside any FAQ section", 0,
     "<h3>Is this for me?</h3><p>This course is ideal for any photographer who wants a project.</p>"),
    ("Squarespace accordion item titled FAQs", 2,
     '<li class="accordion-item"><h3><span class="accordion-item__title">[faq-icon] FAQs</span></h3>'
     '<p><strong>What if the weather is bad?</strong><br> We adapt the plan to the light on the day.</p>'
     '<p><strong>How fit do I need to be?</strong><br> Easy walking of a few miles at most.</p></li>'
     '<li class="accordion-item"><h3><span class="accordion-item__title">Next Steps</span></h3>'
     '<p><strong>Will I get joining notes?</strong><br> Yes, a week before the workshop.</p></li>'),
]


def check_scopes():
    failures = []
    for label, expected, html in SCOPE_CASES:
        got = len(gen.scrape_visible_faq_pairs(html))
        if got != expected:
            failures.append(f"scope '{label}': expected {expected} pairs, got {got}")
    return failures


def main():
    failures = check_scopes()
    snap, pairs = run(snippet_fails=False)
    if not snap["fetched_ok"] or len(pairs) != 1:
        failures.append(f"snippet ok: expected fetched_ok and 1 pair, got {snap['fetched_ok']} / {len(pairs)}")
    snap, pairs = run(snippet_fails=True)
    if snap["fetched_ok"] or "429" not in snap["fetch_error"]:
        failures.append(f"snippet 429: expected fetched_ok False with 429 error, got {snap['fetched_ok']} / {snap['fetch_error']}")
    for f in failures:
        print(f"FAIL {f}")
    print("PASS faq fetch guard" if not failures else f"{len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
