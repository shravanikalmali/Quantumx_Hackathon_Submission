# Responder Locator - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Set Google Maps API Key

```bash
export GOOGLE_API_KEY="your_api_key_from_google_cloud_console"
```

### Step 2: Start Backend

```bash
cd /Users/3963829/Desktop/City-Samaachar-master
python3 -m uvicorn backend.api.routes:app --port 8080 --reload
```

### Step 3: Test API

```bash
# Get responders near Bengaluru
curl "http://localhost:8080/responders/nearby?lat=12.9716&lng=77.5946&radius_km=5"
```

### Step 4: Start Frontend

```bash
cd Frontend
npm install
npx expo start
```

### Step 5: Test in App

1. Open Expo app
2. Tap "Responders" tab (medical icon)
3. Grant location permission
4. See nearby responders!

---

## 📍 API Endpoints

### Get Nearby Responders
```
GET /responders/nearby?lat=12.9716&lng=77.5946&radius_km=5&responder_type=ambulance
```

### Get Responder Details
```
GET /responders/details/{place_id}
```

### Allocate to Incidents
```
POST /responders/allocate-from-maps
Body: {
  "user_lat": 12.9716,
  "user_lng": 77.5946,
  "radius_km": 5.0,
  "clusters": [...]
}
```

---

## 🎯 Features

- 📍 GPS-based location
- 🔍 Real-time responder search
- 🎯 Filter by type
- 📏 Adjustable radius
- ⏱️ ETA calculation
- ⭐ Google ratings
- 🚀 QAOA allocation

---

## 📁 New Files

```
backend/ingestion/responder_locator.py
Frontend/app/(tabs)/responders.jsx
Frontend/lib/components/ResponderCard.jsx
RESPONDER_LOCATOR_GUIDE.md
RESPONDER_IMPLEMENTATION_SUMMARY.md
```

---

## 🔧 Configuration

**Search Radius Options**: 2km, 5km, 10km, 15km  
**Filter Types**: ambulance, fire_truck, police, medical_team  
**Max Results**: 15 responders (configurable)

---

## ✅ Checklist

- [ ] Set GOOGLE_API_KEY
- [ ] Start backend on port 8080
- [ ] Test /responders/nearby endpoint
- [ ] Start frontend
- [ ] Test Responders tab
- [ ] Grant location permission
- [ ] See nearby responders
- [ ] Test filtering and radius adjustment

---

## 🆘 Troubleshooting

**No responders found?**
- Check GOOGLE_API_KEY is set
- Verify location coordinates are valid
- Increase search radius

**Location permission denied?**
- Check app permissions in settings
- Request permission again

**API errors?**
- Check backend is running on port 8080
- Verify GOOGLE_API_KEY is valid
- Check network connectivity

---

## 📚 Full Documentation

See `RESPONDER_LOCATOR_GUIDE.md` for complete details

---

**Ready to go!** 🚀
