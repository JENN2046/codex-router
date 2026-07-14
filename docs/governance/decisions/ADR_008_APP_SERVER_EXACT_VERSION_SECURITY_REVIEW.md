---
title: ADR 008: App Server Exact-Version Security Review
status: active
owner: governance
created: 2026-07-14
last_verified: 2026-07-14
verified_by:
  - npm run audit:app-server:exact-version-security-review
  - node --import tsx --test tests/codex-app-server-exact-version-security-review.test.ts
supersedes: []
superseded_by: null
applies_to:
  - codex-app-server
  - file-change
  - approval
  - live-smoke
  - security-review
---

# ADR 008: App Server exact-version review is NO-GO

## Context

ADR 007 identified a conditional source path in which a managed read-only
permission profile with no writable roots may ask the user before applying a
patch. It required an independent review against the exact installed Codex/App
Server version before any live client could be proposed. This review stays
offline: it does not execute Codex, start App Server, connect a client, call a
provider, or attempt workspace write.

## Exact reviewed artifact

The installed standalone package reports:

- version `0.144.1`;
- target `x86_64-unknown-linux-musl`;
- variant `codex`;
- installed binary SHA-256
  `a96f944d1a596dbfb7fdd84f482be5c50e34b04bb371126840d873e4ebf26902`.

The official release archive
`codex-x86_64-unknown-linux-musl.tar.gz` has SHA-256
`84091ae20c65fcc7d4120db97d1bd57d7ff8df9c7609fb781c78c2ebbd4f5a28`.
During this review session, extraction and comparison showed that its binary
matched the installed binary byte-for-byte. The
official tag `rust-v0.144.1` resolves through tag object
`db75c19352d29ef29c17dbcf73a7244f1b1a8d10` to source commit
`44918ea10c0f99151c6710411b4322c2f5c96bea`.

Previously authorized installed-CLI schema output was compared with the JSON
schema committed at that tag. The raw files differ only in object-key order;
canonical JSON hashes were observed to match for the file-change approval request, response,
`thread/start`, and complete v2 schema bundle. The sanitized digest receipt is
stored at
`docs/evidence/app-server-exact-version-security-review-0.144.1.json`.

## Exact-version source findings

The pinned source confirms a conditional decline-before-runtime path:

- [`assess_patch_safety`](https://github.com/openai/codex/blob/44918ea10c0f99151c6710411b4322c2f5c96bea/codex-rs/core/src/safety.rs)
  asks the user when a patch is outside the effective writable boundary and
  sandbox approval is permitted.
- [Apply-patch orchestration](https://github.com/openai/codex/blob/44918ea10c0f99151c6710411b4322c2f5c96bea/codex-rs/core/src/tools/orchestrator.rs)
  resolves `NeedsApproval` before the first runtime attempt and converts a user
  decline into a rejected tool result.
- [App Server's v2 test](https://github.com/openai/codex/blob/44918ea10c0f99151c6710411b4322c2f5c96bea/codex-rs/app-server/tests/suite/v2/turn_start.rs)
  observes `item/started`, then a file-change approval request, and a declined
  completion for its controlled test configuration.

The same exact source also preserves bypass and uncertainty paths:

- [permission resolution failure](https://github.com/openai/codex/blob/44918ea10c0f99151c6710411b4322c2f5c96bea/codex-rs/core/src/tools/handlers/apply_patch.rs)
  falls back to an unrestricted filesystem policy; the comment relies on a
  later managed platform sandbox rather than preserving path matching;
- [patch runtime approval](https://github.com/openai/codex/blob/44918ea10c0f99151c6710411b4322c2f5c96bea/codex-rs/core/src/tools/runtimes/apply_patch.rs)
  may return a preapproved decision or reuse a cached approval before asking a
  client;
- [permission-request hooks](https://github.com/openai/codex/blob/44918ea10c0f99151c6710411b4322c2f5c96bea/codex-rs/core/src/tools/orchestrator.rs)
  may allow or deny before routing to the client;
- `item/fileChange/patchUpdated` remains an under-development notification,
  disabled by default, and is not a client-controlled application barrier;
- the file-change approval schema has `grantRoot`, correlation, and a decision,
  but no delayed-apply capability or acknowledgement.

## Decision

The independent review is complete with disposition `NO-GO`.

The receipt records artifact identity, source commit, and generated-schema
observations made during this review session. The repository audit only checks
that the receipt matches pinned literals; it does not re-read the current
installed binary, official release asset, source checkout, or generated schema.
It therefore cannot claim a current mechanical binding, and coordinated changes
to both literals and the receipt require ordinary code review rather than being
detected cryptographically. The following required facts remain unbound:

1. effective managed `read-only` configuration with no writable roots;
2. `on-request` policy with user review and strict auto-review disabled;
3. absence of session/turn grants, cached approvals, and preapproval;
4. successful native/local resolution of cwd and every target path;
5. absence of permission-request and tool hooks at runtime;
6. fresh session/thread and an empty approval store;
7. terminal decline-only client bound to that exact process;
8. observed proposal-before-apply ordering and final independent-clone hashes.

Consequently:

- `receiptMatchesExpectedLiterals` is `true` for the reviewed receipt;
- `installedArtifactBound`, `sourceCommitBound`, and `generatedSchemaBound`
  remain `false` for the current environment;
- `exactEffectiveConfigurationBound` remains `false`;
- `proposalBeforeApplyRuntimeOrderProven` remains `false`;
- `liveSmokeEligible` remains `false`;
- `existingLiveSmokePreflightMayBeRelaxed` remains `false`;
- `realWorkspaceWriteSmokeAuthorized` remains `false`.

No real workspace-write smoke may be run. A successful audit command means the
evidence receipt matches the expected literals and the fail-closed `NO-GO`
decision was reproduced.
It is not a positive execution gate.

## Consequences

- Stage 1 is complete as a negative security decision, not as live-smoke
  readiness.
- The current installed artifact may not be used for a real workspace-write
  interception smoke under this review.
- Offline adapter, normalizer, transcript, and decline-only tests remain useful
  regression evidence but cannot fill runtime-configuration or application-
  timing gaps.
- A later exact-version review may assess a newly documented delayed-apply or
  mechanically read-only proposal channel, but must start from `NO-GO` and
  satisfy every unbound condition independently.

## Verification

```bash
npm run audit:app-server:exact-version-security-review
node --import tsx --test tests/codex-app-server-exact-version-security-review.test.ts
npm run docs:governance
npm run typecheck
```

Real Codex CLI, App Server, live clients, providers, and real workspace-write
are outside this verification.

## Change control

Changing any literal artifact/source/schema binding, accepting a new version,
or setting any live eligibility field to `true` requires another independent
security-review PR with new exact-version evidence and negative tests. Starting
App Server or a client would still require a separate exact authorization.
