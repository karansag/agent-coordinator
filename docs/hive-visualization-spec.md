# Spec: the hive panel (live agent visualization)

> Updated after the owner-directed task-comb redesign: the oversized owner
> skep was replaced by a compact owner node, and active work now occupies the
> center of the scene as a honeycomb.

A whimsical but truthful canvas visualization of agents working, shown
at the top of the dashboard's overview mode, above the kanban board.
This documents the agreed design so any agent (Claude, Codex, human)
can build it without further product decisions. Experimental: ship a
v1 matching this spec, then iterate with Karan.

## Where it lives

- File: `agent_msg/portal.html` only. No server changes, no new
  endpoints. All data comes from the existing 2s `/api/state` poll the
  Preact app already does.
- New Preact component `HiveView`, rendered by `Overview` above
  `Kanban`: a full-width panel, height 260px, under an `h2` heading
  labeled `activity` (plain heading; the whimsy is inside the canvas).
- The portal is a Preact app with `htmPreact` vendored inline. Read
  docs/roadmap.md "Conventions" before touching the file. Add the
  component with an `Edit` insertion; do not rewrite the whole file.

## Scene layout (canvas, 260px tall, full stage width)

```
+----------------------------------------------------------------+
|             task comb · N waiting · M carried     shipped · N  |
|                     [#4][#7]...                     ◇◇          |
|                                                                  |
|       ~~~ live bees orbit the task comb and carry work ~~~       |
|                                                                  |
|                       ◇ owner (compact)                          |
+----------------------------------------------------------------+
```

## Visual vocabulary (all from existing CSS palette)

- Background: transparent over the page's honeycomb background; draw a
  faint 1px `--line` (#3a2d1a) rounded border via the wrapping div
  (reuse `.col`-style border), not in canvas.
- Bee: drawn in canvas per running agent. Body = 12px ellipse rotated
  toward travel direction, filled with the agent's identity color
  `hsl(hue(name) 42% 58%)` (reuse the existing `hue()` function), two
  darker stripes (`#16120c` at 50% alpha), two flapping wings
  (ellipses, `rgba(240,230,210,.5)`, flutter with `sin(t*30)`), tiny
  head dot. Name label centered 16px below the body: 10px mono,
  `--cream-dim` (#a89878).
- Task cell: an 18px-radius hexagon in the central comb, filled with
  translucent honey and labeled `#N`. A task assigned to a stopped agent stays
  in the comb with an alert-colored outline instead of silently disappearing.
  Hover reveals its title and state. The smaller carried token remains the
  existing 8px-radius hexagon so it does not obscure its bee.
- Owner node: one compact 8px-radius honey hexagon at bottom-center, labeled
  `owner`. It remains the endpoint for owner message streaks without consuming
  the scene's informative area.
- Shipped pile: two overlapping moss cells at top-right with a `shipped · N`
  count. A task that newly becomes done flies from its last bee toward this
  pile over about 1.1 seconds, then leaves the active scene.
- Message streak: particle traveling sender → recipient over ~900ms
  along a quadratic bezier whose control point is lifted 40px above
  the midpoint. Head: 2.5px circle `--honey`; tail: fading 10-step
  trail at decreasing alpha. Owner-involved messages start/end at the
  hive entrance.

## Behavior (data mapping, must stay truthful)

- One bee per RUNNING agent (`pane_alive`), keyed by `user_id`.
  Stopped agents are absent. Bees appear/disappear as the roster
  changes; no ghost bees.
- Home positions: distribute live bees around an ellipse centered on the task
  comb. Recompute on resize; canvas width tracks its container each frame,
  with devicePixelRatio scaling.
- Idle bee (no picked_up task): lazy Lissajous wander around home,
  amplitude ~18px, slow (full loop ~8s), phase seeded from `hue(name)`
  so bees never sync.
- Busy bee (has a `picked_up` task, via the existing `currentTask()`
  helper): tighter and faster loops (amplitude ~26px, ~2.5x speed) and
  it carries its task token 14px below the body.
- Active tasks without a live assignee occupy the central comb (up to 15 cells,
  with an overflow count). Assigned but still `open` → token bobs gently ~22px
  beside its bee; `picked_up` → the bee carries it below its body.
- Done tasks leave the comb/bee and increment the shipped pile. Transitions
  observed after initial load animate a token to the pile; existing completed
  history does not burst on page load.
- Messages: on each poll, messages with id greater than the last seen
  id spawn one streak each (cap at 8 per poll). Maintain the last-seen
  id in a ref local to HiveView; initialize it to the current max on
  first render so page load does not spawn a burst.
- Click: hit-test bees (distance < 16px); clicking sets
  `location.hash = "#/agent/<name>"` (reuse `focusHash`). Set canvas
  `cursor: pointer` while hovering a bee, default otherwise.
- Hover: draw a one-line tooltip near the bee (name + current task
  title, 10px mono on `--panel` rounded rect) instead of an HTML
  element; simplest inside canvas.

## Implementation notes

- Component signature: `HiveView({ state })`. Keep a
  `stateRef.current = state` update in render so the rAF loop always
  reads fresh data without restarting.
- One `requestAnimationFrame` loop started in `useEffect(() => ..., [])`
  with cleanup on unmount (overview → focus navigation unmounts it).
- Respect `matchMedia("(prefers-reduced-motion: reduce)")`: skip the
  rAF loop; render one static frame per state change (wings folded, no
  streaks; tokens and bees at their home positions).
- Bee/particle state lives in plain refs (Maps keyed by user_id), not
  React state; only React-render the wrapping div + canvas element.
- Message streak endpoints: look up live bee positions from the bee registry at
  spawn time; if an endpoint is the owner or an agent that has no bee
  (stopped), use the compact owner node.
- Keep everything inside ~250 lines. No external assets; everything is
  drawn with canvas 2D paths.

## Verification (follow docs/roadmap.md conventions)

1. Scratch server + tmux: `AGENT_MSG_DB=/tmp/hive-viz.sqlite
   AGENT_MSG_PORT=8799`, register 3 agents from tmux panes (see git
   history for the established pattern; use fake model labels freely).
2. Create tasks in each status; have one agent `task-update` to
   picked_up over the CLI. Send agent→agent and owner→agent messages.
3. Playwright with system Chrome: assert no `pageerror` events, take a
   screenshot after ~5s of animation, LOOK at it (bees present, one
   carrying a token, labels legible, nothing clipped), click a bee and
   assert the hash routes to that agent's focus mode.
4. Confirm the kanban below still works and idle CPU stays sane (the
   rAF loop should skip drawing entirely when `document.hidden`).
5. `uv run pytest -q` (the portal test asserts on strings only; keep
   "agent dashboard" and "/api/state" present).
6. Single commit, plain message, e.g. "Add hive activity visualization
   to the overview". No AI attribution footer. Update the dashboard
   section of README.md (2-3 lines) and remove the corresponding
   deferred bullet from docs/roadmap.md.

## Explicitly out of scope for v1

- `agent-msg status` self-report command (separate feature; would add
  a status line under bee names later).
- Sound, task creation from the canvas. (Drag assignment shipped after v1:
  comb cells and kanban cards can both be dragged onto a live bee.)
- Any change to message/task semantics or the server.
