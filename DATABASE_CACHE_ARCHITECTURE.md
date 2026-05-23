# Database & Cache Architecture 🗄️

## Overview

City Samaachar uses a **multi-layer data architecture** combining graph database, cloud storage, and in-memory caching for real-time incident management.

---

## Primary Database: Neo4j (Graph Database)

### Purpose
- **Incident graph storage** - Jurisdictions, wards, incidents, relationships
- **Spatial queries** - Point-in-polygon, proximity searches
- **Deduplication** - Semantic clustering of similar incidents
- **Real-time updates** - Live incident ingestion

### Configuration
```python
# backend/Agent1.py, Agent2.py, Agent5.py, etc.
NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

from neo4j import GraphDatabase
driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
```

### Data Model

**Nodes**:
- `TrafficJurisdiction` - Police jurisdictions (from KML)
- `Ward` - City wards (from KML + CSV)
- `Incident` - Individual incidents (news, Reddit, user reports)
- `EventCluster` - Deduplicated incident clusters
- `Incidents` (container) - Grouped incidents by jurisdiction

**Relationships**:
- `BELONGS_TO` - Ward → Jurisdiction
- `CONTAINS` - Jurisdiction → Incidents
- `PART_OF` - Incident → EventCluster
- `SIMILAR_TO` - Incident → Incident (semantic similarity)

### Key Operations

**Ingest Jurisdictions** (Agent1.py):
```cypher
CREATE (j:TrafficJurisdiction {
  name: "Traffic_PS",
  boundary: "...",
  area: 123.45
})
```

**Ingest Wards** (Agent2.py):
```cypher
CREATE (w:Ward {name: "Ward_1"})
CREATE (w)-[:BELONGS_TO]->(j:TrafficJurisdiction)
```

**Create Incidents** (Agent5.py):
```cypher
CREATE (i:Incident {
  title: "Fire near Airport",
  incident_type: "fire",
  location: {lat: 12.97, lng: 77.59},
  severity: 0.85,
  timestamp: "2026-05-23T13:00:00Z"
})
CREATE (i)-[:PART_OF]->(cluster:EventCluster)
```

**Deduplication** (deduplication_agent.py):
```cypher
MATCH (i:Incident)
WITH i, apoc.text.distance(i.summary, other.summary) as sim
WHERE sim > 0.7
CREATE (i)-[:SIMILAR_TO]->(other)
CREATE (cluster:EventCluster {summary: "..."})
CREATE (i)-[:PART_OF]->(cluster)
```

### Dependencies
```
neo4j==5.24.0
py2neo==2021.2.4
```

---

## Secondary Storage: Google Cloud Firestore

### Purpose
- **User reports** - Store citizen-submitted incident reports
- **Report metadata** - Images, descriptions, locations, timestamps
- **Query by location** - Haversine proximity queries

### Configuration
```python
# backend/upload-report/main.py, main2.py
from google.cloud import firestore

db = firestore.Client()
db.collection("reports").document(report_id).set({
    "title": "...",
    "description": "...",
    "location": {"latitude": 12.97, "longitude": 77.59},
    "image_url": "gs://bucket/image.jpg",
    "timestamp": "2026-05-23T13:00:00Z"
})
```

### Collections
- `reports` - User-submitted incident reports
- `images` - Image metadata (stored in GCS)

### Query Example
```python
# Get incidents within 50km of user location
def get_events_nearby(lat, lng, radius_km=50):
    docs = db.collection("reports").stream()
    nearby = []
    for doc in docs:
        loc = doc.get("location")
        dist = haversine(lat, lng, loc["latitude"], loc["longitude"])
        if dist <= radius_km:
            nearby.append(doc.to_dict())
    return nearby
```

### Dependencies
```
google-cloud-firestore==2.18.0
google-cloud-storage==2.18.0
```

---

## Image Storage: Google Cloud Storage (GCS)

### Purpose
- **Store incident photos** - User-submitted images
- **Serve images** - Public URLs for frontend
- **Image analysis** - Gemini Vision API processing

### Configuration
```python
# backend/upload-report/main2.py
from google.cloud import storage

bucket = storage.Client().bucket(os.getenv("BUCKET_NAME"))
blob = bucket.blob(f"incidents/{report_id}.jpg")
blob.upload_from_string(image_data, content_type="image/jpeg")
image_url = blob.public_url
```

### Bucket Structure
```
gs://bucket/
  incidents/
    report_uuid_1.jpg
    report_uuid_2.jpg
    ...
```

---

## In-Memory Cache

### 1. Traffic Alerts Cache

**File**: `backend/ingestion/traffic_alert_ingestion.py`

**Purpose**: Cache traffic alert data to avoid repeated file I/O

**Implementation**:
```python
_traffic_alerts: list | None = None

def load_traffic_alerts() -> list:
    """Load all traffic alerts (cached)."""
    global _traffic_alerts
    if _traffic_alerts is not None:
        return _traffic_alerts
    
    with open(_DATA_PATH) as f:
        _traffic_alerts = json.load(f)
    return _traffic_alerts
```

**Data Source**: `backend/data/traffic/mock_traffic_alerts.json`

**Cache Strategy**: Load-once, keep in memory for session

---

### 2. Weather Cache

**File**: `backend/ingestion/traffic_alert_ingestion.py`

**Purpose**: Cache weather data with TTL to avoid repeated API calls

**Implementation**:
```python
_weather_cache: dict = {}
_WEATHER_TTL_SECONDS = 1800  # 30 minutes

def get_mock_weather(lat: float = 12.97, lng: float = 77.59) -> dict:
    """Fetch weather with 30-minute cache."""
    global _weather_cache
    now = time.time()
    
    # Return cached if still valid
    if _weather_cache.get("expires_at", 0) > now:
        return _weather_cache["data"]
    
    # Fetch from Open-Meteo API
    data = requests.get("https://api.open-meteo.com/...").json()
    
    # Cache for 30 minutes
    _weather_cache = {"data": data, "expires_at": now + 1800}
    return data
```

**Data Source**: Open-Meteo API (free, no key required)

**Cache TTL**: 30 minutes (refreshes automatically)

**Fallback**: Seasonal defaults if API fails

---

### 3. Historical Crash Risk Cache

**File**: `backend/ingestion/historical_crash_loader.py`

**Purpose**: Cache historical crash data by area

**Implementation**:
```python
_crash_risk_index: dict | None = None

def load_crash_risk_index() -> dict:
    """Load crash risk data (cached)."""
    global _crash_risk_index
    if _crash_risk_index is not None:
        return _crash_risk_index
    
    with open(_DATA_PATH) as f:
        _crash_risk_index = json.load(f)
    return _crash_risk_index
```

**Data Source**: `backend/data/crash_risk/processed/crash_risk_by_area.json`

**Cache Strategy**: Load-once, keep in memory

---

### 4. Active Incidents Cache

**File**: `backend/agents/live_news_monitor.py`

**Purpose**: Cache active incidents in memory for fast access

**Implementation**:
```python
class LiveNewsMonitor:
    def __init__(self):
        self.active_incidents = []  # In-memory cache
    
    def add_incident(self, incident):
        self.active_incidents.append(incident)
    
    def get_active_incidents(self):
        return self.active_incidents
```

**Cache Strategy**: Append-only list, updated every 60 seconds

**Refresh**: Background task fetches from news + Reddit

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA SOURCES                             │
├─────────────────────────────────────────────────────────────┤
│ • Google News RSS                                           │
│ • Reddit r/bangalore                                        │
│ • User Reports (Firestore)                                  │
│ • Traffic Alerts (JSON file)                                │
│ • Historical Crash Data (JSON file)                          │
│ • Weather API (Open-Meteo)                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              INGESTION & PROCESSING                         │
├─────────────────────────────────────────────────────────────┤
│ • Fetch incidents (RSS, Reddit, reports)                    │
│ • Classify with Gemini AI                                   │
│ • Normalize incident types                                  │
│ • Extract location & severity                               │
│ • Build QML features (crash risk, traffic, weather)         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            CACHING LAYER (IN-MEMORY)                        │
├─────────────────────────────────────────────────────────────┤
│ • Traffic alerts (load-once)                                │
│ • Weather data (30-min TTL)                                 │
│ • Crash risk index (load-once)                              │
│ • Active incidents (updated every 60s)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            PRIMARY DATABASE (NEO4J)                          │
├─────────────────────────────────────────────────────────────┤
│ • Jurisdictions & wards                                     │
│ • Incidents & clusters                                      │
│ • Semantic relationships                                    │
│ • Real-time updates                                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│          SECONDARY STORAGE (FIRESTORE + GCS)                │
├─────────────────────────────────────────────────────────────┤
│ • User reports (Firestore)                                  │
│ • Report images (GCS)                                       │
│ • Long-term archival                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND (REACT NATIVE)                        │
├─────────────────────────────────────────────────────────────┤
│ • Home page (map + incidents)                               │
│ • Incidents list (filtered)                                 │
│ • Report form (with image upload)                           │
│ • Teams & responders                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Query Patterns

### 1. Get Incidents by Jurisdiction (Neo4j)
```cypher
MATCH (j:TrafficJurisdiction {name: "Traffic_PS_1"})
       -[:CONTAINS]->(incidents:Incidents)
       -[:CONTAINS]->(i:Incident)
RETURN i
```

### 2. Get Nearby User Reports (Firestore)
```python
docs = db.collection("reports").stream()
nearby = [d for d in docs if haversine(lat, lng, d.location) < 50]
```

### 3. Get Traffic Context (In-Memory Cache)
```python
alerts = load_traffic_alerts()  # From cache
nearby = [a for a in alerts if haversine(lat, lng, a.lat, a.lng) < 3]
```

### 4. Get Weather (Cached API)
```python
weather = get_mock_weather(lat, lng)  # Returns cached if < 30 min old
```

### 5. Find Similar Incidents (Neo4j)
```cypher
MATCH (i:Incident {id: "incident_1"})
       -[:SIMILAR_TO]->(other:Incident)
RETURN other
```

---

## Performance Characteristics

| Storage | Type | Latency | Capacity | Use Case |
|---------|------|---------|----------|----------|
| **In-Memory Cache** | RAM | <1ms | ~100MB | Traffic alerts, weather, crash risk |
| **Neo4j** | Graph DB | 10-100ms | ~1GB | Incidents, jurisdictions, relationships |
| **Firestore** | Document DB | 50-200ms | Unlimited | User reports, metadata |
| **GCS** | Object Store | 100-500ms | Unlimited | Images, large files |

---

## Backup & Recovery

### Neo4j
- **Backup**: Manual exports to JSON/CSV
- **Recovery**: Re-import from backup files
- **Retention**: Keep last 7 days of snapshots

### Firestore
- **Backup**: Google Cloud Backup & Restore
- **Recovery**: Point-in-time restore
- **Retention**: 35-day retention by default

### GCS
- **Backup**: Versioning enabled
- **Recovery**: Restore previous versions
- **Retention**: Keep all versions

---

## Environment Variables

```bash
# Neo4j
export NEO4J_URI="bolt://localhost:7687"
export NEO4J_PASSWORD="your_password"

# Google Cloud
export GOOGLE_API_KEY="your_key"
export GCP_PROJECT="your_project"
export BUCKET_NAME="your_bucket"

# Reddit (optional)
export REDDIT_CLIENT_ID="your_id"
export REDDIT_CLIENT_SECRET="your_secret"
```

---

## Dependencies Summary

```
# Database
neo4j==5.24.0
py2neo==2021.2.4

# Cloud Storage
google-cloud-firestore==2.18.0
google-cloud-storage==2.18.0

# APIs
google-generativeai==0.8.0
requests==2.32.0
feedparser==6.0.11
praw==7.7.1

# Data Processing
sentence-transformers==3.0.0
pandas==2.2.0
numpy>=1.24.0
shapely>=2.0.0
geopy==2.4.1
```

---

## Summary

**City Samaachar uses a hybrid architecture**:

✅ **Neo4j** - Real-time incident graph with spatial queries  
✅ **Firestore** - User reports with location-based queries  
✅ **GCS** - Image storage with public URLs  
✅ **In-Memory Cache** - Traffic alerts, weather, crash risk (fast access)  
✅ **Background Tasks** - Live news monitoring (every 60s)  

This design provides:
- **Fast reads** (in-memory cache)
- **Real-time updates** (Neo4j + background tasks)
- **Scalability** (Firestore + GCS)
- **Reliability** (multiple data sources)
- **Flexibility** (graph + document + object storage)

