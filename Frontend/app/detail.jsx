import React, { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useIntel } from "./_layout";
import RiskBand from "../lib/components/RiskBand";
import { C, T, SPACING, RADIUS, SHADOW, riskColors } from "../lib/constants";

export default function DetailScreen() {
  const router = useRouter();
  const { areaId } = useLocalSearchParams();
  const { riskAreas, respPlan } = useIntel();

  const area = useMemo(
    () => riskAreas.find(a => a.area_name === areaId) || null,
    [riskAreas, areaId]
  );

  const teams = useMemo(() => {
    if (!area) return [];
    const firstWord = (area.area_name || "").toLowerCase().split(" ")[0];
    return respPlan.filter(t =>
      (t.assigned_to || "").toLowerCase().includes(firstWord)
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

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backIconBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{area.area_name}</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <RiskBand
          riskLabel={area.risk_label}
          summary={`${area.report_count || 0} report${area.report_count !== 1 ? "s" : ""} about this area`}
          citizenAction={area.recommended_action}
        />

        <SectionTitle title="What is happening" />
        <View style={s.bodyCard}>
          <Text style={s.bodyText}>{area.what_we_know}</Text>
        </View>

        {area.why_this_area_is_flagged ? (
          <>
            <SectionTitle title="Why this area was flagged" />
            <View style={s.bodyCard}>
              <Text style={s.bodyText}>{area.why_this_area_is_flagged}</Text>
            </View>
          </>
        ) : null}

        {area.truth_statement ? (
          <>
            <SectionTitle title="Signal Intelligence" />
            <View style={[s.bodyCard, { borderLeftWidth: 3, borderLeftColor: C.critical }]}>
              <Text style={[s.bodyText, { fontWeight: "700", color: C.text, marginBottom: 8 }]}>{area.truth_statement}</Text>
              {area.confidence_label ? (
                <Text style={[s.bodyText, { fontWeight: "600", color: C.info, marginBottom: 6 }]}>
                  {area.confidence_label} · {area.confidence_percent}% confidence
                </Text>
              ) : null}
              {area.why_we_believe_this?.map((reason, i) => (
                <Text key={i} style={[s.bodyText, { fontSize: 12, lineHeight: 18 }]}>• {reason}</Text>
              ))}
            </View>
          </>
        ) : null}

        {area.plain_language_prediction ? (
          <>
            <SectionTitle title="What the AI predicts" />
            <View style={[s.bodyCard, { borderLeftWidth: 3, borderLeftColor: C.info }]}>
              <Text style={s.bodyText}>{area.plain_language_prediction}</Text>
            </View>
          </>
        ) : null}

        {area.citizen_advisory ? (
          <>
            <SectionTitle title="Citizen Advisory" />
            <View style={[s.bodyCard, { borderLeftWidth: 3, borderLeftColor: C.safe }]}>
              <Text style={s.bodyText}>{area.citizen_advisory}</Text>
            </View>
          </>
        ) : null}

        {area.responder_dispatch_plan?.field_instruction ? (
          <>
            <SectionTitle title="Responder Dispatch Plan" />
            <View style={s.bodyCard}>
              <Text style={[s.bodyText, { fontWeight: "600", marginBottom: 4 }]}>Priority: {area.responder_dispatch_plan.priority}</Text>
              <Text style={s.bodyText}>{area.responder_dispatch_plan.field_instruction}</Text>
            </View>
          </>
        ) : null}

        {area.authority_command_brief?.headline ? (
          <>
            <SectionTitle title="Authority Command Brief" />
            <View style={s.bodyCard}>
              <Text style={[s.bodyText, { fontWeight: "700", marginBottom: 6 }]}>{area.authority_command_brief.headline}</Text>
              {area.authority_command_brief.prediction ? (
                <Text style={[s.bodyText, { marginBottom: 6 }]}>{area.authority_command_brief.prediction}</Text>
              ) : null}
              {area.authority_command_brief.decision_needed?.map((d, i) => (
                <Text key={i} style={[s.bodyText, { fontSize: 12 }]}>• {d}</Text>
              ))}
            </View>
          </>
        ) : null}

        {area.encrypted_dispatch_note ? (
          <>
            <SectionTitle title="Encrypted Dispatch Note" />
            <View style={[s.bodyCard, { backgroundColor: C.bg }]}>
              <Text style={[s.bodyText, { fontFamily: "monospace", fontSize: 11 }]}>
                {JSON.stringify(area.encrypted_dispatch_note, null, 2)}
              </Text>
            </View>
          </>
        ) : null}

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
                  <Text style={s.etaText}>ETA {Math.round(team.eta_minutes || 0)} min</Text>
                </View>
              </View>
            ))}
          </>
        )}

        <TechSection area={area} />
        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </View>
  );
}

function SectionTitle({ title }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: "600", color: C.textDim, textTransform: "uppercase", letterSpacing: 0.6, marginTop: SPACING.lg, marginBottom: SPACING.sm }}>
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
        <Text style={s.techToggleText}>{open ? "Hide" : "Show"} technical details</Text>
        <Ionicons name={open ? "chevron-up-outline" : "chevron-down-outline"} size={14} color={C.textDim} />
      </TouchableOpacity>
      {open && (
        <View style={s.techBox}>
          {Object.entries(td).map(([k, v]) =>
            v !== null && v !== undefined ? (
              <Text key={k} style={s.techLine}>
                {k.replace(/_/g, " ")}: {typeof v === "number" ? (v.toFixed ? v.toFixed(3) : v) : String(v)}
              </Text>
            ) : null
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: C.bg },
  header:        { flexDirection: "row", alignItems: "center", gap: SPACING.md, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  backIconBtn:   { padding: SPACING.xs },
  headerTitle:   { fontSize: 16, fontWeight: "600", color: C.text, flex: 1 },
  scroll:        { flex: 1 },
  content:       { padding: SPACING.lg },
  bodyCard:      { backgroundColor: C.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, padding: SPACING.md, marginBottom: SPACING.xs, ...SHADOW.card },
  bodyText:      { fontSize: 13, color: C.textSec, lineHeight: 20 },
  teamRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, padding: SPACING.md, marginBottom: SPACING.sm },
  teamLeft:      { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  teamName:      { fontSize: 13, fontWeight: "600", color: C.text },
  etaPill:       { backgroundColor: C.safeBg, borderColor: C.safeBorder, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 3 },
  etaText:       { fontSize: 11, fontWeight: "600", color: C.safeText },
  techSection:   { marginTop: SPACING.lg },
  techToggle:    { flexDirection: "row", alignItems: "center", gap: SPACING.xs, paddingVertical: SPACING.sm },
  techToggleText:{ fontSize: 12, color: C.textDim, fontWeight: "500" },
  techBox:       { backgroundColor: C.bg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: C.border, padding: SPACING.md, gap: 4 },
  techLine:      { fontSize: 11, color: C.textDim, fontFamily: "monospace" },
  backBtn:       { marginTop: SPACING.md, padding: SPACING.md },
  backText:      { fontSize: 14, color: C.info },
});
