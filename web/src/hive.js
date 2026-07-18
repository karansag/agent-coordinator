import { html } from "htm/preact";
import { useEffect, useRef, useState } from "preact/hooks";

import { HARNESSES, JSONH, focusHash, harnessStyle, hue } from "./shared.js";

export function HiveView({ state, refresh }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(state);
  const beesRef = useRef(new Map());
  const streaksRef = useRef([]);
  const pendingRef = useRef([]);
  const lastSeenRef = useRef(null);
  const hoverRef = useRef(null);
  const taskHoverRef = useRef(null);
  const taskCellsRef = useRef([]);
  const taskStatusesRef = useRef(null);
  const pendingShipmentsRef = useRef([]);
  const shipmentsRef = useRef([]);
  const dragTaskRef = useRef(null);
  const dragBeeRef = useRef(null);
  const dragPointRef = useRef(null);
  const dropTargetRef = useRef(null);
  const dropTeamRef = useRef(null);
  const dragBoxRef = useRef(null);
  const teamBoxesRef = useRef([]);
  const drawRef = useRef(null);
  const [dropStatus, setDropStatus] = useState("");
  stateRef.current = state;
  const liveHarnessKeys = new Set((state.recipients || [])
    .filter(r => r.pane_alive)
    .map(r => harnessStyle(r.flavor).key));
  const liveHarnesses = Object.values(HARNESSES)
    .filter(harness => liveHarnessKeys.has(harness.key));

  const messages = state.messages || [];
  const maxId = Math.max(0, ...messages.map(m => m.id));
  if (lastSeenRef.current === null) lastSeenRef.current = maxId;
  else if (maxId > lastSeenRef.current) {
    pendingRef.current.push(...messages.filter(m => m.id > lastSeenRef.current).slice(-8));
    lastSeenRef.current = maxId;
  }
  const taskSnapshot = new Map((state.tasks || []).map(t => [t.id, t]));
  if (taskStatusesRef.current === null) taskStatusesRef.current = taskSnapshot;
  else {
    for (const task of state.tasks || []) {
      const before = taskStatusesRef.current.get(task.id);
      if (before && before.status !== "done" && task.status === "done")
        pendingShipmentsRef.current.push(task);
    }
    taskStatusesRef.current = taskSnapshot;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let cssWidth = 0;
    let lastDraw = 0;

    // Owner-placed team box positions, kept across reloads.
    const POS_KEY = "agent-msg-hive-team-pos";
    const teamPos = new Map();
    try {
      for (const [k, v] of Object.entries(JSON.parse(localStorage.getItem(POS_KEY) || "{}")))
        if (v && Number.isFinite(v.x) && Number.isFinite(v.y))
          teamPos.set(Number(k), { x: v.x, y: v.y });
    } catch { /* start unplaced */ }
    const savePos = () => {
      const known = new Set((stateRef.current.teams || []).map(t => t.id));
      const obj = {};
      for (const [id, p] of teamPos)
        if (known.has(id)) obj[id] = { x: Math.round(p.x), y: Math.round(p.y) };
      try { localStorage.setItem(POS_KEY, JSON.stringify(obj)); } catch { /* session only */ }
    };

    const hex = (x, y, radius, fill, stroke) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        const px = x + Math.cos(a) * radius;
        const py = y + Math.sin(a) * radius;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke();
    };
    const token = (task, x, y) => {
      hex(x, y, 8, "rgba(242,169,59,.15)", "#b97f27");
      ctx.fillStyle = "#f2a93b"; ctx.font = "8px ui-monospace, monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(`#${task.id}`, x, y + .5);
    };
    const ensureSize = () => {
      const width = Math.max(1, canvas.clientWidth);
      const dpr = devicePixelRatio || 1;
      if (width !== cssWidth || canvas.width !== Math.round(width * dpr)) {
        cssWidth = width;
        canvas.width = Math.round(width * dpr); canvas.height = Math.round(260 * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return width;
    };
    const point = (a, b, c, u) => {
      const v = 1 - u;
      return { x: v*v*a.x + 2*v*u*c.x + u*u*b.x,
        y: v*v*a.y + 2*v*u*c.y + u*u*b.y };
    };
    const draw = (now, still = false) => {
      const width = ensureSize();
      const data = stateRef.current;
      const running = (data.recipients || []).filter(r => r.pane_alive);
      const live = new Set(running.map(r => r.user_id));
      const bees = beesRef.current;
      for (const name of bees.keys()) if (!live.has(name)) bees.delete(name);
      ctx.clearRect(0, 0, width, 260);

      const center = { x: width / 2, y: 118 };
      const ownerNode = { x: width / 2, y: 235 };
      const done = (data.tasks || []).filter(t => t.status === "done").length;
      const doneX = width - 28;
      hex(doneX - 7, 34, 11, "rgba(143,191,111,.07)", "#567546");
      hex(doneX, 28, 14, "rgba(143,191,111,.15)", "#8fbf6f");
      ctx.fillStyle = "#8fbf6f"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText(`shipped · ${done}`, doneX - 24, 28);

      // Teams: teammates cluster together on the flight ellipse; each team
      // gets a labeled outline that is also a drop target for bees and tasks.
      const teamsList = data.teams || [];
      const teamById = new Map(teamsList.map(t => [t.id, t]));
      const teamColor = (name, alpha) => `hsl(${hue(name)} 45% 62% / ${alpha})`;
      const grouped = [...running].sort((a, b) =>
        (a.team_id && teamById.has(a.team_id) ? a.team_id : 1e9) -
        (b.team_id && teamById.has(b.team_id) ? b.team_id : 1e9));
      // A team the owner has dragged into place anchors its bees in a
      // compact grid there; everyone else flies the shared ellipse.
      const positioned = new Set([...teamPos.keys()].filter(id => teamById.has(id)));
      const posOf = (id) => {
        const p = teamPos.get(id);
        return { x: Math.max(56, Math.min(width - 56, p.x)),
          y: Math.max(58, Math.min(202, p.y)) };
      };
      const clusterCount = new Map();
      for (const r of grouped)
        if (r.team_id && positioned.has(r.team_id))
          clusterCount.set(r.team_id, (clusterCount.get(r.team_id) || 0) + 1);
      const looseList = grouped.filter(r => !(r.team_id && positioned.has(r.team_id)));
      const looseIndex = new Map(looseList.map((r, i) => [r.user_id, i]));
      const clusterSeen = new Map();
      const homes = grouped.map(r => {
        if (r.team_id && positioned.has(r.team_id)) {
          const pos = posOf(r.team_id);
          const count = clusterCount.get(r.team_id);
          const j = clusterSeen.get(r.team_id) || 0;
          clusterSeen.set(r.team_id, j + 1);
          const cols = Math.min(3, count);
          const rows = Math.ceil(count / cols);
          const row = Math.floor(j / cols);
          const inRow = row === rows - 1 ? count - row * cols : cols;
          return { x: pos.x + ((j % cols) - (inRow - 1) / 2) * 58,
            y: pos.y + (row - (rows - 1) / 2) * 46 };
        }
        const i = looseIndex.get(r.user_id);
        const angle = Math.PI + (i / Math.max(1, looseList.length)) * Math.PI * 2;
        return { x: center.x + Math.cos(angle) * Math.min(width * .36, 330),
          y: 132 + Math.sin(angle) * 67 };
      });
      teamBoxesRef.current = [];
      {
        const bounds = new Map();
        grouped.forEach((r, i) => {
          if (!r.team_id || !teamById.has(r.team_id)) return;
          const h = homes[i];
          const b = bounds.get(r.team_id) || { minX: h.x, maxX: h.x, minY: h.y, maxY: h.y };
          b.minX = Math.min(b.minX, h.x); b.maxX = Math.max(b.maxX, h.x);
          b.minY = Math.min(b.minY, h.y); b.maxY = Math.max(b.maxY, h.y);
          bounds.set(r.team_id, b);
        });
        let emptyX = 12;
        for (const t of teamsList) {
          const b = bounds.get(t.id);
          const pos = positioned.has(t.id) ? posOf(t.id) : null;
          const box = b
            ? { x: b.minX - 44, y: b.minY - 40, w: b.maxX - b.minX + 88, h: b.maxY - b.minY + 90 }
            : pos
              ? { x: pos.x - 47, y: pos.y - 22, w: 94, h: 44 }
              : { x: emptyX, y: 28, w: 94, h: 44 };
          if (!b && !pos) emptyX += 104;
          box.x = Math.max(4, box.x); box.y = Math.max(24, box.y);
          box.w = Math.min(box.w, width - box.x - 4);
          box.h = Math.min(box.h, 254 - box.y);
          teamBoxesRef.current.push({ id: t.id, name: t.name, queen: t.queen, ...box });
        }
        const draggingSomething = dragTaskRef.current !== null || dragBeeRef.current;
        for (const box of teamBoxesRef.current) {
          const over = draggingSomething && dropTeamRef.current === box.id;
          const moving = dragBoxRef.current === box.id;
          ctx.save();
          ctx.strokeStyle = teamColor(box.name, over || moving ? .95 : .4);
          ctx.lineWidth = over || moving ? 2 : 1;
          ctx.setLineDash(over || moving ? [] : [5, 4]);
          ctx.beginPath(); ctx.roundRect(box.x, box.y, box.w, box.h, 12); ctx.stroke();
          if (over || moving) {
            ctx.fillStyle = teamColor(box.name, over ? .08 : .05);
            ctx.beginPath(); ctx.roundRect(box.x, box.y, box.w, box.h, 12); ctx.fill();
          }
          ctx.restore();
          ctx.fillStyle = teamColor(box.name, .95);
          ctx.font = "9px ui-monospace, monospace";
          ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
          ctx.fillText(box.queen ? `${box.name} · ♛ ${box.queen}` : box.name,
            box.x + 8, box.y + 11);
        }
      }

      const waiting = (data.tasks || []).filter(t =>
        t.status !== "done" && (!t.assignee || !live.has(t.assignee)));
      const carriedCount = (data.tasks || []).filter(t =>
        t.status !== "done" && t.assignee && live.has(t.assignee)).length;
      const visible = waiting.slice(0, 15);
      const cols = Math.min(5, Math.max(1, Math.ceil(Math.sqrt(visible.length || 1))));
      const rows = Math.ceil(visible.length / cols);
      const cellX = 38, cellY = 34;
      taskCellsRef.current = [];
      if (dragTaskRef.current === null && !dragBeeRef.current && dragBoxRef.current === null) {
        ctx.fillStyle = "#a89878"; ctx.font = "10px ui-monospace, monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(`task comb · ${waiting.length} waiting · ${carriedCount} carried`, center.x, 17);
      }
      const doneIds = new Set((data.tasks || [])
        .filter(t => t.status === "done").map(t => t.id));
      visible.forEach((task, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const x = center.x + (col - (cols - 1) / 2) * cellX;
        const y = center.y - ((rows - 1) * cellY) / 2 + row * cellY + (col % 2 ? cellY / 2 : 0);
        const stranded = task.assignee && !live.has(task.assignee);
        const team = (task.team_id && teamById.get(task.team_id)) || null;
        const blocked = (task.depends_on || []).some(d => !doneIds.has(d));
        taskCellsRef.current.push({ x, y, task, stranded, team, blocked });
      });
      // dependency edges, drawn under the cells they connect
      const cellById = new Map(taskCellsRef.current.map(c => [c.task.id, c]));
      ctx.save(); ctx.strokeStyle = "rgba(242,169,59,.3)"; ctx.lineWidth = 1;
      for (const cell of taskCellsRef.current)
        for (const dep of cell.task.depends_on || []) {
          const from = cellById.get(dep);
          if (!from) continue;
          ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(cell.x, cell.y); ctx.stroke();
        }
      ctx.restore();
      for (const cell of taskCellsRef.current) {
        const { x, y, task, stranded, team, blocked } = cell;
        const lifted = dragPointRef.current && dragTaskRef.current === task.id;
        if (lifted) ctx.globalAlpha = .3;
        ctx.save();
        if (blocked) ctx.setLineDash([3, 3]);
        hex(x, y, 18,
          stranded ? "rgba(224,108,85,.10)" : team ? teamColor(team.name, .12) : "rgba(242,169,59,.12)",
          stranded ? "#e06c55" : team ? teamColor(team.name, .8) : "#b97f27");
        ctx.restore();
        ctx.fillStyle = stranded ? "#e06c55" : "#f2a93b";
        ctx.font = "9px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(`#${task.id}`, x, y + .5);
        if (lifted) ctx.globalAlpha = 1;
      }
      if (waiting.length > visible.length) {
        ctx.fillStyle = "#a89878"; ctx.font = "9px ui-monospace, monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(`+${waiting.length - visible.length} more`, center.x, 202);
      }

      hex(ownerNode.x, ownerNode.y, 8, "rgba(242,169,59,.09)", "#b97f27");
      ctx.fillStyle = "#f2a93b"; ctx.font = "9px ui-monospace, monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText("owner", ownerNode.x, 253);

      const beeData = grouped.map((r, i) => {
        const name = r.user_id;
        const seed = hue(name);
        const harness = harnessStyle(r.flavor);
        const mine = (data.tasks || []).filter(t => t.assignee === name && t.status !== "done")
          .sort((a, b) => (a.status === "picked_up" ? -1 : 1) - (b.status === "picked_up" ? -1 : 1)
            || b.updated_at - a.updated_at);
        const picked = mine.find(t => t.status === "picked_up");
        const assigned = !picked && mine.find(t => t.status === "open");
        const primary = picked || assigned;
        const extras = mine.filter(t => !primary || t.id !== primary.id);
        const phase = seed / 57;
        const working = r.activity && r.activity.status === "working";
        const busy = !!picked || working;
        const speed = busy ? 2.5 : 1;
        const clustered = r.team_id && positioned.has(r.team_id);
        const amp = (busy ? 26 : 18) * (clustered ? .55 : 1);
        const q = still ? 0 : now / 8000 * Math.PI * 2 * speed + phase;
        const x = homes[i].x + (still ? 0 : Math.sin(q) * amp);
        const y = homes[i].y + (still ? 0 : Math.sin(q * 1.7 + phase) * amp * .55);
        const dx = still ? 1 : Math.cos(q);
        const dy = still ? 0 : Math.cos(q * 1.7 + phase) * .94;
        return { r, name, seed, harness, x, y, dx, dy, q, picked, assigned, primary, extras, working, busy };
      });
      // Boundary collision: a bee never sits inside a team box it doesn't
      // belong to — it gets nudged out through the nearest edge.
      for (const bee of beeData) {
        for (const box of teamBoxesRef.current) {
          if (bee.r.team_id === box.id) continue;
          const m = 14;
          if (bee.x <= box.x - m || bee.x >= box.x + box.w + m ||
              bee.y <= box.y - m || bee.y >= box.y + box.h + m) continue;
          const edges = [
            { d: bee.x - (box.x - m), x: box.x - m, y: bee.y },
            { d: box.x + box.w + m - bee.x, x: box.x + box.w + m, y: bee.y },
            { d: bee.y - (box.y - m), x: bee.x, y: box.y - m },
            { d: box.y + box.h + m - bee.y, x: bee.x, y: box.y + box.h + m },
          ];
          const out = edges.reduce((a, b) => (a.d <= b.d ? a : b));
          bee.x = out.x; bee.y = out.y;
        }
        bee.x = Math.max(16, Math.min(width - 16, bee.x));
        bee.y = Math.max(34, Math.min(244, bee.y));
      }
      for (const bee of beeData) {
        const { r, name, harness, x, y, dx, dy, q, picked, assigned, primary, extras, working, busy } = bee;
        bees.set(name, { x, y, task: primary, harness: harness.key });
        if (assigned) token(assigned, x + 22, y + Math.sin(q * .8) * 3);

        const bearing = Math.atan2(dy, dx);
        ctx.save(); ctx.translate(x, y); ctx.rotate(bearing);
        if (working) {
          ctx.fillStyle = "rgba(143,191,111,.25)";
          ctx.beginPath(); ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2); ctx.fill();
        }
        const flap = still ? 0 : Math.sin(now / 1000 * (busy ? 44 : 30)) * .35;
        ctx.fillStyle = "rgba(240,230,210,.5)";
        ctx.beginPath(); ctx.ellipse(-2, -7, 6, 3, -.45 - flap, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-2, 7, 6, 3, .45 + flap, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = harness.color;
        ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(22,18,12,.5)";
        ctx.fillRect(-4, -6, 2.5, 12); ctx.fillRect(2, -6, 2.5, 12);
        ctx.fillStyle = "#16120c"; ctx.beginPath(); ctx.arc(11, 0, 3.5, 0, Math.PI * 2); ctx.fill();
        // An upright harness plate makes the flavor readable without relying
        // on body color, even while the bee banks around its flight path.
        ctx.rotate(-bearing);
        ctx.fillStyle = "rgba(22,18,12,.88)";
        ctx.beginPath(); ctx.roundRect(-4.5, -4.5, 9, 9, 2); ctx.fill();
        ctx.strokeStyle = harness.color; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = "#f0e6d2"; ctx.font = "bold 7px ui-monospace, monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(harness.mark, 0, .5);
        ctx.restore();
        if (picked) token(picked, x, y + 16);
        extras.slice(0, 4).forEach((task, j) => {
          const a = -1.15 + j * .75;
          token(task, x + Math.cos(a) * 25, y + Math.sin(a) * 22);
        });
        if (extras.length > 4) {
          ctx.fillStyle = "#a89878"; ctx.font = "8px ui-monospace, monospace";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(`+${extras.length - 4}`, x + 29, y + 12);
        }
        ctx.fillStyle = "#a89878"; ctx.font = "10px ui-monospace, monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.fillText(name, x, y + (picked ? 35 : 19));
        const attention = r.activity && r.activity.status === "needs_attention";
        if (attention) {
          ctx.fillStyle = "#f2a93b"; ctx.font = "bold 13px ui-monospace, monospace";
          ctx.textBaseline = "alphabetic"; ctx.fillText("!", x, y - 14);
        }
        const myTeam = (r.team_id && teamById.get(r.team_id)) || null;
        if (myTeam && myTeam.queen === name) {
          ctx.fillStyle = "#f2a93b"; ctx.font = "11px ui-monospace, monospace";
          ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
          ctx.fillText("♛", x, y - (attention ? 26 : 14));
        }
      }

      if (dragTaskRef.current !== null && dragPointRef.current) {
        const dragged = (data.tasks || []).find(t => t.id === dragTaskRef.current);
        if (dragged) token(dragged, dragPointRef.current.x, dragPointRef.current.y);
      }
      const dragBee = dragBeeRef.current && bees.get(dragBeeRef.current);
      if (dragBee && dragPointRef.current) {
        const p = dragPointRef.current;
        const draggedRecipient = grouped.find(r => r.user_id === dragBeeRef.current);
        const draggedHarness = harnessStyle(draggedRecipient && draggedRecipient.flavor);
        ctx.save(); ctx.strokeStyle = "rgba(240,230,210,.3)"; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(dragBee.x, dragBee.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.restore();
        ctx.save(); ctx.globalAlpha = .85;
        ctx.fillStyle = draggedHarness.color;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(22,18,12,.5)";
        ctx.fillRect(p.x - 4, p.y - 6, 2.5, 12); ctx.fillRect(p.x + 2, p.y - 6, 2.5, 12);
        ctx.restore();
      }
      const dropLabel = (label, ax, ay) => {
        ctx.font = "11px ui-monospace, monospace";
        const labelW = ctx.measureText(label).width + 14;
        const lx = Math.max(5, Math.min(width - labelW - 5, ax - labelW / 2));
        const ly = Math.max(5, ay);
        ctx.fillStyle = "#241c11"; ctx.beginPath(); ctx.roundRect(lx, ly, labelW, 21, 6); ctx.fill();
        ctx.strokeStyle = "#f2a93b"; ctx.stroke();
        ctx.fillStyle = "#f0e6d2"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(label, lx + 7, ly + 11);
      };
      const banner = (text) => {
        ctx.fillStyle = "#f2a93b"; ctx.font = "11px ui-monospace, monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.fillText(text, width / 2, 18);
      };
      const targetBox = dropTeamRef.current != null &&
        teamBoxesRef.current.find(b => b.id === dropTeamRef.current);
      const dropTarget = dropTargetRef.current && bees.get(dropTargetRef.current);
      if (dragTaskRef.current && dropTarget) {
        ctx.save();
        ctx.strokeStyle = "#f2a93b"; ctx.lineWidth = 2;
        ctx.shadowColor = "rgba(242,169,59,.8)"; ctx.shadowBlur = 13;
        ctx.beginPath(); ctx.arc(dropTarget.x, dropTarget.y, 24, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        dropLabel(`assign #${dragTaskRef.current} to ${dropTargetRef.current}`,
          dropTarget.x, Math.max(5, dropTarget.y - 43));
      } else if (dragTaskRef.current && targetBox) {
        dropLabel(`assign #${dragTaskRef.current} to team ${targetBox.name}`,
          targetBox.x + targetBox.w / 2, Math.max(5, targetBox.y - 26));
      } else if (dragTaskRef.current) {
        banner(`drop task #${dragTaskRef.current} on a bee or a team`);
      } else if (dragBeeRef.current && targetBox) {
        dropLabel(`move ${dragBeeRef.current} to team ${targetBox.name}`,
          targetBox.x + targetBox.w / 2, Math.max(5, targetBox.y - 26));
      } else if (dragBeeRef.current) {
        const r = grouped.find(x => x.user_id === dragBeeRef.current);
        const home = r && r.team_id && teamById.get(r.team_id);
        banner(home
          ? `release to take ${dragBeeRef.current} out of team ${home.name}`
          : `drop ${dragBeeRef.current} on a team`);
      } else if (dragBoxRef.current !== null) {
        const moving = teamBoxesRef.current.find(b => b.id === dragBoxRef.current);
        if (moving) banner(`release to place team ${moving.name}`);
      }

      const endpoint = (name) => name === "owner" ? ownerNode : (bees.get(name) || ownerNode);
      if (!still && pendingRef.current.length) {
        const born = now;
        streaksRef.current.push(...pendingRef.current.splice(0, 8).map(m => ({
          born, a: { ...endpoint(m.sender) }, b: { ...endpoint(m.recipient) }, id: m.id,
        })));
      } else if (still) pendingRef.current.length = 0;
      streaksRef.current = streaksRef.current.filter(s => now - s.born < 900);
      if (!still) for (const s of streaksRef.current) {
        const u = Math.min(1, (now - s.born) / 900);
        const c = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 - 40 };
        for (let i = 9; i >= 0; i--) {
          const p = point(s.a, s.b, c, Math.max(0, u - i * .025));
          ctx.fillStyle = `rgba(242,169,59,${(10-i) / 13})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, i ? 1.2 : 2.5, 0, Math.PI * 2); ctx.fill();
        }
      }

      if (!still && pendingShipmentsRef.current.length) {
        const born = now;
        shipmentsRef.current.push(...pendingShipmentsRef.current.splice(0).map(task => ({
          born, task, a: { ...(bees.get(task.assignee) || ownerNode) },
          b: { x: doneX, y: 28 },
        })));
      } else if (still) pendingShipmentsRef.current.length = 0;
      shipmentsRef.current = shipmentsRef.current.filter(s => now - s.born < 1100);
      if (!still) for (const shipment of shipmentsRef.current) {
        const u = Math.min(1, (now - shipment.born) / 1100);
        const c = { x: (shipment.a.x + shipment.b.x) / 2,
          y: Math.min(shipment.a.y, shipment.b.y) - 45 };
        const p = point(shipment.a, shipment.b, c, u);
        ctx.save(); ctx.globalAlpha = Math.min(1, (1 - u) * 2.4);
        token(shipment.task, p.x, p.y); ctx.restore();
      }

      const hovered = hoverRef.current && bees.get(hoverRef.current);
      if (hovered) {
        const title = hovered.task ? ` · ${hovered.task.title}` : "";
        const harnessLabel = (HARNESSES[hovered.harness] || HARNESSES.generic).label;
        const label = `${hoverRef.current} · ${harnessLabel}${title}`;
        ctx.font = "10px ui-monospace, monospace";
        const w = ctx.measureText(label).width + 12;
        const tx = Math.max(4, Math.min(width - w - 4, hovered.x - w / 2));
        const ty = Math.max(4, hovered.y - 31);
        ctx.fillStyle = "#241c11"; ctx.beginPath(); ctx.roundRect(tx, ty, w, 19, 5); ctx.fill();
        ctx.strokeStyle = "#3a2d1a"; ctx.stroke();
        ctx.fillStyle = "#f0e6d2"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(label, tx + 6, ty + 10);
      }
      const taskCell = taskHoverRef.current;
      if (!hovered && taskCell) {
        const task = taskCell.task;
        const stateLabel = taskCell.stranded
          ? `assigned to stopped ${task.assignee}`
          : taskCell.team ? `team ${taskCell.team.name}` : "waiting";
        const blockedLabel = taskCell.blocked
          ? ` · blocked (after ${(task.depends_on || []).map(d => `#${d}`).join(" ")})` : "";
        const label = `#${task.id} · ${task.title} · ${stateLabel}${blockedLabel} · drag onto a bee or team`;
        ctx.font = "10px ui-monospace, monospace";
        const w = Math.min(width - 16, ctx.measureText(label).width + 12);
        const tx = Math.max(8, Math.min(width - w - 8, taskCell.x - w / 2));
        const ty = Math.min(232, taskCell.y + 25);
        ctx.fillStyle = "#241c11"; ctx.beginPath(); ctx.roundRect(tx, ty, w, 19, 5); ctx.fill();
        ctx.strokeStyle = taskCell.stranded ? "#e06c55" : "#b97f27"; ctx.stroke();
        ctx.fillStyle = "#f0e6d2"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(label, tx + 6, ty + 10, w - 12);
      }
    };
    drawRef.current = draw;
    const at = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const hit = (e) => {
      const p = at(e);
      return [...beesRef.current].find(([, b]) => Math.hypot(p.x - b.x, p.y - b.y) < 24)?.[0] || null;
    };
    const hitTask = (e) => {
      const p = at(e);
      return taskCellsRef.current.find(cell => Math.hypot(p.x - cell.x, p.y - cell.y) < 20) || null;
    };
    const hitTeam = (e) => {
      const p = at(e);
      return teamBoxesRef.current.find(b =>
        p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) || null;
    };
    const taskId = (e) => {
      const raw = e.dataTransfer?.getData("application/x-agent-msg-task") ||
        e.dataTransfer?.getData("text/plain");
      return /^\d+$/.test(raw || "") ? Number(raw) : null;
    };
    const clearDrop = () => {
      dragTaskRef.current = null;
      dragBeeRef.current = null;
      dragPointRef.current = null;
      dropTargetRef.current = null;
      dropTeamRef.current = null;
      dragBoxRef.current = null;
      canvas.style.cursor = "default";
      if (reduced) draw(performance.now(), true);
    };
    const teamCenter = (id) => {
      const stored = teamPos.get(id);
      if (stored) return stored;
      const members = (stateRef.current.recipients || [])
        .filter(r => r.team_id === id && r.pane_alive)
        .map(r => beesRef.current.get(r.user_id)).filter(Boolean);
      if (members.length) return {
        x: members.reduce((s, b) => s + b.x, 0) / members.length,
        y: members.reduce((s, b) => s + b.y, 0) / members.length,
      };
      const box = teamBoxesRef.current.find(b => b.id === id);
      return box ? { x: box.x + box.w / 2, y: box.y + box.h / 2 } : null;
    };
    const assign = async (id, assignee) => {
      const task = (stateRef.current.tasks || []).find(t => t.id === id);
      if (!task || task.status === "done") {
        setDropStatus(`Task #${id} cannot be assigned by drag.`);
        return;
      }
      if (task.assignee === assignee) {
        setDropStatus(`#${id} is already assigned to ${assignee}.`);
        return;
      }
      try {
        const r = await fetch(`/tasks/${id}`, {
          method: "PATCH", headers: JSONH, body: JSON.stringify({ assignee }),
        });
        if (!r.ok) throw new Error("assignment failed");
        setDropStatus(`Assigned #${id} to ${assignee}.`);
        refresh();
      } catch {
        setDropStatus(`Could not assign #${id}; task was not changed.`);
      }
    };
    const assignTeam = async (id, box) => {
      const task = (stateRef.current.tasks || []).find(t => t.id === id);
      if (!task || task.status === "done") {
        setDropStatus(`Task #${id} cannot be assigned by drag.`);
        return;
      }
      if (task.team_id === box.id) {
        setDropStatus(`#${id} is already assigned to team ${box.name}.`);
        return;
      }
      try {
        const r = await fetch(`/tasks/${id}`, {
          method: "PATCH", headers: JSONH, body: JSON.stringify({ team_id: box.id }),
        });
        if (!r.ok) throw new Error("assignment failed");
        setDropStatus(`Assigned #${id} to team ${box.name}.`);
        refresh();
      } catch {
        setDropStatus(`Could not assign #${id}; task was not changed.`);
      }
    };
    const setBeeTeam = async (user, teamId, doneLabel) => {
      try {
        const r = await fetch(`/agents/${encodeURIComponent(user)}/team`, {
          method: "POST", headers: JSONH, body: JSON.stringify({ team_id: teamId }),
        });
        if (!r.ok) throw new Error("move failed");
        setDropStatus(doneLabel);
        refresh();
      } catch {
        setDropStatus(`Could not move ${user}.`);
      }
    };
    let press = null;
    let suppressClick = false;
    const pointerDown = (e) => {
      if (e.button !== 0) return;
      const bee = hit(e);
      if (bee) {
        press = { bee, start: at(e), moved: false };
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      const cell = hitTask(e);
      if (cell) {
        press = { id: cell.task.id, start: at(e), moved: false };
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      const box = hitTeam(e);
      if (!box) return;
      const p = at(e);
      const c = teamCenter(box.id) || { x: box.x + box.w / 2, y: box.y + box.h / 2 };
      press = { boxId: box.id, start: p, off: { x: c.x - p.x, y: c.y - p.y }, moved: false };
      canvas.setPointerCapture(e.pointerId);
    };
    const pointerMove = (e) => {
      if (!press) return;
      const p = at(e);
      if (!press.moved && Math.hypot(p.x - press.start.x, p.y - press.start.y) < 5) return;
      press.moved = true;
      hoverRef.current = null; taskHoverRef.current = null;
      if (press.boxId != null) {
        dragBoxRef.current = press.boxId;
        teamPos.set(press.boxId, { x: p.x + press.off.x, y: p.y + press.off.y });
        canvas.style.cursor = "grabbing";
        if (reduced) draw(performance.now(), true);
        return;
      }
      dragPointRef.current = p;
      if (press.bee) {
        dragBeeRef.current = press.bee;
        const box = hitTeam(e);
        dropTeamRef.current = box ? box.id : null;
        canvas.style.cursor = "grabbing";
      } else {
        dragTaskRef.current = press.id;
        dropTargetRef.current = hit(e);
        const box = dropTargetRef.current ? null : hitTeam(e);
        dropTeamRef.current = box ? box.id : null;
        canvas.style.cursor =
          dropTargetRef.current || dropTeamRef.current != null ? "copy" : "grabbing";
      }
      if (reduced) draw(performance.now(), true);
    };
    const pointerUp = async (e) => {
      if (!press) return;
      const { id, bee, boxId, moved } = press;
      press = null;
      if (!moved) return;
      suppressClick = true;
      if (boxId != null) {
        savePos();
        clearDrop();
        return;
      }
      const targetBee = hit(e);
      const box = hitTeam(e);
      clearDrop();
      if (bee) {
        const r = (stateRef.current.recipients || []).find(x => x.user_id === bee);
        const teams = stateRef.current.teams || [];
        const current = r && teams.find(t => t.id === r.team_id);
        if (box && (!current || current.id !== box.id))
          await setBeeTeam(bee, box.id, `Moved ${bee} to team ${box.name}.`);
        else if (!box && current)
          await setBeeTeam(bee, null, `Removed ${bee} from team ${current.name}.`);
        return;
      }
      if (targetBee) await assign(id, targetBee);
      else if (box) await assignTeam(id, box);
    };
    const pointerCancel = () => { press = null; clearDrop(); };
    const move = (e) => {
      if (press) return;
      hoverRef.current = hit(e); taskHoverRef.current = hoverRef.current ? null : hitTask(e);
      const overBox = !hoverRef.current && !taskHoverRef.current && hitTeam(e);
      canvas.style.cursor = hoverRef.current ? "pointer"
        : taskHoverRef.current || overBox ? "grab" : "default";
      if (reduced) draw(performance.now(), true);
    };
    const leave = () => {
      if (press) return;
      hoverRef.current = null; taskHoverRef.current = null;
      if (dragTaskRef.current) clearDrop();
      else { canvas.style.cursor = "default"; if (reduced) draw(performance.now(), true); }
    };
    const click = (e) => {
      if (suppressClick) { suppressClick = false; return; }
      const name = hit(e); if (name) location.hash = focusHash(name);
    };
    const dragOver = (e) => {
      const id = taskId(e);
      if (id === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      dragTaskRef.current = id;
      dropTargetRef.current = hit(e);
      const box = dropTargetRef.current ? null : hitTeam(e);
      dropTeamRef.current = box ? box.id : null;
      canvas.style.cursor =
        dropTargetRef.current || dropTeamRef.current != null ? "copy" : "not-allowed";
      if (reduced) draw(performance.now(), true);
    };
    const dragLeave = (e) => {
      if (e.target === canvas) clearDrop();
    };
    const drop = async (e) => {
      const id = taskId(e);
      const assignee = hit(e);
      const box = hitTeam(e);
      e.preventDefault();
      clearDrop();
      if (id === null) return;
      if (assignee) await assign(id, assignee);
      else if (box) await assignTeam(id, box);
    };
    window.__hive = { bees: () => beesRef.current, teamBoxes: () => teamBoxesRef.current };
    canvas.addEventListener("mousemove", move); canvas.addEventListener("mouseleave", leave);
    canvas.addEventListener("click", click);
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerCancel);
    canvas.addEventListener("dragover", dragOver); canvas.addEventListener("dragleave", dragLeave);
    canvas.addEventListener("drop", drop); canvas.addEventListener("dragend", clearDrop);
    window.addEventListener("dragend", clearDrop);
    if (reduced) draw(performance.now(), true);
    else {
      const tick = (now) => {
        if (!document.hidden && now - lastDraw >= 32) { draw(now); lastDraw = now; }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(frame); drawRef.current = null; delete window.__hive;
      canvas.removeEventListener("mousemove", move); canvas.removeEventListener("mouseleave", leave);
      canvas.removeEventListener("click", click);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerCancel);
      canvas.removeEventListener("dragover", dragOver); canvas.removeEventListener("dragleave", dragLeave);
      canvas.removeEventListener("drop", drop); canvas.removeEventListener("dragend", clearDrop);
      window.removeEventListener("dragend", clearDrop);
    };
  }, []);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches && drawRef.current)
      drawRef.current(performance.now(), true);
  }, [state]);

  return html`<div class="hive-panel"><canvas ref=${canvasRef} tabindex="0"
    aria-label="Live activity. Bee body color and harness glyph identify the agent harness as listed in the legend. Drag a comb cell or a task card onto a bee or a team outline to assign the task; drag a bee into or out of a team outline to change its team; drag a team outline by its empty space to move the whole team somewhere else. Bees outside a team are kept out of team outlines. The task assignee select and the sidebar team boxes are the keyboard and touch alternatives."></canvas>
    ${liveHarnesses.length > 0 && html`<div class="harness-legend" aria-label="Bee harness legend">
      <span class="legend-title">harness</span>
      ${liveHarnesses.map(harness => html`<span class="harness-key" key=${harness.key}>
        <span class="harness-swatch" style=${`--harness:${harness.color}`}>${harness.mark}</span>
        ${harness.label}
      </span>`)}
    </div>`}
    <span class="sr-only" aria-live="polite">${dropStatus}</span></div>`;
}
