"""
Deterministic keyword-based incident type normalizer.

Runs BEFORE and AFTER Gemini analysis to eliminate "other" classifications.
Uses keyword matching against incident text to assign meaningful types.
"""

import logging

logging.basicConfig(level=logging.INFO)

KEYWORD_TYPE_MAP = {
    "fire": [
        "fire", "smoke", "flame", "burning", "blaze", "arson", "inferno",
        "engine fire", "caught fire", "fire broke", "fire scare", "charred",
        "combustion", "ignite", "incinerat",
    ],
    "flood": [
        "flood", "waterlogging", "waterlog", "submerge", "inundation",
        "deluge", "rainwater", "overflow", "drowning", "rain", "waterlogged",
        "drainage", "storm water", "flooded road",
    ],
    "road_accident": [
        "accident", "crash", "collision", "hit and run", "hit-and-run",
        "vehicle", "overturned", "road mishap", "traffic accident",
        "car crash", "bus accident", "truck", "pileup", "pile-up",
        "road accident", "head-on", "pedestrian hit",
    ],
    "medical_emergency": [
        "injured", "unconscious", "ambulance", "hospital", "cardiac",
        "heart attack", "stroke", "bleeding", "medical", "emergency ward",
        "patient", "surgery", "poisoning", "overdose",
    ],
    "power_outage": [
        "power cut", "power outage", "blackout", "electricity",
        "transformer", "grid failure", "voltage", "power supply",
        "load shedding", "power failure",
    ],
    "infrastructure_failure": [
        "collapse", "building collapse", "bridge", "cave-in", "sinkhole",
        "structural", "crack", "dam", "wall collapse", "road cave",
        "ceiling fell", "under construction",
    ],
    "crowd_risk": [
        "crowd", "stampede", "protest", "rally", "gathering", "riot",
        "mob", "demonstration", "procession", "lathi", "tear gas",
        "stone pelting",
    ],
    "hazardous_material": [
        "chemical", "gas leak", "toxic", "hazardous", "spill",
        "radiation", "contamination", "ammonia", "chlorine",
        "industrial leak", "chemical plant",
    ],
    "rescue_required": [
        "rescue", "trapped", "stuck", "missing", "stranded",
        "landslide", "earthquake", "buried", "fallen into",
        "well rescue", "building rubble",
    ],
}


def detect_incident_type(text: str) -> str | None:
    """
    Detect incident type from text using keyword matching.

    Returns the matched type string or None if no match found.
    """
    if not text:
        return None

    text_lower = text.lower()

    # Score each type by number of keyword hits
    scores = {}
    for itype, keywords in KEYWORD_TYPE_MAP.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > 0:
            scores[itype] = score

    if not scores:
        return None

    # Return the type with the most keyword matches
    best_type = max(scores, key=scores.get)
    logging.info(f"Type normalizer: detected '{best_type}' (score={scores[best_type]})")
    return best_type


def normalize_incident_type(incident: dict) -> dict:
    """
    Normalize an incident's type. If type is 'other' or missing,
    attempt keyword-based detection from text fields.
    """
    current_type = incident.get("incident_type", "other")

    if current_type not in ("other", "", None):
        return incident

    text = " ".join(filter(None, [
        incident.get("summary", ""),
        incident.get("raw_text", ""),
        incident.get("title", ""),
        incident.get("text", ""),
    ]))

    detected = detect_incident_type(text)
    if detected:
        incident["incident_type"] = detected
        incident["type_source"] = "keyword_normalizer"

    return incident


def normalize_batch(incidents: list[dict]) -> list[dict]:
    """Normalize types for a batch of incidents."""
    normalized = []
    fixed_count = 0
    for inc in incidents:
        before = inc.get("incident_type", "other")
        result = normalize_incident_type(inc)
        if result.get("incident_type") != before:
            fixed_count += 1
        normalized.append(result)

    if fixed_count > 0:
        logging.info(f"Type normalizer: fixed {fixed_count}/{len(incidents)} incidents")

    return normalized
