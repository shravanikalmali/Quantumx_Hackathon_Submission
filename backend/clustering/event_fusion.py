import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from sentence_transformers import SentenceTransformer, util
import google.generativeai as genai
from dotenv import load_dotenv

from backend.utils.config import GEMINI_API_KEY
from backend.utils.geo import geographic_spread, jurisdiction_to_coords
from backend.models.incident import IncidentCluster
from backend.intelligence.signal_confidence import compute_signal_confidence

load_dotenv()
logging.basicConfig(level=logging.INFO)

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel("gemini-1.5-pro")
else:
    gemini_model = None

embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

SIMILARITY_THRESHOLD = 0.55


def summarize_cluster(titles: list[str], event_type: str, jurisdiction: str) -> str:
    """Use Gemini to generate an operational summary for a cluster."""
    if not gemini_model:
        return f"Cluster of {len(titles)} {event_type} incidents in {jurisdiction or 'Unknown'}."

    prompt = f"""You are summarizing emergency incident reports for operations coordinators.

Event Type: {event_type}
Jurisdiction: {jurisdiction or "Unknown"}
Incident titles:
{chr(10).join(f"- {t}" for t in titles[:10])}

Write a 2-3 sentence operational summary. Be concise, factual, and actionable.
Include estimated scale and recommended immediate response."""

    try:
        response = gemini_model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        logging.warning(f"Gemini summarization failed: {e}")
        return f"Cluster of {len(titles)} {event_type} incidents in {jurisdiction or 'Unknown'}."


def compute_cluster_severity(incidents: list[dict]) -> float:
    """Compute mean severity score for a cluster."""
    scores = [i.get("severity_score", 0.0) for i in incidents if i.get("severity_score")]
    return sum(scores) / len(scores) if scores else 0.0


def compute_escalation_trend(incidents: list[dict]) -> str:
    """
    Determine escalation trend by ingestion rate, not publication time.
    
    Using ingested_at (when the system received the report) instead of
    published (when the article was written) gives a real signal for RSS
    and Reddit sources, which arrive with stale timestamps.
    """
    now = datetime.now(timezone.utc)
    recent_5min = 0
    recent_30min = 0

    for inc in incidents:
        # Prefer ingested_at; fall back to published only if not present
        ts_str = inc.get("ingested_at") or inc.get("published", "")
        try:
            if isinstance(ts_str, str):
                ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            else:
                ts = ts_str
            delta = (now - ts).total_seconds() / 60
            if delta <= 5:
                recent_5min += 1
            if delta <= 30:
                recent_30min += 1
        except Exception:
            continue

    if recent_5min >= 3:
        return "rapidly_increasing"
    elif recent_5min >= 2 or recent_30min >= 4:
        return "increasing"
    elif recent_30min == 0:
        return "stable"
    else:
        return "stable"


def compute_geographic_spread_from_incidents(incidents: list[dict]) -> float:
    """Extract coords from incidents and compute spread in km."""
    coords = []
    for inc in incidents:
        loc = inc.get("location")
        if isinstance(loc, dict) and "latitude" in loc and "longitude" in loc:
            coords.append((loc["latitude"], loc["longitude"]))
    return geographic_spread(coords)


def group_by_bucket(items: list[dict]) -> dict:
    """Group incidents by (jurisdiction, incident_type)."""
    buckets = defaultdict(list)
    for item in items:
        key = (
            item.get("jurisdiction", "Unknown"),
            item.get("incident_type", "other"),
        )
        buckets[key].append(item)
    logging.info(f"Grouped into {len(buckets)} buckets")
    return dict(buckets)


def deduplicate_and_cluster(items: list[dict], threshold: float = SIMILARITY_THRESHOLD) -> list[list[dict]]:
    """Use sentence embeddings to cluster similar incidents. Handles singletons."""
    titles = [i.get("title", i.get("summary", "")) for i in items]
    valid_items = [(i, t) for i, t in zip(items, titles) if t.strip()]

    if len(valid_items) < 1:
        return []

    items_clean = [v[0] for v in valid_items]
    titles_clean = [v[1] for v in valid_items]

    # Handle single item case
    if len(items_clean) == 1:
        return [[items_clean[0]]]

    embeddings = embedding_model.encode(titles_clean, convert_to_tensor=True)
    clusters = []
    used = set()

    for i in range(len(items_clean)):
        if i in used:
            continue
        cluster = [items_clean[i]]
        used.add(i)
        cos_scores = util.pytorch_cos_sim(embeddings[i], embeddings)[0]
        for j in range(i + 1, len(items_clean)):
            if j not in used and cos_scores[j].item() > threshold:
                cluster.append(items_clean[j])
                used.add(j)
        # Include singletons (len >= 1, not just >= 2)
        clusters.append(cluster)
        logging.info(f"  Cluster of {len(cluster)}: {titles_clean[i][:60]}")

    logging.info(f"Total clusters formed: {len(clusters)}")
    return clusters


def build_cluster_object(cluster: list[dict], jurisdiction: str, event_type: str) -> dict:
    """Build a structured cluster dict with severity, trend, and summary."""
    titles = [i.get("title", i.get("summary", "")) for i in cluster]
    severity = compute_cluster_severity(cluster)
    trend = compute_escalation_trend(cluster)
    spread_km = compute_geographic_spread_from_incidents(cluster)
    summary = summarize_cluster(titles, event_type, jurisdiction)

    signal_confidence = compute_signal_confidence(cluster)

    # Compute centroid from GPS if available; otherwise use jurisdiction lookup
    lats, lngs = [], []
    for inc in cluster:
        loc = inc.get("location")
        if isinstance(loc, dict) and "latitude" in loc and "longitude" in loc:
            lats.append(float(loc["latitude"]))
            lngs.append(float(loc["longitude"]))

    if lats and lngs:
        centroid_lat = sum(lats) / len(lats)
        centroid_lng = sum(lngs) / len(lngs)
        location_source = "gps"
    else:
        centroid_lat, centroid_lng = jurisdiction_to_coords(jurisdiction)
        location_source = "jurisdiction_lookup"

    if severity >= 0.8:
        response = "critical"
    elif severity >= 0.6:
        response = "high"
    elif severity >= 0.4:
        response = "medium"
    else:
        response = "normal"

    truth_statement = (
        f"This is not {len(cluster)} separate alerts. "
        f"This is one emerging {event_type.replace('_', ' ')} cluster near {jurisdiction}."
    ) if len(cluster) >= 2 else (
        f"This is currently a single {event_type.replace('_', ' ')} signal near {jurisdiction}."
    )

    return {
        "cluster_id": str(uuid.uuid4()),
        "incident_ids": [i.get("id", "") for i in cluster],
        "incident_count": len(cluster),
        "cluster_severity": round(severity, 3),
        "escalation_trend": trend,
        "geographic_spread_km": round(spread_km, 2),
        "regions": [jurisdiction] if jurisdiction != "Unknown" else [],
        "recommended_response": response,
        "summary": summary,
        "incident_type": event_type,
        "jurisdiction": jurisdiction,
        "centroid_lat": centroid_lat,
        "centroid_lng": centroid_lng,
        "location_source": location_source,
        "location": {"latitude": centroid_lat, "longitude": centroid_lng},
        "truth_statement": truth_statement,
        "confidence_score": signal_confidence["confidence_score"],
        "confidence_percent": signal_confidence["confidence_percent"],
        "confidence_label": signal_confidence["confidence_label"],
        "source_breakdown": signal_confidence["source_breakdown"],
        "source_diversity": signal_confidence["source_diversity"],
        "why_we_believe_this": signal_confidence["why_we_believe_this"],
        "raw_signals": [
            {
                "id": i.get("id"),
                "source": i.get("source"),
                "source_label": i.get("source_label", i.get("source", "Unknown")),
                "title": i.get("title"),
                "signal_type": i.get("signal_type", "incident_signal"),
                "severity_score": i.get("severity_score"),
            }
            for i in cluster
        ],
    }


def run_event_fusion(incidents: list[dict]) -> list[dict]:
    """Main fusion pipeline: group → cluster → enrich."""
    buckets = group_by_bucket(incidents)
    all_clusters = []

    for (jurisdiction, event_type), group in buckets.items():
        logging.info(f"Processing bucket: {jurisdiction} - {event_type} ({len(group)} incidents)")
        clusters = deduplicate_and_cluster(group)
        for cluster in clusters:
            cluster_obj = build_cluster_object(cluster, jurisdiction, event_type)
            all_clusters.append(cluster_obj)

    logging.info(f"Event fusion complete: {len(all_clusters)} clusters")
    return all_clusters


if __name__ == "__main__":
    import json
    test_incidents = [
        {"id": "1", "title": "Fire in HSR Layout warehouse", "incident_type": "fire",
         "jurisdiction": "HSR Layout", "severity_score": 0.9, "published": datetime.now(timezone.utc).isoformat()},
        {"id": "2", "title": "Warehouse fire reported near HSR", "incident_type": "fire",
         "jurisdiction": "HSR Layout", "severity_score": 0.85, "published": datetime.now(timezone.utc).isoformat()},
        {"id": "3", "title": "Large fire at HSR industrial area", "incident_type": "fire",
         "jurisdiction": "HSR Layout", "severity_score": 0.88, "published": datetime.now(timezone.utc).isoformat()},
    ]
    result = run_event_fusion(test_incidents)
    print(json.dumps(result, indent=2))
