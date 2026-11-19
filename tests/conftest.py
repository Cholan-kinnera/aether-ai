import pytest

from aether.models import AirSnapshot, HourlyPoint


def make_snapshot(aqi: float = 80, hourly: list[float | None] | None = None, **kw) -> AirSnapshot:
    values = hourly if hourly is not None else [aqi, 60, 40, 45, 90, 120]
    return AirSnapshot(
        location_name=kw.get("name", "Testville, Land"),
        latitude=1.0,
        longitude=2.0,
        timezone="UTC",
        observed_at="2026-11-19T10:00",
        aqi=aqi,
        pollutants={"pm2_5": 30.0},
        sub_indices=kw.get("sub", {"pm2_5": aqi, "ozone": 20.0, "pm10": None}),
        hourly=[HourlyPoint(time=f"2026-11-19T{10 + i:02d}:00", us_aqi=v) for i, v in enumerate(values)],
        current_index=0,
    )


@pytest.fixture
def snapshot() -> AirSnapshot:
    return make_snapshot()
