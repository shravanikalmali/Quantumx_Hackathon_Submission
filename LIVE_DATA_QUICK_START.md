# Live Data & Continuous Training - Quick Start

## What Was Added

### 1. Live Data Ingestion Agent
**File**: `backend/agents/live_data_ingestion_agent.py`

Continuously fetches data from:
- Google News (Bangalore emergencies)
- Citizen Reports (via API)
- Traffic Alerts (real-time)

### 2. Continuous Training Agent
**File**: `backend/agents/continuous_training_agent.py`

Automatically:
- Monitors live data
- Decides when to retrain (50 new records OR 6 hours)
- Combines historical + live data
- Trains QML model
- Saves new weights

### 3. New API Endpoints
```
POST /live/ingest              # Trigger live data ingestion
POST /training/retrain         # Trigger model retraining
GET  /training/status          # Check training status
```

---

## Quick Test

### 1. Start Backend
```bash
python3 -m uvicorn backend.api.routes:app --port 8080 --reload
```

### 2. Ingest Live Data
```bash
curl -X POST http://localhost:8080/live/ingest
```

### 3. Check Status
```bash
curl http://localhost:8080/training/status
```

### 4. Trigger Retraining (if threshold met)
```bash
curl -X POST http://localhost:8080/training/retrain
```

---

## How It Works

```
Live Data Sources
    ↓
Ingestion Agent (collects 50+ records)
    ↓
Training Agent (detects threshold)
    ↓
Combine Historical + Live Data
    ↓
Train QML Model
    ↓
Save New Weights (qml_weights_live.npy)
    ↓
Production Model Uses Latest Weights
```

---

## Configuration

Edit these in `continuous_training_agent.py`:
```python
MIN_NEW_RECORDS_FOR_RETRAINING = 50  # Retrain when 50 new records
RETRAINING_INTERVAL_HOURS = 6        # Or every 6 hours
```

---

## Data Storage

Live data stored in JSONL format:
```
backend/data/live/
├── live_incidents.jsonl    # Citizen reports
├── live_news.jsonl         # News articles
└── live_traffic.jsonl      # Traffic alerts
```

---

## Model Weights

Latest weights automatically loaded:
```
backend/quantum/qml_weights_live.npy  # Latest (live-trained)
```

---

## Next Steps

1. ✅ Run `/live/ingest` to fetch live data
2. ✅ Check `/training/status` to see progress
3. ✅ When 50+ records collected, run `/training/retrain`
4. ✅ Model automatically updates with new patterns

**Your system now learns from live Bangalore data!**
