"""Teams: membership, queen promotion, team tasks, and dependency graph."""

import pytest

from tests.test_server import client  # noqa: F401  (reuse the app fixture)


def _register(client, pane="0:0.0", model="m"):
    r = client.post("/register", json={"tmux_pane": pane, "model": model})
    assert r.status_code == 200
    return r.json()["user_id"]


def _make_team(client, name="hivemind"):
    r = client.post("/teams", json={"name": name})
    assert r.status_code == 200
    return r.json()["team"]


def test_team_crud_and_membership(client):
    a = _register(client, "0:0.0")
    b = _register(client, "0:1.0")
    team = _make_team(client)
    assert team["queen"] is None and team["members"] == []

    for user in (a, b):
        r = client.post(f"/agents/{user}/team", json={"team_id": team["id"]})
        assert r.status_code == 200
        assert r.json()["recipient"]["team_id"] == team["id"]
    listed = client.get("/teams").json()["teams"][0]
    assert sorted(listed["members"]) == sorted([a, b])

    # membership is exposed on state
    state = client.get("/api/state").json()
    assert state["teams"][0]["id"] == team["id"]
    assert all(r["team_id"] == team["id"] for r in state["recipients"])

    # leaving a team
    r = client.post(f"/agents/{a}/team", json={"team_id": None})
    assert r.status_code == 200
    assert r.json()["recipient"]["team_id"] is None
    assert client.get("/teams").json()["teams"][0]["members"] == [b]

    # unknown team rejected
    r = client.post(f"/agents/{b}/team", json={"team_id": 999})
    assert r.status_code == 404

    # disband clears membership
    assert client.delete(f"/teams/{team['id']}").status_code == 200
    assert client.get("/teams").json()["teams"] == []
    state = client.get("/api/state").json()
    assert all(r["team_id"] is None for r in state["recipients"])


def test_queen_promotion_delivers_scoped_prompt(client):
    a = _register(client, "0:0.0")
    b = _register(client, "0:1.0")
    team = _make_team(client, "skunkworks")
    for user in (a, b):
        client.post(f"/agents/{user}/team", json={"team_id": team["id"]})

    # a non-member cannot be queen
    r = client.patch(f"/teams/{team['id']}", json={"queen": "nobody"})
    assert r.status_code == 400

    calls_before = len(client._calls)
    r = client.patch(
        f"/teams/{team['id']}",
        json={"queen": a, "objective": "Ship the widget"},
    )
    assert r.status_code == 200
    assert r.json()["team"]["queen"] == a
    assert r.json()["promotion"]["ok"] is True
    delivered = [text for _, text, *_ in client._calls[calls_before:]]
    assert len(delivered) == 1
    assert "Queen of team 'skunkworks'" in delivered[0]
    assert b in delivered[0]  # teammates are listed
    assert "Ship the widget" in delivered[0]
    assert "parcel them out" in delivered[0]
    promo = client.get("/messages", params={"user": a}).json()["messages"][0]
    assert promo["context"] == "queen-promotion"

    # clearing the queen sends nothing
    calls_before = len(client._calls)
    r = client.patch(f"/teams/{team['id']}", json={"queen": None})
    assert r.status_code == 200
    assert r.json()["team"]["queen"] is None
    assert len(client._calls) == calls_before

    # a queen who leaves the team loses the crown
    client.patch(f"/teams/{team['id']}", json={"queen": a, "objective": "x"})
    client.post(f"/agents/{a}/team", json={"team_id": None})
    assert client.get("/teams").json()["teams"][0]["queen"] is None


def test_team_task_reaches_queen_and_clears_assignee(client):
    a = _register(client, "0:0.0")
    b = _register(client, "0:1.0")
    team = _make_team(client, "buildcrew")
    for user in (a, b):
        client.post(f"/agents/{user}/team", json={"team_id": team["id"]})
    client.patch(f"/teams/{team['id']}", json={"queen": b, "objective": "x"})

    calls_before = len(client._calls)
    r = client.post("/tasks", json={"title": "big feature", "team_id": team["id"]})
    assert r.status_code == 200
    task = r.json()["task"]
    assert task["team_id"] == team["id"] and task["assignee"] is None
    delivered = [text for _, text, *_ in client._calls[calls_before:]]
    assert len(delivered) == 1  # only the queen is notified
    assert "assigned to your team 'buildcrew'" in delivered[0]
    assert "parcel it out" in delivered[0]

    # queen hands it to a member: assignee set, team cleared
    r = client.patch(f"/tasks/{task['id']}", json={"assignee": a})
    task = r.json()["task"]
    assert task["assignee"] == a and task["team_id"] is None

    # and back to the team: assignee cleared again
    r = client.patch(f"/tasks/{task['id']}", json={"team_id": team["id"]})
    task = r.json()["task"]
    assert task["team_id"] == team["id"] and task["assignee"] is None

    # unknown team rejected
    r = client.post("/tasks", json={"title": "nope", "team_id": 999})
    assert r.status_code == 404


def test_team_task_without_queen_notifies_members(client):
    a = _register(client, "0:0.0")
    b = _register(client, "0:1.0")
    team = _make_team(client, "leaderless")
    for user in (a, b):
        client.post(f"/agents/{user}/team", json={"team_id": team["id"]})
    calls_before = len(client._calls)
    client.post("/tasks", json={"title": "shared job", "team_id": team["id"]})
    delivered = [text for _, text, *_ in client._calls[calls_before:]]
    assert len(delivered) == 2
    assert all("no queen yet" in text for text in delivered)


def test_task_dependency_graph(client):
    r1 = client.post("/tasks", json={"title": "design"}).json()["task"]
    r2 = client.post(
        "/tasks", json={"title": "build", "depends_on": [r1["id"]]}
    ).json()["task"]
    assert r2["depends_on"] == [r1["id"]]

    r3 = client.post(
        "/tasks", json={"title": "ship", "depends_on": [r1["id"], r2["id"]]}
    ).json()["task"]
    assert r3["depends_on"] == [r1["id"], r2["id"]]

    # deps are listed on state and the tasks endpoint
    listed = {t["id"]: t for t in client.get("/tasks").json()["tasks"]}
    assert listed[r3["id"]]["depends_on"] == [r1["id"], r2["id"]]
    state_tasks = {t["id"]: t for t in client.get("/api/state").json()["tasks"]}
    assert state_tasks[r2["id"]]["depends_on"] == [r1["id"]]

    # replace and clear
    r = client.patch(f"/tasks/{r3['id']}", json={"depends_on": [r2["id"]]})
    assert r.json()["task"]["depends_on"] == [r2["id"]]
    r = client.patch(f"/tasks/{r3['id']}", json={"depends_on": []})
    assert r.json()["task"]["depends_on"] == []

    # self-dependency and cycles rejected
    r = client.patch(f"/tasks/{r1['id']}", json={"depends_on": [r1["id"]]})
    assert r.status_code == 400
    r = client.patch(f"/tasks/{r1['id']}", json={"depends_on": [r2["id"]]})
    assert r.status_code == 400
    # unknown dependency rejected
    r = client.patch(f"/tasks/{r1['id']}", json={"depends_on": [999]})
    assert r.status_code == 400
