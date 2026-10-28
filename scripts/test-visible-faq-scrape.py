"""Heading-style visible FAQ scrape fixture (no network)."""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "gps", Path(__file__).parent / "generate-product-schema.py"
)
gps = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gps)

HEADING_HTML = """
<h2>Frequently asked questions</h2>
<h3>Is this mentoring officially accredited by the RPS?</h3>
<p>No. This is independent mentoring based on Alan's own experience.</p>
<h3>How many sessions will I need?</h3>
<p>Most photographers beginning a panel from scratch take a block of around six sessions.</p>
<h3>Do you guarantee I'll pass?</h3>
<p>No honest mentor can guarantee an assessment result from the RPS assessors.</p>
"""

DETAILS_HTML = """
<details><summary>What is included in the course?</summary>
<p>Three weekly evening classes covering camera settings, composition, and editing.</p></details>
"""

pairs = gps.scrape_visible_faq_pairs(HEADING_HTML)
assert len(pairs) == 3, pairs
assert pairs[0][0].startswith("Is this mentoring")
assert "independent mentoring" in pairs[0][1]

details = gps.scrape_visible_faq_pairs(DETAILS_HTML)
assert len(details) == 1, details
print("ok", len(pairs), "heading pairs;", len(details), "details pair")
