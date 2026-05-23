"""
Responder State Manager

Tracks availability of each emergency responder across pipeline calls.
Prevents the same unit from being double-dispatched to two clusters.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Mirrors DEFAULT_RESPONDERS in resource_allocator.py
_BASE_RESPONDERS = [
    {"id": "ambulance_1",   "type": "ambulance",    "lat": 12.9716, "lng": 77.5946},
    {"id": "ambulance_2",   "type": "ambulance",    "lat": 12.9352, "lng": 77.6245},
    {"id": "ambulance_3",   "type": "ambulance",    "lat": 12.9081, "lng": 77.6476},
    {"id": "fire_truck_1",  "type": "fire_truck",   "lat": 12.9783, "lng": 77.5710},
    {"id": "fire_truck_2",  "type": "fire_truck",   "lat": 12.9141, "lng": 77.6368},
    {"id": "rescue_team_1", "type": "rescue_team",  "lat": 12.9698, "lng": 77.7500},
    {"id": "rescue_team_2", "type": "rescue_team",  "lat": 12.9260, "lng": 77.5830},
    {"id": "police_1",      "type": "police",       "lat": 12.9550, "lng": 77.6070},
    {"id": "police_2",      "type": "police",       "lat": 12.9400, "lng": 77.5850},
    {"id": "hazmat_unit_1", "type": "hazmat_unit",  "lat": 12.9600, "lng": 77.6400},
    {"id": "medical_team_1","type": "medical_team", "lat": 12.9500, "lng": 77.5900},
]

# State: responder_id → {"status": "available"|"dispatched", "free_at": datetime|None,
#                        "assigned_cluster": str|None}
_state: dict[str, dict] = {}


def _init():
    global _state
    if not _state:
        _state = {
            r["id"]: {"status": "available", "free_at": None, "assigned_cluster": None}
            for r in _BASE_RESPONDERS
        }


def get_available_responders() -> list[dict]:
    """Return only responders that are currently available."""
    _init()
    now = datetime.now(timezone.utc)
    available = []
    for r in _BASE_RESPONDERS:
        s = _state[r["id"]]
        # Auto-release if their ETA has passed (estimated job duration = eta + 45 min)
        if s["status"] == "dispatched" and s["free_at"] and now >= s["free_at"]:
            logger.info(f"Auto-releasing {r['id']} — ETA has passed")
            release_responder(r["id"])
        if _state[r["id"]]["status"] == "available":
            available.append(r)
    logger.info(f"Available responders: {len(available)}/{len(_BASE_RESPONDERS)}")
    return available


def mark_dispatched(responder_id: str, cluster_id: str, eta_minutes: float):
    """Mark a responder as dispatched with expected free time."""
    _init()
    if responder_id not in _state:
        logger.warning(f"Unknown responder: {responder_id}")
        return
    free_at = datetime.now(timezone.utc) + timedelta(minutes=eta_minutes + 45)
    _state[responder_id] = {
        "status": "dispatched",
        "free_at": free_at,
        "assigned_cluster": cluster_id,
    }
    logger.info(f"Marked {responder_id} dispatched to {cluster_id}, free ~{free_at.isoformat()}")


def release_responder(responder_id: str):
    """Mark a responder available again."""
    _init()
    _state[responder_id] = {"status": "available", "free_at": None, "assigned_cluster": None}


def get_all_state() -> dict:
    _init()
    return dict(_state)


def reset_all():
    """Reset all responders to available. Use after demo scenario loads."""
    global _state
    _state = {
        r["id"]: {"status": "available", "free_at": None, "assigned_cluster": None}
        for r in _BASE_RESPONDERS
    }
