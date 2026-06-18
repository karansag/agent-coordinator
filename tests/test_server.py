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

    monkeypatch.setattr(tmux, "deliver", fake_deliver)
    monkeypatch.setattr(tmux, "set_pane_title", fake_set_pane_title)
    app = server.create_app(tmp_path / "db.sqlite")
    c = TestClient(app)
    c._calls = calls
    c._pane_titles = pane_titles
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


def test_register_allows_submit_key_override_over_flavor_default(client):
    r = client.post(
        "/register",
        json={"tmux_pane": "0:0.0", "flavor": "codex", "submit_key": "C-m"},
    )
    body = r.json()
    assert body["flavor"] == "codex"
    assert body["submit_key"] == "C-m"


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
