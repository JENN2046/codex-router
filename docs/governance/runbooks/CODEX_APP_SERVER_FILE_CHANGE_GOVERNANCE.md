---
title: Runbook: Codex App Server File-change Governance
status: active
owner: governance
created: 2026-07-11
last_verified: 2026-07-12
verified_by:
  - node --import tsx --test tests/codex-app-server-adapter.test.ts
  - node --import tsx --test tests/retain-control.test.ts
  - npm run test:package-consumer
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
```

The package-consumer command runs `npm run build` before `npm pack`, so it can
be invoked directly after `npm ci` without a separate build prerequisite.

Do not substitute a real App Server, Codex CLI, provider, or source-workspace
write command without new operator authorization for that exact command.

## Procedure

1. Confirm the session attestation matches the normalized fixture profile.
2. Ingest `item_started` and verify the full change set has a canonical hash.
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
   be restorable. Effective configured filters and tracked submodules must block
   before status, whose fsmonitor, submodule traversal, lazy fetch, and optional
   index locks stay off. Partial/promisor clones must block before object reads.
9. Let the fake transport apply the change only in its disposable source repo.
10. Ingest resolution and completion, then verify the permit-bound pre-accept
    worktree hashes, actual post-state hashes, and no outside changes. Recreate
    base bytes in a disposable alternate index/worktree so EOL and other
    built-in checkout conversions are exact; configured external filters fail
    closed before status or checkout. Governed Git paths remain literal and
    HEAD inputs must be full object IDs. Disable sparse/split-index inheritance
    in that disposable snapshot and prohibit lazy fetch.
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
- effective Git filters or tracked submodules are present, or base checkout
  bytes cannot reproduce a declared update `beforeHash`;
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
Any effective Git `filter.*.clean`, `filter.*.smudge`, or `filter.*.process`
configuration blocks rollback before permit consumption and is checked again
inside the restore primitive; command values are never retained as evidence.
Any drift blocks rollback; any restore or post-check uncertainty enters
`reconciliation_required`. Quiesce external editors: the coordinator lock is
honored by codex-router operations but cannot force an unrelated editor to
participate.

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
