"""
PROPOSALS ONLY — write 17-review-match-proposals-2026-10-06.csv
Do not touch product_reviews / 03 / 03b / 04 / schema.
"""
from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
from supabase import create_client

SHARED = Path(r"G:\Dropbox\alan ranger photography\Website Code\alan-shared-resources")
CSV = SHARED / "csv processed"
RAW = SHARED / "csv" / "raw-03b-google-reviews.csv"
OUT = CSV / "17-review-match-proposals-2026-10-06.csv"
ENV = Path(r"G:\Dropbox\alan ranger photography\Website Code\AI GEO Audit") / ".env.vercel.prod"
PR_EXPORT = Path(r"C:\TEMP\pr-google.json")


def load_env(path: Path) -> dict:
    env = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line or line.strip().startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def norm_name(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s or ""))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def name_parts(s: str) -> tuple[str, str, list[str]]:
    n = norm_name(s)
    parts = [p for p in n.split() if p]
    if not parts:
        return "", "", []
    return parts[0], parts[-1], parts


def name_match_score(reviewer: str, client: str) -> tuple[float, str]:
    """Return (score 0-1, kind)."""
    rn, rs, rparts = name_parts(reviewer)
    cn, cs, cparts = name_parts(client)
    if not rn or not cn:
        return 0.0, "none"
    if norm_name(reviewer) == norm_name(client):
        return 1.0, "exact"
    # first + last
    if rn == cn and rs == cs and len(rparts) >= 2 and len(cparts) >= 2:
        return 0.95, "first_last"
    # surname + first initial
    if rs == cs and rn[:1] == cn[:1] and len(rs) > 2:
        return 0.8, "surname_initial"
    # surname only (unique-ish length)
    if rs == cs and len(rs) >= 5:
        return 0.55, "surname_only"
    # first name only weak
    if rn == cn and len(rn) >= 4 and len(rparts) == 1:
        return 0.4, "first_only"
    # containment
    if norm_name(reviewer) in norm_name(client) or norm_name(client) in norm_name(reviewer):
        if len(rs) >= 4 and rs in norm_name(client):
            return 0.7, "contains"
    return 0.0, "none"


LOCATION_HINTS = {
    "kenilworth": ["long-exposure-photography-kenilworth", "fireworks"],
    "hartland": ["landscape-photography-devon-hartland-quay"],
    "anglesey": ["landscape-photography-workshops-anglesey"],
    "lightroom": ["lightroom-courses-for-beginners-coventry"],
    "sensor": ["camera-sensor-clean"],
    "bluebell": ["bluebell-woodlands-photography-workshops"],
    "batsford": ["batsford-arboretum-photography-workshops"],
    "lavender": ["photography-workshops-lavender-fields"],
    "peak": ["peak-district-heather-photography-workshop", "landscape-peak-district-photography-workshops-derbyshire"],
    "hope": ["peak-district-heather-photography-workshop", "landscape-peak-district-photography-workshops-derbyshire"],
    "padley": ["landscape-peak-district-photography-workshops-derbyshire"],
    "woodland": ["secrets-of-woodland-photography-workshop", "woodland-photography-walk-warwickshire"],
    "rps": ["rps-mentoring-photography-course"],
    "beginners": ["beginners-photography-course"],
    "composition": ["beginners-photography-course"],
    "zoom": ["private-online-photography-classes-zoom"],
    "1hr zoom": ["private-online-photography-classes-zoom"],
    "4 x 1hr": ["private-online-photography-classes-zoom"],
    "sezincote": ["sezincote-garden-photography-workshop"],
    "macro": ["abstract-and-macro-photography-workshops"],
    "commercial": ["professional-commercial-photographer-coventry"],
    "portrait": ["professional-commercial-photographer-coventry", "beginners-portrait-photography-course"],
    "author": ["professional-commercial-photographer-coventry"],
    "121": ["private-online-photography-classes-zoom"],
    "1-2-1": ["private-online-photography-classes-zoom"],
    "f2f": ["private-photography-tuition-face-to-face"],
}


def text_hints(text: str) -> set[str]:
    if text is None or (isinstance(text, float) and pd.isna(text)):
        return set()
    t = str(text).lower()
    if t in ("", "nan", "none"):
        return set()
    hits = set()
    for k, slugs in LOCATION_HINTS.items():
        if k in t:
            hits.update(slugs)
    return hits


def excerpt(text: str, n: int = 120) -> str:
    t = re.sub(r"\s+", " ", str(text or "").strip())
    return t[:n]


def parse_date(s) -> datetime | None:
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return None
    s = str(s).strip()[:10]
    try:
        return datetime.strptime(s, "%Y-%m-%d")
    except ValueError:
        return None


def load_product_catalog(shared: Path) -> list[dict]:
    """slug + name tokens from products workbook."""
    hits = list((shared / "csv processed").glob("02*products*"))
    if not hits:
        return []
    pdf = pd.read_excel(hits[0], engine="openpyxl")
    rows = []
    for _, r in pdf.iterrows():
        url = str(r.get("url") or "")
        slug = url.rstrip("/").split("/")[-1] if url and url != "nan" else ""
        name = str(r.get("name") or "")
        if not slug:
            continue
        rows.append({"slug": slug, "name": name, "url": url})
    return rows


def slug_from_booking(row: dict, products: list[dict], canon_by_title: dict) -> str:
    """Prefer specific product page over generic service hub landing URLs."""
    el = (row.get("event_label") or "").strip()
    cp = (row.get("canonical_product") or "").strip()
    cat = (row.get("category_label") or "").strip().lower()
    blob = f"{el} {cp}".lower()

    # Commission / commercial shoots → commercial service page (not a workshop)
    if "commission" in cat or "commission" in cp.lower() or "author photo" in blob or "product shoot" in blob:
        if "portrait" in blob and "commercial" not in cp.lower():
            # still commercial booking sheet product
            return "professional-commercial-photographer-coventry"
        return "professional-commercial-photographer-coventry"

    # RPS mentoring
    if "rps" in blob or "rps" in cat:
        return "rps-mentoring-photography-course"

    # 1) Direct product name / slug token overlap (score)
    best = ("", 0)
    for p in products:
        score = 0
        name_l = p["name"].lower()
        slug = p["slug"]
        tokens = [t for t in re.split(r"[^a-z0-9]+", name_l) if len(t) >= 5]
        hits = sum(1 for t in tokens if t in blob)
        if hits:
            score = hits * 10 + len(slug)
        for hint, slugs in LOCATION_HINTS.items():
            if hint in blob and slug in slugs:
                score = max(score, 50 + len(hint))
        if score > best[1]:
            best = (slug, score)
    if best[1] >= 10:
        return best[0]

    # 2) canonical_products title map → product_url (not service hub)
    if cp in canon_by_title:
        u = (canon_by_title[cp] or "").rstrip("/")
        if u:
            return u.split("/")[-1]
    cpl = cp.lower()
    for title, u in canon_by_title.items():
        if title and title.lower() in cpl:
            uu = (u or "").rstrip("/")
            if uu:
                return uu.split("/")[-1]

    # Prefer longest hint keys first so "1hr zoom" beats "zoom"
    for hint, slugs in sorted(LOCATION_HINTS.items(), key=lambda x: len(x[0]), reverse=True):
        if hint in blob and slugs:
            catalog = {p["slug"] for p in products} if products else set()
            for s in slugs:
                if not catalog or s in catalog:
                    return s
            return slugs[0]

    # 4) landing_page_url last — often a hub
    url = (row.get("landing_page_url") or "").rstrip("/")
    if url:
        return url.split("/")[-1]
    return ""


def text_agrees(review_text: str, proposed_slug: str, event_label: str, canonical: str) -> str:
    """consistent | neutral | contradicts"""
    hints = text_hints(review_text)
    if not hints:
        return "neutral"
    if not proposed_slug:
        return "neutral"
    if proposed_slug in hints:
        return "consistent"
    # any hint slug family overlap with event words
    blob = f"{event_label} {canonical} {proposed_slug}".lower()
    for h in hints:
        stem = h.split("-")[0]
        if stem and stem in blob:
            return "consistent"
    # commercial vs workshop contradict
    commercial = {"professional-commercial-photographer-coventry"}
    workshopish = hints - commercial
    if proposed_slug in commercial and workshopish:
        return "contradicts"
    if proposed_slug not in commercial and hints & commercial and not workshopish:
        return "contradicts"
    # peak ambiguity: two peak slugs — treat as neutral not contradict if peak in text
    if "peak" in (review_text or "").lower() and "peak" in proposed_slug:
        return "neutral"
    if hints and proposed_slug not in hints:
        # soft: if no shared token, contradict
        prop_tokens = set(proposed_slug.split("-"))
        hint_tokens = set()
        for h in hints:
            hint_tokens |= set(h.split("-"))
        if prop_tokens & hint_tokens:
            return "neutral"
        return "contradicts"
    return "neutral"


def confidence_for(name_score: float, name_kind: str, days: int | None, agree: str) -> str:
    if days is None or days < 0 or agree == "contradicts":
        return "LOW"
    if name_score >= 0.9 and days <= 30 and agree in ("consistent", "neutral"):
        return "HIGH"
    if name_score >= 0.8 and days <= 30 and agree == "consistent":
        return "HIGH"
    if name_score >= 0.7 and days <= 90 and agree in ("consistent", "neutral"):
        return "MEDIUM"
    if name_score >= 0.55 and days <= 30 and agree == "consistent":
        return "MEDIUM"
    if name_score >= 0.8 and days <= 90 and agree == "neutral":
        return "MEDIUM"
    return "LOW"


def main():
    env = load_env(ENV)
    sb = create_client(env["SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"])

    # bookings 2018+ (covers older LOW rows)
    bookings = []
    start = 0
    page = 1000
    while True:
        res = (
            sb.table("booking_sheet_transactions")
            .select("client_name,txn_date,event_label,canonical_product,landing_page_url,category_label")
            .gte("txn_date", "2018-01-01")
            .order("txn_date")
            .range(start, start + page - 1)
            .execute()
        )
        batch = res.data or []
        bookings.extend(batch)
        if len(batch) < page:
            break
        start += page
    print("bookings", len(bookings))

    products = load_product_catalog(SHARED)
    print("products", len(products))

    canon = sb.table("canonical_products").select("product_title,product_url,service_page_url").execute().data or []
    canon_by_title = {}
    for c in canon:
        title = c.get("product_title") or ""
        url = c.get("product_url") or ""
        if title and url:
            canon_by_title[title] = url

    # GBP count
    gbp = None
    try:
        ar = (
            sb.table("audit_results")
            .select("gbp_review_count,audit_date,updated_at")
            .not_.is_("gbp_review_count", "null")
            .order("audit_date", desc=True)
            .limit(5)
            .execute()
        )
        if ar.data:
            gbp = ar.data[0].get("gbp_review_count")
            print("gbp_audit", ar.data[0])
    except Exception as e:
        print("gbp audit err", e)

    raw = pd.read_csv(RAW, encoding="utf-8-sig")
    g03b = pd.read_csv(CSV / "03b_google_matched.csv", encoding="utf-8-sig")
    ch = pd.read_csv(CSV / "16-review-reattribution-changes-2026-10-06.csv", encoding="utf-8-sig")
    low = ch[ch["confidence"].astype(str).str.upper() == "LOW"].copy()

    pr = json.loads(PR_EXPORT.read_text(encoding="utf-8"))
    pr_df = pd.DataFrame(pr)
    pr_df["_n"] = pr_df["reviewer_name"].map(norm_name)

    def rkey(name, date):
        return f"{norm_name(name)}|{str(date)[:10]}"

    raw["_k"] = [rkey(a, b) for a, b in zip(raw["reviewer"], raw["date"])]
    raw["_n"] = raw["reviewer"].map(norm_name)
    g03b["_k"] = [rkey(a, b) for a, b in zip(g03b["reviewer"], g03b["date"])]
    pr_df["_k"] = [rkey(a, b) for a, b in zip(pr_df["reviewer_name"], pr_df["review_date"])]
    pr_keys = set(pr_df["_k"])
    pr_null_date_names = set(
        pr_df.loc[pr_df["review_date"].isna() | (pr_df["review_date"].astype(str) == "None"), "_n"]
    )
    g03b_keys = set(g03b["_k"])

    def is_in_pr(name_norm: str, key: str) -> bool:
        return key in pr_keys or name_norm in pr_null_date_names

    # Map 03b for current slug / text
    g03b_by_k = {r["_k"]: r for _, r in g03b.iterrows()}
    raw_by_k = {r["_k"]: r for _, r in raw.iterrows()}

    # ---- Scope A: LOW 15 ----
    rows_out = []
    gap_reason_counts = {
        "not_in_raw_scrape": 0,
        "raw_no_text": 0,
        "not_in_03b_with_text": 0,
        "03b_blank_slug_not_ingested": 0,
        "03b_empty_quote_ingest_skipped": 0,
        "in_product_reviews": 0,
    }

    def best_booking(reviewer: str, review_date: datetime, review_text: str):
        candidates = []
        for b in bookings:
            bd = parse_date(b.get("txn_date"))
            if not bd or not review_date:
                continue
            if bd > review_date:
                continue
            days = (review_date - bd).days
            if days > 120:
                continue
            score, kind = name_match_score(reviewer, b.get("client_name") or "")
            if score < 0.55:
                continue
            slug = slug_from_booking(b, products, canon_by_title)
            agree = text_agrees(review_text, slug, b.get("event_label") or "", b.get("canonical_product") or "")
            if agree == "contradicts":
                continue
            conf = confidence_for(score, kind, days, agree)
            candidates.append(
                {
                    "score": score,
                    "kind": kind,
                    "days": days,
                    "agree": agree,
                    "conf": conf,
                    "booking": b,
                    "slug": slug,
                }
            )
        if not candidates:
            return None
        # prefer HIGH, then fewer days, then higher name score
        rank = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
        candidates.sort(key=lambda c: (rank.get(c["conf"], 9), c["days"], -c["score"]))
        return candidates[0]

    def build_row(scope: str, reviewer, date, rating, text, current_slug, why_gap: str):
        rd = parse_date(date)
        has_text = bool(str(text or "").strip())
        match = best_booking(reviewer, rd, text) if has_text or True else None
        if match and match["conf"] in ("HIGH", "MEDIUM"):
            proposed = match["slug"]
            b = match["booking"]
            evidence = (
                f"name={match['kind']}({match['score']:.2f}); "
                f"days_before={match['days']}; text={match['agree']}; "
                f"cat={b.get('category_label')}"
            )
            conf = match["conf"]
            # if HIGH/MEDIUM but no slug mapped → LOW
            if not proposed:
                conf = "LOW"
                evidence += "; no_slug_from_booking"
            return {
                "review_source": scope,
                "reviewer_name": reviewer,
                "review_date": str(date)[:10],
                "rating": rating,
                "has_text": "yes" if has_text else "no",
                "review_excerpt": excerpt(text),
                "current_slug": current_slug or "",
                "proposed_slug": proposed if conf != "LOW" else "",
                "matched_client_name": b.get("client_name"),
                "matched_booking_date": str(b.get("txn_date"))[:10],
                "matched_event_label": b.get("event_label"),
                "days_between": match["days"],
                "evidence": evidence,
                "confidence": conf,
                "why_not_in_product_reviews": why_gap,
            }
        elif match:
            b = match["booking"]
            return {
                "review_source": scope,
                "reviewer_name": reviewer,
                "review_date": str(date)[:10],
                "rating": rating,
                "has_text": "yes" if has_text else "no",
                "review_excerpt": excerpt(text),
                "current_slug": current_slug or "",
                "proposed_slug": "",
                "matched_client_name": b.get("client_name"),
                "matched_booking_date": str(b.get("txn_date"))[:10],
                "matched_event_label": b.get("event_label"),
                "days_between": match["days"],
                "evidence": f"weak name={match['kind']}({match['score']:.2f}); days={match['days']}; text={match['agree']}",
                "confidence": "LOW",
                "why_not_in_product_reviews": why_gap,
            }
        return {
            "review_source": scope,
            "reviewer_name": reviewer,
            "review_date": str(date)[:10],
            "rating": rating,
            "has_text": "yes" if has_text else "no",
            "review_excerpt": excerpt(text),
            "current_slug": current_slug or "",
            "proposed_slug": "",
            "matched_client_name": "",
            "matched_booking_date": "",
            "matched_event_label": "",
            "days_between": "",
            "evidence": "no booking name+date candidate within 120d before review",
            "confidence": "LOW",
            "why_not_in_product_reviews": why_gap,
        }

    # Scope A
    for _, lr in low.iterrows():
        k = rkey(lr["reviewer"], lr["date"])
        src = g03b_by_k.get(k)
        if src is None:
            src = raw_by_k.get(k)
        text = ""
        rating = ""
        cur = ""
        if src is not None:
            text = src["review"] if "review" in src.index else ""
            rating = src["rating"] if "rating" in src.index else ""
            if "product_slug" in src.index:
                cur = src["product_slug"]
                if pd.isna(cur) or str(cur) in ("nan", "None"):
                    cur = ""
        why = "03b_blank_slug_not_ingested" if not is_in_pr(norm_name(lr["reviewer"]), k) else "in_product_reviews_but_LOW_reattribution"
        rows_out.append(
            build_row("A_LOW_reattribution", lr["reviewer"], lr["date"], rating, text, cur or "", why)
        )

    # Scope B: in raw, not in product_reviews
    for _, rr in raw.iterrows():
        k = rr["_k"]
        if is_in_pr(rr["_n"], k):
            gap_reason_counts["in_product_reviews"] += 1
            continue
        text = rr.get("review")
        has_text = bool(str(text).strip()) if pd.notna(text) else False
        if str(text).lower() == "nan":
            has_text = False
        if k not in g03b_keys:
            if not has_text:
                why = "raw_no_text"
                gap_reason_counts["raw_no_text"] += 1
            else:
                why = "not_in_03b_with_text"
                gap_reason_counts["not_in_03b_with_text"] += 1
            cur = ""
        else:
            g = g03b_by_k[k]
            cur = g["product_slug"] if "product_slug" in g.index else ""
            if pd.isna(cur) or str(cur) in ("", "nan"):
                why = "03b_blank_slug_not_ingested"
                gap_reason_counts["03b_blank_slug_not_ingested"] += 1
                cur = ""
            else:
                why = "03b_empty_quote_ingest_skipped"
                gap_reason_counts["03b_empty_quote_ingest_skipped"] += 1
                text = g["review"] if "review" in g.index else text
        text = "" if text is None or (isinstance(text, float) and pd.isna(text)) else str(text)
        if any(
            r["review_source"].startswith("A_")
            and norm_name(r["reviewer_name"]) == norm_name(rr["reviewer"])
            and r["review_date"] == str(rr["date"])[:10]
            for r in rows_out
        ):
            continue
        rows_out.append(
            build_row("B_not_in_product_reviews", rr["reviewer"], rr["date"], rr.get("rating"), text, cur or "", why)
        )

    # Not in raw but in GBP? we can't list names — count only
    raw_n = len(raw)
    pr_n = len(pr_df)
    gbp_n = int(gbp) if gbp is not None else 282
    not_scraped = max(0, gbp_n - raw_n)
    gap_reason_counts["not_in_raw_scrape"] = not_scraped

    out_df = pd.DataFrame(rows_out)
    out_df.to_csv(OUT, index=False, encoding="utf-8-sig")
    print("wrote", OUT, "rows", len(out_df))

    # Summary stats
    for scope in ["A_LOW_reattribution", "B_not_in_product_reviews"]:
        sub = out_df[out_df.review_source == scope]
        print(
            scope,
            "n",
            len(sub),
            "HIGH",
            (sub.confidence == "HIGH").sum(),
            "MEDIUM",
            (sub.confidence == "MEDIUM").sum(),
            "LOW",
            (sub.confidence == "LOW").sum(),
        )

    print("GAP_COUNTS", json.dumps(gap_reason_counts))
    print("RAW", raw_n, "03b", len(g03b), "PR_google", pr_n, "GBP", gbp_n)
    print("B_unique_why", out_df[out_df.review_source == "B_not_in_product_reviews"]["why_not_in_product_reviews"].value_counts().to_dict())

    # dump summary json for RESPONSE
    summary = {
        "gbp": gbp_n,
        "raw": raw_n,
        "matched_03b": len(g03b),
        "product_reviews_google": pr_n,
        "gap_282_minus_204": gbp_n - pr_n,
        "gap_reason_counts": gap_reason_counts,
        "A": out_df[out_df.review_source == "A_LOW_reattribution"]["confidence"].value_counts().to_dict(),
        "B": out_df[out_df.review_source == "B_not_in_product_reviews"]["confidence"].value_counts().to_dict(),
        "out_rows": len(out_df),
        "out_file": str(OUT),
    }
    Path(r"C:\TEMP\review-match-proposals-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    # print examples
    for conf in ["HIGH", "MEDIUM", "LOW"]:
        print(f"\n=== EXAMPLES {conf} ===")
        ex = out_df[out_df.confidence == conf].head(10)
        for _, r in ex.iterrows():
            print(
                f"{r.review_source}|{r.reviewer_name}|{r.review_date}|{r.proposed_slug}|{r.matched_client_name}|{r.days_between}|{r.evidence[:80]}"
            )


if __name__ == "__main__":
    main()
