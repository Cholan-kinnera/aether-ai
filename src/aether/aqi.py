"""US EPA AQI categories and pollutant helpers (pure functions)."""
from __future__ import annotations

CATEGORIES: tuple[tuple[str, int], ...] = (
    ("Good", 50),
    ("Moderate", 100),
    ("Unhealthy for Sensitive Groups", 150),
    ("Unhealthy", 200),
    ("Very Unhealthy", 300),
)

POLLUTANT_LABELS = {
    "pm2_5": "PM2.5",
    "pm10": "PM10",
    "nitrogen_dioxide": "NO₂",
    "ozone": "O₃",
    "sulphur_dioxide": "SO₂",
    "carbon_monoxide": "CO",
}


def categorize(aqi: float) -> str:
    """Return the EPA category name for an AQI value."""
    if aqi < 0:
        raise ValueError("AQI cannot be negative")
    for name, upper in CATEGORIES:
        if aqi <= upper:
            return name
    return "Hazardous"


def dominant_pollutant(sub_indices: dict[str, float | None]) -> str | None:
    """Return the pollutant key with the highest sub-index, or None if no data."""
    known = {key: value for key, value in sub_indices.items() if value is not None}
    if not known:
        return None
    return max(known, key=lambda key: known[key])
