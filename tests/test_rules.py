import pytest
from conftest import make_snapshot

from aether.models import Activity, Group, Verdict
from aether.rules import best_window, decide, exposure_multiplier, verdict_for


@pytest.mark.parametrize(
    ("value", "verdict"),
    [(0, Verdict.GO), (50, Verdict.GO), (50.1, Verdict.CAUTION), (100, Verdict.CAUTION),
     (100.1, Verdict.LIMIT), (150, Verdict.LIMIT), (150.1, Verdict.AVOID)],
)
def test_verdict_bands(value, verdict):
    assert verdict_for(value) is verdict


def test_multiplier_components():
    assert exposure_multiplier(set(), Activity.WALK) == 1.0
    assert exposure_multiplier({Group.ASTHMA}, Activity.RUN) == pytest.approx(1.40)


def test_group_bonus_is_capped():
    everyone = set(Group)
    assert exposure_multiplier(everyone, Activity.REST) == pytest.approx(1.5)


def test_same_air_different_people_different_verdicts():
    snap = make_snapshot(aqi=80)
    general = decide(snap, set(), Activity.WALK)
    asthmatic_runner = decide(snap, {Group.ASTHMA}, Activity.RUN)
    assert general.verdict is Verdict.CAUTION
    assert asthmatic_runner.verdict is Verdict.AVOID or asthmatic_runner.verdict is Verdict.LIMIT
    assert asthmatic_runner.adjusted_aqi > general.adjusted_aqi


def test_clean_air_is_go_with_no_group_actions():
    decision = decide(make_snapshot(aqi=30), {Group.ASTHMA}, Activity.REST)
    assert decision.verdict is Verdict.GO
    assert len(decision.actions) == 1


def test_avoid_includes_mask_group_and_pollutant_advice():
    snap = make_snapshot(aqi=180, sub={"pm2_5": 180, "ozone": 10})
    decision = decide(snap, {Group.ASTHMA}, Activity.RUN)
    text = " ".join(decision.actions)
    assert decision.verdict is Verdict.AVOID
    assert "N95" in text and "inhaler" in text and "particles" in text
    assert any("PM2.5" in r for r in decision.reasons)


def test_best_window_finds_cleanest_two_hours():
    snap = make_snapshot(aqi=80)  # hourly: 80,60,40,45,90,120
    window = best_window(snap, 1.0)
    assert window is not None
    assert window.start == "2026-11-19T12:00" and window.end == "2026-11-19T14:00"
    assert window.mean_aqi == 42.5 and window.verdict is Verdict.GO
    assert window.starts_now is False


def test_best_window_starts_now_when_now_is_cleanest():
    window = best_window(make_snapshot(aqi=20, hourly=[20, 25, 80, 90]), 1.0)
    assert window is not None and window.starts_now


def test_best_window_skips_missing_values_and_handles_short_data():
    assert best_window(make_snapshot(hourly=[None, None, None]), 1.0) is None
    assert best_window(make_snapshot(hourly=[50]), 1.0) is None
    window = best_window(make_snapshot(hourly=[10, None, 30, 35]), 1.0)
    assert window is not None and window.start == "2026-11-19T12:00"


def test_best_window_verdict_uses_multiplier():
    window = best_window(make_snapshot(hourly=[80, 80, 80]), 1.5)
    assert window is not None and window.verdict is Verdict.LIMIT
