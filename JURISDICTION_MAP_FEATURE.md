# Jurisdiction Map Visualization Feature

## Overview
Added Bengaluru Traffic Police jurisdiction boundary outlines to the dashboard map visualization.

## Implementation

### 1. KML Parser (`backend/utils/kml_parser.py`)
- Parses `btp_jurisdictions_pre_2022.kml` file
- Extracts 45 jurisdiction polygons with coordinates
- Converts to GeoJSON format for easy consumption
- Output: `backend/data/real_world/opencity/btp_jurisdictions.geojson`

### 2. Backend API Endpoint
**Endpoint**: `GET /map/jurisdictions`
- Returns GeoJSON FeatureCollection with all jurisdiction boundaries
- Each feature includes:
  - `name`: Jurisdiction name (e.g., "Cubbon Park Traffic PS")
  - `type`: "jurisdiction"
  - `geometry`: Polygon coordinates in [longitude, latitude] format

**Usage**:
```bash
curl http://localhost:8080/map/jurisdictions
```

### 3. Frontend Visualization (`Frontend/app/index.jsx`)
- Added `JurisdictionOverlay` component using `react-native-svg`
- Converts GeoJSON lat/lng coordinates to SVG path coordinates
- Maps Bengaluru bounds (lat: 12.85-13.15, lng: 77.45-77.75) to 100x100 viewBox
- Renders jurisdiction boundaries as semi-transparent stroke paths
- Automatically fetches and displays on dashboard load

**Interactive Features**:
- **Hover Effect**: Polygons highlight on mouse hover (web only)
- **Tooltip**: Shows jurisdiction name at polygon centroid
- **Name Cleaning**: Removes "Traffic PS" suffix (e.g., "Banaswadi Traffic PS" → "Banaswadi")

**Visual Properties**:
- **Default State**:
  - Stroke color: Border color from theme (`C.border`)
  - Stroke width: 0.15 (thin lines)
  - Opacity: 0.4 (subtle overlay)
  - Fill: None (transparent interior)
- **Hover State**:
  - Stroke color: Quantum cyan (`C.quantum`)
  - Stroke width: 0.25 (thicker)
  - Opacity: 0.8 (more visible)
  - Fill: Quantum cyan with 15% opacity
  - Tooltip: Dark card with cyan border and glow effect

## Files Modified
1. `backend/utils/kml_parser.py` - NEW
2. `backend/api/routes.py` - Added `/map/jurisdictions` endpoint
3. `backend/data/real_world/opencity/btp_jurisdictions.geojson` - NEW (generated)
4. `Frontend/app/index.jsx` - Added jurisdiction overlay component
5. `Frontend/package.json` - Added `react-native-svg` dependency

## How to Use

### Backend
The endpoint is automatically available when the backend is running:
```bash
cd backend
python -m uvicorn api.routes:app --host 0.0.0.0 --port 8080
```

### Frontend
The jurisdiction outlines appear automatically on the dashboard map when you load the page. No additional configuration needed.

### Regenerate GeoJSON (if KML changes)
```bash
cd backend
python utils/kml_parser.py
```

## Technical Details

### Coordinate Transformation
```javascript
// Bengaluru bounds
minLat: 12.85, maxLat: 13.15
minLng: 77.45, maxLng: 77.75

// Transform to percentage (0-100)
x = ((lng - minLng) / (maxLng - minLng)) * 100
y = ((maxLat - lat) / (maxLat - minLat)) * 100
```

### SVG Path Generation
Each polygon is converted to an SVG path string:
```
M x1 y1 L x2 y2 L x3 y3 ... Z
```
Where:
- `M` = Move to first point
- `L` = Line to next point
- `Z` = Close path

## Benefits
1. **Contextual Awareness**: Users can see which jurisdiction each incident falls under
2. **Spatial Understanding**: Clear boundaries help understand coverage areas
3. **Interactive Exploration**: Hover to identify jurisdictions instantly
4. **Clean Labels**: Simplified names (removed "Traffic PS") for better readability
5. **Real Data**: Uses actual BTP jurisdiction boundaries from OpenCity data
6. **Performance**: SVG rendering is efficient, GeoJSON is cached
7. **Scalable**: Easy to add more map layers or interactive features

## User Interaction
1. **Hover over any boundary** → Polygon highlights in cyan
2. **Tooltip appears** → Shows clean jurisdiction name (e.g., "Banaswadi")
3. **Move away** → Returns to subtle outline

## Future Enhancements
- Color-code jurisdictions by incident density
- Highlight active jurisdictions with incidents
- Add toggle to show/hide jurisdiction boundaries
- Interactive jurisdiction selection for filtering
- Click to zoom into specific jurisdiction
