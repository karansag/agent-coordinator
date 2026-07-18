"""Tmux delivery. Keeps stdin/text-injection details in one place."""

from __future__ import annotations

import os
import re
import shlex
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
    "pi": "Enter",
}

FLAVOR_SUBMIT_DELAYS = {
    "codex": 0.2,
}

SUBMIT_VERIFY_DELAY = float(os.environ.get("AGENT_MSG_SUBMIT_VERIFY_DELAY", "1.5"))


def _has_label_token(label: str, token: str) -> bool:
    return (
        re.search(rf"(^|[^a-z0-9]){re.escape(token)}([^a-z0-9]|$)", label)
        is not None
    )


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
    if _has_label_token(label, "pi"):
        return "pi"
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


def rename_window(pane: str, name: str) -> tuple[bool, str | None]:
    """Rename the tmux window containing `pane` so it shows the agent's id
    in the window list. Also disables automatic renaming so the launched
    command can't clobber it. Returns (ok, error_message_or_None)."""
    try:
        subprocess.run(
            ["tmux", "set-window-option", "-t", pane, "automatic-rename", "off"],
            capture_output=True,
            text=True,
            check=True,
            timeout=2,
        )
        subprocess.run(
            ["tmux", "rename-window", "-t", pane, name],
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


def _input_signature(pane: str) -> tuple[int, int, str] | None:
    """Return cursor position and the visible row under it.

    A message that remains in an interactive agent's composer after submit
    keeps this signature unchanged. Unsupported panes simply disable the
    retry rather than failing delivery.
    """
    try:
        pos = subprocess.run(
            ["tmux", "display-message", "-p", "-t", pane, "#{cursor_x}\t#{cursor_y}"],
            capture_output=True,
            text=True,
            check=True,
            timeout=2,
        )
        x_text, y_text = pos.stdout.strip().split("\t", 1)
        x, y = int(x_text), int(y_text)
        screen = subprocess.run(
            ["tmux", "capture-pane", "-p", "-t", pane],
            capture_output=True,
            text=True,
            check=True,
            timeout=3,
        )
    except (ValueError, subprocess.SubprocessError, FileNotFoundError):
        return None
    rows = screen.stdout.splitlines()
    if y < 0 or y >= len(rows):
        return None
    return x, y, rows[y].rstrip()


def _signature_contains_tail(signature: tuple[int, int, str], injected: str) -> bool:
    expected = re.sub(r"\s+", " ", injected).strip()[-32:]
    visible = re.sub(r"\s+", " ", signature[2]).strip()
    return bool(expected) and visible.endswith(expected)


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
        delay = max(0.05, submit_delay_for_flavor(flavor))
        time.sleep(delay)
        before_submit = _input_signature(pane)
        subprocess.run(
            ["tmux", "send-keys", "-t", pane, submit_key],
            capture_output=True,
            text=True,
            check=True,
            timeout=5,
        )
        time.sleep(SUBMIT_VERIFY_DELAY)
        after_submit = _input_signature(pane)
        if (
            before_submit is not None
            and after_submit == before_submit
            and _signature_contains_tail(after_submit, injected)
        ):
            # Retry only the submit key once; re-injecting would duplicate text.
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


AGENTS_SESSION = "agents"

# Harnesses the dashboard can spawn. Each has a launch binary, the CLI flag
# that selects a model, and a curated set of known models offered in the UI.
# "generic" is intentionally not spawnable: launching a bare shell produces a
# registered pane with no agent in it, which is not a working target.
#
# startup_args are always passed: they remove interactive startup blockers
# that would leave a freshly spawned pane stuck before the agent is usable
# (e.g. codex's update prompt). auto_args additionally put the harness in a
# non-blocking permission mode so a spawned worker never stops to ask for
# approval; they are only passed when the spawn requests autonomy "auto".
# Every flag verified against the installed harness in a live pane.
class HarnessSpec:
    def __init__(
        self,
        binary: str,
        model_flag: str,
        models: list[str],
        startup_args: str = "",
        auto_args: str = "",
    ):
        self.binary = binary
        self.model_flag = model_flag
        self.models = models
        self.startup_args = startup_args
        self.auto_args = auto_args


HARNESS_SPAWN: dict[str, HarnessSpec] = {
    "claude": HarnessSpec(
        "claude",
        "--model",
        ["opus", "sonnet", "haiku"],
        auto_args="--permission-mode bypassPermissions",
    ),
    "codex": HarnessSpec(
        "codex",
        "--model",
        ["gpt-5-codex", "gpt-5"],
        startup_args="-c check_for_update_on_startup=false",
        auto_args="--ask-for-approval never --sandbox workspace-write",
    ),
    "pi": HarnessSpec(
        "pi",
        "--model",
        [
            "~anthropic/claude-opus-latest",
            "~anthropic/claude-sonnet-latest",
            "~openai/gpt-latest",
        ],
        # pi does not gate commands behind approval prompts; auto needs
        # no extra flags.
    ),
    "hermes": HarnessSpec(
        "hermes",
        "-m",
        [],
        auto_args="--yolo --accept-hooks",
    ),
}

SPAWNABLE_FLAVORS = tuple(HARNESS_SPAWN)


def spawn_options() -> list[dict]:
    """The harness/model menu the dashboard offers, as plain data."""
    return [
        {"flavor": flavor, "models": spec.models}
        for flavor, spec in HARNESS_SPAWN.items()
    ]


def spawn_launch_command(
    flavor: str, model: str | None = None, autonomy: str = "auto"
) -> str | None:
    """Build the shell command that launches a harness in a fresh pane.

    Returns None for an unspawnable flavor. A model is only honored when it is
    one of the harness's known models; it is shell-quoted so patterns like
    `~anthropic/claude-opus-latest` are passed literally (no tilde expansion).
    autonomy "auto" (the default) adds the harness's non-blocking permission
    flags; "supervised" launches it in its normal ask-first mode.
    """
    spec = HARNESS_SPAWN.get(flavor)
    if spec is None:
        return None
    parts = [spec.binary]
    if spec.startup_args:
        parts.append(spec.startup_args)
    if model and model in spec.models:
        parts.append(f"{spec.model_flag} {shlex.quote(model)}")
    if autonomy == "auto" and spec.auto_args:
        parts.append(spec.auto_args)
    return " ".join(parts)


def spawn_window(
    session: str = AGENTS_SESSION, command: str | None = None
) -> tuple[str | None, str | None]:
    """Create a detached tmux window (and session if needed) and optionally
    launch a command in it. Returns (pane_id, error_or_None)."""
    fmt = "#S:#I.#P"
    try:
        has = subprocess.run(
            ["tmux", "has-session", "-t", session],
            capture_output=True,
            text=True,
            timeout=2,
        )
        if has.returncode != 0:
            out = subprocess.run(
                ["tmux", "new-session", "-d", "-s", session,
                 "-x", "220", "-y", "50", "-P", "-F", fmt],
                capture_output=True,
                text=True,
                check=True,
                timeout=5,
            )
        else:
            out = subprocess.run(
                ["tmux", "new-window", "-d", "-t", session, "-P", "-F", fmt],
                capture_output=True,
                text=True,
                check=True,
                timeout=5,
            )
        pane = out.stdout.strip()
        if not pane:
            return None, "tmux did not report a pane id"
        if command:
            subprocess.run(
                ["tmux", "send-keys", "-t", pane, command, "C-m"],
                capture_output=True,
                text=True,
                check=True,
                timeout=5,
            )
        return pane, None
    except subprocess.CalledProcessError as e:
        return None, e.stderr.strip() or str(e)
    except (subprocess.SubprocessError, FileNotFoundError) as e:
        return None, str(e)


def list_panes() -> set[str]:
    """Return all live pane ids (session:window.pane); empty set if tmux is unavailable."""
    try:
        out = subprocess.run(
            ["tmux", "list-panes", "-a", "-F", "#S:#I.#P"],
            capture_output=True,
            text=True,
            check=True,
            timeout=2,
        )
    except (subprocess.SubprocessError, FileNotFoundError):
        return set()
    return {line for line in out.stdout.splitlines() if line}


def kill_pane(pane: str) -> tuple[bool, str | None]:
    """Kill a tmux pane. Returns (ok, error_message_or_None)."""
    try:
        subprocess.run(
            ["tmux", "kill-pane", "-t", pane],
            capture_output=True,
            text=True,
            check=True,
            timeout=3,
        )
    except subprocess.CalledProcessError as e:
        return False, e.stderr.strip() or str(e)
    except (subprocess.SubprocessError, FileNotFoundError) as e:
        return False, str(e)
    return True, None


def capture_pane(pane: str) -> tuple[str | None, str | None]:
    """Return the pane's visible screen as text. Returns (text, error_or_None)."""
    try:
        out = subprocess.run(
            ["tmux", "capture-pane", "-p", "-J", "-t", pane],
            capture_output=True,
            text=True,
            check=True,
            timeout=3,
        )
    except subprocess.CalledProcessError as e:
        return None, e.stderr.strip() or str(e)
    except (subprocess.SubprocessError, FileNotFoundError) as e:
        return None, str(e)
    return out.stdout, None


def format_message(sender: str, context: str | None, content: str) -> str:
    """Compose the inbound message body that lands in the recipient's pane."""
    head = f"[agent-msg from {sender}"
    if context:
        head += f" · {context}"
    head += "] "
    return head + content
