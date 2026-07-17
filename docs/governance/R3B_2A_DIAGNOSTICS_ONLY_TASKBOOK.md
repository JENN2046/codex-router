---
title: R3B-2A Diagnostics-only Taskbook
status: local_candidate
owner: governance
created: 2026-07-17
last_verified: 2026-07-17
verified_by:
  - R3B-2A recurrent diagnostic risk independent review
  - git diff --check
  - node --import tsx --test tests/clean-build-determinism.test.ts
  - npm run audit:clean-build-determinism
  - npm run typecheck
  - npm test
  - npm run build
  - npm run docs:governance
supersedes: []
superseded_by: null
applies_to:
  - R3B-2A
  - clean-build-determinism
  - diagnostic-normalization
---

# R3B-2A Diagnostics-only Taskbook

## 1. Task Status

```text
task: R3B_2A_DIAGNOSTICS_ONLY
mode: PR_DELIVERY_AUTHORIZED
repository: JENN2046/codex-router
target_branch: main
reviewed_main: 04b6847ada625675d9686877f3a10be0bf8d3def
implementation_authorized: true
workflow_rerun_authorized: false
natural_ci_authorized: true
branch_push_authorized: true
pull_request_authorized: true
merge_authorized: false
R3B_2B_authorized: false
capability_expansion: frozen
```

This taskbook records the smallest diagnostics-only response to the independent
verdict `REOPEN_R3B2A_DIAGNOSTICS_REQUIRED`. Jenn supplied the exact local
implementation token, and the bounded implementation plus required local
validation are complete. Jenn subsequently authorized pushing the scoped task
branch and opening a pull request, including the natural CI triggered by that
delivery. Workflow rerun, workflow dispatch, and merge remain unauthorized.

Exact token received for local implementation authorization:

```text
APPROVE_R3B_2A_DIAGNOSTICS_ONLY_IMPLEMENTATION
```

Natural CI for this scoped pull-request delivery is authorized. Workflow rerun
or dispatch remains separate and unauthorized.

## 2. Review Basis

The bounded clean-build determinism claim remains supported, but diagnostic
observability is insufficient:

- PR #196 merge commit: `bc98b88cbca80e60855dc7a0b16dab06d848430f`;
- post-merge run `29547606677` attempt 1 failed on macOS / Node 22 during
  `npm test` with `clean_build_determinism_unknown_error`;
- the unchanged commit passed all 20 jobs in attempt 2;
- PR #197 head `c40753610b3ed14feea6678a86a0dc2af3ef16a0` passed all 20 jobs in run
  `29555418550`;
- PR #197 merge commit `04b6847ada625675d9686877f3a10be0bf8d3def`
  failed again on macOS / Node 22 during `npm test` in run `29555878218` with
  the same normalized reason;
- the two failures used different GitHub-hosted runners and both completed
  checkout, setup, install, typecheck, and build before the test failure;
- structured check annotations retained only `Process completed with exit code
  1` and did not identify the originating filesystem or child-process error;
- an independent local audit at reviewed `main` passed stale-output removal,
  `1032 / 1032` dirty/empty `dist` equality, and `229 / 229` pack file-list
  equality;
- `coreOnlyArtifactProven`, `artifactAllowlistChanged`, and
  `runtimeSurfaceChanged` remained `false`.

The observable failure signature matches, but the current normalizer collapses
all non-snake-case error messages into
`clean_build_determinism_unknown_error`. It therefore cannot prove that the two
failures share the same underlying cause.

## 3. Objective

Add bounded, low-disclosure diagnostic classification to the existing
clean-build determinism audit without changing its algorithm, build inputs,
output comparison, package surface, execution authority, or CI topology.

The implementation candidate may only make a future intermittent failure
answer these questions safely:

1. Which fixed audit stage failed?
2. Which bounded error category occurred?
3. When applicable, which sanitized child-process exit class or filesystem
   error code was observed?

It must not attempt to fix the intermittent failure in this scope.

## 4. Allowed Implementation Scope

Only these existing implementation surfaces may change:

```text
scripts/run-clean-build-determinism-audit.ts
tests/clean-build-determinism.test.ts
```

The implementation may:

- bind failures to the exact stage enum:
  `copy | build | pack | manifest | cleanup`;
- classify errors using a closed category enum such as:
  `child_process_exit | filesystem_error | json_parse_error |
  manifest_mismatch | unknown_error`;
- preserve a bounded child-process exit code or signal category without
  preserving the command, argv, stdout, or stderr;
- preserve a sanitized filesystem code such as `EACCES`, `EBUSY`, `EEXIST`,
  `EIO`, `ENOENT`, `ENOSPC`, `ENOTDIR`, `EPERM`, or `ETIMEDOUT` without
  preserving a path or raw message;
- classify JSON parsing failures without retaining the invalid input or parser
  message;
- keep existing explicit manifest mismatch reasons bound to the `manifest`
  stage;
- retain `unknown_error` as a fail-closed fallback for unrecognized shapes;
- add pure normalization helpers when needed to keep classification testable;
- add synthetic fixtures and unit tests for every allowed stage and category;
- add negative leak tests that reject or omit forbidden fields;
- return only an exact allowlisted diagnostic projection.

Recommended bounded projection:

```text
stage
category
reason
exitCodeCategory, when applicable
signalCategory, when applicable
filesystemCode, when applicable
```

Field names and enum values are part of the diagnostics-only contract. Freeform
error text is not.

## 5. Required Invariants

The implementation must preserve all of these facts:

- the audit still creates an isolated repository-local temporary fixture;
- the synthetic source package is still built, removed, and checked for stale
  emitted output in the same order;
- dirty and empty `dist` manifests are still compared by path, size, and
  SHA-256 using the existing equality semantics;
- pack file lists are still produced by `npm pack --dry-run --ignore-scripts
  --json` and compared using the existing semantics;
- temporary fixtures are still removed unless the existing explicit test-only
  retention option is used;
- `coreOnlyArtifactProven`, `artifactAllowlistChanged`, and
  `runtimeSurfaceChanged` remain `false`;
- the default `build` command and package surface do not change;
- no new runtime, provider, worker, workspace-write, network, or host execution
  authority is introduced.

The diagnostics layer must observe and classify existing failures. It must not
change retry behavior, timing, concurrency, fixture contents, command order,
manifest contents, comparison rules, cleanup policy, or pass/fail criteria.

## 6. Forbidden Data

Diagnostic output, thrown errors, test snapshots, receipts, documentation, and
CI-visible summaries must not contain or persist:

- raw filesystem paths or temporary fixture paths;
- filenames derived from private or host state outside fixed repository-owned
  fixture names;
- stdout or stderr;
- raw child-process errors;
- command strings, executable paths, argv, spawn arguments, or cwd;
- environment variable names or values;
- secrets, tokens, credentials, cookies, auth headers, or provider config;
- provider/runtime request or response content;
- raw stack traces or unrestricted error messages;
- raw `npm pack` JSON or file contents;
- private state, `state-private/`, `.env`, logs, or host inventory.

Normalization must construct a new allowlisted projection. It must not spread,
serialize, return, or log the original error object.

## 7. Required Tests

Future implementation tests must cover at least:

- every stage enum is accepted and no arbitrary stage string is emitted;
- a child-process failure retains only the bounded exit/signal category;
- a synthetic child-process error containing stdout, stderr, command, argv,
  cwd, env, and paths does not disclose any of them;
- each approved filesystem code is retained without path or message;
- an unapproved or malformed filesystem code becomes `unknown_error`;
- JSON parse failure becomes `json_parse_error` without input or parser text;
- `clean_build_dist_manifest_mismatch` and
  `clean_build_pack_file_list_mismatch` remain explicit and stage-bound;
- primitive, object, string, aggregate, and unexpected error shapes fail
  closed to `unknown_error`;
- cleanup failure is classified without suppressing the original audit failure
  or leaking the fixture path;
- the serialized diagnostic projection contains only allowlisted keys;
- existing cleaner safety tests and determinism checks remain unchanged and
  pass.

Tests must use synthetic errors and fixture data only. They must not read raw
CI logs, private state, host environment values, or real provider/runtime
output.

## 8. Required Local Validation

After a separately authorized implementation, run only local validation:

```bash
git diff --check
node --import tsx --test tests/clean-build-determinism.test.ts
npm run audit:clean-build-determinism
npm run typecheck
npm test
npm run build
npm run docs:governance
```

Legacy display-only check disposition:

- `node --import tsx scripts/sync-state-sync-display.ts --check` is not a
  required validation for this candidate;
- the current policy v2 `CURRENT_STATE.md` intentionally no longer contains
  legacy branch/head table fields, while the old display helper still requires
  `$table:Current branch` and fails before it can return `changedPaths`;
- `docs/governance/STATE_SYNC_STRUCTURED_RECORD_PLAN.md` defines this helper as
  optional display freshness with `authority: "display_only"` and
  `requiredForAudit: false`;
- the diagnostics-only implementation does not modify state-sync authority,
  `CURRENT_STATE.md`, the structured state-sync record, or the legacy helper;
- repairing or retiring the helper requires a separate scope and is not a
  condition for this diagnostics-only local candidate.

Required results:

- targeted diagnostics and negative leak tests pass;
- the independent audit remains `passed`;
- stale-output removal remains `true`;
- dirty/empty `dist` equality remains `true`;
- dirty/empty pack file-list equality remains `true`;
- typecheck, full tests, build, and governance docs checks pass;
- the implementation diff is confined to the two authorized implementation
  files, with this taskbook retained as its governance artifact;
- real provider calls: `0`;
- real Codex CLI calls: `0`;
- workspace-write execution calls: `0`;
- workflow reruns or dispatches: `0`;
- GitHub writes: `0`.

Do not claim the recurrent macOS / Node 22 risk fixed from local synthetic
validation. Local success proves only the bounded diagnostic contract and
preservation of the existing determinism algorithm.

Observed local validation result:

```text
targeted tests: 11 / 11 passed
diagnostics tests: 6 / 6 passed
full tests: 2512 / 2512 passed
audit status: passed
stale output removed: true
dirty / empty dist: 1032 / 1032
dirty / empty pack file list: 229 / 229
typecheck: passed
build: passed
governance docs: passed
workflow reruns or dispatches: 0
GitHub writes: 0
```

## 9. Delivery Authorization

Local validation closed at:

```text
R3B_2A_DIAGNOSTICS_ONLY_LOCAL_CANDIDATE
```

Jenn then authorized the scoped task-branch push and pull-request delivery with
the instruction `推送，走PR吧`. This authorization permits natural CI triggered
by the pull request. It does not permit an explicit workflow rerun or dispatch.

Do not:

- rerun, approve, or dispatch a GitHub Actions workflow;
- use `gh run rerun` or any equivalent API;
- amend a workflow to force execution;
- treat a prior run as validation of the new diagnostics candidate.

## 10. Prohibited Scope

This taskbook does not authorize:

- changing the clean-build determinism algorithm or its pass/fail semantics;
- adding retries, sleeps, platform exceptions, macOS workarounds, or failure
  suppression;
- changing `package.json`, `package-lock.json`, `tsconfig.json`, `packages/`,
  `.github/workflows/`, Rulesets, required checks, or package exports;
- changing the artifact allowlist, core-only artifact boundary, import
  firewall, Runtime surface, or source-package inventory;
- reading or emitting raw GitHub Actions logs;
- modifying `CURRENT_STATE.md` or the state-sync record as part of the local
  diagnostics implementation;
- entering R3B-2B;
- provider, worker, workspace-write, App Server live execution, release,
  deploy, publish, tag, merge, or protected-branch mutation;
- secrets, credentials, tokens, cookies, provider/auth configuration, or
  private-state access.

If implementation requires any prohibited surface, stop and return a new
proposal. Do not broaden this taskbook in place during implementation.

## 11. Acceptance And Stop Conditions

The local candidate may be reported only when all required local validation
passes and the implementation diff is confined to the two allowed
implementation files. This taskbook is the separate governance artifact for
that candidate.

Allowed local result:

```text
R3B_2A_DIAGNOSTICS_ONLY_LOCAL_CANDIDATE
```

Blocked result:

```text
R3B_2A_DIAGNOSTICS_ONLY_BLOCKED
```

Stop immediately after reporting either result. The current authorization
covers PR delivery and natural CI only; do not infer authorization for merge,
R3B-2A re-closeout, or R3B-2B.

R3B-2A may be considered for re-closeout only after a separately authorized
delivery, natural CI evidence, and independent review. The determinism claim
remains supported during this diagnostics-only reopening; diagnostic
observability is the only reopened boundary.

## 12. Taskbook Result

```text
R3B_2A_DIAGNOSTICS_ONLY_LOCAL_CANDIDATE
implementation_authorized: true
workflow_rerun_authorized: false
natural_ci_authorized: true
branch_push_authorized: true
pull_request_authorized: true
merge_authorized: false
R3B_2B_authorized: false
```

The authorized next action is scoped task-branch push and pull-request delivery
with natural CI. No workflow rerun, workflow dispatch, merge, R3B-2A
re-closeout, or R3B-2B action follows automatically.
