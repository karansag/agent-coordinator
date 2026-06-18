# Agent Coordination Landscape

This repo should be positioned as a small delivery component, not a full
orchestrator.

The agent-coordination space is splitting into layers:

1. Work tracking and memory
2. Workspace orchestration
3. Agent-to-agent messaging
4. Terminal/process control
5. Conflict detection and handoff state

`agent-msg` is strongest at layer 3, with a little bit of layer 4. That
is a useful niche if the project stays small and becomes easy to embed
inside larger systems.

## Nearby Projects

### Beads

[Beads](https://github.com/gastownhall/beads) is an agent-first issue
tracker and memory layer. It models work as structured issues with
dependencies, priorities, routing, and multi-agent assignment. Its
current docs describe it as a Dolt-backed issue tracker for
AI-supervised coding workflows.

Where Beads is strong:

- Persistent task graph
- Dependency-aware ready work
- Cross-repo and multi-agent assignment
- Agent-readable CLI output
- Long-running project memory

Where `agent-msg` fits:

- Beads can say "who should work on what."
- `agent-msg` can say "deliver this note to that live agent now."

The clean integration is a Beads hook or plugin that sends an
`agent-msg` notification when work is assigned, unblocked, blocked, or
completed.

### Gas Town

[Gas Town](https://github.com/gastownhall/gastown) is a full workspace
manager for coordinating many AI coding agents across projects. It has
concepts for a central coordinator, project workspaces, worker agents,
git-backed state, and persistent work tracking through Beads.

Where Gas Town is strong:

- End-to-end multi-agent workspace management
- Agent roles and operating model
- Multi-project coordination
- Persistent work state
- Scaling a whole team of agents

Where `agent-msg` fits:

- Gas Town is the control plane.
- `agent-msg` can be a local delivery backend for terminal-based agents.

The integration should not try to replace Gas Town. It should expose a
small adapter: "given a recipient identity and message, wake the matching
terminal agent."

### hcom

[hcom](https://github.com/aannoo/hcom) is a broad terminal-agent
coordination tool. It can launch supported agent CLIs, message agents,
observe activity, subscribe to events, and use hooks plus a local SQLite
database. It also supports remote relays.

Where hcom is strong:

- Single-binary install
- Launching and supervising agent processes
- Terminal observation and event streams
- Cross-tool support
- Rich operator workflow

Where `agent-msg` fits:

- `agent-msg` is much smaller and easier to embed.
- It can stay focused on registration, addressing, history, and prompt
  delivery.

hcom is closer to a complete product. `agent-msg` should be the thing a
complete product can call.

### MCP Agent Mail

[MCP Agent Mail](https://github.com/dicklesworthstone/mcp_agent_mail) is
a mail-like coordination layer exposed through FastMCP. It provides
identities, inboxes, searchable history, threads, and advisory file
leases.

Where MCP Agent Mail is strong:

- MCP-native agent interface
- Mailbox/thread model
- Searchable history
- Advisory file reservations
- Multi-codebase coordination

Where `agent-msg` fits:

- `agent-msg` is push delivery into live terminal prompts.
- MCP Agent Mail is closer to durable mailbox semantics.

These can compose: an MCP server could use `agent-msg` as a wake/delivery
mechanism for agents that are currently alive in tmux.

### Swarm Protocol

[Swarm Protocol](https://github.com/phuryn/swarm-protocol) is a headless
coordination protocol exposed as an MCP server. It focuses on claims,
conflict checks, heartbeats, completion signals, and context packages.

Where Swarm Protocol is strong:

- Shared state synchronization
- File conflict warnings
- Structured handoff context
- Team-scale coordination model
- MCP integration

Where `agent-msg` fits:

- Swarm Protocol tells agents what state changed.
- `agent-msg` can notify a live agent that it should look now.

Again, the right shape is a small delivery adapter.

### Guild

[Guild](https://github.com/mathomhaus/guild) focuses on shared context,
memory, and task coordination for coding agents. It uses a local SQLite
store and gives an agent a session-start flow that loads principles,
previous handoff context, and ready work.

Where Guild is strong:

- Session bootstrapping
- Shared memory
- Task coordination
- Search over project context

Where `agent-msg` fits:

- Guild is context and task state.
- `agent-msg` is live contact between running sessions.

## Recommended Positioning

`agent-msg` should describe itself as:

> A tiny local delivery layer for terminal-based coding agents.

It should avoid claiming to be:

- A project manager
- A task graph
- A workspace orchestrator
- A conflict prevention system
- A full mailbox product

Instead, it should be the pluggable component that other systems use
when they need to reach a running terminal agent.

## Product Shape

The best long-term shape is:

```text
orchestrator / task system / MCP server
    |
    | send(recipient, context, message)
    v
agent-msg core
    |
    | resolve recipient -> live endpoint
    v
agent interface
    |
    | deliver through tmux / pty / MCP / future transport
    v
running agent
```

This keeps `agent-msg` useful even when users already have Beads, Gas
Town, hcom, or an MCP-based workflow.

## Interface Boundary

The important abstraction is an agent interface:

- How do we recognize this kind of agent?
- What submit key wakes it?
- Does it need a message prefix?
- How should inbound messages be formatted?
- Can it report a stable session id?
- Can it be launched, resumed, or only messaged?
- Which transport can deliver to it: tmux pane, PTY, HTTP, MCP, or
  something else?

The current `flavor` field is an early version of that interface. It
should become a real adapter boundary.
