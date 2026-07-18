import { html } from "htm/preact";

export const POLL_MS = 2000;
export const PEEK_MS = 2000;
export const JSONH = { "content-type": "application/json" };

export const FLAVOR_ICON = { claude: "✳", codex: "◇", pi: "π", hermes: "☿", generic: "▪" };

// Harness identity has its own palette and glyph so it remains distinct from
// activity state (green/amber/red) and is never communicated by color alone.
export const HARNESSES = Object.freeze({
  claude:  { key: "claude",  label: "Claude",  color: "#d8905f", mark: "✳" },
  codex:   { key: "codex",   label: "Codex",   color: "#56b4e9", mark: "◇" },
  pi:      { key: "pi",      label: "Pi",      color: "#cc79a7", mark: "π" },
  hermes:  { key: "hermes",  label: "Hermes",  color: "#e5c14f", mark: "☿" },
  generic: { key: "generic", label: "Generic", color: "#9aa1a8", mark: "▪" },
});

export function harnessStyle(flavor) {
  return HARNESSES[String(flavor || "generic").toLowerCase()] || HARNESSES.generic;
}

// Activity state -> dot class, display word, and color. One color per
// state, matching the --state-* CSS custom properties.
export const STATE = {
  working:         { cls: "working",   word: "working",         color: "var(--state-working)" },
  needs_attention: { cls: "attention", word: "needs attention", color: "var(--state-attention)" },
  idle:            { cls: "idle",      word: "idle",            color: "var(--state-idle)" },
  unknown:         { cls: "unknown",   word: "unknown",         color: "var(--state-unknown)" },
  stopped:         { cls: "stopped",   word: "stopped",         color: "var(--state-stopped)" },
};
// Prefer the monitor's classification; fall back to raw liveness before it
// has data (a dead pane still reads "stopped", a live one "unknown").
export function agentStatus(r) {
  if (!r.pane_alive) return "stopped";
  const s = r.activity && r.activity.status;
  if (s && s !== "unknown") return s;
  return "unknown";
}
export const ANIMAL_EMOJI = {
  otter: "\u{1F9A6}", badger: "\u{1F9A1}", panda: "\u{1F43C}", raccoon: "\u{1F99D}",
  hedgehog: "\u{1F994}", viper: "\u{1F40D}", gecko: "\u{1F98E}", newt: "\u{1F98E}",
  salamander: "\u{1F98E}", capybara: "\u{1F9AB}", manatee: "\u{1F9AD}", lemur: "\u{1F412}",
  kestrel: "\u{1F985}", magpie: "\u{1F426}\u{200D}⬛", ibis: "\u{1F9A9}", heron: "\u{1FABF}",
  puffin: "\u{1F427}", narwhal: "\u{1F433}", axolotl: "\u{1F41F}", quokka: "\u{1F428}",
  wombat: "\u{1F428}", dormouse: "\u{1F401}", shrew: "\u{1F401}", fennec: "\u{1F98A}",
  mongoose: "\u{1F9A6}", stoat: "\u{1F9A6}", marten: "\u{1F9A6}", ferret: "\u{1F9A6}",
  ocelot: "\u{1F406}", pangolin: "\u{1F98E}", tapir: "\u{1F417}", civet: "\u{1F431}",
};

export function hue(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.codePointAt(0)) % 360;
  return h;
}
export function rel(ts, now) {
  const d = Math.max(0, now - ts);
  if (d < 50) return "just now";
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
}
export function currentTask(tasks, user) {
  const mine = (tasks || []).filter(t => t.assignee === user && t.status !== "done");
  if (!mine.length) return null;
  const picked = mine.filter(t => t.status === "picked_up");
  return (picked.length ? picked : mine).sort((a, b) => b.updated_at - a.updated_at)[0];
}
export function pairKey(a, b) { return [a, b].sort().join(" "); }
export const disp = (u) => u === "owner" ? html`<span class="owner-name">owner</span>` : u;
export const focusHash = (u) => `#/agent/${encodeURIComponent(u)}`;

export async function patchTask(id, patch) {
  await fetch(`/tasks/${id}`, { method: "PATCH", headers: JSONH, body: JSON.stringify(patch) });
}
