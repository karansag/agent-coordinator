# agent-msg

Tiny local message bus for AI agents running in separate tmux panes.
SQLite store + delivery by injecting `tmux send-keys` into the
recipient's pane.

If you are an AI agent, read **[AGENT_PROMPT.md](./AGENT_PROMPT.md)**
first — it covers registration, the inbound-message format, and basic
etiquette. This file is the operator-facing setup/lifecycle guide.

---

## What it does

- Records messages in `~/.agent-msg/db.sqlite` (sender, recipient,
  context, content, timestamp, delivery status).
- Delivers each message by typing it into the recipient's tmux pane
  followed by a submit key (default `C-m`), so it lands at the
  recipient's prompt as if the user typed it.
- Auto-assigns a cute short handle (`otter`, `tapir`, ...) on
  registration; separates that routing handle from the agent's stable
  `agent_id` (e.g. conversation UUID) and a `model` telemetry label.
  Agents do not choose their own handles.
- Lets each agent publish optional contact instructions plus delivery
  preferences like a message prefix (`/queue `) or alternate submit key.

## Install

```bash
cd ~/agent-msg
uv pip install -e .
```

Requires `python>=3.12`, `uv`, and `tmux` on the host.

## Start the server

```bash
# foreground, port 8765
uv run agent-msg-server

# background (detached so the calling shell can exit safely)
setsid -f uv run agent-msg-server > /tmp/agent-msg.log 2>&1
```

Defaults:

- `AGENT_MSG_HOST` = `127.0.0.1`
- `AGENT_MSG_PORT` = `8765`
- `AGENT_MSG_DB`   = `~/.agent-msg/db.sqlite`

## Health-check / status

```bash
curl http://127.0.0.1:8765/health
# -> {"ok":true,"db":"/home/<you>/.agent-msg/db.sqlite"}

agent-msg recipients          # who is registered
agent-msg messages --limit 20 # recent traffic
```

## Stop / restart

The server doesn't fork or PID-file itself. Use port-based kill:

```bash
fuser -k 8765/tcp        # kill whatever is bound to 8765
# then start again as above
```

If you've changed code, restart (no `--reload`). The SQLite schema
self-migrates via `ALTER TABLE` on the next start.

## Reset

```bash
fuser -k 8765/tcp
rm -f ~/.agent-msg/db.sqlite
setsid -f uv run agent-msg-server > /tmp/agent-msg.log 2>&1
```

## CLI quick reference

```bash
agent-msg register --agent-id <uuid> --model <label> --flavor <codex|claude|hermes>
# optional: --instructions "use /queue ..." --message-prefix "/queue " --submit-key C-m
agent-msg send --to <handle> --message "..."           # send
agent-msg messages --user <handle> --limit 20          # history
agent-msg recipients                                    # list peers
agent-msg whoami                                        # detected pane + registered handle
```

When `--pane` is omitted, the CLI resolves the pane for the current
shell by targeting `tmux display-message` with `$TMUX_PANE`.

See `AGENT_PROMPT.md` for the agent-facing version.

## Agent skills

Installable skill definitions live under `skills/`:

- `skills/codex/agent-msg-register` registers Codex agents with
  `--flavor codex` and lets the server assign the handle.
- `skills/claude/agent-msg-register` registers Claude Code agents with
  `--flavor claude` and lets the server assign the handle.

For the local user install, copy those skill directories into the
corresponding agent home, for example `~/.codex/skills/` or
`~/.claude/skills/`.

## HTTP API

| Method | Path          | Body / Params                                                       |
|--------|---------------|---------------------------------------------------------------------|
| GET    | `/health`     | —                                                                   |
| POST   | `/register`   | `{tmux_pane, agent_id?, model?, flavor?, instructions?, message_prefix?, submit_key?}` |
| GET    | `/recipients` | —                                                                   |
| POST   | `/send`       | `{tmux_pane, recipient, content, context?}`                         |
| GET    | `/messages`   | `?user=<handle>&limit=<n>` (omit `user` for all)                    |

`/register` always responds with the assigned `user_id` and a
`protocol_brief` string the agent can read once. Senders are resolved
from the registered tmux pane, not caller-chosen handles.

## Layout

```
agent_msg/
  db.py       SQLite layer (recipients, messages, schema migration)
  tmux.py     pane detection + send-keys delivery + message formatting
  names.py    cute-name pool
  server.py   FastAPI app + protocol brief
  client.py   `agent-msg` CLI
tests/
  test_db.py
  test_server.py
skills/
  codex/agent-msg-register/
  claude/agent-msg-register/
AGENT_PROMPT.md   onboarding text for agents
```

## Tests

```bash
uv run pytest -q
```

Delivery is monkeypatched in tests so they don't touch real tmux.

## Troubleshooting

- **"recipient not registered" 404 on send** — the recipient has never
  POSTed `/register`. The message is still recorded with
  `delivered=0` and a `delivery_error`.
- **Pane disappeared** — if the recipient's tmux session/pane is gone,
  delivery fails (`delivery_error` shows the tmux stderr). Message is
  still persisted; re-register from the new pane to fix.
- **Message text appears but doesn't submit** — register with the right
  `flavor` so the server chooses the matching submit key. Codex uses
  `Enter`; Claude/Hermes use `C-m` unless overridden.
- **Server won't start** — `fuser -k 8765/tcp` to clear a stuck
  process, or set `AGENT_MSG_PORT=...` to a free port.
- **`Failed to spawn: agent-msg-server`** — you forgot
  `uv pip install -e .`; the console-scripts entry point isn't
  registered yet.
