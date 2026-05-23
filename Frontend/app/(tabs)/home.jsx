import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View, Text, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, StyleSheet,
  Pressable, Platform, Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { useIntel } from "../_layout";
import SOSModal from "../../lib/components/SOSModal";
import { C, T, SPACING, RADIUS, SHADOW, riskColors } from "../../lib/constants";
import jurisdictions from "../../lib/data/jurisdictions.json";

const { height: SCREEN_H } = Dimensions.get("window");
const MAP_HEIGHT = SCREEN_H * 0.65;

const INCIDENT_EMOJIS = {
  fire: "🔥", flood: "🌊", road_accident: "🚗", medical_emergency: "🏥",
  power_outage: "⚡", infrastructure_failure: "🏗️", crowd_risk: "👥",
  hazardous_material: "☢️", rescue_required: "🆘", traffic: "🚦", other: "⚠️",
};

// Emoji map for incident pin labels
const PIN_EMOJIS = {
  fire:'🔥',flood:'🌊',road_accident:'🚗',medical_emergency:'🏥',power_outage:'⚡',
  infrastructure_failure:'🏗️',crowd_risk:'👥',hazardous_material:'☢️',rescue_required:'🆘',
  traffic:'🚦',waterlogging:'🌊',protest:'📢',other:'⚠️',
};

// Scraped news incidents for Bengaluru (simulated from Google News / Reddit)
const SCRAPED_NEWS_INCIDENTS = [
  { id:"news_1",source:"google_news",title:"Heavy rains lash Bengaluru, multiple areas waterlogged",incident_type:"flood",severity_score:0.7,urgency_level:"high",summary:"Heavy rainfall causes waterlogging in Koramangala, HSR Layout and BTM Layout areas",location:{latitude:12.9352,longitude:77.6245},jurisdiction:"Koramangala"},
  { id:"news_2",source:"times_of_india",title:"Tree falls on Outer Ring Road near Marathahalli",incident_type:"infrastructure_failure",severity_score:0.6,urgency_level:"medium",summary:"Large tree uprooted and fell on ORR near Marathahalli bridge blocking traffic",location:{latitude:12.9591,longitude:77.6974},jurisdiction:"Marathahalli"},
  { id:"news_3",source:"reddit_bangalore",title:"Gas leak reported near Electronic City Phase 1",incident_type:"hazardous_material",severity_score:0.8,urgency_level:"high",summary:"Chemical gas leak from factory in Electronic City. Residents advised to stay indoors",location:{latitude:12.8456,longitude:77.6603},jurisdiction:"Electronic City"},
  { id:"news_4",source:"ndtv",title:"Bus catches fire on Bellary Road near Hebbal flyover",incident_type:"fire",severity_score:0.75,urgency_level:"high",summary:"BMTC bus caught fire near Hebbal flyover. All passengers evacuated safely",location:{latitude:13.0358,longitude:77.5970},jurisdiction:"Hebbal"},
  { id:"news_5",source:"bangalore_mirror",title:"Major traffic jam at KR Puram due to pothole-related accident",incident_type:"road_accident",severity_score:0.55,urgency_level:"medium",summary:"Multi-vehicle accident at KR Puram railway bridge due to large pothole. 3 injured",location:{latitude:12.9988,longitude:77.6963},jurisdiction:"KR Puram"},
  { id:"news_6",source:"google_news",title:"Power outage hits Jayanagar and JP Nagar areas",incident_type:"power_outage",severity_score:0.4,urgency_level:"medium",summary:"Major power transformer failure causing blackout in Jayanagar 4th block and JP Nagar",location:{latitude:12.9250,longitude:77.5838},jurisdiction:"Jayanagar"},
  { id:"news_7",source:"reddit_bangalore",title:"Protest blocking road near Town Hall",incident_type:"crowd_risk",severity_score:0.5,urgency_level:"medium",summary:"Large protest near Town Hall blocking JC Road. Police deployed to manage crowd",location:{latitude:12.9656,longitude:77.5760},jurisdiction:"Town Hall"},
  { id:"news_8",source:"times_of_india",title:"Medical emergency at Majestic bus stand",incident_type:"medical_emergency",severity_score:0.65,urgency_level:"high",summary:"Multiple passengers fell ill after food poisoning at Majestic bus stand canteen",location:{latitude:12.9767,longitude:77.5713},jurisdiction:"Majestic"},
];

// ─── Build Leaflet map HTML with incident pins + user location + jurisdiction boundaries ───
function buildMapHtml(riskAreas, incidents, userLat, userLng) {
  const areas = JSON.stringify(riskAreas || []);
  const allIncidents = [...(incidents || []), ...SCRAPED_NEWS_INCIDENTS];
  const incs = JSON.stringify(allIncidents);
  const uLat = userLat || 12.9716;
  const uLng = userLng || 77.5946;
  const emojiMap = JSON.stringify(PIN_EMOJIS);
  const jurData = JSON.stringify(jurisdictions);
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
body,html,#map{margin:0;padding:0;width:100%;height:100%;background:#f0f4f8;}
.leaflet-container{background:#e8f4fd;}
.leaflet-popup-content-wrapper{background:#fff;color:#111827;border:1px solid #e5e7eb;border-radius:10px;font-family:system-ui;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.12);}
.leaflet-popup-tip{background:#fff;}
.user-marker{width:18px;height:18px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 6px rgba(59,130,246,0.25);}
.pin-icon{width:12px;height:12px;background:#dc2626;border-radius:50%;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);}
.pin-drop{position:relative;width:24px;height:34px;}
.pin-drop::before{content:'';position:absolute;top:0;left:4px;width:16px;height:16px;background:#dc2626;border:2.5px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35);}
.pin-drop::after{content:'';position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:12px solid #dc2626;}
.pin-tip{background:#fff;color:#111827;border:1px solid #e5e7eb;border-radius:8px;font-family:system-ui;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.15);padding:6px 10px;max-width:280px;}
.jur-tip{background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;border-radius:6px;font-family:system-ui;font-size:11px;font-weight:600;padding:4px 8px;}
</style>
</head><body>
<div id="map"></div>
<script>
const EMOJIS=${emojiMap};
const map=L.map('map',{zoomControl:false,scrollWheelZoom:false,dragging:true,tap:true,touchZoom:true,doubleClickZoom:false}).setView([${uLat},${uLng}],12);
L.control.zoom({position:'bottomright'}).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map);
// Jurisdiction boundaries
const jur=${jurData};
jur.forEach(j=>{
  if(!j.c||j.c.length<3)return;
  L.polygon(j.c,{color:'#6366f1',weight:1.5,fillColor:'transparent',fillOpacity:0,dashArray:'4 4'}).addTo(map);
});
// User location
const userIcon=L.divIcon({className:'',html:'<div class="user-marker"></div>',iconSize:[18,18],iconAnchor:[9,9]});
L.marker([${uLat},${uLng}],{icon:userIcon,zIndexOffset:1000}).addTo(map).bindTooltip('📍 You are here',{permanent:false,direction:'top',offset:[0,-12]});
// Incident pins
const COL={critical:'#dc2626',high:'#d97706',medium:'#f97316',low:'#16a34a'};
function col(l){const s=(l||'').toLowerCase();if(s.includes('critical'))return COL.critical;if(s.includes('high'))return COL.high;if(s.includes('medium'))return COL.medium;return COL.low;}
function pinIcon(){
  return L.divIcon({className:'',html:'<div class="pin-drop"></div>',iconSize:[24,34],iconAnchor:[12,34],popupAnchor:[0,-34]});
}
const areas=${areas};
const bounds=[[${uLat},${uLng}]];
areas.forEach((ra,idx)=>{
  const loc=ra.technical_details?.location||ra.location;
  if(!loc||!loc.latitude)return;
  const c=col(ra.risk_label);
  const r=(ra.technical_details?.risk_radius_km||1.5)*1000;
  L.circle([loc.latitude,loc.longitude],{radius:r,color:c,fillColor:c,fillOpacity:0.10,weight:1.5}).addTo(map);
  const icon=pinIcon();
  var pinId='area_'+idx;
  var aHtml='<b>'+ra.area_name+'</b><br><span style="color:'+c+';font-weight:700;">'+ra.risk_label+'</span><br>'+(ra.report_count||ra.incident_count||0)+' reports'+(ra.source?'<br><span style="color:#6366f1">Source: '+ra.source+'</span>':'');
  var m=L.marker([loc.latitude,loc.longitude],{icon:icon,zIndexOffset:500})
    .bindTooltip(aHtml,{direction:'top',offset:[0,-18],className:'pin-tip'})
    .bindPopup(aHtml,{maxWidth:300})
    .addTo(map);
  m.on('mouseover',function(){window.parent.postMessage(JSON.stringify({type:'pin_hover',id:pinId}),'*');});
  m.on('mouseout',function(){window.parent.postMessage(JSON.stringify({type:'pin_unhover',id:pinId}),'*');});
  bounds.push([loc.latitude,loc.longitude]);
});
const incs=${incs};
incs.forEach((inc,idx)=>{
  if(!inc.location?.latitude)return;
  const ic=L.divIcon({className:'',html:'<div class="pin-drop" style="transform:scale(0.8)"></div>',iconSize:[24,34],iconAnchor:[12,34],popupAnchor:[0,-34]});
  var src=inc.source||'';
  var srcLabel=src.replace(/_/g,' ');
  var pinId=inc.id||('inc_'+idx);
  var iHtml='<b style="text-transform:capitalize">'+(inc.incident_type||'report').replace(/_/g,' ')+'</b><br>'+(inc.summary||inc.title||'')+(src?'<br><span style="color:#6366f1;font-style:italic">'+srcLabel+'</span>':'');
  var m=L.marker([inc.location.latitude,inc.location.longitude],{icon:ic})
    .bindTooltip(iHtml,{direction:'top',offset:[0,-12],className:'pin-tip',maxWidth:280})
    .bindPopup(iHtml,{maxWidth:300}).addTo(map);
  m.on('mouseover',function(){window.parent.postMessage(JSON.stringify({type:'pin_hover',id:pinId}),'*');});
  m.on('mouseout',function(){window.parent.postMessage(JSON.stringify({type:'pin_unhover',id:pinId}),'*');});
  bounds.push([inc.location.latitude,inc.location.longitude]);
});
if(bounds.length>1)map.fitBounds(bounds,{padding:[30,30],maxZoom:14});
</script></body></html>`;
}

export default function HomeScreen() {
  const { cs, riskAreas, incidents, alerts, loading, running, loadDemo, fetchAll, runPipeline, submitReport } = useIntel();
  const router = useRouter();
  const [sosVisible, setSosVisible] = useState(false);
  const [userLat, setUserLat] = useState(null);
  const [userLng, setUserLng] = useState(null);
  const [mapInteractive, setMapInteractive] = useState(false);
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [highlightedId, setHighlightedId] = useState(null);
  const scrollRef = useRef(null);
  const iframeRef = useRef(null);
  const itemRefs = useRef({});
  const feedScrollRef = useRef(null);

  // Get user location on mount
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'web') {
          // Use browser Geolocation API for web
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                setUserLat(position.coords.latitude);
                setUserLng(position.coords.longitude);
              },
              (error) => {
                console.log("Web location error:", error);
                // Default to Bengaluru center if permission denied
                setUserLat(12.9716);
                setUserLng(77.5946);
              }
            );
          } else {
            // Fallback to Bengaluru center
            setUserLat(12.9716);
            setUserLng(77.5946);
          }
        } else {
          // Use expo-location for native
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            setUserLat(pos.coords.latitude);
            setUserLng(pos.coords.longitude);
          } else {
            // Default to Bengaluru center
            setUserLat(12.9716);
            setUserLng(77.5946);
          }
        }
      } catch (e) { 
        console.log("Location error:", e);
        // Default to Bengaluru center on error
        setUserLat(12.9716);
        setUserLng(77.5946);
      }
    })();
  }, []);

  // Auto-load ALL demo data on first mount if no data
  useEffect(() => {
    if (!loading && !demoLoaded && riskAreas.length === 0 && !running) {
      setDemoLoaded(true);
      loadDemo("all");
    }
  }, [loading, riskAreas.length, running, demoLoaded, loadDemo]);

  // Deduplicate
  const deduped = riskAreas.reduce((acc, area) => {
    const key = `${area.incident_type}|${area.area_name}`;
    if (!acc.find(a => `${a.incident_type}|${a.area_name}` === key)) acc.push(area);
    return acc;
  }, []);

  const openDetail = useCallback((area) => {
    router.push({ pathname: "/detail", params: { areaId: area.area_name } });
  }, [router]);

  // Build unified feed of ALL incidents shown on map (MUST be before early returns)
  const allMapIncidents = useMemo(() => {
    const list = [];
    // Risk area clusters
    deduped.forEach((ra, i) => {
      const loc = ra.technical_details?.location || ra.location;
      if (!loc?.latitude) return;
      list.push({ _id: 'area_' + i, _type: 'area', incident_type: ra.incident_type, title: ra.area_name, summary: ra.truth_statement || ra.what_we_know || '', risk_label: ra.risk_label, source: ra.source || '', count: ra.incident_count || ra.report_count || 1, location: loc });
    });
    // Backend incidents
    (incidents || []).forEach((inc, i) => {
      if (!inc.location?.latitude) return;
      list.push({ _id: inc.id || ('inc_' + i), _type: 'incident', incident_type: inc.incident_type, title: inc.title || (inc.incident_type || 'report').replace(/_/g, ' '), summary: inc.summary || '', risk_label: inc.urgency_level || '', source: inc.source || '', count: 1, location: inc.location });
    });
    // Scraped news
    SCRAPED_NEWS_INCIDENTS.forEach(inc => {
      list.push({ _id: inc.id, _type: 'news', incident_type: inc.incident_type, title: inc.title, summary: inc.summary, risk_label: inc.urgency_level || '', source: inc.source || '', count: 1, location: inc.location });
    });
    return list;
  }, [deduped, incidents]);

  // Listen for hover messages from map iframe (MUST be before early returns)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data.type === 'pin_hover') {
          setHighlightedId(data.id);
          // Scroll to item within feed container
          setTimeout(() => {
            const feedContainer = feedScrollRef.current;
            const el = document.getElementById('feed_' + data.id);
            if (feedContainer && el) {
              const containerRect = feedContainer.getBoundingClientRect();
              const elRect = el.getBoundingClientRect();
              const scrollTop = feedContainer.scrollTop + (elRect.top - containerRect.top) - (containerRect.height / 2) + (elRect.height / 2);
              feedContainer.scrollTo({ top: scrollTop, behavior: 'smooth' });
            }
          }, 100);
        } else if (data.type === 'pin_unhover') {
          setHighlightedId(null);
        }
      } catch (_) {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // AI summary text
  const aiSummary = deduped.length > 0
    ? (() => {
        const critical = deduped.filter(a => a.risk_label?.toLowerCase().includes("critical"));
        const high = deduped.filter(a => a.risk_label?.toLowerCase().includes("high"));
        if (critical.length > 0) return `${critical.length} critical incident${critical.length > 1 ? "s" : ""} nearby. ${critical[0].truth_statement || critical[0].what_we_know || "Immediate attention needed."}`;
        if (high.length > 0) return `${high.length} high-risk area${high.length > 1 ? "s" : ""} detected. ${high[0].truth_statement || high[0].what_we_know || "Monitor closely."}`;
        return `${deduped.length} incident${deduped.length > 1 ? "s" : ""} being monitored. No major threats detected.`;
      })()
    : null;

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.info} />
        <Text style={[T.caption, { marginTop: SPACING.md }]}>Connecting to city feeds...</Text>
      </View>
    );
  }

  const mapHtml = buildMapHtml(deduped, incidents, userLat, userLng);

  return (
    <View style={s.root}>
      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.brand}>City Samaachar</Text>
          <View style={s.liveRow}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>Live</Text>
          </View>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.headerBtn} onPress={() => { runPipeline("demo"); }} disabled={running}>
            {running ? <ActivityIndicator size={16} color={C.info} /> : <Ionicons name="refresh" size={20} color={C.info} />}
          </TouchableOpacity>
          <TouchableOpacity style={s.headerBtn} onPress={() => router.push("/report-incident")}>
            <Ionicons name="add-circle-outline" size={20} color={C.text} />
          </TouchableOpacity>
          <TouchableOpacity style={s.sosBtn} onPress={() => setSosVisible(true)}>
            <Text style={s.sosBtnText}>SOS</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={running} onRefresh={fetchAll} tintColor={C.info} />}
      >
        {/* ── AI Summary Banner ── */}
        {aiSummary && (
          <View style={s.aiBanner}>
            <Ionicons name="sparkles" size={16} color={C.infoText} />
            <Text style={s.aiBannerText} numberOfLines={3}>{aiSummary}</Text>
          </View>
        )}

        {/* ── Map ── */}
        <View style={s.mapContainer}>
          {Platform.OS === "web" ? (
            <iframe ref={iframeRef} srcDoc={mapHtml} style={{ width: "100%", height: "100%", border: "none", pointerEvents: "auto" }} title="City map" />
          ) : (
            <WebView
              originWhitelist={["*"]}
              source={{ html: mapHtml }}
              style={s.webview}
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled={false}
              nestedScrollEnabled={false}
            />
          )}
          {/* Legend overlay */}
          <View style={s.legend} pointerEvents="none">
            {[
              { label: "Critical", color: C.critical },
              { label: "High", color: C.high },
              { label: "Medium", color: C.medium },
              { label: "You", color: "#3b82f6" },
              { label: "Jurisdiction", color: "#6366f1" },
            ].map(item => (
              <View key={item.label} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: item.color }]} />
                <Text style={s.legendText}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── All Incidents Feed ── */}
        {allMapIncidents.length > 0 && (
          <View style={s.incidentsSection}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Incidents on Map</Text>
              <View style={s.badge}>
                <Text style={s.badgeText}>{allMapIncidents.length}</Text>
              </View>
            </View>

            {Platform.OS === "web" ? (
              <div ref={feedScrollRef} style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                {allMapIncidents.map((item) => (
                  <FeedItem key={item._id} item={item} highlighted={highlightedId === item._id} />
                ))}
              </div>
            ) : (
              <ScrollView style={{ maxHeight: 400 }} nestedScrollEnabled>
                {allMapIncidents.map((item) => (
                  <FeedItem key={item._id} item={item} highlighted={highlightedId === item._id} />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>

      {/* SOS Modal */}
      <SOSModal visible={sosVisible} onClose={() => setSosVisible(false)} onSubmit={submitReport} />
    </View>
  );
}

// ─── Feed Item (unified list below map) ───
function FeedItem({ item, highlighted }) {
  const emoji = INCIDENT_EMOJIS[item.incident_type?.toLowerCase()] || "⚠️";
  const srcLabel = item.source ? item.source.replace(/_/g, " ") : "";
  const urgencyColors = { critical: "#dc2626", high: "#d97706", medium: "#f97316", low: "#16a34a" };
  const urgency = (item.risk_label || "").toLowerCase();
  const uColor = urgencyColors[urgency] || "#6b7280";

  const inner = (
    <View
      style={[
        s.feedCard,
        highlighted && s.feedCardHighlighted,
      ]}
    >
      <Text style={s.feedEmoji}>{emoji}</Text>
      <View style={s.feedContent}>
        <View style={s.feedTopRow}>
          <Text style={s.feedTitle} numberOfLines={1}>{item.title || (item.incident_type || "incident").replace(/_/g, " ")}</Text>
          {item.risk_label ? (
            <View style={[s.feedBadge, { backgroundColor: uColor + "18", borderColor: uColor + "40" }]}>
              <Text style={[s.feedBadgeText, { color: uColor }]}>{item.risk_label}</Text>
            </View>
          ) : null}
        </View>
        {item.summary ? <Text style={s.feedSummary} numberOfLines={2}>{item.summary}</Text> : null}
        <View style={s.feedMeta}>
          {srcLabel ? (
            <View style={s.feedSourceTag}>
              <Ionicons name="newspaper-outline" size={10} color="#6366f1" />
              <Text style={s.feedSourceText}>{srcLabel}</Text>
            </View>
          ) : null}
          {item._type === "area" && item.count > 1 ? <Text style={s.feedMetaText}>{item.count} reports</Text> : null}
        </View>
      </View>
    </View>
  );

  if (Platform.OS === "web") {
    return <div id={'feed_' + item._id}>{inner}</div>;
  }
  return inner;
}

// ─── Styles ───
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, paddingTop: Platform.OS === "ios" ? 52 : SPACING.lg,
  },
  headerLeft: { flex: 1 },
  brand: { fontSize: 18, fontWeight: "700", color: C.text },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.safe },
  liveText: { fontSize: 11, color: C.safe, fontWeight: "600" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: C.bg,
    alignItems: "center", justifyContent: "center",
  },
  sosBtn: {
    backgroundColor: "#DC2626", borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 7,
    ...SHADOW.card,
  },
  sosBtnText: { fontSize: 13, fontWeight: "800", color: "#fff", letterSpacing: 1.2 },

  // Scroll
  scroll: { flex: 1 },

  // AI Banner
  aiBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm,
    backgroundColor: C.infoBg, borderBottomWidth: 1, borderBottomColor: C.infoBorder,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  aiBannerText: { flex: 1, fontSize: 13, color: C.infoText, lineHeight: 19 },

  // Map
  mapContainer: {
    height: MAP_HEIGHT, backgroundColor: "#e8f4fd", position: "relative",
  },
  webview: { flex: 1 },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject, zIndex: 10,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  mapOverlayBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.92)", borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md, paddingVertical: 6,
    borderWidth: 1, borderColor: C.border,
  },
  mapOverlayText: { fontSize: 12, color: C.textMuted, fontWeight: "500" },
  mapLockBtn: {
    position: "absolute", top: 8, right: 8, zIndex: 10,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.92)", borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: C.infoBorder,
  },
  mapLockText: { fontSize: 11, color: C.info, fontWeight: "600" },
  legend: {
    position: "absolute", bottom: 8, left: 8,
    backgroundColor: "rgba(255,255,255,0.92)", borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: C.border, paddingHorizontal: SPACING.sm, paddingVertical: 4,
    flexDirection: "row", gap: SPACING.md,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: C.textMuted },

  // Empty State
  emptyState: { alignItems: "center", paddingVertical: SPACING.xl * 2, gap: SPACING.sm },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: C.text },
  emptySubtext: { fontSize: 13, color: C.textMuted },
  demoBtn: {
    marginTop: SPACING.md, backgroundColor: C.infoBg, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderWidth: 1, borderColor: C.infoBorder,
  },
  demoBtnText: { fontSize: 13, fontWeight: "600", color: C.infoText },

  // Incidents Section
  incidentsSection: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.md,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: C.text },
  badge: {
    backgroundColor: C.border, borderRadius: RADIUS.pill,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  badgeText: { fontSize: 12, fontWeight: "600", color: C.textMuted },

  // Feed Item
  feedCard: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm,
    backgroundColor: C.surface, borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm, padding: SPACING.md,
    borderWidth: 2, borderColor: "transparent",
    ...SHADOW.card,
  },
  feedCardHighlighted: {
    borderColor: "#6366f1",
    backgroundColor: "#eef2ff",
  },
  feedEmoji: { fontSize: 22, marginTop: 2 },
  feedContent: { flex: 1 },
  feedTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.sm },
  feedTitle: { flex: 1, fontSize: 13, fontWeight: "700", color: C.text, textTransform: "capitalize" },
  feedBadge: {
    borderRadius: RADIUS.pill, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  feedBadgeText: { fontSize: 10, fontWeight: "700", textTransform: "capitalize" },
  feedSummary: { fontSize: 12, color: C.textSec, marginTop: 4, lineHeight: 17 },
  feedMeta: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: 6, flexWrap: "wrap" },
  feedSourceTag: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#eef2ff", borderRadius: RADIUS.pill,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  feedSourceText: { fontSize: 10, color: "#6366f1", fontWeight: "600", textTransform: "capitalize" },
  feedMetaText: { fontSize: 11, color: C.textMuted },
});
