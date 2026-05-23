"""
Source Router

Centralizes which data source drives the pipeline.
Supports: demo, citizen, traffic, news, hybrid modes.
"""
import json
import os
import logging
from enum import Enum

logging.basicConfig(level=logging.INFO)


class SourceMode(str, Enum):
    DEMO = "demo"
    CITIZEN = "citizen"
    TRAFFIC = "traffic"
    NEWS = "news"
    HYBRID = "hybrid"


def load_demo_scenarios(scenario_name: str = "all") -> list[dict]:
    """Load pre-built demo incidents."""
    path = os.path.join(os.path.dirname(__file__), "..", "data", "demo_scenarios.json")
    try:
        with open(path) as f:
            all_scenarios = json.load(f)
    except FileNotFoundError:
        logging.error("Demo scenarios file not found")
        return []

    if scenario_name == "all":
        items = []
        for scn in all_scenarios.values():
            items.extend(scn)
        return items
    elif scenario_name in all_scenarios:
        return all_scenarios[scenario_name]
    else:
        logging.warning(f"Unknown scenario: {scenario_name}")
        return []


def get_citizen_reports(pipeline_state: dict) -> list[dict]:
    """Get citizen-submitted reports from pipeline state."""
    incidents = pipeline_state.get("analyzed_incidents", [])
    return [i for i in incidents if i.get("source") == "user_report"]


def get_traffic_context() -> list[dict]:
    """Get traffic alerts for enrichment."""
    from backend.ingestion.traffic_alert_ingestion import get_active_alerts
    return get_active_alerts()


def get_news_context() -> list[dict]:
    """Get filtered news enrichment."""
    try:
        from backend.ingestion.news_enrichment import fetch_news_enrichment
        return fetch_news_enrichment()
    except Exception as e:
        logging.warning(f"News enrichment failed: {e}")
        return []


async def run_source_pipeline(mode: SourceMode, pipeline_state: dict, scenario_name: str = "all") -> list[dict]:
    """
    Route incident data based on source mode.

    Returns a list of incident dicts to process.
    """
    logging.info(f"Source router: mode={mode.value}")

    if mode == SourceMode.DEMO:
        items = load_demo_scenarios(scenario_name)
        for item in items:
            item.setdefault("source_label", "Demo Scenario")
        return items

    elif mode == SourceMode.CITIZEN:
        return get_citizen_reports(pipeline_state)

    elif mode == SourceMode.TRAFFIC:
        alerts = get_traffic_context()
        # Convert traffic alerts to incident-like dicts
        incidents = []
        for a in alerts:
            incidents.append({
                "id": a["id"],
                "source": "traffic_alert",
                "source_label": "Traffic Alert",
                "title": a["description"],
                "text": a["description"],
                "incident_type": "road_accident" if a["type"] in ("vehicle_breakdown", "traffic_obstruction") else "infrastructure_failure",
                "severity_score": {"high": 0.7, "medium": 0.5, "low": 0.3}.get(a.get("severity", "low"), 0.3),
                "jurisdiction": a.get("area", "Unknown"),
                "location": {"latitude": a.get("lat"), "longitude": a.get("lng")},
            })
        return incidents

    elif mode == SourceMode.NEWS:
        return get_news_context()

    elif mode == SourceMode.HYBRID:
        demo = load_demo_scenarios(scenario_name)
        citizen = get_citizen_reports(pipeline_state)
        news = get_news_context()
        all_items = demo + citizen + news
        for item in all_items:
            item.setdefault("source_label", item.get("source", "unknown").replace("_", " ").title())
        return all_items

    return []


def get_source_status() -> dict:
    """Return current status of all data sources for the dashboard."""
    from backend.ingestion.historical_crash_loader import load_crash_risk_index
    from backend.ingestion.traffic_alert_ingestion import get_active_alerts

    crash_index = load_crash_risk_index()
    traffic = get_active_alerts()

    return {
        "sources": [
            {
                "name": "Historical Crash Risk",
                "type": "historical",
                "status": "loaded" if crash_index else "unavailable",
                "purpose": "Quantum ML incident risk prediction",
                "records": len(crash_index),
                "description": "Bengaluru Traffic Police crash data (2007–2025) from OpenCity",
            },
            {
                "name": "Citizen Reports",
                "type": "live",
                "status": "active",
                "purpose": "Primary live emergency input",
                "description": "Citizen-submitted emergency reports analyzed by Gemini AI",
            },
            {
                "name": "Traffic Alerts",
                "type": "enrichment",
                "status": "active" if traffic else "no_data",
                "purpose": "Responder ETA and accessibility risk",
                "records": len(traffic),
                "description": "Bengaluru Traffic Police road closure and congestion data",
            },
            {
                "name": "Google News / Reddit",
                "type": "context",
                "status": "secondary",
                "purpose": "External context only — not primary emergency reports",
                "description": "Filtered through emergency signal classifier; labeled as news context",
            },
            {
                "name": "Weather Context",
                "type": "enrichment",
                "status": "mock",
                "purpose": "Flood risk, fire spread, visibility assessment",
                "description": "Mock monsoon-season weather for hackathon demo",
            },
        ]
    }
