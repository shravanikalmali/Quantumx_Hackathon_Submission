"""
News Enrichment (Demoted)

Google News RSS and Reddit are used as SECONDARY context only,
not as primary emergency incident sources.

All news items are filtered through the emergency signal classifier
and labeled as "news_context" source type.
"""
import logging

from backend.ingestion.incident_ingestion import fetch_rss, fetch_reddit
from backend.prediction.emergency_signal_filter import classify_emergency_signal

logging.basicConfig(level=logging.INFO)

NEGATIVE_KEYWORDS = [
    "court", "jail", "verdict", "why did", "explained",
    "investigation underway", "all passengers safe",
    "history", "anniversary", "opinion", "editorial",
]


def _has_negative(text: str) -> bool:
    text_lower = text.lower()
    return any(kw in text_lower for kw in NEGATIVE_KEYWORDS)


def fetch_news_enrichment(min_signal_confidence: float = 0.4) -> list[dict]:
    """
    Fetch news from RSS/Reddit, filter through emergency signal classifier,
    and return only items with real emergency signal.

    Items are labeled as 'news_context' source — not primary incidents.
    """
    raw_news = fetch_rss()
    raw_reddit = fetch_reddit()
    all_raw = raw_news + raw_reddit

    logging.info(f"News enrichment: {len(all_raw)} raw items from RSS + Reddit")

    enriched = []
    for item in all_raw:
        text = item.get("raw_text", item.get("text", ""))

        # Negative keyword filter
        if _has_negative(text):
            continue

        # Emergency signal filter
        signal = classify_emergency_signal(text)
        if signal["signal_confidence"] < min_signal_confidence:
            continue

        item["source"] = "news_context"
        item["source_label"] = "External News Context"
        item["emergency_signal"] = signal
        enriched.append(item)

    logging.info(f"News enrichment: {len(enriched)} items passed emergency filter (threshold={min_signal_confidence})")
    return enriched


if __name__ == "__main__":
    import json
    items = fetch_news_enrichment()
    print(f"News context items: {len(items)}")
    for item in items[:3]:
        print(f"  [{item.get('emergency_signal', {}).get('signal_confidence', 0):.2f}] {item['title'][:60]}")
