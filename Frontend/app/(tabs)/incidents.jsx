import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useIntel } from "../_layout";
import { C, SPACING, RADIUS, SHADOW, riskColors } from "../../lib/constants";

const INCIDENT_FILTERS = ["All", "Fire", "Flood", "Accident", "Medical", "High Risk"];
const INCIDENT_EMOJIS = {
  fire: "🔥",
  flood: "🌊",
  road_accident: "🚗",
  medical_emergency: "🏥",
  power_outage: "⚡",
  infrastructure_failure: "🏗️",
  crowd_risk: "👥",
  hazardous_material: "☢️",
  rescue_required: "🆘",
  traffic: "🚦",
  other: "⚠️",
};

export default function IncidentsScreen() {
  const { riskAreas, loading, fetchAll } = useIntel();
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState("All");

  // Deduplicate incidents by type + location
  const deduplicatedAreas = riskAreas.reduce((acc, area) => {
    const key = `${area.incident_type}|${area.area_name}`;
    const existing = acc.find(a => `${a.incident_type}|${a.area_name}` === key);
    
    if (existing) {
      existing.incident_count = (existing.incident_count || 1) + (area.incident_count || 1);
      if (area.escalation_probability && (!existing.escalation_probability || area.escalation_probability > existing.escalation_probability)) {
        existing.escalation_probability = area.escalation_probability;
      }
    } else {
      acc.push(area);
    }
    return acc;
  }, []);

  const filteredAreas = deduplicatedAreas.filter((area) => {
    if (selectedFilter === "All") return true;
    if (selectedFilter === "Fire") return area.incident_type?.toLowerCase().includes("fire");
    if (selectedFilter === "Flood") return area.incident_type?.toLowerCase().includes("flood");
    if (selectedFilter === "Accident") return area.incident_type?.toLowerCase().includes("accident");
    if (selectedFilter === "Medical") return area.incident_type?.toLowerCase().includes("medical");
    if (selectedFilter === "High Risk") return area.risk_label?.toLowerCase().includes("critical") || area.risk_label?.toLowerCase().includes("high");
    return true;
  });

  const openDetail = useCallback((area) => {
    router.push({ pathname: "/detail", params: { areaId: area.area_name } });
  }, [router]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.info} />
        <Text style={[{ marginTop: SPACING.md, color: C.textMuted }]}>Loading incidents...</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>All Incidents</Text>
          <Text style={s.subtitle}>{deduplicatedAreas.length} active incidents in Bengaluru</Text>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Filter Chips */}
        <FilterChips
          options={INCIDENT_FILTERS}
          selected={selectedFilter}
          onSelect={setSelectedFilter}
        />

        {/* Incident List */}
        {filteredAreas.length > 0 ? (
          filteredAreas.map((area, i) => (
            <IncidentCard
              key={i}
              area={area}
              onPress={() => openDetail(area)}
            />
          ))
        ) : (
          <View style={s.emptyState}>
            <Ionicons name="search-outline" size={48} color={C.textMuted} />
            <Text style={s.emptyText}>No incidents match this filter</Text>
          </View>
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </View>
  );
}

// Filter Chips Component
function FilterChips({ options, selected, onSelect }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.chipContainer}
      style={s.chipScroll}
    >
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[
            s.chip,
            selected === opt && { backgroundColor: C.info, borderColor: C.info },
          ]}
          onPress={() => onSelect(opt)}
        >
          <Text style={[s.chipText, selected === opt && { color: "#fff" }]}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// Incident Card Component
function IncidentCard({ area, onPress }) {
  const col = riskColors(area.risk_label);
  const emoji = INCIDENT_EMOJIS[area.incident_type?.toLowerCase()] || "⚠️";
  const reportCount = area.incident_count || 1;
  const eta = area.eta_minutes ? `${area.eta_minutes}m` : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.card, pressed && s.cardPressed]}
      android_ripple={{ color: col.bg }}
    >
      {/* Header: Type + Severity Badge */}
      <View style={s.cardHeader}>
        <View style={s.cardType}>
          <Text style={s.cardEmoji}>{emoji}</Text>
          <Text style={s.cardTypeName}>
            {area.incident_type?.replace(/_/g, " ") || "Incident"}
          </Text>
        </View>
        <View style={[s.cardBadge, { backgroundColor: col.bg, borderColor: col.border }]}>
          <Text style={[s.cardBadgeText, { color: col.text }]}>
            {area.risk_label}
          </Text>
        </View>
      </View>

      {/* Location */}
      <Text style={s.cardLocation}>{area.area_name}</Text>

      {/* Metadata Row */}
      <View style={s.cardMetadata}>
        <Text style={s.cardMetaItem}>
          {reportCount} report{reportCount !== 1 ? "s" : ""}
        </Text>
        {eta && (
          <>
            <Text style={s.cardMetaItem}>•</Text>
            <Text style={s.cardMetaItem}>ETA {eta}</Text>
          </>
        )}
      </View>

      {/* Recommendation */}
      {area.recommended_action && (
        <View style={[s.cardRecommendation, { backgroundColor: col.bg }]}>
          <Text style={[s.cardRecommendationText, { color: col.text }]}>
            {area.recommended_action}
          </Text>
        </View>
      )}

      {!area.recommended_action && (
        <View style={[s.cardRecommendation, { backgroundColor: col.bg }]}>
          <Text style={[s.cardRecommendationText, { color: col.text }]}>
            {area.risk_label?.toLowerCase().includes("critical") && "Action: Dispatch team immediately"}
            {area.risk_label?.toLowerCase().includes("high") && !area.risk_label?.toLowerCase().includes("critical") && "Action: Send responder"}
            {area.risk_label?.toLowerCase().includes("medium") && "Action: Monitor"}
            {!area.risk_label?.toLowerCase().includes("critical") && !area.risk_label?.toLowerCase().includes("high") && !area.risk_label?.toLowerCase().includes("medium") && "Action: Keep watching"}
          </Text>
        </View>
      )}

      {/* Action Button */}
      <TouchableOpacity style={s.cardActionBtn} onPress={onPress}>
        <Text style={s.cardActionText}>View Details</Text>
      </TouchableOpacity>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header
  header: {
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingTop: SPACING.lg,
  },
  title: { fontSize: 20, fontWeight: "700", color: C.text },
  subtitle: { fontSize: 13, color: C.textMuted, marginTop: 4 },

  // Scroll
  scroll: { flex: 1 },
  content: { padding: SPACING.lg, paddingTop: SPACING.md },

  // Filter Chips
  chipScroll: { marginBottom: SPACING.md },
  chipContainer: { gap: SPACING.sm, paddingRight: SPACING.lg },
  chip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  chipText: { fontSize: 12, fontWeight: "600", color: C.text },

  // Incident Card
  card: {
    backgroundColor: C.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },
  cardPressed: { opacity: 0.7 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  cardType: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  cardEmoji: { fontSize: 20 },
  cardTypeName: { fontSize: 14, fontWeight: "600", color: C.text },
  cardBadge: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  cardBadgeText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  cardLocation: { fontSize: 13, fontWeight: "600", color: C.text, marginBottom: SPACING.sm },
  cardMetadata: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: SPACING.sm },
  cardMetaItem: { fontSize: 11, color: C.textMuted },
  cardRecommendation: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  cardRecommendationText: { fontSize: 12, lineHeight: 18, fontWeight: "500" },
  cardActionBtn: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: "center",
  },
  cardActionText: { fontSize: 12, fontWeight: "600", color: C.text },

  // Empty State
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.xl,
  },
  emptyText: { fontSize: 13, color: C.textMuted, marginTop: SPACING.md },
});
