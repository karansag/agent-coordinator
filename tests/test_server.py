"""HTTP-layer tests against an in-memory app + FastAPI TestClient.

Delivery is monkeypatched to avoid touching real tmux.
"""

import pytest
from fastapi.testclient import TestClient

from agent_msg import server, tmux


@pytest.fixture()
def client(tmp_path, monkeypatch):
    calls = []
    pane_titles = []

    def fake_deliver(
        pane,
        text,
        message_prefix=None,
        submit_key=tmux.DEFAULT_SUBMIT_KEY,
        flavor=None,
    ):
        calls.append((pane, text, message_prefix, submit_key, flavor))
        return True, None

    def fake_set_pane_title(pane, title):
        pane_titles.append((pane, title))
        return True, None

    window_names = []

    def fake_rename_window(pane, name):
        window_names.append((pane, name))
        return True, None

    monkeypatch.setattr(tmux, "deliver", fake_deliver)
    monkeypatch.setattr(tmux, "set_pane_title", fake_set_pane_title)
    monkeypatch.setattr(tmux, "rename_window", fake_rename_window)
    monkeypatch.setattr(tmux, "list_panes", lambda: {"0:0.0", "0:1.0"})
    monkeypatch.setattr(
        tmux, "capture_pane", lambda pane: (f"screen of {pane}\n$ ", None)
    )

    spawns = []

    def fake_spawn_window(session=tmux.AGENTS_SESSION, command=None):
        spawns.append((session, command))
        return f"agents:{len(spawns)}.0", None

    monkeypatch.setattr(tmux, "spawn_window", fake_spawn_window)
    kills = []

    def fake_kill_pane(pane):
        kills.append(pane)
        return True, None

    monkeypatch.setattr(tmux, "kill_pane", fake_kill_pane)
    app = server.create_app(tmp_path / "db.sqlite")
    c = TestClient(app)
    c._calls = calls
    c._pane_titles = pane_titles
    c._spawns = spawns
    c._kills = kills
    c._window_names = window_names
    return c


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_register_without_user_id_assigns_cute_name(client):
    from agent_msg import names

    r = client.post(
        "/register",
        json={
            "tmux_pane": "0:0.0",
            "agent_id": "00000000-0000-4000-8000-000000000001",
            "model": "claude-opus-4-7",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["assigned"] is True
    assert body["user_id"] in names.POOL
    assert body["agent_id"] == "00000000-0000-4000-8000-000000000001"
    assert body["model"] == "claude-opus-4-7"
    assert body["flavor"] == "claude"
    assert body["submit_key"] == "C-m"
    assert body["status_title"] == f"agent-msg: {body['user_id']} (claude)"
    assert client._pane_titles[-1] == ("0:0.0", body["status_title"])


def test_register_rejects_explicit_user_id(client):
    r = client.post("/register", json={"tmux_pane": "0:0.0", "user_id": "explicit"})
    assert r.status_code == 422


def test_register_reuses_name_for_same_agent_id(client):
    first = client.post(
        "/register",
        json={"tmux_pane": "0:0.0", "agent_id": "agent-1"},
    ).json()
    second = client.post(
        "/register",
        json={"tmux_pane": "0:1.0", "agent_id": "agent-1"},
    ).json()
    assert second["user_id"] == first["user_id"]


def test_register_keeps_contact_preferences(client):
    r = client.post(
        "/register",
        json={
            "tmux_pane": "0:0.0",
            "flavor": "codex",
            "instructions": "use /queue before each message so my message doesn't interrupt",
            "message_prefix": "/queue ",
        },
    )
    body = r.json()
    assert body["flavor"] == "codex"
    assert body["instructions"].startswith("use /queue")
    assert body["message_prefix"] == "/queue "
    assert body["submit_key"] == "Enter"


@pytest.mark.parametrize(
    ("flavor", "submit_key"),
    [
        ("hermes", "C-m"),
        ("pi", "Enter"),
    ],
)
def test_register_known_harness_flavor_defaults(client, flavor, submit_key):
    r = client.post(
        "/register",
        json={"tmux_pane": "0:0.0", "flavor": flavor},
    )
    body = r.json()
    assert body["flavor"] == flavor
    assert body["submit_key"] == submit_key
    assert body["status_title"] == f"agent-msg: {body['user_id']} ({flavor})"


def test_register_allows_submit_key_override_over_flavor_default(client):
    r = client.post(
        "/register",
        json={"tmux_pane": "0:0.0", "flavor": "codex", "submit_key": "C-m"},
    )
    body = r.json()
    assert body["flavor"] == "codex"
    assert body["submit_key"] == "C-m"


@pytest.mark.parametrize(
    ("model", "expected_flavor", "expected_submit_key"),
    [
        ("hermes-agent", "hermes", "C-m"),
        ("pi-coding-agent", "pi", "Enter"),
    ],
)
def test_register_infers_harness_flavor_from_model(
    client, model, expected_flavor, expected_submit_key
):
    r = client.post(
        "/register",
        json={"tmux_pane": "0:0.0", "model": model},
    )
    body = r.json()
    assert body["flavor"] == expected_flavor
    assert body["submit_key"] == expected_submit_key


def test_register_includes_protocol_brief(client):
    first = client.post(
        "/register",
        json={
            "tmux_pane": "0:1.0",
            "agent_id": "uuid-a",
            "model": "claude-x",
            "instructions": "use /queue before each message so my message doesn't interrupt",
        },
    ).json()
    r = client.post("/register", json={"tmux_pane": "0:2.0"})
    brief = r.json()["protocol_brief"]
    assert r.json()["user_id"] in brief
    assert "[agent-msg from" in brief
    assert first["user_id"] in brief
    # peer metadata appears for context
    assert "claude-x" in brief and "uuid-a" in brief
    assert "use /queue before each message" in brief
    assert "flavor=claude" in brief
    assert "submit=C-m" in brief


def test_register_then_send_delivers_and_records(client):
    sender = client.post("/register", json={"tmux_pane": "0:0.0"}).json()["user_id"]
    recipient = client.post(
        "/register",
        json={
            "tmux_pane": "0:1.0",
            "flavor": "codex",
            "message_prefix": "/queue ",
        },
    ).json()["user_id"]

    r = client.post(
        "/send",
        json={
            "tmux_pane": "0:0.0",
            "recipient": recipient,
            "context": "mathy",
            "content": "hello",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["delivered_to_pane"] == "0:1.0"

    pane, text, message_prefix, submit_key, flavor = client._calls[-1]
    assert pane == "0:1.0"
    assert message_prefix == "/queue "
    assert submit_key == "Enter"
    assert flavor == "codex"
    assert sender in text and "mathy" in text and "hello" in text


@pytest.mark.parametrize(
    ("flavor", "expected_submit_key"),
    [
        ("hermes", "C-m"),
        ("pi", "Enter"),
    ],
)
def test_send_passes_harness_flavor_delivery_preferences(
    client, flavor, expected_submit_key
):
    sender = client.post("/register", json={"tmux_pane": "0:0.0"}).json()["user_id"]
    recipient = client.post(
        "/register",
        json={"tmux_pane": "0:1.0", "flavor": flavor},
    ).json()["user_id"]

    r = client.post(
        "/send",
        json={
            "tmux_pane": "0:0.0",
            "recipient": recipient,
            "context": "smoke",
            "content": "hello",
        },
    )

    assert r.status_code == 200
    pane, text, message_prefix, submit_key, delivered_flavor = client._calls[-1]
    assert pane == "0:1.0"
    assert message_prefix is None
    assert submit_key == expected_submit_key
    assert delivered_flavor == flavor
    assert sender in text and "smoke" in text and "hello" in text


def test_send_rejects_unregistered_sender_pane(client):
    recipient = client.post("/register", json={"tmux_pane": "0:1.0"}).json()["user_id"]
    r = client.post(
        "/send",
        json={"tmux_pane": "0:9.0", "recipient": recipient, "content": "hello"},
    )
    assert r.status_code == 404
    assert r.json()["detail"]["error"] == "sender not registered"


def test_send_unknown_recipient_404_but_still_recorded(client):
    sender = client.post("/register", json={"tmux_pane": "0:0.0"}).json()["user_id"]
    r = client.post(
        "/send",
        json={"tmux_pane": "0:0.0", "recipient": "ghost", "content": "??"},
    )
    assert r.status_code == 404
    mid = r.json()["detail"]["message_id"]
    assert mid > 0

    msgs = client.get("/messages", params={"user": "ghost"}).json()["messages"]
    assert len(msgs) == 1
    assert msgs[0]["sender"] == sender
    assert msgs[0]["delivered"] == 0
    assert msgs[0]["delivery_error"] == "recipient not registered"


def test_messages_history(client):
    recipient = client.post("/register", json={"tmux_pane": "0:1.0"}).json()["user_id"]
    sender = client.post("/register", json={"tmux_pane": "0:0.0"}).json()["user_id"]
    for i in range(3):
        client.post(
            "/send",
            json={"tmux_pane": "0:0.0", "recipient": recipient, "content": f"m{i}"},
        )
    msgs = client.get("/messages", params={"user": recipient}).json()["messages"]
    assert [m["content"] for m in msgs] == ["m2", "m1", "m0"]
    assert all(m["sender"] == sender for m in msgs)


def test_portal_page_served_at_root(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/html")
    assert "agent dashboard" in r.text
    assert "/api/state" in r.text


def test_state_reports_agents_liveness_and_ordered_messages(client):
    a = client.post("/register", json={"tmux_pane": "0:0.0"}).json()["user_id"]
    b = client.post("/register", json={"tmux_pane": "0:9.0"}).json()["user_id"]
    for i in range(2):
        client.post(
            "/send",
            json={"tmux_pane": "0:0.0", "recipient": b, "content": f"m{i}"},
        )

    state = client.get("/api/state").json()
    alive = {r["user_id"]: r["pane_alive"] for r in state["recipients"]}
    assert alive[a] is True
    assert alive[b] is False  # pane 0:9.0 is not in the fake live-pane set
    assert [m["content"] for m in state["messages"]] == ["m0", "m1"]
    assert state["now"] >= state["messages"][-1]["ts"]


def test_peek_returns_pane_capture(client):
    user = client.post("/register", json={"tmux_pane": "0:1.0"}).json()["user_id"]
    r = client.get(f"/api/peek/{user}")
    assert r.status_code == 200
    body = r.json()
    assert body["tmux_pane"] == "0:1.0"
    assert body["text"].startswith("screen of 0:1.0")
    assert body["error"] is None


def test_peek_unknown_agent_404(client):
    r = client.get("/api/peek/ghost")
    assert r.status_code == 404


def test_owner_send_delivers_to_pane_and_records(client):
    user = client.post("/register", json={"tmux_pane": "0:1.0"}).json()["user_id"]
    r = client.post("/owner/send", json={"recipient": user, "content": "status update please"})
    assert r.status_code == 200
    assert r.json()["ok"] is True

    pane, text, *_ = client._calls[-1]
    assert pane == "0:1.0"
    assert "[agent-msg from owner]" in text and "status update please" in text

    msgs = client.get("/messages", params={"user": user}).json()["messages"]
    assert msgs[0]["sender"] == "owner"


def test_owner_send_preserves_multiline_content_and_context(client):
    user = client.post("/register", json={"tmux_pane": "0:1.0"}).json()["user_id"]
    content = "First, inspect the failure.\nThen run the focused test."
    r = client.post(
        "/owner/send",
        json={"recipient": user, "content": content, "context": "investigation"},
    )
    assert r.status_code == 200

    _, delivered, *_ = client._calls[-1]
    assert "[agent-msg from owner · investigation]" in delivered
    assert content in delivered

    msgs = client.get("/messages", params={"user": user}).json()["messages"]
    assert msgs[0]["content"] == content
    assert msgs[0]["context"] == "investigation"


def test_owner_send_unknown_recipient_404(client):
    r = client.post("/owner/send", json={"recipient": "ghost", "content": "hi"})
    assert r.status_code == 404


def test_agent_can_reply_to_owner_without_tmux_delivery(client):
    user = client.post("/register", json={"tmux_pane": "0:0.0"}).json()["user_id"]
    n_calls = len(client._calls)
    r = client.post(
        "/send",
        json={"tmux_pane": "0:0.0", "recipient": "owner", "content": "done with the refactor"},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert r.json()["delivered_to_pane"] is None
    assert len(client._calls) == n_calls  # nothing injected anywhere

    msgs = client.get("/messages", params={"user": "owner"}).json()["messages"]
    assert msgs[0]["sender"] == user
    assert msgs[0]["delivered"] == 1


def test_protocol_brief_mentions_owner_and_tasks(client):
    brief = client.post("/register", json={"tmux_pane": "0:0.0"}).json()["protocol_brief"]
    assert "'owner' is the human operator" in brief
    assert "task-update" in brief


def test_create_task_notifies_assignee(client):
    user = client.post("/register", json={"tmux_pane": "0:1.0"}).json()["user_id"]
    r = client.post("/tasks", json={"title": "fix the build", "assignee": user})
    assert r.status_code == 200
    task = r.json()["task"]
    assert task["status"] == "open"
    assert task["assignee"] == user
    assert task["worktree"] is None

    pane, text, *_ = client._calls[-1]
    assert pane == "0:1.0"
    assert f"task #{task['id']}" in text and "fix the build" in text
    assert "task/" in text and "--worktree" in text
    assert "picked_up" in text and "done" in text  # tells the agent how to update

    state = client.get("/api/state").json()
    assert state["tasks"][0]["id"] == task["id"]


def test_create_task_unregistered_assignee_404(client):
    r = client.post("/tasks", json={"title": "x", "assignee": "ghost"})
    assert r.status_code == 404


def test_task_status_flow_open_picked_up_done(client):
    tid = client.post("/tasks", json={"title": "ship it"}).json()["task"]["id"]
    r = client.patch(
        f"/tasks/{tid}",
        json={"status": "picked_up", "worktree": "/tmp/repo-task-1"},
    )
    assert r.json()["task"]["status"] == "picked_up"
    assert r.json()["task"]["worktree"] == "/tmp/repo-task-1"
    r = client.patch(f"/tasks/{tid}", json={"status": "done"})
    assert r.json()["task"]["status"] == "done"
    assert client.patch(f"/tasks/{tid}", json={"worktree": ""}).status_code == 422
    assert client.patch(f"/tasks/{tid}", json={"status": "bogus"}).status_code == 422
    assert client.patch("/tasks/999", json={"status": "done"}).status_code == 404


def test_spawn_creates_window_and_registers_agent(client):
    r = client.post("/agents/spawn", json={"flavor": "claude"})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["tmux_pane"] == "agents:1.0"
    assert client._spawns[-1] == (tmux.AGENTS_SESSION, "claude")

    recipients = client.get("/recipients").json()["recipients"]
    spawned = next(x for x in recipients if x["user_id"] == body["user_id"])
    assert spawned["flavor"] == "claude"
    assert spawned["submit_key"] == "C-m"
    assert client._pane_titles[-1] == (
        "agents:1.0", f"agent-msg: {body['user_id']} (claude)"
    )
    assert client._window_names[-1] == ("agents:1.0", body["user_id"])


def test_spawn_generic_launches_no_command(client):
    r = client.post("/agents/spawn", json={"flavor": "generic"})
    assert r.status_code == 200
    assert client._spawns[-1] == (tmux.AGENTS_SESSION, None)


def test_spawn_rejects_unknown_flavor(client):
    assert client.post("/agents/spawn", json={"flavor": "skynet"}).status_code == 422


def test_stop_kills_live_agent_pane(client):
    user = client.post("/register", json={"tmux_pane": "0:0.0"}).json()["user_id"]
    r = client.post(f"/agents/{user}/stop")
    assert r.status_code == 200
    assert r.json()["already_stopped"] is False
    assert client._kills == ["0:0.0"]


def test_stop_is_idempotent_for_stopped_agent(client):
    user = client.post("/register", json={"tmux_pane": "0:2.0"}).json()["user_id"]
    r = client.post(f"/agents/{user}/stop")
    assert r.status_code == 200
    assert r.json()["already_stopped"] is True
    assert client._kills == []


def test_stop_rejects_unknown_agent(client):
    assert client.post("/agents/ghost/stop").status_code == 404


def test_stop_reports_tmux_failure(client, monkeypatch):
    user = client.post("/register", json={"tmux_pane": "0:0.0"}).json()["user_id"]
    monkeypatch.setattr(tmux, "kill_pane", lambda pane: (False, "permission denied"))
    r = client.post(f"/agents/{user}/stop")
    assert r.status_code == 500
    assert r.json()["detail"]["detail"] == "permission denied"


def test_reassigning_task_notifies_new_assignee(client):
    a = client.post("/register", json={"tmux_pane": "0:0.0"}).json()["user_id"]
    b = client.post("/register", json={"tmux_pane": "0:1.0"}).json()["user_id"]
    tid = client.post("/tasks", json={"title": "review PR", "assignee": a}).json()["task"]["id"]
    n_calls = len(client._calls)

    r = client.patch(f"/tasks/{tid}", json={"assignee": b})
    assert r.json()["task"]["assignee"] == b
    assert len(client._calls) == n_calls + 1
    pane, text, *_ = client._calls[-1]
    assert pane == "0:1.0"

    # status-only updates don't re-notify
    client.patch(f"/tasks/{tid}", json={"status": "picked_up"})
    assert len(client._calls) == n_calls + 1
