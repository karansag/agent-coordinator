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
"""


def connect(path: str | Path) -> sqlite3.Connection:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
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
        "SELECT user_id, tmux_pane, agent_id, model, flavor, instructions, message_prefix, submit_key, registered_at "
        "FROM recipients WHERE user_id=?",
        (user_id,),
    ).fetchone()
    return dict(row) if row else None


def list_recipients(conn: sqlite3.Connection) -> list[dict]:
    _ensure_columns(conn)
    rows = conn.execute(
        "SELECT user_id, tmux_pane, agent_id, model, flavor, instructions, message_prefix, submit_key, registered_at "
        "FROM recipients ORDER BY user_id"
    ).fetchall()
    return [dict(r) for r in rows]


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
