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
    monkeypatch.setattr(tmux, "_input_signature", lambda pane: None)
    monkeypatch.setattr(tmux.time, "sleep", lambda seconds: None)

    assert tmux.deliver("session-a:9.0", "hello", submit_key="Enter", flavor="pi") == (
        True,
        None,
    )
    assert calls == [
        ["tmux", "send-keys", "-t", "session-a:9.0", "-l", "hello"],
        ["tmux", "send-keys", "-t", "session-a:9.0", "Enter"],
    ]


def test_deliver_retries_submit_once_when_composer_is_unchanged(monkeypatch):
    calls = []
    signature = (17, 8, "❯ [agent-msg from manatee] hello")

    def fake_run(cmd, capture_output, text, check, timeout):
        calls.append(cmd)
        return SimpleNamespace(stdout="")

    monkeypatch.setattr(tmux.subprocess, "run", fake_run)
    monkeypatch.setattr(tmux, "_input_signature", lambda pane: signature)
    monkeypatch.setattr(tmux.time, "sleep", lambda seconds: None)

    assert tmux.deliver(
        "session-a:9.0", "[agent-msg from manatee] hello", submit_key="Enter"
    ) == (True, None)
    assert calls == [
        ["tmux", "send-keys", "-t", "session-a:9.0", "-l", "[agent-msg from manatee] hello"],
        ["tmux", "send-keys", "-t", "session-a:9.0", "Enter"],
        ["tmux", "send-keys", "-t", "session-a:9.0", "Enter"],
    ]


def test_deliver_does_not_retry_after_composer_changes(monkeypatch):
    calls = []
    signatures = iter([
        (17, 8, "❯ [agent-msg from manatee] hello"),
        (2, 9, "❯"),
    ])

    def fake_run(cmd, capture_output, text, check, timeout):
        calls.append(cmd)
        return SimpleNamespace(stdout="")

    monkeypatch.setattr(tmux.subprocess, "run", fake_run)
    monkeypatch.setattr(tmux, "_input_signature", lambda pane: next(signatures))
    monkeypatch.setattr(tmux.time, "sleep", lambda seconds: None)

    assert tmux.deliver(
        "session-a:9.0", "[agent-msg from manatee] hello", submit_key="Enter"
    ) == (True, None)
    assert calls.count(["tmux", "send-keys", "-t", "session-a:9.0", "Enter"]) == 1


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


def test_cmd_task_update_records_worktree(monkeypatch, capsys):
    captured = {}

    def fake_patch(url, json, timeout):
        captured["url"] = url
        captured["json"] = json
        return SimpleNamespace(text='{"ok": true}', is_success=True)

    monkeypatch.setattr(client.httpx, "patch", fake_patch)
    args = Namespace(
        id=7,
        status="picked_up",
        assignee=None,
        worktree="/tmp/repo-task-7",
        depends_on=None,
    )

    assert client.cmd_task_update(args) == 0
    assert captured["url"].endswith("/tasks/7")
    assert captured["json"] == {
        "status": "picked_up",
        "worktree": "/tmp/repo-task-7",
    }
    assert capsys.readouterr().out == '{"ok": true}\n'


def test_cmd_task_create_files_task(monkeypatch, capsys):
    captured = {}

    def fake_post(url, json, timeout):
        captured["url"] = url
        captured["json"] = json
        return SimpleNamespace(text='{"ok": true, "task": {"id": 8}}', is_success=True)

    monkeypatch.setattr(client.httpx, "post", fake_post)
    args = Namespace(
        title="Investigate flaky build",
        description="CI failed twice",
        assignee="stoat",
        depends_on="3,5",
    )

    assert client.cmd_task_create(args) == 0
    assert captured["url"].endswith("/tasks")
    assert captured["json"] == {
        "title": "Investigate flaky build",
        "description": "CI failed twice",
        "assignee": "stoat",
        "depends_on": [3, 5],
    }
    assert capsys.readouterr().out == '{"ok": true, "task": {"id": 8}}\n'
