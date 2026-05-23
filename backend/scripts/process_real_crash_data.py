"""
Process real OpenCity Bengaluru crash data into crash_risk_by_area.json

This script:
1. Reads all downloaded CSV files (2020-2025)
2. Aggregates crash statistics per traffic police station
3. Maps stations to known areas with coordinates
4. Calculates historical risk scores
5. Generates the final crash_risk_by_area.json

Run from project root:
    python -m backend.scripts.process_real_crash_data
"""

import json
import logging
from pathlib import Path
from typing import Dict, List, Tuple

import pandas as pd

logging.basicConfig(level=logging.INFO)

# Station to area mapping with coordinates
STATION_AREA_MAPPING = {
    "Airport": {"area": "Kempegowda Airport", "lat": 13.1986, "lng": 77.7066},
    "Halasooru": {"area": "Halasuru", "lat": 12.9784, "lng": 77.6408},
    "Indiranagar": {"area": "Indiranagar", "lat": 12.9716, "lng": 77.6408},
    "Pulikeshinagar": {"area": "Pulikeshinagar", "lat": 13.0115, "lng": 77.6520},
    "Banasawadi": {"area": "Banasawadi", "lat": 13.0076, "lng": 77.6485},
    "Shivajinagar": {"area": "Shivajinagar", "lat": 12.9784, "lng": 77.5809},
    "K G Halli": {"area": "KG Halli", "lat": 12.9791, "lng": 77.5858},
    "K R Puram": {"area": "KR Puram", "lat": 13.0265, "lng": 77.6326},
    "Koramangala": {"area": "Koramangala", "lat": 12.9279, "lng": 77.6271},
    "Jayanagar": {"area": "Jayanagar", "lat": 12.9295, "lng": 77.5804},
    "Basaveshwaranagar": {"area": "Basaveshwaranagar", "lat": 13.0105, "lng": 77.5580},
    "Chickpet": {"area": "Chickpet", "lat": 12.9698, "lng": 77.5807},
    "Ulsoor": {"area": "Ulsoor", "lat": 12.9798, "lng": 77.6168},
    "Majestic": {"area": "Majestic", "lat": 12.9786, "lng": 77.5766},
    "Silk Board": {"area": "Silk Board", "lat": 12.9177, "lng": 77.6238},
    "BTM Layout": {"area": "BTM Layout", "lat": 12.9081, "lng": 77.6094},
    "HSR Layout": {"area": "HSR Layout", "lat": 12.9081, "lng": 77.6388},
    "Domlur": {"area": "Domlur", "lat": 12.9585, "lng": 77.6384},
    "Whitefield": {"area": "Whitefield", "lat": 12.9698, "lng": 77.7501},
    "Electronic City": {"area": "Electronic City", "lat": 12.8394, "lng": 77.6770},
    "Marathahalli": {"area": "Marathahalli", "lat": 12.9569, "lng": 77.7009},
    "Yelahanka": {"area": "Yelahanka", "lat": 13.0845, "lng": 77.5765},
    "Peenya": {"area": "Peenya", "lat": 13.0167, "lng": 77.5056},
    "Vijayanagar": {"area": "Vijayanagar", "lat": 12.9716, "lng": 77.5404},
    "Banashankari": {"area": "Banashankari", "lat": 12.9280, "lng": 77.5500},
    "Jalahalli": {"area": "Jalahalli", "lat": 13.0597, "lng": 77.5447},
    "Kalyan Nagar": {"area": "Kalyan Nagar", "lat": 13.0167, "lng": 77.6384},
    "Sanjay Nagar": {"area": "Sanjay Nagar", "lat": 13.0438, "lng": 77.6292},
    "Kaggadasapura": {"area": "Kaggadasapura", "lat": 12.9786, "lng": 77.6583},
    "Bommanahalli": {"area": "Bommanahalli", "lat": 12.9081, "lng": 77.6280},
    "Hosa Road": {"area": "Hosa Road", "lat": 12.8914, "lng": 77.6983},
    "Sarjapur": {"area": "Sarjapur", "lat": 12.9236, "lng": 77.7141},
}


def load_csv_data(data_dir: Path) -> Dict[str, Dict]:
    """Load and parse all crash CSV files"""
    crash_data = {}
    
    csv_files = sorted(data_dir.glob("btp_station_wise_crashes_*.csv"))
    
    for csv_file in csv_files:
        year = csv_file.stem.split("_")[-1]
        if year == "2020_2022":
            continue  # Handle separately
        
        logging.info(f"Loading {csv_file.name}")
        
        try:
            df = pd.read_csv(csv_file)
            
            # Clean station names (remove extra spaces)
            if "Station" in df.columns:
                df["Station"] = df["Station"].str.strip()
            
            # Skip total rows
            df = df[df["Station"] != "Total"]
            df = df[df["Station"] != ""]
            
            crash_data[year] = df.to_dict("records")
            logging.info(f"  Loaded {len(df)} stations for {year}")
            
        except Exception as e:
            logging.error(f"Failed to load {csv_file}: {e}")
    
    return crash_data


def aggregate_crash_data(crash_data: Dict[str, List[Dict]]) -> Dict[str, Dict]:
    """Aggregate crash statistics across all years per station"""
    aggregated = {}
    
    for year, records in crash_data.items():
        for record in records:
            station = record.get("Station", "").strip()
            if not station or station == "Total":
                continue
            
            if station not in aggregated:
                aggregated[station] = {
                    "total_crashes": 0,
                    "fatal_crashes": 0,
                    "years": [],
                }
            
            # Extract crash counts based on column names
            if year == "2025":
                total = record.get("2025-Total crashes", 0)
                fatal = record.get("2025-Fatal crashes", 0)
            elif year == "2024":
                total = record.get("2024-Total crashes", 0)
                fatal = record.get("2024-Fatal crashes", 0)
            elif year == "2023":
                total = record.get("2023 - Total Cases", 0)
                fatal = record.get("2023 - Fatal Cases", 0)
            else:
                continue
            
            # Convert to numeric, handling missing values
            try:
                total = int(total) if pd.notna(total) else 0
                fatal = int(fatal) if pd.notna(fatal) else 0
            except (ValueError, TypeError):
                total = 0
                fatal = 0
            
            aggregated[station]["total_crashes"] += total
            aggregated[station]["fatal_crashes"] += fatal
            aggregated[station]["years"].append(year)
    
    return aggregated


def calculate_risk_score(crash_stats: Dict) -> float:
    """Calculate historical risk score (0-1) based on crash statistics"""
    total = crash_stats["total_crashes"]
    fatal = crash_stats["fatal_crashes"]
    
    if total == 0:
        return 0.0
    
    # Base risk from total crashes (normalized to max observed)
    max_crashes = 500  # Reasonable upper bound for 5-year period
    base_risk = min(total / max_crashes, 1.0)
    
    # Fatal multiplier (fatal crashes are more concerning)
    fatality_ratio = fatal / total if total > 0 else 0
    fatal_multiplier = 1.0 + (fatality_ratio * 2.0)  # Up to 3x multiplier
    
    # Years coverage bonus (more years of data = more reliable)
    years_coverage = len(crash_stats["years"])
    coverage_bonus = min(years_coverage / 3.0, 1.0) * 0.1  # Up to 10% bonus
    
    risk_score = (base_risk * fatal_multiplier) + coverage_bonus
    return min(risk_score, 1.0)


def get_risk_label(risk_score: float) -> str:
    """Convert risk score to risk label"""
    if risk_score >= 0.8:
        return "critical"
    elif risk_score >= 0.6:
        return "high"
    elif risk_score >= 0.4:
        return "medium"
    else:
        return "low"


def generate_crash_risk_json(aggregated: Dict[str, Dict]) -> List[Dict]:
    """Generate final crash_risk_by_area.json structure"""
    crash_risk_data = []
    
    for station, stats in aggregated.items():
        # Skip if no crash data
        if stats["total_crashes"] == 0:
            continue
        
        # Get area mapping
        area_info = STATION_AREA_MAPPING.get(station, {
            "area": station,
            "lat": 12.9716,
            "lng": 77.5946
        })
        
        # Calculate metrics
        total_crashes = stats["total_crashes"]
        fatal_crashes = stats["fatal_crashes"]
        fatality_ratio = fatal_crashes / total_crashes if total_crashes > 0 else 0
        risk_score = calculate_risk_score(stats)
        risk_label = get_risk_label(risk_score)
        
        # Create entry
        entry = {
            "area": area_info["area"],
            "station": station,
            "total_crashes": total_crashes,
            "fatal_crashes": fatal_crashes,
            "fatality_ratio": round(fatality_ratio, 3),
            "historical_risk_score": round(risk_score, 3),
            "risk_label": risk_label,
            "lat": area_info["lat"],
            "lng": area_info["lng"],
            "years_covered": stats["years"],
        }
        
        crash_risk_data.append(entry)
    
    # Sort by risk score (descending) for better visibility
    crash_risk_data.sort(key=lambda x: x["historical_risk_score"], reverse=True)
    
    return crash_risk_data


def main():
    """Main processing function"""
    data_dir = Path("backend/data/real_world/opencity")
    output_file = Path("backend/data/crash_risk/processed/crash_risk_by_area.json")
    
    # Ensure output directory exists
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    logging.info("Processing real OpenCity crash data...")
    
    # Load all CSV files
    crash_data = load_csv_data(data_dir)
    
    # Aggregate by station
    aggregated = aggregate_crash_data(crash_data)
    logging.info(f"Aggregated data for {len(aggregated)} stations")
    
    # Generate crash risk JSON
    crash_risk_data = generate_crash_risk_json(aggregated)
    logging.info(f"Generated crash risk data for {len(crash_risk_data)} areas")
    
    # Save to file
    with open(output_file, "w") as f:
        json.dump(crash_risk_data, f, indent=2)
    
    logging.info(f"Saved crash risk data to {output_file}")
    
    # Print summary
    print("\n=== Crash Risk Summary ===")
    for entry in crash_risk_data[:5]:  # Top 5 riskiest areas
        print(f"{entry['area']}: {entry['total_crashes']} crashes, "
              f"{entry['fatal_crashes']} fatal, risk={entry['historical_risk_score']:.3f}")
    
    print(f"\nTotal areas processed: {len(crash_risk_data)}")
    
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
