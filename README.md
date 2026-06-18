# agent-msg

`agent-msg` is a tiny local message bus for AI agents running in
separate tmux panes.

It gives agents a practical way to coordinate without a shared browser,
cloud service, polling loop, or custom client integration. Messages are
stored in SQLite and delivered by typing into the recipient's tmux pane
with `tmux send-keys`, so the message lands exactly where the agent is
already listening: its prompt.

## Demo

<!-- Add a short GIF or video here. Suggested shot: two tmux panes, both
registered with agent-msg, then one pane sends a message and the other
wakes up with `[agent-msg from ...]` in its prompt. -->

```text
[ demo gif / video coming soon ]
```

If you are an AI agent, start with [AGENT_PROMPT.md](./AGENT_PROMPT.md).
It explains how to register, how to recognize inbound agent traffic, and
how to avoid mistaking another agent's message for the user.

## Why This Exists

Multiple coding agents are useful, but they usually cannot talk to each
other directly. `agent-msg` fills that gap with a local, inspectable
protocol:

- A long-running server tracks registered agents and recent messages.
- Each agent gets a short server-assigned handle for routing.
- The server remembers the agent's stable session id, model label, tmux
  pane, delivery flavor, and optional contact instructions.
- Sending a message injects a formatted line into the recipient's pane
  and submits it with the right key for that client.
- Every message is recorded, even when delivery fails.

The result is intentionally simple: agents can ask each other for status,
delegate work, hand off context, or report completion while the human
operator keeps full visibility.

## How It Fits

`agent-msg` is not trying to be a project manager, task graph, workspace
orchestrator, or mailbox product. It is the delivery layer underneath
those systems: a small component that can wake or notify a running
terminal agent.

That makes it complementary to tools like:

- [Beads](https://github.com/gastownhall/beads), which handles
  structured work tracking and agent-readable project memory.
- [Gas Town](https://github.com/gastownhall/gastown), which manages
  multi-agent workspaces and persistent orchestration state.
- [hcom](https://github.com/aannoo/hcom), which provides a broader
  terminal-agent control surface.
- [MCP Agent Mail](https://github.com/dicklesworthstone/mcp_agent_mail)
  and [Swarm Protocol](https://github.com/phuryn/swarm-protocol), which
  expose richer coordination state through MCP-style workflows.

See [docs/landscape.md](./docs/landscape.md) for the longer comparison.

## Quick Start

Requirements: Python 3.12+, `uv`, and `tmux`.

```bash
git clone git@github.com:karansag/agent-coordinator.git agent-msg
cd agent-msg
uv pip install -e .
```

Start the server:

```bash
uv run agent-msg-server
```

In each agent's tmux pane, register that agent:

```bash
agent-msg register \
  --agent-id "<stable-session-id>" \
  --model "<model-label>" \
  --flavor "<codex|claude|hermes|generic>"
```

Then send a message:

```bash
agent-msg send --to <handle> --context "handoff" --message "Can you check the failing test?"
```

Useful status commands:

```bash
agent-msg whoami
agent-msg recipients
agent-msg messages --limit 20
```

## How Delivery Works

Inbound messages are pushed, not polled. When one agent sends a message,
the server formats it like this:

```text
[agent-msg from <sender> · <context>] <content>
```

Then it runs `tmux send-keys -l <text>` against the recipient's pane,
followed by the configured submit key. Codex defaults to `Enter`;
Claude/Hermes default to `C-m`.

Because delivery happens through the prompt, any agent using this system
must treat lines starting with `[agent-msg from ` as inter-agent traffic,
not user input. [AGENT_PROMPT.md](./AGENT_PROMPT.md) is written for that
case.

On registration, `agent-msg` also sets the tmux pane title to the
server-assigned handle, for example `agent-msg: ibis (codex)`. This does
not rename the agent conversation or tmux window. To show pane titles in
tmux pane borders, add something like this to `~/.tmux.conf`:

```tmux
set -g pane-border-status top
set -g pane-border-format "#{pane_title}"
```

Or put the active pane's agent name in the main tmux status bar:

```tmux
set -g status-right "#{pane_title} | %H:%M"
```

## Agent Skills

Installable skill definitions live under `skills/`:

- `skills/codex/agent-msg-register`
- `skills/claude/agent-msg-register`

Copy the relevant skill directory into the corresponding agent home, for
example `~/.codex/skills/` or `~/.claude/skills/`.

The bundled helpers register the agent with the right delivery flavor
internally. For example, `register-codex-agent` supplies
`--flavor codex`; callers should not pass `--flavor` to those helpers.

## Agent Interfaces

Today, `agent-msg` has a small `flavor` concept for Codex, Claude,
Hermes, and generic terminal delivery. That should become a real adapter
interface:

- What kind of agent is this?
- What submit key wakes it?
- Does it need a message prefix?
- How should inbound messages be formatted?
- Which endpoint can reach it: tmux pane, PTY, HTTP, MCP, or something
  else?

The long-term direction is a typed Rust core with built-in interfaces for
common agents and a config-defined interface path for custom tools. See
[docs/rust-rewrite-plan.md](./docs/rust-rewrite-plan.md).

## Recording A Demo

The fastest useful demo is a terminal recording:

1. Open a tmux window with two panes.
2. Start `uv run agent-msg-server` in one pane or a background shell.
3. Register pane A and pane B with distinct `--agent-id` values.
4. Run `agent-msg recipients` so viewers see the assigned handles.
5. Send `agent-msg send --to <handle> --context demo --message "hello"`.
6. Show the receiving pane wake up with the injected message.

Good tools:

- `asciinema rec demo.cast` for a terminal recording.
- `agg demo.cast demo.gif` to render an asciinema recording to GIF.
- QuickTime, Screen Studio, or OBS if you want a polished video.

Keep it under 30 seconds. The visual point is simple: the sender runs one
CLI command, and the receiver gets a new prompt turn automatically.

## Configuration

The server defaults are local-only:

```text
AGENT_MSG_HOST=127.0.0.1
AGENT_MSG_PORT=8765
AGENT_MSG_DB=~/.agent-msg/db.sqlite
```

Health check:

```bash
curl http://127.0.0.1:8765/health
# {"ok":true,"db":"/home/<you>/.agent-msg/db.sqlite"}
```

Run detached:

```bash
setsid -f uv run agent-msg-server > /tmp/agent-msg.log 2>&1
```

Stop or restart:

```bash
fuser -k 8765/tcp
setsid -f uv run agent-msg-server > /tmp/agent-msg.log 2>&1
```

Reset local state:

```bash
fuser -k 8765/tcp
rm -f ~/.agent-msg/db.sqlite
setsid -f uv run agent-msg-server > /tmp/agent-msg.log 2>&1
```

## CLI Reference

```bash
agent-msg register \
  --agent-id <stable-session-id> \
  --model <label> \
  --flavor <codex|claude|hermes|generic>

agent-msg send --to <handle> --message "..."
agent-msg send --to <handle> --context <tag> --message "..."
agent-msg messages --user <handle> --limit 20
agent-msg recipients
agent-msg whoami
```

Optional registration fields:

- `--pane`: tmux pane to register. Defaults to the current pane.
- `--instructions`: human guidance shown to peers.
- `--message-prefix`: literal prefix inserted before delivered messages.
- `--submit-key`: tmux key used to submit delivered messages.

When `--pane` is omitted, the CLI resolves the current pane with
`tmux display-message`, targeting `$TMUX_PANE` when available.

## HTTP API

| Method | Path          | Body / Params                                                       |
|--------|---------------|---------------------------------------------------------------------|
| GET    | `/health`     | -                                                                   |
| POST   | `/register`   | `{tmux_pane, agent_id?, model?, flavor?, instructions?, message_prefix?, submit_key?}` |
| GET    | `/recipients` | -                                                                   |
| POST   | `/send`       | `{tmux_pane, recipient, content, context?}`                         |
| GET    | `/messages`   | `?user=<handle>&limit=<n>`; omit `user` for all messages            |

`/register` returns the assigned `user_id` and a `protocol_brief` string
the agent can read once. Senders are resolved from the registered tmux
pane, not from caller-supplied names.

## Project Layout

```text
agent_msg/
  client.py   CLI
  db.py       SQLite layer
  names.py    server-assigned handle pool
  server.py   FastAPI app and protocol brief
  tmux.py     pane detection, delivery, and message formatting
skills/
  codex/agent-msg-register/
  claude/agent-msg-register/
tests/
AGENT_PROMPT.md
```

## Development

```bash
uv run pytest -q
```

Delivery is monkeypatched in tests, so the suite does not type into real
tmux panes.

## Security Model

`agent-msg` is designed for a trusted local machine. It binds to
`127.0.0.1` by default and assumes callers are allowed to inject text into
the registered tmux panes. Do not expose the server on an untrusted
network without adding authentication and thinking through the tmux
injection risk.

## Troubleshooting

- **"recipient not registered"**: the recipient has not registered yet.
  The message is still recorded with `delivered=0`.
- **Pane disappeared**: delivery failed because the registered tmux pane
  no longer exists. Re-register from the new pane.
- **Message appears but does not submit**: register with the correct
  flavor or set `--submit-key` explicitly.
- **Server will not start**: clear the port with `fuser -k 8765/tcp`, or
  set `AGENT_MSG_PORT` to another port.
- **`agent-msg` command not found**: run `uv pip install -e .` from the
  repo root.
