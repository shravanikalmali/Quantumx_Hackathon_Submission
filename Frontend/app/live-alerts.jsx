import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

const API_URL = 'http://localhost:8080';

export default function LiveAlerts() {
  const [subscribed, setSubscribed] = useState(false);
  const [userId, setUserId] = useState('user_' + Math.random().toString(36).substr(2, 9));
  const [location, setLocation] = useState(null);
  const [radius, setRadius] = useState('10');
  const [minSeverity, setMinSeverity] = useState('0.5');
  const [activeIncidents, setActiveIncidents] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  const [monitoringStatus, setMonitoringStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    getLocation();
    fetchMonitoringStatus();
    const interval = setInterval(fetchMonitoringStatus, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (subscribed) {
      const interval = setInterval(fetchActiveIncidents, 5000); // Check every 5s
      return () => clearInterval(interval);
    }
  }, [subscribed]);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for alerts');
        // Default to Bangalore center
        setLocation({ latitude: 12.9716, longitude: 77.5946 });
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude
      });
    } catch (error) {
      console.error('Error getting location:', error);
      setLocation({ latitude: 12.9716, longitude: 77.5946 });
    }
  };

  const fetchMonitoringStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/alerts/monitoring-status`);
      const data = await response.json();
      setMonitoringStatus(data);
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  const fetchActiveIncidents = async () => {
    try {
      const response = await fetch(`${API_URL}/alerts/active`);
      const data = await response.json();
      setActiveIncidents(data.incidents || []);
    } catch (error) {
      console.error('Error fetching incidents:', error);
    }
  };

  const fetchAlertHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/alerts/history/${userId}`);
      const data = await response.json();
      setAlertHistory(data.alerts || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const handleSubscribe = async () => {
    if (!location) {
      Alert.alert('Error', 'Location not available');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/alerts/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          location: location,
          radius_km: parseFloat(radius),
          min_severity: parseFloat(minSeverity)
        })
      });

      if (response.ok) {
        setSubscribed(true);
        Alert.alert('Success', `Subscribed to alerts within ${radius}km`);
        fetchActiveIncidents();
        fetchAlertHistory();
      } else {
        Alert.alert('Error', 'Failed to subscribe');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/alerts/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });

      if (response.ok) {
        setSubscribed(false);
        Alert.alert('Success', 'Unsubscribed from alerts');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchMonitoringStatus(),
      fetchActiveIncidents(),
      subscribed && fetchAlertHistory()
    ]);
    setRefreshing(false);
  };

  const getRiskColor = (label) => {
    if (label?.includes('critical')) return '#EF4444';
    if (label?.includes('high')) return '#F97316';
    if (label?.includes('medium')) return '#EAB308';
    return '#22C55E';
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>🔴 Live Climate Alerts</Text>
          {monitoringStatus && (
            <View style={styles.statusBadge}>
              <View style={styles.pulse} />
              <Text style={styles.statusText}>LIVE</Text>
            </View>
          )}
        </View>
        <Text style={styles.subtitle}>Real-time monitoring with Quantum ML predictions</Text>
      </View>

      {/* Monitoring Status */}
      {monitoringStatus && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 System Status</Text>
          <View style={styles.statsGrid}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{monitoringStatus.active_incidents_count}</Text>
              <Text style={styles.statLabel}>Active Incidents</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{monitoringStatus.subscribed_users_count}</Text>
              <Text style={styles.statLabel}>Subscribers</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{monitoringStatus.total_alerts_sent}</Text>
              <Text style={styles.statLabel}>Alerts Sent</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>60s</Text>
              <Text style={styles.statLabel}>Check Interval</Text>
            </View>
          </View>
        </View>
      )}

      {/* Subscribe Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {subscribed ? '✅ Subscribed to Alerts' : '🔔 Subscribe to Alerts'}
        </Text>
        
        {!subscribed ? (
          <>
            <Text style={styles.label}>Alert Radius (km)</Text>
            <TextInput
              style={styles.input}
              value={radius}
              onChangeText={setRadius}
              keyboardType="numeric"
              placeholder="10"
            />

            <Text style={styles.label}>Minimum Severity (0-1)</Text>
            <TextInput
              style={styles.input}
              value={minSeverity}
              onChangeText={setMinSeverity}
              keyboardType="numeric"
              placeholder="0.5"
            />

            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubscribe}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Subscribe</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.infoText}>
              You'll receive alerts for incidents within {radius}km
            </Text>
            <TouchableOpacity 
              style={[styles.button, styles.buttonSecondary]}
              onPress={handleUnsubscribe}
            >
              <Text style={styles.buttonText}>Unsubscribe</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Active Incidents */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>⚠️ Active Incidents</Text>
          <Text style={styles.count}>{activeIncidents.length}</Text>
        </View>

        {activeIncidents.length === 0 ? (
          <Text style={styles.emptyText}>No active incidents</Text>
        ) : (
          activeIncidents.map((incident, index) => (
            <View key={index} style={styles.incident}>
              <View style={styles.incidentHeader}>
                <Text style={styles.incidentType}>
                  {incident.incident_type?.replace('_', ' ').toUpperCase()}
                </Text>
                <View style={[styles.riskBadge, { backgroundColor: getRiskColor(incident.qml_prediction?.qml_risk_label) + '20' }]}>
                  <Text style={[styles.riskText, { color: getRiskColor(incident.qml_prediction?.qml_risk_label) }]}>
                    {incident.qml_prediction?.qml_risk_label?.toUpperCase() || 'UNKNOWN'}
                  </Text>
                </View>
              </View>
              
              <Text style={styles.incidentLocation}>
                📍 {incident.location?.area || 'Unknown'}
              </Text>
              
              <Text style={styles.incidentDesc} numberOfLines={2}>
                {incident.description || incident.text}
              </Text>

              {incident.qml_prediction && (
                <View style={styles.prediction}>
                  <Text style={styles.predictionText}>
                    Risk Score: {(incident.qml_prediction.qml_risk_score * 100).toFixed(0)}%
                  </Text>
                  <Text style={styles.predictionText}>
                    Confidence: {(incident.qml_prediction.qml_confidence * 100).toFixed(0)}%
                  </Text>
                </View>
              )}
            </View>
          ))
        )}
      </View>

      {/* Alert History */}
      {subscribed && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>📜 Your Alerts</Text>
            <TouchableOpacity onPress={fetchAlertHistory}>
              <Ionicons name="refresh" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {alertHistory.length === 0 ? (
            <Text style={styles.emptyText}>No alerts yet</Text>
          ) : (
            alertHistory.map((alert, index) => (
              <View key={index} style={styles.alert}>
                <Text style={styles.alertTime}>
                  {new Date(alert.alert_time).toLocaleTimeString()}
                </Text>
                <Text style={styles.alertMessage}>{alert.message}</Text>
                <Text style={styles.alertDistance}>
                  {alert.distance_km}km away
                </Text>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050816',
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F1F5F9',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  statusText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: 'rgba(15,23,42,0.92)',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  count: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#06B6D4',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  stat: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(6,182,212,0.08)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#06B6D4',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  label: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: 'rgba(148,163,184,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    borderRadius: 8,
    padding: 12,
    color: '#F1F5F9',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#06B6D4',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonSecondary: {
    backgroundColor: '#64748B',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoText: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 8,
  },
  incident: {
    backgroundColor: 'rgba(148,163,184,0.06)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  incidentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  incidentType: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F1F5F9',
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  riskText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  incidentLocation: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 6,
  },
  incidentDesc: {
    fontSize: 13,
    color: '#F1F5F9',
    marginBottom: 8,
  },
  prediction: {
    flexDirection: 'row',
    gap: 12,
  },
  predictionText: {
    fontSize: 11,
    color: '#06B6D4',
  },
  alert: {
    backgroundColor: 'rgba(148,163,184,0.06)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  alertTime: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  alertMessage: {
    fontSize: 13,
    color: '#F1F5F9',
    marginBottom: 4,
  },
  alertDistance: {
    fontSize: 11,
    color: '#94A3B8',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
});
