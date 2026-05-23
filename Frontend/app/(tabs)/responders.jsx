import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import ResponderCard from "../../lib/components/ResponderCard";
import { C, SPACING, RADIUS } from "../../lib/constants";

const API_BASE = "http://localhost:8080";

export default function RespondersScreen() {
  const [responders, setResponders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [radius, setRadius] = useState(5);
  const [filter, setFilter] = useState(null);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        fetchNearbyResponders(
          location.coords.latitude,
          location.coords.longitude,
          radius,
          filter
        );
      } else {
        Alert.alert(
          "Permission Denied",
          "Location permission is required to find nearby responders"
        );
      }
    } catch (error) {
      console.error("Location error:", error);
      Alert.alert("Error", "Failed to get your location");
    }
  };

  const fetchNearbyResponders = async (lat, lng, radiusKm, type) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lng: lng.toString(),
        radius_km: radiusKm.toString(),
        max_results: "20",
      });

      if (type) {
        params.append("responder_type", type);
      }

      const response = await fetch(`${API_BASE}/responders/nearby?${params}`);
      const data = await response.json();

      if (data.status === "success") {
        setResponders(data.responders || []);
      } else {
        Alert.alert("Error", "Failed to fetch responders");
      }
    } catch (error) {
      console.error("Fetch error:", error);
      Alert.alert("Error", "Failed to fetch responders");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (userLocation) {
      fetchNearbyResponders(
        userLocation.latitude,
        userLocation.longitude,
        radius,
        filter
      );
    }
  };

  const handleRadiusChange = (newRadius) => {
    setRadius(newRadius);
    if (userLocation) {
      fetchNearbyResponders(
        userLocation.latitude,
        userLocation.longitude,
        newRadius,
        filter
      );
    }
  };

  const handleFilterChange = (type) => {
    const newFilter = filter === type ? null : type;
    setFilter(newFilter);
    if (userLocation) {
      fetchNearbyResponders(
        userLocation.latitude,
        userLocation.longitude,
        radius,
        newFilter
      );
    }
  };

  const filteredResponders = filter
    ? responders.filter((r) => r.type === filter)
    : responders;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Nearby Responders</Text>
        <TouchableOpacity
          style={s.refreshBtn}
          onPress={handleRefresh}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={C.info} />
          ) : (
            <Ionicons name="refresh-outline" size={20} color={C.info} />
          )}
        </TouchableOpacity>
      </View>

      {userLocation && (
        <View style={s.locationInfo}>
          <Ionicons name="location" size={14} color={C.info} />
          <Text style={s.locationText}>
            📍 {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
          </Text>
        </View>
      )}

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.controls}>
          <View style={s.radiusControl}>
            <Text style={s.controlLabel}>Search Radius</Text>
            <View style={s.radiusButtons}>
              {[2, 5, 10, 15].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    s.radiusBtn,
                    radius === r && s.radiusBtnActive,
                  ]}
                  onPress={() => handleRadiusChange(r)}
                >
                  <Text
                    style={[
                      s.radiusBtnText,
                      radius === r && s.radiusBtnTextActive,
                    ]}
                  >
                    {r}km
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.filterControl}>
            <Text style={s.controlLabel}>Filter by Type</Text>
            <View style={s.filterButtons}>
              {[
                { type: "ambulance", label: "🚑 Ambulance" },
                { type: "fire_truck", label: "🚒 Fire" },
                { type: "police", label: "🚔 Police" },
                { type: "medical_team", label: "🏥 Medical" },
              ].map((item) => (
                <TouchableOpacity
                  key={item.type}
                  style={[
                    s.filterBtn,
                    filter === item.type && s.filterBtnActive,
                  ]}
                  onPress={() => handleFilterChange(item.type)}
                >
                  <Text
                    style={[
                      s.filterBtnText,
                      filter === item.type && s.filterBtnTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={s.summary}>
          <Text style={s.summaryText}>
            {loading
              ? "Loading responders..."
              : `Found ${filteredResponders.length} responder${
                  filteredResponders.length !== 1 ? "s" : ""
                }`}
          </Text>
        </View>

        {loading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color={C.info} />
            <Text style={s.loadingText}>Fetching nearby responders...</Text>
          </View>
        ) : filteredResponders.length > 0 ? (
          <View style={s.respondersList}>
            {filteredResponders.map((responder, i) => (
              <ResponderCard
                key={i}
                responder={responder}
                onPress={() => {
                  Alert.alert(
                    responder.name,
                    `Type: ${responder.type.replace(/_/g, " ")}\nDistance: ${responder.distance_km}km\nAddress: ${responder.address}`
                  );
                }}
              />
            ))}
          </View>
        ) : (
          <View style={s.emptyContainer}>
            <Ionicons name="search-outline" size={48} color={C.textMuted} />
            <Text style={s.emptyText}>No responders found</Text>
            <Text style={s.emptySubtext}>
              Try increasing the search radius or check your location
            </Text>
          </View>
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  title: { fontSize: 16, fontWeight: "600", color: C.text },
  refreshBtn: { padding: SPACING.sm },
  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: C.infoBg,
    borderBottomWidth: 1,
    borderBottomColor: C.infoBorder,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  locationText: { fontSize: 12, color: C.infoText },
  scroll: { flex: 1 },
  content: { padding: SPACING.lg },
  controls: { marginBottom: SPACING.lg },
  radiusControl: { marginBottom: SPACING.lg },
  controlLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textMuted,
    marginBottom: SPACING.sm,
    textTransform: "uppercase",
  },
  radiusButtons: { flexDirection: "row", gap: SPACING.sm },
  radiusBtn: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: "center",
  },
  radiusBtnActive: {
    backgroundColor: C.info,
    borderColor: C.info,
  },
  radiusBtnText: { fontSize: 12, fontWeight: "600", color: C.text },
  radiusBtnTextActive: { color: "#fff" },
  filterControl: {},
  filterButtons: { flexDirection: "row", gap: SPACING.sm, flexWrap: "wrap" },
  filterBtn: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  filterBtnActive: {
    backgroundColor: C.info,
    borderColor: C.info,
  },
  filterBtnText: { fontSize: 12, fontWeight: "600", color: C.text },
  filterBtnTextActive: { color: "#fff" },
  summary: {
    backgroundColor: C.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.lg,
  },
  summaryText: { fontSize: 13, fontWeight: "600", color: C.text },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.xl,
  },
  loadingText: { marginTop: SPACING.md, color: C.textMuted, fontSize: 12 },
  respondersList: {},
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.xl,
  },
  emptyText: { fontSize: 14, fontWeight: "600", color: C.text, marginTop: SPACING.md },
  emptySubtext: { fontSize: 12, color: C.textMuted, marginTop: SPACING.sm },
});
