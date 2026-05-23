import os
import json
import logging
import uuid
from datetime import datetime, timezone, timedelta

import requests
import feedparser
import praw

from backend.utils.config import (
    EMERGENCY_KEYWORDS,
    REDDIT_CLIENT_ID,
    REDDIT_CLIENT_SECRET,
    RSS_URL,
    USER_AGENT,
)

logging.basicConfig(level=logging.INFO)

NOW = datetime.now(timezone.utc)
SINCE = NOW - timedelta(hours=48)


def _is_emergency(text: str) -> bool:
    """Check if text contains any emergency keyword."""
    text_lower = text.lower()
    return any(kw in text_lower for kw in EMERGENCY_KEYWORDS)


def fetch_rss() -> list[dict]:
    """Fetch Google News RSS and filter for emergency-related items."""
    logging.info("Fetching Google News RSS for emergencies...")
    try:
        r = requests.get(RSS_URL, headers={"User-Agent": USER_AGENT}, timeout=10)
        r.raise_for_status()
    except Exception as e:
        logging.error(f"Failed to fetch RSS: {e}")
        return []

    feed = feedparser.parse(r.content)
    items = []
    for entry in feed.entries:
        parsed = entry.get("published_parsed")
        if not parsed:
            continue
        pub = datetime(*parsed[:6], tzinfo=timezone.utc)
        if pub < SINCE:
            continue

        title = entry.get("title", "").strip()
        summary = entry.get("summary", "").strip()
        combined_text = f"{title} {summary}"

        if not _is_emergency(combined_text):
            continue

        items.append({
            "id": str(uuid.uuid4()),
            "source": "news",
            "title": title,
            "link": entry.get("link", "").strip(),
            "text": summary,
            "raw_text": combined_text,
            "published": pub.isoformat(),
            "ingested_at": datetime.now(timezone.utc).isoformat(),
            "media_urls": [],
        })

    logging.info(f"  -> {len(items)} emergency news items after filtering")
    return items


def fetch_reddit() -> list[dict]:
    """Fetch r/bangalore Reddit posts and filter for emergencies."""
    logging.info("Fetching r/bangalore Reddit posts for emergencies...")

    if not REDDIT_CLIENT_ID or not REDDIT_CLIENT_SECRET:
        logging.warning("Reddit credentials not set, skipping Reddit ingestion")
        return []

    reddit = praw.Reddit(
        client_id=REDDIT_CLIENT_ID,
        client_secret=REDDIT_CLIENT_SECRET,
        user_agent=USER_AGENT,
    )
    items = []
    try:
        for submission in reddit.subreddit("bangalore").new(limit=50):
            ts = datetime.fromtimestamp(submission.created_utc, timezone.utc)
            if ts < SINCE:
                continue

            combined_text = f"{submission.title} {submission.selftext}"
            if not _is_emergency(combined_text):
                continue

            items.append({
                "id": f"reddit_{submission.id}",
                "source": "reddit",
                "title": submission.title.strip(),
                "link": f"https://reddit.com{submission.permalink}",
                "text": submission.selftext.strip(),
                "raw_text": combined_text.strip(),
                "published": ts.isoformat(),
                "ingested_at": datetime.now(timezone.utc).isoformat(),
                "media_urls": [],
            })
        logging.info(f"  -> {len(items)} emergency reddit posts after filtering")
    except Exception as e:
        logging.error(f"Reddit fetch failed: {e}")
    return items


def ingest_user_report(
    text: str,
    location: dict,
    timestamp: str,
    media_urls: list[str] = None,
) -> dict:
    """Create an incident dict from a user-submitted report."""
    return {
        "id": str(uuid.uuid4()),
        "source": "user_report",
        "title": text[:80],
        "link": None,
        "text": text,
        "raw_text": text,
        "published": timestamp,
        "ingested_at": datetime.now(timezone.utc).isoformat(),
        "media_urls": media_urls or [],
        "location": location,
    }


def run_ingestion() -> list[dict]:
    """Run all ingestion sources and return combined emergency events."""
    news = fetch_rss()
    reddit = fetch_reddit()
    all_items = news + reddit
    logging.info(f"Total ingested emergency items: {len(all_items)}")
    return all_items


if __name__ == "__main__":
    data = run_ingestion()
    print(json.dumps(data[:3], indent=2))
