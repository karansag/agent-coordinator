from __future__ import annotations

from argparse import Namespace
from types import SimpleNamespace

from agent_msg import client, tmux


def test_current_pane_targets_tmux_pane_env(monkeypatch):
    calls = []

    def fake_run(cmd, capture_output, text, check, timeout):
        calls.append(cmd)
        return SimpleNamespace(stdout="session-a:9.0\n")

    monkeypatch.setenv("TMUX_PANE", "%177")
    monkeypatch.setattr(tmux.subprocess, "run", fake_run)

    assert tmux.current_pane() == "session-a:9.0"
    assert calls == [
        ["tmux", "display-message", "-p", "-t", "%177", "#S:#I.#P"]
    ]


def test_current_pane_without_tmux_pane_env_uses_tmux_current_target(monkeypatch):
    calls = []

    def fake_run(cmd, capture_output, text, check, timeout):
        calls.append(cmd)
        return SimpleNamespace(stdout="session-a:5.0\n")

    monkeypatch.delenv("TMUX_PANE", raising=False)
    monkeypatch.setattr(tmux.subprocess, "run", fake_run)

    assert tmux.current_pane() == "session-a:5.0"
    assert calls == [["tmux", "display-message", "-p", "#S:#I.#P"]]


def test_set_pane_title_uses_tmux_select_pane(monkeypatch):
    calls = []

    def fake_run(cmd, capture_output, text, check, timeout):
        calls.append(cmd)
        return SimpleNamespace(stdout="")

    monkeypatch.setattr(tmux.subprocess, "run", fake_run)

    assert tmux.set_pane_title("session-a:9.0", "agent-msg: ibis") == (True, None)
    assert calls == [
        ["tmux", "select-pane", "-t", "session-a:9.0", "-T", "agent-msg: ibis"]
    ]


def test_flavor_defaults_cover_pi_and_hermes():
    assert tmux.submit_key_for_flavor("pi") == "Enter"
    assert tmux.submit_key_for_flavor("hermes") == "C-m"
    assert tmux.infer_flavor("pi") == "pi"
    assert tmux.infer_flavor("pi-coding-agent") == "pi"
    assert tmux.infer_flavor("hermes-agent") == "hermes"
    assert tmux.infer_flavor("github-copilot/gpt-5.5") == "generic"


def test_deliver_uses_configured_submit_key(monkeypatch):
    calls = []

    def fake_run(cmd, capture_output, text, check, timeout):
        calls.append(cmd)
        return SimpleNamespace(stdout="")

    monkeypatch.setattr(tmux.subprocess, "run", fake_run)

    assert tmux.deliver("session-a:9.0", "hello", submit_key="Enter", flavor="pi") == (
        True,
        None,
    )
    assert calls == [
        ["tmux", "send-keys", "-t", "session-a:9.0", "-l", "hello"],
        ["tmux", "send-keys", "-t", "session-a:9.0", "Enter"],
    ]


def test_cmd_register_uses_detected_current_pane(monkeypatch, capsys):
    captured = {}

    def fake_post(url, json, timeout):
        captured["url"] = url
        captured["json"] = json
        captured["timeout"] = timeout
        return SimpleNamespace(text='{"ok": true}', is_success=True)

    monkeypatch.setattr(client, "current_pane", lambda: "session-a:9.0")
    monkeypatch.setattr(client.httpx, "post", fake_post)

    args = Namespace(
        pane=None,
        agent_id=None,
        model=None,
        flavor=None,
        instructions=None,
        message_prefix=None,
        submit_key=None,
    )

    assert client.cmd_register(args) == 0
    assert captured["json"] == {"tmux_pane": "session-a:9.0"}
    assert capsys.readouterr().out == '{"ok": true}\n'
