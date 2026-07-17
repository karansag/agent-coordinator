"""SQLite layer. Pure functions over a connection."""

from __future__ import annotations

import sqlite3
import time
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS recipients (
    user_id     TEXT PRIMARY KEY,
    tmux_pane   TEXT NOT NULL,
    agent_id    TEXT,
    model       TEXT,
    flavor      TEXT,
    instructions TEXT,
    message_prefix TEXT,
    submit_key  TEXT,
    registered_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sender      TEXT NOT NULL,
    recipient   TEXT NOT NULL,
    context     TEXT,
    content     TEXT NOT NULL,
    ts          REAL NOT NULL,
    delivered   INTEGER NOT NULL DEFAULT 0,
    delivery_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_messages_recipient_ts
    ON messages(recipient, ts DESC);

CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT,
    assignee    TEXT,
    status      TEXT NOT NULL DEFAULT 'open',
    worktree    TEXT,
    created_at  REAL NOT NULL,
    updated_at  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    queen       TEXT,
    created_at  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS task_deps (
    task_id     INTEGER NOT NULL,
    depends_on  INTEGER NOT NULL,
    PRIMARY KEY (task_id, depends_on)
);
"""

TASK_STATUSES = ("open", "picked_up", "done")

_UNSET = object()


def connect(path: str | Path) -> sqlite3.Connection:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    _ensure_columns(conn)
    return conn


def register(
    conn: sqlite3.Connection,
    user_id: str,
    tmux_pane: str,
    agent_id: str | None = None,
    model: str | None = None,
    flavor: str | None = None,
    instructions: str | None = None,
    message_prefix: str | None = None,
    submit_key: str | None = None,
) -> None:
    _ensure_columns(conn)
    conn.execute(
        "DELETE FROM recipients WHERE tmux_pane=? AND user_id<>?",
        (tmux_pane, user_id),
    )
    if agent_id:
        conn.execute(
            "DELETE FROM recipients WHERE agent_id=? AND user_id<>?",
            (agent_id, user_id),
        )
    conn.execute(
        "INSERT INTO recipients("
        "user_id, tmux_pane, agent_id, model, flavor, instructions, message_prefix, submit_key, registered_at"
        ") VALUES(?,?,?,?,?,?,?,?,?) "
        "ON CONFLICT(user_id) DO UPDATE SET "
        "tmux_pane=excluded.tmux_pane, "
        "agent_id=COALESCE(excluded.agent_id, recipients.agent_id), "
        "model=COALESCE(excluded.model, recipients.model), "
        "flavor=COALESCE(excluded.flavor, recipients.flavor), "
        "instructions=COALESCE(excluded.instructions, recipients.instructions), "
        "message_prefix=COALESCE(excluded.message_prefix, recipients.message_prefix), "
        "submit_key=COALESCE(excluded.submit_key, recipients.submit_key), "
        "registered_at=excluded.registered_at",
        (
            user_id,
            tmux_pane,
            agent_id,
            model,
            flavor,
            instructions,
            message_prefix,
            submit_key,
            time.time(),
        ),
    )
    conn.commit()


def _ensure_columns(conn: sqlite3.Connection) -> None:
    """Add new optional columns to pre-existing DBs."""
    cols = {row[1] for row in conn.execute("PRAGMA table_info(recipients)")}
    for col in (
        "agent_id",
        "model",
        "flavor",
        "instructions",
        "message_prefix",
        "submit_key",
    ):
        if col not in cols:
            conn.execute(f"ALTER TABLE recipients ADD COLUMN {col} TEXT")
    if "team_id" not in cols:
        conn.execute("ALTER TABLE recipients ADD COLUMN team_id INTEGER")
    task_cols = {row[1] for row in conn.execute("PRAGMA table_info(tasks)")}
    if "worktree" not in task_cols:
        conn.execute("ALTER TABLE tasks ADD COLUMN worktree TEXT")
    if "team_id" not in task_cols:
        conn.execute("ALTER TABLE tasks ADD COLUMN team_id INTEGER")
    conn.commit()


def lookup_pane(conn: sqlite3.Connection, user_id: str) -> str | None:
    row = conn.execute(
        "SELECT tmux_pane FROM recipients WHERE user_id=?", (user_id,)
    ).fetchone()
    return row["tmux_pane"] if row else None


def lookup_user_by_pane(conn: sqlite3.Connection, tmux_pane: str) -> str | None:
    row = conn.execute(
        "SELECT user_id FROM recipients WHERE tmux_pane=?", (tmux_pane,)
    ).fetchone()
    return row["user_id"] if row else None


def lookup_user_by_agent_id(conn: sqlite3.Connection, agent_id: str) -> str | None:
    _ensure_columns(conn)
    row = conn.execute(
        "SELECT user_id FROM recipients WHERE agent_id=?", (agent_id,)
    ).fetchone()
    return row["user_id"] if row else None


def get_recipient(conn: sqlite3.Connection, user_id: str) -> dict | None:
    _ensure_columns(conn)
    row = conn.execute(
        "SELECT user_id, tmux_pane, agent_id, model, flavor, instructions, message_prefix, submit_key, team_id, registered_at "
        "FROM recipients WHERE user_id=?",
        (user_id,),
    ).fetchone()
    return dict(row) if row else None


def list_recipients(conn: sqlite3.Connection) -> list[dict]:
    _ensure_columns(conn)
    rows = conn.execute(
        "SELECT user_id, tmux_pane, agent_id, model, flavor, instructions, message_prefix, submit_key, team_id, registered_at "
        "FROM recipients ORDER BY user_id"
    ).fetchall()
    return [dict(r) for r in rows]


def create_task(
    conn: sqlite3.Connection,
    title: str,
    description: str | None = None,
    assignee: str | None = None,
    team_id: int | None = None,
) -> dict:
    now = time.time()
    if team_id is not None:
        assignee = None
    cur = conn.execute(
        "INSERT INTO tasks(title, description, assignee, team_id, status, created_at, updated_at) "
        "VALUES(?,?,?,?,?,?,?)",
        (title, description, assignee, team_id, "open", now, now),
    )
    conn.commit()
    return get_task(conn, int(cur.lastrowid))


def get_task(conn: sqlite3.Connection, task_id: int) -> dict | None:
    row = conn.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
    if row is None:
        return None
    task = dict(row)
    task["depends_on"] = [
        r["depends_on"]
        for r in conn.execute(
            "SELECT depends_on FROM task_deps WHERE task_id=? ORDER BY depends_on",
            (task_id,),
        )
    ]
    return task


def list_tasks(conn: sqlite3.Connection) -> list[dict]:
    deps: dict[int, list[int]] = {}
    for r in conn.execute("SELECT task_id, depends_on FROM task_deps ORDER BY depends_on"):
        deps.setdefault(r["task_id"], []).append(r["depends_on"])
    rows = conn.execute("SELECT * FROM tasks ORDER BY id DESC").fetchall()
    tasks = []
    for row in rows:
        task = dict(row)
        task["depends_on"] = deps.get(task["id"], [])
        tasks.append(task)
    return tasks


def set_task_deps(
    conn: sqlite3.Connection, task_id: int, depends_on: list[int]
) -> None:
    """Replace a task's dependency list. Rejects unknown tasks and cycles."""
    unique = sorted(set(depends_on))
    for dep in unique:
        if dep == task_id:
            raise ValueError("a task cannot depend on itself")
        if conn.execute("SELECT 1 FROM tasks WHERE id=?", (dep,)).fetchone() is None:
            raise ValueError(f"unknown dependency: #{dep}")
    edges: dict[int, list[int]] = {}
    for r in conn.execute("SELECT task_id, depends_on FROM task_deps"):
        edges.setdefault(r["task_id"], []).append(r["depends_on"])
    edges[task_id] = unique
    seen, stack = set(), [task_id]
    while stack:
        node = stack.pop()
        for dep in edges.get(node, []):
            if dep == task_id:
                raise ValueError("dependency cycle")
            if dep not in seen:
                seen.add(dep)
                stack.append(dep)
    conn.execute("DELETE FROM task_deps WHERE task_id=?", (task_id,))
    conn.executemany(
        "INSERT INTO task_deps(task_id, depends_on) VALUES(?,?)",
        [(task_id, dep) for dep in unique],
    )
    conn.commit()


def update_task(
    conn: sqlite3.Connection,
    task_id: int,
    status: str | None = None,
    assignee: str | None | object = _UNSET,
    worktree: str | None | object = _UNSET,
    team_id: int | None | object = _UNSET,
) -> dict | None:
    task = get_task(conn, task_id)
    if task is None:
        return None
    if status is not None:
        if status not in TASK_STATUSES:
            raise ValueError(f"invalid status: {status}")
        task["status"] = status
    # A task is owned by an individual or a team, never both; setting one
    # side clears the other.
    if assignee is not _UNSET:
        task["assignee"] = assignee
        if assignee is not None:
            task["team_id"] = None
    if team_id is not _UNSET:
        task["team_id"] = team_id
        if team_id is not None:
            task["assignee"] = None
    if worktree is not _UNSET:
        task["worktree"] = worktree
    conn.execute(
        "UPDATE tasks SET status=?, assignee=?, team_id=?, worktree=?, updated_at=? WHERE id=?",
        (
            task["status"],
            task["assignee"],
            task["team_id"],
            task["worktree"],
            time.time(),
            task_id,
        ),
    )
    conn.commit()
    return get_task(conn, task_id)


def create_team(conn: sqlite3.Connection, name: str) -> dict:
    cur = conn.execute(
        "INSERT INTO teams(name, queen, created_at) VALUES(?,?,?)",
        (name, None, time.time()),
    )
    conn.commit()
    return get_team(conn, int(cur.lastrowid))


def get_team(conn: sqlite3.Connection, team_id: int) -> dict | None:
    row = conn.execute("SELECT * FROM teams WHERE id=?", (team_id,)).fetchone()
    if row is None:
        return None
    team = dict(row)
    team["members"] = [
        r["user_id"]
        for r in conn.execute(
            "SELECT user_id FROM recipients WHERE team_id=? ORDER BY user_id",
            (team_id,),
        )
    ]
    return team


def list_teams(conn: sqlite3.Connection) -> list[dict]:
    ids = [row["id"] for row in conn.execute("SELECT id FROM teams ORDER BY id")]
    return [get_team(conn, team_id) for team_id in ids]


def update_team(
    conn: sqlite3.Connection,
    team_id: int,
    name: str | None = None,
    queen: str | None | object = _UNSET,
) -> dict | None:
    team = get_team(conn, team_id)
    if team is None:
        return None
    if name is not None:
        team["name"] = name
    if queen is not _UNSET:
        if queen is not None and queen not in team["members"]:
            raise ValueError(f"{queen} is not a member of team {team['name']}")
        team["queen"] = queen
    conn.execute(
        "UPDATE teams SET name=?, queen=? WHERE id=?",
        (team["name"], team["queen"], team_id),
    )
    conn.commit()
    return get_team(conn, team_id)


def delete_team(conn: sqlite3.Connection, team_id: int) -> bool:
    if get_team(conn, team_id) is None:
        return False
    conn.execute("UPDATE recipients SET team_id=NULL WHERE team_id=?", (team_id,))
    conn.execute("UPDATE tasks SET team_id=NULL WHERE team_id=?", (team_id,))
    conn.execute("DELETE FROM teams WHERE id=?", (team_id,))
    conn.commit()
    return True


def set_agent_team(
    conn: sqlite3.Connection, user_id: str, team_id: int | None
) -> dict | None:
    """Move an agent between teams (or out of any). Clears a vacated queen seat."""
    _ensure_columns(conn)
    recipient = get_recipient(conn, user_id)
    if recipient is None:
        return None
    if team_id is not None and get_team(conn, team_id) is None:
        raise ValueError(f"no such team: {team_id}")
    previous = recipient.get("team_id")
    if previous is not None and previous != team_id:
        conn.execute(
            "UPDATE teams SET queen=NULL WHERE id=? AND queen=?", (previous, user_id)
        )
    conn.execute(
        "UPDATE recipients SET team_id=? WHERE user_id=?", (team_id, user_id)
    )
    conn.commit()
    return get_recipient(conn, user_id)


def record_message(
    conn: sqlite3.Connection,
    sender: str,
    recipient: str,
    context: str | None,
    content: str,
    delivered: bool,
    delivery_error: str | None,
) -> int:
    cur = conn.execute(
        "INSERT INTO messages(sender, recipient, context, content, ts, delivered, delivery_error) "
        "VALUES(?,?,?,?,?,?,?)",
        (
            sender,
            recipient,
            context,
            content,
            time.time(),
            1 if delivered else 0,
            delivery_error,
        ),
    )
    conn.commit()
    return int(cur.lastrowid)


def fetch_messages(
    conn: sqlite3.Connection,
    user_id: str | None = None,
    limit: int = 50,
) -> list[dict]:
    if user_id:
        rows = conn.execute(
            "SELECT * FROM messages WHERE recipient=? OR sender=? ORDER BY ts DESC LIMIT ?",
            (user_id, user_id, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM messages ORDER BY ts DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(r) for r in rows]
