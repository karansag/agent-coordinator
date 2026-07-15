"""Pure step() tests with fabricated observations; no loop, no tmux."""

from agent_msg import activity
from agent_msg.activity import Observation

INTERVAL = 5.0
GRACE = 15.0

CLAUDE_DIALOG = "Do you want to proceed?\n❯ 1. Yes\n  2. No\nEsc to cancel"


def obs(user_id="otter", flavor="claude", pane_alive=True, capture="hello"):
    return Observation(user_id, flavor, pane_alive, capture)


def run(reg, observations, now):
    return activity.step(reg, observations, now, INTERVAL, GRACE)


def test_snapshot_hash_ignores_trailing_whitespace():
    assert activity.snapshot_hash("a   \nb\n\n") == activity.snapshot_hash("a\nb")
    assert activity.snapshot_hash("a") != activity.snapshot_hash("b")


def test_changed_capture_reads_working():
    reg = {}
    run(reg, [obs(capture="screen 1")], now=0)
    run(reg, [obs(capture="screen 2")], now=INTERVAL)
    assert reg["otter"]["status"] == "working"
    assert reg["otter"]["changed_at"] == INTERVAL


def test_static_short_keeps_previous_status():
    reg = {}
    run(reg, [obs(capture="A")], now=0)  # working
    run(reg, [obs(capture="A")], now=INTERVAL)  # < 2*interval static
    assert reg["otter"]["status"] == "working"


def test_static_long_reads_idle():
    reg = {}
    run(reg, [obs(capture="A")], now=0)
    run(reg, [obs(capture="A")], now=3 * INTERVAL)
    assert reg["otter"]["status"] == "idle"
    assert reg["otter"]["detail"] is None


def test_static_long_with_dialog_reads_needs_attention():
    reg = {}
    run(reg, [obs(capture=CLAUDE_DIALOG)], now=0)
    run(reg, [obs(capture=CLAUDE_DIALOG)], now=3 * INTERVAL)
    assert reg["otter"]["status"] == "needs_attention"
    assert reg["otter"]["detail"] == "Do you want to proceed?"


def test_capture_failure_reads_unknown():
    reg = {}
    run(reg, [obs(capture=None)], now=0)
    assert reg["otter"]["status"] == "unknown"


def test_dead_pane_reads_stopped():
    reg = {}
    run(reg, [obs(pane_alive=False, capture=None)], now=0)
    assert reg["otter"]["status"] == "stopped"


def test_dead_pane_beats_capture():
    reg = {}
    run(reg, [obs(pane_alive=False, capture="whatever")], now=0)
    assert reg["otter"]["status"] == "stopped"


def test_notification_emitted_once_then_rearmed():
    reg = {}
    # Establish the static dialog and let it become needs_attention.
    run(reg, [obs(capture=CLAUDE_DIALOG)], now=0)
    run(reg, [obs(capture=CLAUDE_DIALOG)], now=3 * INTERVAL)
    assert reg["otter"]["status"] == "needs_attention"
    since = reg["otter"]["since"]

    # Before grace elapses: no notification.
    assert run(reg, [obs(capture=CLAUDE_DIALOG)], now=since + GRACE - 1) == []
    # At/after grace: exactly one.
    notes = run(reg, [obs(capture=CLAUDE_DIALOG)], now=since + GRACE)
    assert notes == [activity.Notification("otter", "Do you want to proceed?")]
    # Still attention, already notified: silent.
    assert run(reg, [obs(capture=CLAUDE_DIALOG)], now=since + GRACE + INTERVAL) == []

    # Recovery re-arms: agent works, then a fresh dialog fires again.
    run(reg, [obs(capture="back to work")], now=since + GRACE + 2 * INTERVAL)
    assert reg["otter"]["status"] == "working"
    assert reg["otter"]["notified"] is False
    base = since + GRACE + 10 * INTERVAL
    run(reg, [obs(capture=CLAUDE_DIALOG)], now=base)
    run(reg, [obs(capture=CLAUDE_DIALOG)], now=base + 3 * INTERVAL)
    new_since = reg["otter"]["since"]
    notes2 = run(reg, [obs(capture=CLAUDE_DIALOG)], now=new_since + GRACE)
    assert notes2 == [activity.Notification("otter", "Do you want to proceed?")]


def test_unregistered_users_dropped():
    reg = {}
    run(reg, [obs(user_id="otter"), obs(user_id="tapir")], now=0)
    assert set(reg) == {"otter", "tapir"}
    run(reg, [obs(user_id="otter")], now=INTERVAL)
    assert set(reg) == {"otter"}
