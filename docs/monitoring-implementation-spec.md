# Spec: agent activity monitoring, phases 1 and 2

Implementation-ready spec derived from docs/agent-monitoring-plan.md
after owner review (2026-07-14). Any agent may implement; follow the
conventions in docs/roadmap.md (plain commits, scratch-server
verification, portal editing rules).

Scope: the status loop (change detection primary, dialog-fingerprint
regex secondary) and owner attention notifications. Explicitly OUT of
scope by owner decision: any automatic acceptance of permission
prompts (`prompt_policy`, allowlists, keystroke injection). Do not
build it.

## New module: agent_msg/activity.py

Pure functions plus one registry-updating step function, so tests never
need the loop or tmux.

- `snapshot_hash(text: str) -> str` — sha1 of the capture with trailing
  whitespace stripped from each line and the whole text.
- `ATTENTION_PATTERNS: dict[str, list[re.Pattern]]` — keys are flavors
  plus `"generic"` fallback. Initial set, deliberately small:
  - claude: `Do you want to`, `❯ 1\. Yes`, `Esc to cancel`
  - codex: `Allow command`, `\by/n\b`, `Approve`
  - generic (also hermes, pi): `\[y/N\]`, `\(y/n\)`, `password:`
  A static screen matching any pattern for its flavor (fall back to
  generic when the flavor has no entry) is `needs_attention`; the
  matched line (stripped) is the `detail`.
- `step(registry: dict, observations: list[Observation], now: float,
  interval: float, grace: float) -> list[Notification]`
  - `Observation` = (user_id, flavor, pane_alive: bool,
    capture: str | None)  # capture None means capture failed
  - Mutates `registry[user_id]` = {hash, changed_at, status, detail,
    since, notified: bool} and returns notifications to record.
  - Status decision per agent:
    - not pane_alive → `stopped`
    - capture is None → `unknown`
    - hash != previous hash → `working` (update changed_at)
    - static less than `2 * interval` seconds → keep previous status
      (a pane is not "idle" the instant it stops changing)
    - static longer: attention pattern match → `needs_attention`
      with detail; otherwise → `idle`
  - `since` updates only when status changes. Registry rows for
    unregistered users are dropped.
  - Notifications (phase 2): when status is `needs_attention`
    continuously for ≥ `grace` seconds and `notified` is false, emit
    one Notification(user_id, detail) and set `notified`. Reset
    `notified` when the agent leaves `needs_attention`.

## Server changes (agent_msg/server.py)

- `create_app(db_path=DB_PATH, monitor: bool = True)`. The console
  entry keeps monitor on; tests construct with `monitor=False` except
  the dedicated step() tests, which don't need an app at all.
- When monitor is on, a FastAPI startup handler launches
  `asyncio.create_task(_monitor_loop(...))`; shutdown cancels it.
  Interval from `AGENT_MSG_MONITOR_INTERVAL` (default 5.0 seconds),
  grace from `AGENT_MSG_ATTENTION_GRACE` (default 60.0).
- `_monitor_loop`: each tick, gather recipients and `tmux.list_panes()`
  once, then capture each live pane via
  `asyncio.to_thread(tmux.capture_pane, pane)` (subprocess calls must
  not block the event loop). Build observations, call `activity.step`,
  and for each returned notification call `db.record_message(conn,
  sender=<agent>, recipient="owner", context="attention",
  content=f"needs attention: {detail}", delivered=True,
  delivery_error=None)` so it lands in the owner's dashboard thread.
  Wrap the tick body in try/except; a failed tick logs and skips,
  never kills the loop.
- `/api/state`: each recipient gains `"activity": {status, detail,
  since}`. When the monitor is off or has no data yet, status is
  `"unknown"` with detail null (the dashboard must tolerate this).

## Dashboard changes (agent_msg/portal.html)

Follow the portal editing rules in docs/roadmap.md (Preact, keyed,
no wholesale rewrite; insert with targeted edits).

- One color per state, owner requirement, used consistently everywhere
  a state appears (status dot, status word, focus header, hive marker).
  Define as CSS custom properties next to the existing palette:
  - `--state-working: #8fbf6f` (moss; the existing live green)
  - `--state-attention: #f2a93b` (honey), dot pulses like the beacon
  - `--state-idle: #a89878` (cream-dim)
  - `--state-unknown: #a89878` but rendered as a hollow ring (border
    only, no fill) so idle and unknown stay distinguishable beyond
    color
  - `--state-stopped: #e06c55` (alert; the existing dead red)
  The status dot in the chip name line switches from the binary
  live/dead coloring to this five-state mapping. Color is never the
  only carrier: the status word always appears beside the dot
  (dataviz rule; also keeps colorblind users covered).
- RosterChip: when the agent has no current task, the sub line shows
  the activity status word in its state color instead of the static
  "idle"/"running" text; needs_attention shows the detail text with a
  title tooltip carrying the full matched line. An agent in
  needs_attention also gets the existing unread-badge dot styling so
  it is visible from across the room.
- Focus header meta line: append `· <status>` in the state color and,
  for needs_attention, the detail.
- Hive panel, minimal touch only: a bee whose agent is
  needs_attention gets a small `!` above it in the attention color.
  Do not rework bee motion in this change.

## Tests

- `tests/test_activity.py`: pure step() tests with fabricated
  observations; cover changed→working, static-short keeps previous,
  static-long→idle, static-long with claude dialog→needs_attention
  with detail, capture-failure→unknown, dead-pane→stopped,
  grace-period notification emitted exactly once per episode and
  re-armed after recovery, unregistered users dropped.
- `tests/test_server.py`: state endpoint carries activity for a
  registered agent (construct app with monitor=False, seed the
  registry directly); existing tests keep passing with monitor off.

## Verification (scratch, never production)

1. `AGENT_MSG_DB=/tmp/mon.sqlite AGENT_MSG_PORT=8799
   AGENT_MSG_ATTENTION_GRACE=15 uv run agent-msg-server`
2. Three panes in a scratch tmux session, all registered:
   - `while true; do date; sleep 1; done` → must read working
   - plain idle shell → must read idle
   - `printf 'Do you want to proceed?\n❯ 1. Yes\n 2. No\n'; sleep 999`
     registered with flavor claude → must read needs_attention
3. `curl /api/state` and confirm all three activities.
4. After ~15s, confirm exactly one `attention` message to owner in
   `/messages?user=owner`, and that recovery (interrupt the fake
   dialog) re-arms it.
5. Playwright with system Chrome: screenshot roster + focus header,
   inspect it yourself; no pageerror events.
6. `uv run pytest -q`; kill scratch session; single plain commit;
   update README dashboard section (a sentence or two) and the plan
   doc's phasing section to mark phases 1-2 done. Restart the
   production server afterward so the loop goes live, and confirm
   /api/state carries activity there.

## Acceptance summary

Owner sees per-agent working / idle / needs_attention / unknown /
stopped on the dashboard, updated within ~10s of reality, with the
reason line for attention states, and gets exactly one thread message
per attention episode that outlasts the grace period. No keystrokes
are ever injected by the monitor.
