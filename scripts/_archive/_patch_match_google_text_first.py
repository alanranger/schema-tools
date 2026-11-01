"""Patch match-google-reviews.py: text/alias before date-cluster matching."""
from pathlib import Path

p = Path(__file__).with_name('match-google-reviews.py')
text = p.read_text(encoding='utf-8')

old = """    # Strategy 0a: Date cluster matching (if review is in a cluster with matched reviews)
    if review_date and pd.notna(review_date) and date_cluster_map:
        # Check if this review date falls within any cluster
        for cluster_date, cluster_product in date_cluster_map.items():
            days_diff = abs((review_date - cluster_date).days)
            if days_diff <= 7:  # Within 7 days of cluster
                if cluster_product and cluster_product in product_by_slug:
                    return cluster_product
    
    # Strategy 0b: Date-based matching with events (highest priority if date available)
    if review_date and pd.notna(review_date) and events_df is not None and len(events_df) > 0:
        # Find events within 14 days of review date
        nearby_events = events_df[
            (events_df['start_date_parsed'] >= review_date - timedelta(days=14)) &
            (events_df['start_date_parsed'] <= review_date + timedelta(days=14))
        ]
        
        if len(nearby_events) > 0:
            best_match = None
            best_score = 0
            
            for event_idx, event_row in nearby_events.iterrows():
                event_title = str(event_row.get('Event_Title', '')).lower()
                event_location = str(event_row.get('Location_Business_Name', '') or event_row.get('Location_Name', '') or '').lower()
                event_url = str(event_row.get('Event_URL', '')).strip()
                
                # Score based on:
                # 1. Text matching (0.4 weight)
                # 2. Date proximity (0.4 weight) - increased importance
                # 3. Location matching (0.2 weight)
                score = 0
                
                # Text matching
                if event_title:
                    title_words = [w for w in event_title.split() if len(w) > 4]
                    matches = sum(1 for word in title_words if word in combined_lower)
                    if matches > 0:
                        score += 0.4 * (matches / max(len(title_words), 1))
                
                # Date proximity (closer = higher score) - more weight
                days_diff = abs((event_row['start_date_parsed'] - review_date).days)
                date_score = 1.0 / (1 + days_diff / 5)  # Decay over 5 days (tighter)
                score += 0.4 * date_score
                
                # Location matching
                if event_location and event_location in combined_lower:
                    score += 0.2
                
                if score > best_score:
                    best_score = score
                    best_match = event_row
            
            # Lower threshold for date-based matching (score > 0.2)
            if best_match is not None and best_score > 0.2:
                event_url = str(best_match.get('Event_URL', '')).strip()
                if event_url:
                    # Extract product slug from event URL
                    event_slug = event_url.split('/')[-1].strip()
                    if event_slug in product_by_slug:
                        return event_slug
    
    # Strategy 1: Check aliases in review text (longest phrase first"""

new = """    # TEXT FIRST (Alan 2026-10-06): aliases/keywords beat date-window/cluster matching.
    # Strategy 1: Check aliases in review text (longest phrase first"""

if old not in text:
    raise SystemExit('OLD BLOCK NOT FOUND — already patched?')
text = text.replace(old, new, 1)

idx = text.find('def match_google_review_to_product')
idx2 = text.find('\ndef ', idx + 1)
fn = text[idx:idx2]
if 'DATE FALLBACK' in fn:
    print('fallback already present')
else:
    fallback = '''
    # DATE FALLBACK only when text/alias produced nothing
    if review_date and pd.notna(review_date) and date_cluster_map:
        for cluster_date, cluster_product in date_cluster_map.items():
            days_diff = abs((review_date - cluster_date).days)
            if days_diff <= 7 and cluster_product and cluster_product in product_by_slug:
                return cluster_product
    if review_date and pd.notna(review_date) and events_df is not None and len(events_df) > 0:
        nearby_events = events_df[
            (events_df['start_date_parsed'] >= review_date - timedelta(days=14)) &
            (events_df['start_date_parsed'] <= review_date + timedelta(days=14))
        ]
        best_match = None
        best_score = 0.0
        for _, event_row in nearby_events.iterrows():
            event_title = str(event_row.get('Event_Title', '')).lower()
            event_location = str(
                event_row.get('Location_Business_Name', '')
                or event_row.get('Location_Name', '')
                or ''
            ).lower()
            score = 0.0
            if event_title:
                title_words = [w for w in event_title.split() if len(w) > 4]
                matches = sum(1 for word in title_words if word in combined_lower)
                if matches > 0:
                    score += 0.5 * (matches / max(len(title_words), 1))
            days_diff = abs((event_row['start_date_parsed'] - review_date).days)
            score += 0.3 / (1 + days_diff / 5)
            if event_location and event_location in combined_lower:
                score += 0.2
            # Require text/location signal — never date-only
            if score > best_score and score >= 0.35:
                best_score = score
                best_match = event_row
        if best_match is not None:
            event_url = str(best_match.get('Event_URL', '')).strip()
            if event_url:
                event_slug = event_url.split('/')[-1].strip()
                if event_slug in product_by_slug:
                    return event_slug

    return None
'''
    last = fn.rfind('    return None')
    if last < 0:
        raise SystemExit('no return None in function')
    fn2 = fn[:last] + fallback
    text = text[:idx] + fn2 + text[idx2:]

p.write_text(text, encoding='utf-8')
print('OK patched', p)
