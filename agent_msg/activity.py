"""Agent activity classification for the dashboard monitor.

Pure functions plus one registry-updating step function, so tests never
need the monitor loop or tmux. The server's monitor loop feeds captures
in as Observations and records the returned Notifications.
"""

from __future__ import annotations

import hashlib
import re
from typing import NamedTuple


class Observation(NamedTuple):
    user_id: str
    flavor: str | None
    pane_alive: bool
    capture: str | None  # None means the capture failed this tick


class Notification(NamedTuple):
    user_id: str
    detail: str


def snapshot_hash(text: str) -> str:
    """sha1 of a capture with trailing whitespace stripped per line and overall.

    Cursor blinking and trailing spaces should not register as activity.
    """
    normalized = "\n".join(line.rstrip() for line in text.splitlines()).rstrip()
    return hashlib.sha1(normalized.encode("utf-8")).hexdigest()


def _compile(*patterns: str) -> list[re.Pattern]:
    return [re.compile(p) for p in patterns]


# Deliberately small starting set. Keys are delivery flavors; "generic" is
# the fallback for any flavor without its own entry (also hermes, pi).
ATTENTION_PATTERNS: dict[str, list[re.Pattern]] = {
    "claude": _compile(r"Do you want to", r"❯ 1\. Yes", r"Esc to cancel"),
    "codex": _compile(r"Allow command", r"\by/n\b", r"Approve"),
    "generic": _compile(r"\[y/N\]", r"\(y/n\)", r"password:"),
}


def _attention_detail(flavor: str | None, capture: str) -> str | None:
    """Return the first (topmost) screen line that looks like a prompt
    awaiting the operator, or None. The line is stripped for display."""
    patterns = ATTENTION_PATTERNS.get(
        (flavor or "generic").lower(), ATTENTION_PATTERNS["generic"]
    )
    for line in capture.splitlines():
        if any(p.search(line) for p in patterns):
            return line.strip()
    return None


def step(
    registry: dict[str, dict],
    observations: list[Observation],
    now: float,
    interval: float,
    grace: float,
) -> list[Notification]:
    """Advance each agent's status from a fresh round of observations.

    Mutates `registry[user_id]` in place and returns the attention
    notifications that crossed the grace threshold this tick. Registry
    rows for users not present in `observations` are dropped.
    """
    notifications: list[Notification] = []
    seen: set[str] = set()

    for obs in observations:
        seen.add(obs.user_id)
        prev = registry.get(obs.user_id)
        prev_status = prev["status"] if prev else None
        prev_hash = prev["hash"] if prev else None
        prev_changed_at = prev["changed_at"] if prev else now
        prev_since = prev["since"] if prev else now
        prev_detail = prev["detail"] if prev else None
        prev_notified = prev["notified"] if prev else False

        detail: str | None = None
        snap = prev_hash
        changed_at = prev_changed_at

        if not obs.pane_alive:
            status = "stopped"
        elif obs.capture is None:
            status = "unknown"
        else:
            snap = snapshot_hash(obs.capture)
            if snap != prev_hash:
                status = "working"
                changed_at = now
            elif now - prev_changed_at < 2 * interval:
                # A pane is not "idle" the instant it stops changing.
                status = prev_status or "working"
                detail = prev_detail if status == "needs_attention" else None
            else:
                matched = _attention_detail(obs.flavor, obs.capture)
                if matched is not None:
                    status = "needs_attention"
                    detail = matched
                else:
                    status = "idle"

        status_changed = status != prev_status
        since = now if status_changed else prev_since

        if status == "needs_attention":
            notified = False if status_changed else prev_notified
            if not notified and now - since >= grace:
                notifications.append(Notification(obs.user_id, detail or ""))
                notified = True
        else:
            notified = False

        registry[obs.user_id] = {
            "hash": snap,
            "changed_at": changed_at,
            "status": status,
            "detail": detail,
            "since": since,
            "notified": notified,
        }

    for user_id in list(registry):
        if user_id not in seen:
            del registry[user_id]

    return notifications
