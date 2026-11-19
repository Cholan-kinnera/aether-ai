import httpx
import pytest
import respx

from aether.airdata import (
    AIR_URL,
    GEOCODE_URL,
    AirDataError,
    LocationNotFoundError,
    OpenMeteoClient,
    TTLCache,
    parse_air_response,
)
from conftest import make_snapshot

GEO = {"results": [{"name": "Kadapa", "admin1": "Andhra Pradesh", "country": "India",
                    "latitude": 14.48, "longitude": 78.82}]}
AIR = {
    "timezone": "Asia/Kolkata",
    "current": {"time": "2026-11-19T18:00", "us_aqi": 120, "pm2_5": 40.0, "us_aqi_pm2_5": 120,
                "us_aqi_ozone": 30},
    "hourly": {"time": [f"2026-11-19T{h:02d}:00" for h in range(16, 24)] + ["2026-11-20T00:00"],
               "us_aqi": [100, 110, 120, 130, None, 90, 80, 70, 60]},
}


def test_parse_uses_current_hour_as_start():
    snap = parse_air_response(AIR, "Kadapa", 14.48, 78.82)
    assert snap.aqi == 120
    assert snap.hourly[0].time == "2026-11-19T18:00"
    assert snap.sub_indices["pm2_5"] == 120 and snap.sub_indices["pm10"] is None
    assert snap.hourly[2].us_aqi is None


def test_parse_rejects_missing_current():
    with pytest.raises(AirDataError):
        parse_air_response({"current": {}}, "x", 0, 0)
    with pytest.raises(AirDataError):
        parse_air_response({}, "x", 0, 0)


def test_parse_ignores_bool_and_strings():
    data = {"current": {"time": "t", "us_aqi": 10, "pm2_5": True, "pm10": "5"}}
    snap = parse_air_response(data, "x", 0, 0)
    assert snap.pollutants["pm2_5"] is None and snap.pollutants["pm10"] is None


@respx.mock
async def test_snapshot_by_name_geocodes_then_caches():
    geo = respx.get(GEOCODE_URL).mock(return_value=httpx.Response(200, json=GEO))
    air = respx.get(AIR_URL).mock(return_value=httpx.Response(200, json=AIR))
    async with httpx.AsyncClient() as http:
        client = OpenMeteoClient(http)
        first = await client.snapshot(location="Kadapa", latitude=None, longitude=None)
        second = await client.snapshot(location="kadapa", latitude=None, longitude=None)
    assert first.location_name == "Kadapa, Andhra Pradesh, India"
    assert second is first
    assert geo.call_count == 1 and air.call_count == 1


@respx.mock
async def test_snapshot_by_coordinates_skips_geocoding():
    geo = respx.get(GEOCODE_URL).mock(return_value=httpx.Response(200, json=GEO))
    respx.get(AIR_URL).mock(return_value=httpx.Response(200, json=AIR))
    async with httpx.AsyncClient() as http:
        snap = await OpenMeteoClient(http).snapshot(location=None, latitude=14.48, longitude=78.82)
    assert snap.location_name == "14.48, 78.82" and not geo.called


@respx.mock
async def test_unknown_place_raises_not_found():
    respx.get(GEOCODE_URL).mock(return_value=httpx.Response(200, json={}))
    async with httpx.AsyncClient() as http:
        with pytest.raises(LocationNotFoundError):
            await OpenMeteoClient(http).snapshot(location="Nowhereville", latitude=None, longitude=None)


@respx.mock
async def test_upstream_failures_become_air_data_error():
    respx.get(GEOCODE_URL).mock(return_value=httpx.Response(200, json=GEO))
    respx.get(AIR_URL).mock(return_value=httpx.Response(500))
    async with httpx.AsyncClient() as http:
        with pytest.raises(AirDataError):
            await OpenMeteoClient(http).snapshot(location="Kadapa", latitude=None, longitude=None)


@respx.mock
async def test_non_json_and_non_object_bodies_rejected():
    respx.get(GEOCODE_URL).mock(return_value=httpx.Response(200, text="<html>"))
    async with httpx.AsyncClient() as http:
        with pytest.raises(AirDataError):
            await OpenMeteoClient(http).snapshot(location="x1", latitude=None, longitude=None)
    respx.get(GEOCODE_URL).mock(return_value=httpx.Response(200, json=[1, 2]))
    async with httpx.AsyncClient() as http:
        with pytest.raises(AirDataError):
            await OpenMeteoClient(http).snapshot(location="x2", latitude=None, longitude=None)


async def test_missing_location_and_coordinates():
    async with httpx.AsyncClient() as http:
        with pytest.raises(LocationNotFoundError):
            await OpenMeteoClient(http).snapshot(location=None, latitude=None, longitude=None)


def test_cache_expires_and_evicts(monkeypatch):
    snap = make_snapshot()
    cache = TTLCache(ttl_seconds=10, max_entries=2)
    now = [100.0]
    monkeypatch.setattr("aether.airdata.time.monotonic", lambda: now[0])
    cache.put("a", snap)
    cache.put("b", snap)
    cache.put("c", snap)  # evicts "a"
    assert cache.get("a") is None and cache.get("b") is snap
    now[0] = 200.0
    assert cache.get("b") is None
