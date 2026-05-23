"""
Feature Builder for Quantum ML Risk Prediction

Converts raw incident data into a structured 4-feature vector:
  [severity_score, historical_area_risk, report_density, accessibility_risk]

Each feature is normalized to [0, 1] for the PennyLane VQC.
"""
import logging
import math
from datetime import datetime, timezone

from backend.ingestion.historical_crash_loader import get_area_risk, get_nearest_area_risk
from backend.ingestion.traffic_alert_ingestion import get_traffic_context, get_mock_weather
import json
from pathlib import Path

logging.basicConfig(level=logging.INFO)


def load_enhanced_crash_risk():
    """Load enhanced crash risk data with rainfall from newdata training"""
    enhanced_path = Path("backend/data/processed/crash_risk_with_newdata.json")
    original_path = Path("backend/data/crash_risk/processed/crash_risk_by_area.json")
    
    # Try enhanced data first
    if enhanced_path.exists():
        with open(enhanced_path, "r") as f:
            return json.load(f)
    elif original_path.exists():
        with open(original_path, "r") as f:
            return json.load(f)
    else:
        logging.warning("No crash risk data found, using empty dict")
        return {}


def _time_weighted_density(incident_or_cluster: dict) -> float:
    """
    Compute a time-decayed report density score.
    
    Recent incidents contribute more than old ones:
    - Weight = e^(-age_in_hours / decay_half_life)
    - decay_half_life = 2 hours (reports 2h old count as half)
    
    For clusters, uses incident_count with a recency factor derived from
    escalation_trend when per-incident timestamps are unavailable.
    """
    DECAY_HALF_LIFE_H = 2.0
    MAX_COUNT = 10.0

    # If this is a cluster dict, use incident_count + trend as proxy
    if "escalation_trend" in incident_or_cluster:
        count = float(incident_or_cluster.get("incident_count", 1))
        trend = incident_or_cluster.get("escalation_trend", "stable")
        recency_multiplier = {
            "rapidly_increasing": 1.5,
            "increasing": 1.2,
            "stable": 1.0,
        }.get(trend, 1.0)
        raw_density = min(count * recency_multiplier / MAX_COUNT, 1.0)
        return round(raw_density, 4)

    # For single incidents, use ingested_at or published timestamp
    now = datetime.now(timezone.utc)
    ts_str = incident_or_cluster.get("ingested_at") or incident_or_cluster.get("published", "")
    weight = 1.0
    if ts_str:
        try:
            ts = datetime.fromisoformat(str(ts_str).replace("Z", "+00:00"))
            age_hours = (now - ts).total_seconds() / 3600
            weight = math.exp(-age_hours / DECAY_HALF_LIFE_H)
        except Exception:
            pass

    return round(min(weight, 1.0), 4)


def build_qml_features(incident_or_cluster: dict) -> dict:
    """
    Build QML feature vector from an incident or cluster dict.

    Returns:
        {
            "features": [sev, hist_risk, density, access_risk],
            "feature_names": [...],
            "feature_details": {...},
        }
    """
    # --- Feature 1: Severity Score ---
    severity = incident_or_cluster.get("severity_score",
               incident_or_cluster.get("cluster_severity", 0.5))
    severity = max(0.0, min(float(severity), 1.0))

    # --- Feature 2: Historical Area Risk (Enhanced with Rainfall) ---
    location = incident_or_cluster.get("location")
    area_name = (
        incident_or_cluster.get("jurisdiction")
        or incident_or_cluster.get("area")
        or ""
    )

    # Load enhanced crash risk data
    crash_risk_index = load_enhanced_crash_risk()

    if isinstance(location, dict) and "latitude" in location:
        area_risk_data = get_nearest_area_risk(
            float(location["latitude"]), float(location["longitude"])
        )
        # Try to get enhanced data by area name
        enhanced_data = crash_risk_index.get(area_name, {})
        if enhanced_data:
            area_risk_data.update(enhanced_data)
    elif area_name:
        # Try enhanced data first, then fallback to original
        area_risk_data = crash_risk_index.get(area_name, {})
        if not area_risk_data:
            area_risk_data = get_area_risk(area_name)
    else:
        area_risk_data = get_area_risk("Unknown")

    historical_risk = float(area_risk_data.get("historical_risk_score", 0.35))
    rainfall_mm = float(area_risk_data.get("rainfall_mm", 0))

    # --- Feature 3: Report Density (Time-Weighted) ---
    report_density = _time_weighted_density(incident_or_cluster)
    report_count = (
        incident_or_cluster.get("incident_count")
        or incident_or_cluster.get("report_count", 1)
    )

    # --- Feature 4: Accessibility Risk ---
    lat = None
    lng = None
    if isinstance(location, dict):
        lat = location.get("latitude")
        lng = location.get("longitude")
    if lat is None and area_risk_data.get("lat"):
        lat = area_risk_data["lat"]
        lng = area_risk_data["lng"]

    traffic_ctx = {}
    weather = get_mock_weather()
    if lat is not None and lng is not None:
        traffic_ctx = get_traffic_context(float(lat), float(lng))

    alerts_nearby = traffic_ctx.get("alerts_nearby", 0)
    
    # Use real rainfall data from enhanced crash data if available
    real_rainfall = area_risk_data.get("rainfall_mm", 0)
    mock_rainfall = weather.get("rainfall_mm", 0)
    
    # Prefer real rainfall data, fallback to mock
    rainfall_mm = real_rainfall if real_rainfall > 0 else mock_rainfall
    
    # Enhanced accessibility risk calculation with real rainfall
    accessibility_risk = min(
        alerts_nearby * 0.25 + rainfall_mm * 0.02,  # Traffic + rainfall impact
        1.0
    )

    features = [severity, historical_risk, report_density, accessibility_risk]

    return {
        "features": features,
        "feature_names": [
            "severity_score",
            "historical_area_risk",
            "report_density",
            "accessibility_risk",
        ],
        "feature_details": {
            "severity_score": round(severity, 4),
            "historical_area_risk": round(historical_risk, 4),
            "historical_area": area_risk_data.get("area", "Unknown"),
            "historical_crashes": area_risk_data.get("total_cases", area_risk_data.get("total_crashes", 0)),
            "historical_fatal": area_risk_data.get("fatal_cases", area_risk_data.get("fatal_crashes", 0)),
            "fatality_ratio": area_risk_data.get("fatality_ratio", 0),
            "real_rainfall_mm": area_risk_data.get("rainfall_mm", 0),
            "report_count": report_count,
            "report_density": round(report_density, 4),
            "traffic_alerts_nearby": alerts_nearby,
            "rainfall_mm": rainfall_mm,  # Final rainfall used (real or mock)
            "accessibility_risk": round(accessibility_risk, 4),
            "accessibility_impact": traffic_ctx.get("accessibility_impact", "unknown"),
            "weather_condition": weather.get("condition", "unknown"),
            "data_source": area_risk_data.get("source", "Unknown"),
        },
    }


def build_batch_features(items: list[dict]) -> list[dict]:
    """Build QML features for a list of incidents or clusters."""
    return [build_qml_features(item) for item in items]


if __name__ == "__main__":
    import json

    test_incident = {
        "incident_type": "road_accident",
        "severity_score": 0.72,
        "estimated_people_affected": 25,
        "location": {"latitude": 12.9600, "longitude": 77.6500},
        "jurisdiction": "Old Airport Road",
        "incident_count": 4,
    }
    result = build_qml_features(test_incident)
    print("Feature vector:", result["features"])
    print("Details:", json.dumps(result["feature_details"], indent=2))

    test_cluster = {
        "incident_type": "flood",
        "cluster_severity": 0.79,
        "jurisdiction": "Silk Board",
        "incident_count": 3,
    }
    result2 = build_qml_features(test_cluster)
    print("\nCluster features:", result2["features"])
    print("Details:", json.dumps(result2["feature_details"], indent=2))
