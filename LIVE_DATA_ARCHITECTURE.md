# Live Data & Continuous Training Architecture

## Overview

Your system now has **autonomous agents** that:
1. **Continuously ingest live data** from multiple sources
2. **Decide when to retrain** the QML model
3. **Automatically retrain** with combined historical + live data
4. **Update production model** with new weights

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  LIVE DATA SOURCES                                          │
├─────────────────────────────────────────────────────────────┤
│  ├─ Google News (Bangalore emergencies)                     │
│  ├─ Citizen Reports (via /report API)                       │
│  └─ Traffic Alerts (real-time)                              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  LIVE DATA INGESTION AGENT                                  │
│  (backend/agents/live_data_ingestion_agent.py)              │
├─────────────────────────────────────────────────────────────┤
│  • Fetches data from all sources                            │
│  • Stores in JSONL format (backend/data/live/)              │
│  • Counts new records                                       │
│  • Signals when threshold reached (50 records)              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
         ┌───────────────┐
         │ 50+ NEW       │
         │ RECORDS?      │
         └───────┬───────┘
                 │
          ┌──────┴──────┐
          │             │
         NO             YES
          │              │
          │              ▼
          │    ┌─────────────────────────────────────────┐
          │    │ CONTINUOUS TRAINING AGENT               │
          │    │ (backend/agents/continuous_training_agent.py)
          │    ├─────────────────────────────────────────┤
          │    │ 1. Load historical data                 │
          │    │ 2. Load live data                       │
          │    │ 3. Convert live → training format       │
          │    │ 4. Combine datasets                     │
          │    │ 5. Train QML model                      │
          │    │ 6. Save new weights                     │
          │    │ 7. Update production model              │
          │    └─────────────────────────────────────────┘
          │              │
          │              ▼
          │    ┌─────────────────────────────────────────┐
          │    │ NEW TRAINED WEIGHTS                     │
          │    │ (backend/quantum/qml_weights_live.npy)  │
          │    └─────────────────────────────────────────┘
          │
          └──────────────┬──────────────────────────────┘
                         │
                         ▼
          ┌──────────────────────────────────────┐
          │ PRODUCTION PREDICTIONS               │
          │ Using latest trained model           │
          └──────────────────────────────────────┘
```

---

## Components

### 1. Live Data Ingestion Agent
**File**: `backend/agents/live_data_ingestion_agent.py`

**Responsibilities**:
- Fetch live data from multiple sources
- Store data in JSONL format
- Track count of new records
- Signal when retraining threshold is reached

**Data Sources**:
```python
{
    "google_news": "https://news.google.com/rss/search?q=bangalore+emergency",
    "citizen_reports": "POST /report endpoint",
    "traffic_alerts": "Real-time traffic data"
}
```

**Storage**:
```
backend/data/live/
├── live_incidents.jsonl    # Citizen reports
├── live_news.jsonl         # News articles
└── live_traffic.jsonl      # Traffic alerts
```

**Configuration**:
```python
MIN_NEW_RECORDS_FOR_RETRAINING = 50  # Retrain when 50 new records arrive
LIVE_DATA_RETENTION_DAYS = 7         # Keep 7 days of live data
```

### 2. Continuous Training Agent
**File**: `backend/agents/continuous_training_agent.py`

**Responsibilities**:
- Monitor live data ingestion
- Decide when to retrain (data-based, time-based, performance-based)
- Combine historical + live data
- Train QML model
- Save new weights
- Track training history

**Retraining Strategies**:

#### Strategy 1: Data-Based (Primary)
```python
if new_records >= 50:
    retrain()
```

#### Strategy 2: Time-Based (Fallback)
```python
if hours_since_last_training >= 6:
    retrain()
```

#### Strategy 3: Performance-Based (Future)
```python
if model_accuracy < threshold:
    retrain()
```

**Training Pipeline**:
```
1. Load historical data (3,450 examples)
   ↓
2. Load live data (JSONL files)
   ↓
3. Convert live data to training format
   ↓
4. Combine: historical + live
   ↓
5. Train QML on combined dataset
   ↓
6. Evaluate on test set
   ↓
7. Save weights to qml_weights_live.npy
   ↓
8. Reset ingestion counter
```

---

## API Endpoints

### 1. Ingest Live Data
```bash
POST /live/ingest
```

**Response**:
```json
{
  "status": "success",
  "new_records": 15,
  "summary": {
    "new_records_since_last_training": 15,
    "min_records_for_retraining": 50,
    "should_retrain": false,
    "last_training_time": "2026-05-23T11:00:00",
    "live_data_files": {
      "incidents": "backend/data/live/live_incidents.jsonl",
      "news": "backend/data/live/live_news.jsonl",
      "traffic": "backend/data/live/live_traffic.jsonl"
    }
  },
  "message": "Ingested 15 new records. Retraining needed: false"
}
```

### 2. Trigger Retraining
```bash
POST /training/retrain
```

**Response (if threshold met)**:
```json
{
  "status": "success",
  "message": "Model retrained successfully",
  "performance": {
    "accuracy": 0.833,
    "loss": 0.3422,
    "training_samples": 240,
    "test_samples": 60
  },
  "training_status": {
    "last_training_time": "2026-05-23T11:15:00",
    "model_performance": {
      "accuracy": 0.833,
      "loss": 0.3422,
      "training_samples": 240
    },
    "training_history_count": 2,
    "weights_path": "backend/quantum/qml_weights_live.npy",
    "weights_exists": true
  }
}
```

**Response (if threshold not met)**:
```json
{
  "status": "skipped",
  "reason": "Retraining threshold not met",
  "summary": {
    "new_records_since_last_training": 15,
    "min_records_for_retraining": 50,
    "should_retrain": false
  }
}
```

### 3. Get Training Status
```bash
GET /training/status
```

**Response**:
```json
{
  "ingestion_status": {
    "new_records_since_last_training": 35,
    "min_records_for_retraining": 50,
    "should_retrain": false,
    "last_training_time": "2026-05-23T11:00:00",
    "live_data_files": {...}
  },
  "training_status": {
    "last_training_time": "2026-05-23T11:00:00",
    "model_performance": {...},
    "training_history_count": 1,
    "weights_path": "backend/quantum/qml_weights_live.npy",
    "weights_exists": true
  },
  "next_retraining_needed": false
}
```

---

## Usage Examples

### Example 1: Continuous Ingestion Loop
```python
from backend.agents.live_data_ingestion_agent import LiveDataIngestionAgent

agent = LiveDataIngestionAgent()

# Run every 5 minutes
while True:
    new_count = agent.ingest_all_sources()
    summary = agent.get_live_data_summary()
    
    print(f"Ingested {new_count} new records")
    print(f"Retraining needed: {summary['should_retrain']}")
    
    time.sleep(300)  # 5 minutes
```

### Example 2: Automatic Retraining
```python
from backend.agents.continuous_training_agent import ContinuousTrainingAgent
from backend.agents.live_data_ingestion_agent import LiveDataIngestionAgent

ingestion_agent = LiveDataIngestionAgent()
training_agent = ContinuousTrainingAgent()

# Ingest data
ingestion_agent.ingest_all_sources()

# Check and retrain if needed
if training_agent.should_retrain(ingestion_agent):
    success = training_agent.retrain(ingestion_agent)
    if success:
        print("✅ Model retrained successfully!")
        print(f"New accuracy: {training_agent.model_performance['accuracy']:.3f}")
```

### Example 3: API-Based Workflow
```bash
# 1. Ingest live data
curl -X POST http://localhost:8080/live/ingest

# 2. Check status
curl http://localhost:8080/training/status

# 3. Trigger retraining (if threshold met)
curl -X POST http://localhost:8080/training/retrain

# 4. Verify new model is loaded
curl http://localhost:8080/intelligence
```

---

## Data Flow

### Live Data Format (JSONL)
```json
{"source": "google_news", "title": "Flood in Silk Board", "severity": 0.8, "ingested_at": "2026-05-23T11:00:00"}
{"source": "citizen_report", "type": "road_accident", "location": "Old Airport Road", "severity": 0.7, "ingested_at": "2026-05-23T11:05:00"}
{"source": "traffic_alert", "location": "Silk Board", "severity": 0.6, "ingested_at": "2026-05-23T11:10:00"}
```

### Training Data Format (CSV)
```csv
area,severity_score,historical_area_risk,report_density,accessibility_risk,risk_score,risk_label_binary,source,timestamp
Silk Board,0.8,0.69,0.1,0.74,0.71,1,live_data,2026-05-23T11:00:00
Old Airport Road,0.7,0.65,0.1,0.3,0.58,1,live_data,2026-05-23T11:05:00
```

---

## Model Weight Management

### Weight Files
```
backend/quantum/
├── qml_weights.npy              # Original trained weights
├── qml_weights_newdata.npy      # Enhanced with rainfall data
└── qml_weights_live.npy         # Latest with live data
```

### Weight Loading Priority
```python
if WEIGHTS_LIVE.exists():
    weights = WEIGHTS_LIVE  # Latest live-trained
elif WEIGHTS_NEWDATA.exists():
    weights = WEIGHTS_NEWDATA  # Enhanced with rainfall
elif WEIGHTS_ORIGINAL.exists():
    weights = WEIGHTS_ORIGINAL  # Original
else:
    weights = DEFAULT_WEIGHTS  # Fallback
```

---

## Monitoring & Alerts

### Key Metrics to Track
```python
{
    "new_records_per_hour": 12,
    "time_since_last_training": "2.5 hours",
    "model_accuracy": 0.833,
    "training_samples": 3450,
    "live_data_size_mb": 2.3,
    "next_retraining_in": "35 records"
}
```

### Retraining Triggers
- ✅ **Data-based**: 50 new records
- ✅ **Time-based**: Every 6 hours
- ✅ **Performance-based**: If accuracy drops (future)

---

## Future Enhancements

1. **Distributed Training**: Train on multiple GPUs/QPUs
2. **A/B Testing**: Compare old vs new model before deployment
3. **Rollback**: Automatic rollback if accuracy drops
4. **Incremental Learning**: Update weights without full retraining
5. **Active Learning**: Prioritize uncertain predictions for labeling
6. **Federated Learning**: Train on decentralized data

---

## Summary

Your system now has **intelligent agents** that:
- 🔄 **Continuously ingest** live data from Bangalore
- 🤖 **Automatically decide** when to retrain
- 📊 **Combine** historical + live data
- ⚡ **Retrain** the QML model with new patterns
- 🎯 **Update** production model automatically

**This enables your emergency system to learn and improve over time!**
