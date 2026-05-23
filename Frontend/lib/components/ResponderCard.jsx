import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, SPACING, RADIUS } from "../constants";

const RESPONDER_ICONS = {
  ambulance: "medical",
  fire_truck: "flame",
  police: "shield",
  medical_team: "heart",
  hospital: "medical",
  fire_station: "flame",
};

const RESPONDER_COLORS = {
  ambulance: "#ef4444",
  fire_truck: "#f97316",
  police: "#3b82f6",
  medical_team: "#ec4899",
  hospital: "#ef4444",
  fire_station: "#f97316",
};

export default function ResponderCard({ responder, onPress }) {
  const icon = RESPONDER_ICONS[responder.type] || "help";
  const color = RESPONDER_COLORS[responder.type] || C.text;
  const distance = responder.distance_km || 0;
  const eta = Math.round((distance / (responder.speed_kmh || 50)) * 60);

  return (
    <TouchableOpacity
      style={s.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[s.iconBox, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>

      <View style={s.content}>
        <Text style={s.name}>{responder.name}</Text>
        <Text style={s.address} numberOfLines={1}>
          {responder.address || "Location"}
        </Text>
        <View style={s.metaRow}>
          <Text style={s.meta}>
            📍 {distance.toFixed(1)}km away
          </Text>
          {responder.rating && (
            <Text style={s.meta}>⭐ {responder.rating.toFixed(1)}</Text>
          )}
        </View>
      </View>

      <View style={s.rightSection}>
        <View style={s.etaBox}>
          <Text style={s.etaLabel}>ETA</Text>
          <Text style={s.etaValue}>{eta}m</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.md,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: "600",
    color: C.text,
    marginBottom: 2,
  },
  address: {
    fontSize: 11,
    color: C.textMuted,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  meta: {
    fontSize: 10,
    color: C.textDim,
  },
  rightSection: {
    alignItems: "flex-end",
    gap: SPACING.sm,
  },
  etaBox: {
    alignItems: "center",
    paddingHorizontal: SPACING.sm,
  },
  etaLabel: {
    fontSize: 9,
    color: C.textMuted,
    fontWeight: "500",
  },
  etaValue: {
    fontSize: 12,
    fontWeight: "700",
    color: C.info,
  },
});
