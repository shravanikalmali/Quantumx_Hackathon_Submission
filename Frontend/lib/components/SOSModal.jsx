import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, Modal, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Linking, Animated, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { C, SPACING, RADIUS, SHADOW, GEMINI_API_KEY } from "../constants";
import { transcribeVoice, analyzeIncidentWithGemini, speechToText } from "../services/geminiService";

// Default user info — parent can override via prop
const DEFAULT_USER = {
  name: "Shravani K", phone: "6362043695", gender: "Female",
  bloodGroup: "O+", allergies: "Gluten, Lactose",
};

export default function SOSModal({ visible, onClose, onSubmit, userInfo }) {
  const user = { ...DEFAULT_USER, ...(userInfo || {}) };

  const [mode, setMode] = useState(null); // "voice" or "text"
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState(null);
  const [locationInput, setLocationInput] = useState("");
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [responders, setResponders] = useState([]);
  const [showResponders, setShowResponders] = useState(false);
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [audioRecorder, setAudioRecorder] = useState(null);
  const [audioUri, setAudioUri] = useState(null);
  
  // AI analysis states
  const [analysis, setAnalysis] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Publish personal info states
  const [showPublishPrompt, setShowPublishPrompt] = useState(false);
  const [shareGender, setShareGender] = useState(true);
  const [sharePhone, setSharePhone] = useState(true);
  const [shareLocation, setShareLocation] = useState(true);
  const [shareBlood, setShareBlood] = useState(true);
  const [shareAllergies, setShareAllergies] = useState(true);
  
  const recordingAnim = useRef(new Animated.Value(0)).current;
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

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
      type: "police",
      emoji: "🚔",
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
      type: "police",
      emoji: "🚔",
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
      type: "police",
      emoji: "🚔",
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
      type: "police",
      emoji: "🚔",
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
      type: "police",
      emoji: "🚔",
    },
  ];

  const getCurrentLocation = useCallback(async () => {
    setFetchingLocation(true);
    try {
      if (Platform.OS === 'web') {
        // Use browser Geolocation API
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const lat = position.coords.latitude;
              const lng = position.coords.longitude;
              setLocation({ lat, lng });
              setLocationInput(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
              setFetchingLocation(false);
            },
            (error) => {
              Alert.alert("Location Error", "Could not get your location. Please enter manually.");
              setFetchingLocation(false);
            }
          );
        } else {
          Alert.alert("Not Supported", "Geolocation is not supported. Please enter location manually.");
          setFetchingLocation(false);
        }
      } else {
        // Use expo-location for native
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Denied", "Location permission needed. Please enter location manually.");
          setFetchingLocation(false);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation({ lat, lng });
        setLocationInput(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        setFetchingLocation(false);
      }
    } catch (e) {
      console.log("Location error:", e);
      Alert.alert("Error", "Could not get location. Please enter manually.");
      setFetchingLocation(false);
    }
  }, []);

  const parseLocationInput = useCallback((input) => {
    const parts = input.split(',').map(p => p.trim());
    if (parts.length === 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        setLocation({ lat, lng });
        return true;
      }
    }
    return false;
  }, []);

  // Listen for location selection from map
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data.type === 'location_selected') {
          setLocation({ lat: data.lat, lng: data.lng });
          setLocationInput(`${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}`);
        }
      } catch (_) {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Start voice recording using Web Speech API (real transcription)
  const startVoiceRecording = useCallback(async () => {
    try {
      setIsRecording(true);
      setTranscribedText("");

      if (Platform.OS === "web" && typeof window !== "undefined") {
        // Use Web Speech API for real-time transcription in browser
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
          Alert.alert("Not supported", "Speech recognition is not supported in this browser. Use Chrome.");
          setIsRecording(false);
          return;
        }
        
        const recognition = new SpeechRecognition();
        recognition.lang = "en-IN";
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
          let finalTranscript = "";
          let interimTranscript = "";
          for (let i = 0; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          setTranscribedText(finalTranscript || interimTranscript);
        };

        recognition.onerror = (event) => {
          console.error("Speech recognition error:", event.error);
          if (event.error !== "aborted") {
            Alert.alert("Error", "Speech recognition error: " + event.error);
          }
          setIsRecording(false);
        };

        recognition.onend = () => {
          // Only update if we didn't manually stop
        };

        recognition.start();
        mediaRecorderRef.current = recognition;
      }
      
      // Animate recording indicator
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordingAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
          Animated.timing(recordingAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
        ])
      ).start();
    } catch (e) {
      console.log("Recording error:", e);
      Alert.alert("Error", "Could not start recording: " + e.message);
      setIsRecording(false);
    }
  }, [recordingAnim]);

  // Stop voice recording
  const stopVoiceRecording = useCallback(async () => {
    setIsRecording(false);
    recordingAnim.setValue(0);
    
    try {
      if (Platform.OS === "web" && mediaRecorderRef.current) {
        // Stop Web Speech API recognition
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
      // transcribedText is already set by onresult callback in real time
    } catch (error) {
      console.error("Stop recording error:", error);
    }
  }, [recordingAnim]);

  // AI analysis of incident using Gemini
  const analyzeIncident = useCallback(async (text) => {
    if (!text.trim()) {
      Alert.alert("Required", "Please describe the emergency.");
      return;
    }

    setAnalyzing(true);
    try {
      // Use Gemini API for analysis (faster, no backend dependency)
      const geminiAnalysis = await analyzeIncidentWithGemini(text);
      
      if (geminiAnalysis) {
        setAnalysis({
          type: geminiAnalysis.incident_type || "unknown",
          severity: geminiAnalysis.severity_score || 0.5,
          urgency: geminiAnalysis.urgency_level || "medium",
          escalation: geminiAnalysis.escalation_probability || 0.3,
          resources: geminiAnalysis.recommended_resources || [],
          summary: geminiAnalysis.summary || text,
        });
      } else {
        // Fallback to backend if Gemini fails
        const formData = new FormData();
        formData.append("text", text);
        if (location?.lat) formData.append("latitude", location.lat.toString());
        if (location?.lng) formData.append("longitude", location.lng.toString());

        const response = await fetch("http://localhost:8080/report", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();
        const incident = result.incident || {};
        setAnalysis({
          type: incident.incident_type || "unknown",
          severity: incident.severity_score || 0.5,
          urgency: incident.urgency_level || "medium",
          escalation: incident.escalation_probability || 0.3,
          resources: incident.recommended_resources || [],
          summary: incident.summary || text,
        });
      }
      
      setShowConfirmation(true);
    } catch (e) {
      console.log("Analysis error:", e);
      Alert.alert("Error", "Could not analyze incident. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }, [location]);

  const fetchNearbyResponders = useCallback(async (lat, lng, responderType) => {
    try {
      // Map incident type to Google Maps place types
      const placeTypeMap = {
        fire_station: { keyword: "fire station", types: "fire_station", emoji: "🚒" },
        hospital: { keyword: "hospital emergency", types: "hospital", emoji: "🏥" },
        police: { keyword: "police station", types: "police", emoji: "🚔" },
        emergency_center: { keyword: "hospital", types: "hospital", emoji: "🏥" },
      };
      const placeInfo = placeTypeMap[responderType] || placeTypeMap.hospital;

      // Use Google Maps Places Nearby Search API
      const radius = 5000; // 5km
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&keyword=${encodeURIComponent(placeInfo.keyword)}&type=${placeInfo.types}&key=${GEMINI_API_KEY}`;
      
      let results = [];
      try {
        const response = await fetch(url);
        const data = await response.json();
        results = data.results || [];
      } catch (fetchErr) {
        console.log("Google Maps API not reachable, using CORS proxy...");
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
          type: responderType,
          emoji: placeInfo.emoji,
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
      setShowResponders(true);
    } catch (e) {
      console.log("Responder fetch error:", e);
      Alert.alert("Error", "Could not find nearby responders.");
    }
  }, []);

  // Haversine distance in km
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // After confirm analysis, ask to publish info
  const confirmAndAskPublish = useCallback(() => {
    setShowConfirmation(false);
    setShowPublishPrompt(true);
  }, []);

  // Actually dispatch (after publish prompt)
  const doDispatch = useCallback(async () => {
    if (!analysis || !location) {
      Alert.alert("Error", "Missing analysis or location data.");
      return;
    }
    setSubmitting(true);
    setShowPublishPrompt(false);
    try {
      const typeMap = {
        fire: "fire_station", flood: "emergency_center",
        road_accident: "police", medical_emergency: "hospital",
        power_outage: "emergency_center", infrastructure_failure: "emergency_center",
        crowd_risk: "police", hazardous_material: "emergency_center",
        rescue_required: "emergency_center",
      };
      const responderType = typeMap[analysis.type] || "emergency_center";
      await fetchNearbyResponders(location.lat, location.lng, responderType);
    } catch (e) {
      Alert.alert("Error", "Could not fetch responders. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [analysis, location, fetchNearbyResponders]);

  // Reject and go back
  const rejectAnalysis = useCallback(() => {
    setShowConfirmation(false);
    setAnalysis(null);
    setTranscribedText("");
    setDescription("");
    setMode(null);
  }, []);

  const handleClose = () => {
    setMode(null);
    setDescription("");
    setLocation(null);
    setResponders([]);
    setShowResponders(false);
    setIsRecording(false);
    setTranscribedText("");
    setAnalyzing(false);
    setAnalysis(null);
    setShowConfirmation(false);
    setShowPublishPrompt(false);
    setSubmitting(false);
    recordingAnim.setValue(0);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.container}>
          {/* Main SOS Screen */}
          {!mode && !showResponders && (
            <>
              <View style={s.header}>
                <Ionicons name="alert-circle" size={32} color={C.critical} />
                <Text style={s.title}>Emergency SOS</Text>
                <TouchableOpacity onPress={handleClose}>
                  <Ionicons name="close-outline" size={24} color={C.text} />
                </TouchableOpacity>
              </View>

              <Text style={s.subtitle}>How do you want to report?</Text>

              <View style={s.modeButtons}>
                <TouchableOpacity
                  style={s.modeBtn}
                  onPress={() => setMode("voice")}
                >
                  <Ionicons name="mic-outline" size={32} color={C.critical} />
                  <Text style={s.modeBtnText}>Voice</Text>
                  <Text style={s.modeBtnDesc}>Speak your emergency</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.modeBtn}
                  onPress={() => setMode("text")}
                >
                  <Ionicons name="create-outline" size={32} color={C.critical} />
                  <Text style={s.modeBtnText}>Text</Text>
                  <Text style={s.modeBtnDesc}>Type your emergency</Text>
                </TouchableOpacity>
              </View>

              <View style={s.emergencyInfo}>
                <Ionicons name="call-outline" size={16} color={C.critical} />
                <Text style={s.emergencyText}>
                  For immediate help, call <Text style={{ fontWeight: "700" }}>112</Text>
                </Text>
              </View>

              <TouchableOpacity style={s.closeBtn} onPress={handleClose}>
                <Text style={s.closeBtnText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Text Input Screen */}
          {mode === "text" && !showResponders && !showConfirmation && (
            <>
              <View style={s.header}>
                <Text style={s.title}>Describe the Emergency</Text>
                <TouchableOpacity onPress={handleClose}>
                  <Ionicons name="close-outline" size={24} color={C.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={s.content} contentContainerStyle={s.contentPadding}>
                <TextInput
                  style={s.textInput}
                  placeholder="What is happening? Be specific..."
                  placeholderTextColor={C.textDim}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  value={description}
                  onChangeText={setDescription}
                  editable={!submitting}
                />

                <View style={s.locationSection}>
                  <View style={s.locationHeader}>
                    <Text style={s.label}>Tap on map to set location</Text>
                    <TouchableOpacity
                      style={s.currentLocBtn}
                      onPress={getCurrentLocation}
                      disabled={fetchingLocation}
                    >
                      {fetchingLocation ? (
                        <ActivityIndicator size="small" color={C.info} />
                      ) : (
                        <Ionicons name="locate" size={18} color={C.info} />
                      )}
                    </TouchableOpacity>
                  </View>
                  
                  {Platform.OS === 'web' ? (
                    <iframe
                      srcDoc={`
                        <html>
                        <head>
                          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
                          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
                          <style>
                            body,html,#map{margin:0;padding:0;width:100%;height:100%;background:#f0f4f8;}
                            .leaflet-container{background:#e8f4fd;cursor:crosshair;}
                          </style>
                        </head>
                        <body>
                          <div id="map"></div>
                          <script>
                            const map = L.map('map').setView([${location?.lat || 12.9716}, ${location?.lng || 77.5946}], 13);
                            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {maxZoom: 19}).addTo(map);
                            
                            let marker = null;
                            ${location ? `marker = L.marker([${location.lat}, ${location.lng}]).addTo(map);` : ''}
                            
                            map.on('click', function(e) {
                              const lat = e.latlng.lat;
                              const lng = e.latlng.lng;
                              
                              if (marker) map.removeLayer(marker);
                              marker = L.marker([lat, lng]).addTo(map);
                              
                              window.parent.postMessage(JSON.stringify({
                                type: 'location_selected',
                                lat: lat,
                                lng: lng
                              }), '*');
                            });
                          </script>
                        </body>
                        </html>
                      `}
                      style={{ width: '100%', height: '250px', border: '1px solid #e5e7eb', borderRadius: '8px', marginTop: '8px' }}
                      title="Location picker"
                    />
                  ) : (
                    <View style={s.mapPlaceholder}>
                      <Ionicons name="map-outline" size={40} color={C.textMuted} />
                      <Text style={s.mapPlaceholderText}>Map picker only available on web</Text>
                      <Text style={s.mapPlaceholderSubtext}>Use "Current Location" button above</Text>
                    </View>
                  )}
                  
                  {location && (
                    <View style={s.locationStatus}>
                      <Ionicons name="checkmark-circle" size={14} color={C.safe} />
                      <Text style={s.locationStatusText}>
                        Location: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>

              <View style={s.footer}>
                <TouchableOpacity
                  style={[s.submitBtn, (!description.trim() || !location || analyzing) && s.submitBtnDisabled]}
                  onPress={() => analyzeIncident(description)}
                  disabled={!description.trim() || !location || submitting || analyzing}
                >
                  {(submitting || analyzing) ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send-outline" size={18} color="#fff" />
                  )}
                  <Text style={s.submitBtnText}>
                    {analyzing ? "Analyzing..." : submitting ? "Sending..." : !location ? "Set location first" : "Analyze & Send SOS"}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Voice Input Screen */}
          {mode === "voice" && !showResponders && !showConfirmation && (
            <>
              <View style={s.header}>
                <Text style={s.title}>Voice Emergency Report</Text>
                <TouchableOpacity onPress={handleClose}>
                  <Ionicons name="close-outline" size={24} color={C.text} />
                </TouchableOpacity>
              </View>

              <View style={s.voiceContent}>
                {!isRecording ? (
                  <>
                    <TouchableOpacity
                      style={s.recordButton}
                      onPress={startVoiceRecording}
                      disabled={analyzing}
                    >
                      <Ionicons name="mic-circle-outline" size={80} color={C.critical} />
                    </TouchableOpacity>
                    <Text style={s.voiceText}>
                      Tap the microphone and speak your emergency clearly
                    </Text>
                  </>
                ) : (
                  <>
                    <Animated.View
                      style={[
                        s.recordingIndicator,
                        {
                          opacity: recordingAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.5, 1],
                          }),
                        },
                      ]}
                    >
                      <Ionicons name="mic-circle" size={80} color={C.critical} />
                    </Animated.View>
                    <Text style={s.recordingText}>Recording...</Text>
                    <Text style={s.recordingHint}>Speak now</Text>
                    <TouchableOpacity
                      style={s.stopRecordBtn}
                      onPress={stopVoiceRecording}
                    >
                      <Ionicons name="stop-circle" size={24} color="#fff" />
                      <Text style={s.stopRecordBtnText}>Stop Recording</Text>
                    </TouchableOpacity>
                  </>
                )}

                {transcribedText && (
                  <View style={s.transcriptionBox}>
                    <Text style={s.transcriptionLabel}>Transcribed:</Text>
                    <TextInput
                      style={s.transcriptionInput}
                      value={transcribedText}
                      onChangeText={setTranscribedText}
                      multiline
                      editable={!analyzing}
                      placeholder="Edit transcription here..."
                      placeholderTextColor={C.textDim}
                    />
                  </View>
                )}

                {analyzing && (
                  <View style={s.analyzingBox}>
                    <ActivityIndicator size="small" color={C.info} />
                    <Text style={s.analyzingText}>Analyzing incident...</Text>
                  </View>
                )}
              </View>

              <View style={s.footer}>
                {transcribedText && !analyzing && (
                  <TouchableOpacity
                    style={s.analyzeVoiceBtn}
                    onPress={() => analyzeIncident(transcribedText)}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={s.analyzeVoiceBtnText}>Analyze</Text>
                  </TouchableOpacity>
                )}
                {!isRecording && !transcribedText && (
                  <TouchableOpacity
                    style={s.switchBtn}
                    onPress={() => setMode("text")}
                    disabled={analyzing}
                  >
                    <Text style={s.switchBtnText}>Switch to Text</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {/* Confirmation Screen - AI Analysis Results */}
          {showConfirmation && analysis && !showResponders && (
            <>
              <View style={s.header}>
                <Text style={s.title}>Incident Analysis</Text>
                <TouchableOpacity onPress={rejectAnalysis}>
                  <Ionicons name="close-outline" size={24} color={C.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={s.content} contentContainerStyle={s.contentPadding}>
                <View style={s.analysisCard}>
                  <View style={s.analysisHeader}>
                    <Text style={s.analysisTitle}>Detected Incident Type</Text>
                    <Text style={s.incidentType}>{analysis.type.replace(/_/g, " ").toUpperCase()}</Text>
                  </View>

                  <View style={s.severityRow}>
                    <Text style={s.severityLabel}>Severity Level</Text>
                    <View style={s.severityBar}>
                      <View
                        style={[
                          s.severityFill,
                          {
                            width: `${analysis.severity * 100}%`,
                            backgroundColor:
                              analysis.severity > 0.7
                                ? C.critical
                                : analysis.severity > 0.4
                                ? "#EA580C"
                                : C.safe,
                          },
                        ]}
                      />
                    </View>
                    <Text style={s.severityPercent}>{Math.round(analysis.severity * 100)}%</Text>
                  </View>

                  <View style={s.metaRow}>
                    <View style={s.metaItem}>
                      <Text style={s.metaLabel}>Urgency</Text>
                      <Text style={s.metaValue}>{analysis.urgency}</Text>
                    </View>
                    <View style={s.metaItem}>
                      <Text style={s.metaLabel}>Escalation Risk</Text>
                      <Text style={s.metaValue}>{Math.round(analysis.escalation * 100)}%</Text>
                    </View>
                  </View>

                  <View style={s.summaryBox}>
                    <Text style={s.summaryLabel}>Summary</Text>
                    <Text style={s.summaryText}>{analysis.summary}</Text>
                  </View>

                  {analysis.resources.length > 0 && (
                    <View style={s.resourcesBox}>
                      <Text style={s.resourcesLabel}>Recommended Resources</Text>
                      <View style={s.resourcesList}>
                        {analysis.resources.map((resource, idx) => (
                          <View key={idx} style={s.resourceTag}>
                            <Ionicons name="checkmark-circle" size={14} color={C.safe} />
                            <Text style={s.resourceText}>{resource.replace(/_/g, " ")}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                <Text style={s.confirmQuestion}>Is this analysis correct?</Text>
              </ScrollView>

              <View style={[s.footer, { flexDirection: "row", gap: SPACING.md }]}>
                <TouchableOpacity
                  style={[s.rejectBtn]}
                  onPress={rejectAnalysis}
                  disabled={submitting}
                >
                  <Ionicons name="close-outline" size={18} color={C.critical} />
                  <Text style={s.rejectBtnText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.confirmBtn, submitting && s.submitBtnDisabled]}
                  onPress={confirmAndAskPublish}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="checkmark-outline" size={18} color="#fff" />
                  )}
                  <Text style={s.confirmBtnText}>
                    {submitting ? "Fetching..." : "Confirm & Continue"}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Publish Personal Info Screen */}
          {showPublishPrompt && !showResponders && (
            <>
              <View style={s.header}>
                <Ionicons name="person-circle-outline" size={24} color={C.info} />
                <Text style={s.title}>Share Your Info?</Text>
                <TouchableOpacity onPress={() => { setShowPublishPrompt(false); doDispatch(); }}>
                  <Ionicons name="close-outline" size={24} color={C.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={s.content} contentContainerStyle={s.contentPadding}>
                <Text style={s.publishDesc}>
                  Would you like to share your personal details with emergency responders? This helps them prepare appropriate care.
                </Text>

                <View style={s.publishCard}>
                  <PublishToggle label="Gender" value={user.gender} checked={shareGender} onToggle={() => setShareGender(!shareGender)} icon="male-female-outline" />
                  <PublishToggle label="Phone" value={user.phone} checked={sharePhone} onToggle={() => setSharePhone(!sharePhone)} icon="call-outline" />
                  <PublishToggle label="Location" value={location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "Acquired"} checked={shareLocation} onToggle={() => setShareLocation(!shareLocation)} icon="location-outline" />
                  <PublishToggle label="Blood Group" value={user.bloodGroup} checked={shareBlood} onToggle={() => setShareBlood(!shareBlood)} icon="water-outline" />
                  <PublishToggle label="Allergies" value={user.allergies || "None"} checked={shareAllergies} onToggle={() => setShareAllergies(!shareAllergies)} icon="medkit-outline" last />
                </View>
              </ScrollView>

              <View style={[s.footer, { flexDirection: "row", gap: SPACING.md }]}>
                <TouchableOpacity style={s.rejectBtn} onPress={doDispatch}>
                  <Text style={s.rejectBtnText}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.confirmBtn, submitting && s.submitBtnDisabled]}
                  onPress={doDispatch}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="share-outline" size={18} color="#fff" />
                  )}
                  <Text style={s.confirmBtnText}>
                    {submitting ? "Dispatching..." : "Share & Dispatch"}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Responders Screen */}
          {showResponders && (
            <>
              <View style={s.header}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: SPACING.sm}}>
                  <Ionicons name="navigate-circle" size={24} color={C.critical} />
                  <Text style={s.title}>Nearest Responders</Text>
                </View>
                <TouchableOpacity onPress={handleClose}>
                  <Ionicons name="close-outline" size={24} color={C.text} />
                </TouchableOpacity>
              </View>

              {responders.length > 0 ? (
                <ScrollView style={s.respondersList} contentContainerStyle={s.respondersContent}>
                  <Text style={{fontSize: 12, color: C.textMuted, marginBottom: SPACING.sm, paddingHorizontal: SPACING.lg}}>
                    {responders.length} responders found within 5km - sorted by distance
                  </Text>
                  {responders.map((responder, idx) => (
                    <ResponderItem key={idx} responder={responder} index={idx} />
                  ))}
                </ScrollView>
              ) : (
                <View style={s.emptyState}>
                  <Ionicons name="alert-circle-outline" size={48} color={C.textMuted} />
                  <Text style={s.emptyText}>No responders found nearby</Text>
                  <Text style={{fontSize: 12, color: C.textDim, marginTop: SPACING.xs}}>Try expanding your search area</Text>
                </View>
              )}

              <View style={s.footer}>
                <TouchableOpacity style={s.doneBtn} onPress={handleClose}>
                  <Text style={s.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function PublishToggle({ label, value, checked, onToggle, icon, last }) {
  return (
    <TouchableOpacity
      style={[s.publishRow, !last && s.publishRowBorder]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={s.publishLeft}>
        <Ionicons name={icon} size={16} color={checked ? C.info : C.textDim} />
        <View>
          <Text style={s.publishLabel}>{label}</Text>
          <Text style={s.publishValue}>{value}</Text>
        </View>
      </View>
      <Ionicons
        name={checked ? "checkbox" : "square-outline"}
        size={22}
        color={checked ? C.info : C.textDim}
      />
    </TouchableOpacity>
  );
}

function ResponderItem({ responder, index }) {
  const openMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${responder.lat},${responder.lng}&destination_place_id=&travelmode=driving`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const callResponder = () => {
    if (responder.phone) {
      Linking.openURL(`tel:${responder.phone}`);
    } else {
      Linking.openURL(`tel:112`);
    }
  };

  const typeColors = {
    fire_station: { bg: '#FEF2F2', border: '#FECACA', icon: '🚒' },
    hospital: { bg: '#EFF6FF', border: '#BFDBFE', icon: '🏥' },
    police: { bg: '#F0FDF4', border: '#BBF7D0', icon: '🚔' },
    emergency_center: { bg: '#FFF7ED', border: '#FED7AA', icon: '🏥' },
  };
  const tc = typeColors[responder.type] || typeColors.hospital;

  return (
    <View style={[s.responderItem, { backgroundColor: tc.bg, borderColor: tc.border }]}>
      <View style={s.responderInfo}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
          <Text style={{fontSize: 18}}>{responder.emoji || tc.icon}</Text>
          <View style={{flex: 1}}>
            <Text style={s.responderName} numberOfLines={1}>{responder.name}</Text>
            <Text style={s.responderAddress} numberOfLines={1}>{responder.address}</Text>
          </View>
        </View>
        <View style={s.responderMeta}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
            <Ionicons name="location" size={12} color={C.info} />
            <Text style={s.responderDist}>
              {responder.distance_km?.toFixed(1)} km
            </Text>
          </View>
          {responder.rating && (
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 3}}>
              <Ionicons name="star" size={12} color="#EAB308" />
              <Text style={{fontSize: 11, color: C.textSec}}>{responder.rating}</Text>
            </View>
          )}
          {responder.open_now !== undefined && (
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 3}}>
              <View style={{width: 6, height: 6, borderRadius: 3, backgroundColor: responder.open_now ? C.safe : C.critical}} />
              <Text style={{fontSize: 11, color: responder.open_now ? C.safe : C.critical}}>
                {responder.open_now ? 'Open' : 'Closed'}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={s.responderActions}>
        <TouchableOpacity style={s.actionBtn} onPress={openMaps}>
          <Ionicons name="navigate-outline" size={16} color={C.info} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, s.callBtn]} onPress={callResponder}>
          <Ionicons name="call-outline" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "90%",
    maxHeight: "90%",
    backgroundColor: C.bg,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    ...SHADOW.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: C.text,
    flex: 1,
    marginLeft: SPACING.md,
  },
  subtitle: {
    fontSize: 14,
    color: C.textMuted,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  modeButtons: {
    flexDirection: "row",
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  modeBtn: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.border,
    padding: SPACING.md,
    alignItems: "center",
    gap: SPACING.sm,
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: C.text,
  },
  modeBtnDesc: {
    fontSize: 11,
    color: C.textMuted,
  },
  emergencyInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: C.criticalBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.criticalBorder,
  },
  emergencyText: {
    fontSize: 12,
    color: C.criticalText,
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentPadding: {
    padding: SPACING.lg,
  },
  textInput: {
    backgroundColor: C.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.border,
    padding: SPACING.md,
    fontSize: 14,
    color: C.text,
    minHeight: 120,
    marginBottom: SPACING.lg,
  },
  locationSection: {
    marginTop: SPACING.lg,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: C.text,
    marginBottom: SPACING.sm,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  locationInput: {
    flex: 1,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 14,
    color: C.text,
  },
  currentLocBtn: {
    width: 44,
    height: 44,
    backgroundColor: C.infoBg,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.infoBorder,
  },
  locationStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  locationStatusText: {
    fontSize: 11,
    color: C.safeText,
    fontWeight: "600",
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mapPlaceholder: {
    height: 250,
    backgroundColor: C.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.sm,
  },
  mapPlaceholderText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.textMuted,
    marginTop: SPACING.sm,
  },
  mapPlaceholderSubtext: {
    fontSize: 11,
    color: C.textDim,
    marginTop: SPACING.xs,
  },
  voiceContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: SPACING.xl,
  },
  voiceIcon: {
    marginBottom: SPACING.lg,
  },
  voiceText: {
    fontSize: 14,
    color: C.textMuted,
    textAlign: "center",
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  switchBtn: {
    backgroundColor: C.info,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  switchBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: C.critical,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
  },
  submitBtnDisabled: {
    backgroundColor: C.textDim,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  doneBtn: {
    backgroundColor: C.info,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: "center",
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  closeBtn: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    backgroundColor: C.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: SPACING.md,
    alignItems: "center",
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.text,
  },
  respondersList: {
    flex: 1,
  },
  respondersContent: {
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: C.textMuted,
    marginTop: SPACING.md,
  },
  responderItem: {
    backgroundColor: C.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.border,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  responderInfo: {
    flex: 1,
  },
  responderName: {
    fontSize: 13,
    fontWeight: "700",
    color: C.text,
    marginBottom: 2,
  },
  responderAddress: {
    fontSize: 11,
    color: C.textMuted,
    marginBottom: SPACING.xs,
  },
  responderMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  responderDist: {
    fontSize: 10,
    color: C.textMuted,
  },
  responderActions: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: C.infoBg,
    justifyContent: "center",
    alignItems: "center",
  },
  callBtn: {
    backgroundColor: C.critical,
  },

  // Voice Recording Styles
  recordButton: {
    marginBottom: SPACING.lg,
  },
  recordingIndicator: {
    marginBottom: SPACING.lg,
  },
  recordingText: {
    fontSize: 16,
    fontWeight: "700",
    color: C.critical,
    marginBottom: SPACING.sm,
  },
  recordingHint: {
    fontSize: 12,
    color: C.textMuted,
  },
  transcriptionBox: {
    backgroundColor: C.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.border,
    padding: SPACING.md,
    marginTop: SPACING.lg,
  },
  transcriptionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: C.textMuted,
    textTransform: "uppercase",
    marginBottom: SPACING.xs,
  },
  transcriptionText: {
    fontSize: 13,
    color: C.text,
    lineHeight: 19,
  },
  analyzingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: C.infoBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.lg,
  },
  analyzingText: {
    fontSize: 12,
    color: C.infoText,
    fontWeight: "600",
  },

  // Analysis Confirmation Styles
  analysisCard: {
    backgroundColor: C.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  analysisHeader: {
    marginBottom: SPACING.lg,
  },
  analysisTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: C.textMuted,
    textTransform: "uppercase",
    marginBottom: SPACING.sm,
  },
  incidentType: {
    fontSize: 20,
    fontWeight: "700",
    color: C.critical,
  },
  severityRow: {
    marginBottom: SPACING.lg,
  },
  severityLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: C.text,
    marginBottom: SPACING.sm,
  },
  severityBar: {
    height: 8,
    backgroundColor: C.border,
    borderRadius: RADIUS.pill,
    overflow: "hidden",
    marginBottom: SPACING.sm,
  },
  severityFill: {
    height: "100%",
    borderRadius: RADIUS.pill,
  },
  severityPercent: {
    fontSize: 12,
    fontWeight: "700",
    color: C.text,
  },
  metaRow: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  metaItem: {
    flex: 1,
    backgroundColor: C.bg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  metaLabel: {
    fontSize: 10,
    color: C.textMuted,
    marginBottom: SPACING.xs,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: "700",
    color: C.text,
  },
  summaryBox: {
    backgroundColor: C.bg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: C.textMuted,
    marginBottom: SPACING.sm,
  },
  summaryText: {
    fontSize: 13,
    color: C.text,
    lineHeight: 19,
  },
  resourcesBox: {
    backgroundColor: C.bg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  resourcesLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: C.textMuted,
    marginBottom: SPACING.sm,
  },
  resourcesList: {
    gap: SPACING.sm,
  },
  resourceTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: C.safeBg,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  resourceText: {
    fontSize: 12,
    color: C.safeText,
    fontWeight: "500",
  },
  confirmQuestion: {
    fontSize: 14,
    fontWeight: "600",
    color: C.text,
    textAlign: "center",
    marginBottom: SPACING.lg,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: C.criticalBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.criticalBorder,
    paddingVertical: SPACING.md,
  },
  rejectBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.critical,
  },
  confirmBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: C.safe,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  // Publish personal info styles
  publishDesc: {
    fontSize: 13,
    color: C.textMuted,
    lineHeight: 19,
    marginBottom: SPACING.lg,
  },
  publishCard: {
    backgroundColor: C.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  publishRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  publishRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  publishLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    flex: 1,
  },
  publishLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: C.text,
  },
  publishValue: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 1,
  },
  stopRecordBtn: {
    marginTop: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: C.critical,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  stopRecordBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  transcriptionInput: {
    backgroundColor: C.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.border,
    padding: SPACING.md,
    fontSize: 13,
    color: C.text,
    minHeight: 80,
    marginBottom: SPACING.md,
  },
  analyzeVoiceBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: C.safe,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
  },
  analyzeVoiceBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
