"""
Historical Crash Risk Loader
Loads Bengaluru area-level crash risk data derived from
Bengaluru Traffic Police records (OpenCity, 2007–2025).
"""
import os
import json
import math
import logging

logging.basicConfig(level=logging.INFO)

_DATA_PATH = os.path.join(
    os.path.dirname(__file__), "..", "data", "crash_risk", "processed", "crash_risk_by_area.json"
)

_crash_index: dict | None = None


def load_crash_risk_index() -> dict:
    """Load the crash-risk-by-area JSON into memory (cached)."""
    global _crash_index
    if _crash_index is not None:
        return _crash_index

    try:
        with open(_DATA_PATH) as f:
            data = json.load(f)
        
        # Handle both dict and list formats
        if isinstance(data, list):
            # Convert list to dict using area as key
            _crash_index = {item.get("area", f"area_{i}"): item for i, item in enumerate(data)}
        else:
            _crash_index = data
            
        logging.info(f"Loaded crash risk index: {len(_crash_index)} areas")
    except FileNotFoundError:
        logging.warning(f"Crash risk file not found: {_DATA_PATH}")
        _crash_index = {}
    return _crash_index


def get_area_risk(area_name: str) -> dict:
    """Get historical crash risk for a named area (fuzzy match)."""
    index = load_crash_risk_index()

    # Exact match
    if area_name in index:
        return index[area_name]

    # Case-insensitive substring match
    area_lower = area_name.lower()
    for key, val in index.items():
        if area_lower in key.lower() or key.lower() in area_lower:
            return val

    # Default unknown area
    return {
        "area": area_name,
        "total_crashes": 0,
        "fatal_crashes": 0,
        "fatality_ratio": 0.0,
        "historical_risk_score": 0.35,
        "risk_label": "low",
    }


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine distance in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_nearest_area_risk(lat: float, lng: float) -> dict:
    """Find the closest area by coordinates and return its risk profile."""
    index = load_crash_risk_index()
    if not index:
        return get_area_risk("Unknown")

    best_area = None
    best_dist = float("inf")

    for key, val in index.items():
        a_lat = val.get("lat")
        a_lng = val.get("lng")
        if a_lat is None or a_lng is None:
            continue
        d = _haversine_km(lat, lng, a_lat, a_lng)
        if d < best_dist:
            best_dist = d
            best_area = val

    if best_area and best_dist < 15:  # within 15 km
        result = dict(best_area)
        result["distance_km"] = round(best_dist, 2)
        return result

    fallback = get_area_risk("Unknown")
    fallback["distance_km"] = round(best_dist, 2) if best_dist < float("inf") else None
    return fallback


if __name__ == "__main__":
    idx = load_crash_risk_index()
    print(f"Areas loaded: {len(idx)}")
    for name, data in list(idx.items())[:3]:
        print(f"  {name}: risk={data['historical_risk_score']} label={data['risk_label']}")

    print("\nNearest to Silk Board (12.9177, 77.6238):")
    r = get_nearest_area_risk(12.9177, 77.6238)
    print(f"  {r['area']}: risk={r['historical_risk_score']} dist={r.get('distance_km')}km")

    print("\nNearest to random point (13.05, 77.60):")
    r = get_nearest_area_risk(13.05, 77.60)
    print(f"  {r['area']}: risk={r['historical_risk_score']} dist={r.get('distance_km')}km")
