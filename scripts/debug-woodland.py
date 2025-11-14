#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import pandas as pd
from pathlib import Path
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

product_name = "The Secret of WOODLAND PHOTOGRAPHY- 1-Day Jan, Apr, Aug, Oct"
product_name_lower = product_name.lower()

# Extract keywords using the same logic
product_keywords = [w for w in product_name_lower.split() 
                  if len(w) >= 3 
                  and w not in ['the', 'of', 'and', 'for', 'a', 'an', 'in', 'on', 'at', 'to', 
                               'photography', 'workshop', 'workshops', 'photographic',
                               'sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri',
                               'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
                               '1-day', 'day'] 
                  and not w.replace('-', '').replace('/', '').isdigit()]

print("Product name:", product_name)
print("Keywords extracted:", product_keywords[:5])
print("\nChecking against event title: 'The Secrets of Woodland Photography - 1-Day Masterclass'")
event_title = "the secrets of woodland photography - 1-day masterclass"

matches = 0
for kw in product_keywords[:5]:
    if kw in event_title:
        print(f"  '{kw}' found in event title")
        matches += 1
    elif kw.endswith('s') and kw[:-1] in event_title:
        print(f"  '{kw}' -> '{kw[:-1]}' found in event title (singular)")
        matches += 1
    elif not kw.endswith('s') and (kw + 's') in event_title:
        print(f"  '{kw}' -> '{kw + 's'}' found in event title (plural)")
        matches += 1
    else:
        print(f"  '{kw}' NOT found")

print(f"\nTotal matches: {matches}")

