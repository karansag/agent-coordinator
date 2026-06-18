# Rust Rewrite Plan

The Rust version should make `agent-msg` a small, typed coordination
component with first-class agent interfaces.

The goal is not to build another full orchestrator. The goal is a
reliable local delivery layer that larger systems can embed, script, or
call over HTTP/MCP.

## Goals

- Single static binary for server and CLI.
- Local-first by default.
- SQLite-backed state.
- Typed adapter boundary for each agent kind.
- Separate agent behavior from delivery transport.
- Keep the HTTP API simple enough for other tools to integrate.
- Preserve the current Python behavior during migration.

## Non-Goals

- No full task tracker.
- No worktree manager.
- No project planning graph.
- No required cloud relay.
- No remote multi-user auth in v1.

Those belong in layers above `agent-msg`.

## Crate Layout

```text
crates/
  agent-msg-core/       domain types, registry, routing, protocol
  agent-msg-store/      SQLite persistence
  agent-msg-transport/  tmux, process/PTY, HTTP/MCP delivery traits
  agent-msg-server/     Axum HTTP server
  agent-msg-cli/        CLI binary
  agent-msg-interfaces/
    codex/
    claude/
    hermes/
    generic/
```

For a smaller first pass, these can live as modules in one crate and be
split later.

## Core Types

```rust
pub struct AgentId(String);
pub struct UserHandle(String);
pub struct PaneId(String);

pub struct AgentRegistration {
    pub handle: UserHandle,
    pub stable_id: Option<AgentId>,
    pub interface: AgentInterfaceId,
    pub model: Option<String>,
    pub endpoint: DeliveryEndpoint,
    pub instructions: Option<String>,
}

pub enum DeliveryEndpoint {
    TmuxPane(PaneId),
    PtySession(String),
    Http(String),
    McpTool { server: String, tool: String },
}

pub struct OutboundMessage {
    pub sender: UserHandle,
    pub recipient: UserHandle,
    pub context: Option<String>,
    pub body: String,
}
```

## Agent Interface Trait

The current Python `flavor` should become a typed interface.

```rust
pub trait AgentInterface: Send + Sync {
    fn id(&self) -> AgentInterfaceId;
    fn display_name(&self) -> &'static str;

    fn default_submit_key(&self) -> SubmitKey;
    fn default_instructions(&self) -> Option<&'static str> {
        None
    }

    fn format_inbound(&self, message: &OutboundMessage) -> String;
    fn supports_endpoint(&self, endpoint: &DeliveryEndpoint) -> bool;

    fn registration_help(&self) -> RegistrationHelp;
}
```

Built-in implementations:

- `CodexInterface`
- `ClaudeInterface`
- `HermesInterface`
- `GenericTerminalInterface`

This gives each agent kind a typed home for behavior that is currently
spread across helper scripts, docs, and `tmux.py`.

## Transport Trait

Agent behavior and delivery mechanics should be separate.

```rust
#[async_trait::async_trait]
pub trait Transport: Send + Sync {
    fn supports(&self, endpoint: &DeliveryEndpoint) -> bool;

    async fn deliver(
        &self,
        endpoint: &DeliveryEndpoint,
        payload: &str,
        submit_key: &SubmitKey,
    ) -> Result<DeliveryReceipt, DeliveryError>;
}
```

Built-in transports:

- `TmuxTransport`
- Later: `PtyTransport`
- Later: `HttpWebhookTransport`
- Later: `McpTransport`

This makes it possible for a Codex interface to use tmux today and a
different transport later without changing registration semantics.

## Interface Registry

```rust
pub struct InterfaceRegistry {
    interfaces: HashMap<AgentInterfaceId, Arc<dyn AgentInterface>>,
}

impl InterfaceRegistry {
    pub fn builtin() -> Self;
    pub fn get(&self, id: &AgentInterfaceId) -> Option<Arc<dyn AgentInterface>>;
}
```

The server receives `interface=codex` rather than a loose `flavor`
string. For backwards compatibility, it should accept `flavor` as an
alias during the migration.

## Third-Party Interfaces

Rust traits are excellent for compiled-in adapters but not a stable
runtime plugin ABI. Support two extension paths:

1. Config-defined terminal interfaces for simple cases.
2. Optional WASM plugin interfaces for advanced third-party adapters.

### Config Interfaces

```toml
[[interfaces]]
id = "my-agent"
display_name = "My Agent"
submit_key = "Enter"
message_prefix = ""
format = "[agent-msg from {sender} · {context}] {body}"
endpoint = "tmux"
```

This covers most terminal clients without requiring Rust code.

### WASM Interfaces

For custom behavior, define a stable WASM contract:

- `interface_metadata()`
- `default_registration()`
- `format_inbound(message_json)`
- `supports_endpoint(endpoint_json)`

WASM avoids Rust dynamic-linking instability and gives plugin authors a
safe boundary.

## Public API

Keep the current HTTP shape, but rename concepts carefully:

```text
POST /register
GET  /recipients
POST /send
GET  /messages
GET  /health
```

Registration should accept both old and new fields:

```json
{
  "tmux_pane": "session:1.0",
  "agent_id": "stable-session-id",
  "model": "gpt-5-codex",
  "interface": "codex",
  "flavor": "codex"
}
```

If both `interface` and `flavor` are present, `interface` wins.

## CLI Shape

```bash
agent-msg serve
agent-msg register --interface codex --agent-id ...
agent-msg send --to <handle> --context <tag> --message "..."
agent-msg recipients
agent-msg messages
agent-msg interfaces
agent-msg interface show codex
```

Helper scripts can become thin wrappers:

```bash
agent-msg register --interface codex --model "${CODEX_MODEL:-gpt-5-codex}"
```

Eventually, the Rust binary can generate or install the helper files:

```bash
agent-msg setup codex
agent-msg setup claude
```

## Store Schema

Keep SQLite, but make the schema explicit:

```sql
CREATE TABLE recipients (
  handle TEXT PRIMARY KEY,
  stable_id TEXT,
  interface_id TEXT NOT NULL,
  model TEXT,
  endpoint_kind TEXT NOT NULL,
  endpoint_value TEXT NOT NULL,
  instructions TEXT,
  submit_key TEXT,
  message_prefix TEXT,
  registered_at INTEGER NOT NULL
);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  context TEXT,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  delivered INTEGER NOT NULL,
  delivery_error TEXT
);
```

Use `sqlx` migrations or `rusqlite` with hand-written migrations.

Recommendation: use `rusqlite` first. It keeps the binary and migration
story simple.

## Migration Plan

### Phase 1: Prepare Python API

- Add `interface` as an alias for `flavor`.
- Keep current CLI behavior.
- Document the interface concept.
- Keep tests around Codex and Claude defaults.

### Phase 2: Rust CLI and Library Skeleton

- Create Rust workspace.
- Implement domain types.
- Implement `AgentInterface` and built-in interfaces.
- Implement SQLite store.
- Implement `TmuxTransport`.
- Add parity tests for message formatting and submit keys.

### Phase 3: Rust Server Parity

- Implement Axum server.
- Match existing endpoint responses.
- Add compatibility handling for `flavor`.
- Run Python and Rust servers against the same HTTP contract tests.

### Phase 4: Cutover

- Replace console scripts with the Rust binary.
- Keep Python package around only if needed for compatibility.
- Add `agent-msg setup codex|claude`.
- Update skills to call the Rust binary.

### Phase 5: Plugin Interfaces

- Add config-defined interfaces.
- Add `agent-msg interfaces` commands.
- Consider WASM plugins only after config interfaces prove insufficient.

## Risks

- Overbuilding: if `agent-msg` starts doing task tracking, it competes
  with Beads/Gas Town instead of composing with them.
- Plugin complexity: native dynamic Rust plugins are not worth it for
  v1.
- Prompt injection: every delivery backend writes into an agent prompt;
  docs and defaults must keep that explicit.
- Identity ambiguity: server-assigned handles are convenient, but stable
  ids need to remain visible for orchestrators.

## Recommended First Rust Milestone

Build a single `agent-msg` binary that supports:

- `serve`
- `register`
- `send`
- `recipients`
- `messages`
- `whoami`
- built-in `codex`, `claude`, and `generic` interfaces
- tmux delivery only
- SQLite persistence

Do not build dynamic plugins in the first milestone. Get the trait
boundary right, then add config-defined interfaces.
