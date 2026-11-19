"""Transparent, testable decision engine.

The verdict is computed here, never by an LLM. An "exposure-adjusted AQI" scales the
measured AQI by how sensitive the person is and how much air their activity makes them
breathe, then maps it onto the standard EPA bands.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from .aqi import POLLUTANT_LABELS, categorize, dominant_pollutant
from .models import (
    Activity,
    AirSnapshot,
    BestWindow,
    Decision,
    Group,
    HourlyPoint,
    Verdict,
)

GROUP_BONUS = 0.25
MAX_GROUP_BONUS = 0.50
ACTIVITY_BONUS: dict[Activity, float] = {
    Activity.REST: 0.0,
    Activity.WALK: 0.0,
    Activity.COMMUTE: 0.05,
    Activity.CYCLE: 0.10,
    Activity.RUN: 0.15,
}
WINDOW_HOURS = 2
LOOKAHEAD_HOURS = 24

GROUP_LABELS = {
    Group.ASTHMA: "asthma or a lung condition",
    Group.CHILD: "children",
    Group.ELDERLY: "older adults",
    Group.PREGNANT: "pregnancy",
    Group.HEART: "a heart condition",
}


def exposure_multiplier(groups: set[Group], activity: Activity) -> float:
    return 1.0 + min(GROUP_BONUS * len(groups), MAX_GROUP_BONUS) + ACTIVITY_BONUS[activity]


def verdict_for(adjusted_aqi: float) -> Verdict:
    if adjusted_aqi <= 50:
        return Verdict.GO
    if adjusted_aqi <= 100:
        return Verdict.CAUTION
    if adjusted_aqi <= 150:
        return Verdict.LIMIT
    return Verdict.AVOID


def _window_start(points: list[HourlyPoint], start: int, hours: int) -> list[float] | None:
    values = [p.us_aqi for p in points[start : start + hours]]
    if len(values) < hours or any(v is None for v in values):
        return None
    return [float(v) for v in values if v is not None]


def best_window(snapshot: AirSnapshot, multiplier: float) -> BestWindow | None:
    """Cleanest consecutive WINDOW_HOURS block within the next LOOKAHEAD_HOURS."""
    first = snapshot.current_index
    last = min(len(snapshot.hourly), first + LOOKAHEAD_HOURS)
    best: tuple[float, int] | None = None
    for start in range(first, last):
        values = _window_start(snapshot.hourly[:last], start, WINDOW_HOURS)
        if values is None:
            continue
        mean = sum(values) / len(values)
        if best is None or mean < best[0]:
            best = (mean, start)
    if best is None:
        return None
    mean, start = best
    begin = datetime.fromisoformat(snapshot.hourly[start].time)
    end = begin + timedelta(hours=WINDOW_HOURS)
    return BestWindow(
        start=begin.strftime("%Y-%m-%dT%H:%M"),
        end=end.strftime("%Y-%m-%dT%H:%M"),
        mean_aqi=round(mean, 1),
        verdict=verdict_for(mean * multiplier),
        starts_now=start == first,
    )


def _reasons(
    snapshot: AirSnapshot,
    adjusted: float,
    multiplier: float,
    groups: set[Group],
    activity: Activity,
) -> list[str]:
    category = categorize(snapshot.aqi)
    dominant = dominant_pollutant(snapshot.sub_indices)
    reasons = [f"Current AQI is {round(snapshot.aqi)} ({category})."]
    if dominant:
        label = POLLUTANT_LABELS.get(dominant, dominant)
        reasons.append(f"{label} is the main pollutant right now.")
    if groups:
        names = ", ".join(GROUP_LABELS[g] for g in sorted(groups))
        reasons.append(f"Extra caution applied for {names}.")
    if ACTIVITY_BONUS[activity] > 0:
        reasons.append(
            f"{activity.value.capitalize()} makes you breathe more air, so exposure counts more."
        )
    if multiplier > 1:
        reasons.append(f"Exposure-adjusted AQI for you is {round(adjusted)}.")
    return reasons


_BASE_ACTIONS: dict[Verdict, list[str]] = {
    Verdict.GO: ["Air is clean. Enjoy your outdoor plans as normal."],
    Verdict.CAUTION: [
        "Fine for most outdoor plans; keep strenuous effort shorter than usual.",
        "Stop and rest indoors if you notice coughing or throat irritation.",
    ],
    Verdict.LIMIT: [
        "Cut outdoor time and intensity, or move hard exercise indoors.",
        "If you must go out, wear a well-fitted N95/FFP2 mask.",
        "Keep windows closed and use a HEPA purifier if you have one.",
    ],
    Verdict.AVOID: [
        "Stay indoors with windows closed and a purifier running if possible.",
        "Skip outdoor exercise today; if you go out, wear a well-fitted N95/FFP2 mask.",
        "Seek medical advice if you have chest tightness, wheezing or breathlessness.",
    ],
}

_GROUP_ACTIONS: dict[Group, str] = {
    Group.ASTHMA: "Keep your quick-relief inhaler within reach and follow your action plan.",
    Group.CHILD: "Keep children's outdoor play short and watch for coughing.",
    Group.ELDERLY: "Older adults should avoid long outdoor stays and rest often.",
    Group.PREGNANT: "Limit time near traffic and avoid exertion outdoors.",
    Group.HEART: "Avoid exertion outdoors and contact your doctor if symptoms appear.",
}

_POLLUTANT_ACTIONS: dict[str, str] = {
    "ozone": "Ozone peaks in afternoon sun; mornings and evenings are usually better.",
    "nitrogen_dioxide": "Choose quiet streets or parks away from heavy traffic.",
    "pm2_5": "Fine particles pass through cloth masks; an N95/FFP2 is the effective option.",
}


def _actions(verdict: Verdict, groups: set[Group], dominant: str | None) -> list[str]:
    actions = list(_BASE_ACTIONS[verdict])
    if verdict in (Verdict.LIMIT, Verdict.AVOID, Verdict.CAUTION):
        actions += [_GROUP_ACTIONS[g] for g in sorted(groups)]
        if dominant in _POLLUTANT_ACTIONS and verdict is not Verdict.CAUTION:
            actions.append(_POLLUTANT_ACTIONS[dominant])
    return actions


def decide(snapshot: AirSnapshot, groups: set[Group], activity: Activity) -> Decision:
    """Turn measurements plus a profile into a verdict, reasons, actions and best time."""
    multiplier = exposure_multiplier(groups, activity)
    adjusted = snapshot.aqi * multiplier
    verdict = verdict_for(adjusted)
    dominant = dominant_pollutant(snapshot.sub_indices)
    return Decision(
        aqi=snapshot.aqi,
        adjusted_aqi=round(adjusted, 1),
        category=categorize(snapshot.aqi),
        dominant_pollutant=dominant,
        verdict=verdict,
        multiplier=round(multiplier, 2),
        reasons=_reasons(snapshot, adjusted, multiplier, groups, activity),
        actions=_actions(verdict, groups, dominant),
        best_window=best_window(snapshot, multiplier),
    )
