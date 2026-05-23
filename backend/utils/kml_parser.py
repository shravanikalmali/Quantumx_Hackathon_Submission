import xml.etree.ElementTree as ET
import json
from pathlib import Path

def parse_kml_to_geojson(kml_path):
    """
    Parse BTP jurisdiction KML file and convert to GeoJSON format.
    Returns a GeoJSON FeatureCollection with jurisdiction polygons.
    """
    tree = ET.parse(kml_path)
    root = tree.getroot()
    
    # Define KML namespace
    ns = {'kml': 'http://www.opengis.net/kml/2.2'}
    
    features = []
    
    # Find all Placemarks (each represents a jurisdiction)
    for placemark in root.findall('.//kml:Placemark', ns):
        # Extract jurisdiction name
        name_elem = placemark.find('.//kml:SimpleData[@name="Traffic_PS"]', ns)
        ps_name_elem = placemark.find('.//kml:SimpleData[@name="PS_BOUNDName"]', ns)
        
        jurisdiction_name = None
        if name_elem is not None and name_elem.text:
            jurisdiction_name = name_elem.text
        elif ps_name_elem is not None and ps_name_elem.text:
            jurisdiction_name = ps_name_elem.text
        
        if not jurisdiction_name:
            continue
        
        # Extract polygon coordinates
        coordinates_elem = placemark.find('.//kml:coordinates', ns)
        if coordinates_elem is None or not coordinates_elem.text:
            continue
        
        # Parse coordinates (format: "lon,lat,alt lon,lat,alt ...")
        coord_text = coordinates_elem.text.strip()
        coord_pairs = coord_text.split()
        
        coordinates = []
        for pair in coord_pairs:
            parts = pair.split(',')
            if len(parts) >= 2:
                try:
                    lon = float(parts[0])
                    lat = float(parts[1])
                    coordinates.append([lon, lat])
                except ValueError:
                    continue
        
        if len(coordinates) < 3:  # Need at least 3 points for a polygon
            continue
        
        # Ensure polygon is closed (first point == last point)
        if coordinates[0] != coordinates[-1]:
            coordinates.append(coordinates[0])
        
        # Create GeoJSON feature
        feature = {
            "type": "Feature",
            "properties": {
                "name": jurisdiction_name,
                "type": "jurisdiction"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [coordinates]  # GeoJSON Polygon needs array of rings
            }
        }
        
        features.append(feature)
    
    # Create GeoJSON FeatureCollection
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    return geojson


def save_jurisdictions_geojson():
    """
    Parse KML and save as GeoJSON file for easy serving.
    """
    kml_path = Path(__file__).parent.parent / "data" / "real_world" / "opencity" / "btp_jurisdictions_pre_2022.kml"
    output_path = Path(__file__).parent.parent / "data" / "real_world" / "opencity" / "btp_jurisdictions.geojson"
    
    geojson = parse_kml_to_geojson(kml_path)
    
    with open(output_path, 'w') as f:
        json.dump(geojson, f, indent=2)
    
    print(f"✓ Saved {len(geojson['features'])} jurisdictions to {output_path}")
    return geojson


if __name__ == "__main__":
    save_jurisdictions_geojson()
