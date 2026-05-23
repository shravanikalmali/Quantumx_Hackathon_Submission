// Incident Cache with TTL (Time To Live)
// Stores live incidents with 3-hour expiration
// Works on Web, iOS, and Android

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
const CACHE_KEY = 'resq_live_incidents_cache';

// Storage adapter for web and React Native
const storage = {
  getItem: async (key) => {
    try {
      // Try AsyncStorage first (mobile)
      const value = await AsyncStorage.getItem(key);
      return value;
    } catch (e) {
      // Fallback to localStorage (web)
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    }
  },
  setItem: async (key, value) => {
    try {
      // Try AsyncStorage first (mobile)
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      // Fallback to localStorage (web)
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    }
  }
};

class IncidentCache {
  constructor() {
    this.cache = { incidents: [], timestamp: Date.now() };
    this.initialized = false;
    this.initPromise = this.initialize();
  }

  async initialize() {
    await this.loadFromStorage();
    this.cleanExpired();
    this.initialized = true;
  }

  async loadFromStorage() {
    try {
      const stored = await storage.getItem(CACHE_KEY);
      if (stored) {
        this.cache = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load cache:', e);
    }
  }

  async saveToStorage() {
    try {
      await storage.setItem(CACHE_KEY, JSON.stringify(this.cache));
    } catch (e) {
      console.error('Failed to save cache:', e);
    }
  }

  cleanExpired() {
    const now = Date.now();
    const validIncidents = this.cache.incidents.filter(inc => {
      const age = now - (inc.cached_at || inc.timestamp || 0);
      return age < CACHE_TTL;
    });
    
    if (validIncidents.length !== this.cache.incidents.length) {
      this.cache.incidents = validIncidents;
      this.cache.timestamp = now;
      this.saveToStorage();
    }
  }

  async addIncidents(newIncidents) {
    await this.initPromise;
    if (!Array.isArray(newIncidents)) return;
    
    const now = Date.now();
    const incidentsWithTimestamp = newIncidents.map(inc => ({
      ...inc,
      cached_at: now,
      cache_id: inc.id || `${inc.incident_type}_${now}_${Math.random()}`
    }));

    // Merge with existing, avoiding duplicates
    const existingIds = new Set(this.cache.incidents.map(i => i.cache_id || i.id));
    const uniqueNew = incidentsWithTimestamp.filter(inc => 
      !existingIds.has(inc.cache_id) && !existingIds.has(inc.id)
    );

    this.cache.incidents = [...this.cache.incidents, ...uniqueNew];
    this.cache.timestamp = now;
    this.cleanExpired();
    await this.saveToStorage();
  }

  async getAll() {
    await this.initPromise;
    this.cleanExpired();
    return this.cache.incidents;
  }

  async getByJurisdiction(jurisdictionName) {
    const all = await this.getAll();
    if (!jurisdictionName) return all;
    
    const cleanName = jurisdictionName.toLowerCase().replace(/\s*traffic\s*ps\s*$/i, '').trim();
    return all.filter(inc => {
      const incArea = (inc.area_name || inc.location || inc.jurisdiction || '').toLowerCase();
      return incArea.includes(cleanName) || cleanName.includes(incArea);
    });
  }

  async clear() {
    await this.initPromise;
    this.cache = { incidents: [], timestamp: Date.now() };
    await this.saveToStorage();
  }

  async getStats() {
    const all = await this.getAll();
    const now = Date.now();
    
    return {
      total: all.length,
      oldest: all.length > 0 ? Math.min(...all.map(i => i.cached_at || now)) : null,
      newest: all.length > 0 ? Math.max(...all.map(i => i.cached_at || now)) : null,
      ttl_hours: CACHE_TTL / (60 * 60 * 1000)
    };
  }
}

// Mock incident data for testing
const MOCK_INCIDENTS = [
  {
    id: 'mock_1',
    incident_type: 'fire',
    area_name: 'Koramangala',
    location: 'Koramangala 5th Block',
    severity_score: 0.85,
    summary: 'Building fire reported near Sony Signal',
    timestamp: Date.now() - 30 * 60 * 1000 // 30 minutes ago
  },
  {
    id: 'mock_2',
    incident_type: 'road_accident',
    area_name: 'Indiranagar',
    location: 'Indiranagar 100 Feet Road',
    severity_score: 0.65,
    summary: 'Two-vehicle collision causing traffic jam',
    timestamp: Date.now() - 45 * 60 * 1000 // 45 minutes ago
  },
  {
    id: 'mock_3',
    incident_type: 'flood',
    area_name: 'Whitefield',
    location: 'Whitefield Main Road',
    severity_score: 0.72,
    summary: 'Heavy waterlogging after rain',
    timestamp: Date.now() - 60 * 60 * 1000 // 1 hour ago
  },
  {
    id: 'mock_4',
    incident_type: 'medical_emergency',
    area_name: 'Jayanagar',
    location: 'Jayanagar 4th Block',
    severity_score: 0.90,
    summary: 'Medical emergency requiring immediate attention',
    timestamp: Date.now() - 20 * 60 * 1000 // 20 minutes ago
  },
  {
    id: 'mock_5',
    incident_type: 'power_outage',
    area_name: 'HSR Layout',
    location: 'HSR Layout Sector 2',
    severity_score: 0.45,
    summary: 'Power outage affecting multiple buildings',
    timestamp: Date.now() - 90 * 60 * 1000 // 1.5 hours ago
  },
  {
    id: 'mock_6',
    incident_type: 'traffic',
    area_name: 'Marathahalli',
    location: 'Marathahalli Bridge',
    severity_score: 0.55,
    summary: 'Heavy traffic congestion during peak hours',
    timestamp: Date.now() - 15 * 60 * 1000 // 15 minutes ago
  },
  {
    id: 'mock_7',
    incident_type: 'fire',
    area_name: 'Banaswadi',
    location: 'Banaswadi Railway Station',
    severity_score: 0.78,
    summary: 'Small fire near railway tracks',
    timestamp: Date.now() - 40 * 60 * 1000 // 40 minutes ago
  },
  {
    id: 'mock_8',
    incident_type: 'crowd_risk',
    area_name: 'MG Road',
    location: 'MG Road Metro Station',
    severity_score: 0.60,
    summary: 'Large crowd gathering causing safety concerns',
    timestamp: Date.now() - 25 * 60 * 1000 // 25 minutes ago
  },
  {
    id: 'mock_9',
    incident_type: 'infrastructure_failure',
    area_name: 'Yeshwanthpur',
    location: 'Yeshwanthpur Circle',
    severity_score: 0.68,
    summary: 'Road cave-in reported',
    timestamp: Date.now() - 2 * 60 * 60 * 1000 // 2 hours ago
  },
  {
    id: 'mock_10',
    incident_type: 'medical_emergency',
    area_name: 'Electronic City',
    location: 'Electronic City Phase 1',
    severity_score: 0.82,
    summary: 'Ambulance required urgently',
    timestamp: Date.now() - 10 * 60 * 1000 // 10 minutes ago
  },
  {
    id: 'mock_11',
    incident_type: 'road_accident',
    area_name: 'Hebbal',
    location: 'Hebbal Flyover',
    severity_score: 0.70,
    summary: 'Multi-vehicle accident on flyover',
    timestamp: Date.now() - 50 * 60 * 1000 // 50 minutes ago
  },
  {
    id: 'mock_12',
    incident_type: 'flood',
    area_name: 'Bellandur',
    location: 'Bellandur Lake Road',
    severity_score: 0.75,
    summary: 'Severe waterlogging blocking roads',
    timestamp: Date.now() - 70 * 60 * 1000 // 1 hour 10 minutes ago
  }
];

// Singleton instance
let cacheInstance = null;

export const getIncidentCache = () => {
  if (!cacheInstance) {
    cacheInstance = new IncidentCache();
    
    // Initialize with mock data if cache is empty (async)
    cacheInstance.initPromise.then(async () => {
      const all = await cacheInstance.getAll();
      if (all.length === 0) {
        console.log('Initializing cache with mock incident data...');
        await cacheInstance.addIncidents(MOCK_INCIDENTS);
      }
    });
  }
  return cacheInstance;
};

export default getIncidentCache;
