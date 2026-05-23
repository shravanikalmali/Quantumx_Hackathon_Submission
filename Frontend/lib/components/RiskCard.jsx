import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { riskColors, C, RADIUS, SPACING, SHADOW } from "../constants";

export default function RiskCard({ area, onPress }) {
  const col = riskColors(area.risk_label);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && s.pressed]} android_ripple={{ color: col.bg }}>
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
          <Text style={[s.actionText, { color: col.text }]} numberOfLines={2}>{area.recommended_action}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card:       { backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOW.card },
  pressed:    { opacity: 0.85 },
  row:        { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: 6 },
  dot:        { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  name:       { fontSize: 14, fontWeight: "600", color: C.text, flex: 1 },
  badge:      { borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:  { fontSize: 11, fontWeight: "600" },
  desc:       { fontSize: 12, color: C.textSec, lineHeight: 18, marginBottom: 6 },
  action:     { borderRadius: RADIUS.sm, padding: SPACING.sm },
  actionText: { fontSize: 11, lineHeight: 16 },
});
