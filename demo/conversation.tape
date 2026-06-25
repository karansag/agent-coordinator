# VHS tape for the agent-msg README demo.
# Renders to demo/conversation.gif.
#
# Drives two REAL agents (Claude Code on top, Codex on bottom) in one
# tmux session, split top/bottom. Both register with agent-msg, then
# have a short live exchange over the bus. Setup (server boot, tmux
# split, launching + registering both agents) is hidden; the recording
# starts right as Claude sends the first cross-agent message.
#
# Run from the repo root:
#   vhs demo/conversation.tape
#
# Requirements:
#   - agent-msg installed (`uv pip install -e .` from repo root)
#   - `claude` and `codex` CLIs on PATH and already logged in
#   - tmux
#
# The Sleep durations below are guesses at live model response time —
# they WILL need tuning. Run once, watch demo/conversation.gif, and
# adjust: if a pane is still "thinking" when the recording cuts to it,
# increase the preceding Sleep; if there's dead air, decrease it.
# Prefer `Wait+Screen` over `Sleep` once you know a stable string each
# agent prints (e.g. its assigned handle) — it's tuned here with plain
# Sleep because exact agent output isn't predictable in advance.

Output demo/conversation.gif

Set Shell "bash"
Set FontFamily "DejaVu Sans Mono"
Set FontSize 16
Set Width 1280
Set Height 860
Set Padding 20
Set TypingSpeed 40ms

Hide

# Put the project venv's bin/ on PATH so plain `agent-msg ...` resolves
# in every pane (including subshells the agents spawn). Without this,
# bare `agent-msg` is "command not found" and the agents fall back to
# curl or hunting for .venv/bin/agent-msg by hand, which looks bad on
# camera.
Type "export PATH=$PWD/.venv/bin:$PATH"
Enter
Sleep 200ms

# Reset server + DB so handles/state are predictable, then start fresh.
Type "fuser -k 8765/tcp 2>/dev/null; rm -f ~/.agent-msg/db.sqlite; clear"
Enter
Sleep 1s
Type "setsid -f uv run agent-msg-server > /tmp/agent-msg.log 2>&1"
Enter
Sleep 1500ms
Type "clear"
Enter
Sleep 500ms

# tmux session with two panes, stacked top/bottom.
Type "tmux new-session -d -s demo -n agents && tmux split-window -v -t demo:agents && tmux select-pane -t demo:agents.0 && tmux attach -t demo"
Enter
Sleep 1s

# --- Top pane: Claude Code ---
Type "claude --dangerously-skip-permissions"
Enter
Sleep 4s

Type "Read AGENT_PROMPT.md in this repo, then register yourself with agent-msg using the agent-msg-register skill. Reply with just your assigned handle, nothing else."
Enter
Sleep 18s

# --- Bottom pane: Codex ---
Ctrl+B
Down
Sleep 500ms
Type "codex --dangerously-bypass-approvals-and-sandbox"
Enter
Sleep 4s

Type "Read AGENT_PROMPT.md in this repo, then register yourself with agent-msg using the agent-msg-register skill. Reply with just your assigned handle, nothing else. After this, if you get an inbound agent-msg message, reply to it briefly using agent-msg send, then stop — don't send or do anything further."
Enter
Sleep 18s

# Back to the top pane so the visible recording opens on Claude.
Ctrl+B
Up
Sleep 500ms

Show

# --- Visible conversation starts here ---
Type "Send a one-sentence agent-msg message to the other registered agent asking what model they're running. Then wait for their reply, send back a one-sentence acknowledgment, and stop — don't send or do anything further after that."
Enter
Sleep 10s

# Cut to the bottom pane to show Codex waking up on the inbound message and replying.
Ctrl+B
Down
Sleep 6s

# Back to Claude to show it receiving the acknowledgment-worthy reply.
Ctrl+B
Up
Sleep 4s
