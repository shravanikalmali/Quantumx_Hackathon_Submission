import React, { useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { useRouter } from "expo-router";
import { WebView } from "react-native-webview";
import { useIntel } from "../_layout";
import RiskCard from "../../lib/components/RiskCard";
import { C, SPACING, RADIUS, SHADOW } from "../../lib/constants";

function buildMapHtml(riskAreas, incidents) {
  const areas = JSON.stringify(riskAreas);
  const incs  = JSON.stringify(incidents);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body,html,#map{margin:0;padding:0;width:100%;height:100%;background:#f9fafb;}
    .leaflet-container{background:#e8f4fd;}
    .leaflet-popup-content-wrapper{background:#fff;color:#111827;border:1px solid #e5e7eb;border-radius:8px;font-family:system-ui,sans-serif;font-size:12px;}
    .leaflet-popup-tip{background:#fff;}
  </style>
</head>
<body>
<div id="map"></div>
<script>
  const map = L.map('map',{zoomControl:true}).setView([12.95,77.62],12);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{attribution:'&copy; CARTO',maxZoom:20}).addTo(map);
  const COLORS={critical:'#dc2626',high:'#d97706',medium:'#f97316',safe:'#16a34a'};
  function levelColor(label=''){const s=label.toLowerCase();if(s.includes('critical'))return COLORS.critical;if(s.includes('high'))return COLORS.high;if(s.includes('medium'))return COLORS.medium;return COLORS.safe;}
  const riskAreas=${areas};
  const incidents=${incs};
  riskAreas.forEach(ra=>{
    const loc=ra.technical_details?.location||ra.location;
    if(!loc?.latitude)return;
    const c=levelColor(ra.risk_label);
    const r=(ra.technical_details?.risk_radius_km||2)*1000;
    L.circle([loc.latitude,loc.longitude],{radius:r,color:c,fillColor:c,fillOpacity:0.12,weight:2}).addTo(map);
    L.circleMarker([loc.latitude,loc.longitude],{radius:8,color:c,fillColor:c,fillOpacity:0.9,weight:1})
      .bindPopup('<b>'+ra.area_name+'</b><br>'+ra.risk_label+'<br>'+(ra.report_count||0)+' reports').addTo(map);
  });
  incidents.forEach(inc=>{
    if(!inc.location?.latitude)return;
    L.circleMarker([inc.location.latitude,inc.location.longitude],{radius:4,color:'#3b82f6',fillColor:'#3b82f6',fillOpacity:0.8,weight:1})
      .bindPopup('<b>'+(inc.incident_type||'incident').replace(/_/g,' ')+'</b><br>'+(inc.summary||inc.title||'')).addTo(map);
  });
</script>
</body>
</html>`;
}

export default function MapScreen() {
  const { riskAreas, incidents } = useIntel();
  const router = useRouter();

  const openDetail = useCallback((area) => {
    router.push({ pathname: "/detail", params: { areaId: area.area_name } });
  }, [router]);

  const mapHtml = buildMapHtml(riskAreas, incidents);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Risk map — Bengaluru</Text>
      </View>

      <View style={s.mapContainer}>
        {Platform.OS === "web" ? (
          <iframe srcDoc={mapHtml} style={{ width: "100%", height: "100%", border: "none" }} title="City risk map" />
        ) : (
          <WebView originWhitelist={["*"]} source={{ html: mapHtml }} style={s.webview} javaScriptEnabled domStorageEnabled />
        )}
        <View style={s.legend} pointerEvents="none">
          {[
            { label: "Critical", color: C.critical },
            { label: "High",     color: C.high     },
            { label: "Medium",   color: C.medium   },
            { label: "Report",   color: "#3b82f6"  },
          ].map(item => (
            <View key={item.label} style={s.legItem}>
              <View style={[s.legDot, { backgroundColor: item.color }]} />
              <Text style={s.legText}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView style={s.list} contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
        <Text style={s.listLabel}>Tap a card to see full details</Text>
        {riskAreas.map((area, i) => (
          <RiskCard key={i} area={area} onPress={() => openDetail(area)} />
        ))}
        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  header:       { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  title:        { fontSize: 16, fontWeight: "600", color: C.text },
  mapContainer: { height: 260, backgroundColor: "#e8f4fd", position: "relative" },
  webview:      { flex: 1 },
  legend:       { position: "absolute", bottom: 8, right: 8, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: RADIUS.sm, borderWidth: 1, borderColor: C.border, padding: SPACING.sm, flexDirection: "row", gap: SPACING.sm },
  legItem:      { flexDirection: "row", alignItems: "center", gap: 4 },
  legDot:       { width: 8, height: 8, borderRadius: 4 },
  legText:      { fontSize: 10, color: C.textMuted },
  list:         { flex: 1 },
  listContent:  { padding: SPACING.lg, paddingTop: SPACING.sm },
  listLabel:    { fontSize: 11, color: C.textDim, marginBottom: SPACING.sm },
});
