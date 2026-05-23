# Responder Locator - Google Maps Integration Guide

## Overview

The Responder Locator system fetches real emergency responders from **Google Maps Places API** based on the user's location, replacing the hardcoded responder pool with dynamic, real-world responder data.

---

## Architecture

```
User Location (GPS)
        ↓
Frontend: Get User Location (expo-location)
        ↓
API: GET /responders/nearby
        ↓
Backend: Google Maps Places API
        ↓
Fetch: Hospitals, Fire Stations, Police, Emergency Centers
        ↓
Filter & Sort by Distance
        ↓
Return Responders with ETA
        ↓
Frontend: Display Responders on Map
        ↓
Allocate to Incidents (QAOA)
```

---

## Backend Implementation

### 1. Responder Locator Module

**File**: `backend/ingestion/responder_locator.py`

**Key Functions**:

#### `get_nearby_responders(user_lat, user_lng, radius_meters=5000, max_results=15)`
Fetches nearby responders from Google Maps Places API.

```python
responders = get_nearby_responders(
    user_lat=12.9716,
    user_lng=77.5946,
    radius_meters=5000,  # 5km
    max_results=15
)
```

**Returns**:
```json
[
  {
    "id": "hospital_ChIJ...",
    "type": "ambulance",
    "lat": 12.9716,
    "lng": 77.5946,
    "name": "Apollo Hospital",
    "address": "Bangalore, India",
    "distance_km": 2.45,
    "source": "google_maps",
    "place_id": "ChIJ...",
    "rating": 4.5,
    "open_now": true
  }
]
```

#### `get_responder_details(place_id)`
Get detailed information about a specific responder location.

```python
details = get_responder_details("ChIJ...")
```

#### `filter_responders_by_type(responders, responder_type)`
Filter responders by type.

```python
ambulances = filter_responders_by_type(responders, "ambulance")
```

#### `get_closest_responders(responders, count=3)`
Get the N closest responders.

```python
closest_3 = get_closest_responders(responders, count=3)
```

---

## API Endpoints

### 1. GET /responders/nearby

**Get nearby responders based on user location**

**Query Parameters**:
- `lat` (required): User latitude
- `lng` (required): User longitude
- `radius_km` (optional, default=5.0): Search radius in kilometers
- `responder_type` (optional): Filter by type (ambulance, fire_truck, police, medical_team)
- `max_results` (optional, default=15): Maximum responders to return

**Example Request**:
```bash
curl "http://localhost:8080/responders/nearby?lat=12.9716&lng=77.5946&radius_km=5&responder_type=ambulance&max_results=10"
```

**Response**:
```json
{
  "status": "success",
  "count": 5,
  "user_location": {
    "latitude": 12.9716,
    "longitude": 77.5946
  },
  "search_radius_km": 5.0,
  "responders": [
    {
      "id": "hospital_ChIJ...",
      "type": "ambulance",
      "lat": 12.9716,
      "lng": 77.5946,
      "name": "Apollo Hospital",
      "address": "Bangalore, India",
      "distance_km": 2.45,
      "source": "google_maps",
      "place_id": "ChIJ...",
      "rating": 4.5,
      "open_now": true
    }
  ],
  "source": "google_maps",
  "timestamp": "2026-05-23T13:07:00Z"
}
```

---

### 2. GET /responders/details/{place_id}

**Get detailed information about a responder**

**Path Parameters**:
- `place_id`: Google Places place_id

**Example Request**:
```bash
curl "http://localhost:8080/responders/details/ChIJ..."
```

**Response**:
```json
{
  "status": "success",
  "details": {
    "name": "Apollo Hospital",
    "formatted_address": "123 Main St, Bangalore, India",
    "geometry": {
      "location": {
        "lat": 12.9716,
        "lng": 77.5946
      }
    },
    "opening_hours": {
      "open_now": true
    },
    "phone_number": "+91-80-40615000",
    "website": "https://www.apollohospitals.com",
    "rating": 4.5,
    "reviews": [...]
  },
  "timestamp": "2026-05-23T13:07:00Z"
}
```

---

### 3. POST /responders/allocate-from-maps

**Allocate responders from Google Maps to incident clusters**

**Request Body**:
```json
{
  "user_lat": 12.9716,
  "user_lng": 77.5946,
  "radius_km": 5.0,
  "clusters": [
    {
      "cluster_id": "flood_1",
      "incident_type": "flood",
      "centroid_lat": 12.9127,
      "centroid_lng": 77.6228,
      "cluster_severity": 0.88,
      "escalation_probability": 0.76,
      "incident_count": 8
    }
  ]
}
```

**Response**:
```json
{
  "status": "success",
  "user_location": {
    "latitude": 12.9716,
    "longitude": 77.5946
  },
  "responders_found": 12,
  "responders_allocated": 3,
  "allocations": [
    {
      "allocation_id": "uuid",
      "responder_id": "hospital_ChIJ...",
      "responder_type": "ambulance",
      "assigned_cluster": "flood_1",
      "cluster_incident_type": "flood",
      "distance_km": 2.45,
      "eta_minutes": 3.0,
      "priority_score": 0.75,
      "optimization_method": "QAOA"
    }
  ],
  "optimization_method": "QAOA",
  "timestamp": "2026-05-23T13:07:00Z"
}
```

---

## Frontend Implementation

### 1. Responders Screen

**File**: `Frontend/app/(tabs)/responders.jsx`

**Features**:
- 📍 Get user's current location (GPS)
- 🔍 Search for nearby responders
- 🎯 Filter by responder type
- 📏 Adjust search radius
- 🔄 Real-time refresh
- ⏱️ Calculate ETA to each responder

**Usage**:
```javascript
import RespondersScreen from "./responders";

// Automatically fetches responders when screen loads
// User can adjust radius and filter by type
```

### 2. Responder Card Component

**File**: `Frontend/lib/components/ResponderCard.jsx`

**Props**:
- `responder`: Responder object from API
- `onPress`: Callback when card is tapped

**Features**:
- Display responder name and address
- Show distance and rating
- Calculate and display ETA
- Color-coded by responder type

---

## Google Maps API Setup

### 1. Get API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable **Places API** and **Maps SDK**
4. Create an API key (Credentials → Create Credentials → API Key)
5. Restrict the key to your app

### 2. Set Environment Variable

```bash
export GOOGLE_API_KEY="your_api_key_here"
```

Or add to `.env` file:
```
GOOGLE_API_KEY=your_api_key_here
```

### 3. Required Scopes

The API key needs access to:
- **Places API** (Nearby Search)
- **Places API** (Place Details)

---

## Responder Type Mapping

| Google Places Type | Responder Type | Speed | Capacity |
|-------------------|----------------|-------|----------|
| hospital | ambulance | 50 km/h | 4 |
| fire_station | fire_truck | 40 km/h | 6 |
| police | police | 55 km/h | 3 |
| emergency_room | medical_team | 45 km/h | 10 |

---

## Data Flow

### 1. User Opens Responders Screen

```
RespondersScreen
  ↓
requestLocationPermission()
  ↓
Location.getCurrentPositionAsync()
  ↓
setUserLocation({lat, lng})
  ↓
fetchNearbyResponders(lat, lng, radius, filter)
```

### 2. Fetch Responders

```
Frontend: GET /responders/nearby?lat=...&lng=...
  ↓
Backend: get_nearby_responders()
  ↓
Google Maps Places API
  ↓
Search hospitals, fire stations, police, emergency centers
  ↓
Filter by distance and type
  ↓
Return sorted list
  ↓
Frontend: Display in ResponderCard list
```

### 3. Allocate Responders

```
User taps "Allocate to Incident"
  ↓
POST /responders/allocate-from-maps
  ↓
Backend: fetch responders from Google Maps
  ↓
Backend: allocate_resources_quantum(clusters, responders)
  ↓
QAOA optimization
  ↓
Return allocations with ETA
  ↓
Frontend: Show allocation results
```

---

## Testing

### 1. Test Nearby Responders Endpoint

```bash
curl "http://localhost:8080/responders/nearby?lat=12.9716&lng=77.5946&radius_km=5"
```

### 2. Test with Responder Type Filter

```bash
curl "http://localhost:8080/responders/nearby?lat=12.9716&lng=77.5946&responder_type=ambulance"
```

### 3. Test Allocation

```bash
curl -X POST http://localhost:8080/responders/allocate-from-maps \
  -H "Content-Type: application/json" \
  -d '{
    "user_lat": 12.9716,
    "user_lng": 77.5946,
    "radius_km": 5.0,
    "clusters": [{
      "cluster_id": "flood_1",
      "incident_type": "flood",
      "centroid_lat": 12.9127,
      "centroid_lng": 77.6228,
      "cluster_severity": 0.88,
      "escalation_probability": 0.76,
      "incident_count": 8
    }]
  }'
```

---

## Features

✅ **Real-time responder data** from Google Maps  
✅ **Distance-based sorting** using Haversine formula  
✅ **ETA calculation** based on responder type speed  
✅ **Type filtering** (ambulance, fire_truck, police, medical_team)  
✅ **Radius adjustment** (2km, 5km, 10km, 15km)  
✅ **QAOA allocation** to incident clusters  
✅ **Rating & availability** from Google Maps  
✅ **GPS-based location** using expo-location  

---

## Advantages Over Hardcoded Responders

| Aspect | Hardcoded | Google Maps |
|--------|-----------|-------------|
| **Data** | Static, 11 responders | Real, 100+ responders |
| **Accuracy** | Fixed coordinates | Real-time locations |
| **Availability** | Manual tracking | From Google (open_now) |
| **Coverage** | Limited to Bengaluru | Any city worldwide |
| **Scalability** | Not scalable | Highly scalable |
| **User Location** | Not used | GPS-based |
| **Real-world** | Demo only | Production-ready |

---

## Configuration

### Search Parameters

```python
# responder_locator.py
PLACES_API_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"

# Default search radius
DEFAULT_RADIUS_METERS = 5000  # 5km

# Maximum results
MAX_RESULTS = 15
```

### Frontend Parameters

```javascript
// responders.jsx
const [radius, setRadius] = useState(5);  // km
const [filter, setFilter] = useState(null);  // responder type
const MAX_RESULTS = 20;
```

---

## Future Enhancements

1. **Real-time availability** - Integrate with responder dispatch systems
2. **Responder capacity** - Track current occupancy
3. **Skill-based matching** - Match responder skills to incident type
4. **Multi-language support** - Localize responder names and addresses
5. **Offline fallback** - Cache responder data for offline access
6. **Custom responder sources** - Integrate with local emergency services APIs
7. **Responder rating** - User feedback on responder performance
8. **Predictive positioning** - Predict responder locations based on patterns

---

## Troubleshooting

### No Responders Found

**Cause**: API key not set or invalid  
**Solution**: Check `GOOGLE_API_KEY` environment variable

### Location Permission Denied

**Cause**: User denied location permission  
**Solution**: Request permission again or check app settings

### API Rate Limit Exceeded

**Cause**: Too many requests to Google Maps API  
**Solution**: Implement caching or request throttling

### Incorrect ETA

**Cause**: Speed values don't match real-world conditions  
**Solution**: Adjust `RESPONDER_TYPES` speeds based on local traffic

---

## Summary

The Responder Locator system transforms City Samaachar from using hardcoded responders to leveraging **real-world emergency responder data from Google Maps**. This makes the system:

- 🌍 **Production-ready** for any city
- 📍 **User-location-aware** using GPS
- 🚀 **Scalable** to thousands of responders
- 🎯 **Accurate** with real-time data
- ⚡ **Fast** with optimized allocation

Users can now find and allocate actual emergency responders based on their real location!
