"""Pure tests for the harness spawn command builder."""

from agent_msg import tmux


AUTO_CLAUDE = "claude --permission-mode bypassPermissions"
CODEX_STARTUP = "codex -c check_for_update_on_startup=false"
AUTO_CODEX = f"{CODEX_STARTUP} --ask-for-approval never --sandbox workspace-write"


def test_default_autonomy_is_auto():
    assert tmux.spawn_launch_command("claude") == AUTO_CLAUDE
    assert tmux.spawn_launch_command("codex") == AUTO_CODEX
    # pi has no approval gating, so auto needs no extra flags
    assert tmux.spawn_launch_command("pi") == "pi"
    assert tmux.spawn_launch_command("hermes") == "hermes --yolo --accept-hooks"


def test_supervised_keeps_ask_first_behavior():
    assert tmux.spawn_launch_command("claude", autonomy="supervised") == "claude"
    # startup blockers are removed even when supervised: the codex update
    # prompt stalls a fresh pane before the agent is usable at all
    assert tmux.spawn_launch_command("codex", autonomy="supervised") == CODEX_STARTUP
    assert tmux.spawn_launch_command("pi", autonomy="supervised") == "pi"
    assert tmux.spawn_launch_command("hermes", autonomy="supervised") == "hermes"


def test_known_model_appends_harness_flag():
    assert (
        tmux.spawn_launch_command("claude", "opus")
        == "claude --model opus --permission-mode bypassPermissions"
    )
    assert (
        tmux.spawn_launch_command("claude", "opus", autonomy="supervised")
        == "claude --model opus"
    )
    assert (
        tmux.spawn_launch_command("codex", "gpt-5.6-terra")
        == f"{CODEX_STARTUP} --model gpt-5.6-terra --ask-for-approval never --sandbox workspace-write"
    )
    # hermes uses -m rather than --model.
    tmux.HARNESS_SPAWN["hermes"].models.append("_probe")
    try:
        assert (
            tmux.spawn_launch_command("hermes", "_probe", autonomy="supervised")
            == "hermes -m _probe"
        )
    finally:
        tmux.HARNESS_SPAWN["hermes"].models.remove("_probe")


def test_pi_pattern_is_shell_quoted():
    # Leading ~ must be quoted so the shell does not tilde-expand it.
    cmd = tmux.spawn_launch_command("pi", "~anthropic/claude-opus-latest")
    assert cmd == "pi --model '~anthropic/claude-opus-latest'"


def test_unknown_model_falls_back_to_bare_binary():
    assert tmux.spawn_launch_command("claude", "not-a-real-model") == AUTO_CLAUDE
    assert tmux.spawn_launch_command("claude", "") == AUTO_CLAUDE


def test_unspawnable_flavor_returns_none():
    assert tmux.spawn_launch_command("generic") is None
    assert tmux.spawn_launch_command("nonsense") is None


def test_spawn_options_shape():
    opts = {o["flavor"]: o["models"] for o in tmux.spawn_options()}
    assert set(opts) == {"claude", "codex", "pi", "hermes"}
    assert opts["claude"] == ["opus", "sonnet", "haiku"]
    assert opts["codex"] == ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]


def test_live_model_commands_are_harness_specific():
    assert tmux.live_model_command("claude", "opus") == "/model opus"
    assert tmux.live_model_command("pi", "~openai/gpt-latest") == "/model ~openai/gpt-latest"
    assert tmux.live_model_command("hermes", "openrouter:openai/gpt-5") == "/model openrouter:openai/gpt-5"
    # Codex's /model opens its picker; arguments are sent as normal prompts.
    assert tmux.live_model_command("codex", None) == "/model"
    assert tmux.live_model_command("codex", "gpt-5") is None


def test_codex_live_model_picker_options_use_runtime_ids():
    options = {o["flavor"]: o for o in tmux.live_model_options()}
    codex = options["codex"]
    assert codex["models"] == ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]
    assert codex["efforts"] == ["low", "medium", "high", "xhigh", "max", "ultra"]
    assert codex["default_efforts"]["gpt-5.6-sol"] == "low"


def test_select_codex_model_drives_native_picker(monkeypatch):
    delivered = []
    keys = []
    monkeypatch.setattr(tmux, "deliver", lambda *args, **kwargs: (delivered.append((args, kwargs)) or (True, None)))
    monkeypatch.setattr(tmux, "_send_keys", lambda pane, *items: (keys.append((pane, items)) or (True, None)))
    monkeypatch.setattr(tmux.time, "sleep", lambda _: None)

    assert tmux.select_codex_model("0:1.0", "gpt-5.6-luna", "ultra") == (True, None)
    assert delivered == [(("0:1.0", "/model"), {"submit_key": "Enter", "flavor": "codex"})]
    assert keys == [
        ("0:1.0", ("Home", "Down", "Down", "Enter")),
        ("0:1.0", ("End", "Enter")),
        ("0:1.0", ("Home", "Down", "Enter")),
    ]


def test_select_codex_model_rejects_unknown_values():
    assert tmux.select_codex_model("0:1.0", "gpt-5.6", "medium") == (
        False, "unsupported Codex model or reasoning effort"
    )


def test_live_model_commands_reject_unknown_or_unsafe_values():
    assert tmux.live_model_command("claude", "not-a-model") is None
    assert tmux.live_model_command("hermes", "model\n/quit") is None
    assert tmux.live_model_command("generic", "anything") is None


def test_live_model_options_describe_direct_picker_and_custom_modes():
    opts = {o["flavor"]: o for o in tmux.live_model_options()}
    assert opts["claude"]["mode"] == "direct"
    assert opts["codex"]["mode"] == "picker"
    assert opts["hermes"]["mode"] == "custom"
