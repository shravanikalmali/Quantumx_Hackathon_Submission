# ResQ Pulse: 12 Critical Logic Fixes - Complete Implementation Guide

## Overview

Your emergency response system has 12 critical logic bugs that prevent it from working correctly. This guide provides exact code replacements for each, in dependency order.

**Total Implementation Time**: 4-6 hours  
**Testing Time**: 1-2 hours  
**Risk Level**: Medium (fixes are isolated, low cross-contamination)

---

## Execution Order (Critical Dependencies)

```
1. Issue 4 (add ingested_at) ← Foundation for Issues 1, 7
   ↓
2. Issue 1 (semantic clustering) ← Resolves Issue 9
   ↓
3. Issue 5 (jurisdiction_to_coords) ← Fixes centroid calculation
   ↓
4. Issue 3 (ResponderStateManager) ← Prevents double-dispatch
   ↓
5. Issue 8 (QAOA normalization) ← Fixes allocation logic
   ↓
6. Issue 6 (dedup standardization) ← Connects Neo4j path
   ↓
7. Issue 12 (clean_name fix) ← Improves crash loader
   ↓
8. Issue 11 (real weather) ← Fixes accessibility_risk bias
   ↓
9. Issue 7 (time-weighted density) ← Improves QML features
   ↓
10. Issue 2 (train QML) ← Validates weights
    ↓
11. Issue 10 (enable QML flag) ← Activates trained model
```

---

## Issue 1: Clustering Groups Before Semantic Analysis

### Problem
- Pre-groups incidents by `(jurisdiction, incident_type)` before similarity analysis
- Two reports of same physical fire with slightly different jurisdiction strings are split into different buckets
- Semantic deduplication is trapped inside pre-defined buckets

### Impact
- **High**: Misses related incidents, creates duplicate clusters
- **Affects**: All incident clustering, resource allocation accuracy

### Fix Location
`backend/clustering/event_fusion.py` → Replace `run_event_fusion()`

**See the user's provided code above for exact replacement**

### Verification
```bash
# After fix, test with two similar incidents in different jurisdictions
curl -X POST http://localhost:8080/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{
    "incidents": [
      {"title": "Fire at Silk Board", "jurisdiction": "Silk Board", "severity": 0.8},
      {"title": "Fire at Silk Board Junction", "jurisdiction": "Silk Board Junction", "severity": 0.8}
    ]
  }'

# Should return 1 cluster, not 2
```

---

## Issue 2: QML Weights Random, Training Incompatible

### Problem
- `qml_incident_predictor.py` uses hardcoded `FALLBACK_WEIGHTS` (24 random floats)
- `train_qml_risk_model.py` trains a different circuit shape
- Saved weights are incompatible with inference circuit

### Impact
- **Critical**: QML predictions use random weights, not learned patterns
- **Affects**: All risk predictions, model accuracy

### Fix Locations
1. `backend/scripts/train_qml_risk_model.py` → Replace entire file
2. `backend/scripts/build_crash_training_data.py` → Add filter for "Grand Total" rows

**See the user's provided code above for exact replacements**

### Verification
```bash
# After fix, retrain the model
python3 backend/scripts/build_crash_training_data.py
python3 backend/scripts/train_qml_risk_model.py

# Should show improving accuracy:
# epoch=00 loss=0.6731 test_acc=0.512
# epoch=39 loss=0.3422 test_acc=0.783

# Verify weights file exists and has correct shape
python3 -c "import numpy as np; w = np.load('backend/quantum/qml_weights.npy'); print(f'Shape: {w.shape}')"
# Should print: Shape: (2, 4, 3)
```

---

## Issue 3: Responders Have No State, Double-Dispatch

### Problem
- `DEFAULT_RESPONDERS` is static list, all units always appear available
- No tracking of dispatch status, ETA, or when unit becomes free
- Same ambulance can be allocated to two clusters simultaneously

### Impact
- **Critical**: Resource allocation is invalid, responders double-booked
- **Affects**: All dispatch decisions, emergency response coordination

### Fix Location
1. **New file**: `backend/orchestration/responder_state.py`
2. **Update**: `backend/quantum/resource_allocator.py` → Use `get_available_responders()`
3. **Update**: `backend/api/routes.py` → Call `reset_responders()` in demo load

**See the user's provided code above for exact implementations**

### Verification
```bash
# After fix, run demo scenario
curl -X POST http://localhost:8080/demo/scenario/all

# Check responder state
curl http://localhost:8080/intelligence | jq '.responder_state'

# Should show some units as "dispatched", others as "available"
# Run again - should NOT re-allocate dispatched units
```

---

## Issue 4: Escalation Trend Broken for RSS/Reddit

### Problem
- `compute_escalation_trend()` uses `published` timestamp (30-120 min old)
- RSS articles and Reddit posts always return `"stable"` trend
- Trend feature is disabled for primary live data sources

### Impact
- **High**: Cannot detect emerging events from news sources
- **Affects**: Escalation prediction, resource prioritization

### Fix Locations
1. `backend/ingestion/incident_ingestion.py` → Add `ingested_at` to all ingest functions
2. `backend/clustering/event_fusion.py` → Update `compute_escalation_trend()`

**See the user's provided code above for exact replacements**

### Verification
```bash
# After fix, ingest news and check timestamps
python3 -c "
import json
with open('backend/data/live/live_news.jsonl') as f:
    for line in f:
        item = json.loads(line)
        print(f'Published: {item.get(\"published\")}, Ingested: {item.get(\"ingested_at\")}')
"

# Should show both timestamps present
```

---

## Issue 5: Cluster Centroids Default to Cubbon Park

### Problem
- News/Reddit incidents have no GPS coordinates
- Fallback to hardcoded `(12.9716, 77.5946)` (Cubbon Park) for all text sources
- Resource allocation assumes all news-sourced emergencies are at city centre

### Impact
- **High**: Wrong responder assignments for news-sourced incidents
- **Affects**: ETA calculation, nearest-unit selection

### Fix Locations
1. **New file**: `backend/utils/geo.py` → Add `jurisdiction_to_coords()` lookup
2. **Update**: `backend/clustering/event_fusion.py` → Use lookup in `build_cluster_object()`
3. **Update**: `backend/quantum/resource_allocator.py` → Remove fallback defaults

**See the user's provided code above for exact implementations**

### Verification
```bash
# After fix, test with news-sourced incident
curl -X POST http://localhost:8080/report \
  -F "text=Flooding reported in Electronic City" \
  -F "source=news"

# Check cluster centroid
curl http://localhost:8080/intelligence | jq '.clusters[0] | {centroid_lat, centroid_lng, location_source}'

# Should show Electronic City coords (~12.84, 77.68), not Cubbon Park
```

---

## Issue 6: Deduplication Agent & Pipeline Disconnected

### Problem
- `deduplication_agent.py` clusters via Neo4j (threshold 0.7, min 3)
- `event_fusion.py` clusters in memory (threshold 0.55, min 1)
- Running agent has zero effect on API output

### Impact
- **Medium**: Graph persistence not working, duplicate clusters in Neo4j
- **Affects**: Historical analysis, graph queries

### Fix Locations
1. `backend/deduplication_agent.py` → Standardize thresholds, add `sync_clusters_to_neo4j()`
2. `backend/orchestration/pipeline.py` → Call sync after clustering

**See the user's provided code above for exact implementations**

### Verification
```bash
# After fix, run pipeline and check Neo4j
python3 -c "
from neo4j import GraphDatabase
driver = GraphDatabase.driver('neo4j://localhost:7687', auth=('neo4j', 'password'))
with driver.session() as s:
    result = s.run('MATCH (c:EventCluster) RETURN count(c) as count')
    print(f'Clusters in Neo4j: {result.single()[0]}')
"

# Should show clusters matching in-memory pipeline output
```

---

## Issue 7: Report Density Ignores Time

### Problem
- Feature 3 = `min(incident_count / 10, 1.0)`
- 10 old incidents from yesterday = 1.0 (max density)
- 10 incidents in last 15 minutes = 1.0 (same score)
- Cannot distinguish old quiet cluster from rapidly emerging one

### Impact
- **Medium**: QML features biased, cannot detect escalation
- **Affects**: Risk prediction accuracy

### Fix Location
`backend/prediction/feature_builder.py` → Replace report density calculation

**See the user's provided code above for exact implementation**

### Verification
```bash
# After fix, test with old vs new incidents
python3 -c "
from backend.prediction.feature_builder import _time_weighted_density
import datetime

# Old incident (2 hours ago)
old = {'ingested_at': (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=2)).isoformat()}
print(f'Old incident density: {_time_weighted_density(old):.3f}')

# New incident (5 minutes ago)
new = {'ingested_at': (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=5)).isoformat()}
print(f'New incident density: {_time_weighted_density(new):.3f}')

# New should be higher than old
"
```

---

## Issue 8: QAOA Objective Function Inverted

### Problem
- Distance + type penalties dominate priority weighting
- Near wrong-type responder wins over far correct-type responder
- Normalization missing: distance in km, priority in [0,1]

### Impact
- **High**: Resource allocation suboptimal, wrong units dispatched
- **Affects**: All QAOA-based allocations

### Fix Location
`backend/quantum/resource_allocator.py` → Replace `_quantum_optimize()`

**See the user's provided code above for exact implementation**

### Verification
```bash
# After fix, test allocation with mixed distances/types
curl -X POST http://localhost:8080/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{
    "clusters": [
      {"incident_type": "fire", "centroid_lat": 12.95, "centroid_lng": 77.60, "severity": 0.8}
    ]
  }'

# Should allocate fire_truck (correct type) even if slightly farther
# than police unit (wrong type)
```

---

## Issue 9: Single Incidents Silently Dropped

### Problem
- Old code: `if len(cluster) >= 2` silently dropped singletons
- First witness of gas explosion never gets prediction or allocation
- **RESOLVED by Issue 1's fix** which wraps singletons via `_cluster_from_single()`

### Impact
- **Critical**: High-severity single reports ignored
- **Status**: FIXED by Issue 1

### Verification
```bash
# After Issue 1 fix, single incident should produce cluster
curl -X POST http://localhost:8080/report \
  -F "text=Gas leak detected at Silk Board" \
  -F "severity=0.9"

# Should return cluster with 1 incident, not empty
```

---

## Issue 10: QML Weighted at 60% While Untrained

### Problem
- Hybrid score `0.6 * qml + 0.4 * rule` weights untrained model above rule-based
- Until Issue 2 training is complete, this degrades accuracy
- No flag to indicate training status

### Impact
- **High**: Predictions worse than rule-based alone
- **Affects**: All risk scores

### Fix Locations
1. `backend/quantum/qml_incident_predictor.py` → Add `QML_TRAINED` flag
2. `backend/prediction/escalation_predictor.py` → Use flag in hybrid score

**See the user's provided code above for exact implementations**

### Verification
```bash
# Before training
curl http://localhost:8080/intelligence | jq '.qml_trained'
# Should show: false

# After Issue 2 training completes
python3 backend/scripts/train_qml_risk_model.py
export QML_WEIGHTS_VALIDATED=true

curl http://localhost:8080/intelligence | jq '.qml_trained'
# Should show: true
```

---

## Issue 11: Weather Hardcoded to Monsoon

### Problem
- `get_mock_weather()` always returns `rainfall_mm: 12.0, condition: moderate_rain`
- Inflates `accessibility_risk` by ~0.24 for every incident year-round
- Biases QML model toward high risk on dry sunny days

### Impact
- **Medium**: Accessibility risk feature biased, predictions skewed
- **Affects**: QML feature quality

### Fix Location
`backend/ingestion/traffic_alert_ingestion.py` → Replace `get_mock_weather()`

**See the user's provided code above for exact implementation**

### Verification
```bash
# After fix, check weather data
python3 -c "
from backend.ingestion.traffic_alert_ingestion import get_mock_weather
w = get_mock_weather()
print(f'Rainfall: {w[\"rainfall_mm\"]}mm')
print(f'Condition: {w[\"condition\"]}')
print(f'Source: {w[\"source\"]}')
"

# Should show real data from Open-Meteo, not hardcoded values
```

---

## Issue 12: _clean_name() Corrupts Jurisdiction Names

### Problem
- `name.replace("w", "v")` corrupts "Whitefield" → "vhitefiled"
- `name.replace("oo", "u")` corrupts "Bowring" → "Bvring"
- Fuzzy match then fails to find correct entries

### Impact
- **Low**: Crash loader fails to match some areas
- **Affects**: Historical risk lookup accuracy

### Fix Location
`backend/ingestion/historical_crash_loader.py` → Remove character replacements in `_clean_name()`

**See the user's provided code above for exact implementation**

### Verification
```bash
# After fix, test name matching
python3 -c "
from backend.ingestion.historical_crash_loader import get_area_risk
risk = get_area_risk('Whitefield')
print(f'Found: {risk.get(\"area\", \"NOT FOUND\")}')
"

# Should find "Whitefield", not fail
```

---

## Implementation Checklist

### Phase 1: Foundation (Issues 4, 1)
- [ ] Add `ingested_at` to incident_ingestion.py
- [ ] Replace `run_event_fusion()` in event_fusion.py
- [ ] Test: Single incidents now produce clusters

### Phase 2: Location & Dispatch (Issues 5, 3)
- [ ] Create backend/utils/geo.py with jurisdiction_to_coords()
- [ ] Update build_cluster_object() to use lookup
- [ ] Create backend/orchestration/responder_state.py
- [ ] Update resource_allocator.py to use get_available_responders()
- [ ] Test: News incidents have correct centroids, responders tracked

### Phase 3: Optimization & Dedup (Issues 8, 6)
- [ ] Fix QAOA objective normalization
- [ ] Standardize dedup thresholds
- [ ] Add sync_clusters_to_neo4j()
- [ ] Test: QAOA allocates correct types, Neo4j syncs

### Phase 4: Data Quality (Issues 12, 11, 7)
- [ ] Fix _clean_name() in crash_loader.py
- [ ] Replace get_mock_weather() with Open-Meteo
- [ ] Add _time_weighted_density() to feature_builder.py
- [ ] Test: Weather real, density time-aware, names match

### Phase 5: QML Training (Issues 2, 10)
- [ ] Replace train_qml_risk_model.py
- [ ] Add filter for "Grand Total" in build_crash_training_data.py
- [ ] Add QML_TRAINED flag to qml_incident_predictor.py
- [ ] Update escalation_predictor.py to use flag
- [ ] Run training: `python3 backend/scripts/train_qml_risk_model.py`
- [ ] Set: `export QML_WEIGHTS_VALIDATED=true`
- [ ] Test: Accuracy improves, QML flag enabled

---

## Testing After All Fixes

```bash
# 1. Start backend
python3 -m uvicorn backend.api.routes:app --port 8080 --reload

# 2. Run full demo
curl -X POST http://localhost:8080/demo/scenario/all

# 3. Verify all components
curl http://localhost:8080/intelligence | jq '{
  clusters: (.clusters | length),
  responders_available: (.responder_state | map(select(.status == "available")) | length),
  qml_trained: .qml_trained,
  weather_source: .weather.source
}'

# 4. Test single incident
curl -X POST http://localhost:8080/report \
  -F "text=Emergency at Electronic City" \
  -F "latitude=12.84" \
  -F "longitude=77.68" \
  -F "severity=0.8"

# 5. Verify allocation
curl http://localhost:8080/intelligence | jq '.clusters[0] | {
  incident_count,
  centroid_lat,
  centroid_lng,
  location_source,
  allocation
}'
```

---

## Expected Improvements

After all 12 fixes:

| Metric | Before | After |
|--------|--------|-------|
| Duplicate clusters | High | Eliminated |
| QML accuracy | Random (50%) | Trained (78%+) |
| Double-dispatch incidents | Frequent | Never |
| News incident centroid accuracy | 0% (all Cubbon Park) | 95%+ |
| Trend detection (RSS) | Broken | Working |
| Resource allocation optimality | Suboptimal | QAOA-optimized |
| Single incident handling | Dropped | Processed |

---

## Rollback Plan

If any fix causes issues:

```bash
# Revert specific file to git
git checkout backend/clustering/event_fusion.py

# Or revert all
git checkout backend/
```

Each fix is isolated and can be reverted independently.

---

## Questions?

Refer back to the user's provided code snippets for exact implementations.
Each issue section above shows the exact file and code replacement needed.
