"""FastAPI server. Endpoints: /register, /send, /messages, /recipients, /health,
plus the live web portal at / (backed by /api/state and /api/peek)."""

from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, ConfigDict, Field

from . import db, names, tmux

DB_PATH = Path(os.environ.get("AGENT_MSG_DB", "~/.agent-msg/db.sqlite")).expanduser()
PORTAL_PATH = Path(__file__).parent / "portal.html"

# Reserved handle for the human operator. Never assigned to an agent
# (the name pool contains only animals). Messages sent to it are recorded
# for the dashboard instead of being injected into a tmux pane.
OWNER = "owner"


class RegisterReq(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tmux_pane: str = Field(min_length=1)
    agent_id: str | None = Field(
        default=None,
        description="Stable session identifier (e.g. Claude conversation UUID). "
        "This is the agent's 'real' identity across model changes.",
    )
    model: str | None = Field(
        default=None,
        description="Model label for telemetry only (e.g. 'claude-opus-4-7'). "
        "Not used for identity.",
    )
    flavor: str | None = Field(
        default=None,
        description="Optional delivery flavor; controls default submit key behavior.",
    )
    instructions: str | None = Field(
        default=None,
        description="Optional human guidance for peers talking to this agent.",
    )
    message_prefix: str | None = Field(
        default=None,
        description="Optional literal prefix inserted before each delivered message.",
    )
    submit_key: str | None = Field(
        default=None,
        description="Optional tmux submit key override (defaults to C-m).",
    )


class SendReq(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tmux_pane: str = Field(min_length=1)
    recipient: str = Field(min_length=1)
    content: str = Field(min_length=1)
    context: str | None = None


class OwnerSendReq(BaseModel):
    model_config = ConfigDict(extra="forbid")

    recipient: str = Field(min_length=1)
    content: str = Field(min_length=1)
    context: str | None = None


class TaskCreateReq(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1)
    description: str | None = None
    assignee: str | None = None


class TaskUpdateReq(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["open", "picked_up", "done"] | None = None
    assignee: str | None = None
    worktree: str | None = Field(default=None, min_length=1)


class SpawnReq(BaseModel):
    model_config = ConfigDict(extra="forbid")

    flavor: Literal["claude", "codex", "generic"] = "generic"


def _protocol_brief(user_id: str, peers: list[dict]) -> str:
    """A one-shot primer the agent sees in its register response.

    Tells the agent what inbound messages look like so a line appearing in
    its prompt doesn't get mistaken for user input.
    """

    def _peer_line(p: dict) -> str:
        tags = []
        if p.get("flavor"):
            tags.append(f"flavor={p['flavor']}")
        if p.get("model"):
            tags.append(p["model"])
        if p.get("agent_id"):
            tags.append(f"agent={p['agent_id']}")
        if p.get("submit_key"):
            tags.append(f"submit={p['submit_key']}")
        suffix = f" ({', '.join(tags)})" if tags else ""
        instructions = f" -- {p['instructions']}" if p.get("instructions") else ""
        return f"  - {p['user_id']}{suffix}{instructions}"

    peer_lines = "\n".join(_peer_line(p) for p in peers) or "  (none yet)"
    return (
        f"You are registered as '{user_id}'.\n"
        f"\n"
        f"Incoming messages from other agents are delivered by injecting a "
        f"line into your tmux pane (as if typed) followed by the configured "
        f"submit key (default `C-m`). The "
        f"format is:\n"
        f"\n"
        f"    [agent-msg from <sender> · <context>] <content>\n"
        f"\n"
        f"The `· <context>` segment is omitted when the sender didn't "
        f"supply a context tag. Treat any such line as inter-agent traffic, "
        f"not as user input.\n"
        f"\n"
        f"To reply or initiate, POST to /send (or use the `agent-msg send` "
        f"CLI). Currently registered peers:\n"
        f"{peer_lines}\n"
        f"\n"
        f"List peers anytime: GET /recipients.\n"
        f"\n"
        f"The reserved handle 'owner' is the human operator in charge of "
        f"all agents. Messages from 'owner' are instructions from the "
        f"human, not from a peer agent. To message the human, send to "
        f"recipient 'owner'; replies land on the owner's dashboard.\n"
        f"\n"
        f"The owner can assign you tasks. They arrive as messages tagged "
        f"'task #N'. When you start one, run "
        f"`agent-msg task-update N --status picked_up`; when you finish, "
        f"run `agent-msg task-update N --status done`. "
        f"List tasks anytime: `agent-msg tasks`. You can file work for the "
        f"shared board with `agent-msg task-create \"title\"` (optionally "
        f"add `--description` or `--assignee`)."
    )


def create_app(db_path: Path = DB_PATH) -> FastAPI:
    app = FastAPI(title="agent-msg", version="0.1.0")
    conn = db.connect(db_path)

    @app.get("/health")
    def health():
        return {"ok": True, "db": str(db_path)}

    @app.post("/register")
    def register(req: RegisterReq):
        user_id = None
        if req.agent_id:
            user_id = db.lookup_user_by_agent_id(conn, req.agent_id)
        if user_id is None:
            user_id = db.lookup_user_by_pane(conn, req.tmux_pane)
        if user_id is None:
            user_id = names.pick_unused(conn)
        flavor = req.flavor or tmux.infer_flavor(req.model)
        submit_key = req.submit_key or tmux.submit_key_for_flavor(flavor)
        db.register(
            conn,
            user_id,
            req.tmux_pane,
            req.agent_id,
            req.model,
            flavor,
            req.instructions,
            req.message_prefix,
            submit_key,
        )
        status_title = tmux.status_title(user_id, flavor)
        tmux.set_pane_title(req.tmux_pane, status_title)
        registered = db.get_recipient(conn, user_id)
        peers = [r for r in db.list_recipients(conn) if r["user_id"] != user_id]
        return {
            "ok": True,
            "user_id": user_id,
            "status_title": status_title,
            "tmux_pane": req.tmux_pane,
            "agent_id": registered["agent_id"] if registered else req.agent_id,
            "model": registered["model"] if registered else req.model,
            "flavor": registered["flavor"] if registered else flavor,
            "instructions": registered["instructions"] if registered else req.instructions,
            "message_prefix": registered["message_prefix"] if registered else req.message_prefix,
            "submit_key": (
                registered["submit_key"] if registered and registered["submit_key"] else tmux.DEFAULT_SUBMIT_KEY
            ),
            "assigned": True,
            "protocol_brief": _protocol_brief(user_id, peers),
        }

    @app.get("/recipients")
    def recipients():
        return {"recipients": db.list_recipients(conn)}

    def _deliver_from_owner(recipient_id: str, content: str, context: str | None):
        """Deliver a message from the human operator to an agent's pane."""
        recipient = db.get_recipient(conn, recipient_id)
        if recipient is None:
            mid = db.record_message(
                conn,
                OWNER,
                recipient_id,
                context,
                content,
                delivered=False,
                delivery_error="recipient not registered",
            )
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "recipient not registered",
                    "recipient": recipient_id,
                    "message_id": mid,
                },
            )
        body = tmux.format_message(OWNER, context, content)
        ok, err = tmux.deliver(
            recipient["tmux_pane"],
            body,
            message_prefix=recipient.get("message_prefix"),
            submit_key=recipient.get("submit_key") or tmux.DEFAULT_SUBMIT_KEY,
            flavor=recipient.get("flavor"),
        )
        mid = db.record_message(
            conn, OWNER, recipient_id, context, content, delivered=ok, delivery_error=err
        )
        return {"ok": ok, "message_id": mid, "delivery_error": err}

    @app.post("/send")
    def send(req: SendReq):
        sender = db.lookup_user_by_pane(conn, req.tmux_pane)
        if sender is None:
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "sender not registered",
                    "tmux_pane": req.tmux_pane,
                },
            )
        if req.recipient == OWNER:
            # Messages to the human are recorded for the dashboard, not
            # injected into a pane.
            mid = db.record_message(
                conn,
                sender,
                OWNER,
                req.context,
                req.content,
                delivered=True,
                delivery_error=None,
            )
            return {"ok": True, "message_id": mid, "delivered_to_pane": None,
                    "delivery_error": None}
        recipient = db.get_recipient(conn, req.recipient)
        if recipient is None:
            mid = db.record_message(
                conn,
                sender,
                req.recipient,
                req.context,
                req.content,
                delivered=False,
                delivery_error="recipient not registered",
            )
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "recipient not registered",
                    "recipient": req.recipient,
                    "message_id": mid,
                },
            )
        body = tmux.format_message(sender, req.context, req.content)
        ok, err = tmux.deliver(
            recipient["tmux_pane"],
            body,
            message_prefix=recipient.get("message_prefix"),
            submit_key=recipient.get("submit_key") or tmux.DEFAULT_SUBMIT_KEY,
            flavor=recipient.get("flavor"),
        )
        mid = db.record_message(
            conn,
            sender,
            req.recipient,
            req.context,
            req.content,
            delivered=ok,
            delivery_error=err,
        )
        return {
            "ok": ok,
            "message_id": mid,
            "delivered_to_pane": recipient["tmux_pane"],
            "delivery_error": err,
        }

    @app.get("/messages")
    def messages(user: str | None = None, limit: int = 50):
        return {"messages": db.fetch_messages(conn, user, limit)}

    @app.post("/owner/send")
    def owner_send(req: OwnerSendReq):
        return _deliver_from_owner(req.recipient, req.content, req.context)

    def _notify_assignment(task: dict):
        hint = (
            f"Before editing, use branch task/{task['id']} in a dedicated git worktree. "
            f"Record it when you start: agent-msg task-update {task['id']} "
            f"--worktree /absolute/path --status picked_up. "
            f"When finished: agent-msg task-update {task['id']} --status done."
        )
        content = f"You are assigned task #{task['id']}: {task['title']}."
        if task.get("description"):
            content += f" Details: {task['description']}."
        content += f" {hint}"
        try:
            _deliver_from_owner(task["assignee"], content, f"task #{task['id']}")
        except HTTPException:
            pass  # assignee validated by callers; pane may still be gone

    def _require_registered_assignee(assignee: str | None):
        if assignee and db.get_recipient(conn, assignee) is None:
            raise HTTPException(
                status_code=404,
                detail={"error": "assignee not registered", "assignee": assignee},
            )

    @app.get("/tasks")
    def tasks_list():
        return {"tasks": db.list_tasks(conn)}

    @app.post("/tasks")
    def tasks_create(req: TaskCreateReq):
        _require_registered_assignee(req.assignee)
        task = db.create_task(conn, req.title, req.description, req.assignee)
        if task["assignee"]:
            _notify_assignment(task)
        return {"ok": True, "task": task}

    @app.patch("/tasks/{task_id}")
    def tasks_update(task_id: int, req: TaskUpdateReq):
        before = db.get_task(conn, task_id)
        if before is None:
            raise HTTPException(status_code=404, detail={"error": "unknown task"})
        kwargs = {}
        if req.status is not None:
            kwargs["status"] = req.status
        if "assignee" in req.model_fields_set:
            _require_registered_assignee(req.assignee)
            kwargs["assignee"] = req.assignee or None
        if "worktree" in req.model_fields_set:
            kwargs["worktree"] = req.worktree
        task = db.update_task(conn, task_id, **kwargs)
        if task["assignee"] and task["assignee"] != before["assignee"]:
            _notify_assignment(task)
        return {"ok": True, "task": task}

    @app.post("/agents/spawn")
    def agents_spawn(req: SpawnReq):
        command = tmux.FLAVOR_LAUNCH_COMMANDS.get(req.flavor)
        pane, err = tmux.spawn_window(command=command)
        if pane is None:
            raise HTTPException(
                status_code=500,
                detail={"error": "could not create tmux window", "detail": err},
            )
        user_id = names.pick_unused(conn)
        db.register(
            conn,
            user_id,
            pane,
            None,
            None,
            req.flavor,
            None,
            None,
            tmux.submit_key_for_flavor(req.flavor),
        )
        tmux.set_pane_title(pane, tmux.status_title(user_id, req.flavor))
        tmux.rename_window(pane, user_id)
        return {"ok": True, "user_id": user_id, "tmux_pane": pane, "flavor": req.flavor}

    @app.post("/agents/{user_id}/stop")
    def agents_stop(user_id: str):
        recipient = db.get_recipient(conn, user_id)
        if recipient is None:
            raise HTTPException(status_code=404, detail={"error": "unknown agent"})
        pane = recipient["tmux_pane"]
        if pane not in tmux.list_panes():
            return {
                "ok": True, "user_id": user_id, "tmux_pane": pane,
                "already_stopped": True,
            }
        ok, err = tmux.kill_pane(pane)
        if not ok:
            raise HTTPException(
                status_code=500,
                detail={"error": "could not stop tmux pane", "detail": err},
            )
        return {
            "ok": True, "user_id": user_id, "tmux_pane": pane,
            "already_stopped": False,
        }

    @app.get("/", response_class=HTMLResponse)
    def portal():
        return PORTAL_PATH.read_text()

    @app.get("/api/state")
    def state(limit: int = 300):
        live_panes = tmux.list_panes()
        recipients = db.list_recipients(conn)
        for r in recipients:
            r["pane_alive"] = r["tmux_pane"] in live_panes
        msgs = db.fetch_messages(conn, None, limit)
        msgs.reverse()  # oldest first for thread rendering
        return {
            "now": time.time(),
            "recipients": recipients,
            "messages": msgs,
            "tasks": db.list_tasks(conn),
        }

    @app.get("/api/peek/{user_id}")
    def peek(user_id: str):
        recipient = db.get_recipient(conn, user_id)
        if recipient is None:
            raise HTTPException(status_code=404, detail={"error": "unknown agent"})
        text, err = tmux.capture_pane(recipient["tmux_pane"])
        return {
            "user_id": user_id,
            "tmux_pane": recipient["tmux_pane"],
            "text": text,
            "error": err,
        }

    return app


app = create_app()


def _run() -> None:
    """Console-script entry: `agent-msg-server` starts uvicorn on 127.0.0.1:8765."""
    import uvicorn

    port = int(os.environ.get("AGENT_MSG_PORT", "8765"))
    host = os.environ.get("AGENT_MSG_HOST", "127.0.0.1")
    uvicorn.run("agent_msg.server:app", host=host, port=port, reload=False)
