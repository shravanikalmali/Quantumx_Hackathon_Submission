"""
Download required real-world Bengaluru emergency-response datasets.

Run from project root:

    python -m backend.scripts.download_opencity_data

Outputs:
    backend/data/real_world/opencity/
"""

from __future__ import annotations

import hashlib
import os
import sys
from pathlib import Path
from typing import Dict

import requests


BASE_DIR = Path("backend/data/real_world/opencity")

DATASETS: Dict[str, Dict[str, str]] = {
    # -------------------------------
    # Core QML training data
    # -------------------------------
    "btp_station_wise_crashes_2025.csv": {
        "url": "https://data.opencity.in/dataset/94e986d6-7836-4a8e-aa3f-273bee4ea795/resource/cf9acd17-f593-45b6-9b98-d3eab9d81143/download/btp_2025_station_wise.csv",
        "purpose": "Station-wise crash data for historical area risk / QML training",
    },
    "btp_station_wise_crashes_2024.csv": {
        "url": "https://data.opencity.in/dataset/94e986d6-7836-4a8e-aa3f-273bee4ea795/resource/e59bc255-7b94-49df-b934-9b40fb2cc741/download/74e645e3-85d2-4d81-a133-4f346f87fdd6.csv",
        "purpose": "Station-wise crash data for historical area risk / QML training",
    },
    "btp_station_wise_crashes_2023.csv": {
        "url": "https://data.opencity.in/dataset/94e986d6-7836-4a8e-aa3f-273bee4ea795/resource/8f0f281c-2cb6-4491-ac76-d1874ce38583/download/abc5af52-08a7-4435-8ba1-12b99f62ee28.csv",
        "purpose": "Station-wise crash and injury data for QML training",
    },
    "btp_station_wise_crashes_2020_2022.csv": {
        "url": "https://data.opencity.in/dataset/94e986d6-7836-4a8e-aa3f-273bee4ea795/resource/b3744a95-e486-4022-9c20-ad178dcf23dd/download/492d3dc6-ffc3-4b0e-b7d9-176d0ef7f1ec.csv",
        "purpose": "Station-wise crash and fatality history for QML training",
    },

    # -------------------------------
    # Geospatial / jurisdiction data
    # -------------------------------
    "btp_jurisdictions_2022.kml": {
        "url": "https://data.opencity.in/dataset/ba9be930-e313-4f16-b4e2-39a5d8d7eb3f/resource/3e7e6a4d-4dce-44ec-aef3-64278c30c06f/download/faceb23a-79e8-47e9-b9ba-c418c5cf6e9c.kml",
        "purpose": "Traffic police jurisdiction polygons for mapping incidents to real jurisdictions",
    },
    "btp_jurisdictions_pre_2022.kml": {
        "url": "https://data.opencity.in/dataset/ba9be930-e313-4f16-b4e2-39a5d8d7eb3f/resource/65302179-fb7f-46f4-8dbf-d9600a83e1ca/download/e78791a7-98a2-4e2e-84ab-9fb15200ff58.kml",
        "purpose": "Older traffic police jurisdiction polygons as backup",
    },
    "bbmp_final_wards_2023.kml": {
        "url": "https://data.opencity.in/dataset/87b978d1-352e-4b90-aa2c-9991e55d3425/resource/4dd58225-3ad2-4a99-9003-4e8d71e7f99f/download/e56d21e8-0c44-4c35-9e5d-c732f6f59c97.kml",
        "purpose": "BBMP ward polygons for common-person area labels",
    },

    # Alternate BBMP final wards dataset. Kept as backup because OpenCity has
    # similar ward resources under multiple dataset pages.
    "bbmp_final_wards_2023_alt.kml": {
        "url": "https://data.opencity.in/dataset/7b492849-a5cb-439b-89e9-e03522055e6a/resource/7857d752-dda4-4e5e-b9e6-53146372f86b/download/b272c5b2-3e66-4b0f-a59f-35ec7b4caa1e.kml",
        "purpose": "Alternative BBMP wards 2023 KML backup",
    },
}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def download_file(name: str, url: str, purpose: str, overwrite: bool = False) -> bool:
    BASE_DIR.mkdir(parents=True, exist_ok=True)

    out_path = BASE_DIR / name

    if out_path.exists() and not overwrite:
        size = out_path.stat().st_size
        print(f"[SKIP] {name} already exists ({size:,} bytes)")
        return True

    print(f"\n[DOWNLOAD] {name}")
    print(f"Purpose: {purpose}")
    print(f"URL: {url}")

    try:
        with requests.get(url, stream=True, timeout=60) as response:
            response.raise_for_status()

            tmp_path = out_path.with_suffix(out_path.suffix + ".tmp")

            total = 0
            with tmp_path.open("wb") as f:
                for chunk in response.iter_content(chunk_size=1024 * 256):
                    if chunk:
                        f.write(chunk)
                        total += len(chunk)

            if total == 0:
                raise RuntimeError("Downloaded file is empty")

            tmp_path.replace(out_path)

        print(f"[OK] Saved {out_path} ({out_path.stat().st_size:,} bytes)")
        print(f"[SHA256] {sha256_file(out_path)}")
        return True

    except Exception as exc:
        print(f"[ERROR] Failed to download {name}: {exc}")
        return False


def write_manifest() -> None:
    manifest_path = BASE_DIR / "manifest.md"

    lines = [
        "# OpenCity Bengaluru Emergency Response Datasets",
        "",
        "Downloaded for Quantum-Assisted Emergency Intelligence Platform.",
        "",
        "| File | Purpose | Source URL |",
        "|---|---|---|",
    ]

    for filename, meta in DATASETS.items():
        lines.append(
            f"| `{filename}` | {meta['purpose']} | {meta['url']} |"
        )

    manifest_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"\n[OK] Wrote manifest: {manifest_path}")


def main() -> int:
    overwrite = "--overwrite" in sys.argv

    print("Downloading OpenCity Bengaluru datasets...")
    print(f"Output directory: {BASE_DIR.resolve()}")
    print(f"Overwrite existing files: {overwrite}")

    success_count = 0

    for filename, meta in DATASETS.items():
        ok = download_file(
            name=filename,
            url=meta["url"],
            purpose=meta["purpose"],
            overwrite=overwrite,
        )
        if ok:
            success_count += 1

    write_manifest()

    print("\nDownload summary")
    print(f"Successful: {success_count}/{len(DATASETS)}")

    if success_count != len(DATASETS):
        print("Some downloads failed. Check URLs or network connection.")
        return 1

    print("All required files downloaded.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())