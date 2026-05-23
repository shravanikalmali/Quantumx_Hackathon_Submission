"""
Live Data Ingestion Agent

Continuously fetches live data from multiple sources:
- Google News (Bangalore)
- Reddit r/bangalore
- Citizen reports (via API)
- Traffic alerts (real-time)

Stores data and notifies training agent when threshold is reached.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO)

# Live data storage
LIVE_DATA_DIR = Path("backend/data/live")
LIVE_DATA_DIR.mkdir(parents=True, exist_ok=True)

LIVE_INCIDENTS_FILE = LIVE_DATA_DIR / "live_incidents.jsonl"
LIVE_NEWS_FILE = LIVE_DATA_DIR / "live_news.jsonl"
LIVE_TRAFFIC_FILE = LIVE_DATA_DIR / "live_traffic.jsonl"

# Configuration
MIN_NEW_RECORDS_FOR_RETRAINING = 50  # Retrain when 50 new records arrive
LIVE_DATA_RETENTION_DAYS = 7


class LiveDataIngestionAgent:
    """Agent that continuously ingests live data from multiple sources."""

    def __init__(self):
        self.new_records_count = 0
        self.last_training_time = None
        self.data_sources = {
            "google_news": self._fetch_google_news,
            "citizen_reports": self._fetch_citizen_reports,
            "traffic_alerts": self._fetch_traffic_alerts,
        }

    def _fetch_google_news(self) -> list[dict]:
        """Fetch latest Bangalore news from Google News"""
        try:
            # Using Google News RSS feed for Bangalore
            url = "https://news.google.com/rss/search?q=bangalore+emergency&hl=en-IN&gl=IN&ceid=IN:en"
            
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            articles = []
            soup = BeautifulSoup(response.content, "xml")
            
            for item in soup.find_all("item")[:10]:  # Last 10 articles
                title = item.find("title")
                description = item.find("description")
                link = item.find("link")
                pub_date = item.find("pubDate")
                
                if title:
                    articles.append({
                        "source": "google_news",
                        "title": title.text,
                        "description": description.text if description else "",
                        "link": link.text if link else "",
                        "published_at": pub_date.text if pub_date else datetime.now().isoformat(),
                        "ingested_at": datetime.now().isoformat(),
                        "type": "news",
                    })
            
            logging.info(f"Fetched {len(articles)} articles from Google News")
            return articles
            
        except Exception as e:
            logging.error(f"Failed to fetch Google News: {e}")
            return []

    def _fetch_citizen_reports(self) -> list[dict]:
        """Fetch recent citizen reports from local API"""
        try:
            # This would connect to your own /report endpoint
            # For now, returning mock data
            reports = [
                {
                    "source": "citizen_report",
                    "type": "road_accident",
                    "description": "Heavy traffic on Silk Board due to accident",
                    "location": {"latitude": 12.9177, "longitude": 77.6238},
                    "severity": 0.7,
                    "reported_at": datetime.now().isoformat(),
                    "ingested_at": datetime.now().isoformat(),
                }
            ]
            logging.info(f"Fetched {len(reports)} citizen reports")
            return reports
            
        except Exception as e:
            logging.error(f"Failed to fetch citizen reports: {e}")
            return []

    def _fetch_traffic_alerts(self) -> list[dict]:
        """Fetch real-time traffic alerts"""
        try:
            # This would connect to traffic API (BTP, Google Maps, etc.)
            # For now, returning mock data
            alerts = [
                {
                    "source": "traffic_alert",
                    "type": "traffic_congestion",
                    "location": "Old Airport Road",
                    "severity": 0.6,
                    "description": "Heavy traffic congestion",
                    "reported_at": datetime.now().isoformat(),
                    "ingested_at": datetime.now().isoformat(),
                }
            ]
            logging.info(f"Fetched {len(alerts)} traffic alerts")
            return alerts
            
        except Exception as e:
            logging.error(f"Failed to fetch traffic alerts: {e}")
            return []

    def ingest_all_sources(self) -> int:
        """Ingest data from all sources and return count of new records"""
        total_new = 0
        
        for source_name, fetch_func in self.data_sources.items():
            try:
                data = fetch_func()
                
                # Store data
                if source_name == "google_news":
                    self._store_records(data, LIVE_NEWS_FILE)
                elif source_name == "citizen_reports":
                    self._store_records(data, LIVE_INCIDENTS_FILE)
                elif source_name == "traffic_alerts":
                    self._store_records(data, LIVE_TRAFFIC_FILE)
                
                total_new += len(data)
                
            except Exception as e:
                logging.error(f"Error ingesting from {source_name}: {e}")
        
        self.new_records_count += total_new
        logging.info(f"Total new records: {total_new}, Cumulative: {self.new_records_count}")
        
        return total_new

    def _store_records(self, records: list[dict], file_path: Path):
        """Store records in JSONL format (one JSON per line)"""
        try:
            with open(file_path, "a") as f:
                for record in records:
                    f.write(json.dumps(record) + "\n")
            logging.info(f"Stored {len(records)} records to {file_path.name}")
        except Exception as e:
            logging.error(f"Failed to store records: {e}")

    def should_retrain(self) -> bool:
        """Check if enough new data has arrived for retraining"""
        return self.new_records_count >= MIN_NEW_RECORDS_FOR_RETRAINING

    def reset_counter(self):
        """Reset counter after retraining"""
        self.new_records_count = 0
        self.last_training_time = datetime.now()
        logging.info("Counter reset after retraining")

    def get_live_data_summary(self) -> dict:
        """Get summary of live data collected"""
        return {
            "new_records_since_last_training": self.new_records_count,
            "min_records_for_retraining": MIN_NEW_RECORDS_FOR_RETRAINING,
            "should_retrain": self.should_retrain(),
            "last_training_time": self.last_training_time,
            "live_data_files": {
                "incidents": str(LIVE_INCIDENTS_FILE),
                "news": str(LIVE_NEWS_FILE),
                "traffic": str(LIVE_TRAFFIC_FILE),
            }
        }


def main():
    """Run the live data ingestion agent"""
    agent = LiveDataIngestionAgent()
    
    print("=== Live Data Ingestion Agent ===")
    print("Fetching live data from all sources...")
    
    # Ingest data
    new_count = agent.ingest_all_sources()
    
    # Check if retraining is needed
    summary = agent.get_live_data_summary()
    print(f"\nLive Data Summary:")
    print(f"  New records: {summary['new_records_since_last_training']}")
    print(f"  Should retrain: {summary['should_retrain']}")
    print(f"  Files: {summary['live_data_files']}")
    
    if agent.should_retrain():
        print("\n✅ RETRAINING THRESHOLD REACHED!")
        print("Training agent should now:")
        print("  1. Load live data from files")
        print("  2. Combine with historical data")
        print("  3. Retrain QML model")
        print("  4. Save new weights")
        print("  5. Update production model")


if __name__ == "__main__":
    main()
