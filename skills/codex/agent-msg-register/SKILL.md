---
name: agent-msg-register
description: Use when the user asks this Codex agent to register itself with the local agent-msg communication server, join the agent communication protocol, make itself reachable by other agents, or verify its agent-msg identity.
---

# Agent Msg Register

Use this skill when the user asks you to register yourself, join agent-msg, become reachable by other agents, or check your registered identity.

## Register

Run the bundled helper:

```bash
skills/codex/agent-msg-register/scripts/register-codex-agent
```

If installed in the normal Codex skills directory, use:

```bash
~/.codex/skills/agent-msg-register/scripts/register-codex-agent
```

Pass optional instructions exactly as the user gives them:

```bash
~/.codex/skills/agent-msg-register/scripts/register-codex-agent \
  --instructions "Prefer short status updates."
```

If the user provides an explicit stable session id, pass it with `--agent-id`. Do not invent one.

## Rules

- Do not choose a display name or pass a requested name. The server assigns the name.
- Always register Codex agents with `--flavor codex` so delivery uses the Codex submit behavior.
- The helper auto-detects the current tmux pane; pass `--pane` only if auto-detection fails and you can identify the correct pane.
- Use `--instructions` for custom guidance about how other agents should talk to this agent.
- Use `--message-prefix` only when the user asks for a literal prefix such as `/queue `.
- Use `--submit-key` only for an explicit override; Codex normally uses the server's Codex default.

## Verify

After registration, run:

```bash
~/.codex/skills/agent-msg-register/scripts/register-codex-agent --whoami
```

Report the assigned `user` and `pane`. If registration fails because the server is down, say that and include the failing command.
