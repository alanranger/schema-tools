"""
Stable Offer dates for product schema and 07 (BAU batch 8). Dates only move when the product does:

- validFrom       = the product's Squarespace createdOn date (Commerce API cache), else 1 Jan of the current year.
- priceValidUntil = the variant's event date when its option text has a future date ("Sat 23 Oct 2027",
                    "Wed 1st Mar"), else 31 Dec of next year (moves once a year).

Before this every run used today / today + 365, so all products looked changed every month.
"""
import json
import os
import re
from datetime import date
from pathlib import Path

MONTHS = {m: i for i, m in enumerate(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'], start=1)}
DATE_RE = re.compile(r'\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b', re.I)
YEAR_RE = re.compile(r'\b(20\d\d)\b')
COMMERCE_CACHE = 'commerce-api-products-v2.json'


def end_of_next_year(today=None):
    t = today or date.today()
    return f"{t.year + 1}-12-31"


def _safe_date(year, month, day):
    try:
        return date(year, month, day)
    except ValueError:
        return None


def event_date(option_text, today=None):
    """First date in a variant's option text; without a year, its next occurrence on or after today."""
    m = DATE_RE.search(str(option_text or ''))
    if not m:
        return None
    t = today or date.today()
    day, month = int(m.group(1)), MONTHS[m.group(2).lower()[:3]]
    y = YEAR_RE.search(str(option_text))
    if y:
        return _safe_date(int(y.group(1)), month, day)
    d = _safe_date(t.year, month, day)
    return d if d and d >= t else _safe_date(t.year + 1, month, day)


def stable_price_valid_until(option_text=None, today=None):
    t = today or date.today()
    d = event_date(option_text, t)
    return d.isoformat() if d and d >= t else end_of_next_year(t)


def stable_valid_from(created_on=None, today=None):
    if created_on:
        return str(created_on)[:10]
    return f"{(today or date.today()).year}-01-01"


def _cache_file():
    explicit = os.environ.get('PRODUCT_DATES_FEED')
    if explicit:
        return Path(explicit)
    feeds = os.environ.get('CSV_BUILDERS_FEEDS') or os.path.join(os.environ.get('LOCALAPPDATA', ''), 'AlanCsvBuilders', 'feeds')
    return Path(feeds) / COMMERCE_CACHE


def load_created_dates(path=None):
    """{product id: 'YYYY-MM-DD', url slug: 'YYYY-MM-DD'} from the Commerce API products cache ({} if absent)."""
    f = Path(path) if path else _cache_file()
    if not f.exists():
        return {}
    data = json.loads(f.read_text(encoding='utf-8'))
    products = data if isinstance(data, list) else (data.get('products') or data.get('result') or [])
    out = {}
    for p in products:
        created = str(p.get('createdOn') or '')[:10]
        if not created:
            continue
        if p.get('id'):
            out[p['id']] = created
        if p.get('urlSlug'):
            out[p['urlSlug']] = created
    return out


def keep_or_stable_until(existing, option_text=None, today=None):
    """An existing priceValidUntil is kept when it is a valid date not in the past; otherwise the stable rule."""
    t = today or date.today()
    try:
        d = date.fromisoformat(str(existing)[:10])
        if d >= t:
            return d.isoformat()
    except (TypeError, ValueError):
        pass
    return stable_price_valid_until(option_text, t)
