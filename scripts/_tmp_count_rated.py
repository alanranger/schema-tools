import pandas as pd
from pathlib import Path
p = next(Path(r"G:\Dropbox\alan ranger photography\Website Code\alan-shared-resources\csv processed").glob("03*combined_product_reviews.csv"))
df = pd.read_csv(p)
cols = [c for c in df.columns if "slug" in c.lower()]
print("slug cols", cols)
sc = cols[0]
for slug in [
    "private-online-photography-classes-zoom",
    "beginners-photography-course",
    "lightroom-courses-for-beginners-coventry",
    "woodland-photography-walk-warwickshire",
    "four-private-photography-classes",
]:
    exact = df[df[sc].astype(str).str.strip().str.lower().str.split("/").str[-1] == slug]
    rated = exact["ratingvalue"].notna().sum() if "ratingvalue" in exact.columns else "?"
    print(slug, "rows", len(exact), "rated", rated)
