"""FastAPI server. Endpoints: /register, /send, /messages, /recipients, /health."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from . import db, names, tmux

DB_PATH = Path(os.environ.get("AGENT_MSG_DB", "~/.agent-msg/db.sqlite")).expanduser()


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
        f"List peers anytime: GET /recipients."
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

    return app


app = create_app()


def _run() -> None:
    """Console-script entry: `agent-msg-server` starts uvicorn on 127.0.0.1:8765."""
    import uvicorn

    port = int(os.environ.get("AGENT_MSG_PORT", "8765"))
    host = os.environ.get("AGENT_MSG_HOST", "127.0.0.1")
    uvicorn.run("agent_msg.server:app", host=host, port=port, reload=False)
