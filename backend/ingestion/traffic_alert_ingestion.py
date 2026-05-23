"""
Traffic Alert Ingestion
Loads live / mock traffic alerts from Bengaluru Traffic Police data.
Enriches emergency response with road-closure, congestion, and diversion context.
"""
import os
import json
import math
import logging
import time as _time

logging.basicConfig(level=logging.INFO)

_DATA_PATH = os.path.join(
    os.path.dirname(__file__), "..", "data", "traffic", "mock_traffic_alerts.json"
)

_traffic_alerts: list | None = None


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def load_traffic_alerts() -> list:
    """Load all traffic alerts (cached)."""
    global _traffic_alerts
    if _traffic_alerts is not None:
        return _traffic_alerts

    try:
        with open(_DATA_PATH) as f:
            _traffic_alerts = json.load(f)
        logging.info(f"Loaded {len(_traffic_alerts)} traffic alerts")
    except FileNotFoundError:
        logging.warning(f"Traffic alerts file not found: {_DATA_PATH}")
        _traffic_alerts = []
    return _traffic_alerts


def get_active_alerts() -> list:
    """Return only active traffic alerts."""
    return [a for a in load_traffic_alerts() if a.get("active", False)]


def get_nearby_traffic_alerts(lat: float, lng: float, radius_km: float = 3.0) -> list:
    """Get active traffic alerts within radius_km of a location."""
    alerts = get_active_alerts()
    nearby = []
    for alert in alerts:
        a_lat = alert.get("lat")
        a_lng = alert.get("lng")
        if a_lat is None or a_lng is None:
            continue
        dist = _haversine_km(lat, lng, a_lat, a_lng)
        if dist <= radius_km:
            result = dict(alert)
            result["distance_km"] = round(dist, 2)
            nearby.append(result)
    nearby.sort(key=lambda x: x["distance_km"])
    return nearby


def get_traffic_context(lat: float, lng: float, radius_km: float = 5.0) -> dict:
    """
    Build a traffic context summary for a location.
    Used by the feature builder for QML input.
    """
    nearby = get_nearby_traffic_alerts(lat, lng, radius_km)

    severity_scores = {"high": 1.0, "medium": 0.6, "low": 0.3}
    total_severity = sum(severity_scores.get(a.get("severity", "low"), 0.3) for a in nearby)

    road_closures = sum(1 for a in nearby if a.get("type") in ("road_closure", "diversion"))
    obstructions = sum(1 for a in nearby if a.get("type") in ("traffic_obstruction", "vehicle_breakdown"))

    return {
        "alerts_nearby": len(nearby),
        "road_closures": road_closures,
        "obstructions": obstructions,
        "total_severity": round(total_severity, 2),
        "alerts": nearby,
        "accessibility_impact": "high" if road_closures >= 2 or total_severity >= 2.0
            else "medium" if road_closures >= 1 or total_severity >= 1.0
            else "low",
    }


_weather_cache: dict = {}
_WEATHER_TTL_SECONDS = 1800  # refresh every 30 minutes


def get_mock_weather(lat: float = 12.97, lng: float = 77.59) -> dict:
    """
    Fetch current weather for Bengaluru from Open-Meteo (free, no API key).
    Falls back to defaults if unavailable.
    Cached for 30 minutes to avoid per-request latency.
    """
    global _weather_cache
    now = _time.time()
    if _weather_cache.get("expires_at", 0) > now:
        return _weather_cache["data"]

    try:
        import requests
        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lng}"
            f"&current=precipitation,temperature_2m,windspeed_10m,relativehumidity_2m,visibility"
            f"&forecast_days=1"
        )
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        body = resp.json()
        cur = body.get("current", {})
        data = {
            "rainfall_mm":     float(cur.get("precipitation", 0.0)),
            "temperature_c":   float(cur.get("temperature_2m", 24.0)),
            "wind_speed_kmh":  float(cur.get("windspeed_10m", 18.0)),
            "humidity_pct":    float(cur.get("relativehumidity_2m", 75.0)),
            "visibility_km":   float(cur.get("visibility", 10000.0)) / 1000.0,
            "condition":       "rain" if cur.get("precipitation", 0) > 2 else "clear",
            "source":          "open-meteo",
        }
        _weather_cache = {"data": data, "expires_at": now + _WEATHER_TTL_SECONDS}
        return data
    except Exception as e:
        logging.warning(f"Weather API failed ({e}), using seasonal default")
        default = {
            "rainfall_mm": 0.0,
            "temperature_c": 26.0,
            "wind_speed_kmh": 12.0,
            "humidity_pct": 65.0,
            "visibility_km": 10.0,
            "condition": "clear",
            "source": "fallback",
        }
        _weather_cache = {"data": default, "expires_at": now + 300}  # 5-min retry
        return default


if __name__ == "__main__":
    alerts = load_traffic_alerts()
    print(f"Total alerts: {len(alerts)}")
    active = get_active_alerts()
    print(f"Active alerts: {len(active)}")

    print("\nNearby Silk Board (12.9177, 77.6238), 5km:")
    nearby = get_nearby_traffic_alerts(12.9177, 77.6238, 5.0)
    for a in nearby:
        print(f"  [{a['severity']}] {a['type']} in {a['area']} ({a['distance_km']}km) — {a['description'][:50]}")

    ctx = get_traffic_context(12.9177, 77.6238)
    print(f"\nTraffic context: {ctx['alerts_nearby']} alerts, impact={ctx['accessibility_impact']}")
