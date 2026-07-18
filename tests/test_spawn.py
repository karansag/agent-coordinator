"""Pure tests for the harness spawn command builder."""

from agent_msg import tmux


def test_bare_binary_when_no_model():
    assert tmux.spawn_launch_command("claude") == "claude"
    assert tmux.spawn_launch_command("codex") == "codex"
    assert tmux.spawn_launch_command("pi") == "pi"
    assert tmux.spawn_launch_command("hermes") == "hermes"


def test_known_model_appends_harness_flag():
    assert tmux.spawn_launch_command("claude", "opus") == "claude --model opus"
    assert tmux.spawn_launch_command("codex", "gpt-5") == "codex --model gpt-5"
    # hermes uses -m rather than --model.
    tmux.HARNESS_SPAWN["hermes"].models.append("_probe")
    try:
        assert tmux.spawn_launch_command("hermes", "_probe") == "hermes -m _probe"
    finally:
        tmux.HARNESS_SPAWN["hermes"].models.remove("_probe")


def test_pi_pattern_is_shell_quoted():
    # Leading ~ must be quoted so the shell does not tilde-expand it.
    cmd = tmux.spawn_launch_command("pi", "~anthropic/claude-opus-latest")
    assert cmd == "pi --model '~anthropic/claude-opus-latest'"


def test_unknown_model_falls_back_to_bare_binary():
    assert tmux.spawn_launch_command("claude", "not-a-real-model") == "claude"
    assert tmux.spawn_launch_command("claude", "") == "claude"


def test_unspawnable_flavor_returns_none():
    assert tmux.spawn_launch_command("generic") is None
    assert tmux.spawn_launch_command("nonsense") is None


def test_spawn_options_shape():
    opts = {o["flavor"]: o["models"] for o in tmux.spawn_options()}
    assert set(opts) == {"claude", "codex", "pi", "hermes"}
    assert opts["claude"] == ["opus", "sonnet", "haiku"]
