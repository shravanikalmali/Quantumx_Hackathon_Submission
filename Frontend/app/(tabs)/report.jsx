import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Linking, Modal, Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { useIntel } from "../_layout";
import { C, T, SPACING, RADIUS, SHADOW } from "../../lib/constants";

const CATEGORIES = [
  { id: "fire",                   label: "Fire",      icon: "flame-outline"          },
  { id: "flood",                  label: "Flood",     icon: "water-outline"          },
  { id: "road_accident",          label: "Accident",  icon: "car-outline"            },
  { id: "medical_emergency",      label: "Medical",   icon: "medkit-outline"         },
  { id: "power_outage",           label: "Power out", icon: "flash-off-outline"      },
  { id: "infrastructure_failure", label: "Collapse",  icon: "business-outline"       },
  { id: "crowd_risk",             label: "Crowd",     icon: "people-outline"         },
  { id: "hazardous_material",     label: "Hazmat",    icon: "warning-outline"        },
  { id: "rescue_required",        label: "Rescue",    icon: "hand-left-outline"      },
];

export default function ReportScreen() {
  const { submitReport } = useIntel();
  const [desc,           setDesc]           = useState("");
  const [category,       setCategory]       = useState(null);
  const [location,       setLocation]       = useState(null);
  const [imageUri,       setImageUri]       = useState(null);
  const [submitting,     setSubmitting]     = useState(false);
  const [result,         setResult]         = useState(null);
  const [responders,     setResponders]     = useState([]);
  const [loadingResponders, setLoadingResponders] = useState(false);
  const [showResponders, setShowResponders] = useState(false);

  const canSubmit = desc.trim().length > 5 && category !== null && !submitting;

  const getLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Location needed", "Allow location access so your report reaches the right response team.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
  }, []);

  const pickPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!res.canceled && res.assets?.[0]) setImageUri(res.assets[0].uri);
  }, []);

  // Get responder type based on incident category
  const getResponderType = (cat) => {
    const typeMap = {
      fire: "fire_station",
      flood: "emergency_center",
      road_accident: "police",
      medical_emergency: "hospital",
      power_outage: "emergency_center",
      infrastructure_failure: "emergency_center",
      crowd_risk: "police",
      hazardous_material: "emergency_center",
      rescue_required: "emergency_center",
    };
    return typeMap[cat] || "emergency_center";
  };

  // Fetch nearby responders
  const fetchNearbyResponders = useCallback(async (lat, lng, type) => {
    setLoadingResponders(true);
    try {
      const response = await fetch(
        `http://localhost:8080/responders/nearby?lat=${lat}&lng=${lng}&radius_km=5&responder_type=${type}`
      );
      const data = await response.json();
      setResponders(data.responders || []);
      setShowResponders(true);
    } catch (e) {
      console.log("Responder fetch error:", e);
      setResponders([]);
    } finally {
      setLoadingResponders(false);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const r = await submitReport({
        text: category ? `[${category}] ${desc}` : desc,
        lat: location?.lat, lng: location?.lng, imageUri,
      });
      setResult(r);
      
      // Auto-fetch responders after successful submission
      if (location?.lat && location?.lng && category) {
        const responderType = getResponderType(category);
        await fetchNearbyResponders(location.lat, location.lng, responderType);
      }
      
      setDesc(""); setCategory(null); setLocation(null); setImageUri(null);
    } catch (e) {
      Alert.alert("Error", "Could not submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, submitReport, category, desc, location, imageUri, fetchNearbyResponders]);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Report an emergency</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.emergencyCallout}>
          <Ionicons name="call-outline" size={16} color={C.criticalText} />
          <Text style={s.calloutText}>
            For life-threatening emergencies call <Text style={{ fontWeight: "700" }}>112</Text> immediately.
          </Text>
        </View>

        {result && <ResultCard result={result} onDismiss={() => setResult(null)} />}

        <Text style={s.fieldLabel}>What type of emergency?</Text>
        <View style={s.catGrid}>
          {CATEGORIES.map(cat => {
            const active = category === cat.id;
            return (
              <TouchableOpacity key={cat.id} style={[s.catChip, active && s.catChipActive]} onPress={() => setCategory(cat.id)} activeOpacity={0.7}>
                <Ionicons name={cat.icon} size={22} color={active ? C.info : C.textDim} />
                <Text style={[s.catLabel, active && s.catLabelActive]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.fieldLabel}>Describe what you see</Text>
        <TextInput
          style={s.textArea}
          placeholder="Example: Large fire near warehouse on 27th Main, HSR Layout."
          placeholderTextColor={C.textDim}
          multiline numberOfLines={4} textAlignVertical="top"
          value={desc} onChangeText={setDesc}
        />

        <View style={s.attachRow}>
          <TouchableOpacity style={[s.attachBtn, location && s.attachBtnActive]} onPress={getLocation}>
            <Ionicons name={location ? "location" : "location-outline"} size={16} color={location ? C.info : C.textMuted} />
            <Text style={[s.attachText, location && { color: C.infoText }]}>{location ? "Location added" : "Add location"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.attachBtn, imageUri && s.attachBtnActive]} onPress={pickPhoto}>
            <Ionicons name={imageUri ? "image" : "image-outline"} size={16} color={imageUri ? C.info : C.textMuted} />
            <Text style={[s.attachText, imageUri && { color: C.infoText }]}>{imageUri ? "Photo added" : "Add photo"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]} onPress={handleSubmit} disabled={!canSubmit} activeOpacity={0.8}>
          {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send-outline" size={18} color="#fff" />}
          <Text style={s.submitText}>{submitting ? "Analyzing..." : "Submit report"}</Text>
        </TouchableOpacity>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      {/* Responders Modal */}
      <Modal visible={showResponders} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Nearest Responders</Text>
              <TouchableOpacity onPress={() => setShowResponders(false)}>
                <Ionicons name="close-outline" size={24} color={C.text} />
              </TouchableOpacity>
            </View>

            {loadingResponders ? (
              <View style={s.modalCenter}>
                <ActivityIndicator size="large" color={C.info} />
                <Text style={s.modalLoading}>Finding responders...</Text>
              </View>
            ) : responders.length > 0 ? (
              <ScrollView style={s.respondersList} contentContainerStyle={s.respondersContent}>
                {responders.map((responder, idx) => (
                  <ResponderCard key={idx} responder={responder} />
                ))}
              </ScrollView>
            ) : (
              <View style={s.modalCenter}>
                <Ionicons name="alert-circle-outline" size={48} color={C.textMuted} />
                <Text style={s.modalEmpty}>No responders found nearby</Text>
                <Text style={s.modalEmptyDesc}>Try expanding your search radius</Text>
              </View>
            )}

            <TouchableOpacity style={s.modalCloseBtn} onPress={() => setShowResponders(false)}>
              <Text style={s.modalCloseBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Responder Card Component
function ResponderCard({ responder }) {
  const openMaps = () => {
    const url = `https://www.google.com/maps/search/${responder.name}/@${responder.lat},${responder.lng},15z`;
    Linking.openURL(url);
  };

  const callResponder = () => {
    if (responder.phone) {
      Linking.openURL(`tel:${responder.phone}`);
    }
  };

  return (
    <View style={s.responderCard}>
      <View style={s.responderInfo}>
        <Text style={s.responderName}>{responder.name}</Text>
        <Text style={s.responderAddress}>{responder.address}</Text>
        <View style={s.responderMeta}>
          <Ionicons name="location" size={14} color={C.info} />
          <Text style={s.responderDist}>{responder.distance_km?.toFixed(1)} km away</Text>
          {responder.rating && (
            <>
              <Text style={s.responderDot}>•</Text>
              <Ionicons name="star" size={14} color="#FFB800" />
              <Text style={s.responderRating}>{responder.rating}</Text>
            </>
          )}
        </View>
      </View>
      <View style={s.responderActions}>
        <TouchableOpacity style={s.actionBtn} onPress={openMaps}>
          <Ionicons name="map-outline" size={18} color={C.info} />
          <Text style={s.actionText}>Map</Text>
        </TouchableOpacity>
        {responder.phone && (
          <TouchableOpacity style={s.actionBtn} onPress={callResponder}>
            <Ionicons name="call-outline" size={18} color={C.critical} />
            <Text style={s.actionText}>Call</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function ResultCard({ result, onDismiss }) {
  const inc    = result?.incident || {};
  const qml    = result?.qml_prediction || {};
  const itype  = (inc.incident_type || "").replace(/_/g, " ");
  const sevPct = Math.round((inc.severity_score || 0) * 100);
  return (
    <View style={s.resultCard}>
      <View style={s.resultHeader}>
        <Ionicons name="checkmark-circle-outline" size={20} color={C.safeText} />
        <Text style={s.resultTitle}>Report received</Text>
        <TouchableOpacity onPress={onDismiss}><Ionicons name="close-outline" size={20} color={C.textMuted} /></TouchableOpacity>
      </View>
      {itype ? <Text style={s.resultLine}>AI identified: <Text style={s.resultBold}>{itype}</Text>{"  "}Severity: <Text style={s.resultBold}>{sevPct}%</Text></Text> : null}
      {inc.summary ? <Text style={s.resultBody}>{inc.summary}</Text> : null}
      {qml.risk_score != null ? <Text style={s.resultLine}>Risk score: <Text style={s.resultBold}>{Math.round(qml.risk_score * 100)}%</Text>{" — "}{(qml.risk_label || "").replace(/_/g, " ")}</Text> : null}
      {result?.secure_dispatch_ready ? <Text style={s.resultSafe}>Nearest team dispatched</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: C.bg },
  header:           { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  title:            { fontSize: 16, fontWeight: "600", color: C.text },
  scroll:           { flex: 1 },
  content:          { padding: SPACING.lg },
  emergencyCallout: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm, backgroundColor: C.criticalBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.criticalBorder, padding: SPACING.md, marginBottom: SPACING.lg },
  calloutText:      { flex: 1, fontSize: 13, color: C.criticalText, lineHeight: 19 },
  fieldLabel:       { fontSize: 11, fontWeight: "600", color: C.textDim, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: SPACING.sm, marginTop: SPACING.md },
  catGrid:          { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginBottom: SPACING.md },
  catChip:          { width: "30%", backgroundColor: C.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, paddingVertical: SPACING.md, alignItems: "center", gap: SPACING.xs },
  catChipActive:    { borderColor: C.infoBorder, backgroundColor: C.infoBg },
  catLabel:         { fontSize: 10, fontWeight: "500", color: C.textDim },
  catLabelActive:   { color: C.infoText },
  textArea:         { backgroundColor: C.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, padding: SPACING.md, fontSize: 14, color: C.text, minHeight: 96, marginBottom: SPACING.md },
  attachRow:        { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.md },
  attachBtn:        { flex: 1, flexDirection: "row", alignItems: "center", gap: SPACING.xs, backgroundColor: C.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, padding: SPACING.sm, justifyContent: "center" },
  attachBtnActive:  { borderColor: C.infoBorder, backgroundColor: C.infoBg },
  attachText:       { fontSize: 12, color: C.textMuted, fontWeight: "500" },
  submitBtn:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm, backgroundColor: C.info, borderRadius: RADIUS.md, paddingVertical: SPACING.md },
  submitBtnDisabled:{ backgroundColor: C.textDim },
  submitText:       { fontSize: 15, fontWeight: "600", color: "#fff" },
  resultCard:       { backgroundColor: C.safeBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: C.safeBorder, padding: SPACING.md, marginBottom: SPACING.lg },
  resultHeader:     { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.sm },
  resultTitle:      { fontSize: 15, fontWeight: "700", color: C.safeText, flex: 1 },
  resultLine:       { fontSize: 13, color: C.textSec, marginBottom: 3 },
  resultBold:       { fontWeight: "700", color: C.text },
  resultBody:       { fontSize: 12, color: C.textSec, lineHeight: 18, marginBottom: 4 },
  resultSafe:       { fontSize: 12, color: C.safeText, fontWeight: "600", marginTop: 4 },

  // Modal Styles
  modalOverlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent:     { backgroundColor: C.bg, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, maxHeight: "85%", paddingBottom: SPACING.lg },
  modalHeader:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle:       { fontSize: 16, fontWeight: "700", color: C.text },
  modalCenter:      { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: SPACING.xl },
  modalLoading:     { fontSize: 14, color: C.textMuted, marginTop: SPACING.md },
  modalEmpty:       { fontSize: 14, fontWeight: "600", color: C.text, marginTop: SPACING.md },
  modalEmptyDesc:   { fontSize: 12, color: C.textMuted, marginTop: SPACING.xs },
  respondersList:   { flex: 1 },
  respondersContent:{ padding: SPACING.lg, gap: SPACING.md },
  responderCard:    { backgroundColor: C.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOW.card },
  responderInfo:    { marginBottom: SPACING.sm },
  responderName:    { fontSize: 14, fontWeight: "700", color: C.text, marginBottom: 2 },
  responderAddress: { fontSize: 12, color: C.textMuted, marginBottom: SPACING.xs },
  responderMeta:    { flexDirection: "row", alignItems: "center", gap: 4, marginTop: SPACING.xs },
  responderDist:    { fontSize: 11, color: C.textMuted },
  responderDot:     { color: C.textMuted },
  responderRating:  { fontSize: 11, color: C.textMuted },
  responderActions: { flexDirection: "row", gap: SPACING.sm },
  actionBtn:        { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.xs, backgroundColor: C.infoBg, borderRadius: RADIUS.md, paddingVertical: SPACING.sm },
  actionText:       { fontSize: 12, fontWeight: "600", color: C.infoText },
  modalCloseBtn:    { marginHorizontal: SPACING.lg, backgroundColor: C.info, borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: "center" },
  modalCloseBtnText:{ fontSize: 14, fontWeight: "600", color: "#fff" },
});
