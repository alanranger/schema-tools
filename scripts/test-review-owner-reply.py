#!/usr/bin/env python3
"""Tests for review_owner_reply.py (run: npm run test:review-owner-reply)."""
import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from review_owner_reply import owner_reply_fields, owner_reply_text, strip_greeting  # noqa: E402

TRUSTPILOT_ROW = {
    "review_username": "GT",
    "review_stars": "1.0",
    "review_content": "Not for me.",
    "company_response": "  Thank you for the feedback, I'm sorry the weather let us down.  ",
    "review_consumer_user_id": "5a1b2c3d",
    "domain_url": "https://www.alanranger.com",
    "tags": "workshop",
}


def test_trustpilot_reply_becomes_comment():
    review = {"@type": "Review", "author": {"@type": "Person", "name": "GT"}}
    review.update(owner_reply_fields(TRUSTPILOT_ROW))
    assert review["comment"] == {
        "@type": "Comment",
        "author": {"@type": "Organization", "name": "Alan Ranger Photography"},
        "text": "Thank you for the feedback, I'm sorry the weather let us down.",
    }


def reply(text):
    return (owner_reply_fields({"company_response": text}).get("comment") or {}).get("text", "")


def test_greeting_name_is_dropped():
    assert reply("Tracey, thank you for the feedback.") == "Thank you for the feedback."
    assert reply("Hi John, great to meet you") == "Great to meet you"
    assert reply("Dear Sue & Pete, lovely weekend") == "Lovely weekend"
    assert reply("Dear Sue and Pete - lovely weekend") == "Lovely weekend"
    assert reply("Mary Jane Smith! what a day") == "What a day"
    assert reply("hello Ros \u2013 thanks") == "Thanks"


def test_ordinary_openers_are_kept():
    for text in ("Thank you, much appreciated", "Thank you, Jade.  Much appreciated.", "Many thanks, Bob",
                 "Wow, what a shot", "Yes, see you soon", "Great, thanks", "Glad, you enjoyed it",
                 "Naturally, I feel this is unfair", "Lovely to meet you, Anne"):
        assert reply(text) == text, text


def test_thanks_name_is_kept():
    # "Thanks" is an ordinary opener, so "Thanks Mark!" stays whole: stripping only the name would
    # need a second rule the question did not ask for. It shows up in the reviewer-name report instead.
    assert reply("Thanks Mark!") == "Thanks Mark!"
    assert strip_greeting("Thanks Mark, appreciated") == "Thanks Mark, appreciated"


def test_hyphenated_name_and_no_greeting_dash():
    assert reply("Anne-Marie, thank you") == "Thank you"
    assert reply("Self-catering was fine") == "Self-catering was fine"


def test_empty_or_greeting_only_reply_adds_nothing():
    assert reply("") == ""
    assert owner_reply_fields({"company_response": "Tracey!"}) == {}


def test_only_reply_text_is_emitted():
    out = json.dumps(owner_reply_fields(TRUSTPILOT_ROW))
    for leak in ("5a1b2c3d", "alanranger.com", "workshop", "GT", "Not for me"):
        assert leak not in out, leak


def test_no_reply_adds_nothing():
    for empty in ("", "   ", None, float("nan"), "nan", "None"):
        assert owner_reply_fields({"company_response": empty}) == {}
    assert owner_reply_fields({"review_username": "No column"}) == {}


def test_pandas_rows_from_combined_csv():
    df = pd.DataFrame([
        {"source": "Trustpilot", "company_response": "Thanks Andy!"},
        {"source": "Google", "company_response": None},
    ])
    assert owner_reply_text(df.iloc[0]) == "Thanks Andy!"
    assert owner_reply_fields(df.iloc[1]) == {}


def test_google_reply_uses_same_column():
    row = {"source": "Google", "reviewer": "Jo G", "company_response": "Thanks Jo"}
    assert owner_reply_fields(row)["comment"]["text"] == "Thanks Jo"


if __name__ == "__main__":
    test_trustpilot_reply_becomes_comment()
    test_greeting_name_is_dropped()
    test_ordinary_openers_are_kept()
    test_thanks_name_is_kept()
    test_hyphenated_name_and_no_greeting_dash()
    test_empty_or_greeting_only_reply_adds_nothing()
    test_only_reply_text_is_emitted()
    test_no_reply_adds_nothing()
    test_pandas_rows_from_combined_csv()
    test_google_reply_uses_same_column()
    print("✅ review owner reply tests passed")
