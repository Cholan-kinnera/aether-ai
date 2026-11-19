from conftest import make_snapshot

from aether.models import Activity, Group, Member, PlannedActivity, Verdict
from aether.planner import plan_day


def act(label, activity=Activity.WALK, hours=1, earliest=0, latest=24):
    return PlannedActivity(
        label=label,
        activity=activity,
        duration_hours=hours,
        earliest_hour=earliest,
        latest_hour=latest,
    )


def test_activities_get_distinct_clean_slots_in_input_order():
    snap = make_snapshot(hourly=[100, 30, 20, 25, 90, 120])
    plan = plan_day(snap, [act("Walk"), act("Football", Activity.RUN, 2)], [Member()])
    assert [p.label for p in plan] == ["Walk", "Football"]
    football, walk = plan[1], plan[0]
    assert football.window.start[11:16] == "12:00"  # longest placed first: 12-14 (20, 25)
    assert walk.window.start[11:16] == "11:00"
    assert football.verdict is Verdict.CAUTION  # hard exercise, good air


def test_sensitive_member_makes_schedule_stricter():
    snap = make_snapshot(hourly=[120, 120, 120])
    plan = plan_day(snap, [act("Walk")], [Member(), Member(groups=[Group.ASTHMA])])
    assert plan[0].verdict is Verdict.LIMIT
    assert "shorten" in plan[0].advice


def test_unfittable_activity_reported():
    snap = make_snapshot(hourly=[50, 50, 50])
    plan = plan_day(snap, [act("Late", earliest=20, latest=22)], [Member()])
    assert plan[0].window is None and plan[0].verdict is None
    assert "widening" in plan[0].advice


def test_half_hour_rounds_up_and_empty_plan():
    snap = make_snapshot(hourly=[10, 20])
    assert plan_day(snap, [act("Stroll", hours=0.5)], [Member()])[0].window.start[11:16] == "10:00"
    assert plan_day(snap, [], [Member()]) == []
