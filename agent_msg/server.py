"""FastAPI server. Endpoints: /register, /send, /messages, /recipients, /health,
plus the live web portal at / (backed by /api/state and /api/peek)."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field

from . import activity, db, names, tmux

log = logging.getLogger("agent_msg.monitor")

# Default activity shown when the monitor is off or hasn't observed an agent
# yet. The dashboard must tolerate this shape.
UNKNOWN_ACTIVITY = {"status": "unknown", "detail": None, "since": None}

DB_PATH = Path(os.environ.get("AGENT_MSG_DB", "~/.agent-msg/db.sqlite")).expanduser()
PORTAL_PATH = Path(__file__).parent / "portal.html"
PORTAL_STATIC_PATH = Path(__file__).parent / "static"

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
    team_id: int | None = None
    depends_on: list[int] | None = None


class TaskUpdateReq(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["open", "picked_up", "done"] | None = None
    assignee: str | None = None
    worktree: str | None = Field(default=None, min_length=1)
    team_id: int | None = None
    depends_on: list[int] | None = None


class SpawnReq(BaseModel):
    model_config = ConfigDict(extra="forbid")

    flavor: Literal["claude", "codex", "generic"] = "generic"


class TeamCreateReq(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)


class TeamUpdateReq(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1)
    queen: str | None = None
    objective: str | None = Field(
        default=None,
        description="Coordination objective delivered with a queen promotion.",
    )


class AgentTeamReq(BaseModel):
    model_config = ConfigDict(extra="forbid")

    team_id: int | None = None


def _queen_prompt(team: dict, objective: str) -> str:
    teammates = [m for m in team["members"] if m != team["queen"]]
    roster = ", ".join(teammates) if teammates else "(no teammates yet)"
    return (
        f"The owner has made you Queen of team '{team['name']}'. "
        f"Your teammates: {roster}.\n\n"
        f"Objective: {objective}\n\n"
        "Act as the owner's coordination point for this team until the owner ends "
        "or changes this role. Immediately notify each teammate, using context "
        "queen-status, that you coordinate this team for this objective and that "
        "their task coordination should route through you.\n\n"
        "Decompose the objective into concrete tasks; create and assign them to "
        "teammates with agent-msg task-create and agent-msg task-update, and "
        "record ordering with --depends-on <ids> so the board shows the "
        "dependency graph. Tasks "
        "the owner assigns to the team are delivered to you: parcel them out by "
        "reassigning or splitting them among teammates as appropriate, and "
        "monitor your workers' progress. Normally coordinate rather than "
        "implement. Require repository workers to use "
        "branch task/<id> in a dedicated worktree and record it on the task. "
        "Track progress, dependencies, stopped agents, commits, tests, and "
        "integration; integrate one branch at a time. Keep the owner informed of "
        "material progress and decisions, and ask before changing scope or the "
        "definition of done. Coordinate only your own team.\n\n"
        "This is a prompt-driven role, not special server authority. The owner "
        "retains every right and can replace or demote you at any time."
    )


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
        f"add `--description`, `--assignee`, or `--depends-on 3,5` to record "
        f"ordering; dependencies show as a graph on the dashboard).\n"
        f"\n"
        f"The owner may group agents into teams, each with a queen who "
        f"coordinates that team's work. Tasks can be assigned to a team; "
        f"they reach the queen, who parcels them out."
    )


def create_app(db_path: Path = DB_PATH, monitor: bool = True) -> FastAPI:
    conn = db.connect(db_path)

    # Per-agent activity state, mutated by the monitor loop and read by
    # /api/state. Keyed by user_id; see agent_msg.activity.step for the shape.
    registry: dict[str, dict] = {}
    interval = float(os.environ.get("AGENT_MSG_MONITOR_INTERVAL", "5.0"))
    grace = float(os.environ.get("AGENT_MSG_ATTENTION_GRACE", "60.0"))

    async def _monitor_tick():
        recipients = db.list_recipients(conn)
        live_panes = tmux.list_panes()
        observations = []
        for r in recipients:
            pane = r["tmux_pane"]
            alive = pane in live_panes
            capture = None
            if alive:
                # Subprocess capture must not block the event loop.
                text, err = await asyncio.to_thread(tmux.capture_pane, pane)
                capture = text if err is None else None
            observations.append(
                activity.Observation(r["user_id"], r.get("flavor"), alive, capture)
            )
        notes = activity.step(registry, observations, time.time(), interval, grace)
        for note in notes:
            db.record_message(
                conn,
                sender=note.user_id,
                recipient=OWNER,
                context="attention",
                content=f"needs attention: {note.detail}",
                delivered=True,
                delivery_error=None,
            )

    async def _monitor_loop():
        while True:
            try:
                await _monitor_tick()
            except asyncio.CancelledError:
                raise
            except Exception:
                # A failed tick is logged and skipped, never fatal to the loop.
                log.exception("monitor tick failed")
            await asyncio.sleep(interval)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        task = asyncio.create_task(_monitor_loop()) if monitor else None
        try:
            yield
        finally:
            if task is not None:
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await task

    app = FastAPI(title="agent-msg", version="0.1.0", lifespan=lifespan)
    app.mount(
        "/static",
        StaticFiles(directory=PORTAL_STATIC_PATH),
        name="portal-static",
    )
    # Same dict the monitor loop mutates; exposed so tests can seed it.
    app.state.activity_registry = registry

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

    def _team_line(user_id: str) -> str:
        """One sentence telling an agent who its teammates are right now."""
        recipient = db.get_recipient(conn, user_id)
        if recipient is None or not recipient.get("team_id"):
            return ""
        team = db.get_team(conn, recipient["team_id"])
        if team is None:
            return ""
        others = [m for m in team["members"] if m != user_id]
        mates = ", ".join(others) if others else "no one else yet"
        line = f" You are on team '{team['name']}' with {mates}"
        if team["queen"]:
            line += f" (queen: {team['queen']})"
        return line + "."

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
        content += f" {hint}{_team_line(task['assignee'])}"
        try:
            _deliver_from_owner(task["assignee"], content, f"task #{task['id']}")
        except HTTPException:
            pass  # assignee validated by callers; pane may still be gone

    def _notify_team_assignment(task: dict):
        team = db.get_team(conn, task["team_id"])
        if team is None:
            return
        context = f"task #{task['id']}"
        detail = f" Details: {task['description']}." if task.get("description") else ""
        if team["queen"]:
            content = (
                f"Task #{task['id']} is assigned to your team '{team['name']}': "
                f"{task['title']}.{detail} As queen, parcel it out: split it into "
                f"subtasks or hand it to a teammate with agent-msg task-update "
                f"{task['id']} --assignee <member>, then monitor progress."
            )
            targets = [team["queen"]]
        else:
            content = (
                f"Task #{task['id']} is assigned to your team '{team['name']}' "
                f"(no queen yet): {task['title']}.{detail} Coordinate with your "
                f"teammates; whoever takes it should run agent-msg task-update "
                f"{task['id']} --assignee <yourself>."
            )
            targets = team["members"]
        for target in targets:
            try:
                _deliver_from_owner(target, content + _team_line(target), context)
            except HTTPException:
                pass  # membership validated; a pane may still be gone

    def _require_registered_assignee(assignee: str | None):
        if assignee and db.get_recipient(conn, assignee) is None:
            raise HTTPException(
                status_code=404,
                detail={"error": "assignee not registered", "assignee": assignee},
            )

    def _require_known_team(team_id: int | None):
        if team_id is not None and db.get_team(conn, team_id) is None:
            raise HTTPException(
                status_code=404,
                detail={"error": "unknown team", "team_id": team_id},
            )

    @app.get("/tasks")
    def tasks_list():
        return {"tasks": db.list_tasks(conn)}

    def _set_deps(task_id: int, depends_on: list[int]):
        try:
            db.set_task_deps(conn, task_id, depends_on)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": str(exc)})

    @app.post("/tasks")
    def tasks_create(req: TaskCreateReq):
        _require_registered_assignee(req.assignee)
        _require_known_team(req.team_id)
        task = db.create_task(
            conn, req.title, req.description, req.assignee, req.team_id
        )
        if req.depends_on:
            _set_deps(task["id"], req.depends_on)
            task = db.get_task(conn, task["id"])
        if task["assignee"]:
            _notify_assignment(task)
        elif task["team_id"]:
            _notify_team_assignment(task)
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
        if "team_id" in req.model_fields_set:
            _require_known_team(req.team_id)
            kwargs["team_id"] = req.team_id
        if "worktree" in req.model_fields_set:
            kwargs["worktree"] = req.worktree
        if "depends_on" in req.model_fields_set:
            _set_deps(task_id, req.depends_on or [])
        task = db.update_task(conn, task_id, **kwargs)
        if task["assignee"] and task["assignee"] != before["assignee"]:
            _notify_assignment(task)
        elif task["team_id"] and task["team_id"] != before["team_id"]:
            _notify_team_assignment(task)
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

    @app.get("/teams")
    def teams_list():
        return {"teams": db.list_teams(conn)}

    @app.post("/teams")
    def teams_create(req: TeamCreateReq):
        return {"ok": True, "team": db.create_team(conn, req.name.strip())}

    @app.patch("/teams/{team_id}")
    def teams_update(team_id: int, req: TeamUpdateReq):
        kwargs = {}
        if req.name is not None:
            kwargs["name"] = req.name.strip()
        if "queen" in req.model_fields_set:
            kwargs["queen"] = req.queen or None
        try:
            team = db.update_team(conn, team_id, **kwargs)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": str(exc)})
        if team is None:
            raise HTTPException(status_code=404, detail={"error": "unknown team"})
        promotion = None
        if kwargs.get("queen"):
            objective = (req.objective or "").strip() or (
                "Coordinate your team to execute the shared task board."
            )
            promotion = _deliver_from_owner(
                team["queen"], _queen_prompt(team, objective), "queen-promotion"
            )
        return {"ok": True, "team": team, "promotion": promotion}

    @app.delete("/teams/{team_id}")
    def teams_delete(team_id: int):
        if not db.delete_team(conn, team_id):
            raise HTTPException(status_code=404, detail={"error": "unknown team"})
        return {"ok": True}

    @app.post("/agents/{user_id}/team")
    def agents_set_team(user_id: str, req: AgentTeamReq):
        try:
            recipient = db.set_agent_team(conn, user_id, req.team_id)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail={"error": str(exc)})
        if recipient is None:
            raise HTTPException(status_code=404, detail={"error": "unknown agent"})
        return {"ok": True, "recipient": recipient}

    @app.get("/", response_class=HTMLResponse)
    def portal():
        return PORTAL_PATH.read_text()

    @app.get("/api/state")
    def state(limit: int = 300):
        live_panes = tmux.list_panes()
        recipients = db.list_recipients(conn)
        for r in recipients:
            r["pane_alive"] = r["tmux_pane"] in live_panes
            row = registry.get(r["user_id"])
            r["activity"] = (
                {"status": row["status"], "detail": row["detail"], "since": row["since"]}
                if row
                else dict(UNKNOWN_ACTIVITY)
            )
        msgs = db.fetch_messages(conn, None, limit)
        msgs.reverse()  # oldest first for thread rendering
        return {
            "now": time.time(),
            "recipients": recipients,
            "messages": msgs,
            "tasks": db.list_tasks(conn),
            "teams": db.list_teams(conn),
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
