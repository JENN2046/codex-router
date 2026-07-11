---
title: Policy-based Codex Execution Governance Architecture
status: active
owner: governance
created: 2026-07-11
last_verified: 2026-07-11
verified_by:
  - npm run typecheck
  - targeted governance tests
  - npm run test:package-consumer
applies_to:
  - authorization
  - codex-app-server
  - preview
  - retain
  - rollback
---

# Policy-based Codex Execution Governance Architecture

## Product Boundary

`codex-router` is a governance adapter above Codex, not a parallel Codex
runtime. The official App Server remains responsible for authentication,
threads, turns, streaming, approvals, and applying accepted file changes. The
SDK adapter is read-only in this beta. Official behavior references are the
[App Server guide](https://developers.openai.com/codex/app-server),
[agent approvals and security guide](https://developers.openai.com/codex/agent-approvals-security),
and [Codex SDK guide](https://developers.openai.com/codex/sdk).

The router owns five decisions:

1. derive structured capability facts;
2. authorize the narrowest capability and approval mode;
3. preview eligible file changes in an isolated clone;
4. bind approval, preview, and post-state into evidence;
5. permit an explicit, drift-safe rollback.

It does not expose a general provider executor, directly apply proposed Codex
changes, authenticate Codex, maintain Codex history, or perform remote writes,
release, deployment, package publication, or real provider execution.

## Authorization Kernel

`CapabilityFacts` records file operations, commands, permission requests,
branch and worktree state, HEAD binding, network and credential requirements,
external targets, sensitive paths, release intent, target precision, ambiguity,
and unknowns. Semantic classification is an input signal only. It cannot grant
a capability, and effective risk is the greater of semantic and factual risk.

The shared `AuthorizationDecision` enforces these invariants on Desktop,
provider, App Server, and SDK surfaces:

- unknown or ambiguous work receives no write capability;
- high and critical risk always use `human_required`;
- authorized capability is a subset of both the request and configured ceiling;
- every factual file write is covered by a requested write scope, including
  both paths of a rename, and sensitive paths are re-derived from file facts;
- approval permits never manufacture a missing capability grant;
- structured file changes are at most conditionally `policy_auto` eligible.

Chinese and English protected-action markers are conservative. Negation,
quotation, or a low-risk hint cannot erase a protected-action signal.

## App Server Adapter

`CodexAppServerAdapter` consumes a strict versioned normalized event profile
through an injected transport. A raw App Server protocol codec must normalize
and attest a specific schema version before events enter this boundary.

The adapter correlates `(threadId, turnId, itemId)` separately from
`requestId`. It stores the complete proposed file-change set at `item_started`,
canonicalizes it, and binds the later approval request to that hash. Event IDs
and per-turn sequences are single-use and contiguous. Schema drift, missing or
late correlation, replay, gaps, unknown completion, or disconnect fails closed.
Inbound events and operator decisions share one adapter-local serial queue, and
an accept response rechecks request, turn, and session state immediately before
transport dispatch.
Replay, schema/profile drift, and disconnect irreversibly quarantine the
adapter session; later events and operator accepts require a new adapter
instance and a new attestation.

A session may enforce authorization only when its attestation proves all of:

- the exact normalized schema profile;
- effective approval policy `on-request`;
- effective sandbox policy `workspace-write`;
- file-change approval interception for the session;
- live acceptance evidence plus an in-module live isolation enforcer, or an
  explicitly allowed fake test profile bound to the internal test harness.

No live isolation enforcer ships in `0.1.0`, so live profiles are currently
always `observe_only`: they cannot auto-approve or claim governed retain.
Command and permission requests carry exact operator-visible proposals and are
human-only. Delete and rename are unsupported in the beta and are declined
before App Server application.

## File-change Lifecycle

```text
proposed -> policy_checked -> previewing -> preview_passed
         -> awaiting_approval | auto_approved
         -> accepted_by_app_server -> retained -> post_checked

uncertainty -> blocked | reconciliation_required | rollback_available
```

State transitions never infer that App Server applied a change. The adapter
requires an explicit completion event and then verifies the workspace.

## Isolated Preview

Automatic approval is available only for structured `create` and `update`
operations under a matching `autoApprovalRules` entry. Hard boundaries reject
delete, rename, command, permission, sensitive/env paths, protected branches,
dirty worktrees, HEAD mismatch, network, credentials, external targets,
release/deploy, ambiguous targets, and unknown facts regardless of policy.
Every create/update must declare an exact expected after-hash; updates must also
declare their before-hash. The public policy evaluator re-canonicalizes the
entire change set before matching a rule, so unsafe cross-platform characters,
ill-formed Unicode, path aliases, duplicate targets, non-canonical order, diff
binding drift, and canonical-hash drift cannot be made eligible by a broad path
rule.

`LocalClonePreviewer` does not trust caller-provided isolation strings. A
previewer and process runner must be registered inside the module and bound to
the same scope and enforcer identity. The default `SpawnPreviewProcessRunner`
reports both isolation capabilities as unsupported and cannot auto-approve.
The only current trusted factory is test-only, absent from package exports, and
valid only as disposable-fixture evidence; it is not an OS sandbox and cannot
support live authorization.

The previewer creates an independent temporary Git
clone with `--no-hardlinks`, removes remotes, checks for alternates, filters,
hooks, shallow history, submodules, symlink/hardlink/realpath hazards, and then
checks out the exact base HEAD. It applies the canonical patch only there and
runs policy-declared exact argv without a shell. Shell interpreters are not
allowed in auto-approval commands. Unsupported isolation, missing dependencies,
failed checks, source drift, patch drift, or cleanup failure blocks automatic
acceptance.

## Journal, Retain, and Rollback

Before an accept response, the adapter persists a pending journal binding the
request, authorization, canonical change hash, expected target hashes, preview
receipt, and retain permit. Nonces are persisted only as hashes; the journal
stores no raw diff. An unresolved journal discovered by a restarted adapter
quarantines the session for explicit reconciliation. This beta does not infer
or reconstruct an interrupted App Server turn. A first-party file consumption
store provides atomic, durable rollback replay markers across restarts. The
mutation path accepts only in-module registered consumption stores; a
caller-supplied object cannot bypass single-use enforcement. Rollback invokes
the module-private consumption closure captured at registration, not an
overridable public instance method.

The file journal uses a lock plus file fsync, rename, and directory fsync.
Directory fsync is an explicit unsupported live durability gate on Windows in
this beta; deterministic Windows tests use a documented non-live mode instead
of claiming equivalent durability. If a `blocked`, `retained`, or
`post_checked` update rejects after an atomic rename, the adapter reads the
journal back and accepts only an exact state, binding, reason, and receipt match.
An absent or mismatched read-back moves the item and journal to
`reconciliation_required`; terminal journal states may make only this
conservative downgrade. Failed reconciliation writes retain every sanitized
reason and retry on the next serialized operation. The adapter never publishes
an in-memory retain state before its matching journal transition commits.

After App Server reports `applied`, retain verification requires the same HEAD
and repository identity, exact changed-target set, clean index, matching before
and after byte hashes, safe topology, and no outside modification. Success
creates a `RetainReceipt`; partial or uncertain state requires reconciliation.

Rollback is a new operator action, not an implication of retain. A
`RollbackPermit` is receipt-bound, expiring, nonce-hashed, and consumed before restore.
Rollback proceeds only while HEAD, repository identity, exact targets, index,
and every after-hash still match the receipt. Target or outside drift blocks it
to preserve later human work. Restore failure or ambiguous post-state requires
reconciliation. The public API always uses the controlled Git primitive; the
injected primitive seam is internal to deterministic tests. A repository-local
coordinator lock and an adjacent second precondition check close the tested
preflight race. Operators must still quiesce non-cooperating external editors,
because ordinary filesystems provide no cross-platform compare-and-swap that
third-party editors are forced to honor.

## Public Surface and Compatibility

The package intentionally exports only `protocol`, `policy`, `codex-adapter`,
`evidence`, and `provider`. There is no `.` export. `provider` contains manifest,
capability, security-boundary helpers, and the `GovernanceProvider` SPI; it does
not expose generic execution. Agent OS, Desktop host, MCP/A2A, store, telemetry,
and legacy contracts remain repository-internal. One legacy path may adapt into
kernel contracts, but new authorization code must not consume legacy contracts.

## Beta Acceptance Boundary

Deterministic tests use disposable repositories, fake transports, and versioned
fixtures. CI is configured for Linux, Windows, macOS and Node 20/22, plus an `npm pack`
blank-consumer type test. Ordinary CI does not run real Codex CLI, a real App
Server, provider execution, source-workspace writes, network canaries, release,
or deployment. Live schema generation and App Server acceptance require a new,
exact operator authorization and are not implied by fake acceptance.

`npm run test:governance-coverage` enforces at least 90% branch coverage for
authorization, preview, and retain/permit/rollback. Current local results are
96.83%, 91.12%, and 90.29% respectively. Remote matrix CI evidence is not yet
available from this uncommitted worktree. `npm run test:governance-properties`
runs deterministic seeded path, permit-replay, and event-order properties.
