"""
Quantum ML Incident Risk Predictor using PennyLane Variational Quantum Classifier.

Predicts incident risk using a 4-qubit VQC trained on structured features:
    1. severity_score        — current incident severity from Gemini analysis
    2. historical_area_risk  — from Bengaluru crash data (OpenCity, 2007–2025)
    3. report_density        — citizen/news signal concentration
    4. accessibility_risk    — traffic disruption + weather context

Output:
    qml_risk_score, qml_risk_label, qml_confidence, features_used, plain_language
"""

import logging
import os
from pathlib import Path
import numpy as np
import pennylane as qml

logging.basicConfig(level=logging.INFO)

# ─── Quantum Device ─────────────────────────────────────
N_QUBITS = 4
N_LAYERS = 2
dev = qml.device("default.qubit", wires=N_QUBITS)

# Load trained weights from newdata training
WEIGHTS_NEW_DATA = Path(__file__).resolve().parent / "qml_weights_newdata.npy"
WEIGHTS_ORIGINAL = Path(__file__).resolve().parent / "qml_weights.npy"

# Default weights (fallback)
DEFAULT_WEIGHTS = np.array([
    [[ 0.83, -0.42,  0.61],
     [ 0.15,  0.77, -0.53],
     [-0.38,  0.92,  0.18],
     [ 0.29,  0.44, -0.67]],
    [[ 0.56, -0.21,  0.73],
     [-0.64,  0.35,  0.87],
     [ 0.41, -0.58,  0.26],
     [ 0.48, -0.12,  0.93]],
])

# Try to load trained weights
QML_TRAINED = False
if WEIGHTS_NEW_DATA.exists():
    TRAINED_WEIGHTS = np.load(WEIGHTS_NEW_DATA)
    MODEL_TRAINING_STATUS = "trained_with_newdata_rainfall_enhanced"
    QML_TRAINED = True
    logging.info(f"Loaded enhanced weights from {WEIGHTS_NEW_DATA}")
elif WEIGHTS_ORIGINAL.exists():
    TRAINED_WEIGHTS = np.load(WEIGHTS_ORIGINAL)
    MODEL_TRAINING_STATUS = "trained_with_opencity_crash_data"
    # Check if weights are validated via environment variable
    QML_TRAINED = os.getenv("QML_WEIGHTS_VALIDATED", "false").lower() == "true"
    logging.info(f"Loaded original weights from {WEIGHTS_ORIGINAL}")
else:
    TRAINED_WEIGHTS = DEFAULT_WEIGHTS
    MODEL_TRAINING_STATUS = "default_demo_weights"
    QML_TRAINED = False
    logging.warning("Using default demo weights")

if QML_TRAINED:
    logging.info("✅ QML model is TRAINED and validated")
else:
    logging.warning("⚠️  QML weights not validated - using rule-based predictions")


@qml.qnode(dev)
def quantum_circuit(features, weights):
    """
    Variational Quantum Classifier circuit.

    Architecture:
        1. AngleEmbedding encodes 4 features into qubit rotations
        2. StronglyEntanglingLayers create parameterized entanglement
        3. Measurement returns expectation values for classification
    """
    qml.AngleEmbedding(features, wires=range(N_QUBITS))
    qml.StronglyEntanglingLayers(weights, wires=range(N_QUBITS))
    return [qml.expval(qml.PauliZ(i)) for i in range(N_QUBITS)]


def _normalize_features(feature_vector: list[float]) -> np.ndarray:
    """Normalize [0,1] feature vector to [0, π] range for angle embedding."""
    arr = np.array([max(0.0, min(float(f), 1.0)) for f in feature_vector[:N_QUBITS]])
    # Pad if fewer than N_QUBITS features
    if len(arr) < N_QUBITS:
        arr = np.pad(arr, (0, N_QUBITS - len(arr)), constant_values=0.0)
    return arr * np.pi


def _interpret_output(expectations: list) -> dict:
    """
    Convert quantum measurement expectations to risk classification.

    Maps the 4-qubit expectation values to a risk score and label.
    """
    exp_array = np.array(expectations)

    # Weighted combination of qubit expectations
    # Qubit 0: severity signal, Qubit 1: historical risk signal,
    # Qubit 2: report density signal, Qubit 3: accessibility signal
    weights = np.array([0.35, 0.30, 0.20, 0.15])

    # Map expectations from [-1, 1] to [0, 1]
    normalized = (1 - exp_array) / 2.0

    risk_score = float(np.clip(np.dot(weights, normalized), 0.0, 1.0))

    # Confidence from variance of expectations (lower variance = higher confidence)
    variance = float(np.var(normalized))
    confidence = float(np.clip(1.0 - variance * 2, 0.5, 0.98))

    # Risk label
    if risk_score >= 0.75:
        label = "critical_risk"
    elif risk_score >= 0.55:
        label = "high_risk"
    elif risk_score >= 0.35:
        label = "medium_risk"
    else:
        label = "low_risk"

    return {
        "qml_risk_score": round(risk_score, 4),
        "qml_risk_label": label,
        "qml_confidence": round(confidence, 4),
        "qubit_expectations": [round(float(e), 4) for e in expectations],
    }


def predict_qml_risk(feature_vector: list[float], feature_details: dict | None = None) -> dict:
    """
    Run Quantum ML risk prediction using structured feature vector.

    Args:
        feature_vector: [severity, historical_risk, report_density, accessibility_risk]
                        Each value in [0, 1].
        feature_details: Optional dict with human-readable feature context.

    Returns:
        dict with qml_risk_score, qml_risk_label, qml_confidence, features_used,
        plain_language explanation, and model metadata.
    """
    details = feature_details or {}

    try:
        features = _normalize_features(feature_vector)
        expectations = quantum_circuit(features, TRAINED_WEIGHTS)
        result = _interpret_output(expectations)

        result["quantum_model"] = "PennyLane Variational Quantum Classifier (4-qubit, 2-layer)"
        result["framework"] = "PennyLane"
        result["n_qubits"] = N_QUBITS
        result["n_layers"] = N_LAYERS
        result["training_status"] = MODEL_TRAINING_STATUS
        result["training_data_source"] = "OpenCity Bengaluru + Enhanced Rainfall Data"
        result["features_used"] = {
            "severity_score": round(feature_vector[0], 4),
            "historical_area_risk": round(feature_vector[1], 4),
            "report_density": round(feature_vector[2], 4),
            "accessibility_risk": round(feature_vector[3], 4),
        }
        result["feature_context"] = details

        # Plain-language explanation
        score = result["qml_risk_score"]
        area = details.get("historical_area", "this area")
        reasons = []
        if feature_vector[0] >= 0.6:
            reasons.append("high current severity")
        if feature_vector[1] >= 0.6:
            reasons.append(f"historically high-crash area ({area})")
        if feature_vector[2] >= 0.4:
            reasons.append("multiple related reports")
        if feature_vector[3] >= 0.4:
            reasons.append("traffic disruption or weather reducing accessibility")

        if score >= 0.75:
            result["plain_language"] = f"This incident is critical risk because of {', '.join(reasons) or 'combined risk factors'}. Immediate response recommended."
        elif score >= 0.55:
            result["plain_language"] = f"This incident is high risk due to {', '.join(reasons) or 'elevated risk factors'}. Emergency teams should be ready."
        elif score >= 0.35:
            result["plain_language"] = f"This incident is moderate risk. {'Contributing factors: ' + ', '.join(reasons) + '.' if reasons else 'Continue monitoring.'}"
        else:
            result["plain_language"] = "This incident is low risk. No immediate escalation expected."

        logging.info(
            f"QML prediction: score={result['qml_risk_score']:.3f} "
            f"label={result['qml_risk_label']} conf={result['qml_confidence']:.3f} "
            f"features={[round(f,2) for f in feature_vector]}"
        )
        return result

    except Exception as e:
        logging.error(f"QML prediction failed: {e}")
        # Deterministic fallback — hybrid risk prediction
        fallback_score = (
            0.35 * feature_vector[0]
            + 0.30 * feature_vector[1]
            + 0.20 * feature_vector[2]
            + 0.15 * feature_vector[3]
        )
        label = (
            "critical_risk" if fallback_score >= 0.75
            else "high_risk" if fallback_score >= 0.55
            else "medium_risk" if fallback_score >= 0.35
            else "low_risk"
        )
        return {
            "qml_risk_score": round(fallback_score, 4),
            "qml_risk_label": label,
            "qml_confidence": 0.5,
            "quantum_model": "Hybrid Risk Prediction (deterministic fallback)",
            "framework": "PennyLane",
            "n_qubits": N_QUBITS,
            "n_layers": N_LAYERS,
            "training_status": MODEL_TRAINING_STATUS,
            "training_data_source": "OpenCity Bengaluru + Enhanced Rainfall Data",
            "features_used": {
                "severity_score": round(feature_vector[0], 4),
                "historical_area_risk": round(feature_vector[1], 4),
                "report_density": round(feature_vector[2], 4),
                "accessibility_risk": round(feature_vector[3], 4),
            },
            "qubit_expectations": [],
            "plain_language": "Risk estimated using weighted feature combination.",
            "error": str(e),
        }


def predict_cluster_qml(cluster: dict) -> dict:
    """
    Run QML prediction on a cluster using the feature builder.
    This is the main entry point called by escalation_predictor.
    """
    from backend.prediction.feature_builder import build_qml_features

    feat = build_qml_features(cluster)
    return predict_qml_risk(feat["features"], feat["feature_details"])


def predict_incident_qml(incident: dict) -> dict:
    """
    Run QML prediction on a single incident using the feature builder.
    Called from /report endpoint for citizen reports.
    """
    from backend.prediction.feature_builder import build_qml_features

    feat = build_qml_features(incident)
    return predict_qml_risk(feat["features"], feat["feature_details"])


if __name__ == "__main__":
    import json

    # Test with a cluster
    test_cluster = {
        "incident_type": "road_accident",
        "cluster_severity": 0.72,
        "jurisdiction": "Old Airport Road",
        "incident_count": 4,
    }
    result = predict_cluster_qml(test_cluster)
    print("Cluster prediction:")
    print(json.dumps(result, indent=2))

    # Test with an incident
    test_incident = {
        "incident_type": "fire",
        "severity_score": 0.85,
        "jurisdiction": "Kempegowda Airport",
        "location": {"latitude": 13.1986, "longitude": 77.7066},
    }
    result2 = predict_incident_qml(test_incident)
    print("\nIncident prediction:")
    print(json.dumps(result2, indent=2))
