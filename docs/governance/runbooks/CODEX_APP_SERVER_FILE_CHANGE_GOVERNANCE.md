---
title: Runbook: Codex App Server File-change Governance
status: active
owner: governance
created: 2026-07-11
last_verified: 2026-07-14
verified_by:
  - node --import tsx --test tests/codex-app-server-v2-wire.test.ts
  - node --import tsx --test tests/codex-app-server-adapter.test.ts
  - node --import tsx --test tests/retain-control.test.ts
  - npm run test:package-consumer
  - node --import tsx --test tests/codex-app-server-live-smoke-safety.test.ts
  - npm run test:app-server:offline-harness
  - npm run audit:app-server:proposal-capability
applies_to:
  - codex-app-server
  - file-change
  - preview
  - retain
  - rollback
---

# Runbook: Codex App Server File-change Governance

## Purpose

Validate the deterministic file-change governance loop with a fake normalized
transport, or review the preconditions for a separately authorized live App
Server acceptance. This runbook never authorizes a live run by itself.

## Preconditions

- The repository dependencies are already installed from `package-lock.json`.
- The test path uses only disposable repositories under the platform temp root.
- The normalized fixture profile and session attestation have exact identities.
- Fake acceptance uses the internal test-only preview factory; a caller-provided
  isolation string or the default spawn runner is insufficient.
- No secret, provider credential, live Codex process, remote write, release, or
  deployment is required.
- A live schema/smoke command has a fresh exact authorization before it is run.

## Required Environment

- Node.js 20 or 22, npm, and Git.
- A local checkout and dependencies installed by `npm ci` when setup is needed.
- No Codex binary, API key, provider credential, network access, or production
  environment is required for deterministic acceptance.

## Required Commands

```bash
node --import tsx --test tests/authorization-kernel.test.ts
node --import tsx --test tests/codex-app-server-adapter.test.ts
node --import tsx --test tests/file-change-preview.test.ts
node --import tsx --test tests/retain-control.test.ts
npm run test:governance-coverage
npm run test:governance-properties
npm run typecheck
npm run build
npm run test:package-consumer
npm run audit:app-server:proposal-capability
```

The package-consumer command runs `npm run build` before `npm pack`, so it can
be invoked directly after `npm ci` without a separate build prerequisite.

Do not substitute a real App Server, Codex CLI, provider, or source-workspace
write command without new operator authorization for that exact command.

The repository exposes a fail-closed preflight only:

```bash
npm run smoke:app-server:file-change:preflight
```

For the historical `workspace-write` + `on-request` plan it must report
`workspace_write_on_request_cannot_prove_file_change_interception` with
`connectionAllowed: false`; it must not start App Server, construct a socket,
connect a client, or attempt workspace write. That configuration permits
in-sandbox edits and is not evidence that a file-change approval will be
intercepted. Every future live harness must call
`assertAppServerFileChangeInterceptionPreConnection(...)` before constructing
its transport. The current gate has no eligible branch: even a safe-shaped plan
remains blocked with `app_server_file_change_interception_unproven`. A future
change may introduce eligibility only after an enforcement layer produces
evidence bound to the exact App Server version, transport, runtime
configuration, and plan for either a deferred patch that cannot be applied
before governance or a proposal channel enforced as `read-only`. Changing a
global boolean or accepting a caller-declared proposal mode is insufficient. Do
not run another live file-change smoke before that separately reviewed
mechanism exists.

The commit-pinned offline feasibility decision is recorded in
`docs/governance/decisions/ADR_007_APP_SERVER_PROPOSAL_BEFORE_APPLY.md`. It found
no delayed-apply protocol contract. It identified a narrower managed
`read-only` + `on-request` + user-review + decline-only conditional source path,
but the fixture contains review claims rather than mechanically bound runtime
evidence. The assessment remains `blocked`, `liveSmokeEligible` remains `false`,
the current preflight remains fully blocked, and a separate security review plus
exact new authorization are required before any live client is considered.

That independent review is recorded in
`docs/governance/decisions/ADR_008_APP_SERVER_EXACT_VERSION_SECURITY_REVIEW.md`
and is reproducibly checked with:

```bash
npm run audit:app-server:exact-version-security-review
```

The review receipt records that the installed `0.144.1` Linux binary matched
the official release archive during the review session, together with the
observed `rust-v0.144.1` source commit and semantic schema digests. The
repository command checks that this receipt still matches pinned literals; it
does not re-read the current binary, release archive, source checkout, or
generated schema, so all three current `*Bound` fields remain `false`. Its
result is `blocked / no_go`: effective
configuration, session and turn grants, cached approvals, native path
resolution, hook state, approval-store state, terminal client binding,
proposal-before-apply runtime order, and final clone hashes remain unobserved.
The command's successful exit means the recorded fail-closed receipt is intact;
it does not mean a live run is eligible. The existing preflight must remain
blocked.

## Offline no-environment proposal contract

The only implemented proposal candidate that does not expose a workspace
environment is the offline contract in
`packages/codex-adapter/src/no-environment-proposal.ts`. Validate it with:

```bash
npm run test:app-server:no-environment-proposal
```

The contract requires all of the following:

- `thread/start.environments` and `turn/start.environments` are exactly `[]`;
- thread `dynamicTools` is exactly `[]`, input is one text item, approval is
  `never`, permissions are `:read-only`, and the final message uses the pinned
  structured `outputSchema`;
- local image, skill, MCP, web, dynamic, provider, collaboration, extension,
  process, shell, command, permission, approval, and file-change activity is
  prohibited;
- only one strict `0.144.1`, nonce/sequence-bound, replay-consumed and
  correlated `agentMessage` lifecycle may produce the final proposal;
- schema version, exact target, base SHA-256, after SHA-256, operation, diff
  size, standalone password/token/secret/private-key markers, and event order
  are fail-closed;
- verification rejects dirty sources, Git attributes, filters, fsmonitor and
  upload-pack hooks, local config includes, `core.worktree`, worktree config,
  external excludes, `commondir`, partial clones, alternates, `.gitmodules`,
  committed or staged mode-`160000` gitlinks, unsafe target/temp topology,
  ordinary and ignored extra paths, mode drift, hash drift, and cleanup failure;
- case-folded `.git` and trailing-dot/space path aliases are rejected;
- source target and local config reads bind parent and file identities to a
  no-follow handle; concurrent replacement blocks before content read;
- local config is read once, all config queries consume that frozen snapshot
  through stdin, and Git children force safe built-in upload-pack behavior;
- HEAD mismatch and index gitlinks block before status, while every
  worktree-aware source Git query is explicitly bound to the real source root
  and uses `--ignore-submodules=all` where status is inspected;
- the patch is applied only in an independent clone with its remote removed;
  source HEAD, status, and target hash must remain unchanged.

The contract deliberately records
`effectiveToolInventoryMechanicallyBound: false`,
`liveExecutionAuthorized: false`, and
`realWorkspaceWriteAuthorized: false`. A passing offline test proves only the
local contract and disposable-clone verifier. It does not prove that a live App
Server has no inherited MCP, web, extension, collaboration, or other tool
surface, and it never authorizes starting App Server or a client.

The offline decline-only harness is validated with:

```bash
npm run test:app-server:offline-harness
```

This deterministic offline suite uses versioned wire fixtures, an in-memory
server sink, and a `test_only` observe-only adapter. Its safety and quiescence
tests also create disposable local Git repositories and files below the host
temporary directory. It does not start Codex or App Server, create a socket,
access a provider, call a workspace context provider, run preview commands,
apply an App Server file change, or modify the source workspace. Raw fixtures are serialized through the
recorded boundary, v2 normalizer, and governed adapter. Every file-change,
command, network, and permission approval is then bound to exactly one decline.
The terminal wire guard rejects accept, session accept, cancel, policy
amendments, and non-empty permission grants before the fake server sink.

The offline proof receipt deliberately reports
`appServerApplyTimingProven: false` and `liveSmokeEligible: false`. It proves the
harness ordering and response restriction, not when a real App Server applies a
file change. `APP_SERVER_FILE_CHANGE_INTERCEPTION_PROVEN` therefore remains
`false` and the real preflight remains blocked.

Validated non-governance server requests are returned by the general v2 bridge
for an owning client. This restricted harness has no credential, dynamic-tool,
attestation, MCP, user-input, or external-clock owner, so any passthrough request
stops and disconnects the harness instead of being answered or ignored.

Any future authorized live harness must run App Server against an independent
`git clone --no-local --no-hardlinks --no-checkout` fixture. It must remove the
clone's remote before checkout, reject object alternates, tracked
`.gitattributes`, configured Git filters, dirty state, HEAD drift, and unsafe
target topology. Clone inspection, checkout, later Git verification, and the App
Server process must all use the same returned sanitized process environment;
host global/system Git configuration is disabled and repository-local filters
remain forbidden. The source repository is never the App Server workspace.

Before each inbound message reaches the v2 normalizer, and before each outbound
message is sent, the harness must durably append a mode-`0600` sanitized JSONL
wire entry. Entries preserve direction, sequence, safe method name, hashed
request/correlation identities, payload shape, and explicit approval decision.
They never retain prompts, diffs, commands, tokens, arbitrary metadata, raw
provider responses, or raw request ids.

After the fake sink confirms an outbound response, the recorder durably appends
a separate sanitized delivery acknowledgement. The offline proof requires the
ordered triple `inbound approval request → outbound decline attempt → delivery
acknowledgement`. A send failure or acknowledgement persistence failure enters
delivery-uncertain reconciliation and can never produce a passing proof.

The client-originated `initialize` request and `initialized` notification are
recorded as outbound; the initialize response and all server events are recorded
as inbound. Raw intake, immediate manual decline, and disconnect share one
serial queue so a later resolution frame cannot overtake the decline.

After every disconnect or failure, the harness must continue sampling HEAD,
porcelain status, safe target topology, target hashes, and a recursive workspace
filesystem-metadata fingerprint for a complete quiet period. The fingerprint
includes file/directory topology, inode identity, size, ctime, and mtime, so an
ordinary write-and-revert between content samples remains monotonic evidence of
mutation. Any mutation visible in these retained metadata or content/status
samples permanently blocks the result. Only an unchanged final snapshot under
this explicit detection model may be reported as an unchanged smoke workspace.
Disconnect failure does not skip this sampling; it forces a blocked result even
when the subsequent quiet-period snapshots are unchanged.

## v2 Wire Normalization Boundary

Raw v2 App Server messages must pass through the exported
`CodexAppServerV2WireNormalizer` before they reach `CodexAppServerAdapter`.
The normalizer accepts only the versioned item/approval/resolution/completion
messages and explicitly validated non-governance requests in its wire allowlist,
and quarantines the session on unknown methods, extra fields, replay,
correlation drift, unsupported methods, or invalid command/permission schemas.
`item/started` and `item/completed` cover every
known App Server `ThreadItem` lifecycle type; non-file items are ignored after
the bounded type/id check, while unknown item types remain schema drift and
quarantine the session. Command, network, and permission requests use the
manual-only codecs described below.

Approval request `startedAtMs` is optional compatibility metadata: when present
it is strictly validated, but the governance correlation does not require it.
The documented unstable file-approval `grantRoot` field is not wire compromise:
it is preserved in the operator-visible `file_change` proposal and forces
`manual_required`. Codex-router never policy-auto approves the session-scoped
root request and never emits `acceptForSession`; an operator decline is encoded
as the ordinary file-approval `{ decision: "decline" }` response.

The normalizer is not ready until the exact `initialize` response for its bound
request id has been accepted and the client `initialized` notification has been
sent. Pre-handshake events, handshake replay, transport close, and any blocked
wire message must be routed through `CodexAppServerV2WireAdapter`, which emits a
normalized `transport_disconnected` event to reconcile the governed adapter.

After the handshake, ordinary client-call JSON-RPC responses with `{ id,
result }` or `{ id, error }` are accepted and ignored by governance; malformed
error envelopes remain fail-closed. Optional W3C `trace` metadata is strictly
validated only on server requests and is never an authorization input.
Documented `turn/started` and `turn/completed` notifications use `{ turn }`; an
optional `threadId` is compatibility metadata and is not required for the
ignore path. Experimental `thread/settings/updated` is also a diagnostic-only
notification: codex-router validates its `threadId` and complete effective
`threadSettings` snapshot, then ignores it without changing capability,
authorization, preview, or approval state.

The explicit non-governance server-request allowlist is
`item/tool/requestUserInput`, `mcpServer/elicitation/request`, `item/tool/call`,
`account/chatgptAuthTokens/refresh`, `attestation/generate`, and experimental
`currentTime/read`. Each documented payload is strictly validated and returned
as `passthrough`; these requests never enter `CodexAppServerAdapter`, never
grant capability, and are not answered by codex-router. The owning App Server
client must apply its own user-input, MCP, dynamic-tool, credential,
attestation, or external-clock security boundary before answering. It also
retains response correlation for the forwarded JSON-RPC request. For user-input
and MCP elicitation requests, codex-router tracks the request id only so the
documented matching `serverRequest/resolved` notification can be validated and
ignored. MCP elicitation metadata accepts both the public README's `meta` and
the generated protocol schema's `_meta` spelling, but they are mutually
exclusive within one request. Either value must still pass the bounded JSON
validator and is never interpreted as capability or approval.
Malformed passthrough requests, unknown or legacy approval request
methods, request replay, and resolution drift still quarantine the session.
Before hashing or schema parsing, every inbound wire message passes an
iterative JSON-shape check capped at 64 levels, 50,000 values, and 8 MiB of
string/key code units. Cycles, accessors, non-JSON values, or limit overflow
quarantine the session without recursive parsing. Unexpected normalizer
exceptions are also converted into transport disconnect/reconciliation rather
than escaping the bridge.

The v2 `item/started` payload does not carry a trusted Git HEAD or target
hashes. Callers must inject an evidence provider that returns one full HEAD and
the exact before/after hash for every path. Missing or mismatched evidence,
move paths, and invalid hash semantics fail closed; the normalizer never
derives these values from a turn diff.

The wire transport maps only internal `accept`/`decline` decisions. File,
command, and network approvals use `{ id, result: { decision } }`. When a
command approval also carries `networkApprovalContext`, the manual command
proposal preserves the exact `host` and `protocol`; operators must never be
shown a command proposal that hides its accompanying network target. Command
and network proposals also preserve the advertised `availableDecisions`. If
that list excludes plain `accept` or `decline`, the operator must select an
exact advertised wire decision, including its exec or network policy amendment
payload; the adapter and normalizer both reject changed, unadvertised, or
disposition-mismatched selections instead of collapsing them to `accept`. A
permission accept must carry an explicit operator-selected `permissionGrant`; both the
adapter and wire normalizer verify that every selected field, root, and entry
is a permission-monotone subset of the requested permission profile before
sending it. Write roots and entries may be narrowed. Read roots and entries may
also be narrowed only when the selected profile contains no write access; any
selected write must preserve every requested read carve-out. Every requested
`deny`/compatibility-`none` entry and the exact `globScanMaxDepth` constraint is
preserved for file-system grants. Representation rewrites, missing constraints,
missing grants, and expanded grants remain pending and fail closed. Omitted
permission families and roots are denied, while a decline sends an empty
`{ "permissions": {} }` profile. Permission grants remain turn-scoped; session
persistence and `strictAutoReview` are not exposed by this governance path.
Permission parsing accepts both README-style omitted nullable fields and the
generated v2 TypeScript form that serializes those fields as `null`; nullable
`entries` or `globScanMaxDepth` values remain schema errors.
`acceptForSession`, `cancel`, and unknown request ids are never auto-mapped.
Command approval hints such as
`availableDecisions` do not grant authorization. Experimental
`additionalPermissions` and `environmentId` are canonicalized into the
operator-visible command/network proposal so an `accept` decision cannot hide
requested sandbox scope or its execution environment. Command and network-only
requests are always normalized as `manual_required` proposals; they never enter
policy auto-approval.

When the App Server clears an unanswered approval, `serverRequest/resolved`
contains no client decision; the normalizer records this as `cancelled` so the
adapter reconciles the pending request instead of treating cleanup as schema
drift.

Only `remoteControl/status/changed` with `status: "disabled"` is ignored. The
documented startup-disabled snapshot may omit `installationId`; active status
still quarantines the session. Governed paths containing literal backslashes
are rejected before path canonicalization.

Documented item progress notifications (`item/agentMessage/delta`,
`item/plan/delta`, reasoning deltas, command output/terminal interaction,
MCP-tool progress, and legacy file-change output deltas) are validated against
their correlation fields and then ignored. They carry no authorization input;
malformed progress or an unknown notification method still quarantines the v2
session. Repeated valid ignored chunks are not replay failures:
replay protection remains on request-id messages and governed file
lifecycle/resolution events. Normal `thread/status/changed` transitions to
`active`, `idle`, or `notLoaded` are validated and ignored; the paired
`thread/closed` notification emitted by routine idle unload is also validated
and ignored when that thread has no open governed item or approval. An unload
or close with open governance quarantines the session for reconciliation;
`systemError`, unknown status variants, and malformed status or close payloads
also quarantine it. The deprecated `thread/compacted` diagnostic is validated
and ignored.
The documented `turn/plan/updated` shape is keyed by `turnId` (optional
`threadId` is compatibility metadata). Plan, token-usage, model
buffering/reroute/verification, moderation, error, and warning diagnostics are
validated and ignored. The `error` diagnostic accepts either the documented
exact `{ error }` payload or the complete generated-protocol
`{ error, threadId, turnId, willRetry }` payload; partial correlation metadata,
malformed errors, and unknown fields still quarantine the session. MCP startup
status and approval auto-review
start/completion events are also validated and ignored; auto-review status,
risk, or authorization hints never grant capability or bypass the manual
command/permission boundary. The `collabToolCall` ThreadItem tag is accepted
for lifecycle-only events. App Server permission profiles may encode a
no-access filesystem entry as `access: "none"`; this is accepted as a distinct
non-grant value and preserved for manual review.

`item/fileChange/patchUpdated` is not an ignored hint. Each non-empty structured
snapshot before approval is rebound to fresh path/hash evidence and emitted to
the governed adapter as `item_updated`, replacing the still-`proposed` canonical
change set. A consecutive duplicate of the current snapshot is harmless, but a
superseded historical canonical snapshot fingerprint may not reappear: that
rollback-like sequence quarantines the session instead of moving approval
evidence backward. The fingerprint uses the same diff canonicalization as the
governed change set, so line-ending and nullable-field encoding variants cannot
bypass history. Snapshot history is bounded and exceeding the bound also fails
closed. An
empty/incomplete snapshot invalidates the current approval binding until a later
complete snapshot arrives. Unknown items, duplicate paths, moves, literal
backslashes, base-HEAD drift, snapshots after an approval request, or a
completion that does not exactly match the latest snapshot quarantine the
session before stale evidence can be approved.

## Procedure

1. Confirm the session attestation matches the normalized fixture profile.
2. Ingest `item_started` and verify the full change set has a canonical hash.
   When patch streaming is enabled, verify every later `item_updated` replaces
   that hash before approval and completion binds to the latest snapshot.
3. Ingest the approval request and verify request/item/thread/turn correlation.
   A duplicate file approval or completion without a stored proposal must mark
   the whole turn reconciliation-required before any later event is processed.
4. Confirm command and permission requests expose exact argv/cwd or permission
   scope and return `manual_required`; cancelled requests reject late accepts.
5. For file changes, confirm shared authorization runs before preview.
6. Confirm preview uses an independent no-hardlink clone, exact HEAD, no remote,
   exact argv, and an in-module trust binding. Confirm the default spawn runner,
   forged caller claims, and test-to-live scope promotion all fail closed.
7. Confirm the pending journal reaches durable storage before an accept response.
8. Immediately before accept dispatch, confirm HEAD, branch, clean worktree
   state, each existing source target's topology, every update `beforeHash`, and
   every create target's absence. On drift, confirm the journal becomes
   `blocked` before a decline is sent; topology failures must not read target
   content. Rematerialize base checkout bytes and require every update hash to
   be restorable. Paths whose effective filter driver has a configured clean,
   smudge, or process command, plus tracked submodules, must block before
   status; an unused global filter driver alone is allowed. Status keeps
   fsmonitor, submodule traversal, lazy fetch, and optional index locks off.
   Keep filter inventories and stdin byte-preserving; unsupported path encoding
   blocks explicitly. Reject any proposed `.gitattributes` path and any target
   that aliases an effective in-repository config or attribute source.
   Partial/promisor clones must block before object reads.
9. Let the fake transport apply the change only in its disposable source repo.
10. Ingest resolution and completion, then verify the permit-bound pre-accept
    worktree hashes, actual post-state hashes, and no outside changes. Recreate
    base bytes in a disposable alternate index/worktree so EOL and other
    built-in checkout conversions are exact; external filter commands active
    on inspected paths fail closed before status or checkout. Governed Git
    paths remain literal and HEAD inputs must be full object IDs. Disable
    sparse/split-index inheritance in that disposable snapshot and prohibit
    lazy fetch. Retain filter inspection must include untracked create targets.
    For a retained or post-checked policy-auto journal, require the journal,
    retain permit, and retain receipt to carry one identical preview receipt
    hash; missing or mismatched bindings must fail journal parsing.
11. Exercise disconnect, event gap/replay, schema drift, failed preview, drift,
    restart with an unresolved journal, concurrent resolution/operator input,
    and rollback conflict/race cases; each must fail closed and a quarantined
    session must never resume acceptance.
12. Run the blank-consumer test to verify only the five public subpaths resolve.

For a live candidate, stop after reviewing the attestation unless the exact
schema-generation and smoke commands are separately authorized. Never infer
interception from configuration alone.

## Expected Result

- Safe test-fixture create/update may reach `accepted_by_app_server` only after
  authorization, test-bound preview, and pending journal persistence. No live
  profile can do so in `0.1.0` because no live OS isolation enforcer ships.
- Completion becomes `post_checked` only after retain verification.
- Human and automatic decisions share the same authorization contract.
- Uncertain event or workspace state becomes blocked or reconciliation-required.
- No deterministic test touches the working repository being validated.

## Blocking Conditions

- effective approval policy is not `on-request`;
- sandbox is not `workspace-write`;
- file-change interception is not proven for the session;
- a sanitized wire transcript was not durably recorded before normalization and
  before each outbound response;
- the App Server workspace is not a remote-free, no-alternates, independent
  no-hardlink clone, or a post-disconnect quiet period was not observed;
- schema profile, event identity, sequence, or correlation is missing/mismatched;
- file facts omit a matching requested write scope or a derived sensitive path;
- the proposed set is not fully canonical, including duplicate/case-alias paths,
  unsafe cross-platform characters, ill-formed Unicode, or ordering/hash drift;
- proposal contains delete, rename, sensitive path, a missing create/update
  after-hash, or a missing update before-hash;
- command or permission proposal lacks exact operator-visible details;
- proposal contains
  protected branch, network/external, credential, or release/deploy behavior;
- canonical diff content contains a credential-like marker, even when supplied
  capability facts claim `credentialAccess: "none"`;
- source worktree is dirty, HEAD differs, targets are ambiguous, isolation is
  unsupported/unnamed, a check fails, or cleanup cannot be proven;
- an inspected path has an effective filter attribute whose driver configures
  a clean, smudge, or process command; tracked submodules are present; or base
  checkout bytes cannot reproduce a declared update `beforeHash`;
- a proposed path is `.gitattributes` at any depth or aliases an effective
  repository-local Git config/global-attributes source;
- repository metadata declares a partial/promisor clone or a required object is
  unavailable locally;
- immediately before acceptance, an update target has hash or topology drift, a
  create target exists, or an existing final target is not a regular single-link
  file;
- a duplicate file approval or completion without a stored proposal proves
  turn correlation drift;
- post-state is partial, outside-target, drifted, or unknown;
- rollback-time checkout configuration cannot reproduce every receipt
  `beforeHash` before permit consumption;
- live execution lacks exact operator authorization.

## Evidence Produced

Allowed evidence is limited to schema/profile identifiers, request/item/thread/
turn IDs, canonical hashes, decision/reason codes, check argv hashes and status,
journal state, receipt IDs, target paths and byte hashes, cleanup status, and
sanitized test results. Do not store raw prompts, raw provider responses,
secrets, environment values, or unredacted command output.

## Rollback

Rollback requires a new `RollbackPermit` bound to the `RetainReceipt`. Before
restore, verify repository identity, HEAD, exact changed-target set, clean index,
safe topology, and each current after-hash. Use durable permit consumption,
acquire the coordinator lock, and repeat the checks adjacent to mutation.
Any `filter.*.clean`, `filter.*.smudge`, or `filter.*.process` command whose
driver is active on an inspected path blocks rollback before permit consumption
and is checked again inside the restore primitive; unrelated installed drivers
do not block. The restore subprocess neutralizes all drivers observed on the
exact update targets, without expanding unrelated tracked drivers into its
environment, and command values are never retained as evidence.
Any drift blocks rollback; any restore or post-check uncertainty enters
`reconciliation_required`. Quiesce external editors: the coordinator lock is
honored by codex-router operations but cannot force an unrelated editor to
participate. Quiescence covers worktree targets, `.gitattributes`,
`.git/info/attributes`, `core.attributesFile`, config include targets, and
local/global/system Git config; changing an attribute source after inspection
can select a previously unobserved driver.

## Incident Handling

- Replay, disconnect, or schema/profile drift: quarantine the full adapter
  session, mark open items reconciliation-required, and require a new attested
  session rather than resuming acceptance.
- Restart with unresolved journal state: quarantine and hand the sanitized
  journal target hashes to explicit reconciliation; do not infer apply outcome.
- Unknown or partial completion: preserve hashes and reason codes, then stop.
- Accept-adjacent source drift: persist `blocked`, decline the request, and
  require a new proposal; do not reuse the reviewed or previewed decision.
- Any attempt to use the default spawn runner or a caller-forged isolation claim:
  block before repository inspection or policy command execution.
- Unsafe evidence: remove raw material and retain only approved hashes/statuses.

## Post-run Documentation

Record exact commands and pass/fail status, whether only fake transport was used,
whether live integration was explicitly not run, and all remaining gaps. Do not
change current-state authority or claim production readiness from fixture tests.
