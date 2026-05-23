import logging
import json
from datetime import datetime, timezone

from backend.ingestion.incident_ingestion import run_ingestion, ingest_user_report
from backend.intelligence.incident_analysis import (
    analyze_batch,
    analyze_text_incident,
    analyze_image_incident,
)
from backend.clustering.event_fusion import run_event_fusion
from backend.prediction.escalation_predictor import predict_batch
from backend.quantum.resource_allocator import allocate_resources_quantum
from backend.security.pqc_dispatch import secure_dispatch

logging.basicConfig(level=logging.INFO)

pipeline_state = {
    "last_run": None,
    "incidents": [],
    "analyzed_incidents": [],
    "clusters": [],
    "predictions": [],
    "allocations": [],
    "dispatches": [],
}


async def process_incident_pipeline() -> dict:
    """
    Full pipeline:
        ingest_reports()
            ↓
        analyze_incident()
            ↓
        cluster_events()
            ↓
        predict_escalation()
            ↓
        allocate_resources_quantum()
            ↓
        secure_dispatch()
    """
    logging.info("=" * 60)
    logging.info("STARTING EMERGENCY INTELLIGENCE PIPELINE")
    logging.info("=" * 60)

    # Step 1: Ingest
    logging.info("[1/6] Ingesting emergency reports...")
    raw_incidents = run_ingestion()
    pipeline_state["incidents"] = raw_incidents

    if not raw_incidents:
        logging.warning("No emergency incidents found. Pipeline halted.")
        pipeline_state["last_run"] = datetime.now(timezone.utc).isoformat()
        return pipeline_state

    # Step 2: Analyze with Gemini
    logging.info(f"[2/6] Analyzing {len(raw_incidents)} incidents with Gemini...")
    analyzed = analyze_batch(raw_incidents)
    pipeline_state["analyzed_incidents"] = analyzed

    # Step 3: Cluster/Fuse events
    logging.info(f"[3/6] Fusing {len(analyzed)} incidents into clusters...")
    clusters = run_event_fusion(analyzed)
    pipeline_state["clusters"] = clusters

    if not clusters:
        logging.info("No clusters formed. Pipeline complete (no escalation needed).")
        pipeline_state["last_run"] = datetime.now(timezone.utc).isoformat()
        return pipeline_state

    # Step 4: Hybrid QML + rule-based risk prediction
    logging.info(f"[4/6] Running Quantum ML + rule-based prediction on {len(clusters)} clusters...")
    predictions = predict_batch(clusters)
    pipeline_state["predictions"] = predictions

    for cluster, pred in zip(clusters, predictions):
        cluster["escalation_probability"] = pred["escalation_probability"]
        cluster["predicted_event"] = pred["predicted_event"]
        cluster["qml_risk_score"] = pred.get("qml_risk_score")
        cluster["risk_score"] = pred.get("risk_score")
        cluster["risk_label"] = pred.get("risk_label")
        cluster["plain_language_prediction"] = pred.get("plain_language_prediction")

    # Step 5: Quantum resource allocation
    critical_clusters = [
        c for c, p in zip(clusters, predictions)
        if p.get("risk_score", p.get("escalation_probability", 0)) >= 0.3
    ]

    if critical_clusters:
        logging.info(
            f"[5/6] Quantum allocating resources for {len(critical_clusters)} clusters..."
        )
        allocations = allocate_resources_quantum(critical_clusters)
        pipeline_state["allocations"] = allocations

        # Step 6: PQC secure dispatch
        logging.info(f"[6/6] Encrypting {len(allocations)} dispatch messages (Kyber512)...")
        dispatches = secure_dispatch(allocations)
        pipeline_state["dispatches"] = dispatches
    else:
        logging.info("[5/6] No critical clusters — skipping allocation")
        logging.info("[6/6] No dispatches needed")
        pipeline_state["allocations"] = []
        pipeline_state["dispatches"] = []

    pipeline_state["last_run"] = datetime.now(timezone.utc).isoformat()

    logging.info("=" * 60)
    logging.info("PIPELINE COMPLETE")
    logging.info(
        f"  Incidents: {len(raw_incidents)} | "
        f"Clusters: {len(clusters)} | "
        f"Allocations: {len(pipeline_state['allocations'])} | "
        f"Dispatches: {len(pipeline_state['dispatches'])}"
    )
    logging.info("=" * 60)

    return pipeline_state


async def process_single_report(
    text: str,
    location: dict,
    timestamp: str,
    image_bytes: bytes = None,
) -> dict:
    """Process a single user-submitted incident report through the pipeline."""
    logging.info("Processing single incident report...")

    if image_bytes:
        analysis = analyze_image_incident(image_bytes, additional_text=text)
        analysis["location"] = location
        analysis["published"] = timestamp
    else:
        raw = ingest_user_report(text, location, timestamp)
        analysis = analyze_text_incident(raw)

    existing_incidents = pipeline_state.get("analyzed_incidents", [])
    existing_incidents.append(analysis)
    pipeline_state["analyzed_incidents"] = existing_incidents

    clusters = run_event_fusion(existing_incidents)
    pipeline_state["clusters"] = clusters

    if clusters:
        predictions = predict_batch(clusters)
        pipeline_state["predictions"] = predictions

        for cluster, pred in zip(clusters, predictions):
            cluster["escalation_probability"] = pred["escalation_probability"]
            cluster["qml_risk_score"] = pred.get("qml_risk_score")
            cluster["risk_score"] = pred.get("risk_score")
            cluster["risk_label"] = pred.get("risk_label")
            cluster["plain_language_prediction"] = pred.get("plain_language_prediction")

        critical = [
            c for c, p in zip(clusters, predictions)
            if p.get("risk_score", p.get("escalation_probability", 0)) >= 0.3
        ]

        if critical:
            allocations = allocate_resources_quantum(critical)
            pipeline_state["allocations"] = allocations
            dispatches = secure_dispatch(allocations)
            pipeline_state["dispatches"] = dispatches

    return {
        "incident": analysis,
        "clusters": clusters,
        "allocations": pipeline_state.get("allocations", []),
    }


def get_pipeline_state() -> dict:
    """Return current pipeline state for the dashboard."""
    return pipeline_state


if __name__ == "__main__":
    import asyncio
    result = asyncio.run(process_incident_pipeline())
    print(json.dumps(
        {"incidents": len(result["incidents"]),
         "clusters": len(result["clusters"]),
         "allocations": len(result["allocations"]),
         "dispatches": len(result["dispatches"])},
        indent=2
    ))
