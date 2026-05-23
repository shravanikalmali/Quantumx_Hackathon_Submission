from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class IncidentLocation(BaseModel):
    latitude: float
    longitude: float
    address: Optional[str] = None
    jurisdiction: Optional[str] = None


class Incident(BaseModel):
    id: str = ""
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    source: str = ""
    location: Optional[IncidentLocation] = None
    raw_text: str = ""
    media_urls: list[str] = Field(default_factory=list)

    incident_type: str = "other"
    severity_score: float = 0.0
    urgency_level: str = "low"
    escalation_probability: float = 0.0

    estimated_people_affected: int = 0
    recommended_resources: list[str] = Field(default_factory=list)

    cluster_id: Optional[str] = None
    summary: str = ""
    link: Optional[str] = None
    title: Optional[str] = None


ALLOWED_INCIDENT_TYPES = [
    "fire",
    "flood",
    "road_accident",
    "medical_emergency",
    "power_outage",
    "infrastructure_failure",
    "crowd_risk",
    "hazardous_material",
    "rescue_required",
    "other",
]

URGENCY_LEVELS = ["low", "medium", "high", "critical"]


class IncidentCluster(BaseModel):
    cluster_id: str = ""
    incident_ids: list[str] = Field(default_factory=list)
    incident_count: int = 0
    cluster_severity: float = 0.0
    escalation_trend: str = "stable"
    regions: list[str] = Field(default_factory=list)
    recommended_response: str = "normal"
    summary: str = ""
    incident_type: str = "other"


class ResourceAllocation(BaseModel):
    responder_id: str
    responder_type: str
    assigned_cluster: str
    eta_minutes: float
    priority_score: float


class DispatchMessage(BaseModel):
    dispatch_id: str
    allocation: ResourceAllocation
    encrypted: bool = False
    algorithm: str = ""
    ciphertext: Optional[str] = None
    plaintext_summary: str = ""


class EscalationPrediction(BaseModel):
    cluster_id: str
    escalation_probability: float
    predicted_event: str
    confidence: float
    recommended_action: str
