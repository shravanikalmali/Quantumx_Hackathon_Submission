import os
import json
import re
import time
import logging
import base64
import uuid

import requests
from dotenv import load_dotenv

from backend.utils.config import GOOGLE_API_KEY, GEMINI_MODEL, GEMINI_VISION_MODEL, USER_AGENT
from backend.models.incident import Incident, IncidentLocation, ALLOWED_INCIDENT_TYPES
from backend.intelligence.type_normalizer import normalize_incident_type

load_dotenv()
logging.basicConfig(level=logging.INFO)

GEMINI_API_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}"
    f":generateContent?key={GOOGLE_API_KEY}"
)

GEMINI_VISION_API_URL = (
    f"https://generativelanguage.googleapis.com/v1/models/{GEMINI_VISION_MODEL}"
    f":generateContent?key={GOOGLE_API_KEY}"
)

ANALYSIS_PROMPT = """You are an emergency incident analysis agent for Bengaluru city.

Analyze this emergency incident report and return a structured JSON response.

INPUT TEXT:
{text}

Return EXACTLY one JSON object with these fields:
{{
  "incident_type": "<one of: fire, flood, road_accident, medical_emergency, power_outage, infrastructure_failure, crowd_risk, hazardous_material, rescue_required, other>",
  "severity_score": <float 0.0 to 1.0>,
  "urgency_level": "<one of: low, medium, high, critical>",
  "escalation_probability": <float 0.0 to 1.0>,
  "estimated_people_affected": <integer>,
  "recommended_resources": [<list of strings like "ambulance", "fire_truck", "rescue_team", "police", "hazmat_unit", "medical_team">],
  "summary": "<short operational summary in 1-2 sentences>",
  "jurisdiction": "<best guess of area/locality or Unknown>"
}}

Be precise. Base severity on potential harm. Estimate affected people conservatively.
Return ONLY valid JSON, no markdown fences.
"""

VISION_PROMPT = """You are an emergency incident analysis agent.

Analyze this image showing an emergency situation.

Return EXACTLY one JSON object:
{{
  "incident_type": "<one of: fire, flood, road_accident, medical_emergency, power_outage, infrastructure_failure, crowd_risk, hazardous_material, rescue_required, other>",
  "severity_score": <float 0.0 to 1.0>,
  "urgency_level": "<one of: low, medium, high, critical>",
  "escalation_probability": <float 0.0 to 1.0>,
  "estimated_people_affected": <integer>,
  "recommended_resources": [<list of resource types needed>],
  "summary": "<short operational summary of what the image shows>"
}}

Return ONLY valid JSON, no markdown fences.
"""


def _extract_json(text: str) -> dict:
    """Extract first valid JSON object from response text."""
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text).strip()

    start = text.find("{")
    if start == -1:
        raise ValueError(f"No JSON object found in: {text!r}")
    count = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            count += 1
        elif text[i] == "}":
            count -= 1
            if count == 0:
                return json.loads(text[start : i + 1])
    raise ValueError(f"Unclosed JSON object in: {text!r}")


def _extract_json_array(text: str) -> list:
    """Extract first valid JSON array from response text."""
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text).strip()

    start = text.find("[")
    if start == -1:
        raise ValueError(f"No JSON array found in: {text!r}")
    count = 0
    for i in range(start, len(text)):
        if text[i] == "[":
            count += 1
        elif text[i] == "]":
            count -= 1
            if count == 0:
                return json.loads(text[start : i + 1])
    raise ValueError(f"Unclosed JSON array in: {text!r}")


def analyze_text_incident(raw_event: dict) -> dict:
    """Analyze a single text-based incident using Gemini."""
    text = f"Title: {raw_event.get('title', '')}\nContent: {raw_event.get('text', '')}"
    prompt = ANALYSIS_PROMPT.format(text=text)

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    payload = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}

    try:
        resp = session.post(GEMINI_API_URL, json=payload, timeout=30)
        resp.raise_for_status()
        body = resp.json()
        parts = body.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        result_text = parts[0].get("text", "").strip() if parts else ""
        analysis = _extract_json(result_text)
    except Exception as e:
        logging.error(f"Gemini analysis failed: {e}")
        analysis = {
            "incident_type": "other",
            "severity_score": 0.5,
            "urgency_level": "medium",
            "escalation_probability": 0.3,
            "estimated_people_affected": 0,
            "recommended_resources": [],
            "summary": raw_event.get("title", "Analysis unavailable"),
            "jurisdiction": "Unknown",
        }

    if analysis.get("incident_type") not in ALLOWED_INCIDENT_TYPES:
        analysis["incident_type"] = "other"

    enriched = {**raw_event, **analysis}
    enriched = normalize_incident_type(enriched)
    return enriched


def analyze_image_incident(image_bytes: bytes, additional_text: str = "") -> dict:
    """Analyze an image-based incident using Gemini Vision."""
    b64_image = base64.b64encode(image_bytes).decode("utf-8")

    parts = [
        {"inline_data": {"mime_type": "image/jpeg", "data": b64_image}},
        {"text": VISION_PROMPT},
    ]
    if additional_text:
        parts.append({"text": f"Additional context: {additional_text}"})

    payload = {"contents": [{"parts": parts}]}
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    try:
        resp = session.post(GEMINI_VISION_API_URL, json=payload, timeout=30)
        resp.raise_for_status()
        body = resp.json()
        resp_parts = body.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        result_text = resp_parts[0].get("text", "").strip() if resp_parts else ""
        analysis = _extract_json(result_text)
    except Exception as e:
        logging.error(f"Gemini Vision analysis failed: {e}")
        analysis = {
            "incident_type": "other",
            "severity_score": 0.5,
            "urgency_level": "medium",
            "escalation_probability": 0.3,
            "estimated_people_affected": 0,
            "recommended_resources": [],
            "summary": "Image analysis unavailable",
        }

    if analysis.get("incident_type") not in ALLOWED_INCIDENT_TYPES:
        analysis["incident_type"] = "other"

    result = {
        "id": str(uuid.uuid4()),
        "source": "image_report",
        **analysis,
    }
    result = normalize_incident_type(result)
    return result


def analyze_batch(events: list[dict], batch_size: int = 10) -> list[dict]:
    """Analyze a batch of text incidents with rate limiting."""
    enriched = []
    for idx, event in enumerate(events):
        result = analyze_text_incident(event)
        enriched.append(result)
        logging.info(f"Analyzed {idx + 1}/{len(events)}: {result.get('incident_type')} "
                     f"severity={result.get('severity_score')}")
        if (idx + 1) % batch_size == 0:
            time.sleep(2)
    return enriched


if __name__ == "__main__":
    test_event = {
        "id": "test_001",
        "source": "test",
        "title": "Massive fire breaks out in HSR Layout warehouse",
        "text": "A large fire engulfed a warehouse in HSR Layout. Multiple fire trucks dispatched. Nearby residents evacuated.",
        "published": "2025-01-01T10:00:00+00:00",
    }
    result = analyze_text_incident(test_event)
    print(json.dumps(result, indent=2))
