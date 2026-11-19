"""Low-exposure daily routine: place each planned activity in its cleanest forecast hours."""

from __future__ import annotations

import math
from datetime import datetime, timedelta

from .models import AirSnapshot, Member, PlannedActivity, ScheduledActivity, Verdict
from .rules import HARD_EXERCISE, cleanest_window, verdict_for

_ADVICE = {
    Verdict.GO: "Good slot for this activity.",
    Verdict.CAUTION: "Acceptable slot; keep the effort moderate.",
    Verdict.LIMIT: "Even the cleanest slot is polluted; shorten it or do it indoors.",
    Verdict.AVOID: "Air stays poor all day; do an indoor alternative instead.",
}


def plan_day(
    snapshot: AirSnapshot, activities: list[PlannedActivity], members: list[Member]
) -> list[ScheduledActivity]:
    """Longest activities are placed first so they get the cleanest long blocks."""
    sensitive = any(m.groups for m in members)
    taken: list[tuple[datetime, datetime]] = []
    placed: dict[int, ScheduledActivity] = {}
    order = sorted(range(len(activities)), key=lambda i: -activities[i].duration_hours)
    for i in order:
        item = activities[i]
        hours = math.ceil(item.duration_hours)
        window = cleanest_window(
            snapshot.hourly, hours, item.earliest_hour, item.latest_hour, taken
        )
        if window is None:
            placed[i] = ScheduledActivity(
                label=item.label,
                activity=item.activity,
                window=None,
                verdict=None,
                advice="No forecast slot fits this time range; try widening it.",
            )
            continue
        start = datetime.fromisoformat(window.start)
        taken.append((start, start + timedelta(hours=hours)))
        verdict = verdict_for(window.mean_aqi, sensitive, item.activity in HARD_EXERCISE)
        placed[i] = ScheduledActivity(
            label=item.label,
            activity=item.activity,
            window=window,
            verdict=verdict,
            advice=_ADVICE[verdict],
        )
    return [placed[i] for i in range(len(activities))]
