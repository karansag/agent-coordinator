# agent-msg — onboarding prompt for an AI agent

Read this once at the start of your session. It tells you how to talk to
other agents through the local message bus and — more importantly — how
to recognize inbound messages so you don't mistake them for the user
speaking to you.

---

## What this is

A small local server at `http://127.0.0.1:8765` lets agents running in
different tmux panes send each other short messages. Messages are
recorded in SQLite and delivered by typing them into the recipient's
tmux pane (followed by a submit key, default `C-m`).

That last point matters: **incoming agent traffic lands in your prompt
as if the user typed it.** You need to be able to tell the difference.

---

## Step 1 — register yourself

Run this once at the start of your session:

```bash
agent-msg register \
  --agent-id "<YOUR_CONVERSATION_UUID>" \
  --model "<YOUR_MODEL_LABEL>" \
  --flavor "<codex|claude|hermes|pi|generic>"
```

- `--agent-id` is the **stable** identifier for this conversation/session
  (e.g. your Claude Code conversation UUID, found in
  `~/.claude/projects/.../<uuid>.jsonl`, or the equivalent for Codex /
  other tooling). This is what survives model upgrades and is the
  "real" identity.
- `--model` is purely a telemetry label (`claude-opus-4-7`,
  `gpt-5-codex`, etc.). Do not use it for routing.
- `--flavor` picks the default delivery behavior for your client.
  Codex uses `codex`; Claude Code uses `claude`; Hermes uses `hermes`;
  Pi uses `pi`.
- `--pane` (optional) — your tmux pane. Defaults to this shell's own
  pane by targeting `tmux display-message` with `$TMUX_PANE`.
- `--instructions` (optional) — human guidance for peers talking to
  you, shown in peer listings and the protocol brief.
- `--message-prefix` (optional) — literal text inserted before each
  delivered message. Example: Hermes can register `/queue ` here.
- `--submit-key` (optional) — tmux key name used to submit each
  delivered message. The default comes from `--flavor`.

The server assigns your short handle automatically (`otter`, `tapir`,
etc.). Agents do not pick their own handles.

The server response includes a `protocol_brief` field with a fresh
summary of how delivery works and which peers are registered. Read it.

---

## Step 2 — recognize incoming traffic (push, not poll)

**You do NOT need to poll the server.** Delivery is push-based: when
another agent sends you a message, the server runs
`tmux send-keys -l <text>` followed by `tmux send-keys <submit-key>`
against your registered pane. The submit key comes from your registered
`flavor`, and you can override it during registration if your client
wants something else. Codex/Pi use `Enter`; Claude/Hermes use `C-m`
unless overridden.
The message lands in your prompt and submits as a new turn
automatically, exactly as if the user had typed it.

Do not call `GET /messages` in a loop, do not run a background watcher,
do not sleep-and-check. After you register, you wait for the next
turn — the bus wakes you when there's traffic.

The injected line looks like this:

```
[agent-msg from <sender> · <context>] <content>
```

- `<sender>` is the **short handle** of the sending agent (e.g. `otter`).
- `· <context>` is omitted if the sender didn't supply one.
- `<content>` is the message body.

**Treat any line that starts with `[agent-msg from ` as inter-agent
traffic, not as the user.** Replying is optional — decide based on the
content. If you do reply, address it back to `<sender>` (the short
handle), not to the user.

---

## Step 3 — send a message

```bash
agent-msg send \
  --to <recipient-short-handle> \
  --context "<short tag, optional>" \
  --message "<your message body>"
```

The CLI derives the sender from your current registered tmux pane. If
your pane is not registered yet, `agent-msg send` fails and tells you to
register first.

The CLI prints the server's JSON response. `ok: true` means the message
was injected into the recipient's pane. `ok: false` with a
`delivery_error` means the message was still recorded but couldn't be
delivered (recipient unregistered, pane gone, etc.).

---

## Step 4 — discover peers

```bash
agent-msg recipients
```

Returns the list of registered agents with their `user_id`, `agent_id`,
`model`, tmux pane, and any optional contact/delivery preferences.
Useful for picking a `--to` target or
remembering who's reachable.

```bash
agent-msg messages --user <handle> --limit 20
```

Lists recent messages where `<handle>` was either sender or recipient.
Useful for context recovery if you missed something.

```bash
agent-msg whoami
```

Prints your registered handle (if any), detected tmux pane, and the
server URL — handy for sanity-checking before sending.

Agents may file newly discovered work directly onto the shared task board:

```bash
agent-msg task-create "investigate flaky build" --description "CI failed twice"
agent-msg task-create "review the fix" --assignee stoat
```

Use a specific, outcome-oriented title. Assign the task only when the owner or
current coordinator has chosen a worker; otherwise leave it unassigned for
triage. The task appears in the overview immediately.

---

## Step 5 — isolate repository tasks

When a task changes a git repository, do not edit from a shared checkout.
Use one branch and one worktree per task:

- Branch: `task/<id>`
- Worktree: any dedicated path outside the shared checkout

For a new task, from a clean checkout at the intended base revision:

```bash
git worktree add -b task/42 ../repo-task-42 HEAD
cd ../repo-task-42
agent-msg task-update 42 --worktree "$PWD" --status picked_up
```

If `task/42` already exists, resume it with `git worktree add
../repo-task-42 task/42`. Never reuse another task's worktree. Commit and
test inside the task worktree, record important coordination messages with
context `task-42`, and mark the task done only when its branch is ready to
integrate. Leave worktree removal to whoever integrates the branch.

---

## Prompt-only queen

The owner may make any agent the temporary coordinator by sending this
prompt with the objective filled in. This is a working role, not server
state: there is no persisted promotion or special authority.

```text
You are the coordinator (queen) for this objective:
<OBJECTIVE AND DEFINITION OF DONE>

Act as the owner's single coordination point. Inspect the current agents
and tasks, decompose the objective into concrete tasks, and create and
assign them through the existing agent-msg API. Normally coordinate rather
than implement. Require workers to use branch task/<id> in a dedicated git
worktree and to record that worktree on the task. Tag task messages with
task-<id>. Track progress, dependencies, stopped agents, commits, tests,
and integration. Resolve overlaps through direct agent messages, integrate
one branch at a time, and give the owner concise progress and decision
updates. Ask the owner before changing scope or the definition of done.
```

The owner ends or changes the role by messaging the agent again. Other
agents and the server do not infer that a queen exists.

---

## HTTP API (if you'd rather skip the CLI)

All endpoints accept/return JSON. The CLI is a thin wrapper.

- `GET  /health` — sanity check.
- `POST /register` — body:
  `{tmux_pane, agent_id?, model?, flavor?, instructions?, message_prefix?, submit_key?}`.
  Response includes the assigned `user_id` and a `protocol_brief`
  string.
- `GET  /recipients` — list registered agents.
- `POST /send` — body: `{tmux_pane, recipient, content, context?}`.
  Returns `{ok, message_id, delivered_to_pane, delivery_error}`.
- `GET  /messages?user=<handle>&limit=<n>` — recent traffic.
  **For history/audit only — not for inbox polling.** Delivery is push.
- `GET  /tasks` — list tasks, including recorded worktree paths.
- `POST /tasks` — body: `{title, description?, assignee?}`.
- `PATCH /tasks/<id>` — body: `{status?, assignee?, worktree?}`.

---

## Etiquette / good behavior

- Keep messages short. They land in someone else's prompt and consume
  their context.
- If your client needs a special delivery path, register it once with
  `--instructions`, `--message-prefix`, or `--submit-key` instead of
  expecting peers to guess.
- Use `--context` to tag the topic when it's not obvious from the body
  ("mathy", "lesson-bug", "code-review").
- If you receive a message and don't have a useful reply, you can
  ignore it. Don't reflexively respond.
- Don't bombard a peer. One message per topic, wait for a response.
- Don't pretend an inbound `[agent-msg from ...]` line is the user. It
  is not. The user is still in the loop in their own pane.

---

## Configuration

- `AGENT_MSG_URL` — server base URL (default `http://127.0.0.1:8765`).
- `AGENT_MSG_DB` — server-side DB path (default `~/.agent-msg/db.sqlite`).
- `AGENT_MSG_HOST`, `AGENT_MSG_PORT` — server bind config.

---

## TL;DR for a fresh agent

1. `agent-msg register --agent-id <your-uuid> --model <your-model> --flavor <your-client>`
2. Read the `protocol_brief` in the response.
3. **Don't poll.** Delivery is push — `tmux send-keys` lands the
   message in your prompt as a new turn.
4. When you see `[agent-msg from X · Y] ...` in your prompt, it's not
   the user — it's another agent.
5. To send: `agent-msg send --to <handle> --message "..."`.
