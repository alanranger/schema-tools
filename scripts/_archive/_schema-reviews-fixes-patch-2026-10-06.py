"""Patch generator + add mentoring/academy products + org @id."""
from pathlib import Path
import json
import shutil
import pandas as pd

ST = Path(r"G:\Dropbox\alan ranger photography\Website Code\Schema Tools")
CSV = Path(r"G:\Dropbox\alan ranger photography\Website Code\alan-shared-resources\csv processed")


def main():
    gen = ST / "scripts" / "generate-product-schema.py"
    text = gen.read_text(encoding="utf-8")
    bk = gen.with_suffix(gen.suffix + ".backup-2026-10-06-schema-fixes")
    if not bk.exists():
        shutil.copy2(gen, bk)
        print("backed up generator")

    old_slug = '''def slug_matches(review_slug, product_slug, threshold=0.85):
    """Check if review slug matches product slug using multiple strategies"""
    a = normalize_slug(review_slug)
    b = normalize_slug(product_slug)
    
    if not a or not b:
        return False
    
    # Strategy 1: Exact match
    if a == b:
        return True
    
    # Strategy 2: Startswith match
    if a.startswith(b) or b.startswith(a):
        return True
    
    # Strategy 3: Substring match
    if a in b or b in a:
        return True
    
    # Strategy 4: Fuzzy match
    return SequenceMatcher(None, a, b).ratio() >= threshold'''

    new_slug = '''def slug_matches(review_slug, product_slug, threshold=0.85):
    """Check if review slug matches product slug using multiple strategies"""
    # Face-to-face twin slugs fuzzy-match at ~0.87 — require exact tail match only.
    F2F_EXACT = {
        "2hr-private-photography-classes-2hr",
        "four-private-photography-classes",
    }
    a_raw = str(review_slug or "").strip().lower().rstrip("/")
    b_raw = str(product_slug or "").strip().lower().rstrip("/")
    a_tail = a_raw.split("/")[-1] if a_raw else ""
    b_tail = b_raw.split("/")[-1] if b_raw else ""
    if a_tail in F2F_EXACT or b_tail in F2F_EXACT:
        return a_tail == b_tail

    a = normalize_slug(review_slug)
    b = normalize_slug(product_slug)
    
    if not a or not b:
        return False
    
    # Strategy 1: Exact match
    if a == b:
        return True
    
    # Strategy 2: Startswith match
    if a.startswith(b) or b.startswith(a):
        return True
    
    # Strategy 3: Substring match
    if a in b or b in a:
        return True
    
    # Strategy 4: Fuzzy match
    return SequenceMatcher(None, a, b).ratio() >= threshold'''

    if old_slug not in text:
        raise SystemExit("slug_matches block not found")
    text = text.replace(old_slug, new_slug, 1)

    old_fuzzy = '''            # Fuzzy fallback: handle slight slug variations
            for s in grouped_reviews.groups:
                if SequenceMatcher(None, product_slug, s).ratio() >= 0.85:
                    reviews_for_product = grouped_reviews.get_group(s)
                    break'''

    new_fuzzy = '''            # Fuzzy fallback: handle slight slug variations (exact-only for F2F twins)
            F2F_EXACT = {
                "2hr-private-photography-classes-2hr",
                "four-private-photography-classes",
            }
            ps = str(product_slug or "").strip().lower().split("/")[-1]
            for s in grouped_reviews.groups:
                ss = str(s or "").strip().lower().split("/")[-1]
                if ps in F2F_EXACT or ss in F2F_EXACT:
                    if ps == ss:
                        reviews_for_product = grouped_reviews.get_group(s)
                        break
                    continue
                if SequenceMatcher(None, product_slug, s).ratio() >= 0.85:
                    reviews_for_product = grouped_reviews.get_group(s)
                    break'''

    if old_fuzzy not in text:
        raise SystemExit("fuzzy fallback block not found")
    text = text.replace(old_fuzzy, new_fuzzy, 1)

    old_parse = '''            def parse_review_date(val):
                if pd.isna(val):
                    return None
                val_str = str(val).strip()
                # Handle ISO timestamp format (e.g., "2024-12-15T14:30:00")
                if 'T' in val_str:
                    # Extract just the date part
                    date_part = val_str.split('T')[0]
                    try:
                        return pd.to_datetime(date_part, errors='coerce')
                    except:
                        return pd.to_datetime(val_str, errors='coerce', dayfirst=True)
                else:
                    return pd.to_datetime(val_str, errors='coerce', dayfirst=True)
            
            reviews_df["date"] = reviews_df["date"].apply(parse_review_date)'''

    new_parse = '''            def parse_review_date(val):
                if pd.isna(val):
                    return None
                val_str = str(val).strip()
                if not val_str or val_str.lower() in {"nan", "none", "nat", ""}:
                    return None
                # ISO timestamps -> date part first (avoid dayfirst mangling YYYY-MM-DD)
                if "T" in val_str:
                    val_str = val_str.split("T")[0]
                dt = pd.to_datetime(val_str, errors="coerce", format="mixed")
                if pd.isna(dt):
                    dt = pd.to_datetime(val_str, errors="coerce", dayfirst=True)
                return None if pd.isna(dt) else dt
            
            reviews_df["date"] = reviews_df["date"].apply(parse_review_date)'''

    if old_parse not in text:
        raise SystemExit("parse_review_date block not found")
    text = text.replace(old_parse, new_parse, 1)

    old_sort = "reviews_for_product['_sort_date'] = pd.to_datetime(reviews_for_product['date'], errors='coerce', dayfirst=True)"
    new_sort = "reviews_for_product['_sort_date'] = pd.to_datetime(reviews_for_product['date'], errors='coerce', format='mixed')"
    if old_sort not in text:
        raise SystemExit("sort date line not found")
    text = text.replace(old_sort, new_sort, 1)

    gen.write_text(text, encoding="utf-8")
    print("patched generate-product-schema.py")

    prod_path = list(CSV.glob("02*products*"))[0]
    print("products file", prod_path.name)
    df = pd.read_excel(prod_path, engine="openpyxl")
    urls = set(df["url"].astype(str).str.rstrip("/").str.lower())

    def make_offer(sku, price, name, currency="GBP"):
        return [{
            "@type": "Offer",
            "sku": sku,
            "price": f"{float(price):.2f}",
            "priceCurrency": currency,
            "availability": "https://schema.org/InStock",
            "validFrom": "2026-10-06",
            "priceValidUntil": "2027-10-06",
            "name": name,
        }]

    new_rows = []
    mentor_url = "https://www.alanranger.com/photography-mentoring-online-assignments"
    if mentor_url.lower() not in urls:
        offers = make_offer("SQ-MENTOR-MONTHLY", 20.0, "Foundation Plus — Monthly Mentoring £20/mo")
        new_rows.append({
            "name": "Photography Mentor Online — Monthly Mentoring",
            "description": "Online photography mentoring with monthly assignments, a personal Lightroom review of your images and 30 practice packs. £20/month, cancel anytime.",
            "image": "https://images.squarespace-cdn.com/content/v1/5013f4b2c4aaa4752ac69b17/0ddfe780-871c-4d90-a207-82f053d68ce0/monthly+mentoring+assigments.png",
            "url": mentor_url,
            "category": "photography-mentoring, online-mentoring",
            "offers": json.dumps(offers),
            "total_variants": 1,
            "lowest_price": 20.0,
            "highest_price": 20.0,
            "skus": "SQ-MENTOR-MONTHLY",
            "main_sku": "SQ-MENTOR-MONTHLY",
            "schema_type": "product",
        })
        print("will add mentoring")
    else:
        print("mentoring already in 02")

    academy_url = "https://www.alanranger.com/free-online-photography-course"
    if academy_url.lower() not in urls:
        offers = make_offer("SQ-ACADEMY-ANNUAL", 79.0, "Alan Ranger Academy — Annual Membership £79/yr")
        new_rows.append({
            "name": "Free Online Photography Course",
            "description": "Free online photography course from the Alan Ranger photography academy. 60 modules covering camera settings, gear, composition, genres and practical exercises. 14-day free trial; £79/year membership.",
            "image": "https://images.squarespace-cdn.com/content/v1/5013f4b2c4aaa4752ac69b17/72b72191-5a88-45c1-85cc-db9f7e0032b7/FREE+online+photography+course",
            "url": academy_url,
            "category": "photography-academy, online-course",
            "offers": json.dumps(offers),
            "total_variants": 1,
            "lowest_price": 79.0,
            "highest_price": 79.0,
            "skus": "SQ-ACADEMY-ANNUAL",
            "main_sku": "SQ-ACADEMY-ANNUAL",
            "schema_type": "product",
        })
        print("will add academy")
    else:
        print("academy already in 02")

    if new_rows:
        shutil.copy2(prod_path, prod_path.with_suffix(prod_path.suffix + ".backup-2026-10-06-schema-fixes"))
        df2 = pd.concat([df, pd.DataFrame(new_rows)], ignore_index=True)
        df2.to_excel(prod_path, index=False, engine="openpyxl")
        print("wrote 02 products, n=", len(df2))
    else:
        print("02 unchanged, n=", len(df))

    repo = ST / "alanranger-schema"
    for fname, page_url, org_id in [
        ("organization-homepage-reviews.json", "https://www.alanranger.com", "https://www.alanranger.com/#org"),
        ("organization-about-reviews.json", "https://www.alanranger.com/about-alan-ranger", "https://www.alanranger.com/#org"),
    ]:
        p = repo / fname
        data = json.loads(p.read_text(encoding="utf-8"))
        data["@id"] = org_id
        if "url" not in data:
            data["url"] = page_url
        p.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        print("updated", fname)

    print("DONE patches")


if __name__ == "__main__":
    main()
