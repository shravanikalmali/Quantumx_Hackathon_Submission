import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { C, RADIUS, SPACING, SHADOW } from "../constants";

export default function StatGrid({ stats = [] }) {
  return (
    <View style={s.grid}>
      {stats.map((item, i) => (
        <View key={i} style={s.card}>
          <Text style={[s.num, item.color && { color: item.color }]}>{item.num}</Text>
          <Text style={s.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginBottom: SPACING.md },
  card: { flex: 1, minWidth: "46%", backgroundColor: C.surface, borderRadius: RADIUS.md, padding: SPACING.md, ...SHADOW.card },
  num:  { fontSize: 22, fontWeight: "700", color: C.text, marginBottom: 2 },
  label:{ fontSize: 11, color: C.textMuted, fontWeight: "500" },
});
