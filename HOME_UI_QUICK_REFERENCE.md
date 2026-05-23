# Home Screen UI - Quick Reference

## 🎯 What Changed

Complete redesign of `Frontend/app/(tabs)/home.jsx` - professional, emergency-focused mobile UI.

---

## 📱 Screen Layout

```
┌─────────────────────────────────────┐
│ City Samaachar              🔄      │  ← Enhanced Header
│ Bengaluru emergency intelligence    │
│ 🟢 Live • Updated • 8 teams online  │
├─────────────────────────────────────┤
│ HIGH RISK                      ⚠️   │  ← Risk Summary Card
│ 7 active risk areas                 │
│ 1 critical situation                │
│ [View Critical Area →]              │
├─────────────────────────────────────┤
│ ⚠️ 7      📄 12    🚑 8    👥 2.1K │  ← Metrics Grid (2x2)
│ Risk     Reports  Teams   Affected  │
├─────────────────────────────────────┤
│ 🔥 Fire concentration    [72%]      │  ← Alert Banner
│ 5 related reports...                │
│ [View Details]                      │
├─────────────────────────────────────┤
│ Active risk areas                 7 │  ← Section Header
│ [All] [Critical] [High] [Medium]... │  ← Filter Chips
├─────────────────────────────────────┤
│ 🔥 FIRE              [Medium Risk]  │  ← Risk Area Card
│ Kempegowda Airport                  │
│ 5 reports • 72% escalation • ETA 12m│
│ Deploy additional fire units...     │
│ [View Details]    [Dispatch]        │
├─────────────────────────────────────┤
│ Live Risk Map                  🗺️   │  ← Mini Map Preview
│ 7 active zones                      │
│ [Open Map →]                        │
└─────────────────────────────────────┘
```

---

## 🎨 Color System

| Level | Color | Background | Usage |
|-------|-------|------------|-------|
| **Critical** | #DC2626 | #FEE2E2 | Urgent situations |
| **High** | #EA580C | #FFEDD5 | Important alerts |
| **Medium** | #D97706 | #FEF3C7 | Monitor closely |
| **Low** | #16A34A | #DCFCE7 | Safe areas |
| **Info** | #1D4ED8 | #EFF6FF | General info |

---

## 🧩 Components

### 1. LiveStatus
```javascript
<LiveStatus />
// Shows: 🟢 Live • Updated just now • 8 teams online
```

### 2. RiskSummaryCard
```javascript
<RiskSummaryCard
  totalAreas={7}
  criticalCount={1}
  highestRiskArea={area}
  onViewCritical={() => openDetail(area)}
/>
```

### 3. MetricsGrid
```javascript
<MetricsGrid
  riskAreas={7}
  reports={12}
  teams={8}
  affected={2100}
/>
```

### 4. AlertBanner
```javascript
<AlertBanner
  title="Fire concentration detected"
  description="5 related reports..."
  confidence={72}
  onViewDetails={() => {}}
/>
```

### 5. FilterChips
```javascript
<FilterChips
  options={["All", "Critical", "High", "Medium", "Fire", "Flood", "Traffic"]}
  selected={selectedFilter}
  onSelect={setSelectedFilter}
/>
```

### 6. RiskAreaCard
```javascript
<RiskAreaCard
  area={area}
  onPress={() => openDetail(area)}
/>
```

### 7. MiniMapPreview
```javascript
<MiniMapPreview
  areaCount={7}
  onOpenMap={() => router.push("/map")}
/>
```

### 8. EmptyState
```javascript
<EmptyState
  message="No active risk areas. The city is currently calm."
  onDemo={() => loadDemo("all")}
  running={running}
/>
```

---

## 🎯 Key Features

✅ **Professional Design**
- Clean, modern layout
- Proper spacing (16px padding)
- Consistent typography

✅ **Emergency-Focused**
- Risk summary at top
- Color-coded severity
- Critical alerts prominent

✅ **Mobile-Optimized**
- 2x2 metrics grid
- Horizontal scrollable filters
- Touch-friendly buttons
- Proper padding for iPhone

✅ **Interactive**
- Real-time filtering
- Tap to view details
- Dispatch buttons
- Demo data loading

✅ **Data-Driven**
- All backend data used
- No hardcoded values
- Fallback handling
- Dynamic emoji mapping

---

## 📊 Data Mapping

```javascript
// From useIntel() hook
const { cs, riskAreas, alerts, loading, running, loadDemo, fetchAll } = useIntel();

// Risk Summary
- totalAreas = riskAreas.length
- criticalCount = riskAreas.filter(a => a.risk_label.includes("critical")).length
- highestRiskArea = riskAreas[0]

// Metrics
- riskAreas = cs.risk_areas_found
- reports = cs.reports_analyzed
- teams = cs.teams_assigned
- affected = cs.people_affected

// Alert
- title = alerts[0].title
- description = alerts[0].description
- confidence = alerts[0].confidence

// Risk Cards
- incident_type = area.incident_type
- area_name = area.area_name
- risk_label = area.risk_label
- incident_count = area.incident_count
- escalation_probability = area.escalation_probability
- eta_minutes = area.eta_minutes
- recommended_action = area.recommended_action
```

---

## 🎭 Incident Emojis

```javascript
fire → 🔥
flood → 🌊
road_accident → 🚗
medical_emergency → 🏥
power_outage → ⚡
infrastructure_failure → 🏗️
crowd_risk → 👥
hazardous_material → ☢️
rescue_required → 🆘
traffic → 🚦
other → ⚠️
```

---

## 🚀 Running the App

```bash
cd Frontend
npm install
npx expo start

# Scan QR code with Expo Go
# Or press 'i' for iOS / 'a' for Android
```

---

## ✅ Testing Checklist

- [ ] Run `npx expo start`
- [ ] Load demo data
- [ ] Verify all cards render
- [ ] Test filter chips
- [ ] Test View Details button
- [ ] Test Dispatch button
- [ ] Test refresh button
- [ ] Check colors match risk levels
- [ ] Verify spacing on different sizes
- [ ] Test empty state
- [ ] Test navigation to detail screen

---

## 📝 Styling Constants

```javascript
// Spacing
SPACING.xs = 4
SPACING.sm = 8
SPACING.md = 12
SPACING.lg = 16
SPACING.xl = 24

// Border Radius
RADIUS.sm = 6
RADIUS.md = 10
RADIUS.lg = 14
RADIUS.pill = 999

// Typography
Header: 20px, 700 weight
Title: 18px, 700 weight
Body: 14px, 400 weight
Caption: 12px, 400 weight
Label: 11px, 600 weight
```

---

## 🔄 State Management

```javascript
const [selectedFilter, setSelectedFilter] = useState("All");

const filteredAreas = riskAreas.filter((area) => {
  if (selectedFilter === "All") return true;
  if (selectedFilter === "Critical") return area.risk_label?.toLowerCase().includes("critical");
  if (selectedFilter === "High") return area.risk_label?.toLowerCase().includes("high");
  if (selectedFilter === "Medium") return area.risk_label?.toLowerCase().includes("medium");
  if (selectedFilter === "Fire") return area.incident_type?.toLowerCase().includes("fire");
  if (selectedFilter === "Flood") return area.incident_type?.toLowerCase().includes("flood");
  if (selectedFilter === "Traffic") return area.incident_type?.toLowerCase().includes("traffic");
  return true;
});
```

---

## 📁 File Structure

```
Frontend/
├── app/
│   └── (tabs)/
│       ├── home.jsx ← REDESIGNED
│       ├── map.jsx
│       ├── report.jsx
│       ├── responders.jsx
│       ├── teams.jsx
│       └── _layout.jsx
└── lib/
    ├── components/
    │   ├── RiskCard.jsx
    │   ├── ResponderCard.jsx
    │   └── ...
    └── constants.js
```

---

## 🎓 Learning Resources

- `HOME_UI_REDESIGN.md` - Complete documentation
- `Frontend/app/(tabs)/home.jsx` - Full implementation
- `Frontend/lib/constants.js` - Design tokens

---

## 🚀 Performance

- ✅ Functional components
- ✅ Minimal re-renders
- ✅ Efficient filtering
- ✅ No heavy dependencies
- ✅ Smooth scrolling

---

## 🔮 Future Enhancements

1. Real map integration (replace placeholder)
2. Animations (fade-in, slide)
3. Swipe actions (dismiss, quick actions)
4. Dark mode support
5. Haptic feedback
6. Offline caching
7. Push notifications
8. Custom filters

---

**Status**: ✅ Complete and Ready to Use

**File**: `Frontend/app/(tabs)/home.jsx`  
**Documentation**: `HOME_UI_REDESIGN.md`  
**Quick Reference**: This file
