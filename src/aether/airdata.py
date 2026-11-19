"""Open-Meteo geocoding + air-quality client with a small TTL cache."""
from __future__ import annotations

import time
from typing import Any, Protocol

import httpx

from .models import AirSnapshot, HourlyPoint

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"

_POLLUTANTS = (
    "pm2_5",
    "pm10",
    "nitrogen_dioxide",
    "ozone",
    "sulphur_dioxide",
    "carbon_monoxide",
)
_CURRENT_FIELDS = ["us_aqi", *_POLLUTANTS, *(f"us_aqi_{p}" for p in _POLLUTANTS)]
MAX_CACHE_ENTRIES = 256


class AirDataError(Exception):
    """Upstream air-quality service failed or returned unusable data."""


class LocationNotFoundError(AirDataError):
    """The place name could not be geocoded."""


class AirDataProvider(Protocol):
    async def snapshot(
        self, *, location: str | None, latitude: float | None, longitude: float | None
    ) -> AirSnapshot: ...


class TTLCache:
    """Tiny bounded cache; oldest entry is evicted first."""

    def __init__(self, ttl_seconds: int, max_entries: int = MAX_CACHE_ENTRIES) -> None:
        self._ttl = ttl_seconds
        self._max = max_entries
        self._items: dict[str, tuple[float, AirSnapshot]] = {}

    def get(self, key: str) -> AirSnapshot | None:
        entry = self._items.get(key)
        if entry is None:
            return None
        if time.monotonic() - entry[0] > self._ttl:
            del self._items[key]
            return None
        return entry[1]

    def put(self, key: str, value: AirSnapshot) -> None:
        if len(self._items) >= self._max:
            self._items.pop(next(iter(self._items)))
        self._items[key] = (time.monotonic(), value)


class OpenMeteoClient:
    def __init__(self, client: httpx.AsyncClient, cache_ttl_seconds: int = 600) -> None:
        self._http = client
        self._cache = TTLCache(cache_ttl_seconds)

    async def _get_json(self, url: str, params: dict[str, Any]) -> dict[str, Any]:
        try:
            response = await self._http.get(url, params=params)
            response.raise_for_status()
            data = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise AirDataError("air quality service unavailable") from exc
        if not isinstance(data, dict):
            raise AirDataError("unexpected response from air quality service")
        return data

    async def _geocode(self, name: str) -> tuple[str, float, float]:
        data = await self._get_json(
            GEOCODE_URL, {"name": name, "count": 1, "language": "en", "format": "json"}
        )
        results = data.get("results") or []
        if not results:
            raise LocationNotFoundError(f"could not find a place called '{name}'")
        top = results[0]
        parts = [top.get("name"), top.get("admin1"), top.get("country")]
        label = ", ".join(str(p) for p in parts if p)
        return label, float(top["latitude"]), float(top["longitude"])

    async def snapshot(
        self, *, location: str | None, latitude: float | None, longitude: float | None
    ) -> AirSnapshot:
        if latitude is None or longitude is None:
            if not location:
                raise LocationNotFoundError("no location provided")
            key = f"name:{location.lower()}"
            cached = self._cache.get(key)
            if cached:
                return cached
            label, latitude, longitude = await self._geocode(location)
        else:
            label = location or f"{latitude:.2f}, {longitude:.2f}"
            key = f"geo:{latitude:.2f},{longitude:.2f}"
            cached = self._cache.get(key)
            if cached:
                return cached
        data = await self._get_json(
            AIR_URL,
            {
                "latitude": latitude,
                "longitude": longitude,
                "current": ",".join(_CURRENT_FIELDS),
                "hourly": "us_aqi",
                "forecast_days": 2,
                "timezone": "auto",
            },
        )
        snap = parse_air_response(data, label, latitude, longitude)
        self._cache.put(key, snap)
        return snap


def _num(value: Any) -> float | None:
    return float(value) if isinstance(value, int | float) and not isinstance(value, bool) else None


def parse_air_response(
    data: dict[str, Any], label: str, latitude: float, longitude: float
) -> AirSnapshot:
    """Convert an Open-Meteo payload into an AirSnapshot (tolerant of missing fields)."""
    current = data.get("current")
    if not isinstance(current, dict) or _num(current.get("us_aqi")) is None:
        raise AirDataError("no current air quality data for this location")
    hourly_raw = data.get("hourly") or {}
    times = hourly_raw.get("time") or []
    values = hourly_raw.get("us_aqi") or []
    hourly = [HourlyPoint(time=str(t), us_aqi=_num(v)) for t, v in zip(times, values, strict=False)]
    observed = str(current.get("time", ""))
    hour_prefix = observed[:13]
    index = next((i for i, p in enumerate(hourly) if p.time[:13] == hour_prefix), 0)
    return AirSnapshot(
        location_name=label,
        latitude=latitude,
        longitude=longitude,
        timezone=str(data.get("timezone", "UTC")),
        observed_at=observed,
        aqi=float(current["us_aqi"]),
        pollutants={p: _num(current.get(p)) for p in _POLLUTANTS},
        sub_indices={p: _num(current.get(f"us_aqi_{p}")) for p in _POLLUTANTS},
        hourly=hourly[index : index + 24],
        current_index=0,
    )
