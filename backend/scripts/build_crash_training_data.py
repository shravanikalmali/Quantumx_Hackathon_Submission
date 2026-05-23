from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd


RAW_DIR = Path("backend/data/real_world/opencity")
OUT_DIR = Path("backend/data/processed")
OUT_DIR.mkdir(parents=True, exist_ok=True)

RISK_JSON = OUT_DIR / "crash_risk_by_area.json"
TRAIN_CSV = OUT_DIR / "qml_training_data.csv"


CRASH_FILES = [
    RAW_DIR / "btp_station_wise_crashes_2025.csv",
    RAW_DIR / "btp_station_wise_crashes_2024.csv",
    RAW_DIR / "btp_station_wise_crashes_2023.csv",
    RAW_DIR / "btp_station_wise_crashes_2020_2022.csv",
]


def find_col(columns, candidates):
    cols = list(columns)
    lower = {c.lower().strip(): c for c in cols}

    for cand in candidates:
        cand = cand.lower()
        for lc, original in lower.items():
            if cand in lc:
                return original

    return None


def minmax(series):
    series = pd.to_numeric(series, errors="coerce").fillna(0).astype(float)
    if series.max() == series.min():
        return np.ones(len(series)) * 0.5
    return (series - series.min()) / (series.max() - series.min())


def normalize_one_file(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    print(f"\nReading {path.name}")
    print("Columns:", list(df.columns))

    station_col = find_col(df.columns, ["station", "police station", "ps name", "traffic police station"])
    fatal_col = find_col(df.columns, ["fatal cases", "fatal", "fatal accidents"])
    killed_col = find_col(df.columns, ["killed", "deaths", "death"])
    non_fatal_col = find_col(df.columns, ["non fatal", "non-fatal", "nonfatal"])
    injured_col = find_col(df.columns, ["injured", "injury"])
    total_col = find_col(df.columns, ["total cases", "total", "accidents"])

    if not station_col:
        raise ValueError(f"Could not find station column in {path.name}")

    out = pd.DataFrame()
    out["area"] = df[station_col].astype(str).str.strip()

    out["fatal_cases"] = pd.to_numeric(df[fatal_col], errors="coerce").fillna(0) if fatal_col else 0
    out["killed_people"] = pd.to_numeric(df[killed_col], errors="coerce").fillna(0) if killed_col else 0
    out["non_fatal_cases"] = pd.to_numeric(df[non_fatal_col], errors="coerce").fillna(0) if non_fatal_col else 0
    out["injured_people"] = pd.to_numeric(df[injured_col], errors="coerce").fillna(0) if injured_col else 0

    if total_col:
        out["total_cases"] = pd.to_numeric(df[total_col], errors="coerce").fillna(0)
    else:
        out["total_cases"] = out["fatal_cases"] + out["non_fatal_cases"]

    year = "".join(ch for ch in path.name if ch.isdigit())
    out["source_file"] = path.name
    out["year_hint"] = year[:4] if year else ""

    return out


def build_area_risk(all_df: pd.DataFrame) -> pd.DataFrame:
    grouped = (
        all_df.groupby("area", as_index=False)
        .agg(
            total_cases=("total_cases", "sum"),
            fatal_cases=("fatal_cases", "sum"),
            killed_people=("killed_people", "sum"),
            non_fatal_cases=("non_fatal_cases", "sum"),
            injured_people=("injured_people", "sum"),
        )
    )

    grouped["fatality_ratio"] = np.where(
        grouped["total_cases"] > 0,
        grouped["fatal_cases"] / grouped["total_cases"],
        0,
    )

    grouped["injury_ratio"] = np.where(
        grouped["total_cases"] > 0,
        grouped["injured_people"] / grouped["total_cases"],
        0,
    )

    grouped["total_norm"] = minmax(grouped["total_cases"])
    grouped["fatal_norm"] = minmax(grouped["fatal_cases"])
    grouped["injury_norm"] = minmax(grouped["injured_people"])
    grouped["fatality_norm"] = minmax(grouped["fatality_ratio"])

    grouped["historical_risk_score"] = (
        0.45 * grouped["total_norm"]
        + 0.30 * grouped["fatal_norm"]
        + 0.15 * grouped["injury_norm"]
        + 0.10 * grouped["fatality_norm"]
    )

    def label(score):
        if score >= 0.75:
            return "critical"
        if score >= 0.55:
            return "high"
        if score >= 0.35:
            return "medium"
        return "low"

    grouped["risk_label"] = grouped["historical_risk_score"].apply(label)
    return grouped.sort_values("historical_risk_score", ascending=False)


def build_training_rows(area_risk: pd.DataFrame) -> pd.DataFrame:
    rows = []
    rng = np.random.default_rng(42)

    for _, row in area_risk.iterrows():
        hist = float(row["historical_risk_score"])

        # Generate multiple incident examples per real area.
        # Historical area risk is real-data derived.
        # Dynamic features simulate possible live incidents in that area.
        for _ in range(50):
            severity = float(np.clip(rng.normal(loc=0.35 + 0.45 * hist, scale=0.18), 0, 1))
            report_density = float(np.clip(rng.beta(2, 5) + 0.25 * hist, 0, 1))
            accessibility_risk = float(np.clip(rng.beta(2, 4) + 0.20 * hist, 0, 1))

            risk_score = (
                0.35 * severity
                + 0.30 * hist
                + 0.20 * report_density
                + 0.15 * accessibility_risk
            )

            label_binary = 1 if risk_score >= 0.55 else 0

            rows.append(
                {
                    "area": row["area"],
                    "severity_score": severity,
                    "historical_area_risk": hist,
                    "report_density": report_density,
                    "accessibility_risk": accessibility_risk,
                    "risk_score": risk_score,
                    "risk_label_binary": label_binary,
                }
            )

    return pd.DataFrame(rows)


def main():
    frames = []

    for path in CRASH_FILES:
        if not path.exists():
            print(f"[WARN] Missing crash CSV: {path}")
            continue
        frames.append(normalize_one_file(path))

    if not frames:
        raise RuntimeError(
            "No crash CSV files found. QML training needs CSV crash files, not KML files."
        )

    all_df = pd.concat(frames, ignore_index=True)
    area_risk = build_area_risk(all_df)

    risk_index = {}
    for _, row in area_risk.iterrows():
        risk_index[row["area"]] = {
            "area": row["area"],
            "total_cases": int(row["total_cases"]),
            "fatal_cases": int(row["fatal_cases"]),
            "killed_people": int(row["killed_people"]),
            "non_fatal_cases": int(row["non_fatal_cases"]),
            "injured_people": int(row["injured_people"]),
            "fatality_ratio": float(row["fatality_ratio"]),
            "historical_risk_score": float(row["historical_risk_score"]),
            "risk_label": row["risk_label"],
            "source": "OpenCity Bengaluru Traffic Police crash data",
        }

    RISK_JSON.write_text(json.dumps(risk_index, indent=2), encoding="utf-8")

    train_df = build_training_rows(area_risk)
    train_df.to_csv(TRAIN_CSV, index=False)

    print(f"\nSaved {RISK_JSON}")
    print(f"Saved {TRAIN_CSV}")
    print("\nTop risky areas:")
    print(area_risk[["area", "total_cases", "fatal_cases", "injured_people", "historical_risk_score", "risk_label"]].head(10))


if __name__ == "__main__":
    main()
