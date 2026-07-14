---
title: ADR 007: App Server Proposal-before-apply Feasibility
status: proposed
owner: governance
created: 2026-07-14
last_verified: 2026-07-14
verified_by:
  - npm run audit:app-server:proposal-capability
  - node --import tsx --test tests/codex-app-server-proposal-capability.test.ts
supersedes: []
superseded_by: null
applies_to:
  - codex-app-server
  - file-change
  - approval
  - live-smoke
---

# ADR 007: App Server proposal-before-apply remains review-only

## Context

The earlier live decline-only experiment showed that `workspace-write` with
`on-request` does not guarantee a file-change approval request before an
in-workspace edit. A next attempt is allowed only if the protocol proves a
client-controlled delayed-apply barrier or if the proposal is generated under
an effective read-only boundary. This ADR records a source-only investigation;
it does not run Codex, App Server, a client, or workspace-write.

## Decision

Keep every real App Server workspace-write smoke blocked. The current public
protocol does not expose a distinct delayed-apply request, capability, or
response field. `item/fileChange/patchUpdated` is a notification rather than a
client-controlled pause, and its feature remains under development and disabled
by default.

A commit-pinned source review identified one narrower conditional path: a
thread whose effective permission profile is managed `read-only`, whose
approval policy is `on-request`, whose reviewer is the user, and whose client
is mechanically decline-only. The fixture records review claims; it does not
mechanically derive facts from source blobs or bind an installed runtime's
effective configuration. The assessment therefore remains `blocked`, not
execution-authorized. The existing live-smoke preflight stays fully blocked.

## Versioned evidence

The offline fixture is bound to official `openai/codex` commit
`5bed6447998c754d154dbd796517310b8f04d4ce`:

- The [App Server README](https://github.com/openai/codex/blob/5bed6447998c754d154dbd796517310b8f04d4ce/codex-rs/app-server/README.md#file-change-approvals)
  documents `item/started → requestApproval → client response → item/completed`
  and describes `patchUpdated` only as a pre-execution streaming notification.
- [Patch safety](https://github.com/openai/codex/blob/5bed6447998c754d154dbd796517310b8f04d4ce/codex-rs/core/src/safety.rs#L32)
  returns `AskUser` when a managed read-only profile has no writable target.
- [Apply-patch decision mapping](https://github.com/openai/codex/blob/5bed6447998c754d154dbd796517310b8f04d4ce/codex-rs/core/src/apply_patch.rs#L34)
  maps `AskUser` to `NeedsApproval` and maps a writable in-workspace patch to
  `Skip`.
- [The apply-patch handler](https://github.com/openai/codex/blob/5bed6447998c754d154dbd796517310b8f04d4ce/codex-rs/core/src/tools/handlers/apply_patch.rs#L407)
  emits the full file-change start item before calling the orchestrator.
  Its effective-permission resolution can fall back to an unrestricted policy
  when environment or path resolution fails, so a future proof must bind a
  native/local environment, resolved target paths, and successful effective
  permission resolution.
- [The apply-patch runtime](https://github.com/openai/codex/blob/5bed6447998c754d154dbd796517310b8f04d4ce/codex-rs/core/src/tools/runtimes/apply_patch.rs#L130)
  checks preapproved permissions and cached approvals before requesting a new
  user decision, so both must be absent from a future candidate.
- [The tool orchestrator](https://github.com/openai/codex/blob/5bed6447998c754d154dbd796517310b8f04d4ce/codex-rs/core/src/tools/orchestrator.rs#L152)
  resolves `NeedsApproval` before invoking the runtime.
- [Approval resolution](https://github.com/openai/codex/blob/5bed6447998c754d154dbd796517310b8f04d4ce/codex-rs/core/src/tools/approvals.rs#L254)
  turns a user decline into an error, so the orchestrator returns before its
  runtime attempt.
- The [feature registry](https://github.com/openai/codex/blob/5bed6447998c754d154dbd796517310b8f04d4ce/codex-rs/features/src/lib.rs#L952)
  marks `apply_patch_streaming_events` as under development and disabled by
  default.
- The [v2 approval schema](https://github.com/openai/codex/blob/5bed6447998c754d154dbd796517310b8f04d4ce/codex-rs/app-server-protocol/src/protocol/v2/item.rs#L1514)
  has correlation, reason, and `grantRoot` fields but no delayed-apply contract.

Run the deterministic audit with:

```bash
npm run audit:app-server:proposal-capability
```

Its passing process result means only that the expected conditional source path
was identified. The assessment itself is `blocked`, with
`sourceReviewConditionalPathIdentified: true`,
`runtimeConfigurationBound: false`, and `liveSmokeEligible: false`. It cannot
relax the existing preflight.

## Required independent security review

Before any live client is proposed, a separate review must prove all of the
following against the exact installed Codex/App Server version and generated
schema:

1. effective sandbox is managed `read-only` with no writable roots;
2. approval policy is `on-request` and reviewer is the user;
3. strict auto-review is disabled;
4. no session or turn write grant already exists;
5. no cached patch approval exists and `permissionsPreapproved` is false;
6. native/local environment and every target path resolve successfully, without
   the unrestricted permission fallback;
7. all tool hooks are disabled, including pre/post tool-use hooks and any
   permission-request hook;
8. the session and thread are fresh and isolated, the approval store is empty,
   and no command, network, or external-tool activity is possible;
9. the terminal client encoder can emit only decline/cancel and cannot encode
   accept, session accept, permission grants, or policy amendments;
10. version, exact effective configuration, source evidence, raw-message order, and final
   workspace hashes are bound into the receipt.

Any missing or drifted condition is `NO-GO`. Even after review, starting App
Server or a client requires a new, exact operator authorization.

## Alternatives Considered

- Treat `patchUpdated` as a delayed-apply barrier.
  - Rejected: it is an under-development notification and exposes no client
    acknowledgement that controls application.
- Retry `workspace-write + on-request` with a stricter prompt.
  - Rejected: prompt intent cannot override the auto-approval path for a patch
    inside writable roots.
- Mark the read-only source finding as an executable candidate.
  - Rejected: installed-version equivalence, effective permissions, hooks,
    grants, reviewer routing, and terminal decline enforcement still require an
    independent security review.

## Consequences

- `workspace-write + on-request` remains permanently unsuitable as interception
  proof because an in-workspace patch may be auto-approved and applied.
- `patchUpdated` is useful evidence but is not an application barrier.
- The read-only conditional path can advance only through a separate
  security-review PR that replaces self-reported claims with mechanically bound
  evidence. This ADR and its fixtures do not authorize a real smoke.

## Verification

- `npm run audit:app-server:proposal-capability`
- `node --import tsx --test tests/codex-app-server-proposal-capability.test.ts`
- `npm run docs:governance`
- `npm run typecheck`

Real Codex CLI, real App Server, a live client, provider execution, and real
workspace-write are explicitly outside this verification.

## Change Control

Changing `liveSmokeEligible`, relaxing the existing pre-connection gate, adding
a supported source commit, or recognizing a delayed-apply/read-only proposal
mechanism requires a separate security-review PR with negative-path tests. A
subsequent live run still requires exact operator authorization.
