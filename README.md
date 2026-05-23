# Quantum-Assisted Emergency Intelligence Platform
**Multimodal Emergency Intelligence + Semantic Event Fusion + Predictive Escalation + QAOA Resource Allocation + PQC Secure Dispatch + Operations Dashboard**

## Problem

Cities face emergencies — fires, floods, accidents, infrastructure failures — but lack a single intelligent system that can ingest reports, predict escalation, optimally allocate responders, and securely dispatch them in real time.

## Solution

A quantum-assisted emergency intelligence platform that:

1. **Ingests** citizen reports and public feeds (news, Reddit) with emergency filtering
2. **Analyzes** incidents using Gemini AI (text + vision) for severity scoring and classification
3. **Fuses** related incidents into clusters using semantic embeddings
4. **Predicts** escalation using rule-based intelligence
5. **Allocates** responders using QAOA quantum optimization (Qiskit)
6. **Dispatches** securely using Post-Quantum Cryptography (Kyber512)
7. **Visualizes** everything on a real-time operations dashboard

## Architecture

```
Citizen Reports / Public Feeds
        |
Incident Ingestion Layer  (ingestion/)
        |
Gemini Incident Analysis   (intelligence/)
        |
Semantic Event Fusion       (clustering/)
        |
Escalation Prediction       (prediction/)
        |
Quantum Resource Allocation (quantum/)
        |
PQC Secure Dispatch         (security/)
        |
Operations Dashboard        (Frontend/)
```

## Quantum Components

### QAOA Resource Allocation
- Uses `qiskit-optimization` with `QuadraticProgram` and `QAOA`
- Minimizes response time and unassigned critical incidents
- Priority function: `severity * 0.5 + escalation * 0.3 + people_affected * 0.2`
- Falls back to classical greedy when quantum constraints exceeded

### PQC Secure Dispatch
- Uses `pqcrypto.kem.kyber512` for quantum-safe encryption
- All dispatch messages encrypted with Kyber512 KEM
- End-to-end: `plaintext -> encrypt -> transmit -> decrypt`

## Tech Stack

| Area | Technology |
|------|-----------|
| AI Analysis | **Gemini 2.0 Flash / 1.5 Pro** |
| Vision | **Gemini Vision API** |
| Embeddings | **SentenceTransformer (all-MiniLM-L6-v2)** |
| Quantum | **Qiskit QAOA** |
| Post-Quantum Security | **Kyber512 (pqcrypto)** |
| Backend | **FastAPI, Python** |
| Graph DB | **Neo4j** |
| Frontend | **React Native (Expo)** |
| Maps | **Google Maps SDK** |
| Cloud | **Google Cloud (Storage, Firestore, Pub/Sub)** |

## Project Structure

```
backend/
  ingestion/          # Emergency incident ingestion (RSS, Reddit, user reports)
  intelligence/       # Gemini AI analysis (text + vision)
  clustering/         # Semantic event fusion (SentenceTransformer)
  prediction/         # Escalation prediction engine
  quantum/            # QAOA resource allocation (Qiskit)
  security/           # PQC secure dispatch (Kyber512)
  orchestration/      # Pipeline coordinator
  api/                # FastAPI routes
  models/             # Data models (Pydantic)
  utils/              # Config, geo utilities
  data/               # Mock incidents for demo

Frontend/
  app/
    index.jsx         # Command Center dashboard
    map-component.jsx # Emergency map with overlays
    report.jsx        # Emergency report submission
    _layout.jsx       # Navigation layout
    constants.js      # API configuration
```

## Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn api.routes:app --host 0.0.0.0 --port 8080 --reload
```

Environment variables needed:
```
GOOGLE_API_KEY=
GEMINI_API_KEY=
NEO4J_URI=
NEO4J_USER=
NEO4J_PASSWORD=
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
GCP_PROJECT=
BUCKET_NAME=
```

### Frontend

```bash
cd Frontend
npm install
npx expo start
```

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/report` | Submit emergency report (text + image) |
| GET | `/incidents` | Get all processed incidents |
| GET | `/clusters` | Get incident clusters with escalation data |
| GET | `/allocation` | Get quantum resource allocation results |
| POST | `/dispatch` | Trigger PQC-encrypted dispatch |
| POST | `/pipeline/run` | Run full intelligence pipeline |
| GET | `/pipeline/status` | Get pipeline status |

## Demo Flow

1. User uploads flood image via mobile app
2. Gemini Vision identifies flooding, estimates severity 0.87
3. System clusters nearby flood reports (3 incidents)
4. Escalation predictor: "Potential large-scale flooding event" (82%)
5. QAOA allocates ambulances + rescue units optimally
6. Dispatch encrypted with Kyber512 and sent
7. Dashboard updates live with all panels

## SDG Alignment

- **SDG 11**: Sustainable Cities and Communities
- **SDG 9**: Industry, Innovation, and Infrastructure
- **SDG 3**: Good Health and Well-being
