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


def test_task_create_and_list(tmp_path):
    conn = db.connect(tmp_path / "t.sqlite")
    t = db.create_task(conn, "fix the build", description="ci is red", assignee="otter")
    assert t["id"] == 1
    assert t["status"] == "open"
    assert t["assignee"] == "otter"
    t2 = db.create_task(conn, "write docs")
    assert t2["assignee"] is None
    tasks = db.list_tasks(conn)
    assert [x["id"] for x in tasks] == [2, 1]  # newest first


def test_task_update_status_and_assignee(tmp_path):
    conn = db.connect(tmp_path / "t.sqlite")
    t = db.create_task(conn, "fix the build")
    updated = db.update_task(conn, t["id"], status="picked_up", assignee="otter")
    assert updated["status"] == "picked_up"
    assert updated["assignee"] == "otter"
    assert updated["updated_at"] >= t["updated_at"]
    # updating only status keeps the assignee
    done = db.update_task(conn, t["id"], status="done")
    assert done["assignee"] == "otter"
    # explicit None unassigns
    cleared = db.update_task(conn, t["id"], assignee=None)
    assert cleared["assignee"] is None


def test_task_update_rejects_bad_status_and_unknown_id(tmp_path):
    import pytest

    conn = db.connect(tmp_path / "t.sqlite")
    t = db.create_task(conn, "x")
    with pytest.raises(ValueError):
        db.update_task(conn, t["id"], status="bogus")
    assert db.update_task(conn, 999, status="done") is None
