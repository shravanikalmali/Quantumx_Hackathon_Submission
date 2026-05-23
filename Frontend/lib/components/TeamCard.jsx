import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { C, RADIUS, SPACING, SHADOW } from "../constants";

function DetailRow({ label, value }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}: </Text>
      <Text style={s.detailValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

export default function TeamCard({ team }) {
  return (
    <View style={s.card}>
      <View style={s.header}>
        <Text style={s.name}>{team.team_name}</Text>
        <View style={s.etaPill}>
          <Text style={s.etaText}>ETA {Math.round(team.eta_minutes || 0)} min</Text>
        </View>
      </View>
      <DetailRow label="Going to"   value={team.assigned_to}   />
      <DetailRow label="Why chosen" value={team.why_this_team} />
      {team.optimization ? (
        <View style={s.optNote}>
          <Text style={s.optText}>{team.optimization}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card:        { backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOW.card },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.sm },
  name:        { fontSize: 14, fontWeight: "600", color: C.text, flex: 1 },
  etaPill:     { backgroundColor: C.safeBg, borderColor: C.safeBorder, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 3 },
  etaText:     { fontSize: 11, fontWeight: "600", color: C.safeText },
  detailRow:   { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  detailLabel: { fontSize: 12, fontWeight: "600", color: C.textSec },
  detailValue: { fontSize: 12, color: C.textMuted, flex: 1 },
  optNote:     { marginTop: 6, backgroundColor: C.safeBg, borderRadius: RADIUS.sm, padding: SPACING.sm },
  optText:     { fontSize: 11, color: C.safeText },
});
