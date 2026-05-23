"""
Train QML model with NEW data including rainfall and additional crash data
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import numpy as np
import pandas as pd
import pennylane as qml
from pennylane import numpy as pnp

logging.basicConfig(level=logging.INFO)

# Paths
NEW_DATA_DIR = Path("backend/data/newdata")
PROCESSED_DIR = Path("backend/data/processed")
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

# Output files
RISK_JSON = PROCESSED_DIR / "crash_risk_with_newdata.json"
TRAIN_CSV = PROCESSED_DIR / "qml_training_with_newdata.csv"
WEIGHTS_PATH = Path("backend/quantum/qml_weights_newdata.npy")

# QML config
N_QUBITS = 4
N_LAYERS = 2
dev = qml.device("default.qubit", wires=N_QUBITS)


def load_new_crash_data():
    """Load all crash CSV files from newdata directory"""
    crash_files = [
        "492d3dc6-ffc3-4b0e-b7d9-176d0ef7f1ec.csv",  # 2020_2022
        "74e645e3-85d2-4d81-a133-4f346f87fdd6.csv",  # 2024
        "abc5af52-08a7-4435-8ba1-12b99f62ee28.csv",  # 2023
        "btp_2025_station_wise.csv",                 # 2025
        "aef42379-f1f7-4a3b-94f5-5f344e7120f2.csv",  # Additional
    ]
    
    all_data = []
    
    for file in crash_files:
        path = NEW_DATA_DIR / file
        if not path.exists():
            logging.warning(f"Missing: {file}")
            continue
            
        try:
            df = pd.read_csv(path)
            logging.info(f"Loaded {file}: {len(df)} rows")
            all_data.append(df)
        except Exception as e:
            logging.error(f"Failed to load {file}: {e}")
    
    if not all_data:
        raise RuntimeError("No crash data files found")
    
    return pd.concat(all_data, ignore_index=True)


def load_rainfall_data():
    """Load rainfall data for Bengaluru area"""
    rainfall_files = [
        "ka_dist_rainfall_2025.csv",
        "karnataka_rainfall_2025_table1_1.csv",
    ]
    
    rainfall_data = {}
    
    for file in rainfall_files:
        path = NEW_DATA_DIR / file
        if not path.exists():
            logging.warning(f"Missing rainfall: {file}")
            continue
            
        try:
            df = pd.read_csv(path)
            
            # Extract Bengaluru rainfall data
            if "District" in df.columns:
                bengaluru_rows = df[df["District"].str.contains("Bengaluru", case=False, na=False)]
                for _, row in bengaluru_rows.iterrows():
                    district = row["District"]
                    actual = row.get("Annual Actual", 0) or row.get("Actual_mm", 0)
                    rainfall_data[district] = float(actual)
            
            elif "District/Taluk/Hobli" in df.columns:
                bengaluru_rows = df[df["District/Taluk/Hobli"].str.contains("BENGALURU", case=False, na=False)]
                for _, row in bengaluru_rows.iterrows():
                    area = row["District/Taluk/Hobli"]
                    actual = row.get("Actual_mm", 0)
                    rainfall_data[area] = float(actual)
            
            logging.info(f"Loaded rainfall from {file}: {len(rainfall_data)} areas")
            
        except Exception as e:
            logging.error(f"Failed to load rainfall {file}: {e}")
    
    return rainfall_data


def normalize_crash_data(df):
    """Normalize crash data columns"""
    # Find relevant columns
    station_col = None
    fatal_col = None
    total_col = None
    
    for col in df.columns:
        col_lower = col.lower()
        if "station" in col_lower and station_col is None:
            station_col = col
        elif "fatal" in col_lower and fatal_col is None:
            fatal_col = col
        elif "total" in col_lower and "case" in col_lower and total_col is None:
            total_col = col
    
    if not station_col:
        raise ValueError("No station column found")
    
    # Create normalized dataframe
    normalized = pd.DataFrame()
    normalized["area"] = df[station_col].astype(str).str.strip()
    
    # Extract fatal cases
    if fatal_col:
        normalized["fatal_cases"] = pd.to_numeric(df[fatal_col], errors="coerce").fillna(0)
    else:
        normalized["fatal_cases"] = 0
    
    # Extract total cases
    if total_col:
        normalized["total_cases"] = pd.to_numeric(df[total_col], errors="coerce").fillna(0)
    else:
        # Try to find non-fatal and calculate total
        non_fatal_cols = [col for col in df.columns if "non" in col.lower() and "fatal" in col.lower()]
        if non_fatal_cols:
            normalized["total_cases"] = normalized["fatal_cases"] + pd.to_numeric(df[non_fatal_cols[0]], errors="coerce").fillna(0)
        else:
            normalized["total_cases"] = normalized["fatal_cases"]
    
    # Remove totals and empty rows
    normalized = normalized[~normalized["area"].str.contains("Total", case=False, na=False)]
    normalized = normalized[normalized["area"] != ""]
    
    return normalized


def calculate_risk_scores(crash_df, rainfall_data):
    """Calculate enhanced risk scores including rainfall"""
    # Aggregate crash data by area
    crash_agg = crash_df.groupby("area").agg({
        "total_cases": "sum",
        "fatal_cases": "sum"
    }).reset_index()
    
    # Add rainfall data
    crash_agg["rainfall_mm"] = crash_agg["area"].map(rainfall_data).fillna(0)
    
    # Calculate ratios
    crash_agg["fatality_ratio"] = np.where(
        crash_agg["total_cases"] > 0,
        crash_agg["fatal_cases"] / crash_agg["total_cases"],
        0
    )
    
    # Normalize features
    def minmax(series):
        series = pd.to_numeric(series, errors="coerce").fillna(0).astype(float)
        if series.max() == series.min():
            return np.ones(len(series)) * 0.5
        return (series - series.min()) / (series.max() - series.min())
    
    crash_agg["total_norm"] = minmax(crash_agg["total_cases"])
    crash_agg["fatal_norm"] = minmax(crash_agg["fatal_cases"])
    crash_agg["fatality_norm"] = minmax(crash_agg["fatality_ratio"])
    crash_agg["rainfall_norm"] = minmax(crash_agg["rainfall_mm"])
    
    # Enhanced risk score (including rainfall)
    crash_agg["historical_risk_score"] = (
        0.35 * crash_agg["total_norm"] +      # Crash volume
        0.25 * crash_agg["fatal_norm"] +      # Fatal crashes
        0.15 * crash_agg["fatality_norm"] +    # Fatality ratio
        0.15 * crash_agg["rainfall_norm"] +   # Rainfall risk
        0.10  # Base risk
    )
    
    # Risk labels
    def label(score):
        if score >= 0.75:
            return "critical"
        elif score >= 0.55:
            return "high"
        elif score >= 0.35:
            return "medium"
        else:
            return "low"
    
    crash_agg["risk_label"] = crash_agg["historical_risk_score"].apply(label)
    
    return crash_agg.sort_values("historical_risk_score", ascending=False)


def generate_training_data(risk_df):
    """Generate training data with enhanced features"""
    rows = []
    rng = np.random.default_rng(42)
    
    for _, row in risk_df.iterrows():
        hist_risk = float(row["historical_risk_score"])
        rainfall = float(row.get("rainfall_mm", 0))
        
        # Generate multiple incident examples per area
        for _ in range(50):
            # Enhanced severity considering rainfall
            base_severity = rng.normal(loc=0.35 + 0.45 * hist_risk, scale=0.18)
            rainfall_impact = min(rainfall / 1000, 0.3)  # Rainfall adds up to 0.3 severity
            severity = float(np.clip(base_severity + rainfall_impact, 0, 1))
            
            report_density = float(np.clip(rng.beta(2, 5) + 0.25 * hist_risk, 0, 1))
            
            # Enhanced accessibility risk considering rainfall
            base_access = rng.beta(2, 4) + 0.20 * hist_risk
            rainfall_access_impact = min(rainfall / 500, 0.4)  # Heavy rain increases accessibility risk
            accessibility_risk = float(np.clip(base_access + rainfall_access_impact, 0, 1))
            
            # Calculate risk score
            risk_score = (
                0.35 * severity +
                0.30 * hist_risk +
                0.20 * report_density +
                0.15 * accessibility_risk
            )
            
            label_binary = 1 if risk_score >= 0.55 else 0
            
            rows.append({
                "area": row["area"],
                "severity_score": severity,
                "historical_area_risk": hist_risk,
                "report_density": report_density,
                "accessibility_risk": accessibility_risk,
                "rainfall_mm": rainfall,
                "risk_score": risk_score,
                "risk_label_binary": label_binary,
            })
    
    return pd.DataFrame(rows)


@qml.qnode(dev)
def circuit(features, weights):
    qml.AngleEmbedding(features * np.pi, wires=range(N_QUBITS))
    qml.StronglyEntanglingLayers(weights, wires=range(N_QUBITS))
    return qml.expval(qml.PauliZ(0))


def predict_prob(features, weights):
    z = circuit(features, weights)
    return (1 - z) / 2


def train_qml_model(X_train, y_train, X_test, y_test):
    """Train the QML model"""
    rng = np.random.default_rng(42)
    weights = pnp.array(
        rng.normal(0, 0.1, size=(N_LAYERS, N_QUBITS, 3)),
        requires_grad=True,
    )
    
    opt = qml.AdamOptimizer(stepsize=0.05)
    
    def loss_fn(weights, X, y):
        preds = pnp.array([predict_prob(x, weights) for x in X])
        y_true = pnp.array(y)
        y_pred = pnp.clip(preds, 1e-7, 1 - 1e-7)
        return -pnp.mean(y_true * pnp.log(y_pred) + (1 - y_true) * pnp.log(1 - y_pred))
    
    # Training loop
    for epoch in range(40):
        weights = opt.step(lambda w: loss_fn(w, X_train, y_train), weights)
        
        if epoch % 5 == 0 or epoch == 39:
            train_loss = float(loss_fn(weights, X_train, y_train))
            train_acc = np.mean(np.array([float(predict_prob(x, weights)) >= 0.5 for x in X_train]) == y_train)
            test_acc = np.mean(np.array([float(predict_prob(x, weights)) >= 0.5 for x in X_test]) == y_test)
            print(f"epoch={epoch:02d} loss={train_loss:.4f} train_acc={train_acc:.3f} test_acc={test_acc:.3f}")
    
    return np.array(weights)


def main():
    print("=== Training QML with NEW Data ===")
    
    # 1. Load new crash data
    print("\n1. Loading crash data...")
    crash_df = load_new_crash_data()
    normalized_crash = normalize_crash_data(crash_df)
    print(f"   Loaded {len(normalized_crash)} crash records")
    
    # 2. Load rainfall data
    print("\n2. Loading rainfall data...")
    rainfall_data = load_rainfall_data()
    print(f"   Loaded rainfall for {len(rainfall_data)} areas")
    
    # 3. Calculate risk scores
    print("\n3. Calculating risk scores...")
    risk_df = calculate_risk_scores(normalized_crash, rainfall_data)
    print(f"   Calculated risk for {len(risk_df)} areas")
    
    # 4. Save risk index
    print("\n4. Saving risk data...")
    risk_index = {}
    for _, row in risk_df.iterrows():
        risk_index[row["area"]] = {
            "area": row["area"],
            "total_cases": int(row["total_cases"]),
            "fatal_cases": int(row["fatal_cases"]),
            "rainfall_mm": float(row.get("rainfall_mm", 0)),
            "fatality_ratio": float(row["fatality_ratio"]),
            "historical_risk_score": float(row["historical_risk_score"]),
            "risk_label": row["risk_label"],
            "source": "OpenCity Bengaluru + New Rainfall Data",
        }
    
    with open(RISK_JSON, "w") as f:
        json.dump(risk_index, f, indent=2)
    print(f"   Saved {RISK_JSON}")
    
    # 5. Generate training data
    print("\n5. Generating training data...")
    train_df = generate_training_data(risk_df)
    train_df.to_csv(TRAIN_CSV, index=False)
    print(f"   Generated {len(train_df)} training examples")
    
    # 6. Train QML model
    print("\n6. Training QML model...")
    X = train_df[["severity_score", "historical_area_risk", "report_density", "accessibility_risk"]].values
    y = train_df["risk_label_binary"].values
    
    # Split data
    rng = np.random.default_rng(42)
    idx = rng.permutation(len(X))
    X, y = X[idx], y[idx]
    
    # Use subset for training
    X_subset = X[:300]
    y_subset = y[:300]
    
    split = int(0.8 * len(X_subset))
    X_train = pnp.array(X_subset[:split], requires_grad=False)
    y_train = pnp.array(y_subset[:split], requires_grad=False)
    X_test = pnp.array(X_subset[split:], requires_grad=False)
    y_test = pnp.array(y_subset[split:], requires_grad=False)
    
    # Train
    trained_weights = train_qml_model(X_train, y_train, X_test, y_test)
    
    # 7. Save weights
    print("\n7. Saving trained weights...")
    WEIGHTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    np.save(WEIGHTS_PATH, trained_weights)
    print(f"   Saved {WEIGHTS_PATH}")
    
    # 8. Summary
    print("\n=== Training Complete ===")
    print(f"Areas processed: {len(risk_df)}")
    print(f"Training examples: {len(train_df)}")
    print(f"Top 5 risk areas:")
    for _, row in risk_df.head(5).iterrows():
        print(f"  {row['area']}: risk={row['historical_risk_score']:.3f}, crashes={row['total_cases']}, rainfall={row.get('rainfall_mm', 0):.1f}mm")
    
    print(f"\nFiles created:")
    print(f"  - {RISK_JSON}")
    print(f"  - {TRAIN_CSV}")
    print(f"  - {WEIGHTS_PATH}")


if __name__ == "__main__":
    main()
