import os
from dotenv import load_dotenv

load_dotenv()

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_VISION_MODEL = os.getenv("GEMINI_VISION_MODEL", "gemini-1.5-flash")

REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID", "")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET", "")

GCP_PROJECT = os.getenv("GCP_PROJECT", "")
BUCKET_NAME = os.getenv("BUCKET_NAME", "")

EMERGENCY_KEYWORDS = [
    "fire",
    "flood",
    "accident",
    "collapse",
    "explosion",
    "injury",
    "power outage",
    "emergency",
    "rescue",
    "hospital",
    "waterlogging",
    "gas leak",
    "building collapse",
    "road accident",
    "electrocution",
    "drowning",
    "landslide",
    "stampede",
    "hazardous",
    "chemical spill",
]

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) EmergencyIntel/1.0"

RSS_URL = (
    "https://news.google.com/rss/search"
    "?q=Bengaluru+fire+OR+flood+OR+accident+OR+emergency+OR+collapse"
    "&hl=en-IN&gl=IN&ceid=IN:en"
)
