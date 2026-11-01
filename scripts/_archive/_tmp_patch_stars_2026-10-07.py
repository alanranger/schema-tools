"""Patch product-page-loader.js: per-review and aggregate stars from ratings."""
from pathlib import Path

p = Path(r"G:\Dropbox\alan ranger photography\Website Code\Schema Tools\scripts\assets\product-page-loader.js")
t = p.read_text(encoding="utf-8")

helpers = """
  function arStars(n) {
    n = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
    var s = '';
    for (var i = 1; i <= 5; i++) s += (i <= n ? '\\u2605' : '\\u2606');
    return s;
  }
  /** Aggregate badge/heading: nearest whole star. */
  function arStarsAgg(val) {
    return arStars(Math.round(Number(val) || 0));
  }

"""

if "function arStars(" not in t:
    mark = "  installCoreSuppressorV21();"
    if mark not in t:
        raise SystemExit("install mark missing")
    t = t.replace(mark, helpers + mark)

# rcard: both forks share identical return line
old_stars = '<div class="st">\\u2605\\u2605\\u2605\\u2605\\u2605</div>'
new_stars = '<div class="st">' + "' + arStars(rv.reviewRating && rv.reviewRating.ratingValue) + '" + "</div>"
# Careful — build exact replacement used in file
old_ret = (
    "return '<div class=\"ar-rev\" tabindex=\"0\"><div class=\"st\">\\u2605\\u2605\\u2605\\u2605\\u2605</div>"
    "<div class=\"w\">' + esc(rv.author && rv.author.name) + ' <span class=\"s\">' + esc(srcName) + "
    "'</span></div><p>\\u201c' + esc(body) + '\\u201d</p>"
    "<span class=\"ar-rev-more\" aria-hidden=\"true\">Read more \\u25be</span></div>';"
)
new_ret = (
    "var starN = (rv.reviewRating && rv.reviewRating.ratingValue != null) ? rv.reviewRating.ratingValue : 5;\n"
    "                return '<div class=\"ar-rev\" tabindex=\"0\"><div class=\"st\">' + arStars(starN) + '</div>"
    "<div class=\"w\">' + esc(rv.author && rv.author.name) + ' <span class=\"s\">' + esc(srcName) + "
    "'</span></div><p>\\u201c' + esc(body) + '\\u201d</p>"
    "<span class=\"ar-rev-more\" aria-hidden=\"true\">Read more \\u25be</span></div>';"
)
if t.count(old_ret) != 2:
    raise SystemExit(f"rcard return count={t.count(old_ret)}")
t = t.replace(old_ret, new_ret)

# badge hard-coded five stars
old_badge = "'<span class=\"ar-stars\">\\u2605\\u2605\\u2605\\u2605\\u2605</span> <b>' + esc(agg.ratingValue)"
new_badge = "'<span class=\"ar-stars\">' + arStarsAgg(agg.ratingValue) + '</span> <b>' + esc(agg.ratingValue)"
if t.count(old_badge) != 2:
    raise SystemExit(f"badge count={t.count(old_badge)}")
t = t.replace(old_badge, new_badge)

# heading sub stars
old_sub = "'<div class=\"ar-sub\"><span class=\"ar-stars\">\\u2605\\u2605\\u2605\\u2605\\u2605</span> <b>' + esc(ratingVal)"
new_sub = "'<div class=\"ar-sub\"><span class=\"ar-stars\">' + arStarsAgg(ratingVal) + '</span> <b>' + esc(ratingVal)"
if t.count(old_sub) != 2:
    raise SystemExit(f"sub count={t.count(old_sub)}")
t = t.replace(old_sub, new_sub)

p.write_text(t, encoding="utf-8")
print("loader patched")
