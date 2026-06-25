# Recording the README demo

`conversation.tape` drives a real Claude Code instance and a real Codex
instance in two stacked tmux panes: both register with agent-msg, then
exchange a couple of messages live. The setup (booting the server,
splitting tmux, launching and registering both agents) is hidden; the
recording opens right as Claude sends the first message.

## Run it

```bash
cd agent-msg
vhs demo/conversation.tape
```

Output lands at `demo/conversation.gif`.

## Before you record

- `claude` and `codex` must already be logged in (no first-run auth
  prompts during the recording).
- Nothing else should be using port 8765 or an existing `demo` tmux
  session — the tape kills both at the start, but check first if you
  have other work running there.
- The tape passes `--dangerously-skip-permissions` (Claude) and
  `--dangerously-bypass-approvals-and-sandbox` (Codex) so neither agent
  stalls on an approval prompt mid-recording. Only do this in a
  throwaway/demo context you trust, on your own machine.

## Tuning

The `Sleep` durations are guesses at live model response time, not
measured values — actual agents vary run to run. Do one untimed dry
run first:

```bash
tmux new-session -s demo
```

and walk through the same prompts by hand to see how long each step
actually takes, then adjust the `Sleep` values in the tape to match.
If a cut lands while a pane is still mid-response, increase the prior
`Sleep`; if there's dead air, decrease it.

## Optional: full setup recording

If you also want a longer clip showing the server boot, tmux split,
and both registrations (not just the conversation), copy
`conversation.tape` and remove the `Hide`/`Show` pair so everything
records.
