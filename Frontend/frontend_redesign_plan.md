# City Samaachar — Frontend Redesign Implementation Plan

## Overview

The redesign replaces the single 807-line dark-mode hackathon screen with a
light-mode, phone-first 4-tab app. Every API call, every data field, every
piece of state from the original is preserved — only the rendering layer
changes. The backend is untouched.

---

## 1. File structure — what changes, what stays

```
Frontend/app/
├── _layout.jsx          ← REPLACE (add tab navigator)
├── constants.js         ← KEEP (add color constants)
├── index.jsx            ← DELETE (absorbed into tabs)
├── (tabs)/
│   ├── _layout.jsx      ← NEW (tab bar config)
│   ├── home.jsx         ← NEW (was: left column of index.jsx)
│   ├── map.jsx          ← NEW (was: center column of index.jsx)
│   ├── report.jsx       ← REPLACE (was: modal, now full screen)
│   └── teams.jsx        ← NEW (was: right column of index.jsx)
├── detail.jsx           ← NEW (risk area detail screen)
├── hooks/
│   └── useIntelligence.js  ← NEW (extract all API logic)
└── components/
    ├── RiskBand.jsx        ← NEW (the colored status banner)
    ├── RiskCard.jsx        ← NEW (individual area card)
    ├── TeamCard.jsx        ← NEW (responder assignment card)
    ├── StatGrid.jsx        ← NEW (2×2 number summary)
    └── CitizenBox.jsx      ← NEW (blue "what to do" box)
```

The `map-component.jsx`, `map-component-native.jsx.backup`,
`map-component.web.jsx.backup`, and `report.jsx` (redirect stub) are deleted.

---

## 2. Design tokens — `constants.js`

Replace the entire file with this. The existing `INCIDENT_API_URL_HOST` stays;
everything else is the new light-mode token set.

```js
// Backend API base URL — update for your deployed environment
export const INCIDENT_API_URL_HOST = "http://localhost:8080";

// ─── COLORS ──────────────────────────────────────────────────────────────────
// Standard traffic-light system. Each level has:
//   base  — the pure color for icons and text on white
//   bg    — very light tint for card backgrounds
//   border— border to pair with bg
//   text  — dark shade for text sitting ON the bg tint

export const C = {
  // Status colors — strict semantic meaning, never decorative
  critical:       "#dc2626",   // red-600
  criticalBg:     "#fef2f2",   // red-50
  criticalBorder: "#fca5a5",   // red-300
  criticalText:   "#b91c1c",   // red-700

  high:           "#d97706",   // amber-600
  highBg:         "#fffbeb",   // amber-50
  highBorder:     "#fcd34d",   // amber-300
  highText:       "#92400e",   // amber-800

  medium:         "#f97316",   // orange-500
  mediumBg:       "#fff7ed",   // orange-50
  mediumBorder:   "#fdba74",   // orange-300
  mediumText:     "#c2410c",   // orange-700

  safe:           "#16a34a",   // green-600
  safeBg:         "#f0fdf4",   // green-50
  safeBorder:     "#86efac",   // green-300
  safeText:       "#15803d",   // green-700

  info:           "#1d4ed8",   // blue-700
  infoBg:         "#eff6ff",   // blue-50
  infoBorder:     "#93c5fd",   // blue-300
  infoText:       "#1e40af",   // blue-800

  // Neutral palette — backgrounds, text, borders
  bg:             "#f9fafb",   // gray-50  (page background)
  surface:        "#ffffff",   // white    (card surface)
  border:         "#e5e7eb",   // gray-200
  borderStrong:   "#d1d5db",   // gray-300

  text:           "#111827",   // gray-900 (primary text)
  textSec:        "#374151",   // gray-700 (secondary text)
  textMuted:      "#6b7280",   // gray-500 (labels, captions)
  textDim:        "#9ca3af",   // gray-400 (placeholder, hints)

  // Nav bar active color
  navActive:      "#1d4ed8",   // blue-700
  navInactive:    "#9ca3af",   // gray-400
};

// ─── TYPOGRAPHY ──────────────────────────────────────────────────────────────
export const T = {
  heading1: { fontSize: 22, fontWeight: "700", color: C.text, letterSpacing: -0.5 },
  heading2: { fontSize: 18, fontWeight: "700", color: C.text },
  heading3: { fontSize: 16, fontWeight: "600", color: C.text },
  body:     { fontSize: 14, fontWeight: "400", color: C.textSec, lineHeight: 21 },
  caption:  { fontSize: 12, fontWeight: "400", color: C.textMuted, lineHeight: 18 },
  label:    { fontSize: 11, fontWeight: "600", color: C.textDim,
              textTransform: "uppercase", letterSpacing: 0.6 },
};

// ─── SPACING ─────────────────────────────────────────────────────────────────
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

// ─── RADIUS ──────────────────────────────────────────────────────────────────
export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
};

// ─── SHADOWS ─────────────────────────────────────────────────────────────────
// Subtle, only for cards that need lift on white bg
export const SHADOW = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
/**
 * Returns { base, bg, border, text } for a risk level string.
 * Input: "Critical Risk", "High Risk", "Medium Risk", "Low Risk",
 *        "critical", "high", "medium", "low" — case-insensitive.
 */
export function riskColors(label = "") {
  const s = label.toLowerCase();
  if (s.includes("critical")) return {
    base: C.critical, bg: C.criticalBg,
    border: C.criticalBorder, text: C.criticalText
  };
  if (s.includes("high")) return {
    base: C.high, bg: C.highBg,
    border: C.highBorder, text: C.highText
  };
  if (s.includes("medium") || s.includes("moderate")) return {
    base: C.medium, bg: C.mediumBg,
    border: C.mediumBorder, text: C.mediumText
  };
  return {
    base: C.safe, bg: C.safeBg,
    border: C.safeBorder, text: C.safeText
  };
}
```

---

## 3. Data layer — `hooks/useIntelligence.js`

Extract all API logic from `index.jsx` into one shared hook. Every tab imports
this; none of them do their own fetching.

```js
import { useState, useCallback, useEffect, useRef } from "react";
import { INCIDENT_API_URL_HOST } from "../constants";

const API = INCIDENT_API_URL_HOST;

/**
 * Single source of truth for all backend data.
 * Import in the tab _layout so state is shared across tabs.
 * Returns the same shape the original index.jsx destructured from intel/
 * incidents/dataSources.
 */
export function useIntelligence() {
  const [intel, setIntel]           = useState(null);
  const [incidents, setIncidents]   = useState([]);
  const [dataSources, setDataSources] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [running, setRunning]       = useState(false);
  const [timeline, setTimeline]     = useState([]);

  // ─── fetch all ────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [intR, incR, srcR] = await Promise.all([
        fetch(`${API}/intelligence`).then(r => r.json()).catch(() => null),
        fetch(`${API}/incidents`).then(r => r.json()).catch(() => ({ incidents: [] })),
        fetch(`${API}/data/source-status`).then(r => r.json()).catch(() => ({ sources: [] })),
      ]);
      if (intR)  setIntel(intR);
      setIncidents(incR?.incidents || []);
      setDataSources(srcR?.sources || []);
    } catch (e) {
      console.error("fetchAll error:", e);
    }
  }, []);

  // ─── initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchAll();
      setLoading(false);
      addTimeline("System connected — monitoring city feeds", "info");
    })();
  }, [fetchAll]);

  // ─── auto-refresh every 60 s ──────────────────────────────────────────────
  const refreshRef = useRef(null);
  useEffect(() => {
    refreshRef.current = setInterval(fetchAll, 60_000);
    return () => clearInterval(refreshRef.current);
  }, [fetchAll]);

  // ─── timeline helper ──────────────────────────────────────────────────────
  const addTimeline = useCallback((text, level = "info") => {
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2,"0")}:`
            + `${String(now.getMinutes()).padStart(2,"0")}`;
    setTimeline(prev =>
      [{ id: Date.now(), t, text, level }, ...prev].slice(0, 30)
    );
  }, []);

  // ─── pipeline runner ──────────────────────────────────────────────────────
  const runPipeline = useCallback(async (mode = "demo") => {
    setRunning(true);
    addTimeline(`Running ${mode} pipeline...`, "info");
    try {
      await fetch(`${API}/pipeline/run?source_mode=${mode}`, { method: "POST" });
      addTimeline("Analysis complete", "safe");
      await fetchAll();
    } catch (e) {
      addTimeline("Pipeline error — check connection", "critical");
    } finally {
      setRunning(false);
    }
  }, [fetchAll, addTimeline]);

  // ─── load demo scenario ───────────────────────────────────────────────────
  const loadDemo = useCallback(async (scenario = "all") => {
    setRunning(true);
    addTimeline(`Loading demo: ${scenario}...`, "info");
    try {
      await fetch(`${API}/demo/scenario/${scenario}`, { method: "POST" });
      await fetchAll();
      addTimeline("Demo loaded", "safe");
    } catch (e) {
      addTimeline("Demo load failed", "critical");
    } finally {
      setRunning(false);
    }
  }, [fetchAll, addTimeline]);

  // ─── trigger dispatch ─────────────────────────────────────────────────────
  const triggerDispatch = useCallback(async () => {
    addTimeline("Encrypting dispatch messages...", "info");
    try {
      await fetch(`${API}/dispatch`, { method: "POST" });
      addTimeline("Secure dispatches sent to responders", "safe");
      await fetchAll();
    } catch (e) {
      addTimeline("Dispatch error", "critical");
    }
  }, [fetchAll, addTimeline]);

  // ─── submit citizen report ────────────────────────────────────────────────
  const submitReport = useCallback(async ({ text, lat, lng, imageUri }) => {
    const form = new FormData();
    form.append("text", text);
    if (lat != null) form.append("latitude",  String(lat));
    if (lng != null) form.append("longitude", String(lng));
    if (imageUri) {
      const ext  = imageUri.split(".").pop() || "jpg";
      const type = `image/${ext === "jpg" ? "jpeg" : ext}`;
      form.append("image", { uri: imageUri, name: `photo.${ext}`, type });
    }
    const res = await fetch(`${API}/report`, { method: "POST", body: form });
    const r   = await res.json();
    addTimeline("Emergency report submitted", "critical");
    await fetchAll();
    return r;
  }, [fetchAll, addTimeline]);

  // ─── convenience destructures (same fields original index.jsx used) ───────
  const cs       = intel?.city_status        || {};
  const brief    = intel?.ai_command_brief   || {};
  const riskAreas = intel?.risk_areas        || [];
  const respPlan  = intel?.response_plan     || [];
  const secComm   = intel?.secure_communication || {};
  const alerts    = intel?.predictive_alerts || [];
  const tech      = intel?.technical_layer   || {};

  return {
    // raw state
    intel, incidents, dataSources, loading, running, timeline,
    // destructured for convenience
    cs, brief, riskAreas, respPlan, secComm, alerts, tech,
    // actions
    fetchAll, runPipeline, loadDemo, triggerDispatch, submitReport, addTimeline,
  };
}
```

---

## 4. Root layout — `_layout.jsx`

Replace the current single-screen Stack with a provider that passes the hook
state down via React context, plus a Stack so the detail screen can push on
top of the tabs.

```jsx
import React, { createContext, useContext } from "react";
import { Stack }    from "expo-router";
import { View }     from "react-native";
import { StatusBar } from "expo-status-bar";
import { useIntelligence } from "./hooks/useIntelligence";
import { C }        from "./constants";

// ─── Context ─────────────────────────────────────────────────────────────────
export const IntelContext = createContext(null);
export const useIntel = () => useContext(IntelContext);

// ─── Root Layout ─────────────────────────────────────────────────────────────
export default function RootLayout() {
  const intel = useIntelligence();   // one instance, shared everywhere

  return (
    <IntelContext.Provider value={intel}>
      <StatusBar style="dark" backgroundColor={C.bg} />
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: C.bg },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="detail"
            options={{
              presentation: "card",
              animation: "slide_from_right",
            }}
          />
        </Stack>
      </View>
    </IntelContext.Provider>
  );
}
```

---

## 5. Tab navigator — `(tabs)/_layout.jsx`

```jsx
import React             from "react";
import { Tabs }          from "expo-router";
import { Ionicons }      from "@expo/vector-icons";
import { Platform }      from "react-native";
import { C, RADIUS }     from "../constants";

const TAB_ICON = {
  home:   { active: "home",         inactive: "home-outline"        },
  map:    { active: "map",          inactive: "map-outline"          },
  report: { active: "alert-circle", inactive: "alert-circle-outline" },
  teams:  { active: "shield",       inactive: "shield-outline"       },
};

function icon(name) {
  return ({ focused, color, size }) => {
    const n = focused ? TAB_ICON[name].active : TAB_ICON[name].inactive;
    return <Ionicons name={n} size={size} color={color} />;
  };
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   C.navActive,
        tabBarInactiveTintColor: C.navInactive,
        tabBarStyle: {
          backgroundColor:  C.surface,
          borderTopColor:   C.border,
          borderTopWidth:   1,
          height:           Platform.OS === "ios" ? 82 : 64,
          paddingBottom:    Platform.OS === "ios" ? 24 : 8,
          paddingTop:       8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen name="home"   options={{ title: "Home",   tabBarIcon: icon("home")   }} />
      <Tabs.Screen name="map"    options={{ title: "Map",    tabBarIcon: icon("map")    }} />
      <Tabs.Screen name="report" options={{ title: "Report", tabBarIcon: icon("report") }} />
      <Tabs.Screen name="teams"  options={{ title: "Teams",  tabBarIcon: icon("teams")  }} />
    </Tabs>
  );
}
```

---

## 6. Shared components — `components/`

### 6.1 `RiskBand.jsx`

The colored banner at the top of Home and Detail screens.

```jsx
import React      from "react";
import { View, Text, StyleSheet } from "react-native";
import { riskColors, C, RADIUS, SPACING } from "../constants";

/**
 * Props:
 *   riskLabel    string   e.g. "Critical Risk"
 *   summary      string   1-2 sentence plain description
 *   citizenAction string  what the citizen should do
 */
export default function RiskBand({ riskLabel = "Minimal Risk", summary, citizenAction }) {
  const col = riskColors(riskLabel);

  return (
    <View style={[s.band, { backgroundColor: col.bg, borderColor: col.border }]}>
      <Text style={[s.label, { color: col.text }]}>{riskLabel}</Text>
      {summary ? <Text style={[s.summary, { color: col.text }]}>{summary}</Text> : null}
      {citizenAction ? (
        <View style={s.actionBox}>
          <Text style={s.actionPrefix}>What to do: </Text>
          <Text style={s.actionText}>{citizenAction}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  band: {
    borderRadius:   RADIUS.lg,
    borderWidth:    1.5,
    padding:        SPACING.lg,
    marginBottom:   SPACING.md,
  },
  label: {
    fontSize:   22,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  summary: {
    fontSize:   13,
    lineHeight: 19,
    marginBottom: 6,
  },
  actionBox: {
    flexDirection:  "row",
    flexWrap:       "wrap",
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius:   RADIUS.sm,
    padding:        SPACING.sm,
    marginTop:      4,
  },
  actionPrefix: { fontSize: 12, fontWeight: "700", color: C.text },
  actionText:   { fontSize: 12, flex: 1,           color: C.textSec },
});
```

### 6.2 `StatGrid.jsx`

2×2 summary numbers at the top of Home.

```jsx
import React  from "react";
import { View, Text, StyleSheet } from "react-native";
import { C, RADIUS, SPACING, SHADOW } from "../constants";

/**
 * Props:
 *   stats  Array<{ num: string|number, label: string, color?: string }>
 *          Supply exactly 4 items.
 */
export default function StatGrid({ stats = [] }) {
  return (
    <View style={s.grid}>
      {stats.map((item, i) => (
        <View key={i} style={s.card}>
          <Text style={[s.num, item.color && { color: item.color }]}>
            {item.num}
          </Text>
          <Text style={s.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  grid: {
    flexDirection:  "row",
    flexWrap:       "wrap",
    gap:            SPACING.sm,
    marginBottom:   SPACING.md,
  },
  card: {
    flex:            1,
    minWidth:        "46%",
    backgroundColor: C.surface,
    borderRadius:    RADIUS.md,
    padding:         SPACING.md,
    ...SHADOW.card,
  },
  num: {
    fontSize:   22,
    fontWeight: "700",
    color:      C.text,
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
    color:    C.textMuted,
    fontWeight: "500",
  },
});
```

### 6.3 `RiskCard.jsx`

A single tappable risk area card used on Home and Map.

```jsx
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { riskColors, C, RADIUS, SPACING, SHADOW } from "../constants";

/**
 * Props:
 *   area        object  — one item from intel.risk_areas
 *   onPress     fn
 */
export default function RiskCard({ area, onPress }) {
  const col = riskColors(area.risk_label);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.card, pressed && s.pressed]}
      android_ripple={{ color: col.bg }}
    >
      <View style={s.row}>
        <View style={[s.dot, { backgroundColor: col.base }]} />
        <Text style={s.name} numberOfLines={1}>{area.area_name}</Text>
        <View style={[s.badge, { backgroundColor: col.bg, borderColor: col.border }]}>
          <Text style={[s.badgeText, { color: col.text }]}>{area.risk_label}</Text>
        </View>
      </View>
      <Text style={s.desc} numberOfLines={2}>{area.what_we_know}</Text>
      {area.recommended_action ? (
        <View style={[s.action, { backgroundColor: col.bg }]}>
          <Text style={[s.actionText, { color: col.text }]} numberOfLines={2}>
            {area.recommended_action}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius:    RADIUS.lg,
    padding:         SPACING.md,
    marginBottom:    SPACING.sm,
    ...SHADOW.card,
  },
  pressed: { opacity: 0.85 },
  row: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            SPACING.sm,
    marginBottom:   6,
  },
  dot: {
    width: 8, height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  name: {
    fontSize:   14,
    fontWeight: "600",
    color:      C.text,
    flex:       1,
  },
  badge: {
    borderRadius: RADIUS.pill,
    borderWidth:  1,
    paddingHorizontal: 8,
    paddingVertical:   2,
  },
  badgeText: { fontSize: 11, fontWeight: "600" },
  desc:      { fontSize: 12, color: C.textSec, lineHeight: 18, marginBottom: 6 },
  action: {
    borderRadius: RADIUS.sm,
    padding:      SPACING.sm,
  },
  actionText: { fontSize: 11, lineHeight: 16 },
});
```

### 6.4 `TeamCard.jsx`

One dispatched responder card used on Teams.

```jsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { C, RADIUS, SPACING, SHADOW } from "../constants";

/**
 * Props:
 *   team   object  — one item from intel.response_plan
 */
export default function TeamCard({ team }) {
  return (
    <View style={s.card}>
      <View style={s.header}>
        <Text style={s.name}>{team.team_name}</Text>
        <View style={s.etaPill}>
          <Text style={s.etaText}>ETA {Math.round(team.eta_minutes)} min</Text>
        </View>
      </View>
      <DetailRow label="Going to"    value={team.assigned_to}   />
      <DetailRow label="Why chosen"  value={team.why_this_team} />
      <View style={s.optNote}>
        <Text style={s.optText}>{team.optimization}</Text>
      </View>
    </View>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}: </Text>
      <Text style={s.detailValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius:    RADIUS.lg,
    padding:         SPACING.md,
    marginBottom:    SPACING.sm,
    ...SHADOW.card,
  },
  header: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
    marginBottom:    SPACING.sm,
  },
  name: { fontSize: 14, fontWeight: "600", color: C.text, flex: 1 },
  etaPill: {
    backgroundColor: C.safeBg,
    borderColor:     C.safeBorder,
    borderWidth:     1,
    borderRadius:    RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical:    3,
  },
  etaText: { fontSize: 11, fontWeight: "600", color: C.safeText },
  detailRow: {
    flexDirection: "row",
    flexWrap:      "wrap",
    marginBottom:  4,
  },
  detailLabel: { fontSize: 12, fontWeight: "600", color: C.textSec },
  detailValue: { fontSize: 12, color: C.textMuted, flex: 1 },
  optNote: {
    marginTop:       6,
    backgroundColor: C.safeBg,
    borderRadius:    RADIUS.sm,
    padding:         SPACING.sm,
  },
  optText: { fontSize: 11, color: C.safeText },
});
```

### 6.5 `CitizenBox.jsx`

The blue "what you should do" information box.

```jsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, RADIUS, SPACING } from "../constants";

export default function CitizenBox({ text, style }) {
  if (!text) return null;
  return (
    <View style={[s.box, style]}>
      <Ionicons name="information-circle-outline" size={16} color={C.info} />
      <Text style={s.text}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    flexDirection:   "row",
    alignItems:      "flex-start",
    gap:             SPACING.sm,
    backgroundColor: C.infoBg,
    borderRadius:    RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: C.info,
    borderRadius:    0,
    borderTopRightRadius: RADIUS.md,
    borderBottomRightRadius: RADIUS.md,
    padding:         SPACING.md,
    marginBottom:    SPACING.md,
  },
  text: { flex: 1, fontSize: 13, color: C.infoText, lineHeight: 19 },
});
```

---

## 7. Home screen — `(tabs)/home.jsx`

```jsx
import React, { useCallback }   from "react";
import {
  View, Text, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, StyleSheet,
} from "react-native";
import { useRouter }    from "expo-router";
import { Ionicons }     from "@expo/vector-icons";
import { useIntel }     from "../_layout";
import RiskBand         from "../components/RiskBand";
import StatGrid         from "../components/StatGrid";
import RiskCard         from "../components/RiskCard";
import CitizenBox       from "../components/CitizenBox";
import { C, T, SPACING, RADIUS, riskColors } from "../constants";

export default function HomeScreen() {
  const {
    cs, riskAreas, alerts, loading, running,
    loadDemo, fetchAll,
  } = useIntel();

  const router = useRouter();

  // Derive the four stats for the grid
  const stats = [
    { num: cs.risk_areas_found  ?? 0,   label: "risk areas",       color: C.critical },
    { num: cs.reports_analyzed  ?? 0,   label: "reports analyzed", color: C.info     },
    { num: cs.teams_assigned    ?? 0,   label: "teams assigned",   color: C.safe     },
    { num: cs.people_affected   ?? "—", label: "people affected",  color: C.high     },
  ];

  const openDetail = useCallback((area) => {
    router.push({ pathname: "/detail", params: { areaId: area.area_name } });
  }, [router]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.info} />
        <Text style={[T.caption, { marginTop: SPACING.md }]}>
          Connecting to city feeds...
        </Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* ─── Header ──────────────────────────────────────── */}
      <View style={s.header}>
        <View>
          <Text style={s.brand}>City Samaachar</Text>
          <Text style={s.brandSub}>Bengaluru emergency updates</Text>
        </View>
        <TouchableOpacity
          style={s.refreshBtn}
          onPress={fetchAll}
          disabled={running}
        >
          {running
            ? <ActivityIndicator size="small" color={C.info} />
            : <Ionicons name="refresh-outline" size={20} color={C.info} />
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={running}
            onRefresh={fetchAll}
            tintColor={C.info}
          />
        }
      >
        {/* ─── Status band ─────────────────────────────── */}
        <RiskBand
          riskLabel={cs.risk_label || "Minimal Risk"}
          summary={cs.plain_summary}
          citizenAction={cs.what_citizens_should_do}
        />

        {/* ─── Stats ───────────────────────────────────── */}
        <StatGrid stats={stats} />

        {/* ─── Predictive alerts (if any) ──────────────── */}
        {alerts.map((a, i) => (
          <View
            key={i}
            style={[s.alertCard, { borderColor: C.criticalBorder }]}
          >
            <View style={s.alertHeader}>
              <Ionicons name="warning-outline" size={16} color={C.critical} />
              <Text style={s.alertTitle}>{a.title}</Text>
              <View style={[s.confPill, { backgroundColor: C.criticalBg }]}>
                <Text style={[s.confText, { color: C.criticalText }]}>
                  {a.confidence}% likely
                </Text>
              </View>
            </View>
            <Text style={s.alertDesc}>{a.description}</Text>
          </View>
        ))}

        {/* ─── Active risk areas ───────────────────────── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Active risk areas</Text>
          <View style={s.countBadge}>
            <Text style={s.countText}>{riskAreas.length}</Text>
          </View>
        </View>

        {riskAreas.length === 0 ? (
          <EmptyState
            icon="checkmark-circle-outline"
            color={C.safe}
            message="No active risk areas. The city is currently calm."
            onDemo={() => loadDemo("all")}
            running={running}
          />
        ) : (
          riskAreas.map((area, i) => (
            <RiskCard
              key={i}
              area={area}
              onPress={() => openDetail(area)}
            />
          ))
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </View>
  );
}

function EmptyState({ icon, color, message, onDemo, running }) {
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={36} color={color} />
      <Text style={s.emptyText}>{message}</Text>
      <TouchableOpacity
        style={s.demoBtn}
        onPress={onDemo}
        disabled={running}
      >
        {running
          ? <ActivityIndicator size="small" color={C.info} />
          : <Text style={s.demoBtnText}>Load demo data</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg },
  center:     { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.md,
  },
  brand:    { fontSize: 18, fontWeight: "700", color: C.text },
  brandSub: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  refreshBtn: { padding: SPACING.sm },
  scroll:   { flex: 1 },
  content:  { padding: SPACING.lg },
  sectionHeader: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            SPACING.sm,
    marginBottom:   SPACING.sm,
    marginTop:      SPACING.sm,
  },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: C.text },
  countBadge: {
    backgroundColor: C.border,
    borderRadius:    RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical:   2,
  },
  countText: { fontSize: 11, fontWeight: "600", color: C.textMuted },
  alertCard: {
    backgroundColor: C.criticalBg,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    padding:         SPACING.md,
    marginBottom:    SPACING.sm,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           SPACING.sm,
    marginBottom:  6,
  },
  alertTitle: { fontSize: 13, fontWeight: "600", color: C.criticalText, flex: 1 },
  confPill: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  confText:  { fontSize: 10, fontWeight: "600", color: C.criticalText },
  alertDesc: { fontSize: 12, color: C.criticalText, lineHeight: 18 },
  empty: {
    alignItems:   "center",
    paddingVertical: SPACING.xl,
    gap:          SPACING.md,
  },
  emptyText:  { ...T.body, textAlign: "center", color: C.textMuted },
  demoBtn: {
    backgroundColor: C.infoBg,
    borderRadius:    RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.sm,
    borderWidth:     1,
    borderColor:     C.infoBorder,
    minWidth:        140,
    alignItems:      "center",
  },
  demoBtnText: { fontSize: 13, fontWeight: "600", color: C.infoText },
});
```

---

## 8. Map screen — `(tabs)/map.jsx`

```jsx
import React, { useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Platform,
} from "react-native";
import { useRouter }   from "expo-router";
import { WebView }     from "react-native-webview";
import { useIntel }    from "../_layout";
import RiskCard        from "../components/RiskCard";
import { C, SPACING, RADIUS, SHADOW, riskColors } from "../constants";

// Build the Leaflet HTML for the map in WebView / iframe
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
    .leaflet-popup-content-wrapper{
      background:#fff;color:#111827;border:1px solid #e5e7eb;
      border-radius:8px;font-family:system-ui,sans-serif;font-size:12px;
    }
    .leaflet-popup-tip{background:#fff;}
  </style>
</head>
<body>
<div id="map"></div>
<script>
  const map = L.map('map',{zoomControl:true}).setView([12.95,77.62],12);
  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {attribution:'&copy; CARTO',maxZoom:20}
  ).addTo(map);

  const COLORS = {
    critical:'#dc2626', high:'#d97706', medium:'#f97316', safe:'#16a34a'
  };
  function levelColor(label=''){
    const s=label.toLowerCase();
    if(s.includes('critical')) return COLORS.critical;
    if(s.includes('high'))     return COLORS.high;
    if(s.includes('medium'))   return COLORS.medium;
    return COLORS.safe;
  }

  const riskAreas = ${areas};
  const incidents = ${incs};

  // Risk area circles
  riskAreas.forEach(ra=>{
    const loc = ra.technical_details?.location || ra.location;
    if(!loc?.latitude) return;
    const c = levelColor(ra.risk_label);
    const r = (ra.technical_details?.risk_radius_km||2) * 1000;
    L.circle([loc.latitude,loc.longitude],{
      radius:r, color:c, fillColor:c, fillOpacity:0.12, weight:2
    }).addTo(map);
    L.circleMarker([loc.latitude,loc.longitude],{
      radius:8, color:c, fillColor:c, fillOpacity:0.9, weight:1
    }).bindPopup('<b>'+ra.area_name+'</b><br>'+ra.risk_label+'<br>'+ra.report_count+' reports')
    .addTo(map);
  });

  // Incident dots
  incidents.forEach(inc=>{
    if(!inc.location?.latitude) return;
    L.circleMarker([inc.location.latitude,inc.location.longitude],{
      radius:4, color:'#3b82f6', fillColor:'#3b82f6', fillOpacity:0.8, weight:1
    }).bindPopup('<b>'+(inc.incident_type||'incident').replace(/_/g,' ')+'</b><br>'+(inc.summary||inc.title||''))
    .addTo(map);
  });
</script>
</body>
</html>`;
}

export default function MapScreen() {
  const { riskAreas, incidents } = useIntel();
  const router  = useRouter();

  const openDetail = useCallback((area) => {
    router.push({ pathname: "/detail", params: { areaId: area.area_name } });
  }, [router]);

  const mapHtml = buildMapHtml(riskAreas, incidents);

  return (
    <View style={s.root}>
      {/* ─── Header ──────────────────────────────────────── */}
      <View style={s.header}>
        <Text style={s.title}>Risk map — Bengaluru</Text>
      </View>

      {/* ─── Map ─────────────────────────────────────────── */}
      <View style={s.mapContainer}>
        {Platform.OS === "web" ? (
          <iframe
            srcDoc={mapHtml}
            style={{ width: "100%", height: "100%", border: "none" }}
            title="City risk map"
          />
        ) : (
          <WebView
            originWhitelist={["*"]}
            source={{ html: mapHtml }}
            style={s.webview}
            javaScriptEnabled
            domStorageEnabled
          />
        )}
        {/* ─── Legend overlay ──────────────────────────── */}
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

      {/* ─── List below map ──────────────────────────────── */}
      <ScrollView
        style={s.list}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
      >
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
  root:        { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.md,
  },
  title:       { fontSize: 16, fontWeight: "600", color: C.text },
  mapContainer:{
    height:          260,
    backgroundColor: "#e8f4fd",
    position:        "relative",
  },
  webview:     { flex: 1 },
  legend: {
    position:        "absolute",
    bottom:          8,
    right:           8,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius:    RADIUS.sm,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         SPACING.sm,
    flexDirection:   "row",
    gap:             SPACING.sm,
  },
  legItem:     { flexDirection: "row", alignItems: "center", gap: 4 },
  legDot:      { width: 8, height: 8, borderRadius: 4 },
  legText:     { fontSize: 10, color: C.textMuted },
  list:        { flex: 1 },
  listContent: { padding: SPACING.lg, paddingTop: SPACING.sm },
  listLabel:   { fontSize: 11, color: C.textDim, marginBottom: SPACING.sm },
});
```

---

## 9. Report screen — `(tabs)/report.jsx`

Replaces the modal. Full-screen form with location, categories, photo attachment.

```jsx
import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Platform,
} from "react-native";
import { Ionicons }       from "@expo/vector-icons";
import * as Location      from "expo-location";
import * as ImagePicker   from "expo-image-picker";
import { useIntel }       from "../_layout";
import { C, T, SPACING, RADIUS, SHADOW, riskColors } from "../constants";

const CATEGORIES = [
  { id: "fire",                  label: "Fire",      icon: "flame-outline"          },
  { id: "flood",                 label: "Flood",     icon: "water-outline"          },
  { id: "road_accident",         label: "Accident",  icon: "car-outline"            },
  { id: "medical_emergency",     label: "Medical",   icon: "medkit-outline"         },
  { id: "power_outage",          label: "Power out", icon: "flash-off-outline"      },
  { id: "infrastructure_failure",label: "Collapse",  icon: "business-outline"       },
  { id: "crowd_risk",            label: "Crowd",     icon: "people-outline"         },
  { id: "hazardous_material",    label: "Hazmat",    icon: "warning-outline"        },
  { id: "rescue_required",       label: "Rescue",    icon: "hand-left-outline"      },
];

export default function ReportScreen() {
  const { submitReport } = useIntel();

  const [desc,        setDesc]        = useState("");
  const [category,    setCategory]    = useState(null);
  const [location,    setLocation]    = useState(null);
  const [imageUri,    setImageUri]    = useState(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [result,      setResult]      = useState(null);

  const canSubmit = desc.trim().length > 5 && category !== null && !submitting;

  // ─── Get GPS location ──────────────────────────────────────────────────────
  const getLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Location needed",
        "Allow location access so your report reaches the right response team."
      );
      return;
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
  }, []);

  // ─── Pick photo ────────────────────────────────────────────────────────────
  const pickPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality:    0.7,
    });
    if (!res.canceled && res.assets?.[0]) {
      setImageUri(res.assets[0].uri);
    }
  }, []);

  // ─── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const r = await submitReport({
        text:     category ? `[${category}] ${desc}` : desc,
        lat:      location?.lat,
        lng:      location?.lng,
        imageUri: imageUri,
      });
      setResult(r);
      setDesc(""); setCategory(null); setLocation(null); setImageUri(null);
    } catch (e) {
      Alert.alert("Error", "Could not submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, submitReport, category, desc, location, imageUri]);

  const resetForm = useCallback(() => { setResult(null); }, []);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Report an emergency</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── 112 callout ─────────────────────────────────── */}
        <View style={s.emergencyCallout}>
          <Ionicons name="call-outline" size={16} color={C.criticalText} />
          <Text style={s.calloutText}>
            For life-threatening emergencies call <Text style={{ fontWeight: "700" }}>112</Text> immediately.
          </Text>
        </View>

        {/* ─── Result card (shown after submit) ────────────── */}
        {result && (
          <ResultCard result={result} onDismiss={resetForm} />
        )}

        {/* ─── Category grid ───────────────────────────────── */}
        <Text style={s.fieldLabel}>What type of emergency?</Text>
        <View style={s.catGrid}>
          {CATEGORIES.map(cat => {
            const active = category === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[s.catChip, active && s.catChipActive]}
                onPress={() => setCategory(cat.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={cat.icon}
                  size={22}
                  color={active ? C.info : C.textDim}
                />
                <Text style={[s.catLabel, active && s.catLabelActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ─── Description ─────────────────────────────────── */}
        <Text style={s.fieldLabel}>Describe what you see</Text>
        <TextInput
          style={s.textArea}
          placeholder="Example: Large fire near warehouse on 27th Main, HSR Layout. Black smoke visible. No one trapped inside."
          placeholderTextColor={C.textDim}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          value={desc}
          onChangeText={setDesc}
          returnKeyType="done"
          blurOnSubmit
        />

        {/* ─── Location + Photo ─────────────────────────────── */}
        <View style={s.attachRow}>
          <TouchableOpacity
            style={[s.attachBtn, location && s.attachBtnActive]}
            onPress={getLocation}
          >
            <Ionicons
              name={location ? "location" : "location-outline"}
              size={16}
              color={location ? C.info : C.textMuted}
            />
            <Text style={[s.attachText, location && { color: C.infoText }]}>
              {location ? "Location added" : "Add location"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.attachBtn, imageUri && s.attachBtnActive]}
            onPress={pickPhoto}
          >
            <Ionicons
              name={imageUri ? "image" : "image-outline"}
              size={16}
              color={imageUri ? C.info : C.textMuted}
            />
            <Text style={[s.attachText, imageUri && { color: C.infoText }]}>
              {imageUri ? "Photo added" : "Add photo"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── Submit button ────────────────────────────────── */}
        <TouchableOpacity
          style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="send-outline" size={18} color="#fff" />
          }
          <Text style={s.submitText}>
            {submitting ? "Analyzing..." : "Submit report"}
          </Text>
        </TouchableOpacity>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </View>
  );
}

function ResultCard({ result, onDismiss }) {
  const inc     = result?.incident || {};
  const qml     = result?.qml_prediction || {};
  const itype   = (inc.incident_type || "").replace(/_/g, " ");
  const sevPct  = Math.round((inc.severity_score || 0) * 100);

  return (
    <View style={s.resultCard}>
      <View style={s.resultHeader}>
        <View style={s.resultIcon}>
          <Ionicons name="checkmark-circle-outline" size={20} color={C.safeText} />
        </View>
        <Text style={s.resultTitle}>Report received</Text>
        <TouchableOpacity onPress={onDismiss}>
          <Ionicons name="close-outline" size={20} color={C.textMuted} />
        </TouchableOpacity>
      </View>
      {itype ? (
        <Text style={s.resultLine}>
          AI identified: <Text style={s.resultBold}>{itype}</Text>
          {"  "}Severity: <Text style={s.resultBold}>{sevPct}%</Text>
        </Text>
      ) : null}
      {inc.summary ? <Text style={s.resultBody}>{inc.summary}</Text> : null}
      {qml.risk_score != null ? (
        <Text style={s.resultLine}>
          Risk score: <Text style={s.resultBold}>
            {Math.round(qml.risk_score * 100)}%
          </Text>{" — "}{(qml.risk_label || "").replace(/_/g, " ")}
        </Text>
      ) : null}
      {result?.secure_dispatch_ready ? (
        <Text style={s.resultSafe}>Nearest team dispatched</Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.md,
  },
  title:   { fontSize: 16, fontWeight: "600", color: C.text },
  scroll:  { flex: 1 },
  content: { padding: SPACING.lg },
  emergencyCallout: {
    flexDirection:   "row",
    alignItems:      "flex-start",
    gap:             SPACING.sm,
    backgroundColor: C.criticalBg,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     C.criticalBorder,
    padding:         SPACING.md,
    marginBottom:    SPACING.lg,
  },
  calloutText: { flex: 1, fontSize: 13, color: C.criticalText, lineHeight: 19 },
  fieldLabel:  { ...T.label, marginBottom: SPACING.sm, marginTop: SPACING.md },
  catGrid: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           SPACING.sm,
    marginBottom:  SPACING.md,
  },
  catChip: {
    width:           "30%",
    backgroundColor: C.surface,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     C.border,
    paddingVertical: SPACING.md,
    alignItems:      "center",
    gap:             SPACING.xs,
  },
  catChipActive: {
    borderColor:     C.infoBorder,
    backgroundColor: C.infoBg,
  },
  catLabel:       { fontSize: 10, fontWeight: "500", color: C.textDim },
  catLabelActive: { color: C.infoText },
  textArea: {
    backgroundColor: C.surface,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         SPACING.md,
    fontSize:        14,
    color:           C.text,
    minHeight:       96,
    marginBottom:    SPACING.md,
  },
  attachRow: {
    flexDirection:  "row",
    gap:            SPACING.sm,
    marginBottom:   SPACING.md,
  },
  attachBtn: {
    flex:            1,
    flexDirection:   "row",
    alignItems:      "center",
    gap:             SPACING.xs,
    backgroundColor: C.surface,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         SPACING.sm,
    justifyContent:  "center",
  },
  attachBtnActive: { borderColor: C.infoBorder, backgroundColor: C.infoBg },
  attachText:      { fontSize: 12, color: C.textMuted, fontWeight: "500" },
  submitBtn: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            SPACING.sm,
    backgroundColor:C.info,
    borderRadius:   RADIUS.md,
    paddingVertical: SPACING.md,
  },
  submitBtnDisabled: { backgroundColor: C.textDim },
  submitText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  resultCard: {
    backgroundColor: C.safeBg,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     C.safeBorder,
    padding:         SPACING.md,
    marginBottom:    SPACING.lg,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           SPACING.sm,
    marginBottom:  SPACING.sm,
  },
  resultIcon:  { /* just the ionicons */ },
  resultTitle: { fontSize: 15, fontWeight: "700", color: C.safeText, flex: 1 },
  resultLine:  { fontSize: 13, color: C.textSec, marginBottom: 3 },
  resultBold:  { fontWeight: "700", color: C.text },
  resultBody:  { fontSize: 12, color: C.textSec, lineHeight: 18, marginBottom: 4 },
  resultSafe:  { fontSize: 12, color: C.safeText, fontWeight: "600", marginTop: 4 },
});
```

---

## 10. Teams screen — `(tabs)/teams.jsx`

```jsx
import React from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from "react-native";
import { Ionicons }   from "@expo/vector-icons";
import { useIntel }   from "../_layout";
import TeamCard       from "../components/TeamCard";
import { C, T, SPACING, RADIUS, SHADOW } from "../constants";

export default function TeamsScreen() {
  const { respPlan, secComm, running, triggerDispatch, fetchAll } = useIntel();

  const dispatched = secComm?.dispatches_sent || 0;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Response teams</Text>
        <TouchableOpacity style={s.refreshBtn} onPress={fetchAll} disabled={running}>
          {running
            ? <ActivityIndicator size="small" color={C.info} />
            : <Ionicons name="refresh-outline" size={20} color={C.info} />
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Summary pill ─────────────────────────────── */}
        <View style={[s.summaryPill,
          respPlan.length > 0
            ? { backgroundColor: C.safeBg, borderColor: C.safeBorder }
            : { backgroundColor: C.bg,     borderColor: C.border     }
        ]}>
          <Ionicons
            name={respPlan.length > 0 ? "checkmark-circle-outline" : "time-outline"}
            size={16}
            color={respPlan.length > 0 ? C.safe : C.textMuted}
          />
          <Text style={[s.summaryText,
            { color: respPlan.length > 0 ? C.safeText : C.textMuted }
          ]}>
            {respPlan.length > 0
              ? `${respPlan.length} team${respPlan.length !== 1 ? "s" : ""} active right now`
              : "No teams assigned yet — run analysis on the Home tab"
            }
          </Text>
        </View>

        {/* ─── Team cards ───────────────────────────────── */}
        {respPlan.map((team, i) => (
          <TeamCard key={i} team={team} />
        ))}

        {/* ─── Dispatch button ──────────────────────────── */}
        {respPlan.length > 0 && (
          <TouchableOpacity
            style={[s.dispatchBtn,
              dispatched > 0
                ? { backgroundColor: C.safeBg, borderColor: C.safeBorder }
                : { backgroundColor: C.infoBg, borderColor: C.infoBorder }
            ]}
            onPress={triggerDispatch}
            activeOpacity={0.8}
          >
            <Ionicons
              name={dispatched > 0 ? "lock-closed-outline" : "lock-open-outline"}
              size={16}
              color={dispatched > 0 ? C.safeText : C.infoText}
            />
            <Text style={[s.dispatchText,
              { color: dispatched > 0 ? C.safeText : C.infoText }
            ]}>
              {dispatched > 0
                ? `${dispatched} dispatch messages sent securely`
                : "Send encrypted dispatch orders"
              }
            </Text>
          </TouchableOpacity>
        )}

        {/* ─── Secure comms explanation ─────────────────── */}
        {(dispatched > 0 || secComm?.status) && (
          <View style={s.secureBox}>
            <Ionicons name="shield-checkmark-outline" size={14} color={C.safeText} />
            <Text style={s.secureText}>{secComm?.plain_explanation}</Text>
          </View>
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.md,
  },
  title:      { fontSize: 16, fontWeight: "600", color: C.text },
  refreshBtn: { padding: SPACING.sm },
  scroll:     { flex: 1 },
  content:    { padding: SPACING.lg },
  summaryPill: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            SPACING.sm,
    borderRadius:   RADIUS.pill,
    borderWidth:    1,
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.sm,
    marginBottom:   SPACING.md,
    alignSelf:      "flex-start",
  },
  summaryText: { fontSize: 13, fontWeight: "500" },
  dispatchBtn: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            SPACING.sm,
    borderRadius:   RADIUS.md,
    borderWidth:    1,
    padding:        SPACING.md,
    marginTop:      SPACING.sm,
    marginBottom:   SPACING.sm,
  },
  dispatchText: { fontSize: 13, fontWeight: "600", flex: 1 },
  secureBox: {
    flexDirection:   "row",
    alignItems:      "flex-start",
    gap:             SPACING.sm,
    backgroundColor: C.safeBg,
    borderRadius:    RADIUS.md,
    padding:         SPACING.md,
    borderWidth:     1,
    borderColor:     C.safeBorder,
  },
  secureText: { flex: 1, fontSize: 12, color: C.safeText, lineHeight: 18 },
});
```

---

## 11. Detail screen — `detail.jsx`

Pushed on top of any tab when a risk area card is tapped.

```jsx
import React, { useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons }    from "@expo/vector-icons";
import { useIntel }    from "./_layout";
import RiskBand        from "./components/RiskBand";
import { C, T, SPACING, RADIUS, SHADOW, riskColors } from "./constants";

export default function DetailScreen() {
  const router = useRouter();
  const { areaId } = useLocalSearchParams();

  const { riskAreas, respPlan } = useIntel();

  // Find the area whose area_name matches the param
  const area = useMemo(
    () => riskAreas.find(a => a.area_name === areaId) || null,
    [riskAreas, areaId]
  );

  // Find teams assigned to this cluster type
  const teams = useMemo(() => {
    if (!area) return [];
    const type = (area.area_name || "").toLowerCase();
    return respPlan.filter(t =>
      (t.assigned_to || "").toLowerCase().includes(type.split("—")[0].trim()) ||
      (t.assigned_to || "").toLowerCase().includes(
        (area.area_name || "").toLowerCase().split(" ")[0]
      )
    );
  }, [area, respPlan]);

  if (!area) {
    return (
      <View style={[s.root, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={T.body}>Area not found</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const col = riskColors(area.risk_label);

  return (
    <View style={s.root}>
      {/* ─── Header ──────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backIconBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{area.area_name}</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Risk band ────────────────────────────────── */}
        <RiskBand
          riskLabel={area.risk_label}
          summary={`${area.report_count} report${area.report_count !== 1 ? "s" : ""} about this area`}
          citizenAction={area.recommended_action}
        />

        {/* ─── What we know ─────────────────────────────── */}
        <SectionTitle title="What is happening" />
        <View style={s.bodyCard}>
          <Text style={s.bodyText}>{area.what_we_know}</Text>
        </View>

        {/* ─── Why it was flagged ───────────────────────── */}
        <SectionTitle title="Why this area was flagged" />
        <View style={s.bodyCard}>
          <Text style={s.bodyText}>{area.why_this_area_is_flagged}</Text>
        </View>

        {/* ─── AI prediction ────────────────────────────── */}
        {area.plain_language_prediction ? (
          <>
            <SectionTitle title="What the AI predicts" />
            <View style={[s.bodyCard, { borderLeftWidth: 3, borderLeftColor: C.info }]}>
              <Text style={s.bodyText}>{area.plain_language_prediction}</Text>
            </View>
          </>
        ) : null}

        {/* ─── Teams for this area ──────────────────────── */}
        {teams.length > 0 && (
          <>
            <SectionTitle title="Teams responding" />
            {teams.map((team, i) => (
              <View key={i} style={s.teamRow}>
                <View style={s.teamLeft}>
                  <Ionicons name="navigate-outline" size={14} color={C.safe} />
                  <Text style={s.teamName}>{team.team_name}</Text>
                </View>
                <View style={s.etaPill}>
                  <Text style={s.etaText}>ETA {Math.round(team.eta_minutes)} min</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ─── Technical detail (collapsed by default) ──── */}
        <TechSection area={area} />

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </View>
  );
}

function SectionTitle({ title }) {
  return (
    <Text style={{
      fontSize: 11, fontWeight: "600",
      color: C.textDim,
      textTransform: "uppercase", letterSpacing: 0.6,
      marginTop: SPACING.lg, marginBottom: SPACING.sm,
    }}>
      {title}
    </Text>
  );
}

function TechSection({ area }) {
  const [open, setOpen] = React.useState(false);
  const td = area.technical_details || {};

  return (
    <View style={s.techSection}>
      <TouchableOpacity style={s.techToggle} onPress={() => setOpen(o => !o)}>
        <Text style={s.techToggleText}>
          {open ? "Hide" : "Show"} technical details
        </Text>
        <Ionicons
          name={open ? "chevron-up-outline" : "chevron-down-outline"}
          size={14}
          color={C.textDim}
        />
      </TouchableOpacity>
      {open && (
        <View style={s.techBox}>
          {Object.entries(td).map(([k, v]) => (
            v !== null && v !== undefined ? (
              <Text key={k} style={s.techLine}>
                {k.replace(/_/g, " ")}: {typeof v === "number" ? v.toFixed?.(3) ?? v : String(v)}
              </Text>
            ) : null
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             SPACING.md,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.md,
  },
  backIconBtn:  { padding: SPACING.xs },
  headerTitle:  { fontSize: 16, fontWeight: "600", color: C.text, flex: 1 },
  scroll:       { flex: 1 },
  content:      { padding: SPACING.lg },
  bodyCard: {
    backgroundColor: C.surface,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         SPACING.md,
    marginBottom:    SPACING.xs,
    ...SHADOW.card,
  },
  bodyText:   { fontSize: 13, color: C.textSec, lineHeight: 20 },
  teamRow: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
    backgroundColor: C.surface,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         SPACING.md,
    marginBottom:    SPACING.sm,
  },
  teamLeft:   { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  teamName:   { fontSize: 13, fontWeight: "600", color: C.text },
  etaPill: {
    backgroundColor: C.safeBg, borderColor: C.safeBorder,
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  etaText:    { fontSize: 11, fontWeight: "600", color: C.safeText },
  techSection:{ marginTop: SPACING.lg },
  techToggle: {
    flexDirection:  "row", alignItems: "center",
    gap: SPACING.xs, paddingVertical: SPACING.sm,
  },
  techToggleText: { fontSize: 12, color: C.textDim, fontWeight: "500" },
  techBox: {
    backgroundColor: C.bg,
    borderRadius:    RADIUS.sm,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         SPACING.md,
    gap:             4,
  },
  techLine: { fontSize: 11, color: C.textDim, fontFamily: "monospace" },
  backBtn: { marginTop: SPACING.md, padding: SPACING.md },
  backText: { fontSize: 14, color: C.info },
});
```

---

## 12. Config files to update

### `_layout.jsx` (root) background color

Change every hardcoded `#050816` to `C.bg` (`#f9fafb`).

### `app.json`

Change `userInterfaceStyle` from `"automatic"` to `"light"` — the app is
light-mode only.

```json
"userInterfaceStyle": "light"
```

Change the splash screen background color from `"#ffffff"` (it's already
white — no change needed).

### Android `_layout.jsx`

The root `<View>` style should be `backgroundColor: C.bg` not `#050816`.

---

## 13. Run order

```bash
# 1. Install no new packages — everything is already in package.json
#    (expo-location, expo-image-picker are already listed)

# 2. Create the new directory structure
mkdir -p Frontend/app/\(tabs\)
mkdir -p Frontend/app/hooks
mkdir -p Frontend/app/components

# 3. Write the files in this order (each imports from the previous):
#    constants.js          (tokens — no imports)
#    hooks/useIntelligence.js   (imports constants)
#    components/RiskBand.jsx    (imports constants)
#    components/StatGrid.jsx    (imports constants)
#    components/RiskCard.jsx    (imports constants)
#    components/TeamCard.jsx    (imports constants)
#    components/CitizenBox.jsx  (imports constants)
#    _layout.jsx                (imports hook + constants)
#    (tabs)/_layout.jsx         (imports constants)
#    (tabs)/home.jsx            (imports all of the above)
#    (tabs)/map.jsx
#    (tabs)/report.jsx
#    (tabs)/teams.jsx
#    detail.jsx

# 4. Delete old files
rm Frontend/app/index.jsx
rm Frontend/app/report.jsx          # was a redirect stub
rm Frontend/app/map-component.jsx   # was a redirect stub
rm Frontend/app/map-component-native.jsx.backup
rm Frontend/app/map-component.web.jsx.backup

# 5. Start dev server
cd Frontend && npx expo start
```

---

## 14. What each original piece maps to

| Original location | New location |
|---|---|
| `C` color constants | `constants.js` — C, T, SPACING, RADIUS, SHADOW, riskColors() |
| `useIntelligence` state | `hooks/useIntelligence.js` |
| `fetchAll / runPipeline / loadDemo / triggerDispatch` | `hooks/useIntelligence.js` |
| `submitReport` (inside ReportModal) | `hooks/useIntelligence.js` |
| Left column — city status, risk areas, incidents | `(tabs)/home.jsx` |
| Center column — map + timeline | `(tabs)/map.jsx` |
| Right column — teams, data sources, secure comms | `(tabs)/teams.jsx` |
| `ReportModal` (modal) | `(tabs)/report.jsx` (full screen) |
| Risk area card expand/detail | `detail.jsx` (pushed screen) |
| `TechToggle` / `techExpanded` state | `TechSection` component inside `detail.jsx` |
| `TimelineItem` + timeline state | Removed from UI; still in hook for debugging |
| `Badge`, `TechBadge`, `Pulse` animations | Removed — replaced by simple colored text/pills |
| `SectionHead`, `Card` wrappers | Replaced by `components/` |
