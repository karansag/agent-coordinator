import { html, render } from "htm/preact";
import { useEffect, useRef, useState } from "preact/hooks";

import {
  POLL_MS,
  PEEK_MS,
  JSONH,
  FLAVOR_ICON,
  STATE,
  agentStatus,
  ANIMAL_EMOJI,
  hue,
  rel,
  currentTask,
  pairKey,
  disp,
  focusHash,
  patchTask,
} from "./shared.js";
import { HiveView } from "./hive.js";
import "../styles.css";

function Avatar({ name, size }) {
  const base = name.replace(/-\d+$/, "");
  const emoji = ANIMAL_EMOJI[base];
  return html`<div class=${`hex ${size || ""}`} style=${`--hue: hsl(${hue(name)} 42% 58%)`}>
    ${emoji || html`<span class="mono2">${base.slice(0, 2)}</span>`}
  </div>`;
}

/* ---------- roster (right sidebar) ---------- */

function RosterChip({ r, state, team, selected, unread, ping, refresh }) {
  const [stopping, setStopping] = useState(false);
  const [crowning, setCrowning] = useState(false);
  const isQueen = !!team && team.queen === r.user_id;
  const task = currentTask(state.tasks, r.user_id);
  const flavor = (r.flavor || "generic").toLowerCase();
  const status = agentStatus(r);
  const st = STATE[status] || STATE.unknown;
  const detail = r.activity && r.activity.detail;
  const attention = status === "needs_attention";
  const sub = attention
    ? html`<span class="attn" title=${detail || "needs attention"}>${detail || "needs attention"}</span>`
    : task
      ? html`<span class="on">#${task.id}</span> ${task.title}`
      : html`<span class="stateword" style=${`color:${st.color}`}>${st.word}</span>`;
  const stop = async (e) => {
    e.stopPropagation();
    if (!confirm(`Stop ${r.user_id}? This will kill tmux pane ${r.tmux_pane}.`)) return;
    setStopping(true);
    const res = await fetch(`/agents/${encodeURIComponent(r.user_id)}/stop`, { method: "POST" });
    setStopping(false);
    if (res.ok) {
      // If we're viewing the agent we just stopped, leave its detail page
      // (its terminal can no longer be captured) for another running agent,
      // or the overview if none are left.
      if (selected) {
        const next = state.recipients.find(x => x.pane_alive && x.user_id !== r.user_id);
        location.hash = next ? focusHash(next.user_id) : "#/";
      }
      refresh();
    } else alert(`Could not stop ${r.user_id}.`);
  };
  const crown = async (e) => {
    e.stopPropagation();
    if (isQueen) {
      if (!confirm(`Remove ${r.user_id} as queen of ${team.name}?`)) return;
      setCrowning(true);
      await fetch(`/teams/${team.id}`, {
        method: "PATCH", headers: JSONH, body: JSON.stringify({ queen: null }),
      });
      setCrowning(false);
      refresh();
      return;
    }
    const raw = prompt(
      `Objective for ${r.user_id} as queen of ${team.name}?`,
      "Coordinate your team to execute the shared task board.",
    );
    if (raw === null) return;
    setCrowning(true);
    const res = await fetch(`/teams/${team.id}`, {
      method: "PATCH", headers: JSONH,
      body: JSON.stringify({ queen: r.user_id, objective: raw.trim() }),
    });
    setCrowning(false);
    if (!res.ok) alert(`Could not make ${r.user_id} queen.`);
    refresh();
  };
  const dragStart = (e) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-agent-msg-agent", r.user_id);
    e.dataTransfer.setData("text/plain", r.user_id);
  };
  return html`<div class=${`chip-card state-${st.cls} ${selected ? "sel" : ""} ${ping ? "ping" : ""}`}
      draggable="true" onDragStart=${dragStart}
      onClick=${() => { location.hash = selected ? "#/" : focusHash(r.user_id); }}>
    <${Avatar} name=${r.user_id} size="small" />
    <div class="who">
      <div class="nm">${r.user_id}${isQueen && html`<span class="crown" title="team queen">♛</span>`}<span class=${`status ${st.cls}`} title=${st.word}></span></div>
      <div class="sub">${sub}</div>
      <div class="tech" title=${`${flavor} · ${r.tmux_pane}`}><span class="flavor">${flavor}</span> · ${r.tmux_pane}</div>
    </div>
    <div class="controls">
      <span class="flav" title=${flavor}>${FLAVOR_ICON[flavor] || FLAVOR_ICON.generic}</span>
      ${team && r.pane_alive && html`<button type="button" class="queen-agent" disabled=${crowning}
        title=${isQueen ? `remove ${r.user_id} as queen` : `make ${r.user_id} queen of ${team.name}`}
        aria-label=${isQueen ? `Remove ${r.user_id} as queen` : `Make ${r.user_id} queen of ${team.name}`}
        onClick=${crown}>${crowning ? "…" : isQueen ? "♛ queen" : "♛"}</button>`}
      ${r.pane_alive && html`<button type="button" class="stop-agent" disabled=${stopping}
        title=${`stop ${r.user_id}`} onClick=${stop}>${stopping ? "stopping…" : "stop"}</button>`}
    </div>
    ${(unread || attention) && html`<span class="badge" title=${attention ? "needs attention" : "new messages"}></span>`}
  </div>`;
}

function SpawnControl({ refresh }) {
  const [flavor, setFlavor] = useState("claude");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const spawn = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch("/agents/spawn", {
      method: "POST", headers: JSONH, body: JSON.stringify({ flavor }),
    });
    if (!r.ok) setErr("spawn failed");
    setBusy(false);
    refresh();
  };
  return html`<form class="spawn" onSubmit=${spawn}>
    <select value=${flavor} onChange=${e => setFlavor(e.target.value)}>
      ${["claude", "codex", "generic"].map(f =>
        html`<option key=${f} value=${f}>${f}</option>`)}
    </select>
    <button class="act" type="submit" disabled=${busy}>${busy ? "spawning…" : "spawn agent"}</button>
    ${err && html`<span style="color:var(--alert); font-size:11px">${err}</span>`}
  </form>`;
}

const ACTIVITY_RANK = { working: 0, needs_attention: 1, idle: 2, unknown: 3 };
const AGENT_DRAG_TYPE = "application/x-agent-msg-agent";

function sortByActivity(agents) {
  return agents
    .map((r, i) => [r, i])
    .sort(([a, ai], [b, bi]) =>
      (ACTIVITY_RANK[agentStatus(a)] ?? 3) - (ACTIVITY_RANK[agentStatus(b)] ?? 3) || ai - bi)
    .map(([r]) => r);
}

async function moveAgentToTeam(user, teamId, refresh) {
  await fetch(`/agents/${encodeURIComponent(user)}/team`, {
    method: "POST", headers: JSONH, body: JSON.stringify({ team_id: teamId }),
  });
  refresh();
}

function agentDropProps(setOver, onDropUser) {
  return {
    onDragOver: (e) => {
      if (![...e.dataTransfer.types].includes(AGENT_DRAG_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setOver(true);
    },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); },
    onDrop: (e) => {
      e.preventDefault();
      setOver(false);
      const user = e.dataTransfer.getData(AGENT_DRAG_TYPE);
      if (user) onDropUser(user);
    },
  };
}

function TeamBox({ team, members, chip, refresh }) {
  const [over, setOver] = useState(false);
  const disband = async (e) => {
    e.stopPropagation();
    if (!confirm(`Disband team ${team.name}? Its agents keep running.`)) return;
    await fetch(`/teams/${team.id}`, { method: "DELETE" });
    refresh();
  };
  return html`<div class=${`teambox ${over ? "over" : ""}`}
      ...${agentDropProps(setOver, user => moveAgentToTeam(user, team.id, refresh))}>
    <div class="teamhead">
      <span class="teamname">${team.name}</span>
      ${team.queen
        ? html`<span class="queen-tag" title=${`queen: ${team.queen}`}>♛ ${team.queen}</span>`
        : html`<span class="queen-tag" style="opacity:.55">no queen</span>`}
      <button type="button" class="mini" title="disband team" onClick=${disband}>disband</button>
    </div>
    ${members.length === 0
      ? html`<div class="teamempty">drag agents here</div>`
      : members.map(chip)}
  </div>`;
}

function NewTeam({ refresh }) {
  const [name, setName] = useState("");
  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await fetch("/teams", {
      method: "POST", headers: JSONH, body: JSON.stringify({ name: name.trim() }),
    });
    setName("");
    refresh();
  };
  return html`<form class="newteam" onSubmit=${create}>
    <input type="text" placeholder="team name" value=${name}
      onInput=${e => setName(e.target.value)} />
    <button class="act" type="submit">new team</button>
  </form>`;
}

function Roster({ state, focusUser, unreadFor, pings, refresh }) {
  const [overUnteam, setOverUnteam] = useState(false);
  const teams = state.teams || [];
  const teamById = new Map(teams.map(t => [t.id, t]));
  const running = sortByActivity(state.recipients.filter(r => r.pane_alive));
  const stopped = state.recipients.filter(r => !r.pane_alive);
  const unteamed = running.filter(r => !teamById.has(r.team_id));
  const chip = (r) => html`<${RosterChip} key=${r.user_id} r=${r} state=${state}
    team=${teamById.get(r.team_id) || null}
    selected=${focusUser === r.user_id} unread=${unreadFor(r.user_id)}
    ping=${!!pings[r.user_id]} refresh=${refresh} />`;
  return html`<aside class="roster">
    <h2>agents ${running.length > 0 && html`<span class="count">· ${running.length}</span>`}</h2>
    ${teams.map(t => html`<${TeamBox} key=${t.id} team=${t} chip=${chip} refresh=${refresh}
      members=${running.filter(r => r.team_id === t.id)} />`)}
    <${NewTeam} refresh=${refresh} />
    <div class=${`unteam-drop ${overUnteam ? "over" : ""}`}
        ...${agentDropProps(setOverUnteam, user => moveAgentToTeam(user, null, refresh))}>
      ${teams.length > 0 && html`<div class="hint">no team · drop here to unteam</div>`}
      ${running.length === 0
        ? html`<div class="empty" style="padding:20px">No agents running.<br /><br />
            <code>agent-msg register</code></div>`
        : unteamed.map(chip)}
    </div>
    ${stopped.length > 0 && html`<details class="stopped">
      <summary>stopped · ${stopped.length}</summary>
      ${stopped.map(chip)}
    </details>`}
    <${SpawnControl} refresh=${refresh} />
  </aside>`;
}

/* ---------- overview mode ---------- */

function TaskCard({ t, agentIds, teams, blockers, refresh }) {
  const [dragging, setDragging] = useState(false);
  const when = new Date(t.created_at * 1000)
    .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const ids = t.assignee && !agentIds.includes(t.assignee)
    ? agentIds.concat(t.assignee) : agentIds;
  const act = async (p) => { await patchTask(t.id, p); refresh(); };
  const draggable = t.status !== "done";
  const blocked = blockers.length > 0 && t.status !== "done";
  const deps = t.depends_on || [];
  const dragStart = (e) => {
    if (!draggable) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-agent-msg-task", String(t.id));
    e.dataTransfer.setData("text/plain", String(t.id));
    setDragging(true);
  };
  const onAssign = (e) => {
    const v = e.target.value;
    if (v.startsWith("t:")) act({ team_id: Number(v.slice(2)) });
    else if (v) act({ assignee: v });
    else act({ assignee: null, team_id: null });
  };
  return html`<div class=${`tcard ${dragging ? "dragging" : ""} ${blocked ? "blocked" : ""}`} draggable=${draggable}
      onDragStart=${dragStart} onDragEnd=${() => setDragging(false)}
      title=${draggable ? "Drag this task onto a bee or team in the activity view to assign it" : "Reopen this task before assigning it by drag"}>
    <div class="t">${t.title}</div>
    <div class="meta">#${t.id} · created ${when}${deps.length > 0 ? ` · after ${deps.map(d => `#${d}`).join(" ")}` : ""}${t.description ? ` · ${t.description}` : ""}${t.worktree ? ` · worktree ${t.worktree}` : ""}</div>
    ${blocked && html`<div class="meta blocked-tag" title="dependencies not yet done">blocked by ${blockers.map(d => `#${d}`).join(" ")}</div>`}
    <div class="foot">
      <select title="assignee" value=${t.team_id ? `t:${t.team_id}` : (t.assignee || "")}
        onChange=${onAssign}>
        <option value="">unassigned</option>
        ${teams.length > 0 && html`<optgroup label="teams">
          ${teams.map(x => html`<option key=${`t:${x.id}`} value=${`t:${x.id}`}>team ${x.name}</option>`)}
        </optgroup>`}
        ${ids.map(a => html`<option key=${a} value=${a}>${a}${agentIds.includes(a) ? "" : " (stopped)"}</option>`)}
      </select>
      ${t.status === "done"
        ? html`<button class="mini" onClick=${() => act({ status: "open" })}>reopen</button>`
        : html`<button class="mini" onClick=${() => act({ status: "done" })}>done</button>`}
    </div>
  </div>`;
}

function Kanban({ state, refresh }) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const agentIds = state.recipients.filter(r => r.pane_alive).map(r => r.user_id);
  const teams = state.teams || [];
  const byId = new Map(state.tasks.map(t => [t.id, t]));
  const create = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const body = { title: title.trim() };
    if (assignee.startsWith("t:")) body.team_id = Number(assignee.slice(2));
    else if (assignee) body.assignee = assignee;
    await fetch("/tasks", { method: "POST", headers: JSONH, body: JSON.stringify(body) });
    setTitle("");
    refresh();
  };
  const cols = [
    ["open", "open"],
    ["picked_up", "picked up"],
    ["done", "done"],
  ];
  return html`<div>
    <h2>tasks ${state.tasks.length > 0 && html`<span class="count">· ${state.tasks.length}</span>`}</h2>
    <form class="newtask" onSubmit=${create}>
      <input type="text" placeholder="task title"
        value=${title} onInput=${e => setTitle(e.target.value)} />
      <select value=${assignee} onChange=${e => setAssignee(e.target.value)}>
        <option value="">unassigned</option>
        ${teams.length > 0 && html`<optgroup label="teams">
          ${teams.map(x => html`<option key=${`t:${x.id}`} value=${`t:${x.id}`}>team ${x.name}</option>`)}
        </optgroup>`}
        ${agentIds.map(a => html`<option key=${a} value=${a}>${a}</option>`)}
      </select>
      <button class="act" type="submit">create task</button>
    </form>
    <div class="board">
      ${cols.map(([status, label]) => {
        const items = state.tasks.filter(t => t.status === status);
        return html`<div key=${status} class=${`col ${status}`}>
          <div class="colhead">${label}<span class="n">${items.length}</span></div>
          <div class="cards">
            ${items.length === 0
              ? html`<div class="colempty">none</div>`
              : items.map(t => html`<${TaskCard} key=${t.id} t=${t}
                  agentIds=${agentIds} teams=${teams}
                  blockers=${(t.depends_on || []).filter(d => (byId.get(d) || {}).status !== "done")}
                  refresh=${refresh} />`)}
          </div>
        </div>`;
      })}
    </div>
  </div>`;
}

function Overview({ state, refresh }) {
  return html`<div>
    <h2>activity</h2>
    <${HiveView} state=${state} refresh=${refresh} />
    <${Kanban} state=${state} refresh=${refresh} />
  </div>`;
}

/* ---------- agent focus mode ---------- */

function Scope({ user, refresh }) {
  const [data, setData] = useState(null);
  const preRef = useRef(null);
  const pinned = useRef(true);
  useEffect(() => {
    let live = true;
    setData(null);
    const load = async () => {
      try {
        const r = await fetch(`/api/peek/${encodeURIComponent(user)}`);
        const d = await r.json();
        if (live) setData(d);
      } catch { /* next tick */ }
    };
    load();
    const t = setInterval(load, PEEK_MS);
    return () => { live = false; clearInterval(t); };
  }, [user]);
  useEffect(() => {
    const pre = preRef.current;
    if (pre && pinned.current) pre.scrollTop = pre.scrollHeight;
  }, [data]);
  const onScroll = (e) => {
    const el = e.target;
    pinned.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
  };
  return html`<div class="scope">
    <div class="bar">
      <span class="t">terminal</span>
      <span>${data ? data.tmux_pane : ""}</span>
      <span style="margin-left:auto">live capture · 2s</span>
    </div>
    ${data && data.error
      ? html`<div class="err">could not capture pane: ${data.error}</div>`
      : html`<pre ref=${preRef} onScroll=${onScroll}>${data
          ? ((data.text || "").replace(/\s+$/, "") || "(pane is blank)")
          : "capturing pane…"}</pre>`}
    <${MessageComposer} recipient=${user} refresh=${refresh} draftId="terminal" />
  </div>`;
}

function MessageComposer({ recipient, refresh, draftId = "thread" }) {
  const [text, setText] = useState("");
  const [context, setContext] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const composerRef = useRef(null);
  const draftKey = `agent-msg:draft:${recipient}:${draftId}`;
  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
      setText(draft?.text || "");
      setContext(draft?.context || "");
      setStatus("");
    } catch { /* an invalid saved draft should not block messaging */ }
  }, [draftKey]);
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);
  const send = async (e) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setStatus("");
    try {
      const r = await fetch("/owner/send", {
        method: "POST", headers: JSONH,
        body: JSON.stringify({ recipient, content, context: context.trim() || null }),
      });
      if (!r.ok) throw new Error("delivery failed");
      setText("");
      setContext("");
      localStorage.removeItem(draftKey);
      setStatus("delivered");
      setTimeout(() => setStatus(""), 2500);
      refresh();
    } catch {
      setStatus("delivery failed — draft kept");
    } finally {
      setSending(false);
    }
  };
  const updateText = (value) => {
    setText(value);
    localStorage.setItem(draftKey, JSON.stringify({ text: value, context }));
  };
  const updateContext = (value) => {
    setContext(value);
    localStorage.setItem(draftKey, JSON.stringify({ text, context: value }));
  };
  const clearDraft = () => {
    setText("");
    setContext("");
    setStatus("");
    localStorage.removeItem(draftKey);
    composerRef.current?.focus();
  };
  return html`<form class="composer" onSubmit=${send}>
    <div class="compose-row">
      <span class="mark">❯</span>
      <textarea ref=${composerRef} value=${text} rows="2"
        onInput=${e => updateText(e.target.value)}
        onKeyDown=${e => {
          if (e.key === "Enter" && !e.shiftKey && !(e.metaKey || e.ctrlKey)) send(e);
        }}
        placeholder=${`Message ${recipient}…`} aria-label=${`Message ${recipient} as owner`} />
    </div>
    <div class="compose-meta">
      <input class="context" type="text" value=${context} onInput=${e => updateContext(e.target.value)}
        placeholder="context tag (optional)" aria-label="Optional context tag" />
      <span class="count">${text.length} character${text.length === 1 ? "" : "s"}</span>
      <span class="hint">Enter to send · Shift + Enter for a new line</span>
      <div class="actions">
        ${status && html`<span class=${status.startsWith("delivery failed") ? "error" : "sent"} role="status">${status}</span>`}
        ${(text || context) && html`<button type="button" class="mini" onClick=${clearDraft}>clear</button>`}
        <button class="act" type="submit" disabled=${sending || !text.trim()}>
          ${sending ? "sending…" : "send"}
        </button>
      </div>
    </div>
  </form>`;
}

function Thread({ a, b, msgs, freshIds, now, refresh }) {
  const boxRef = useRef(null);
  const pinned = useRef(true);
  const resizeRef = useRef(null);
  const [historyHeight, setHistoryHeight] = useState(null);
  const recipient = a === "owner" ? b : b === "owner" ? a : null;
  useEffect(() => {
    const el = boxRef.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);
  const onScroll = (e) => {
    const el = e.target;
    pinned.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
  };
  const resizeBounds = () => ({ min: 120, max: Math.max(120, Math.floor(innerHeight * .85)) });
  const resizeTo = (height) => {
    const { min, max } = resizeBounds();
    setHistoryHeight(Math.max(min, Math.min(max, Math.round(height))));
  };
  const resizeStart = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeRef.current = { y: e.clientY, height: boxRef.current.getBoundingClientRect().height };
  };
  const resizeMove = (e) => {
    if (!resizeRef.current) return;
    resizeTo(resizeRef.current.height + e.clientY - resizeRef.current.y);
  };
  const resizeEnd = (e) => {
    if (!resizeRef.current) return;
    resizeRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const resizeKey = (e) => {
    const current = historyHeight ?? boxRef.current.getBoundingClientRect().height;
    const { min, max } = resizeBounds();
    const next = e.key === "ArrowUp" ? current - 40
      : e.key === "ArrowDown" ? current + 40
        : e.key === "Home" ? min
          : e.key === "End" ? max : null;
    if (next === null) return;
    e.preventDefault();
    resizeTo(next);
  };
  return html`<div class="thread">
    <div class="bar">${disp(a)} <span class="swap">⇄</span> ${disp(b)}
      <span class="n">${msgs.length} msg${msgs.length === 1 ? "" : "s"}</span></div>
    <div class="msgs" ref=${boxRef} onScroll=${onScroll}
      style=${historyHeight === null ? null : { height: `${historyHeight}px` }}>
      ${msgs.slice(-40).map(m => html`
        <div key=${m.id} class=${[
            "msg",
            m.sender === a ? "" : "right",
            freshIds.has(m.id) ? "fresh" : "",
            m.delivered ? "" : "failed",
            m.sender === "owner" ? "from-owner" : "",
          ].join(" ")}>
          <div class="bubble">${m.content}</div>
          <div class="tag">${disp(m.sender)}${m.context && html` · <span class="ctx">${m.context}</span>`} · ${rel(m.ts, now)}${!m.delivered && html` · <span class="ctx">undelivered${m.delivery_error ? `: ${m.delivery_error}` : ""}</span>`}</div>
        </div>`)}
    </div>
    <button type="button" class="history-resizer" role="separator" aria-orientation="horizontal"
      aria-label="Resize conversation history"
      aria-valuemin="120" aria-valuemax=${resizeBounds().max}
      aria-valuenow=${historyHeight ?? 340} title="Drag to resize conversation history"
      onPointerDown=${resizeStart} onPointerMove=${resizeMove}
      onPointerUp=${resizeEnd} onPointerCancel=${resizeEnd} onKeyDown=${resizeKey}>
      <span>drag to resize history</span>
    </button>
    ${recipient && html`<${MessageComposer} recipient=${recipient} refresh=${refresh} />`}
  </div>`;
}

function FocusView({ user, state, refresh, freshIds }) {
  const r = state.recipients.find(x => x.user_id === user);
  if (!r) return html`<div class="empty">No agent named "${user}".
    <br /><br /><button class="mini" onClick=${() => { location.hash = "#/"; }}>back to overview</button></div>`;
  const flavor = (r.flavor || "generic").toLowerCase();
  const status = agentStatus(r);
  const st = STATE[status] || STATE.unknown;
  const detail = r.activity && r.activity.detail;
  const myTasks = state.tasks.filter(t => t.assignee === user);
  const agentIds = state.recipients.filter(x => x.pane_alive).map(x => x.user_id);
  const taskIds = agentIds.includes(user) ? agentIds : agentIds.concat(user);
  const groups = new Map();
  for (const m of state.messages) {
    if (m.sender !== user && m.recipient !== user) continue;
    const k = pairKey(m.sender, m.recipient);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(m);
  }
  const threads = [...groups.values()]
    .sort((x, y) => y[y.length - 1].ts - x[x.length - 1].ts);
  const hasOwnerThread = threads.some(msgs =>
    msgs.some(m => m.sender === "owner" || m.recipient === "owner"));
  const act = async (id, p) => { await patchTask(id, p); refresh(); };
  return html`<div>
    <button type="button" class="focus-back" onClick=${() => { location.hash = "#/"; }}>← back to overview</button>
    <div class="fhead">
      <${Avatar} name=${user} />
      <div class="who">
        <div class="nm">${user}<span class=${`status ${st.cls}`} title=${st.word}></span></div>
        <div class="meta">
          <span class="chip">${FLAVOR_ICON[flavor] || FLAVOR_ICON.generic} ${flavor}</span>
          ${r.model && html` <b>${r.model}</b>`} · pane <b>${r.tmux_pane}</b>${r.pane_alive ? "" : " (stopped)"}
          · joined ${rel(r.registered_at, state.now)}
          · <span style=${`color:${st.color}`}>${st.word}</span>${status === "needs_attention" && detail ? html` <span class="attn">${detail}</span>` : ""}
        </div>
        ${r.instructions && html`<div class="inst">"${r.instructions}"</div>`}
      </div>
    </div>
    <${Scope} user=${user} refresh=${refresh} />
    <h2>conversations ${threads.length > 0 && html`<span class="count">· ${threads.length}</span>`}</h2>
    ${threads.length === 0
      ? html`<div class="thread"><div class="empty">Nothing yet. Start a conversation with ${user} below.</div>
          <${MessageComposer} recipient=${user} refresh=${refresh} /></div>`
      : threads.map(msgs => {
          const [a, b] = pairKey(msgs[0].sender, msgs[0].recipient).split(" ");
          return html`<${Thread} key=${pairKey(a, b)} a=${a} b=${b} msgs=${msgs}
            freshIds=${freshIds} now=${state.now} refresh=${refresh} />`;
        })}
    ${threads.length > 0 && !hasOwnerThread && html`<div class="thread" style="margin-top:14px">
      <div class="bar">${disp("owner")} <span class="swap">⇄</span> ${user}</div>
      <${MessageComposer} recipient=${user} refresh=${refresh} />
    </div>`}
    <h2 style="margin-top:26px">tasks ${myTasks.length > 0 && html`<span class="count">· ${myTasks.length}</span>`}</h2>
    ${myTasks.length === 0
      ? html`<div class="empty">No tasks assigned to ${user}. Assign one from the overview board.</div>`
      : myTasks.map(t => html`<div key=${t.id} class=${`trow ${t.status}`}>
          <span class="tid">#${t.id}</span>
          <span class="t">${t.title}</span>
          <span class=${`pill ${t.status}`}>${t.status.replace("_", " ")}</span>
          <select title="assignee" value=${t.assignee || ""}
            onChange=${e => act(t.id, { assignee: e.target.value })}>
            <option value="">unassigned</option>
            ${taskIds.map(a => html`<option key=${a} value=${a}>${a}${agentIds.includes(a) ? "" : " (stopped)"}</option>`)}
          </select>
          ${t.status === "done"
            ? html`<button class="mini" onClick=${() => act(t.id, { status: "open" })}>reopen</button>`
            : html`<button class="mini" onClick=${() => act(t.id, { status: "done" })}>done</button>`}
        </div>`)}
  </div>`;
}

/* ---------- app ---------- */

function App() {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(true);
  const [clock, setClock] = useState(new Date().toLocaleTimeString());
  const [route, setRoute] = useState(location.hash);
  const [freshIds, setFreshIds] = useState(new Set());
  const [pings, setPings] = useState({});
  const seen = useRef({ maxId: 0, first: true, byAgent: {} });

  const focusUser = route.startsWith("#/agent/")
    ? decodeURIComponent(route.slice("#/agent/".length)) : null;

  const poll = async () => {
    try {
      const r = await fetch("/api/state");
      const s = await r.json();
      const st = seen.current;
      const maxId = Math.max(st.maxId, ...s.messages.map(m => m.id), 0);
      const fresh = s.messages.filter(m => m.id > st.maxId);
      if (!st.first && fresh.length) {
        setFreshIds(new Set(fresh.map(m => m.id)));
        setPings(Object.fromEntries(fresh.flatMap(m => [[m.sender, 1], [m.recipient, 1]])));
        setTimeout(() => setPings({}), 1000);
      }
      for (const rec of s.recipients) {
        if (st.first || !(rec.user_id in st.byAgent)) st.byAgent[rec.user_id] = maxId;
      }
      st.maxId = maxId;
      st.first = false;
      setState(s);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  };
  useEffect(() => {
    poll();
    const t = setInterval(poll, POLL_MS);
    const c = setInterval(() => setClock(new Date().toLocaleTimeString()), 1000);
    const onHash = () => setRoute(location.hash);
    const onKey = (e) => {
      if (e.key === "Escape" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) {
        location.hash = "#/";
      }
    };
    addEventListener("hashchange", onHash);
    addEventListener("keydown", onKey);
    return () => {
      clearInterval(t); clearInterval(c);
      removeEventListener("hashchange", onHash);
      removeEventListener("keydown", onKey);
    };
  }, []);

  // messages involving the focused agent count as read
  if (focusUser && seen.current.byAgent[focusUser] !== undefined) {
    seen.current.byAgent[focusUser] = seen.current.maxId;
  }
  const unreadFor = (u) => {
    if (!state || u === focusUser) return false;
    const since = seen.current.byAgent[u] ?? seen.current.maxId;
    return state.messages.some(m => m.id > since && (m.sender === u || m.recipient === u));
  };

  const header = html`<header class="top">
    <h1 style="cursor:pointer" onClick=${() => { location.hash = "#/"; }}>agent dashboard</h1>
    <span class="sub">agent-msg</span>
    <div class="right">
      <span><span class=${`beacon ${connected ? "" : "down"}`}></span>${connected ? "watching" : "server unreachable"}</span>
      <span>${clock}</span>
    </div>
  </header>`;

  if (!state) return html`${header}<main><div class="stage"><div class="empty">connecting…</div></div></main>`;

  return html`${header}
  <main>
    <div class="stage">
      ${focusUser
        ? html`<${FocusView} user=${focusUser} state=${state} refresh=${poll} freshIds=${freshIds} />`
        : html`<${Overview} state=${state} refresh=${poll} />`}
    </div>
    <${Roster} state=${state} focusUser=${focusUser} unreadFor=${unreadFor}
      pings=${pings} refresh=${poll} />
  </main>`;
}

render(html`<${App} />`, document.getElementById("app"));
