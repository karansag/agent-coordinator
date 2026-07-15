# Multi-agent coordination: design discussion

Status: OWNER DECIDED 2026-07-14. For v1, keep it simple: implement
only (1) a worktree-per-task convention (branch `task/<id>`, worktree
path recorded on the task) and (2) a prompt-only queen, meaning a
normal agent given a coordinator prompt that decomposes objectives and
creates/assigns tasks with the existing API. All other machinery in
this document (repo_runs, leases, actor enforcement, claims,
task_events) is DEFERRED until real usage shows it is needed. Rounds
1-4 below are kept as the map for that future, not as a build plan.

Participants: badger (codex), hedgehog (claude), owner. Badger
proposed a baseline (repo-runs, child tasks, server-provisioned
worktrees, durable event threads, advisory claims, a leased "queen"
coordinator). The rest of this file is the discussion record.

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

---

# Round 2: problem statement critique (2026-07-14)

Owner clarified directly: (1) promotion of one agent to queen, which
then directs other agents as its subordinates, with the owner talking
ONLY to the queen: a manager of managers. (2) Independently of queens,
tasks assigned to different agents in the same repo do not coordinate
today. These are two problems, and the owner experience for (1) is a
requirement, not a mechanism choice.

## Critique of badger's restatement

Largely right, but it conflates those two problems into one flow. The
concurrency problem exists with zero decomposition: two unrelated
owner-assigned tasks in one repo already clobber each other. That is
the more common case and the cheaper fix; solve it first and the queen
builds on it.

Scenarios missing from the statement:

- **Owner redirect mid-swarm.** "Stop, pivot" arrives at the queen;
  what are the cancel semantics for in-flight worker tasks and their
  partial branches?
- **Verification of "done".** A worker can sincerely report a
  hallucinated completion. Definition of done must be machine-checkable
  where possible (tests green on the integration branch after merge),
  not prose. The integrator step is the verification gate.
- **Session mortality.** Sessions hit quota, restart on other models,
  or die mid-task (this project hit quota yesterday). Every role,
  worker or queen, needs durable state sufficient for a cold
  replacement to resume: that is the point of task records, not chat.
- **Mid-run onboarding.** A freshly spawned worker must be briefable
  from durable state alone (objective, constraints, base revision,
  conventions doc), never from chat history.
- **Escalation path.** A worker blocked on an owner-level decision
  escalates to the queen, who either decides within scope or asks the
  owner. Sideways escalation to peers stays allowed for technical
  questions; upward questions go through the funnel or the owner's
  single-channel experience breaks.

## Autonomy boundaries

Ordinary assignee (no promotion needed):
- May split its own task into child tasks it remains accountable for,
  ask peers technical questions, request review, and mark its work
  ready_for_integration.
- May not assign work to other agents, touch the integration branch,
  modify others' tasks, or spawn/stop agents.

Queen (promoted, leased):
- May create, assign, reprioritize, and cancel child tasks; spawn and
  stop worker agents; resolve claim conflicts; integrate; report to
  the owner. Normally does not implement.
- May not change the objective or definition of done, expand scope to
  another repo, or transfer/renew its own promotion beyond the lease
  the owner granted.

Owner only: promote/demote the queen, set or change the objective and
definition of done, final authority on everything. The funnel is the
default communication pattern, not an enforcement: the dashboard keeps
full visibility and the owner can always message any agent directly.

## Smallest model, phased

Phase 1, no queen (fixes simultaneous work now): repo-run record
(repo, base revision, integration branch, objective text), task fields
branch/worktree/parent/depends_on, `ready_for_integration` status,
advisory claims with overlap warnings, worktree/branch convention in
AGENT_PROMPT.md. Owner assigns tasks exactly as today; agents stop
colliding.

Phase 2, queen (adds the funnel): promotion lease on the repo-run,
child-task creation/assignment rights, queen as default integrator and
default owner contact, escalation convention, periodic queen digest to
the owner. Mechanism details (merge strategy, claims, leases) stay as
argued in round 1 unless the owner overrides.

---

# Round 3: convergence (2026-07-14)

Badger and hedgehog agree on the model. Consolidated deltas from
badger's review, all accepted:

- **Authority rule** (matches the round 2 boundaries): any worker may
  propose or create child tasks and message peers; only the owner or
  the current queen assigns or reprioritizes across agents; the queen
  may delegate assignment authority for a subtree. Assignment
  therefore always means the same thing to the owner.
- **Bootstrap story**: owner creates one repo objective (a repo-run)
  and promotes a specific live agent. The grant injects the
  coordinator protocol plus the durable repo-run summary into that
  agent's pane, the same pattern as registration's protocol_brief.
  Any registered live agent is grantable; spawning a dedicated queen
  is optional, not required.
- **repo_runs schema**: repo_path, integration_branch, base_commit,
  objective, instructions, status, queen, lease_expires, created_at,
  updated_at. Multiple records allowed; at most one active run per
  repo + integration branch.
- **Durable decisions**: task-tagged messages are the durable decision
  record (they are already stored). Normalize context tags to
  `task-<id>` (existing rows use `task #N`) before relying on the
  `GET /messages?context=` filter.
- **Worktree helper**: convention alone is race-prone; ship
  `agent-msg task-worktree <id>`, which creates the worktree from the
  repo-run's recorded base commit and atomically PATCHes branch and
  worktree onto the task. Still entirely client-side git.
- **Integration**: rebase task branch onto integration branch, run
  tests, then ff-only merge under the exclusive integration lease.
  Failure notifies the worker and the queen; owner is paged only when
  a task is blocked after retry.
- **Lease renewal**: implicit renewal on every authenticated
  coordinator action, plus a cheap heartbeat (`agent-msg queen-renew`)
  for quiet stretches. No explicit-only renewal: forgetting to renew
  would make expiry the common case instead of a death detector. The
  owner can demote at any time regardless of lease state.

Status: design settled between agents. Implementation is NOT started;
awaiting owner go-ahead on Phase 1 (concurrency safety) and Phase 2
(queen promotion), which can ship independently in that order.

---

# Round 4: actor identity on mutations (2026-07-14)

Badger's finding, accepted: task mutations (POST /tasks, PATCH
/tasks/<id>) carry no actor, so the authority split and implicit lease
renewal cannot be attributed, let alone checked. Convention-only
authority is rejected; v1 uses actor-bearing mutations:

- Every task mutation and coordination call carries an actor: either
  `tmux_pane` (resolved server-side to the registered agent, exactly
  as /send does) or `actor: "owner"` (used by the dashboard's own
  requests). Requests with neither are rejected.
- **Attribution from Phase 1, enforcement from Phase 2.** Phase 1
  records who did what; nothing is denied. Phase 2 enforces the
  authority split only for tasks belonging to an active repo-run:
  assignment/reprioritization requires owner or the run's queen (or
  delegated subtree authority); integration status transitions require
  the integration lease holder; a worker may still mutate its own
  task's status.
- Each mutation appends a compact task_events row (task_id, actor,
  change, ts). This, plus task-tagged messages, is what a replacement
  queen resumes from. The event log also powers the dashboard's
  legibility requirement.
- Queen heartbeat and every coordinator action resolve the caller's
  registered pane before renewing the lease.
- Explicitly acknowledged: this is logical identity for attribution
  and workflow, not security. A local caller can claim any pane or the
  owner actor until the tailnet auth roadmap item lands; when it does,
  owner routes get authenticated first.
