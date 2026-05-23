"""
Emergency Signal Filter

Classifies text as real emergency vs. noise using keyword heuristics.
Architecture supports Disaster Tweets (Kaggle) based ML filter — using
heuristic classifier for hackathon stability.
"""
import re
import logging

logging.basicConfig(level=logging.INFO)

ACTIVE_EMERGENCY_TERMS = [
    "reported", "injured", "stranded", "fire broke out", "waterlogging",
    "road blocked", "collapsed", "evacuated", "rescue", "ambulance",
    "accident", "crash", "flood", "trapped", "explosion", "gas leak",
    "power cut", "blackout", "stampede", "drowning", "burning",
    "overturned", "derailed", "emergency", "casualties", "fatalities",
    "landslide", "earthquake", "cyclone", "hospitalized", "critical condition",
    "bleeding", "unconscious", "missing", "stranded", "mayday",
    "sinkhole", "bridge collapse", "building collapse",
]

NON_ACTIVE_TERMS = [
    "court", "jail", "verdict", "why did", "explained", "investigation report",
    "anniversary", "history", "all passengers safe", "no casualties",
    "cleared", "resolved", "restored", "normal", "investigation underway",
    "booked", "arrested", "filed case", "FIR registered", "probe ordered",
    "compensation", "insurance", "inquiry", "review meeting",
]


def classify_emergency_signal(text: str) -> dict:
    """
    Classify whether text describes a real, active emergency.

    Returns:
        {
            "is_emergency_signal": bool,
            "signal_confidence": float (0-1),
            "matched_terms": list,
            "negative_terms": list,
        }
    """
    if not text:
        return {
            "is_emergency_signal": False,
            "signal_confidence": 0.0,
            "matched_terms": [],
            "negative_terms": [],
        }

    text_lower = text.lower()

    # Count emergency term matches
    matched = [t for t in ACTIVE_EMERGENCY_TERMS if t in text_lower]
    negatives = [t for t in NON_ACTIVE_TERMS if t in text_lower]

    # Score: more emergency terms = higher confidence
    pos_score = min(len(matched) * 0.2, 1.0)
    neg_score = min(len(negatives) * 0.25, 0.8)

    signal_confidence = max(pos_score - neg_score, 0.0)
    is_emergency = signal_confidence >= 0.3 and len(matched) >= 1

    return {
        "is_emergency_signal": is_emergency,
        "signal_confidence": round(signal_confidence, 3),
        "matched_terms": matched[:5],
        "negative_terms": negatives[:3],
    }


def filter_emergency_texts(texts: list[str], threshold: float = 0.3) -> list[dict]:
    """Filter a list of texts, returning only those above emergency threshold."""
    results = []
    for text in texts:
        classification = classify_emergency_signal(text)
        if classification["signal_confidence"] >= threshold:
            results.append({
                "text": text,
                **classification,
            })
    return results


if __name__ == "__main__":
    tests = [
        "Major fire broke out in HSR Layout warehouse, 3 injured, ambulance rushed to spot",
        "Court verdict on Bengaluru land dispute — all parties to appear next week",
        "Waterlogging reported near Silk Board, vehicles stranded, road blocked",
        "Why did Bengaluru traffic get worse? Explained in 5 points",
        "Building collapsed in Majestic, rescue teams deployed, 10 trapped",
    ]
    for t in tests:
        r = classify_emergency_signal(t)
        emoji = "🚨" if r["is_emergency_signal"] else "⏭️ "
        print(f"{emoji} [{r['signal_confidence']:.2f}] {t[:60]}...")
        if r["matched_terms"]:
            print(f"   matched: {r['matched_terms']}")
