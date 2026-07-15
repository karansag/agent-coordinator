# Plan: agent activity monitoring

Status: plan agreed with owner 2026-07-14, not yet implemented.
Problem: the owner wants live answers to "is each agent working, paused,
or waiting on input?" without opening every pane, and eventually wants
the system to help with permission prompts. Agents cannot self-report
their stuck states (an agent blocked on a permission dialog cannot run
a CLI command), so monitoring must observe from outside.

## Architecture

A background poll loop inside the existing FastAPI server process
(asyncio task started on app startup, interval ~5s, skipped entirely
when tmux is unavailable):

1. For each registered agent with a live pane, run the existing
   `tmux.capture_pane`.
2. Classify the pane text with per-flavor rules (below) into a status.
3. Keep current status in memory: {user_id: {status, detail, since}}.
   No schema change in v1; status is ephemeral observation, not record.
4. Expose it in `/api/state` recipients entries as `activity` and
   `activity_since`.

No new process, no cron, no LLM in the loop. Capturing a handful of
panes every 5s is negligible locally.

## Status vocabulary

- `working` — harness shows active generation/tool execution.
- `needs_attention` — a permission prompt, confirmation dialog, or a
  question addressed to the human is on screen. `detail` carries the
  matched line so the dashboard can show WHY.
- `idle` — prompt is empty and nothing is running.
- `unknown` — none of the rules matched (surfaced honestly, not hidden).
- `stopped` — pane gone (already computed today via list_panes).

## Classification rules (v1, ordered; first match wins)

Per-flavor regex packs in `agent_msg/activity.py`, table-driven so new
harness versions mean editing data, not logic:

- claude: `esc to interrupt` or spinner lines → working;
  `Do you want to` / `❯ 1. Yes` / `dangerously` → needs_attention
  (permission); trailing `?` line in the last assistant block →
  needs_attention (question); otherwise idle if the input box is empty.
- codex: `Allow command` / `y/n` → needs_attention; spinner/`Working`
  → working; else idle.
- generic/hermes/pi: start with only needs_attention on `[y/N]`-style
  prompts and `working` never (unknown otherwise); extend from real
  observations, not guesses.

Rules will misclassify sometimes. That is acceptable for a dashboard
signal; `unknown` plus the live peek view keeps the human able to see
the truth. Tests: fixture pane texts per flavor asserting the
classification, so harness UI changes become one-line fixture updates.

## Dashboard surface

- Roster chips and focus header: status word with color (working =
  moss, needs_attention = honey with the detail line as tooltip,
  idle = dim, unknown = dim italic). needs_attention also gets the
  existing badge treatment so it is visible from overview.
- Hive panel: needs_attention bees hover at the hive entrance (they
  are waiting on the owner); idle bees drift; working bees fly loops.
- Optional later: a `needs attention` filter strip above the kanban.

## Owner notification (phase 2)

When an agent enters needs_attention and stays there for more than a
configurable grace period (default 60s), record a message from that
agent to `owner` (context `attention`) so it lands in the dashboard
thread history. No tmux injection for the owner; the dashboard is the
owner's channel. Debounce: one notification per attention episode.

## Permission prompt assistance (phase 3, explicit opt-in)

Per-agent policy stored on the recipient row: `prompt_policy` =
`notify` (default) | `accept_allowlist` | `accept_all`.

- `notify`: phase 2 behavior only. DEFAULT; never auto-acts.
- `accept_allowlist`: if the detected permission dialog's command line
  matches one of the owner-configured regexes for that agent, deliver
  the acceptance keystroke via the existing tmux submit machinery, and
  record what was auto-accepted as a message to owner (context
  `auto-accept`) for audit. Anything not matching falls back to notify.
- `accept_all`: same mechanics, no filter. Exists because the owner may
  want it for throwaway agents; the dashboard must label these agents
  visibly. This is equivalent to running the agent without permission
  gates and should be presented as such.

Safety notes: auto-acceptance only ever sends the affirmative
keystroke for a RECOGNIZED dialog pattern; on any ambiguity it
notifies instead. The audit trail is not optional. Where a harness
supports native permission configuration (Claude Code settings
allowlists), prefer configuring the harness over auto-accepting in
tmux; this feature is for harnesses and cases where that is not
possible.

## Relationship to `agent-msg status` self-reports

Complementary, not competing: the loop answers "is it stuck?", the
self-report answers "what is it working on?" (feeds roster sublines
and the hive). The self-report stays a separate roadmap item; nothing
in this plan depends on it.

## Phasing

1. Poll loop + classification + `/api/state` + chips/focus header
   (server: activity.py, loop, state field; dashboard: status
   rendering; tests for classification and state plumbing).
2. Attention notifications with grace period and debounce.
3. Prompt policies with allowlist auto-accept and audit messages.

Each phase is independently shippable and reviewable. Implementation
assignment is the owner's call (recent pattern: badger implements,
hedgehog reviews).

## Open questions for the owner

- Poll interval and grace period defaults (5s / 60s proposed).
- Should needs_attention older than some threshold also ping a phone
  via ntfy or similar, or is the dashboard enough for now?
- For accept_allowlist, is per-agent configuration enough, or do you
  want one global allowlist shared by all agents?
