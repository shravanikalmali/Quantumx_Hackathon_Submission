import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { riskColors, C, RADIUS, SPACING } from "../constants";

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
  band:        { borderRadius: RADIUS.lg, borderWidth: 1.5, padding: SPACING.lg, marginBottom: SPACING.md },
  label:       { fontSize: 22, fontWeight: "700", letterSpacing: -0.5, marginBottom: 4 },
  summary:     { fontSize: 13, lineHeight: 19, marginBottom: 6 },
  actionBox:   { flexDirection: "row", flexWrap: "wrap", backgroundColor: "rgba(0,0,0,0.06)", borderRadius: RADIUS.sm, padding: SPACING.sm, marginTop: 4 },
  actionPrefix:{ fontSize: 12, fontWeight: "700", color: C.text },
  actionText:  { fontSize: 12, flex: 1, color: C.textSec },
});
