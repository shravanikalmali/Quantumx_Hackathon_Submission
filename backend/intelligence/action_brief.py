def build_action_briefs(cluster: dict, prediction: dict, allocations: list[dict]) -> dict:
    area = cluster.get("jurisdiction", "affected area")
    incident_type = cluster.get("incident_type", "incident").replace("_", " ")
    confidence = cluster.get("confidence_percent", 0)
    risk_label = prediction.get("risk_label", "medium")
    reasons = cluster.get("why_we_believe_this", [])

    citizen_advisory = (
        f"Avoid {area} if possible. Reports indicate {incident_type} risk with "
        f"{confidence}% verification confidence. Use alternate routes and do not enter flooded underpasses."
    )

    responder_units = [
        {
            "team": a.get("responder_type", "responder").replace("_", " ").title(),
            "eta_minutes": a.get("eta_minutes"),
            "distance_km": a.get("distance_km"),
            "responder_id": a.get("responder_id"),
        }
        for a in allocations
        if a.get("assigned_cluster") == cluster.get("cluster_id")
    ]

    responder_dispatch_plan = {
        "priority": risk_label,
        "area": area,
        "incident_type": incident_type,
        "recommended_action": prediction.get("recommended_action"),
        "assigned_units": responder_units,
        "field_instruction": (
            f"Proceed to {area}. Check underpass flooding, stranded vehicles, and blocked access routes. "
            f"Prioritize traffic diversion and rescue support."
        ),
    }

    authority_command_brief = {
        "headline": f"Emerging {incident_type} cluster verified near {area}",
        "truth_statement": cluster.get("truth_statement"),
        "confidence": f"{confidence}%",
        "source_breakdown": cluster.get("source_breakdown", {}),
        "risk_reasons": reasons,
        "prediction": prediction.get("plain_language_prediction"),
        "decision_needed": [
            "Issue public route advisory",
            "Coordinate traffic diversion",
            "Deploy pumping or rescue support if water level rises",
            "Keep ambulance and police support near access points",
        ],
    }

    encrypted_dispatch_note = {
        "message_type": "secure_responder_dispatch",
        "area": area,
        "incident_type": incident_type,
        "priority": risk_label,
        "instruction": responder_dispatch_plan["field_instruction"],
        "citizen_safety_message": citizen_advisory,
    }

    return {
        "citizen_advisory": citizen_advisory,
        "responder_dispatch_plan": responder_dispatch_plan,
        "authority_command_brief": authority_command_brief,
        "encrypted_dispatch_note": encrypted_dispatch_note,
    }
