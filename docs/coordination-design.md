# Multi-agent coordination: design discussion

Status: discussion draft, 2026-07-14. Participants: badger (codex),
hedgehog (claude), owner. Badger proposed a baseline (repo-runs, child
tasks, server-provisioned worktrees, durable event threads, advisory
claims, a leased "queen" coordinator). This file is hedgehog's critique
and preferred minimal v1. Nothing here is decided; the owner decides.

## Where I agree with badger

- The failure modes are real and correctly ranked: shared-checkout
  clobbering, divergent assumptions, duplicate work, unauditable
  free-form chat, and a stale coordinator as single point of failure.
- Coordinator as an explicit, owner-granted, expiring, replaceable
  lease rather than a fixed identity. Eligibility by explicit
  capability self-report, never by flavor or handle.
- Tmux delivery demoted to notification; durable state lives elsewhere.
- Workers commit in isolation on their own branch and someone
  integrates deliberately.

## Where I push back

1. **Keep the server out of git.** README's "How It Fits" positions
   agent-msg as the delivery layer, not an orchestrator. The tasks
   feature already stretched that; server-provisioned worktrees would
   break it. The server should never shell into repos it does not own:
   it adds failure modes (permissions, paths, half-created worktrees)
   and couples bus uptime to repo state. Agents have shells and git;
   give them a convention (or a tiny CLI helper), and store only the
   resulting strings (branch, worktree path) as task metadata.
2. **No new event/comment subsystem in v1.** Every message is already
   recorded in SQLite with a context tag. Convention: tag task traffic
   with `task-<id>` and the durable per-task thread already exists;
   add a `context` filter to `GET /messages` (small change) instead of
   building threads. Reserve real event logs for when the message log
   provably fails us.
3. **Advisory claims only, no hard locks, ever.** The server cannot
   actually stop an agent from editing a file, so a "hard" lock is an
   advisory lock with false confidence plus a liveness problem (stale
   locks held by dead agents; the exact queen failure badger worries
   about, one layer down). Overlap warning at claim time, expiry, and
   git as the true arbiter.
4. **The queen must not be the sole anything.** Owner retains every
   right the queen has (grant, assign, integrate, revoke). Queen is
   the default doer of those things, not the only one. Sole-assigner
   or sole-integrator designs recreate the single point of failure the
   lease was supposed to fix.

## Answers to the specific questions

- **Server-managed or agent-managed worktrees?** Agent-managed, by
  convention: branch `task/<id>-<slug>`, worktree
  `~/worktrees/<repo-name>/task-<id>`. Worker creates it when picking
  up, records both strings on the task, removes the worktree after
  integration. Optionally a `agent-msg task-worktree <id>` helper that
  runs the git commands client-side; the server just stores strings.
- **Advisory claims vs hard locks?** Advisory with expiry and overlap
  warnings (see pushback 3). Claims auto-release when their task
  leaves picked_up.
- **Merge/cherry-pick strategy?** Rebase the task branch onto the
  integration branch, run the repo's tests on the result, then merge.
  Serialize integrations (one at a time per repo-run). On red tests,
  bounce the task back to its worker with the failing output; the
  integrator does not fix worker code. Cherry-pick is salvage, not
  strategy: it duplicates commits and loses ancestry.
- **Queen sole integrator and sole assigner?** No (see pushback 4).
  Default assigner and holder of the single integration lease, both
  delegable per-task and always overridable by the owner. The
  integration LEASE is exclusive (serialization); the queen is not.
- **One queen per repo-run or multiple coordinators?** One per
  repo-run in v1. Multiple coordinators reintroduce the coordination
  problem one level up. If a repo-run later splits into independent
  component runs, each gets its own queen; defer until it hurts.
- **Durable vs peer-to-peer?** Litmus test: if a replacement queen
  with zero chat history would need it to resume, it is durable.
  Durable: repo-run record, task fields and status transitions,
  assignment and lease changes, claims, integration results. Transient
  peer-to-peer: questions, nudges, review requests, status chatter,
  all tagged `task-<id>` so they are reconstructible anyway.

## My preferred minimal v1

Owner-visible surface first; machinery only where the litmus test
demands durability.

1. `repo_runs` table: repo_path, base_commit, integration_branch,
   queen (user_id or null), lease_expires. Owner grants/revokes the
   queen lease from the dashboard or CLI. Lease renewal is a heartbeat
   (`agent-msg queen-renew`); expiry vacates the role and notifies the
   owner; durable state is untouched.
2. Task additions: parent_id, repo_run_id, branch, worktree,
   depends_on (JSON list of task ids), and one new status:
   `ready_for_integration` between picked_up and done. Queen (or
   owner) moves ready tasks to done by integrating.
3. Claims table: task_id, path_glob, expires. `POST /claims` warns on
   overlap, never blocks.
4. Worktree/branch convention documented in AGENT_PROMPT.md; no server
   git.
5. `GET /messages?context=task-<id>` filter.
6. Everything else deferred: comment threads, server worktrees, review
   states, multi-queen, capability verification (self-report labels
   plus owner judgment are v1 eligibility).

## Open questions for the owner

- Does the queen run as a spawned agent in the `agents` tmux session
  with a standing prompt, or is any registered agent grantable?
- Should integration failures page the owner (dashboard badge) or
  only the responsible worker?
- Is one repo-run at a time enough for v1? (I assume yes: this repo.)
