"""Typed request/response contracts shared by every layer."""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator


class Group(StrEnum):
    """Health groups that are more sensitive to air pollution."""

    ASTHMA = "asthma"
    CHILD = "child"
    ELDERLY = "elderly"
    PREGNANT = "pregnant"
    HEART = "heart_condition"


class Activity(StrEnum):
    """Outdoor activity, ordered from rest to hard exercise."""

    REST = "rest"
    WALK = "walk"
    COMMUTE = "commute"
    CYCLE = "cycle"
    RUN = "run"


class Verdict(StrEnum):
    """Advice level: go, caution, limit or avoid."""

    GO = "go"
    CAUTION = "caution"
    LIMIT = "limit"
    AVOID = "avoid"


class Mode(StrEnum):
    """Commute mode with a published emission factor."""

    CAR_PETROL = "car_petrol"
    CAR_DIESEL = "car_diesel"
    CAR_HYBRID = "car_hybrid"
    CAR_EV = "car_ev"
    MOTORBIKE = "motorbike"
    TAXI = "taxi"
    BUS = "bus"
    METRO = "metro"
    RAIL = "rail"
    CYCLE = "cycle"
    WALK = "walk"


Place = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]
Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Member(_Strict):
    """One person in the household."""

    name: Label = "You"
    groups: list[Group] = Field(default_factory=list, max_length=5)


class PlannedActivity(_Strict):
    """An outdoor plan to schedule into the cleanest hours."""

    label: Label
    activity: Activity
    duration_hours: float = Field(ge=0.25, le=8)
    earliest_hour: int = Field(default=6, ge=0, le=23)
    latest_hour: int = Field(default=22, ge=1, le=24)

    @model_validator(mode="after")
    def _check_range(self) -> PlannedActivity:
        if self.latest_hour - self.earliest_hour < self.duration_hours:
            raise ValueError("time range is shorter than the activity")
        return self


class Home(_Strict):
    """Main room and optional purifier, for indoor advice."""

    floor_area_m2: float = Field(ge=4, le=200)
    ceiling_height_m: float = Field(default=2.7, ge=2, le=5)
    purifier_cadr_m3h: float | None = Field(default=None, ge=0, le=3000)


class Commute(_Strict):
    """A regular trip, for the emissions and exposure comparison."""

    distance_km: float = Field(gt=0, le=100)
    current_mode: Mode
    occupants: int = Field(default=1, ge=1, le=7)
    trips_per_week: int = Field(default=10, ge=1, le=28)


class PlanRequest(_Strict):
    """POST /api/plan body: a place (name or coordinates) plus household details."""

    location: Place | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    members: list[Member] = Field(default_factory=lambda: [Member()], min_length=1, max_length=8)
    activities: list[PlannedActivity] = Field(default_factory=list, max_length=6)
    home: Home | None = None
    commute: Commute | None = None
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = None

    @model_validator(mode="after")
    def _check_location(self) -> PlanRequest:
        has_lat, has_lon = self.latitude is not None, self.longitude is not None
        if has_lat != has_lon:
            raise ValueError("latitude and longitude must be provided together")
        if not self.location and not has_lat:
            raise ValueError("provide a location name or latitude/longitude")
        return self


# ---------------------------------------------------------------- air data


class HourlyPoint(BaseModel):
    """One forecast hour: US AQI and PM2.5."""

    time: str
    us_aqi: float | None
    pm2_5: float | None = None


class Weather(BaseModel):
    """Weather that drives pollution: wind and boundary-layer mixing."""

    wind_speed_kmh: float | None
    boundary_layer_m: float | None
    peak_mixing_time: str | None
    peak_boundary_layer_m: float | None


class Provenance(BaseModel):
    """Where a value came from, when it was fetched and whether it is stale."""

    source: str = "Open-Meteo Air Quality API"
    model: str = "CAMS (Copernicus Atmosphere Monitoring Service) forecast"
    kind: Literal["model_estimate"] = "model_estimate"
    observed_at: str
    retrieved_at: str
    data_age_minutes: int
    stale: bool
    attribution: str = "Air quality data by Open-Meteo.com (CC BY 4.0), based on Copernicus CAMS"
    licence_url: str = "https://open-meteo.com/en/licence"


class AirSnapshot(BaseModel):
    """Modelled air quality for one place, with its provenance."""

    location_name: str
    latitude: float
    longitude: float
    timezone: str
    aqi: float
    pollutants: dict[str, float | None] = Field(default_factory=dict)
    sub_indices: dict[str, float | None] = Field(default_factory=dict)
    hourly: list[HourlyPoint] = Field(default_factory=list)
    provenance: Provenance
    weather: Weather | None = None


# ---------------------------------------------------------------- outputs


class TimeWindow(BaseModel):
    """A run of consecutive forecast hours and their mean AQI."""

    start: str
    end: str
    mean_aqi: float
    starts_now: bool


class MemberAdvice(BaseModel):
    """Verdict and reasons for one household member."""

    name: str
    groups: list[Group]
    verdict: Verdict
    reasons: list[str]
    actions: list[str]


class ScheduledActivity(BaseModel):
    """A plan moved into its cleanest window, with the inhaled PM2.5 dose."""

    label: str
    activity: Activity
    window: TimeWindow | None
    verdict: Verdict | None
    advice: str
    # Personal exposure (micro), never emissions: PM2.5 breathed in during the activity.
    inhaled_pm25_ug: float | None = None
    inhaled_pm25_now_ug: float | None = None
    exposure_note: str | None = None


class IndoorAdvice(BaseModel):
    """Indoor air steps and purifier adequacy."""

    room_volume_m3: float
    recommended_cadr_m3h: float
    purifier_cadr_m3h: float | None
    clean_air_changes_per_hour: float | None
    minutes_to_cut_particles_90pct: int | None
    purifier_adequate: bool | None
    airing_window: TimeWindow | None
    tips: list[str]
    assumptions: list[str]


class ModeOption(BaseModel):
    """Weekly emissions and trip exposure for one commute mode."""

    mode: Mode
    label: str
    minutes_per_trip: int
    # Macro impact: greenhouse-gas emissions, never a health claim.
    emissions_kg_co2e_per_week: float
    emissions_avoided_kg_co2e_per_week: float
    # Micro impact: personal PM2.5 inhaled at today's modelled concentration.
    inhaled_pm25_ug_per_trip: float | None
    is_current: bool


class CommuteAdvice(BaseModel):
    """All feasible commute modes compared with the current one."""

    options: list[ModeOption]
    summary: str
    assumptions: list[str]
    sources: list[str]


class StationReading(BaseModel):
    """One measured value from a monitoring station, exactly as the provider reported it."""

    kind: Literal["station_observation"] = "station_observation"
    station_id: int
    provider: str
    pollutant: str
    label: str
    value: float | None
    unit: str
    observed_at: str | None
    retrieved_at: str
    data_age_minutes: int | None
    stale: bool


class StationObservation(BaseModel):
    """Nearest station with a recent reading. Shown beside, never merged with, the forecast."""

    station_id: int
    station_name: str
    provider: str
    is_reference_monitor: bool
    distance_km: float
    readings: list[StationReading]
    attribution: str
    source: str = "OpenAQ"
    source_url: str = "https://openaq.org"


StationStatus = Literal["ok", "not_configured", "none_nearby", "unavailable"]


class PlanResponse(BaseModel):
    """The full deterministic plan returned by POST /api/plan."""

    location: str
    aqi: float
    category: str
    dominant_pollutant: str | None
    pollutants: dict[str, float | None]
    provenance: Provenance
    weather: Weather | None
    household_verdict: Verdict
    members: list[MemberAdvice]
    best_window: TimeWindow | None
    schedule: list[ScheduledActivity]
    indoor: IndoorAdvice | None
    commute: CommuteAdvice | None
    hourly: list[HourlyPoint]
    station: StationObservation | None = None
    station_status: StationStatus = "not_configured"
    explanation: str
    explanation_source: Literal["gemini", "rules"]
    briefing_id: str | None = None
    disclaimer: str


class Briefing(BaseModel):
    """The AI (or rules) briefing returned by POST /api/briefing/{id}."""

    explanation: str
    explanation_source: Literal["gemini", "rules"]
