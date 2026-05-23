import logging
from backend.models.incident import EscalationPrediction
from backend.quantum.qml_incident_predictor import predict_cluster_qml

logging.basicConfig(level=logging.INFO)

ESCALATION_RULES = {
    "flood": {
        "high_threshold": 3,
        "critical_threshold": 5,
        "predicted_event": "large_scale_flooding",
        "action": "Deploy flood rescue teams and evacuate low-lying areas",
    },
    "fire": {
        "high_threshold": 2,
        "critical_threshold": 4,
        "predicted_event": "multi_structure_fire",
        "action": "Deploy additional fire units and establish perimeter",
    },
    "road_accident": {
        "high_threshold": 3,
        "critical_threshold": 6,
        "predicted_event": "mass_casualty_event",
        "action": "Activate mass casualty protocol and deploy medical teams",
    },
    "power_outage": {
        "high_threshold": 5,
        "critical_threshold": 10,
        "predicted_event": "grid_failure",
        "action": "Notify power utility and deploy backup generators",
    },
    "infrastructure_failure": {
        "high_threshold": 2,
        "critical_threshold": 3,
        "predicted_event": "structural_collapse_zone",
        "action": "Evacuate surrounding buildings and deploy rescue teams",
    },
    "crowd_risk": {
        "high_threshold": 2,
        "critical_threshold": 4,
        "predicted_event": "stampede_risk",
        "action": "Deploy crowd control and open emergency exits",
    },
    "medical_emergency": {
        "high_threshold": 4,
        "critical_threshold": 8,
        "predicted_event": "disease_outbreak",
        "action": "Alert hospitals and deploy mobile medical units",
    },
    "hazardous_material": {
        "high_threshold": 1,
        "critical_threshold": 2,
        "predicted_event": "hazmat_contamination_zone",
        "action": "Evacuate area and deploy hazmat response team",
    },
    "rescue_required": {
        "high_threshold": 2,
        "critical_threshold": 4,
        "predicted_event": "mass_rescue_operation",
        "action": "Deploy all available rescue units",
    },
}

DEFAULT_RULE = {
    "high_threshold": 5,
    "critical_threshold": 10,
    "predicted_event": "escalating_emergency",
    "action": "Monitor closely and prepare additional resources",
}


def predict_escalation(cluster: dict) -> dict:
    """
    Rule-based escalation prediction for an incident cluster.

    Inputs from cluster:
        - incident_count
        - cluster_severity
        - escalation_trend
        - incident_type
        - geographic_spread_km (optional)
    """
    incident_type = cluster.get("incident_type", "other")
    incident_count = cluster.get("incident_count", 0)
    severity = cluster.get("cluster_severity", 0.0)
    trend = cluster.get("escalation_trend", "stable")
    spread_km = cluster.get("geographic_spread_km", 0.0)

    rule = ESCALATION_RULES.get(incident_type, DEFAULT_RULE)

    base_probability = 0.0

    if severity >= 0.9:
        base_probability += 0.4
    elif severity >= 0.7:
        base_probability += 0.25
    elif severity >= 0.5:
        base_probability += 0.15

    if incident_count >= rule["critical_threshold"]:
        base_probability += 0.35
    elif incident_count >= rule["high_threshold"]:
        base_probability += 0.2

    if trend == "rapidly_increasing":
        base_probability += 0.2
    elif trend == "increasing":
        base_probability += 0.1

    if spread_km > 5.0:
        base_probability += 0.05

    # ─── Signal confidence & source diversity boosters ────────
    confidence_score = cluster.get("confidence_score", 0.0)
    source_diversity = cluster.get("source_diversity", 0)
    why_reasons = cluster.get("why_we_believe_this", [])

    if confidence_score >= 0.75:
        base_probability += 0.15
    elif confidence_score >= 0.60:
        base_probability += 0.10

    if source_diversity >= 3:
        base_probability += 0.08

    if any("Traffic disruption" in r for r in why_reasons):
        base_probability += 0.07

    if any("historical risk" in r.lower() for r in why_reasons):
        base_probability += 0.06

    if any("Responder access" in r for r in why_reasons):
        base_probability += 0.06

    escalation_probability = min(base_probability, 1.0)

    if escalation_probability >= 0.7:
        predicted_event = rule["predicted_event"]
        confidence = escalation_probability
        action = rule["action"]
    elif escalation_probability >= 0.4:
        predicted_event = f"potential_{rule['predicted_event']}"
        confidence = escalation_probability * 0.8
        action = f"Prepare for: {rule['action']}"
    else:
        predicted_event = "monitoring"
        confidence = escalation_probability
        action = "Continue monitoring, no immediate escalation expected"

    # ─── Quantum ML Risk Prediction ───────────────────────
    qml_result = predict_cluster_qml(cluster)
    qml_risk_score = qml_result.get("qml_risk_score", 0.5)

    # ─── Hybrid Score: Use QML only if trained and validated ─────────────
    from backend.quantum.qml_incident_predictor import QML_TRAINED
    if QML_TRAINED:
        # Trained model: trust QML more
        combined_score = 0.6 * qml_risk_score + 0.4 * escalation_probability
        logging.info(f"Using hybrid score (QML trained): {combined_score:.3f}")
    else:
        # Untrained / fallback weights: trust rule-based entirely
        combined_score = escalation_probability
        logging.info(f"Using rule-based score only (QML not validated): {combined_score:.3f}")
    
    combined_score = min(combined_score, 1.0)

    # ─── Risk Label ─────────────────────────────────────────
    if combined_score >= 0.75:
        risk_label = "critical"
    elif combined_score >= 0.55:
        risk_label = "high"
    elif combined_score >= 0.35:
        risk_label = "medium"
    else:
        risk_label = "low"

    # ─── Plain Language Explanation ─────────────────────────
    incident_name = incident_type.replace('_', ' ')
    if combined_score >= 0.7:
        plain_prediction = (
            f"This {incident_name} cluster is likely to worsen soon because multiple independent signals "
            f"are pointing to the same location. Immediate response is recommended."
        )
    elif combined_score >= 0.5:
        plain_prediction = (
            f"This {incident_name} cluster may escalate. Keep responders ready and warn citizens nearby."
        )
    elif combined_score >= 0.3:
        plain_prediction = (
            f"This {incident_name} cluster shows early risk. Continue monitoring and ask for confirmation."
        )
    else:
        plain_prediction = (
            f"This {incident_name} signal appears stable for now. No immediate escalation expected."
        )

    # Use QML plain_language if available (richer, feature-aware)
    qml_plain = qml_result.get("plain_language", "")
    if qml_plain and combined_score >= 0.3:
        plain_prediction = qml_plain

    result = {
        "cluster_id": cluster.get("cluster_id", ""),
        "escalation_probability": round(escalation_probability, 3),
        "predicted_event": predicted_event,
        "confidence": round(confidence, 3),
        "recommended_action": action,
        # Hybrid QML fields
        "risk_score": round(combined_score, 3),
        "risk_label": risk_label,
        "qml_risk_score": qml_result.get("qml_risk_score"),
        "qml_risk_label": qml_result.get("qml_risk_label"),
        "qml_confidence": qml_result.get("qml_confidence"),
        "qml_features_used": qml_result.get("features_used"),
        "qml_feature_context": qml_result.get("feature_context"),
        "rule_score": round(escalation_probability, 3),
        "prediction_method": "hybrid_qml_rule_based",
        "quantum_model": qml_result.get("quantum_model"),
        "plain_language_prediction": plain_prediction,
    }

    logging.info(
        f"Hybrid prediction for {incident_type} cluster: "
        f"combined={combined_score:.2f} (qml={qml_risk_score:.2f}, rule={escalation_probability:.2f}), "
        f"label={risk_label}"
    )
    return result


def predict_batch(clusters: list[dict]) -> list[dict]:
    """Run escalation prediction on all clusters."""
    predictions = []
    for cluster in clusters:
        pred = predict_escalation(cluster)
        predictions.append(pred)
    return predictions


if __name__ == "__main__":
    import json
    test_cluster = {
        "cluster_id": "test_cluster_1",
        "incident_count": 6,
        "cluster_severity": 0.88,
        "escalation_trend": "rapidly_increasing",
        "incident_type": "flood",
        "geographic_spread_km": 3.5,
    }
    result = predict_escalation(test_cluster)
    print(json.dumps(result, indent=2))
