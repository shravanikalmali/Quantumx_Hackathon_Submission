import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Linking, Modal,
  Image, Platform, KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { useIntel } from "./_layout";
import { C, SPACING, RADIUS, SHADOW, INCIDENT_API_URL_HOST, GEMINI_API_KEY } from "../lib/constants";

const API = INCIDENT_API_URL_HOST || "http://localhost:8080";

const CATEGORIES = [
  { id: "fire",                   label: "Fire",       icon: "flame-outline"        },
  { id: "flood",                  label: "Flood",      icon: "water-outline"        },
  { id: "road_accident",          label: "Accident",   icon: "car-outline"          },
  { id: "medical_emergency",      label: "Medical",    icon: "medkit-outline"       },
  { id: "power_outage",           label: "Power Out",  icon: "flash-off-outline"    },
  { id: "infrastructure_failure", label: "Collapse",   icon: "business-outline"     },
  { id: "crowd_risk",             label: "Crowd",      icon: "people-outline"       },
  { id: "hazardous_material",     label: "Hazmat",     icon: "warning-outline"      },
  { id: "rescue_required",        label: "Rescue",     icon: "hand-left-outline"    },
  { id: "traffic",                label: "Traffic",    icon: "car-sport-outline"    },
];

export default function ReportIncidentScreen() {
  const { submitReport } = useIntel();
  const router = useRouter();
  const [desc, setDesc]               = useState("");
  const [category, setCategory]       = useState(null);
  const [location, setLocation]       = useState(null);
  const [imageUri, setImageUri]       = useState(null);
  const [submitting, setSubmitting]   = useState(false);
  const [result, setResult]           = useState(null);
  const [responders, setResponders]   = useState([]);
  const [loadingResp, setLoadingResp] = useState(false);
  const [showResp, setShowResp]       = useState(false);

  const canSubmit = desc.trim().length > 5 && category !== null && !submitting;

  const getLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Location needed", "Allow location access to pinpoint the incident.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
  }, []);

  const pickPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!res.canceled && res.assets?.[0]) setImageUri(res.assets[0].uri);
  }, []);

  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets?.[0]) setImageUri(res.assets[0].uri);
  }, []);

  const responderTypeMap = {
    fire: "fire_station", flood: "emergency_center", road_accident: "police",
    medical_emergency: "hospital", power_outage: "emergency_center",
    infrastructure_failure: "emergency_center", crowd_risk: "police",
    hazardous_material: "emergency_center", rescue_required: "emergency_center",
    traffic: "police",
  };

  // Hardcoded HSR responders (police stations)
  const HSR_POLICE_STATIONS = [
    {
      name: "HSR Layout Police Station",
      address: "27th Main Rd, HSR Layout, Bengaluru 560034",
      lat: 12.9352,
      lng: 77.6245,
      distance_km: 0.5,
      rating: 4.2,
      phone: "080-2552-0101",
      open_now: true,
    },
    {
      name: "Koramangala Police Station",
      address: "5th Block, Koramangala, Bengaluru 560034",
      lat: 12.9352,
      lng: 77.6400,
      distance_km: 1.2,
      rating: 4.0,
      phone: "080-2553-0202",
      open_now: true,
    },
    {
      name: "Indiranagar Police Station",
      address: "100 Feet Rd, Indiranagar, Bengaluru 560038",
      lat: 12.9716,
      lng: 77.6412,
      distance_km: 2.1,
      rating: 3.9,
      phone: "080-2525-0303",
      open_now: true,
    },
    {
      name: "Whitefield Police Station",
      address: "Whitefield, Bengaluru 560066",
      lat: 12.9698,
      lng: 77.7499,
      distance_km: 3.5,
      rating: 4.1,
      phone: "080-6710-0404",
      open_now: true,
    },
    {
      name: "Marathahalli Police Station",
      address: "Marathahalli, Bengaluru 560037",
      lat: 12.9689,
      lng: 77.6915,
      distance_km: 2.8,
      rating: 3.8,
      phone: "080-2540-0505",
      open_now: true,
    },
  ];

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const fetchNearbyResponders = useCallback(async (lat, lng, cat) => {
    setLoadingResp(true);
    try {
      const placeTypeMap = {
        fire_station: { keyword: "fire station", types: "fire_station" },
        hospital: { keyword: "hospital emergency", types: "hospital" },
        police: { keyword: "police station", types: "police" },
        emergency_center: { keyword: "hospital", types: "hospital" },
      };
      const type = responderTypeMap[cat] || "emergency_center";
      const placeInfo = placeTypeMap[type] || placeTypeMap.hospital;

      // Try Google Maps Places API
      const radius = 5000;
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&keyword=${encodeURIComponent(placeInfo.keyword)}&type=${placeInfo.types}&key=${GEMINI_API_KEY}`;
      
      let results = [];
      try {
        const response = await fetch(url);
        const data = await response.json();
        results = data.results || [];
      } catch (fetchErr) {
        // Fallback: use Gemini to generate nearby places
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const geminiResponse = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `I need real nearby ${placeInfo.keyword}s near coordinates ${lat}, ${lng} in Bengaluru, India within 5km radius. Return a JSON array of 5 actual real places with this exact format: [{"name": "...", "address": "...", "lat": number, "lng": number, "rating": number, "phone": "..."}]. Use real places that actually exist. Return ONLY the JSON array, nothing else.`
              }]
            }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
          })
        });
        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json();
          const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
          try {
            const cleaned = text.replace(/```json\n?|```\n?/g, "").trim();
            results = JSON.parse(cleaned).map(p => ({
              name: p.name,
              vicinity: p.address,
              geometry: { location: { lat: p.lat, lng: p.lng } },
              rating: p.rating,
              phone: p.phone,
            }));
          } catch (e) { console.log("Gemini parse error", e); }
        }
      }

      // Convert to responder format with distance
      let formatted = results.slice(0, 8).map((place, idx) => {
        const pLat = place.geometry?.location?.lat || lat;
        const pLng = place.geometry?.location?.lng || lng;
        const dist = getDistance(lat, lng, pLat, pLng);
        return {
          name: place.name || `${placeInfo.keyword} ${idx + 1}`,
          address: place.vicinity || place.formatted_address || "Bengaluru",
          lat: pLat,
          lng: pLng,
          distance_km: dist,
          rating: place.rating || null,
          phone: place.phone || place.formatted_phone_number || null,
          open_now: place.opening_hours?.open_now ?? true,
        };
      });

      // If no results, use hardcoded HSR police stations
      if (formatted.length === 0) {
        formatted = HSR_POLICE_STATIONS;
      }

      // Sort by distance
      formatted.sort((a, b) => a.distance_km - b.distance_km);
      setResponders(formatted);
      setShowResp(true);
    } catch (e) {
      console.log("Responder fetch error:", e);
      Alert.alert("Error", "Could not find nearby responders.");
      setResponders([]);
    } finally {
      setLoadingResp(false);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const r = await submitReport({
        text: category ? `[${category}] ${desc}` : desc,
        lat: location?.lat,
        lng: location?.lng,
        imageUri,
      });
      setResult(r);

      // Auto-fetch responders
      if (location?.lat && location?.lng && category) {
        await fetchNearbyResponders(location.lat, location.lng, category);
      }
    } catch (e) {
      Alert.alert("Error", "Could not submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, submitReport, category, desc, location, imageUri, fetchNearbyResponders]);

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Report Incident</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {/* Emergency callout */}
          <View style={s.callout}>
            <Ionicons name="call-outline" size={16} color={C.criticalText} />
            <Text style={s.calloutText}>
              For life-threatening emergencies call <Text style={{ fontWeight: "700" }}>112</Text> immediately.
            </Text>
          </View>

          {/* Result card */}
          {result && (
            <View style={s.resultCard}>
              <View style={s.resultHeader}>
                <Ionicons name="checkmark-circle" size={20} color={C.safeText} />
                <Text style={s.resultTitle}>Report submitted</Text>
                <TouchableOpacity onPress={() => setResult(null)}>
                  <Ionicons name="close-outline" size={20} color={C.textMuted} />
                </TouchableOpacity>
              </View>
              {result?.incident?.incident_type && (
                <Text style={s.resultLine}>
                  AI identified: <Text style={s.resultBold}>{result.incident.incident_type.replace(/_/g, " ")}</Text>
                  {"  "}Severity: <Text style={s.resultBold}>{Math.round((result.incident.severity_score || 0) * 100)}%</Text>
                </Text>
              )}
              {result?.incident?.summary && <Text style={s.resultBody}>{result.incident.summary}</Text>}
              {result?.qml_prediction?.risk_score != null && (
                <Text style={s.resultLine}>
                  Risk: <Text style={s.resultBold}>{Math.round(result.qml_prediction.risk_score * 100)}%</Text>
                </Text>
              )}
            </View>
          )}

          {/* Category selector */}
          <Text style={s.label}>What type of emergency?</Text>
          <View style={s.catGrid}>
            {CATEGORIES.map(cat => {
              const active = category === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[s.catChip, active && s.catChipActive]}
                  onPress={() => setCategory(cat.id)}
                >
                  <Ionicons name={cat.icon} size={22} color={active ? C.info : C.textDim} />
                  <Text style={[s.catLabel, active && s.catLabelActive]}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Description */}
          <Text style={s.label}>Describe what you see</Text>
          <TextInput
            style={s.textArea}
            placeholder="Example: Large fire near warehouse on 27th Main, HSR Layout. Smoke visible from a distance."
            placeholderTextColor={C.textDim}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={desc}
            onChangeText={setDesc}
          />

          {/* Image preview */}
          {imageUri && (
            <View style={s.imagePreview}>
              <Image source={{ uri: imageUri }} style={s.previewImg} />
              <TouchableOpacity style={s.removeImg} onPress={() => setImageUri(null)}>
                <Ionicons name="close-circle" size={24} color={C.critical} />
              </TouchableOpacity>
            </View>
          )}

          {/* Attach buttons */}
          <View style={s.attachRow}>
            <TouchableOpacity style={[s.attachBtn, location && s.attachBtnActive]} onPress={getLocation}>
              <Ionicons name={location ? "location" : "location-outline"} size={16} color={location ? C.info : C.textMuted} />
              <Text style={[s.attachText, location && { color: C.infoText }]}>
                {location ? "Location added" : "Add location"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.attachBtn, imageUri && s.attachBtnActive]} onPress={pickPhoto}>
              <Ionicons name={imageUri ? "image" : "image-outline"} size={16} color={imageUri ? C.info : C.textMuted} />
              <Text style={[s.attachText, imageUri && { color: C.infoText }]}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.attachBtn} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={16} color={C.textMuted} />
              <Text style={s.attachText}>Camera</Text>
            </TouchableOpacity>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send-outline" size={18} color="#fff" />
            )}
            <Text style={s.submitText}>{submitting ? "Analyzing..." : "Submit Report"}</Text>
          </TouchableOpacity>

          <View style={{ height: SPACING.xl * 2 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Nearby Responders Modal */}
      <Modal visible={showResp} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Nearby Responders</Text>
              <TouchableOpacity onPress={() => setShowResp(false)}>
                <Ionicons name="close-outline" size={24} color={C.text} />
              </TouchableOpacity>
            </View>

            {loadingResp ? (
              <View style={s.modalCenter}>
                <ActivityIndicator size="large" color={C.info} />
                <Text style={s.modalLoading}>Finding responders...</Text>
              </View>
            ) : responders.length > 0 ? (
              <ScrollView style={s.respList} contentContainerStyle={s.respContent}>
                {responders.map((r, idx) => (
                  <View key={idx} style={s.respCard}>
                    <View style={s.respInfo}>
                      <Text style={s.respName}>{r.name}</Text>
                      <Text style={s.respAddr} numberOfLines={1}>{r.address}</Text>
                      <View style={s.respMeta}>
                        <Ionicons name="location" size={13} color={C.info} />
                        <Text style={s.respDist}>{r.distance_km?.toFixed(1)} km</Text>
                        {r.rating && (
                          <>
                            <Text style={s.respDot}>·</Text>
                            <Ionicons name="star" size={13} color="#FFB800" />
                            <Text style={s.respRating}>{r.rating}</Text>
                          </>
                        )}
                      </View>
                    </View>
                    <View style={s.respActions}>
                      <TouchableOpacity
                        style={s.respBtn}
                        onPress={() => Linking.openURL(`https://www.google.com/maps/search/${r.name}/@${r.lat},${r.lng},15z`)}
                      >
                        <Ionicons name="navigate-outline" size={16} color={C.info} />
                      </TouchableOpacity>
                      {r.phone && (
                        <TouchableOpacity style={s.respBtn} onPress={() => Linking.openURL(`tel:${r.phone}`)}>
                          <Ionicons name="call-outline" size={16} color={C.safe} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={s.modalCenter}>
                <Ionicons name="alert-circle-outline" size={40} color={C.textMuted} />
                <Text style={s.modalEmpty}>No responders found nearby</Text>
              </View>
            )}

            <TouchableOpacity style={s.modalDoneBtn} onPress={() => { setShowResp(false); router.back(); }}>
              <Text style={s.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    paddingTop: Platform.OS === "ios" ? 52 : SPACING.lg,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: C.text },

  scroll: { flex: 1 },
  content: { padding: SPACING.lg },

  callout: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm,
    backgroundColor: C.criticalBg, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: C.criticalBorder, padding: SPACING.md, marginBottom: SPACING.lg,
  },
  calloutText: { flex: 1, fontSize: 13, color: C.criticalText, lineHeight: 19 },

  // Result
  resultCard: {
    backgroundColor: C.safeBg, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: C.safeBorder, padding: SPACING.md, marginBottom: SPACING.lg,
  },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.sm },
  resultTitle: { fontSize: 15, fontWeight: "700", color: C.safeText, flex: 1 },
  resultLine: { fontSize: 13, color: C.textSec, marginBottom: 3 },
  resultBold: { fontWeight: "700", color: C.text },
  resultBody: { fontSize: 12, color: C.textSec, lineHeight: 18, marginBottom: 4 },

  // Categories
  label: {
    fontSize: 11, fontWeight: "700", color: C.textDim, textTransform: "uppercase",
    letterSpacing: 0.6, marginBottom: SPACING.sm, marginTop: SPACING.sm,
  },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginBottom: SPACING.md },
  catChip: {
    width: "30%", backgroundColor: C.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: C.border, paddingVertical: SPACING.md,
    alignItems: "center", gap: SPACING.xs,
  },
  catChipActive: { borderColor: C.infoBorder, backgroundColor: C.infoBg },
  catLabel: { fontSize: 10, fontWeight: "500", color: C.textDim },
  catLabelActive: { color: C.infoText },

  // Text area
  textArea: {
    backgroundColor: C.surface, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: C.border, padding: SPACING.md, fontSize: 14, color: C.text,
    minHeight: 100, marginBottom: SPACING.md,
  },

  // Image preview
  imagePreview: { marginBottom: SPACING.md, position: "relative" },
  previewImg: { width: "100%", height: 180, borderRadius: RADIUS.lg, backgroundColor: C.border },
  removeImg: { position: "absolute", top: 8, right: 8 },

  // Attach
  attachRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.lg },
  attachBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: SPACING.xs,
    backgroundColor: C.surface, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: C.border, padding: SPACING.sm, justifyContent: "center",
  },
  attachBtnActive: { borderColor: C.infoBorder, backgroundColor: C.infoBg },
  attachText: { fontSize: 11, color: C.textMuted, fontWeight: "500" },

  // Submit
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: SPACING.sm, backgroundColor: C.info, borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
  },
  submitBtnDisabled: { backgroundColor: C.textDim },
  submitText: { fontSize: 15, fontWeight: "600", color: "#fff" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: C.bg, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg,
    maxHeight: "85%", paddingBottom: SPACING.lg,
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: C.text },
  modalCenter: { justifyContent: "center", alignItems: "center", paddingVertical: SPACING.xl * 2 },
  modalLoading: { fontSize: 14, color: C.textMuted, marginTop: SPACING.md },
  modalEmpty: { fontSize: 14, fontWeight: "600", color: C.text, marginTop: SPACING.md },
  respList: { flex: 1 },
  respContent: { padding: SPACING.lg, gap: SPACING.sm },
  respCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: C.surface,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border,
    padding: SPACING.md, ...SHADOW.card,
  },
  respInfo: { flex: 1 },
  respName: { fontSize: 14, fontWeight: "700", color: C.text },
  respAddr: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  respMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: SPACING.xs },
  respDist: { fontSize: 11, color: C.textMuted },
  respDot: { color: C.textMuted },
  respRating: { fontSize: 11, color: C.textMuted },
  respActions: { flexDirection: "row", gap: SPACING.sm },
  respBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: C.infoBg,
    alignItems: "center", justifyContent: "center",
  },
  modalDoneBtn: {
    marginHorizontal: SPACING.lg, backgroundColor: C.info, borderRadius: RADIUS.md,
    paddingVertical: SPACING.md, alignItems: "center", marginTop: SPACING.md,
  },
  modalDoneText: { fontSize: 14, fontWeight: "600", color: "#fff" },
});
