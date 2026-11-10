"""
Owner replies on product reviews -> schema.org Review.comment.

Trustpilot exports carry Alan's reply in `company_response`; Google rows carry it in the same
column once fetch-google-reviews.py has read the API's `reviewReply`. The product page loader
shows it under the card as "Reply from Alan".

Only the reply text is emitted: never reviewer emails or any other export column.
A leading greeting that names the reviewer ("Tracey, ...", "Hi John, ...", "Dear Sue & Pete - ...")
is dropped so the page shows no more of the reviewer's name than the review itself does.
"""
import re

REPLY_COLUMNS = ("company_response",)
OWNER_NAME = "Alan Ranger Photography"

_NAME = r"[A-Z][\w'\u2019-]*"
GREETING_RE = re.compile(
    r"^(?P<hello>(?i:hi|hello|dear|hey)\s+)?"
    rf"(?P<names>{_NAME}(?:(?:\s+(?:&|and)\s+|\s+){_NAME}){{0,2}})"
    r"\s*(?:,|!+|[\u2013\u2014]|(?<=\s)-)\s*"
)
# First words that open an ordinary sentence, not a name: never stripped (err on keeping text).
KEEP_OPENERS = frozenset((
    "thank", "thanks", "many", "much", "wow", "yes", "great", "glad", "cheers", "sorry", "apologies",
    "absolutely", "brilliant", "lovely", "wonderful", "fantastic", "excellent", "amazing", "superb",
    "perfect", "delighted", "pleased", "good", "nice", "welcome", "congratulations", "congrats",
    "appreciated", "well", "so", "oh", "ah", "ok", "okay", "no", "sadly", "unfortunately", "naturally",
    "however", "indeed", "really", "very", "again", "firstly", "i", "we", "it", "this", "that", "what",
    "hope", "fab", "fabulous", "super",
))


def owner_reply_text(row):
    """First non-empty reply cell on a review row (pandas Series or dict); '' when none."""
    for col in REPLY_COLUMNS:
        val = row.get(col)
        text = "" if val is None else str(val).strip()
        if text and text.lower() not in ("nan", "none"):
            return text
    return ""


def strip_greeting(text):
    """Drop a leading 'Name,' / 'Hi Name!' / 'Dear A & B -' greeting; capitalise what remains."""
    m = GREETING_RE.match(text)
    if not m or m.group("names").split()[0].lower() in KEEP_OPENERS:
        return text
    rest = text[m.end():].strip()
    return rest[:1].upper() + rest[1:]


def owner_reply_fields(row):
    """{'comment': Comment} to merge into a Review, or {} when the review has no reply."""
    text = strip_greeting(owner_reply_text(row))
    if not text:
        return {}
    return {
        "comment": {
            "@type": "Comment",
            "author": {"@type": "Organization", "name": OWNER_NAME},
            "text": text,
        }
    }
