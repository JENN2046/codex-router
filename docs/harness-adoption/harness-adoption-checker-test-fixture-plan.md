# Harness Adoption Checker Test Fixture Plan

## 1. Status

This is a documentation-only test fixture plan.

- It does not authorize implementation.
- It does not create fixtures.
- No Harness adoption checker exists.
- No Harness adapter exists.
- No runtime integration exists.
- `Codex_Autonomous_Work_Harness` is not integrated with `codex-router`.
- `codex-router` has not adopted `governance-v0.1.0`.
- This document does not create packages, scripts, TypeScript files, package manifests, tests, CI jobs, runtime adapters, automation helpers, releases, or downstream repository changes.

## 2. Purpose

This plan expands the proposed Harness adoption checker fixture set into concrete fixture names, sample Markdown snippets, and expected report rows.

The goal is to make a future checker implementation reviewable before code exists. The fixture plan should prove that a future checker can distinguish conservative boundary language from unsupported overclaims without reading secrets, touching sibling repositories, invoking host primitives, or writing files.

This document is still planning only. It is not a test suite, fixture directory, checker, adapter, package, script, or CI job.

## 3. Fixture Principles

Future fixtures should be:

- local;
- deterministic;
- small;
- readable in code review;
- independent of GitHub state;
- independent of a live Harness repository;
- independent of Codex Desktop host primitives;
- free of secrets, `.env`, credentials, tokens, and production configuration;
- isolated from sibling and downstream repositories;
- safe to delete without affecting runtime behavior.

Fixtures should model Markdown content and injected git context only. They should not require real filesystem writes by default in the checker.

## 4. Expected Report Row Shape

Future fixture assertions should produce report rows with this conceptual shape:

| Field | Meaning | Required |
|---|---|---|
| `fixture` | Fixture name. | Yes |
| `status` | Expected top-level result. | Yes |
| `finding` | Short finding identifier. | Yes |
| `evidence` | File path, phrase, or injected context used as evidence. | Yes |
| `recommendation` | `stop`, `continue_docs_review`, or `escalate`. | Yes |
| `sideEffectsExpected` | Whether any side effect is expected. | Yes |

Allowed status values:

- `PASS`
- `FAIL`
- `BLOCKED`
- `UNKNOWN`

The first implementation should not use probability scores or opaque confidence values for these fixtures.

## 5. Fixture Plan

| Fixture | Sample Markdown snippet | Expected status | Expected finding | Expected recommendation |
|---|---|---|---|---|
| `complete-docs-clean-boundaries` | `Harness is not integrated with codex-router. No Harness adapter exists. No runtime integration exists. This document does not authorize implementation.` | `PASS` | `required_boundaries_present` | `continue_docs_review` |
| `missing-required-doc` | `expectedDocs` includes `harness-to-dgp-mapping.md`; fixture file set omits it. | `FAIL` | `required_document_missing` | `stop` |
| `positive-integration-overclaim` | `Harness is integrated with codex-router.` | `FAIL` | `unsupported_integration_claim` | `stop` |
| `negative-integration-boundary` | `Harness is not integrated with codex-router.` | `PASS` | `negative_boundary_not_overclaim` | `continue_docs_review` |
| `positive-adoption-overclaim` | `codex-router has adopted governance-v0.1.0.` | `FAIL` | `unsupported_adoption_claim` | `stop` |
| `negative-adoption-boundary` | `codex-router has not adopted governance-v0.1.0.` | `PASS` | `negative_boundary_not_overclaim` | `continue_docs_review` |
| `future-plan-language` | `A future checker, if separately approved later, may produce a report.` | `PASS` | `future_planning_language_allowed` | `continue_docs_review` |
| `implemented-checker-overclaim` | `The Harness adoption checker exists and validates this package.` | `FAIL` | `unsupported_checker_exists_claim` | `stop` |
| `implemented-adapter-overclaim` | `The Harness adapter exists and maps Harness goals into codex-router runtime inputs.` | `FAIL` | `unsupported_adapter_exists_claim` | `stop` |
| `runtime-integration-overclaim` | `Runtime integration exists for Harness governance-v0.1.0.` | `FAIL` | `unsupported_runtime_integration_claim` | `stop` |
| `hard-gate-boundary-language` | `No push/merge/tag/release/deploy without explicit human approval.` | `PASS` | `hard_gate_boundary_allowed` | `continue_docs_review` |
| `release-action-overclaim` | `The release was deployed after this adoption checker passed.` | `FAIL` | `unsupported_release_action_claim` | `stop` |
| `dirty-worktree-context` | Injected git context: `worktreeStatus = dirty`. | `BLOCKED` | `dirty_worktree_context` | `stop` |
| `outside-allowed-path` | Candidate path: `../VCPToolBox/.env`. | `BLOCKED` | `outside_allowed_path` | `stop` |
| `secret-path-request` | Candidate path: `.env` or `config.env`. | `BLOCKED` | `secret_path_blocked` | `stop` |
| `machine-readable-output-needs-review` | Output request: `write report JSON to docs/evidence/latest.json`. | `BLOCKED` | `file_output_requires_review` | `escalate` |

## 6. Negative Claim Handling

The future checker must distinguish these two categories:

Allowed boundary language:

- `Harness is not integrated with codex-router.`
- `codex-router has not adopted governance-v0.1.0.`
- `No Harness adoption checker exists.`
- `No Harness adapter exists.`
- `No runtime integration exists.`
- `Implementation is not authorized.`
- `No push/merge/tag/release/deploy happened.`

Blocked overclaim language:

- `Harness is integrated with codex-router.`
- `codex-router has adopted governance-v0.1.0.`
- `The Harness adoption checker exists.`
- `The Harness adapter exists.`
- `Runtime integration exists.`
- `Implementation is authorized.`
- `Push/merge/tag/release/deploy happened because the checker passed.`

The first implementation should use explicit phrase and negation fixtures before adding any broader pattern matching.

## 7. Side-Effect Fixture Expectations

Every fixture should assert that the future checker does not:

- modify files;
- create files;
- stage files;
- commit;
- push;
- merge;
- tag;
- release;
- deploy;
- read `.env`, `config.env`, credentials, tokens, or secret paths;
- inspect sibling or downstream repositories;
- call Codex Desktop host primitives;
- call a live Harness repository;
- call GitHub or other network APIs;
- execute package scripts or tests by default.

If a future checker needs to write a report file, that behavior must be a separate approved option and must not be enabled by default.

## 8. Proposed Fixture File Shape

If fixtures are approved later, they should remain plain and reviewable.

Conceptual future layout:

```text
tests/fixtures/harness-adoption-checker/
  complete-docs-clean-boundaries/
  missing-required-doc/
  positive-integration-overclaim/
  negative-integration-boundary/
  positive-adoption-overclaim/
  negative-adoption-boundary/
  future-plan-language/
  implemented-checker-overclaim/
  implemented-adapter-overclaim/
  runtime-integration-overclaim/
  hard-gate-boundary-language/
  release-action-overclaim/
  dirty-worktree-context/
  outside-allowed-path/
  secret-path-request/
  machine-readable-output-needs-review/
```

This layout is conceptual only. This task does not create fixture directories or test files.

## 9. Review Gates Before Fixtures Or Code

Implementation remains blocked until these gates are reviewed:

- fixture names reviewed;
- sample snippets reviewed;
- expected report rows reviewed;
- negative claim handling reviewed;
- side-effect assertions reviewed;
- secret path blocking reviewed;
- outside-path blocking reviewed;
- dirty-worktree behavior reviewed;
- file-output behavior reviewed;
- ownership location reviewed;
- rollback/removal path reviewed.

If any gate remains unresolved, the next safe action is documentation review, not code.

## 10. Non-Goals

- no checker implementation;
- no adapter implementation;
- no runtime integration;
- no package creation;
- no script creation;
- no TypeScript files;
- no package manifests;
- no tests;
- no fixture directories;
- no CI changes;
- no automation helper;
- no downstream adoption;
- no push/merge/tag/release/deploy;
- no secret reading;
- no host primitive execution.

## 11. Recommended Next Step

Review this fixture plan as documentation only.

After this plan is reviewed and merged, the next safe step is to pause implementation and decide whether the documentation package is sufficient, or whether a separate scoped code proposal should be drafted for a read-only checker with fixture-backed tests.

Do not create fixtures, tests, scripts, packages, or checker code from this document.
