"""
Continuous Training Agent

Monitors live data ingestion and decides when to retrain the QML model.
Strategies:
- Time-based: Retrain every N hours
- Data-based: Retrain when N new records arrive
- Performance-based: Retrain if accuracy drops
- Hybrid: Combination of above
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import pennylane as qml
from pennylane import numpy as pnp

logging.basicConfig(level=logging.INFO)

# Paths
LIVE_DATA_DIR = Path("backend/data/live")
HISTORICAL_DATA_PATH = Path("backend/data/processed/qml_training_with_newdata.csv")
COMBINED_DATA_PATH = Path("backend/data/processed/qml_training_combined.csv")
WEIGHTS_PATH = Path("backend/quantum/qml_weights_live.npy")

# QML Config
N_QUBITS = 4
N_LAYERS = 2
dev = qml.device("default.qubit", wires=N_QUBITS)


class ContinuousTrainingAgent:
    """Agent that monitors and retrains the QML model."""

    def __init__(self):
        self.last_training_time = None
        self.training_history = []
        self.model_performance = {
            "accuracy": 0.0,
            "loss": 0.0,
            "training_samples": 0,
        }

    def load_live_data(self) -> pd.DataFrame:
        """Load all live data from JSONL files"""
        live_records = []
        
        for jsonl_file in LIVE_DATA_DIR.glob("*.jsonl"):
            try:
                with open(jsonl_file, "r") as f:
                    for line in f:
                        if line.strip():
                            record = json.loads(line)
                            live_records.append(record)
                logging.info(f"Loaded {len(live_records)} records from {jsonl_file.name}")
            except Exception as e:
                logging.error(f"Failed to load {jsonl_file}: {e}")
        
        if not live_records:
            logging.warning("No live data found")
            return pd.DataFrame()
        
        return pd.DataFrame(live_records)

    def convert_live_to_training_format(self, live_df: pd.DataFrame) -> pd.DataFrame:
        """Convert live data to QML training format"""
        training_rows = []
        rng = np.random.default_rng(42)
        
        for _, record in live_df.iterrows():
            # Extract features from live data
            severity = float(record.get("severity", 0.5))
            
            # Simulate historical risk (in real system, lookup from database)
            historical_risk = float(record.get("historical_risk", 0.35))
            
            # Calculate report density (1 live report = 0.1 density)
            report_density = 0.1
            
            # Accessibility from traffic/weather
            accessibility = float(record.get("accessibility_risk", 0.3))
            
            # Calculate risk score
            risk_score = (
                0.35 * severity +
                0.30 * historical_risk +
                0.20 * report_density +
                0.15 * accessibility
            )
            
            label = 1 if risk_score >= 0.55 else 0
            
            training_rows.append({
                "area": record.get("location", "Unknown"),
                "severity_score": severity,
                "historical_area_risk": historical_risk,
                "report_density": report_density,
                "accessibility_risk": accessibility,
                "risk_score": risk_score,
                "risk_label_binary": label,
                "source": "live_data",
                "timestamp": record.get("ingested_at", datetime.now().isoformat()),
            })
        
        return pd.DataFrame(training_rows)

    def combine_historical_and_live(self) -> pd.DataFrame:
        """Combine historical training data with new live data"""
        try:
            # Load historical data
            historical_df = pd.read_csv(HISTORICAL_DATA_PATH)
            logging.info(f"Loaded {len(historical_df)} historical records")
            
            # Load and convert live data
            live_df = self.load_live_data()
            if live_df.empty:
                logging.warning("No live data, using historical only")
                return historical_df
            
            live_training_df = self.convert_live_to_training_format(live_df)
            logging.info(f"Converted {len(live_training_df)} live records to training format")
            
            # Combine
            combined_df = pd.concat([historical_df, live_training_df], ignore_index=True)
            
            # Save combined data
            combined_df.to_csv(COMBINED_DATA_PATH, index=False)
            logging.info(f"Combined dataset: {len(combined_df)} total records")
            
            return combined_df
            
        except Exception as e:
            logging.error(f"Failed to combine data: {e}")
            return pd.DataFrame()

    def train_qml_model(self, X_train: np.ndarray, y_train: np.ndarray, 
                       X_test: np.ndarray, y_test: np.ndarray) -> tuple[np.ndarray, dict]:
        """Train QML model on combined data"""
        
        @qml.qnode(dev)
        def circuit(features, weights):
            qml.AngleEmbedding(features * np.pi, wires=range(N_QUBITS))
            qml.StronglyEntanglingLayers(weights, wires=range(N_QUBITS))
            return qml.expval(qml.PauliZ(0))
        
        def predict_prob(features, weights):
            z = circuit(features, weights)
            return (1 - z) / 2
        
        def loss_fn(weights, X, y):
            preds = pnp.array([predict_prob(x, weights) for x in X])
            y_true = pnp.array(y)
            y_pred = pnp.clip(preds, 1e-7, 1 - 1e-7)
            return -pnp.mean(y_true * pnp.log(y_pred) + (1 - y_true) * pnp.log(1 - y_pred))
        
        def accuracy(weights, X, y):
            preds = np.array([float(predict_prob(x, weights)) for x in X])
            y_hat = (preds >= 0.5).astype(int)
            return (y_hat == np.array(y)).mean()
        
        # Initialize weights
        rng = np.random.default_rng(42)
        weights = pnp.array(
            rng.normal(0, 0.1, size=(N_LAYERS, N_QUBITS, 3)),
            requires_grad=True,
        )
        
        # Train
        opt = qml.AdamOptimizer(stepsize=0.05)
        
        print("\n=== Training QML Model on Combined Data ===")
        for epoch in range(40):
            weights = opt.step(lambda w: loss_fn(w, X_train, y_train), weights)
            
            if epoch % 5 == 0 or epoch == 39:
                train_loss = float(loss_fn(weights, X_train, y_train))
                train_acc = accuracy(weights, X_train, y_train)
                test_acc = accuracy(weights, X_test, y_test)
                print(f"epoch={epoch:02d} loss={train_loss:.4f} train_acc={train_acc:.3f} test_acc={test_acc:.3f}")
        
        final_test_acc = accuracy(weights, X_test, y_test)
        final_loss = float(loss_fn(weights, X_test, y_test))
        
        return np.array(weights), {
            "accuracy": final_test_acc,
            "loss": final_loss,
            "training_samples": len(X_train),
            "test_samples": len(X_test),
        }

    def should_retrain(self, ingestion_agent) -> bool:
        """Decide if model should be retrained"""
        # Strategy 1: Data-based (50 new records)
        if ingestion_agent.should_retrain():
            logging.info("Retraining triggered: Data threshold reached")
            return True
        
        # Strategy 2: Time-based (every 6 hours)
        if self.last_training_time is None:
            logging.info("Retraining triggered: First training")
            return True
        
        hours_since_training = (datetime.now() - self.last_training_time).total_seconds() / 3600
        if hours_since_training >= 6:
            logging.info(f"Retraining triggered: {hours_since_training:.1f} hours since last training")
            return True
        
        return False

    def retrain(self, ingestion_agent) -> bool:
        """Execute retraining pipeline"""
        try:
            logging.info("Starting continuous retraining...")
            
            # 1. Combine data
            combined_df = self.combine_historical_and_live()
            if combined_df.empty:
                logging.error("No data to train on")
                return False
            
            # 2. Prepare features
            X = combined_df[[
                "severity_score",
                "historical_area_risk",
                "report_density",
                "accessibility_risk",
            ]].values.astype(float)
            
            y = combined_df["risk_label_binary"].values.astype(float)
            
            # 3. Split data
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
            
            # 4. Train model
            weights, performance = self.train_qml_model(X_train, y_train, X_test, y_test)
            
            # 5. Save weights
            WEIGHTS_PATH.parent.mkdir(parents=True, exist_ok=True)
            np.save(WEIGHTS_PATH, weights)
            logging.info(f"Saved new weights to {WEIGHTS_PATH}")
            
            # 6. Update tracking
            self.model_performance = performance
            self.last_training_time = datetime.now()
            self.training_history.append({
                "timestamp": self.last_training_time.isoformat(),
                "performance": performance,
                "combined_samples": len(combined_df),
            })
            
            # 7. Reset ingestion counter
            ingestion_agent.reset_counter()
            
            logging.info(f"✅ Retraining complete! Accuracy: {performance['accuracy']:.3f}")
            return True
            
        except Exception as e:
            logging.error(f"Retraining failed: {e}")
            return False

    def get_status(self) -> dict:
        """Get training agent status"""
        return {
            "last_training_time": self.last_training_time.isoformat() if self.last_training_time else None,
            "model_performance": self.model_performance,
            "training_history_count": len(self.training_history),
            "weights_path": str(WEIGHTS_PATH),
            "weights_exists": WEIGHTS_PATH.exists(),
        }


def main():
    """Run the continuous training agent"""
    from backend.agents.live_data_ingestion_agent import LiveDataIngestionAgent
    
    print("=== Continuous Training Agent ===")
    
    # Initialize agents
    ingestion_agent = LiveDataIngestionAgent()
    training_agent = ContinuousTrainingAgent()
    
    # Ingest live data
    print("\n1. Ingesting live data...")
    ingestion_agent.ingest_all_sources()
    
    # Check if retraining needed
    print("\n2. Checking if retraining is needed...")
    if training_agent.should_retrain(ingestion_agent):
        print("3. Starting retraining...")
        success = training_agent.retrain(ingestion_agent)
        
        if success:
            print("\n✅ Retraining successful!")
            print(f"Status: {training_agent.get_status()}")
        else:
            print("\n❌ Retraining failed")
    else:
        print("No retraining needed yet")
        print(f"Status: {training_agent.get_status()}")


if __name__ == "__main__":
    main()
