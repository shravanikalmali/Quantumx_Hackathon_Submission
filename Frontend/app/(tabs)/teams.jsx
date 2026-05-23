import React from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useIntel } from "../_layout";
import TeamCard from "../../lib/components/TeamCard";
import { C, SPACING, RADIUS } from "../../lib/constants";

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
            : <Ionicons name="refresh-outline" size={20} color={C.info} />}
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={[s.summaryPill, respPlan.length > 0
          ? { backgroundColor: C.safeBg, borderColor: C.safeBorder }
          : { backgroundColor: C.bg,     borderColor: C.border     }]}>
          <Ionicons name={respPlan.length > 0 ? "checkmark-circle-outline" : "time-outline"} size={16} color={respPlan.length > 0 ? C.safe : C.textMuted} />
          <Text style={[s.summaryText, { color: respPlan.length > 0 ? C.safeText : C.textMuted }]}>
            {respPlan.length > 0
              ? `${respPlan.length} team${respPlan.length !== 1 ? "s" : ""} active right now`
              : "No teams assigned yet — run analysis on the Home tab"}
          </Text>
        </View>

        {respPlan.map((team, i) => <TeamCard key={i} team={team} />)}

        {respPlan.length > 0 && (
          <TouchableOpacity
            style={[s.dispatchBtn, dispatched > 0
              ? { backgroundColor: C.safeBg, borderColor: C.safeBorder }
              : { backgroundColor: C.infoBg, borderColor: C.infoBorder }]}
            onPress={triggerDispatch}
            activeOpacity={0.8}
          >
            <Ionicons name={dispatched > 0 ? "lock-closed-outline" : "lock-open-outline"} size={16} color={dispatched > 0 ? C.safeText : C.infoText} />
            <Text style={[s.dispatchText, { color: dispatched > 0 ? C.safeText : C.infoText }]}>
              {dispatched > 0 ? `${dispatched} dispatch messages sent securely` : "Send encrypted dispatch orders"}
            </Text>
          </TouchableOpacity>
        )}

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
  root:        { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  title:       { fontSize: 16, fontWeight: "600", color: C.text },
  refreshBtn:  { padding: SPACING.sm },
  scroll:      { flex: 1 },
  content:     { padding: SPACING.lg },
  summaryPill: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, marginBottom: SPACING.md, alignSelf: "flex-start" },
  summaryText: { fontSize: 13, fontWeight: "500" },
  dispatchBtn: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, padding: SPACING.md, marginTop: SPACING.sm, marginBottom: SPACING.sm },
  dispatchText:{ fontSize: 13, fontWeight: "600", flex: 1 },
  secureBox:   { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm, backgroundColor: C.safeBg, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: C.safeBorder },
  secureText:  { flex: 1, fontSize: 12, color: C.safeText, lineHeight: 18 },
});
