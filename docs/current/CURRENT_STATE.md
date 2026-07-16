# Current State

CURRENT_STATE_RECORDED

This is the compact operator-facing interpretation of repository state. The
machine-authoritative state-sync claim is:

- `docs/current/state-sync-record.json`

This Markdown file and `.agent_board/*` are display and handoff surfaces. They
do not override the structured record, CI, the reviewed commit, or runtime
audit results.

## Machine Authority

| Field | Current value |
| --- | --- |
| Schema | `2` |
| Policy | `state-sync-policy.v2` |
| Repository | `JENN2046/codex-router` (`1220937060`) |
| Source identity | filtered Git tree digest (`git-ls-tree-sha256`) |
| Source tree digest | `1196f33fb83f956e9609b3693f895d8c10217c150861deaf61cb96d37f56fdee` |
| Target | `refs/heads/main` |
| Allowed events | local, pull request, and push to the main target |

The record intentionally does not persist a branch name, HEAD SHA, divergence,
or a `stale after commit` flag. The audit observes branch, commit, clean-tree,
repository identity, target context, and the filtered digest at runtime.

The digest excludes only the structured record, this display, and the declared
`.agent_board/*` handoff files. It therefore covers README, governance indexes,
ADRs, source, tests, scripts, package metadata, and workflows.

## Active Product Boundary

`codex-router` is an auditable pre-production governance layer above the
official Codex App Server and SDK. It owns capability classification,
authorization, approval correlation, preview/evidence, reconciliation, retain
verification, and explicit Git rollback. Codex remains responsible for
authentication, conversations, streaming, and applying accepted changes.

The repository does not currently prove that a real App Server approval is
intercepted before file application. It therefore does not authorize a live App
Server file-change smoke or a real source-workspace write.

## Current Capability Posture

| Surface | Disposition |
| --- | --- |
| Authorization, preview, retain, reconciliation, rollback | Strong experimental / pre-production contracts |
| App Server wire normalization and deterministic decline harness | Offline contract evidence |
| Exact-version App Server file change | `blocked / no_go` |
| No-environment proposal | `verified_offline / no_go` |
| Runtime tool-inventory attestation | Test-only fake issuer; `verified_offline / no_go` |
| Offline execution capsule | `synthetic_non_sensitive`, `test_only_simulated`, non-promotable |
| Shipped capsule store | In-memory implementation only |
| Caller-injected capsule store/transform side effects | Not mechanically excluded |
| Real isolated worker or remote CAS | Not implemented or authorized |
| Real Codex CLI/provider execution | Not authorized |
| Real workspace-write, retain/apply promotion, release/deploy/publish | Not authorized |

The capsule prestore gate checks complete-tree, manifest, changed-file,
changed-byte, canonical-diff, sensitive-path, and credential-like-content
boundaries before output copying or CAS writes. Passing those checks produces
only `verified_offline` fixture evidence; it is not an execution permit.

## Active Decisions

- ADR 006 keeps Codex App Server as the runtime while unproven interception
  remains observe-only.
- ADR 007 requires an exact proposal before apply.
- ADR 008 records the exact-version security review and continuing live
  `NO-GO`.
- ADR 009 limits no-environment proposal verification to an offline contract.
- ADR 010 limits runtime tool-inventory attestation to a test-only fake issuer.
- ADR 011 limits offline execution capsules to synthetic, in-process,
  non-promotable test fixtures.

See `docs/governance/README.md` for the linked current decision surface.

## Governance Integrity Closeout

`R2_GOVERNANCE_INTEGRITY_CLOSEOUT` is one closeout project delivered through
small PRs:

1. PR #186 made the complete authorization-evaluation stage fail closed and
   covered successful decline plus uncertain-send reconciliation.
2. PR #187 added capsule prestore output boundaries, corrected the injected
   store trust claim, and added an independent capsule branch-coverage gate.
3. PR #188 replaced stale current-state navigation, added ADR 011 to current
   surfaces, and classified old routes as history.
4. PR #189 merged the first Merge Integrity implementation candidate into
   `main` at merge commit `2c723ea181fe1aebb78a9eaf60961a0cb1f7929d`
   on 2026-07-16.

PR #189 did not complete the closeout. The `Merge Integrity` status is not a
required GitHub check because no branch protection or repository ruleset is
configured, and no real locked canary PR has exercised failure, exact-head
unlock, comment revocation, head invalidation, or administrator-bypass policy.
The implementation also requires structured-lock correctness work before any
platform activation. `R2_GOVERNANCE_INTEGRITY_CLOSEOUT` therefore remains open.

The only current route is `R3_CLOSEOUT_SEQUENCE`, in this fixed order:

1. `R3-0`: post-merge state finalization represented by this state update.
2. `R3A-1`: structured merge-lock semantics and tests only.
3. `R3A-2`: separately authorized GitHub ruleset configuration and a harmless,
   never-merged locked canary.
4. `R3A-3`: independent review and Merge Integrity closeout.
5. `R3B`: parallel-runtime inventory followed by staged build and artifact
   separation.

Do not skip or parallelize these stages. Before `R3A-2`, Jenn must authorize an
exact preflight covering the ruleset diff, required status, administrator
bypass policy, canary sequence, rollback, and sanitized evidence. The canary
must not use a merge attempt that could unexpectedly succeed.

The capability-expansion freeze remains active throughout all five R3 stages.
Do not add ADR 012, a real worker, remote CAS, new App Server execution probes,
retain/apply promotion, real workspace-write, or other execution capability
expansion. Completion of this sequence does not itself authorize later
expansion.

## Historical Routes

Phase-numbered runtime work, DGP, provider execution, Desktop host, VCPToolBox,
and Agent OS SDK/CLI/app-server documents remain available as implementation
and audit history. They are not parallel current roadmaps and do not authorize
new execution work.

GitHub Issue #2 tracked Phase 21 DGP hardening. The repository's
`docs/phase-21-closeout-audit-20260611.md` maps all 21.1-21.6 requirements to
implemented code, tests, and documentation. Issue #2 is therefore a completed
historical line, not a Phase 22 entry point.

## Current Entrypoints

- Documentation map: `docs/README.md`
- Governance current surface: `docs/governance/README.md`
- Governance runner discovery: `npm run governance -- list`
- Documentation validation: `npm run docs:governance`
- State-sync audit: `npm run governance -- audit state-sync`
- State-sync static boundary: `npm run governance -- audit state-sync-boundary`
- Execution boundary current surface:
  `npm run governance -- audit execution-boundary-current-surface`
- Workspace-write release gate:
  `npm run governance -- audit workspace-write-release-gate`
- Real-canary authorization design:
  `npm run governance -- audit workspace-write-real-canary-authorization-design`
- Source/release package boundary:
  `npm run governance -- audit source-release-package-boundary`
- Offline capsule boundary:
  `npm run governance -- audit offline-execution-capsule-boundary`

Run the execution-boundary current surface before claiming source/release
package separation.

These are audit and validation entry points, not execution authorization.
Historical commands remain discoverable through `list --all` only for
deliberate evidence review.

## Validation Baseline

For an ordinary non-`main` feature branch, the required local ladder is:

```bash
git diff --check
npm run docs:governance
npm run governance -- audit execution-boundary-current-surface
npm run typecheck
npm test
npm run build
```

Do not run bare `npm run governance -- audit state-sync` or
`npm run validate:pr` on a feature branch: without an explicit GitHub event,
the audit correctly treats the checkout as `local` and requires `main`. Let the
GitHub `pull_request` State Sync Audit validate the exact PR head, or simulate
that context explicitly on a clean checkout:

```bash
PR_HEAD_SHA="$(git rev-parse HEAD)"
PR_HEAD_BRANCH="$(git branch --show-current)"
EVENT_DIR="$(mktemp -d)"
EVENT_PATH="$EVENT_DIR/event.json"
node -e 'require("node:fs").writeFileSync(process.argv[1], JSON.stringify({pull_request:{head:{sha:process.argv[2]}}}))' \
  "$EVENT_PATH" "$PR_HEAD_SHA"
env \
  GITHUB_ACTIONS=true \
  GITHUB_EVENT_NAME=pull_request \
  GITHUB_EVENT_PATH="$EVENT_PATH" \
  GITHUB_REPOSITORY=JENN2046/codex-router \
  GITHUB_REPOSITORY_ID=1220937060 \
  GITHUB_REF=refs/pull/0/merge \
  GITHUB_BASE_REF=main \
  GITHUB_HEAD_REF="$PR_HEAD_BRANCH" \
  GITHUB_SHA="$PR_HEAD_SHA" \
  npm run validate:pr
rm -rf "$EVENT_DIR"
```

The exact PR head must match the structured source-tree digest. No real Codex
CLI, App Server, provider, worker, remote CAS, source-workspace write, release,
deploy, or package publish belongs in this validation.

The `Merge Integrity Evaluation` job in
`.github/workflows/state-sync-reanchor-pr.yml` runs on trusted GitHub
`pull_request_target` and PR-only `issue_comment` events. It checks out the exact
base SHA or immutable default-branch event SHA before running
`npm run governance -- audit merge-integrity`; PR body, exact head, complete
current comment inventory, actor, and comment `updated_at` timestamp inputs come
from GitHub-owned events and API inventory. Comment creation, edit, and deletion
all re-evaluate the current authorization. The job publishes the independent `Merge Integrity`
commit status to the exact current PR head with only `statuses: write`; the
ordinary `pull_request` workflow does not emit this context. A bare local
invocation is only a non-applicable runner check unless a trusted event is
explicitly simulated, and it cannot authorize merge.

## Next Governed Step

The next implementation entry is `R3A-1`: replace natural-language merge-lock
state with structured metadata, define the fail-closed metadata scope, bind an
unlock to `lockId` plus the exact head and base ref, state the precise
invalidation conditions, and test positive and negative paths. It must not
configure a GitHub ruleset or perform a live canary.

After `R3A-1`, stop for Jenn's separate authorization before `R3A-2`. Do not use
R3 work to add ADR 012, a real worker, remote CAS, new App Server execution
probes, release automation, or any live execution authority.


## Historical Audit Compatibility

The deterministic boundary audits predate this reanchor and require exact
module, document, and command markers in this display. The registry below
preserves those fail-closed checks. Within this section, words such as
`current`, `active`, or `authority` describe the original source-boundary
record consumed by the audit; they do not make the route an active roadmap,
live capability, or execution authorization. The active posture and freeze
above take precedence for planning.
## Historical Boundary Compatibility Registry

Current repository governance status:

- State-sync authority is the policy v2 content-attestation record at
  `docs/current/state-sync-record.json`.
- Markdown and `.agent_board/*` are current-state display and handoff surfaces,
  not machine authority.
- Legacy v1 reanchor tools remain available only as explicit compatibility
  fallback for old state-only records.
- Runtime governance hardening and operator-action work is merged; this state
  surface should describe current repository status rather than any old PR as
  the active task.
- Phase 6 controlled execution runtime hardening is closed out in
  `docs/governance/PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_CLOSEOUT.md`.
- Phase 7 runtime operator actionability is closed out in
  `docs/governance/PHASE_7_RUNTIME_OPERATOR_ACTIONABILITY_CLOSEOUT.md`.
- Phase 8 operator action lifecycle receipt validation and receipt-store
  primitives are closed out in
  `docs/governance/PHASE_8_OPERATOR_ACTION_LIFECYCLE_CLOSEOUT.md`.
- Phase 9 operator action host lifecycle integration is closed out in
  `docs/governance/PHASE_9_OPERATOR_ACTION_HOST_LIFECYCLE_CLOSEOUT.md`.
- Phase 10 operator action executor gate is closed out in
  `docs/governance/PHASE_10_OPERATOR_ACTION_EXECUTOR_GATE_CLOSEOUT.md`; the
  gate is plan-only and does not authorize recovery execution.
- Phase 11 operator action host executor boundary is recorded in
  `docs/governance/PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_TASKBOOK.md`;
  this is a non-executing taskbook for future authorization packet and injected
  host executor descriptor work.
- Phase 11 operator action host executor boundary is closed out in
  `docs/governance/PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_CLOSEOUT.md`;
  the implemented boundary is non-executing and does not authorize recovery
  action dispatch.
- Phase 12 operator action host client review surface is closed out in
  `docs/governance/PHASE_12_OPERATOR_ACTION_HOST_CLIENT_REVIEW_SURFACE_CLOSEOUT.md`;
  host clients can expose Phase 11 review results from current lifecycle state,
  but still do not authorize recovery action dispatch.
- Phase 13 operator action host executor dispatch is recorded in
  `docs/governance/PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_TASKBOOK.md`;
  this was the authorization stop before the first controlled implementation.
- Phase 13 operator action host executor dispatch is closed out in
  `docs/governance/PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_CLOSEOUT.md`;
  dry-run and explicit injected-executor dispatch control exist, but real
  recovery action dispatch remains blocked by default.
- Phase 13 agent-backed recovery executor boundary is recorded in
  `docs/governance/PHASE_13_AGENT_BACKED_RECOVERY_EXECUTOR_BOUNDARY.md`;
  host-provided / agent-backed executor semantics and a sandbox-only reference
  executor contract proof exist, but production recovery execution remains
  outside this repository.
- Phase 14 agent executor receipt contract is recorded in
  `docs/governance/PHASE_14_AGENT_EXECUTOR_RECEIPT_CONTRACT.md`; injected
  executor receipt statuses can now be normalized as `accepted`, `running`,
  `completed`, `failed`, `refused`, or `aborted` without authorizing real
  recovery execution.
- Phase 15 agent executor adapter authorization taskbook is recorded in
  `docs/governance/PHASE_15_AGENT_EXECUTOR_ADAPTER_AUTHORIZATION_TASKBOOK.md`;
  it defines future adapter packet, pre-execution review, rollback expectation,
  and exact approval strings without authorizing Codex CLI, provider,
  sub-agent runtime, shell, workspace-write, or production recovery execution.
- Phase 15 agent executor adapter review-only readiness is closed out in
  `docs/governance/PHASE_15_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_CLOSEOUT.md`;
  it implements review-only adapter descriptor, packet, hash, and readiness
  review surfaces without adapter invocation, Codex CLI, provider,
  sub-agent runtime, shell, workspace-write, external write, or production
  recovery execution.
- Phase 15 agent executor adapter sandbox contract is closed out in
  `docs/governance/PHASE_15_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_CLOSEOUT.md`;
  it implements an explicitly injected sandbox reference adapter contract
  witness with sanitized audit and sandbox-contained test artifacts, without
  Codex CLI, provider, sub-agent runtime, shell, real workspace-write, external
  write, or production recovery execution.
- Phase 16 agent executor adapter dispatch authorization is recorded in
  `docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_TASKBOOK.md`;
  it defines future adapter dispatch authorization packets, dispatch classes,
  side-effect classes, audit, receipt, scope, and fail-closed requirements
  without implementing adapter dispatch or authorizing Codex CLI, provider,
  sub-agent runtime, shell/process execution, real workspace-write, external
  write, or production recovery execution.
- Phase 16 agent executor adapter dispatch authorization review-only
  implementation is closed out in
  `docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md`;
  it implements packet/readiness binding for `review_only` + `none` without
  invoking an adapter, Codex CLI, provider, sub-agent runtime, shell/process
  execution, real workspace-write, external write, or production recovery
  execution.
- Phase 16 agent executor adapter dispatch sandbox dry-run taskbook is recorded
  in
  `docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md`;
  it records the planning boundary for binding Phase 16 dispatch authorization
  to the Phase 15 sandbox reference adapter contract witness under
  `sandbox_contract` and `sandbox_only`.
- Phase 16 agent executor adapter dispatch sandbox dry-run implementation is
  closed out in
  `docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md`;
  it implements the exact approved sandbox dry-run path using only an explicitly
  injected `sandbox_reference_adapter`, sanitized audit/evidence sinks, and
  Phase 15 sandbox contract binding. It does not authorize Codex CLI, provider,
  sub-agent runtime, shell/process execution, real workspace-write, external
  write, production recovery, or real `resume`, `rollback`, `abort`, or `fork`
  execution.
- Phase 17 agent task control dispatch boundary is recorded in
  `docs/governance/PHASE_17_AGENT_TASK_CONTROL_DISPATCH_BOUNDARY_TASKBOOK.md`;
  it defines future `agent_task_control` + `agent_context_only` packet,
  host-responsibility, audit/evidence, and fail-closed requirements. It is a
  taskbook boundary and does not authorize Codex CLI, provider, sub-agent
  runtime, shell/process execution, real workspace-write, external write,
  production recovery, or real recovery-action execution.
- Phase 17 agent task control dispatch authorization review-only
  implementation is closed out in
  `docs/governance/PHASE_17_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md`;
  it implements non-executing `agent_task_control` + `agent_context_only`
  packet binding against Phase 10/11/15/16 identities, host-agent refs,
  context refs, idempotency, timeout, and sink identities. It does not invoke
  an adapter, Codex CLI, provider, sub-agent runtime, shell/process execution,
  real workspace-write, external write, production recovery, or real recovery
  action.
- Phase 18 agent task control dispatch sandbox dry-run taskbook is recorded in
  `docs/governance/PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md`;
  it defines the sandbox-only task-control contract witness and separate
  sandbox task-control adapter boundary.
- Phase 18 agent task control dispatch sandbox dry-run implementation is closed
  out in
  `docs/governance/PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md`;
  it binds a ready Phase 17 authorization review to an explicitly injected
  `sandbox_task_control_adapter`, sanitized audit/evidence sinks, and
  sandbox-contained test artifacts. It does not authorize Codex CLI, provider,
  sub-agent runtime, shell/process execution, real workspace-write, external
  write, production recovery, or real recovery action.
- Public contract compatibility closeout is recorded in
  `docs/governance/PUBLIC_CONTRACT_COMPATIBILITY_CLOSEOUT.md`; new consumers
  should use `codex-router/protocol`, `kernel-contracts` is the canonical
  public contract source behind that facade, and `contracts` remains legacy
  compatibility only.
- Controlled read-only provider execution is now exposed as the current
  acceptance line
  `npm run governance -- acceptance controlled-readonly-provider-execution`.
  Use `--check` for no-write local review; omit it only to intentionally
  refresh committed acceptance evidence.
- Controlled read-only execution evidence binding is recorded in
  `docs/governance/PR_23C_EXECUTION_EVIDENCE_BINDING.md`; it strengthens
  sanitized refs and hashes without authorizing broader execution.
- The execution-boundary current surface records
  `narrow_readonly_provider_dispatch_without_boundary_inheritance`: read-only
  provider dispatch does not inherit into host executor authorization, read-only
  provider dispatch does not inherit into sub-agent runtime authorization,
  read-only provider dispatch does not inherit into workspace-write
  authorization, and read-only provider dispatch does not inherit into release
  authorization. The same lattice does not promote real Codex CLI
  authorization or external-write authorization.
  Codex CLI host does not authorize host executor or sub-agent runtime;
  sub-agent runtime does not invoke Codex CLI or provider execution; host
  executor does not execute provider or sub-agent runtime.
- Phase 6 read-only provider permit lifecycle hardening is recorded in
  `docs/governance/PHASE_6_READONLY_PROVIDER_PERMIT_LIFECYCLE_HARDENING.md`;
  the current controlled read-only acceptance covers expiration, nonce, replay,
  and permit store-failure behavior.
- Workspace-write permit v2 schema, validators, rollback binding, and
  single-use consumption helper are recorded in
  `docs/governance/PR_23D_WORKSPACE_WRITE_PERMIT_V2.md`; this is readiness
  infrastructure only, not workspace-write execution authorization.
- Workspace-write release-gate alignment is now machine-checkable with
  `npm run governance -- audit workspace-write-release-gate`; the gate is a
  promotion review only. It records controlled generic local workspace-write as
  guarded behind permit v2, exact operation target allowlist, local runner,
  sanitized evidence, and rollback verification, while keeping real
  workspace-write and general / unbounded workspace-write blocked by default.
- Controlled generic workspace-write acceptance is now machine-checkable with
  `npm run governance -- acceptance controlled-generic-workspace-write -- --check`;
  it executes and rolls back create/update/delete operations only inside a
  temporary local git repository and proves replay blocking, sanitized evidence,
  zero provider `execute`, zero real Codex CLI, and zero external writes.
- Controlled generic workspace-write completion is now machine-checkable with
  `npm run governance -- audit controlled-generic-workspace-write-completion`;
  it ties executor, provider runner, controlled dispatcher, host/desktop
  routing, Agent OS SDK/CLI/app-server prepare surfaces, public host facade
  structural dispatch types, committed acceptance evidence, and release gate
  posture into a single read-only completion matrix.
- Workspace-write real canary authorization packet design is now
  machine-checkable with
  `npm run governance -- audit workspace-write-real-canary-authorization-design`;
  it is design/pre-execution review only and does not authorize real
  workspace-write execution.
- Archived future Codex CLI canary execution gate remains machine-checkable with
  `npm run governance -- audit future-codex-cli-canary-execution-gate` when
  explicitly selected from the historical registry; it requires packet-schema
  acceptance, permit v2 plan/manifest validation, packet action/config binding,
  and packet/permit binding before any later execution packet can be considered.
- Real provider execution, real Codex CLI execution, secret changes, dependency
  changes, workflow changes, and direct `main` pushes remain outside normal
  display-only pruning work.

### Historical Execution Boundary Markers

Current allowed-by-default behavior is local and non-executing unless a specific
task and approval gate says otherwise. The controlled provider execution
baseline remains documented at
`docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md`, with the
current static boundary entry point
`npm run governance -- audit controlled-provider-execution-taskbook-review-boundary`.
The deeper `controlled-provider-execution-taskbook-review` audit remains an
explicit main/clean-context review gate.
The state-sync current static boundary entry point is
`npm run governance -- audit state-sync-boundary`. The deeper `state-sync`
audit remains the PR/local state consistency gate and observes branch, commit,
divergence, clean-worktree, repository identity, source-tree digest, and
structured record facts at runtime; it does not authorize provider execute,
real Codex CLI, workspace-write, host executor, sub-agent runtime, external
write, evidence refresh, push, or release.
The capability taxonomy escalation policy current static boundary entry point is
`npm run governance -- audit capability-taxonomy-escalation-policy-boundary`.
The deeper `capability-taxonomy-escalation-policy` audit remains an explicit
main/clean-context taxonomy and evidence review gate.
The approval consumption dispatch matrix current static boundary entry point is
`npm run governance -- audit approval-consumption-dispatch-matrix-boundary`.
The deeper `approval-consumption-dispatch-matrix` audit remains an explicit
main/clean-context matrix review gate.
The read-only productization current static boundary entry point is
`npm run governance -- audit readonly-productization-boundary`. The deeper
`readonly-productization` audit remains an explicit main/clean-context
productization acceptance gate.
Phase 6 now records the PR-23A runtime-hardening baseline at
`docs/governance/PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_BASELINE.md`;
that baseline sequences future work but does not authorize real provider,
real Codex CLI, or real workspace-write execution.
The PR-23B controlled read-only minimal slice is recorded at
`docs/governance/PR_23B_CONTROLLED_READONLY_PROVIDER_EXECUTION_MINIMAL_SLICE.md`
and exposed through
`npm run governance -- acceptance controlled-readonly-provider-execution --check`
for no-write local review.
The PR-23C evidence-binding line is recorded at
`docs/governance/PR_23C_EXECUTION_EVIDENCE_BINDING.md`; it binds controlled
read-only evidence to preflight, registry, permit, plan, policy, principal, and
report refs/hashes.
The controlled provider execution dispatch preflight matrix is recorded at
`docs/governance/CONTROLLED_PROVIDER_EXECUTION_DISPATCH_PREFLIGHT_MATRIX.md` and
exposed through
`npm run governance -- audit controlled-provider-execution-dispatch-preflight-boundary`;
it is a pre-runner matrix only and does not authorize provider execute.
The controlled provider execution dispatcher boundary is implemented at
`packages/governance-internal-controlled-provider-dispatcher/src/index.ts` and
exposed through
`npm run governance -- audit controlled-provider-execution-dispatcher-boundary`;
it consumes the dispatch preflight schema, provider registry selection, permit,
executor plan, environment preflight artifact binding, and governance stop
checks before handing off to the provider execution runner boundary. It
supports controlled read-only dispatch and controlled workspace-write
prepare / dispatch
to the local runner, but does not call `provider.execute` directly for
workspace-write, does not spawn Codex CLI, and does not authorize general
workspace-write.
The Phase 6 read-only provider permit lifecycle line is recorded at
`docs/governance/PHASE_6_READONLY_PROVIDER_PERMIT_LIFECYCLE_HARDENING.md`;
it keeps the same acceptance entry point while adding expiration, nonce, replay,
and store-failure coverage.
The PR-23D workspace-write permit v2 line is recorded at
`docs/governance/PR_23D_WORKSPACE_WRITE_PERMIT_V2.md`; it adds schema,
validator, rollback-binding, and single-use consumption readiness without
authorizing real workspace-write.
The PR-23E workspace-write fake canary v2 line is recorded at
`docs/governance/PR_23E_WORKSPACE_WRITE_FAKE_CANARY_V2.md`; it wires the fake
canary to permit v2, patch guard, rollback evidence, and replay blocking while
still proving zero real workspace-write, zero real Codex CLI, and zero external
writes.
The Phase 6 controlled execution runtime hardening closeout is recorded at
`docs/governance/PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_CLOSEOUT.md`;
it closes the PR-23A through PR-23F runtime-hardening stage without authorizing
real workspace-write by default.
The Phase 7 runtime operator actionability closeout is recorded at
`docs/governance/PHASE_7_RUNTIME_OPERATOR_ACTIONABILITY_CLOSEOUT.md`; it
standardizes preflight governance blocks, operator action envelopes, host
surfaces, summaries, and evidence resolution without authorizing recovery
execution.
The Phase 8 operator action lifecycle closeout is recorded at
`docs/governance/PHASE_8_OPERATOR_ACTION_LIFECYCLE_CLOSEOUT.md`; it validates
operator action receipts, expiry, replay blocking, durable receipt-store
primitives, and lockdown receipt policy without executing the recommended
action.
The Phase 9 operator action host lifecycle closeout is recorded at
`docs/governance/PHASE_9_OPERATOR_ACTION_HOST_LIFECYCLE_CLOSEOUT.md`; it wires
receipt consumption, receipt authoring, and current lifecycle state into host
clients without authorizing recovery execution.
The Phase 10 operator action executor gate closeout is recorded at
`docs/governance/PHASE_10_OPERATOR_ACTION_EXECUTOR_GATE_CLOSEOUT.md`; it adds a
plan-only executor gate that requires durable receipt proof, lifecycle binding,
action allowlists, and checkpoint-preserving plans without authorizing recovery
execution.
The Phase 11 operator action host executor boundary taskbook is recorded at
`docs/governance/PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_TASKBOOK.md`;
it defines a future non-executing authorization packet and injected host
executor descriptor boundary without authorizing recovery action dispatch.
The Phase 11 operator action host executor boundary closeout is recorded at
`docs/governance/PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_CLOSEOUT.md`;
it implements the descriptor, authorization packet, lifecycle binding, and
review result boundary without calling or exposing a side-effecting host
executor.
The Phase 12 operator action host client review surface closeout is recorded at
`docs/governance/PHASE_12_OPERATOR_ACTION_HOST_CLIENT_REVIEW_SURFACE_CLOSEOUT.md`;
it exposes the Phase 11 non-executing review through `DesktopHostClient`
current lifecycle state without bridge calls, `dispatchToHost()`, provider
execution, Codex CLI execution, workspace-write, or recovery action dispatch.
The Phase 13 operator action host executor dispatch taskbook is recorded at
`docs/governance/PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_TASKBOOK.md`;
it defines the authorization token and stop conditions for the first controlled
implementation.
The Phase 13 operator action host executor dispatch closeout is recorded at
`docs/governance/PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_CLOSEOUT.md`;
it adds dry-run and explicit injected-executor dispatch control without adding
a real recovery executor, provider execution, Codex CLI execution,
workspace-write, or `dispatchToHost()` recovery execution.
The Phase 13 agent-backed recovery executor boundary is recorded at
`docs/governance/PHASE_13_AGENT_BACKED_RECOVERY_EXECUTOR_BOUNDARY.md`;
it defines host-provided / agent-backed executor semantics and a sandbox-only
reference executor contract proof without adding production recovery logic,
Codex CLI execution, provider execution, shell execution, external writes, or
arbitrary workspace-write.
The Phase 14 agent executor receipt contract is recorded at
`docs/governance/PHASE_14_AGENT_EXECUTOR_RECEIPT_CONTRACT.md`; it normalizes
injected executor receipt statuses and stable reason codes without adding a
Codex CLI adapter, provider adapter, shell/process executor, external write,
workspace-write, or production recovery execution.
The Phase 15 agent executor adapter authorization taskbook is recorded at
`docs/governance/PHASE_15_AGENT_EXECUTOR_ADAPTER_AUTHORIZATION_TASKBOOK.md`;
it defines future adapter pre-execution requirements and exact approval
strings without authorizing Codex CLI invocation, provider invocation,
sub-agent runtime invocation, shell/process execution, external write,
workspace-write, or production recovery execution.
The Phase 15 agent executor adapter review-only closeout is recorded at
`docs/governance/PHASE_15_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_CLOSEOUT.md`;
it implements review-only adapter descriptor, packet, hash, and readiness
review surfaces without adding adapter invocation, Codex CLI invocation,
provider invocation, sub-agent runtime invocation, shell/process execution,
external write, workspace-write, or production recovery execution.
The Phase 15 agent executor adapter sandbox contract closeout is recorded at
`docs/governance/PHASE_15_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_CLOSEOUT.md`;
it implements a sandbox-only reference adapter contract witness with explicit
injection, sanitized audit, packet/readiness binding, and sandbox-contained
test artifacts without adding Codex CLI invocation, provider invocation,
sub-agent runtime invocation, shell/process execution, real workspace-write,
external write, or production recovery execution.
The Phase 16 agent executor adapter dispatch authorization taskbook is recorded
at
`docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_TASKBOOK.md`;
it defines future dispatch authorization requirements for adapter packets,
dispatch classes, side-effect classes, audit, receipts, scope, and fail-closed
behavior without implementing adapter dispatch or authorizing Codex CLI
invocation, provider invocation, sub-agent runtime invocation, shell/process
execution, real workspace-write, external write, or production recovery
execution.
The Phase 16 agent executor adapter dispatch authorization review-only closeout
is recorded at
`docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md`;
it implements dispatch authorization packet/readiness binding for `review_only`
and `none` without invoking an adapter, Codex CLI, provider, sub-agent runtime,
shell/process execution, real workspace-write, external write, or production
recovery execution.
The Phase 16 agent executor adapter dispatch sandbox dry-run taskbook is
recorded at
`docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md`;
it records the planning boundary for binding Phase 16 dispatch authorization to
the Phase 15 sandbox reference adapter contract witness under
`sandbox_contract` and `sandbox_only`.
The Phase 16 agent executor adapter dispatch sandbox dry-run closeout is
recorded at
`docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md`;
it implements the exact approved sandbox dry-run path with an explicitly
injected `sandbox_reference_adapter`, sanitized audit/evidence, and fail-closed
packet binding, without Codex CLI invocation, provider invocation, sub-agent
runtime invocation, shell/process execution, real workspace-write, external
write, production recovery, or real recovery-action execution.
The Phase 17 agent task control dispatch boundary taskbook is recorded at
`docs/governance/PHASE_17_AGENT_TASK_CONTROL_DISPATCH_BOUNDARY_TASKBOOK.md`;
it defines future `agent_task_control` and `agent_context_only` authorization
requirements for host-provided agent adapters while keeping Codex CLI
invocation, provider invocation, sub-agent runtime invocation, shell/process
execution, real workspace-write, external write, production recovery, and real
recovery-action execution blocked.
The Phase 18 agent task control dispatch sandbox dry-run taskbook is recorded
at
`docs/governance/PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md`;
it defines the sandbox-only task-control contract witness boundary.
The Phase 18 agent task control dispatch sandbox dry-run implementation is
closed out at
`docs/governance/PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md`;
it can call only an explicitly injected `sandbox_task_control_adapter` contract
witness after the Phase 18 packet and ready Phase 17 authorization review bind.
Codex CLI invocation, provider invocation, sub-agent runtime invocation,
shell/process execution, real workspace-write, external write, production
recovery, and real recovery-action execution remain blocked.

Boundary audit marker:

- `PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK_REVIEW_RECORDED`
- `PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_TASKBOOK_RECORDED`
- `PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_CLOSEOUT_RECORDED`
- `PHASE_12_OPERATOR_ACTION_HOST_CLIENT_REVIEW_SURFACE_CLOSEOUT_RECORDED`
- `PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_TASKBOOK_RECORDED`
- `PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_CLOSEOUT_RECORDED`
- `PHASE_13_AGENT_BACKED_RECOVERY_EXECUTOR_BOUNDARY_RECORDED`
- `PHASE_14_AGENT_EXECUTOR_RECEIPT_CONTRACT_RECORDED`
- `PHASE_15_AGENT_EXECUTOR_ADAPTER_AUTHORIZATION_TASKBOOK_RECORDED`
- `PHASE_15_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_CLOSEOUT_RECORDED`
- `PHASE_15_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_CLOSEOUT_RECORDED`
- `PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_TASKBOOK_RECORDED`
- `PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT_RECORDED`
- `PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK_RECORDED`
- `PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT_RECORDED`
- `PHASE_17_AGENT_TASK_CONTROL_DISPATCH_BOUNDARY_TASKBOOK_RECORDED`
- `PHASE_17_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT_RECORDED`
- `PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK_RECORDED`
- `PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT_RECORDED`

Blocked capabilities:

- `real_agent_task_control_dispatch`
- `general_workspace_write`
- `general_provider_execution`
- `recovery_action_dispatch`
- `protected_remote_write`
- `push_to_main`
- `release_tag_deploy`
- `secret_or_credential_change`
- `external_service_write`

Boundary facts for display/handoff-only pruning:

- display and handoff surfaces do not authorize execution;
- package, dependency, workflow, provider, env, secret, user config, and system
  config changes remain outside display-only pruning;
- real provider execution and real Codex CLI execution remain closed without a
  separate explicit task and approval gate;
- release, deploy, provider execution, and environment/configuration changes
  remain out of scope.


### Historical State-Sync Validation Markers

Validation recorded for source commit `content digest only`:

Current validation posture:

- non-`main` PR branch validation should use `npm run validate:daily`,
  targeted `npm test` / `npm run build` when warranted, the execution-boundary
  current surface audit, display sync checks, and GitHub CI's `pull_request`
  State Sync Audit or an explicit local pull-request context simulation;
- bare `npm run validate:pr` includes the local execution-boundary audit and
  local state-sync audit tier, and is only appropriate on local `main` or when
  the state-sync audit has an explicit PR event context;
- runtime, package, workflow, dependency, or provider changes require their
  own targeted tests and broader validation.

Current structured state-sync audit status:

- structured claim: `state-sync-policy.v2` content attestation
- upstream target: `refs/remotes/origin/main`
- source identity: filtered tree digest, not a recorded commit SHA
- branch, commit, and divergence are observed by the audit at runtime
- branch-head audit command:
  `node --import tsx scripts/run-state-sync-audit.ts --json`
- expected audit source: `claimSource: structured`
- Source-tree digest, allowed context, clean worktree, and read-only
  checks remain enforced by the state-sync audit.
- Generated display, Markdown mirrors, and `.agent_board/*` mirrors are
  optional operator-facing views derived from `docs/current/state-sync-record.json`.
- Display drift is informational; branch-head audit reads the structured
  record directly and does not require display sync.
