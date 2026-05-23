# Continuous Training Workflow

## Complete System Flow

### Phase 1: Live Data Ingestion (Continuous)
```
Every 5-10 minutes:

┌─────────────────────────────────────────────────────────┐
│ LIVE DATA INGESTION AGENT                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Fetch Google News                                  │
│     └─ Search: "bangalore emergency"                   │
│     └─ Store in: live_news.jsonl                       │
│                                                         │
│  2. Fetch Citizen Reports                              │
│     └─ Query: POST /report endpoint                    │
│     └─ Store in: live_incidents.jsonl                  │
│                                                         │
│  3. Fetch Traffic Alerts                               │
│     └─ Query: Real-time traffic API                    │
│     └─ Store in: live_traffic.jsonl                    │
│                                                         │
│  4. Count New Records                                  │
│     └─ Total: X new records                            │
│     └─ Cumulative: Y records since last training       │
│                                                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │ Y >= 50 records?   │
        │ OR 6 hours passed? │
        └────────┬───────────┘
                 │
          ┌──────┴──────┐
          │             │
         NO             YES
          │              │
          │              ▼
          │    ┌─────────────────────────────────────┐
          │    │ TRIGGER RETRAINING                  │
          │    └─────────────────────────────────────┘
          │
          └──────────────┬──────────────────────────┘
                         │
                         ▼
```

### Phase 2: Model Retraining (When Triggered)
```
┌─────────────────────────────────────────────────────────┐
│ CONTINUOUS TRAINING AGENT                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  STEP 1: Load Historical Data                          │
│  ├─ File: qml_training_with_newdata.csv                │
│  ├─ Records: 3,450 examples                            │
│  └─ Features: [severity, hist_risk, density, access]   │
│                                                         │
│  STEP 2: Load Live Data                                │
│  ├─ Files: live_incidents.jsonl, live_news.jsonl, etc. │
│  ├─ Records: 50+ new examples                          │
│  └─ Convert to training format                         │
│                                                         │
│  STEP 3: Combine Datasets                              │
│  ├─ Historical: 3,450 records                          │
│  ├─ Live: 50+ records                                  │
│  ├─ Total: 3,500+ records                              │
│  └─ Save: qml_training_combined.csv                    │
│                                                         │
│  STEP 4: Prepare Training Data                         │
│  ├─ Extract features: X = [sev, hist, dens, access]    │
│  ├─ Extract labels: y = [0 or 1]                       │
│  ├─ Shuffle: random permutation                        │
│  ├─ Split: 80% train, 20% test                         │
│  └─ Subset: Use 300 samples for training               │
│                                                         │
│  STEP 5: Train QML Model                               │
│  ├─ Circuit: 4-qubit, 2-layer VQC                      │
│  ├─ Optimizer: Adam (stepsize=0.05)                    │
│  ├─ Epochs: 40                                         │
│  ├─ Loss: Binary cross-entropy                         │
│  └─ Metrics: Accuracy, loss                            │
│                                                         │
│  STEP 6: Evaluate Model                                │
│  ├─ Train Accuracy: ~83%                               │
│  ├─ Test Accuracy: ~78%                                │
│  ├─ Loss: ~0.34                                        │
│  └─ Confidence: High                                   │
│                                                         │
│  STEP 7: Save New Weights                              │
│  ├─ File: qml_weights_live.npy                         │
│  ├─ Shape: (2, 4, 3) - 2 layers, 4 qubits, 3 params   │
│  └─ Status: Ready for production                       │
│                                                         │
│  STEP 8: Reset Counters                                │
│  ├─ New records count: 0                               │
│  ├─ Last training time: now                            │
│  └─ Ready for next cycle                               │
│                                                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
```

### Phase 3: Production Deployment
```
┌─────────────────────────────────────────────────────────┐
│ PRODUCTION MODEL LOADING                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Weight Priority (in order):                           │
│  1. qml_weights_live.npy        ← Latest (live-trained)│
│  2. qml_weights_newdata.npy     ← Enhanced (rainfall)  │
│  3. qml_weights.npy             ← Original (OpenCity)  │
│  4. DEFAULT_WEIGHTS             ← Fallback demo        │
│                                                         │
│  Status: "trained_with_live_data"                      │
│  Data Source: "OpenCity + Rainfall + Live Data"        │
│  Last Updated: [timestamp]                             │
│                                                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
        ┌────────────────────────┐
        │ LIVE PREDICTIONS       │
        │ Using Latest Model     │
        └────────────────────────┘
```

---

## API Workflow

### Workflow 1: Check Status
```bash
# Check if retraining is needed
curl http://localhost:8080/training/status

# Response:
{
  "ingestion_status": {
    "new_records_since_last_training": 35,
    "should_retrain": false,
    "min_records_for_retraining": 50
  },
  "training_status": {
    "last_training_time": "2026-05-23T11:00:00",
    "model_performance": {
      "accuracy": 0.833,
      "loss": 0.3422
    }
  }
}
```

### Workflow 2: Ingest Live Data
```bash
# Fetch live data from all sources
curl -X POST http://localhost:8080/live/ingest

# Response:
{
  "status": "success",
  "new_records": 15,
  "summary": {
    "new_records_since_last_training": 50,
    "should_retrain": true  ← THRESHOLD REACHED!
  }
}
```

### Workflow 3: Trigger Retraining
```bash
# Retrain model with new data
curl -X POST http://localhost:8080/training/retrain

# Response:
{
  "status": "success",
  "message": "Model retrained successfully",
  "performance": {
    "accuracy": 0.847,  ← IMPROVED!
    "loss": 0.3156,
    "training_samples": 3500
  },
  "training_status": {
    "last_training_time": "2026-05-23T11:15:00",
    "weights_path": "backend/quantum/qml_weights_live.npy"
  }
}
```

### Workflow 4: Use Latest Model
```bash
# Make predictions with latest trained model
curl -X POST http://localhost:8080/report \
  -F "text=Flood in Silk Board" \
  -F "latitude=12.9177" \
  -F "longitude=77.6238"

# Response includes:
{
  "qml_prediction": {
    "training_status": "trained_with_live_data",
    "qml_risk_score": 0.85,  ← Using latest weights!
    "qml_risk_label": "high_risk"
  }
}
```

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│ LIVE DATA SOURCES                                            │
│ ├─ Google News (Bangalore)                                  │
│ ├─ Citizen Reports (API)                                    │
│ └─ Traffic Alerts (Real-time)                               │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │ JSONL STORAGE      │
        │ (backend/data/live)│
        └────────┬───────────┘
                 │
                 ▼
    ┌────────────────────────────┐
    │ INGESTION AGENT            │
    │ Counts: 50+ new records?   │
    └────────┬───────────────────┘
             │
             ▼
    ┌────────────────────────────┐
    │ TRAINING AGENT             │
    │ Combines historical + live │
    │ Trains QML model           │
    │ Saves new weights          │
    └────────┬───────────────────┘
             │
             ▼
    ┌────────────────────────────┐
    │ NEW WEIGHTS                │
    │ qml_weights_live.npy       │
    └────────┬───────────────────┘
             │
             ▼
    ┌────────────────────────────┐
    │ PRODUCTION PREDICTIONS     │
    │ Using latest trained model │
    └────────────────────────────┘
```

---

## Retraining Decision Logic

```python
def should_retrain(ingestion_agent, training_agent):
    """Decide if model should be retrained"""
    
    # Strategy 1: Data-Based (Primary)
    if ingestion_agent.new_records_count >= 50:
        return True, "Data threshold reached"
    
    # Strategy 2: Time-Based (Fallback)
    if training_agent.last_training_time is None:
        return True, "First training"
    
    hours_since = (now - training_agent.last_training_time).hours
    if hours_since >= 6:
        return True, f"Time threshold: {hours_since} hours"
    
    # Strategy 3: Performance-Based (Future)
    if training_agent.model_performance['accuracy'] < 0.75:
        return True, "Accuracy dropped below threshold"
    
    return False, "No retraining needed"
```

---

## Example Timeline

```
TIME          EVENT                           ACTION
────────────────────────────────────────────────────────
11:00 AM      Initial training complete      Weights saved
              new_records = 0

11:05 AM      Ingest live data               +5 records
              new_records = 5

11:10 AM      Ingest live data               +8 records
              new_records = 13

11:15 AM      Ingest live data               +12 records
              new_records = 25

11:20 AM      Ingest live data               +15 records
              new_records = 40

11:25 AM      Ingest live data               +10 records
              new_records = 50 ✓ THRESHOLD!

11:26 AM      Trigger retraining             Start training
              Combine: 3,450 + 50 = 3,500

11:30 AM      Training complete              New weights saved
              Accuracy: 84.7% (improved!)
              new_records = 0 (reset)

11:35 AM      Ingest live data               +3 records
              new_records = 3

... (cycle repeats)
```

---

## Key Features

✅ **Autonomous**: Agents decide when to retrain  
✅ **Continuous**: Always ingesting new data  
✅ **Intelligent**: Multiple retraining strategies  
✅ **Adaptive**: Model improves over time  
✅ **Traceable**: Full training history  
✅ **Scalable**: Can handle 1000s of records  
✅ **Robust**: Fallback weights if training fails  

---

## Next Steps

1. **Start ingestion**: `POST /live/ingest`
2. **Monitor progress**: `GET /training/status`
3. **Trigger retraining**: `POST /training/retrain` (when threshold met)
4. **Verify improvement**: Check accuracy in response
5. **Use latest model**: Predictions automatically use new weights

**Your emergency system now learns from live Bangalore data!**
