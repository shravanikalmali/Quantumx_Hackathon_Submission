"""
Responder Locator - Fetch emergency responders from Google Maps Places API
based on user location.

Searches for:
- Hospitals (ambulances, medical teams)
- Fire stations (fire trucks)
- Police stations (police units)
- Rescue centers (rescue teams)
"""

import os
import logging
import requests
from typing import Optional, List
from backend.utils.geo import haversine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

# Google Places API endpoint
PLACES_API_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
PLACE_DETAILS_API_URL = "https://maps.googleapis.com/maps/api/place/details/json"

# Responder type mapping to Google Places types
RESPONDER_TYPE_MAPPING = {
    "hospital": {
        "types": ["hospital"],
        "responder_type": "ambulance",
        "capacity": 4,
        "speed_kmh": 50,
    },
    "fire_station": {
        "types": ["fire_station"],
        "responder_type": "fire_truck",
        "capacity": 6,
        "speed_kmh": 40,
    },
    "police": {
        "types": ["police"],
        "responder_type": "police",
        "capacity": 3,
        "speed_kmh": 55,
    },
    "emergency_center": {
        "types": ["emergency_room"],
        "responder_type": "medical_team",
        "capacity": 10,
        "speed_kmh": 45,
    },
}


def get_nearby_responders(
    user_lat: float,
    user_lng: float,
    radius_meters: int = 5000,
    max_results: int = 15,
) -> List[dict]:
    """
    Fetch nearby emergency responders from Google Maps Places API.
    
    Args:
        user_lat: User's latitude
        user_lng: User's longitude
        radius_meters: Search radius (default 5km)
        max_results: Maximum responders to return
    
    Returns:
        List of responder dicts with id, type, lat, lng, name, distance_km
    """
    if not GOOGLE_API_KEY:
        logger.warning("GOOGLE_API_KEY not set, returning empty responders")
        return []
    
    responders = []
    search_types = [
        "hospital",
        "fire_station",
        "police",
        "emergency_room",
    ]
    
    try:
        for search_type in search_types:
            params = {
                "location": f"{user_lat},{user_lng}",
                "radius": radius_meters,
                "type": search_type,
                "key": GOOGLE_API_KEY,
            }
            
            response = requests.get(PLACES_API_URL, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data.get("status") != "OK":
                logger.warning(f"Google Places API error for {search_type}: {data.get('status')}")
                continue
            
            results = data.get("results", [])
            logger.info(f"Found {len(results)} {search_type} locations")
            
            for place in results[:max_results]:
                location = place.get("geometry", {}).get("location", {})
                place_lat = location.get("lat")
                place_lng = location.get("lng")
                
                if not place_lat or not place_lng:
                    continue
                
                distance_km = haversine(user_lat, user_lng, place_lat, place_lng)
                
                # Determine responder type
                responder_type = "ambulance"  # default
                if search_type == "fire_station":
                    responder_type = "fire_truck"
                elif search_type == "police":
                    responder_type = "police"
                elif search_type == "emergency_room":
                    responder_type = "medical_team"
                
                responder = {
                    "id": f"{search_type}_{place.get('place_id', '')}",
                    "type": responder_type,
                    "lat": place_lat,
                    "lng": place_lng,
                    "name": place.get("name", "Unknown"),
                    "address": place.get("vicinity", ""),
                    "distance_km": round(distance_km, 2),
                    "source": "google_maps",
                    "place_id": place.get("place_id"),
                    "rating": place.get("rating"),
                    "open_now": place.get("opening_hours", {}).get("open_now"),
                }
                
                responders.append(responder)
        
        # Sort by distance and return top results
        responders.sort(key=lambda r: r["distance_km"])
        return responders[:max_results]
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Google Places API request failed: {e}")
        return []
    except Exception as e:
        logger.error(f"Error fetching responders: {e}")
        return []


def get_responder_details(place_id: str) -> Optional[dict]:
    """
    Get detailed information about a responder location.
    
    Args:
        place_id: Google Places place_id
    
    Returns:
        Detailed place information or None
    """
    if not GOOGLE_API_KEY:
        return None
    
    try:
        params = {
            "place_id": place_id,
            "fields": "name,formatted_address,geometry,opening_hours,phone_number,website,rating,reviews",
            "key": GOOGLE_API_KEY,
        }
        
        response = requests.get(PLACE_DETAILS_API_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data.get("status") == "OK":
            return data.get("result")
        else:
            logger.warning(f"Place details API error: {data.get('status')}")
            return None
            
    except Exception as e:
        logger.error(f"Error fetching responder details: {e}")
        return None


def filter_responders_by_type(
    responders: List[dict],
    responder_type: str,
) -> List[dict]:
    """
    Filter responders by type.
    
    Args:
        responders: List of responder dicts
        responder_type: Type to filter by (ambulance, fire_truck, police, medical_team)
    
    Returns:
        Filtered list of responders
    """
    return [r for r in responders if r.get("type") == responder_type]


def get_closest_responders(
    responders: List[dict],
    count: int = 3,
) -> List[dict]:
    """
    Get the closest N responders.
    
    Args:
        responders: List of responder dicts
        count: Number of responders to return
    
    Returns:
        Closest responders
    """
    return sorted(responders, key=lambda r: r.get("distance_km", float("inf")))[:count]
