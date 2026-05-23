# Home Screen Updates - SOS Button & News Sources

## Changes Made

### 1. ✅ Big Red SOS Button (Top Right)

**Location**: Header, next to refresh button

**Styling**:
- Background: Bright red (#DC2626)
- Text: Bold white "SOS" with letter spacing
- Size: 50px minimum width, compact height
- Shadow: Subtle elevation
- Position: Top right corner

**Code**:
```javascript
<TouchableOpacity style={s.sosBtn} onPress={() => {}}>
  <Text style={s.sosBtnText}>SOS</Text>
</TouchableOpacity>
```

**Visual**:
```
┌─────────────────────────────────────┐
│ City Samaachar          🔄  [SOS]   │  ← Red SOS button
│ Bengaluru emergency intelligence    │
│ 🟢 Live • Updated • 8 teams online  │
└─────────────────────────────────────┘
```

**Styles**:
```javascript
sosBtn: {
  backgroundColor: "#DC2626",
  borderRadius: RADIUS.md,
  paddingHorizontal: SPACING.md,
  paddingVertical: SPACING.sm,
  minWidth: 50,
  alignItems: "center",
  justifyContent: "center",
  ...SHADOW.card,
},
sosBtnText: {
  fontSize: 13,
  fontWeight: "700",
  color: "#fff",
  letterSpacing: 1,
},
```

---

### 2. ✅ Removed Dispatch Button

**Before**:
```
[View Details]    [Dispatch]
```

**After**:
```
[View Details]
```

**Reason**: Dispatch functionality was unclear. Focus on "View Details" for incident management.

**Code Change**:
```javascript
// OLD: Two buttons in a row
<View style={s.riskCardActions}>
  <TouchableOpacity style={s.riskCardActionBtn} onPress={onPress}>
    <Text style={s.riskCardActionText}>View Details</Text>
  </TouchableOpacity>
  <TouchableOpacity style={[s.riskCardActionBtn, { backgroundColor: col.base }]} onPress={() => {}}>
    <Text style={s.riskCardActionTextPrimary}>Dispatch</Text>
  </TouchableOpacity>
</View>

// NEW: Single button
<TouchableOpacity style={s.riskCardActionBtn} onPress={onPress}>
  <Text style={s.riskCardActionText}>View Details</Text>
</TouchableOpacity>
```

---

### 3. ✅ News Source Links on Cards

**Location**: Below recommendation box, above "View Details" button

**Features**:
- Shows up to 3 news sources per incident
- Blue badge style with icon
- Clickable (ready for integration)
- Displays source name or "News"
- Open icon indicator

**Visual**:
```
┌─────────────────────────────────────┐
│ 🔥 FIRE              [Medium Risk]  │
│ Kempegowda Airport                  │
│ 5 reports • 72% escalation • ETA 12m│
│ Deploy additional fire units...     │
│                                     │
│ 📰 News Sources                     │
│ [TOI →] [BBC →] [NDTV →]           │
│                                     │
│ [View Details]                      │
└─────────────────────────────────────┘
```

**Code**:
```javascript
{/* News Sources */}
{newsSources && newsSources.length > 0 && (
  <View style={s.newsSourcesSection}>
    <Text style={s.newsSourcesLabel}>📰 News Sources</Text>
    <View style={s.newsSourcesList}>
      {newsSources.slice(0, 3).map((source, idx) => (
        <TouchableOpacity key={idx} style={s.newsSourceBadge} onPress={() => {}}>
          <Text style={s.newsSourceText} numberOfLines={1}>
            {typeof source === "string" ? source : source.name || source.source || "News"}
          </Text>
          <Ionicons name="open-outline" size={12} color={C.info} />
        </TouchableOpacity>
      ))}
    </View>
  </View>
)}
```

**Data Integration**:
```javascript
const newsSources = area.news_sources || area.data_sources || [];
```

Supports both:
- `area.news_sources` - Array of news source objects/strings
- `area.data_sources` - Fallback to data sources

**Styles**:
```javascript
newsSourcesSection: {
  marginBottom: SPACING.md,
},
newsSourcesLabel: {
  fontSize: 11,
  fontWeight: "700",
  color: C.text,
  marginBottom: SPACING.sm,
},
newsSourcesList: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: SPACING.sm,
},
newsSourceBadge: {
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
  backgroundColor: C.infoBg,
  borderRadius: RADIUS.pill,
  borderWidth: 1,
  borderColor: C.infoBorder,
  paddingHorizontal: SPACING.sm,
  paddingVertical: 4,
},
newsSourceText: {
  fontSize: 10,
  fontWeight: "600",
  color: C.infoText,
  maxWidth: 120,
},
```

---

## Updated Risk Area Card Structure

```
┌─────────────────────────────────────┐
│ 🔥 FIRE              [Medium Risk]  │  ← Emoji + Type + Badge
│                                     │
│ Kempegowda Airport                  │  ← Location
│                                     │
│ 5 reports • 72% escalation • ETA 12m│  ← Metadata
│                                     │
│ Deploy additional fire units...     │  ← Recommendation
│                                     │
│ 📰 News Sources                     │  ← News Sources (NEW)
│ [TOI →] [BBC →] [NDTV →]           │
│                                     │
│ [View Details]                      │  ← Single Action Button
└─────────────────────────────────────┘
```

---

## Header Layout

```
┌─────────────────────────────────────┐
│ City Samaachar              🔄 SOS  │  ← Title + Refresh + SOS
│ Bengaluru emergency intelligence    │
│ 🟢 Live • Updated • 8 teams online  │
└─────────────────────────────────────┘
```

**Header Actions**:
- Refresh button (blue, left)
- SOS button (red, right)
- Proper spacing between them

---

## Data Flow for News Sources

### Backend Response Example
```json
{
  "area_name": "Kempegowda Airport",
  "incident_type": "fire",
  "risk_label": "medium_risk",
  "news_sources": [
    "Times of India",
    "BBC News",
    "NDTV"
  ],
  "data_sources": [
    { "name": "Twitter", "url": "..." },
    { "name": "News API", "url": "..." }
  ]
}
```

### Frontend Handling
```javascript
const newsSources = area.news_sources || area.data_sources || [];
// Displays first 3 sources
// Handles both string arrays and object arrays
```

---

## Testing Checklist

- [ ] Run `npx expo start`
- [ ] Verify SOS button appears in top right
- [ ] SOS button is bright red
- [ ] Dispatch button is removed from risk cards
- [ ] "View Details" button is centered and full-width
- [ ] News sources section appears on cards (if data exists)
- [ ] News source badges are blue with open icon
- [ ] News sources are clickable (ready for URL integration)
- [ ] Maximum 3 news sources displayed per card
- [ ] News sources wrap to next line if needed
- [ ] All other functionality still works

---

## Future Enhancements

1. **SOS Button Functionality**
   - Open emergency contact dialog
   - Send location to emergency services
   - Trigger emergency alert

2. **News Source Links**
   - Open URLs in browser/webview
   - Track click analytics
   - Show full article preview
   - Filter by source type

3. **News Source Filtering**
   - Filter incidents by news source
   - Show only verified news sources
   - Highlight breaking news

---

## Files Modified

- `Frontend/app/(tabs)/home.jsx`
  - Added SOS button to header
  - Removed dispatch button from risk cards
  - Added news sources section to risk cards
  - Added corresponding styles

---

## Summary

✅ **SOS Button**: Prominent red button in top right corner  
✅ **Removed Dispatch**: Cleaner card layout with single action button  
✅ **News Sources**: Blue badges showing incident-related news sources  
✅ **Data Integration**: Supports both `news_sources` and `data_sources` fields  
✅ **Mobile-Optimized**: Responsive layout with proper spacing  
✅ **Ready for Integration**: News source links ready for URL handling  

**Status**: ✅ Complete and Ready to Use
