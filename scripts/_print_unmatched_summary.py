import pandas as pd
df = pd.read_csv(r"G:\Dropbox\alan ranger photography\Website Code\alan-shared-resources\csv processed\13-unmatched-google-booking-proposals.csv")
for cat in ["quote_only_no_booking", "no_match", "non_workshop_likely"]:
    print(f"\n=== {cat.upper()} ({len(df[df.category==cat])}) ===")
    for _, r in df[df.category == cat].iterrows():
        snip = str(r["review_snippet"])[:75]
        extra = f" hints={r['quote_location_hints']}" if cat == "quote_only_no_booking" else ""
        print(f"- {r['reviewer_name']} ({r['review_date']}){extra} | {snip}")
