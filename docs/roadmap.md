# Dashboard roadmap and working notes

Agent-agnostic notes for whoever continues this work (human, Claude,
Codex, or otherwise). Last updated 2026-07-13.

## Deferred features

- **`agent-msg status "one-liner"` self-reports.** Agents summarize
  what they are doing via a CLI command that stores a status line per
  agent. This feeds the visualization above and the roster sublines. No
  separate LLM harness is needed; the agents are LLMs and can
  self-report.
- **Tailnet auth.** The dashboard is served tailnet-wide via
  `tailscale serve --bg --https=8445 http://127.0.0.1:8765` at
  https://karans-linux.tail7b7d19.ts.net:8445/. Port 8443 is reserved for
  Diction and routes to its persistent gateway on local port 8092; the gateway
  forwards to the transcription normalizer on port 8091. Do not route 8443
  directly to 8091 because the installed app uses the gateway's WebSocket
  protocol. The full agent-msg API (send, register, tasks, spawn) is exposed,
  not just read views. Add an auth gate or read-only mode before sharing the
  tailnet.

## Conventions for this repo

- Commit messages: plain, no AI attribution footers.
- Prose (docs, UI copy, commits): no "no x, no y, just z"
  constructions, minimal emdashes, plain functional naming ("agent
  dashboard", "agents"), no whimsical section names, no KPI stat-tile
  strips.
- The dashboard (`agent_msg/portal.html`) is a Preact app with the
  preact+htm standalone bundle (13 KB, global `htmPreact`) vendored
  inline. To rewrite it wholesale, put `/*__VENDOR__*/` in the first
  script tag and splice the bundle from
  unpkg.com/htm@3.1.1/preact/standalone.umd.js over the placeholder.
  Keep lists keyed; no manual DOM manipulation.
- Verify changes end to end against a scratch server
  (`AGENT_MSG_DB=/tmp/x.sqlite AGENT_MSG_PORT=8799`), never against
  the production server on 8765 (real DB at ~/.agent-msg/db.sqlite).
  Playwright with system Chrome (`channel="chrome"`) works for browser
  checks. Restarting the production server is safe; all state is in
  SQLite.
