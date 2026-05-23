# Remaining 3 Critical Fixes Summary

## ✅ Completed (9/12):
1. Issue 4: ingested_at timestamps ✓
2. Issue 11: Real weather API ✓
3. Issue 7: Time-weighted density ✓
4. Issue 3: ResponderStateManager ✓
5. Issue 5: Jurisdiction geo lookup ✓
6. Issue 1: Semantic-first clustering ✓
7. Issue 1b: Escalation trend uses ingested_at ✓
8. Issue 1c: Singletons now processed ✓
9. Issue 1d: Centroid from jurisdiction lookup ✓

## ⏳ Remaining 3 Fixes (Quick Implementation):

### Issue 2: Fix QML Training Script
**File**: `backend/scripts/train_qml_risk_model.py`
**Status**: Provided in LOGIC_FIXES_GUIDE.md - Replace entire file with exact code from guide
**Action**: Copy the training script from LOGIC_FIXES_GUIDE.md section "Issue 2"

### Issue 8: Fix QAOA Objective Normalization
**File**: `backend/quantum/resource_allocator.py`
**Status**: Provided in LOGIC_FIXES_GUIDE.md - Replace `_quantum_optimize()` function
**Action**: Copy the QAOA function from LOGIC_FIXES_GUIDE.md section "Issue 8"

### Issue 10: Add QML_TRAINED Flag
**Files**: 
- `backend/quantum/qml_incident_predictor.py` - Add QML_TRAINED flag
- `backend/prediction/escalation_predictor.py` - Use flag in hybrid score
**Status**: Provided in LOGIC_FIXES_GUIDE.md - Add flag logic
**Action**: Copy the flag implementation from LOGIC_FIXES_GUIDE.md section "Issue 10"

## Quick Next Steps:

1. **For Issue 2**: Run training after implementing:
   ```bash
   python3 backend/scripts/build_crash_training_data.py
   python3 backend/scripts/train_qml_risk_model.py
   ```

2. **For Issue 8**: No additional steps needed after code replacement

3. **For Issue 10**: After training completes:
   ```bash
   export QML_WEIGHTS_VALIDATED=true
   ```

## Testing All Fixes:

```bash
# Start backend
python3 -m uvicorn backend.api.routes:app --port 8080 --reload

# Test live data ingestion
curl -X POST http://localhost:8080/live/ingest

# Test predictions
curl -X POST http://localhost:8080/report \
  -F "text=Emergency at Electronic City" \
  -F "latitude=12.84" \
  -F "longitude=77.68" \
  -F "severity=0.8"

# Check intelligence
curl http://localhost:8080/intelligence | jq '.clusters[0] | {location_source, centroid_lat, centroid_lng}'
```

## Summary:

**9 of 12 fixes implemented and working:**
- ✅ Real weather data (no more hardcoded monsoon)
- ✅ Responders tracked (no double-dispatch)
- ✅ News incidents map correctly (no Cubbon Park default)
- ✅ Trends detected from ingestion time
- ✅ Recent incidents weighted higher
- ✅ Singletons processed
- ✅ Centroids from jurisdiction lookup

**3 remaining fixes are straightforward code replacements from LOGIC_FIXES_GUIDE.md**
