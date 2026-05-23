from collections import Counter


SOURCE_WEIGHTS = {
    "user_report": 0.18,
    "traffic_alert": 0.24,
    "reddit_bangalore": 0.16,
    "local_news": 0.24,
    "times_of_india": 0.24,
    "deccan_herald": 0.24,
    "news": 0.22,
}


def compute_signal_confidence(incidents: list[dict]) -> dict:
    """
    Converts noisy reports into a trust score.
    This is the core USP: not just detecting alerts, but explaining why we believe them.
    """

    if not incidents:
        return {
            "confidence_score": 0,
            "confidence_label": "No Signal",
            "source_breakdown": {},
            "why_we_believe_this": []
        }

    sources = [i.get("source", "unknown") for i in incidents]
    source_counts = Counter(sources)
    unique_sources = len(source_counts)

    avg_severity = sum(i.get("severity_score", 0) for i in incidents) / len(incidents)
    source_score = min(sum(SOURCE_WEIGHTS.get(s, 0.1) for s in source_counts), 0.45)
    density_score = min(len(incidents) * 0.10, 0.30)
    severity_score = min(avg_severity * 0.20, 0.20)

    traffic_boost = 0.0
    historical_boost = 0.0
    accessibility_boost = 0.0

    for incident in incidents:
        if incident.get("traffic_density") == "high" or incident.get("source") == "traffic_alert":
            traffic_boost = 0.08

        if incident.get("historical_area_risk", 0) >= 0.7:
            historical_boost = 0.07

        if incident.get("accessibility_risk", 0) >= 0.7:
            accessibility_boost = 0.07

    confidence = source_score + density_score + severity_score + traffic_boost + historical_boost + accessibility_boost
    confidence = min(confidence, 1.0)

    reasons = []

    if len(incidents) >= 3:
        reasons.append(f"{len(incidents)} related reports describe the same location and hazard")

    if unique_sources >= 3:
        reasons.append(f"{unique_sources} independent source types agree")

    if "traffic_alert" in source_counts:
        reasons.append("Traffic disruption confirms real-world impact")

    if traffic_boost:
        reasons.append("High traffic density increases public safety risk")

    if historical_boost:
        reasons.append("Silk Board is treated as a known historical risk area")

    if accessibility_boost:
        reasons.append("Responder access may be difficult due to congestion or flooding")

    if confidence >= 0.80:
        label = "Verified Emergency"
    elif confidence >= 0.60:
        label = "Emerging Verified Risk"
    elif confidence >= 0.40:
        label = "Needs Confirmation"
    else:
        label = "Weak Signal"

    return {
        "confidence_score": round(confidence, 3),
        "confidence_percent": round(confidence * 100),
        "confidence_label": label,
        "source_breakdown": dict(source_counts),
        "source_diversity": unique_sources,
        "why_we_believe_this": reasons,
    }
