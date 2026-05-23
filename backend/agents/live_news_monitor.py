"""
Live News Monitoring Agent

Continuously monitors Google News for Bangalore incidents and alerts users
based on their location and incident history.

Features:
- Real-time Google News RSS monitoring
- Gemini AI incident analysis
- QML risk prediction
- Location-based user alerts
- Historical incident tracking
"""

import logging
import time
import feedparser
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
import requests

import google.generativeai as genai
from backend.utils.config import GEMINI_API_KEY
from backend.quantum.qml_incident_predictor import predict_incident_qml
from backend.prediction.feature_builder import build_qml_features
from backend.utils.geo import haversine, jurisdiction_to_coords

logging.basicConfig(level=logging.INFO)

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel("gemini-1.5-flash")
else:
    gemini_model = None
    logging.warning("Gemini API not configured - news analysis will be limited")

# Data Sources
BANGALORE_NEWS_RSS = "https://news.google.com/rss/search?q=bangalore+OR+bengaluru+when:1h&hl=en-IN&gl=IN&ceid=IN:en"
REDDIT_BANGALORE_RSS = "https://www.reddit.com/r/bangalore/.rss"

# Emergency keywords for filtering
EMERGENCY_KEYWORDS = [
    "fire", "flood", "accident", "crash", "waterlogging", "traffic jam",
    "protest", "riot", "explosion", "gas leak", "building collapse",
    "heatwave", "pollution", "smog", "heavy rain", "cyclone", "storm",
    "blocked", "stuck", "emergency", "help", "urgent"
]


class LiveNewsMonitor:
    """
    Monitors Google News and alerts users about nearby incidents.
    """
    
    def __init__(self):
        self.seen_articles = set()  # Track processed articles
        self.active_incidents = []  # Current incidents
        self.user_subscriptions = {}  # user_id → {location, radius_km, preferences}
        self.alert_history = []  # Track sent alerts
    
    def fetch_latest_news(self) -> List[Dict]:
        """Fetch latest news from Google News RSS."""
        try:
            feed = feedparser.parse(BANGALORE_NEWS_RSS)
            articles = []
            
            for entry in feed.entries:
                article_id = entry.get("id", entry.get("link", ""))
                
                # Skip if already processed
                if article_id in self.seen_articles:
                    continue
                
                # Check if emergency-related
                title = entry.get("title", "").lower()
                summary = entry.get("summary", "").lower()
                combined = f"{title} {summary}"
                
                if any(keyword in combined for keyword in EMERGENCY_KEYWORDS):
                    articles.append({
                        "id": article_id,
                        "title": entry.get("title", ""),
                        "link": entry.get("link", ""),
                        "summary": entry.get("summary", ""),
                        "published": entry.get("published", datetime.now(timezone.utc).isoformat()),
                        "source": "google_news",
                        "fetched_at": datetime.now(timezone.utc).isoformat()
                    })
                    self.seen_articles.add(article_id)
            
            logging.info(f"Fetched {len(articles)} emergency-related articles from Google News")
            return articles
            
        except Exception as e:
            logging.error(f"Failed to fetch news: {e}")
            return []
    
    def fetch_reddit_posts(self) -> List[Dict]:
        """Fetch latest posts from r/bangalore."""
        try:
            feed = feedparser.parse(REDDIT_BANGALORE_RSS)
            posts = []
            
            for entry in feed.entries:
                post_id = entry.get("id", entry.get("link", ""))
                
                # Skip if already processed
                if post_id in self.seen_articles:
                    continue
                
                # Check if emergency-related
                title = entry.get("title", "").lower()
                content = entry.get("content", [{}])[0].get("value", "").lower() if entry.get("content") else ""
                combined = f"{title} {content}"
                
                if any(keyword in combined for keyword in EMERGENCY_KEYWORDS):
                    posts.append({
                        "id": post_id,
                        "title": entry.get("title", ""),
                        "link": entry.get("link", ""),
                        "summary": content[:500] if content else title,  # First 500 chars
                        "published": entry.get("published", datetime.now(timezone.utc).isoformat()),
                        "source": "reddit_bangalore",
                        "fetched_at": datetime.now(timezone.utc).isoformat()
                    })
                    self.seen_articles.add(post_id)
            
            logging.info(f"Fetched {len(posts)} emergency-related posts from Reddit")
            return posts
            
        except Exception as e:
            logging.error(f"Failed to fetch Reddit posts: {e}")
            return []
    
    def analyze_incident(self, article: Dict) -> Optional[Dict]:
        """Analyze article with Gemini AI to extract incident details."""
        if not gemini_model:
            return None
        
        try:
            prompt = f"""Analyze this Bangalore news article for emergency incidents.

Title: {article['title']}
Summary: {article['summary']}

Extract:
1. incident_type (fire/flood/accident/traffic/pollution/heatwave/other)
2. severity (0.0-1.0 scale)
3. location (area name in Bangalore, e.g., "HSR Layout", "Whitefield")
4. description (2-3 sentences)
5. is_emergency (true/false)

Respond in JSON format only."""

            response = gemini_model.generate_content(prompt)
            text = response.text.strip()
            
            # Extract JSON from response
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            
            import json
            analysis = json.loads(text)
            
            if not analysis.get("is_emergency", False):
                return None
            
            # Get coordinates for location
            location_name = analysis.get("location", "Unknown")
            lat, lng = jurisdiction_to_coords(location_name)
            
            incident = {
                "id": article["id"],
                "text": article["title"],
                "description": analysis.get("description", article["summary"]),
                "incident_type": analysis.get("incident_type", "other"),
                "severity": float(analysis.get("severity", 0.5)),
                "location": {
                    "latitude": lat,
                    "longitude": lng,
                    "area": location_name
                },
                "source": "google_news",
                "link": article["link"],
                "published": article["published"],
                "analyzed_at": datetime.now(timezone.utc).isoformat()
            }
            
            logging.info(f"Analyzed incident: {incident['incident_type']} in {location_name}")
            return incident
            
        except Exception as e:
            logging.error(f"Failed to analyze article: {e}")
            return None
    
    def predict_risk(self, incident: Dict) -> Dict:
        """Get QML risk prediction for incident."""
        try:
            # Build features
            features = build_qml_features(incident)
            
            # Get QML prediction
            prediction = predict_incident_qml(incident)
            
            incident["qml_prediction"] = prediction
            incident["features"] = features
            
            return incident
            
        except Exception as e:
            logging.error(f"Failed to predict risk: {e}")
            incident["qml_prediction"] = {"qml_risk_score": 0.5, "qml_risk_label": "unknown"}
            return incident
    
    def check_user_alerts(self, incident: Dict):
        """Check if any users should be alerted about this incident."""
        alerts = []
        
        for user_id, subscription in self.user_subscriptions.items():
            user_lat = subscription["location"]["latitude"]
            user_lng = subscription["location"]["longitude"]
            radius_km = subscription.get("radius_km", 5.0)
            
            # Calculate distance
            inc_lat = incident["location"]["latitude"]
            inc_lng = incident["location"]["longitude"]
            distance = haversine(user_lat, user_lng, inc_lat, inc_lng)
            
            # Check if within radius
            if distance <= radius_km:
                # Check severity threshold
                min_severity = subscription.get("min_severity", 0.5)
                if incident["severity"] >= min_severity:
                    alert = {
                        "user_id": user_id,
                        "incident": incident,
                        "distance_km": round(distance, 2),
                        "alert_time": datetime.now(timezone.utc).isoformat(),
                        "message": self._generate_alert_message(incident, distance)
                    }
                    alerts.append(alert)
                    logging.info(f"Alert for user {user_id}: {incident['incident_type']} {distance:.1f}km away")
        
        self.alert_history.extend(alerts)
        return alerts
    
    def _generate_alert_message(self, incident: Dict, distance_km: float) -> str:
        """Generate user-friendly alert message."""
        incident_type = incident["incident_type"].replace("_", " ").title()
        area = incident["location"]["area"]
        severity = incident["severity"]
        risk_label = incident.get("qml_prediction", {}).get("qml_risk_label", "unknown")
        
        if severity >= 0.8:
            urgency = "🚨 CRITICAL ALERT"
        elif severity >= 0.6:
            urgency = "⚠️ HIGH ALERT"
        else:
            urgency = "ℹ️ ALERT"
        
        message = f"""{urgency}

{incident_type} in {area} ({distance_km:.1f}km from you)

Severity: {severity:.0%}
Risk Level: {risk_label.upper()}

{incident['description']}

Stay safe and avoid the area if possible.
"""
        return message
    
    def subscribe_user(self, user_id: str, location: Dict, radius_km: float = 5.0, 
                      min_severity: float = 0.5, preferences: Optional[Dict] = None):
        """Subscribe a user to location-based alerts."""
        self.user_subscriptions[user_id] = {
            "location": location,
            "radius_km": radius_km,
            "min_severity": min_severity,
            "preferences": preferences or {},
            "subscribed_at": datetime.now(timezone.utc).isoformat()
        }
        logging.info(f"User {user_id} subscribed to alerts within {radius_km}km")
    
    def unsubscribe_user(self, user_id: str):
        """Unsubscribe a user from alerts."""
        if user_id in self.user_subscriptions:
            del self.user_subscriptions[user_id]
            logging.info(f"User {user_id} unsubscribed from alerts")
    
    def monitor_loop(self, interval_seconds: int = 300):
        """
        Continuous monitoring loop.
        
        Args:
            interval_seconds: How often to check for new articles (default: 5 minutes)
        """
        logging.info(f"Starting live news monitoring (checking every {interval_seconds}s)")
        
        # Import learning agent
        from backend.agents.continuous_learning_agent import get_learning_agent
        learning_agent = get_learning_agent()
        
        while True:
            try:
                # Fetch from both sources
                news_articles = self.fetch_latest_news()
                reddit_posts = self.fetch_reddit_posts()
                all_articles = news_articles + reddit_posts
                
                logging.info(f"Fetched {len(news_articles)} news + {len(reddit_posts)} Reddit posts")
                
                # Process each article
                for article in all_articles:
                    # Analyze with Gemini
                    incident = self.analyze_incident(article)
                    if not incident:
                        continue
                    
                    # Get QML prediction
                    incident = self.predict_risk(incident)
                    
                    # Store active incident
                    self.active_incidents.append(incident)
                    
                    # Check user alerts
                    alerts = self.check_user_alerts(incident)
                    
                    # Send alerts
                    for alert in alerts:
                        self._send_alert(alert)
                    
                    # Add to continuous learning (simulate outcome after 30 min)
                    # In production, you'd verify actual outcome later
                    outcome = learning_agent.simulate_outcome(incident)
                    learning_agent.add_training_sample(incident, outcome)
                
                # Clean up old incidents (keep last 24 hours)
                cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
                self.active_incidents = [
                    inc for inc in self.active_incidents
                    if datetime.fromisoformat(inc["analyzed_at"].replace("Z", "+00:00")) > cutoff
                ]
                
                # Sleep until next check
                time.sleep(interval_seconds)
                
            except KeyboardInterrupt:
                logging.info("Monitoring stopped by user")
                break
            except Exception as e:
                logging.error(f"Error in monitoring loop: {e}")
                time.sleep(60)  # Wait 1 minute before retrying
    
    def _send_alert(self, alert: Dict):
        """
        Send alert to user (implement your notification system).
        
        Options:
        - Push notification
        - SMS
        - Email
        - WebSocket
        - In-app notification
        """
        # TODO: Implement your notification system
        logging.info(f"ALERT SENT to {alert['user_id']}: {alert['message'][:100]}...")
    
    def get_active_incidents(self) -> List[Dict]:
        """Get all currently active incidents."""
        return self.active_incidents
    
    def get_user_alerts(self, user_id: str, limit: int = 10) -> List[Dict]:
        """Get recent alerts for a user."""
        user_alerts = [a for a in self.alert_history if a["user_id"] == user_id]
        return sorted(user_alerts, key=lambda x: x["alert_time"], reverse=True)[:limit]


# Global monitor instance
_monitor = None

def get_monitor() -> LiveNewsMonitor:
    """Get or create the global monitor instance."""
    global _monitor
    if _monitor is None:
        _monitor = LiveNewsMonitor()
    return _monitor


if __name__ == "__main__":
    # Test the monitor
    monitor = LiveNewsMonitor()
    
    # Subscribe a test user
    monitor.subscribe_user(
        user_id="test_user_1",
        location={"latitude": 12.9716, "longitude": 77.5946},  # Bangalore center
        radius_km=10.0,
        min_severity=0.5
    )
    
    # Run monitoring loop
    monitor.monitor_loop(interval_seconds=300)  # Check every 5 minutes
