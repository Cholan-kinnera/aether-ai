"""AETHER app with fixed air data for browser tests: no network, no API key, deterministic."""

from conftest import make_snapshot

from aether.airdata import LocationNotFoundError
from aether.api import create_app
from aether.config import Settings
from aether.models import AirSnapshot

# A smoggy day that clears in the afternoon, so the planner has a clear cleanest window.
HOURLY: list[float | None] = [170.0, 172, 175, 168, 160, 150, 140, 120, 95, 80, 70, 65]
HOURLY += [90.0 + 5 * i for i in range(12)]


class FixtureAir:
    async def snapshot(
        self, *, location: str | None, latitude: float | None, longitude: float | None
    ) -> AirSnapshot:
        if location and location.lower() == "nowhere":
            raise LocationNotFoundError("could not find a place called 'Nowhere'")
        return make_snapshot(aqi=170, hourly=HOURLY, pm25=95.0, name=f"{location}, Test State")


def app():  # type: ignore[no-untyped-def]
    return create_app(Settings(rate_limit_per_minute=1000), FixtureAir())
