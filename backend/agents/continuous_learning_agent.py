"""
Continuous Learning Agent

Automatically retrains the QML model with new data from live monitoring.
The model gets better over time as more real-world incidents are collected.

Features:
- Collects training data from live incidents
- Triggers retraining when enough new data is collected
- Incremental learning - adds to existing training set
- Tracks model performance over time
- Automatic weight updates
"""

import logging
import json
import numpy as np
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict

logging.basicConfig(level=logging.INFO)

# Paths
LIVE_TRAINING_DATA = Path(__file__).parent.parent / "data" / "live_training_data.jsonl"
MODEL_WEIGHTS = Path(__file__).parent.parent / "quantum" / "qml_weights.npy"
TRAINING_LOG = Path(__file__).parent.parent / "data" / "training_log.json"

# Configuration
MIN_NEW_SAMPLES = 50  # Retrain after collecting 50 new samples
MAX_TRAINING_SAMPLES = 1000  # Keep last 1000 samples for training


class ContinuousLearningAgent:
    """
    Manages continuous learning for the QML model.
    """
    
    def __init__(self):
        self.training_buffer = []
        self.training_history = self._load_training_history()
        self.samples_since_last_training = 0
        
        # Create data directory if needed
        LIVE_TRAINING_DATA.parent.mkdir(parents=True, exist_ok=True)
    
    def _load_training_history(self) -> List[Dict]:
        """Load training history from log file."""
        if TRAINING_LOG.exists():
            try:
                with open(TRAINING_LOG, 'r') as f:
                    return json.load(f)
            except:
                return []
        return []
    
    def _save_training_history(self):
        """Save training history to log file."""
        try:
            with open(TRAINING_LOG, 'w') as f:
                json.dump(self.training_history, f, indent=2)
        except Exception as e:
            logging.error(f"Failed to save training history: {e}")
    
    def add_training_sample(self, incident: Dict, actual_outcome: Dict):
        """
        Add a new training sample from a real incident.
        
        Args:
            incident: The incident data with features
            actual_outcome: What actually happened (ground truth)
                {
                    "escalated": bool,
                    "severity_increased": bool,
                    "response_time_minutes": float,
                    "resources_needed": int
                }
        """
        try:
            # Extract features
            features = incident.get("features", {}).get("features", [])
            if not features or len(features) != 4:
                logging.warning("Invalid features, skipping sample")
                return
            
            # Create training sample
            sample = {
                "features": features,
                "feature_details": incident.get("features", {}).get("feature_details", {}),
                "actual_outcome": actual_outcome,
                "label": 1 if actual_outcome.get("escalated", False) else 0,
                "incident_type": incident.get("incident_type", "unknown"),
                "location": incident.get("location", {}).get("area", "Unknown"),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "qml_prediction": incident.get("qml_prediction", {}).get("qml_risk_score", 0.5)
            }
            
            # Add to buffer
            self.training_buffer.append(sample)
            self.samples_since_last_training += 1
            
            # Save to JSONL file
            with open(LIVE_TRAINING_DATA, 'a') as f:
                f.write(json.dumps(sample) + '\n')
            
            logging.info(f"Added training sample: {incident.get('incident_type')} in {sample['location']}")
            logging.info(f"Samples since last training: {self.samples_since_last_training}/{MIN_NEW_SAMPLES}")
            
            # Check if we should retrain
            if self.should_retrain():
                self.trigger_retraining()
        
        except Exception as e:
            logging.error(f"Failed to add training sample: {e}")
    
    def should_retrain(self) -> bool:
        """Check if we have enough new data to retrain."""
        return self.samples_since_last_training >= MIN_NEW_SAMPLES
    
    def trigger_retraining(self):
        """Trigger model retraining with new data."""
        try:
            logging.info("🔄 Starting continuous learning retraining...")
            
            # Load all training samples
            all_samples = self._load_all_samples()
            
            if len(all_samples) < 20:
                logging.warning("Not enough samples for retraining (need at least 20)")
                return
            
            # Keep only recent samples
            recent_samples = all_samples[-MAX_TRAINING_SAMPLES:]
            
            logging.info(f"Training on {len(recent_samples)} samples")
            
            # Prepare training data
            X = np.array([s["features"] for s in recent_samples])
            y = np.array([s["label"] for s in recent_samples])
            
            # Import training function
            from backend.scripts.train_qml_risk_model import train_model
            
            # Train model
            new_weights, accuracy = train_model(X, y, epochs=30)
            
            # Save new weights
            np.save(MODEL_WEIGHTS, new_weights)
            
            # Log training
            training_record = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "samples_used": len(recent_samples),
                "accuracy": float(accuracy),
                "new_samples_added": self.samples_since_last_training,
                "total_trainings": len(self.training_history) + 1
            }
            
            self.training_history.append(training_record)
            self._save_training_history()
            
            # Reset counter
            self.samples_since_last_training = 0
            
            logging.info(f"✅ Retraining complete! Accuracy: {accuracy:.3f}")
            logging.info(f"📊 Total trainings: {len(self.training_history)}")
            
        except Exception as e:
            logging.error(f"❌ Retraining failed: {e}")
    
    def _load_all_samples(self) -> List[Dict]:
        """Load all training samples from JSONL file."""
        samples = []
        if LIVE_TRAINING_DATA.exists():
            try:
                with open(LIVE_TRAINING_DATA, 'r') as f:
                    for line in f:
                        if line.strip():
                            samples.append(json.loads(line))
            except Exception as e:
                logging.error(f"Failed to load samples: {e}")
        return samples
    
    def get_status(self) -> Dict:
        """Get current learning status."""
        all_samples = self._load_all_samples()
        
        recent_accuracy = None
        if self.training_history:
            recent_accuracy = self.training_history[-1].get("accuracy")
        
        return {
            "total_samples_collected": len(all_samples),
            "samples_since_last_training": self.samples_since_last_training,
            "next_retraining_at": MIN_NEW_SAMPLES - self.samples_since_last_training,
            "total_retrainings": len(self.training_history),
            "recent_accuracy": recent_accuracy,
            "model_improving": self._is_improving(),
            "training_history": self.training_history[-5:]  # Last 5 trainings
        }
    
    def _is_improving(self) -> bool:
        """Check if model is improving over time."""
        if len(self.training_history) < 2:
            return None
        
        recent = self.training_history[-3:]
        accuracies = [t["accuracy"] for t in recent]
        
        # Check if generally trending upward
        return accuracies[-1] > accuracies[0]
    
    def simulate_outcome(self, incident: Dict, minutes_elapsed: int = 30) -> Dict:
        """
        Simulate what actually happened (for testing).
        In production, this would come from real follow-up data.
        
        Args:
            incident: The incident
            minutes_elapsed: How long to wait before checking outcome
        
        Returns:
            Actual outcome data
        """
        # In production, you would:
        # 1. Wait for the incident to resolve
        # 2. Check if it escalated
        # 3. Record actual severity, response time, etc.
        
        # For now, simulate based on QML prediction
        qml_score = incident.get("qml_prediction", {}).get("qml_risk_score", 0.5)
        severity = incident.get("severity", 0.5)
        
        # Simulate escalation (higher scores more likely to escalate)
        escalated = qml_score > 0.6 and severity > 0.7
        
        return {
            "escalated": escalated,
            "severity_increased": escalated,
            "response_time_minutes": 15 if qml_score > 0.7 else 30,
            "resources_needed": 3 if escalated else 1,
            "verified_at": datetime.now(timezone.utc).isoformat()
        }


# Global instance
_learning_agent = None

def get_learning_agent() -> ContinuousLearningAgent:
    """Get or create the global learning agent."""
    global _learning_agent
    if _learning_agent is None:
        _learning_agent = ContinuousLearningAgent()
    return _learning_agent


if __name__ == "__main__":
    # Test the agent
    agent = ContinuousLearningAgent()
    
    # Simulate adding samples
    for i in range(55):
        incident = {
            "features": {
                "features": [0.7, 0.6, 0.5, 0.4],
                "feature_details": {}
            },
            "incident_type": "fire",
            "location": {"area": "HSR Layout"},
            "severity": 0.7,
            "qml_prediction": {"qml_risk_score": 0.75}
        }
        
        outcome = agent.simulate_outcome(incident)
        agent.add_training_sample(incident, outcome)
    
    print(json.dumps(agent.get_status(), indent=2))
