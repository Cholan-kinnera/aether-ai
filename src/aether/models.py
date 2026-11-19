"""Typed request/response models shared by every layer."""
from __future__ import annotations

from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator


class Group(StrEnum):
    ASTHMA = "asthma"
    CHILD = "child"
    ELDERLY = "elderly"
    PREGNANT = "pregnant"
    HEART = "heart_condition"


class Activity(StrEnum):
    REST = "rest"
    WALK = "walk"
    COMMUTE = "commute"
    CYCLE = "cycle"
    RUN = "run"


class Verdict(StrEnum):
    GO = "go"
    CAUTION = "caution"
    LIMIT = "limit"
    AVOID = "avoid"




Place = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]


class AdviceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    location: Place | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    groups: list[Group] = Field(default_factory=list, max_length=5)
    activity: Activity | None = None
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = None

    @model_validator(mode="after")
    def _check_location(self) -> AdviceRequest:
        has_lat, has_lon = self.latitude is not None, self.longitude is not None
        if has_lat != has_lon:
            raise ValueError("latitude and longitude must be provided together")
        if not self.location and not has_lat:
            raise ValueError("provide a location name or latitude/longitude")
        return self


class HourlyPoint(BaseModel):
    time: str
    us_aqi: float | None


class AirSnapshot(BaseModel):
    location_name: str
    latitude: float
    longitude: float
    timezone: str
    observed_at: str
    aqi: float
    pollutants: dict[str, float | None] = Field(default_factory=dict)
    sub_indices: dict[str, float | None] = Field(default_factory=dict)
    hourly: list[HourlyPoint] = Field(default_factory=list)
    current_index: int = 0


class BestWindow(BaseModel):
    start: str
    end: str
    mean_aqi: float
    verdict: Verdict
    starts_now: bool


class Decision(BaseModel):
    aqi: float
    adjusted_aqi: float
    category: str
    dominant_pollutant: str | None
    verdict: Verdict
    multiplier: float
    reasons: list[str]
    actions: list[str]
    best_window: BestWindow | None


class AdviceResponse(BaseModel):
    location: str
    observed_at: str
    profile: dict[str, object]
    decision: Decision
    explanation: str
    explanation_source: str
    hourly: list[HourlyPoint]
    disclaimer: str
