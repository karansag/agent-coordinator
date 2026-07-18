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
        tmux.spawn_launch_command("codex", "gpt-5")
        == f"{CODEX_STARTUP} --model gpt-5 --ask-for-approval never --sandbox workspace-write"
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
