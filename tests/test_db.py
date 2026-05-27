from agent_msg import db


def test_register_and_lookup(tmp_path):
    conn = db.connect(tmp_path / "t.sqlite")
    db.register(conn, "alice", "0:0.0")
    assert db.lookup_pane(conn, "alice") == "0:0.0"
    db.register(conn, "alice", "0:1.0")  # update
    assert db.lookup_pane(conn, "alice") == "0:1.0"
    assert db.lookup_pane(conn, "bob") is None


def test_record_and_fetch(tmp_path):
    conn = db.connect(tmp_path / "t.sqlite")
    mid = db.record_message(conn, "alice", "bob", "topic", "hi", True, None)
    assert mid > 0
    rows = db.fetch_messages(conn, "bob")
    assert len(rows) == 1
    assert rows[0]["sender"] == "alice"
    assert rows[0]["delivered"] == 1


def test_list_recipients(tmp_path):
    conn = db.connect(tmp_path / "t.sqlite")
    db.register(conn, "a", "p1")
    db.register(conn, "b", "p2")
    names = [r["user_id"] for r in db.list_recipients(conn)]
    assert names == ["a", "b"]


def test_register_replaces_existing_entry_for_same_pane(tmp_path):
    conn = db.connect(tmp_path / "t.sqlite")
    db.register(conn, "a", "p1")
    db.register(conn, "b", "p1")
    assert db.lookup_user_by_pane(conn, "p1") == "b"
    names = [r["user_id"] for r in db.list_recipients(conn)]
    assert names == ["b"]


def test_lookup_user_by_agent_id(tmp_path):
    conn = db.connect(tmp_path / "t.sqlite")
    db.register(conn, "a", "p1", agent_id="agent-1")
    assert db.lookup_user_by_agent_id(conn, "agent-1") == "a"
