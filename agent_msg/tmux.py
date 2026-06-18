"""Tmux delivery. Keeps stdin/text-injection details in one place."""

from __future__ import annotations

import os
import subprocess
import time


def current_pane() -> str | None:
    """Return the caller's own pane id (session:window.pane), or None if not in tmux."""
    pane_target = os.environ.get("TMUX_PANE")
    command = ["tmux", "display-message", "-p"]
    if pane_target:
        command.extend(["-t", pane_target])
    command.append("#S:#I.#P")
    try:
        out = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True,
            timeout=2,
        )
    except (subprocess.SubprocessError, FileNotFoundError):
        return None
    val = out.stdout.strip()
    return val or None


DEFAULT_FLAVOR = "generic"

DEFAULT_SUBMIT_KEY = "C-m"

FLAVOR_SUBMIT_KEYS = {
    "generic": DEFAULT_SUBMIT_KEY,
    "claude": DEFAULT_SUBMIT_KEY,
    "codex": "Enter",
    "hermes": DEFAULT_SUBMIT_KEY,
}

FLAVOR_SUBMIT_DELAYS = {
    "codex": 0.2,
}


def infer_flavor(model: str | None) -> str:
    """Best-effort default delivery flavor from a telemetry model label."""
    if not model:
        return DEFAULT_FLAVOR
    label = model.lower()
    if "codex" in label:
        return "codex"
    if "claude" in label:
        return "claude"
    if "hermes" in label:
        return "hermes"
    return DEFAULT_FLAVOR


def submit_key_for_flavor(flavor: str | None) -> str:
    """Return the default submit key for a delivery flavor."""
    if not flavor:
        return DEFAULT_SUBMIT_KEY
    return FLAVOR_SUBMIT_KEYS.get(flavor.lower(), DEFAULT_SUBMIT_KEY)


def submit_delay_for_flavor(flavor: str | None) -> float:
    """Return the delay to wait after text injection before submit."""
    if not flavor:
        return 0.0
    return FLAVOR_SUBMIT_DELAYS.get(flavor.lower(), 0.0)


def status_title(user_id: str, flavor: str | None = None) -> str:
    """Return the short label shown in tmux pane titles."""
    if flavor:
        return f"agent-msg: {user_id} ({flavor})"
    return f"agent-msg: {user_id}"


def set_pane_title(pane: str, title: str) -> tuple[bool, str | None]:
    """Set a tmux pane title without renaming the window or agent session."""
    try:
        subprocess.run(
            ["tmux", "select-pane", "-t", pane, "-T", title],
            capture_output=True,
            text=True,
            check=True,
            timeout=2,
        )
    except subprocess.CalledProcessError as e:
        return False, e.stderr.strip() or str(e)
    except (subprocess.SubprocessError, FileNotFoundError) as e:
        return False, str(e)
    return True, None


def deliver(
    pane: str,
    text: str,
    message_prefix: str | None = None,
    submit_key: str = DEFAULT_SUBMIT_KEY,
    flavor: str | None = None,
) -> tuple[bool, str | None]:
    """Inject text into a tmux pane as if typed, then submit it.

    Returns (ok, error_message_or_None).
    """
    injected = f"{message_prefix or ''}{text}"
    try:
        # send the text literally (-l), then submit it with the configured key.
        subprocess.run(
            ["tmux", "send-keys", "-t", pane, "-l", injected],
            capture_output=True,
            text=True,
            check=True,
            timeout=5,
        )
        delay = submit_delay_for_flavor(flavor)
        if delay > 0:
            time.sleep(delay)
        subprocess.run(
            ["tmux", "send-keys", "-t", pane, submit_key],
            capture_output=True,
            text=True,
            check=True,
            timeout=5,
        )
    except subprocess.CalledProcessError as e:
        return False, e.stderr.strip() or str(e)
    except (subprocess.SubprocessError, FileNotFoundError) as e:
        return False, str(e)
    return True, None


def format_message(sender: str, context: str | None, content: str) -> str:
    """Compose the inbound message body that lands in the recipient's pane."""
    head = f"[agent-msg from {sender}"
    if context:
        head += f" · {context}"
    head += "] "
    return head + content
