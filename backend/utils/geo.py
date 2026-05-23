import math
import difflib

# Bengaluru jurisdiction centroid table (extend as needed)
# Sources: ward centroids + BTP station coordinates
JURISDICTION_CENTROIDS: dict[str, tuple[float, float]] = {
    "Silk Board":          (12.9177, 77.6238),
    "HSR Layout":          (12.9081, 77.6476),
    "Koramangala":         (12.9352, 77.6245),
    "Whitefield":          (12.9698, 77.7500),
    "Marathahalli":        (12.9569, 77.7011),
    "Electronic City":     (12.8399, 77.6770),
    "MG Road":             (12.9756, 77.6099),
    "Majestic":            (12.9767, 77.5713),
    "Hebbal":              (13.0351, 77.5970),
    "Yeshwanthpur":        (13.0218, 77.5508),
    "Bannerghatta Road":   (12.8716, 77.5975),
    "Old Airport Road":    (12.9600, 77.6500),
    "Outer Ring Road":     (12.9263, 77.6784),
    "KR Puram":            (13.0072, 77.6940),
    "Indiranagar":         (12.9784, 77.6408),
    "Jayanagar":           (12.9299, 77.5826),
    "BTM Layout":          (12.9165, 77.6101),
    "JP Nagar":            (12.9063, 77.5856),
    "Rajajinagar":         (12.9920, 77.5530),
    "Unknown":             (12.9716, 77.5946),  # city centre fallback
}


def jurisdiction_to_coords(jurisdiction: str) -> tuple[float, float]:
    """
    Convert a jurisdiction name to approximate lat/lng.
    Uses fuzzy matching against the centroid table.
    """
    if not jurisdiction or jurisdiction == "Unknown":
        return JURISDICTION_CENTROIDS["Unknown"]

    # Exact match first
    if jurisdiction in JURISDICTION_CENTROIDS:
        return JURISDICTION_CENTROIDS[jurisdiction]

    # Substring match
    jur_lower = jurisdiction.lower()
    for key, coords in JURISDICTION_CENTROIDS.items():
        if key.lower() in jur_lower or jur_lower in key.lower():
            return coords

    # Difflib fallback
    best = difflib.get_close_matches(jurisdiction, JURISDICTION_CENTROIDS.keys(), n=1, cutoff=0.5)
    if best:
        return JURISDICTION_CENTROIDS[best[0]]

    return JURISDICTION_CENTROIDS["Unknown"]


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in km between two lat/lng points."""
    R = 6371
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def point_in_poly(x: float, y: float, poly: list[tuple[float, float]]) -> bool:
    """Ray-casting point-in-polygon check. x=lng, y=lat."""
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / (yj - yi + 1e-16) + xi
        ):
            inside = not inside
        j = i
    return inside


def geographic_spread(coords: list[tuple[float, float]]) -> float:
    """Calculate max distance in km between any two points in a set."""
    if len(coords) < 2:
        return 0.0
    max_dist = 0.0
    for i in range(len(coords)):
        for j in range(i + 1, len(coords)):
            d = haversine(coords[i][0], coords[i][1], coords[j][0], coords[j][1])
            if d > max_dist:
                max_dist = d
    return max_dist
