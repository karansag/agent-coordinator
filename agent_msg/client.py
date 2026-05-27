"""Tiny CLI client. Usage:

    agent-msg register [--pane Y] [--flavor NAME] [--instructions TXT] [--message-prefix TXT]
    agent-msg send --to Y [--context CTX] --message MSG
    agent-msg messages [--user X] [--limit N]
    agent-msg recipients
    agent-msg whoami       # prints detected tmux pane + registered handle

Defaults:
    --pane            current shell's tmux pane (via `TMUX_PANE`-targeted `tmux display-message`)
    server URL        $AGENT_MSG_URL (else http://127.0.0.1:8765)
"""

from __future__ import annotations

import argparse
import json
import os
import sys

import httpx

from .tmux import current_pane


def base_url() -> str:
    return os.environ.get("AGENT_MSG_URL", "http://127.0.0.1:8765")


def registered_user(pane: str) -> str | None:
    r = httpx.get(f"{base_url()}/recipients", timeout=5)
    if not r.is_success:
        return None
    for recipient in r.json().get("recipients", []):
        if recipient.get("tmux_pane") == pane:
            return recipient.get("user_id")
    return None


def cmd_register(args: argparse.Namespace) -> int:
    pane = args.pane or current_pane()
    if not pane:
        print(
            "error: could not detect tmux pane; pass --pane explicitly", file=sys.stderr
        )
        return 2
    payload: dict = {"tmux_pane": pane}
    if args.agent_id:
        payload["agent_id"] = args.agent_id
    if args.model:
        payload["model"] = args.model
    if args.flavor:
        payload["flavor"] = args.flavor
    if args.instructions:
        payload["instructions"] = args.instructions
    if args.message_prefix:
        payload["message_prefix"] = args.message_prefix
    if args.submit_key:
        payload["submit_key"] = args.submit_key
    r = httpx.post(f"{base_url()}/register", json=payload, timeout=5)
    print(r.text)
    return 0 if r.is_success else 1


def cmd_send(args: argparse.Namespace) -> int:
    pane = current_pane()
    if not pane:
        print(
            "error: could not detect tmux pane; run inside tmux or register with --pane",
            file=sys.stderr,
        )
        return 2
    sender = registered_user(pane)
    if not sender:
        print(
            "error: current tmux pane is not registered; run `agent-msg register` first",
            file=sys.stderr,
        )
        return 2
    payload = {
        "tmux_pane": pane,
        "recipient": args.to,
        "content": args.message,
    }
    if args.context:
        payload["context"] = args.context
    r = httpx.post(f"{base_url()}/send", json=payload, timeout=10)
    print(r.text)
    return 0 if r.is_success else 1


def cmd_messages(args: argparse.Namespace) -> int:
    params = {"limit": args.limit}
    if args.user:
        params["user"] = args.user
    r = httpx.get(f"{base_url()}/messages", params=params, timeout=5)
    print(json.dumps(r.json(), indent=2))
    return 0 if r.is_success else 1


def cmd_recipients(_: argparse.Namespace) -> int:
    r = httpx.get(f"{base_url()}/recipients", timeout=5)
    print(json.dumps(r.json(), indent=2))
    return 0 if r.is_success else 1


def cmd_whoami(_: argparse.Namespace) -> int:
    pane = current_pane()
    user = registered_user(pane) if pane else None
    print(
        json.dumps(
            {"user": user, "pane": pane, "server": base_url()}, indent=2
        )
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="agent-msg")
    sub = p.add_subparsers(dest="cmd", required=True)

    reg = sub.add_parser("register")
    reg.add_argument("--pane")
    reg.add_argument(
        "--agent-id",
        help="stable session identifier (e.g. conversation UUID); used as real identity",
    )
    reg.add_argument(
        "--model", help="model label for telemetry only (e.g. claude-opus-4-7)"
    )
    reg.add_argument(
        "--flavor",
        help="delivery flavor used to pick default submit behavior (e.g. codex)",
    )
    reg.add_argument(
        "--instructions",
        help="human guidance for peers talking to this agent",
    )
    reg.add_argument(
        "--message-prefix",
        help="literal text prefixed to each delivered message (e.g. '/queue ')",
    )
    reg.add_argument(
        "--submit-key",
        help="tmux key name used to submit each delivered message (default: C-m)",
    )
    reg.set_defaults(func=cmd_register)

    snd = sub.add_parser("send")
    snd.add_argument("--to", required=True)
    snd.add_argument("--message", required=True)
    snd.add_argument("--context")
    snd.set_defaults(func=cmd_send)

    msg = sub.add_parser("messages")
    msg.add_argument("--user")
    msg.add_argument("--limit", type=int, default=20)
    msg.set_defaults(func=cmd_messages)

    rcp = sub.add_parser("recipients")
    rcp.set_defaults(func=cmd_recipients)

    who = sub.add_parser("whoami")
    who.set_defaults(func=cmd_whoami)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
