# Harness Adoption Checker Implementation Plan

## 1. Status

This is a documentation-only implementation plan.

- It does not authorize implementation.
- No Harness adoption checker exists.
- No Harness adapter exists.
- No runtime integration exists.
- `Codex_Autonomous_Work_Harness` is not integrated with `codex-router`.
- `codex-router` has not adopted `governance-v0.1.0`.
- This document does not create packages, scripts, TypeScript files, package manifests, CI jobs, runtime adapters, automation helpers, releases, or downstream repository changes.

## 2. Purpose

This plan defines the smallest safe future implementation shape for a read-only / report-only Harness adoption checker.

The checker, if separately approved later, would inspect a local `codex-router` checkout and report whether the existing Harness adoption documentation remains aligned with the documented governance boundaries. It would not perform adoption, runtime integration, automation, or repository mutation.

## 3. Current Baseline

The current documentation package includes:

- `governance-v0.1.0-adoption-dry-run.md`
- `harness-to-dgp-mapping.md`
- `harness-adapter-contract-proposal.md`
- `harness-adapter-implementation-readiness.md`
- `README.md`

The package establishes:

- conceptual alignment appears viable;
- the relationship remains conceptual only;
- Harness is not integrated with `codex-router`;
- `codex-router` has not adopted `governance-v0.1.0`;
- no Harness adapter exists;
- no runtime integration exists;
- no implementation is authorized by the existing documents.

## 4. Minimum Checker Scope

If separately approved later, the first checker must be:

- read-only;
- report-only;
- local-repo-only;
- deterministic;
- auditable;
- dry-run-first;
- disabled from file writes by default;
- unable to stage, commit, push, merge, tag, release, or deploy;
- unable to read secrets;
- unable to write downstream repositories;
- unable to invoke host primitives;
- unable to claim adoption or integration without explicit evidence.

The checker should answer one narrow question:

```text
Does the local Harness adoption documentation package still match the documented governance boundaries?
```

It should not answer whether Harness has been integrated, whether adoption is complete, or whether runtime behavior is safe.

## 5. Proposed Inputs

The future checker may consume these local, non-secret inputs:

| Input | Purpose | Required | Notes |
|---|---|---|---|
| repository root | Anchor all local path checks. | Yes | Must be the current `codex-router` checkout. |
| expected docs list | Verify the adoption package files are present. | Yes | Should be explicit and deterministic. |
| branch and worktree state | Record review context. | Yes | Read-only `git` inspection only. |
| adoption docs content | Scan for required boundary language and forbidden overclaims. | Yes | Markdown parsing can be simple if line-based checks are stable. |
| expected validation vocabulary | Verify report language uses known labels. | Partial | Only needed once validation vocabulary is formalized. |
| optional baseline config | Allow future expected file lists or phrases to be reviewed separately. | No | Any config file would require separate approval. |

The first implementation should not consume environment variables, credentials, network data, downstream repositories, or live host runtime state.

## 6. Proposed Outputs

The future checker may produce a report-only result:

| Output | Purpose | Status | Notes |
|---|---|---|---|
| adoption package presence | Shows which expected docs exist or are missing. | PROPOSED | Must not create missing files. |
| overclaim scan result | Flags claims of integration, adoption, implementation, approval, or release actions. | PROPOSED | Must distinguish forbidden claims from explicit negations. |
| boundary scan result | Confirms expected no-runtime / no-adapter / no-authorization wording exists. | PROPOSED | Should be evidence-based, not inferred. |
| scope scan result | Confirms the checker only inspected allowed paths. | PROPOSED | Must report unknowns plainly. |
| validation recommendation | Suggests stop, continue, or escalate. | PROPOSED | Recommendation only; no action execution. |
| machine-readable summary | Enables later tests or CI review if approved. | NEEDS_REVIEW | Format must be reviewed before implementation. |

The output should be written to stdout by default. Any file output must require a separate explicit option and approval.

## 7. Checks To Implement Later

The first future implementation should be limited to these checks:

1. Repository identity
   - confirm the repository root is named or identified as `codex-router`;
   - record current branch and worktree status;
   - report dirty worktree state without modifying it.
2. Expected documentation presence
   - confirm all current Harness adoption docs exist;
   - report missing files as missing;
   - do not create or repair missing files.
3. Boundary language presence
   - confirm docs state that Harness is not integrated;
   - confirm docs state that `codex-router` has not adopted `governance-v0.1.0`;
   - confirm docs state that no adapter or runtime integration exists;
   - confirm docs state that implementation is not authorized.
4. Forbidden overclaim scan
   - flag claims that Harness is integrated;
   - flag claims that adoption is complete;
   - flag claims that an adapter, helper, hard gate policy adapter, checkpoint serializer, or runtime integration exists;
   - flag claims that push, merge, tag, release, deploy, or downstream adoption happened unless the text is clearly describing a human-gated boundary or historical GitHub PR state.
5. Scope and side-effect proof
   - report the files inspected;
   - report that no writes were attempted;
   - report that no host primitive, external write, or downstream repo access was attempted.

## 8. Non-Goals

- no adapter implementation;
- no adoption implementation;
- no runtime integration;
- no package creation;
- no script creation in this task;
- no CI changes;
- no automation helper;
- no source code change in this task;
- no downstream repository adoption;
- no push/merge/tag/release/deploy;
- no secret reading;
- no host primitive execution.

## 9. Required Future Test Plan

Before any checker code is accepted, a separate implementation task should define tests for:

- all expected docs present;
- one expected doc missing;
- required boundary language present;
- forbidden positive integration claim detected;
- explicit negative boundary claim not falsely flagged;
- push/merge/tag/release/deploy boundary language not falsely flagged;
- dirty worktree reported without modification;
- no file write by default;
- no environment variable or secret path read;
- deterministic report output for stable fixtures.

The test plan should use local fixtures and must not require network access, GitHub state, a live Harness repository, Codex Desktop host primitives, or downstream repositories.

## 10. Review Gates Before Code

Implementation must remain blocked until all of these are reviewed:

- checker input contract;
- checker output report format;
- overclaim detection wording;
- false-positive handling for explicit negative claims;
- file whitelist;
- no-secret-read proof;
- no-file-write default proof;
- rollback/removal path;
- unit test fixture plan;
- ownership decision for whether the checker belongs in `packages/`, `scripts/`, or another reviewed location.

If any gate remains unresolved, the next safe action is documentation review, not code.

## 11. Proposed Future Implementation Options

These options are for later review only and do not authorize code.

| Option | Shape | Benefit | Risk | Recommendation |
|---|---|---|---|---|
| package module | A small package exposing pure check functions. | Most testable and reusable. | Creates a package boundary. | Prefer later if checker becomes reusable. |
| local script | A single local script that prints a report. | Fastest operator workflow. | Easier to blur into automation. | Only if strict no-write behavior is tested. |
| docs-only checklist | Manual checklist with no code. | Lowest risk. | Less repeatable. | Keep as fallback if detection rules remain ambiguous. |

The smallest safe implementation, if approved later, is a pure local report generator with fixture-backed tests and no default file writes.

## 12. Rollback And Removal Path

Any future checker implementation must be removable without affecting:

- `TaskEnvelope`;
- `RoutingDecision`;
- `approval-gate`;
- `runtime-control`;
- `desktop-live-adapter`;
- package exports used by existing consumers;
- existing Harness adoption documentation.

Removal should require only deleting the checker files and their tests, with no runtime migration.

## 13. Recommended Next Step

Review this plan as documentation only.

After this plan is reviewed and merged, the next safe step is a separate scoped proposal for the checker contract and fixtures. That future proposal should still avoid runtime integration and should stop before code unless implementation is explicitly approved.
