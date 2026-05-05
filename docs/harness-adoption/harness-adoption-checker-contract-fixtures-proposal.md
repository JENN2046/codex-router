# Harness Adoption Checker Contract And Fixtures Proposal

## 1. Status

This is a documentation-only checker contract and fixtures proposal.

- It does not authorize implementation.
- No Harness adoption checker exists.
- No Harness adapter exists.
- No runtime integration exists.
- `Codex_Autonomous_Work_Harness` is not integrated with `codex-router`.
- `codex-router` has not adopted `governance-v0.1.0`.
- This document does not create packages, scripts, TypeScript files, package manifests, CI jobs, runtime adapters, automation helpers, releases, or downstream repository changes.

## 2. Purpose

This proposal narrows the future read-only / report-only Harness adoption checker into reviewable contract and fixture expectations before any code is considered.

It exists to reduce ambiguity in four areas:

- what a future checker may read;
- what a future checker may report;
- which fixtures would prove the checker is deterministic and conservative;
- which side effects must remain impossible by default.

This proposal is still planning only. It is not a checker, adapter, package, script, or CI job.

## 3. Proposed Checker Contract

The future checker, if separately approved later, should be a pure local report generator.

It should accept an explicit local adoption context and return an adoption-check report without mutating repository state.

Conceptual contract:

```text
HarnessAdoptionCheckerInput
-> HarnessAdoptionCheckerReport
```

This contract is conceptual only. It is not a TypeScript type, schema, package export, or runtime commitment.

## 4. Proposed Input Contract

| Field | Purpose | Required | Allowed source | Notes |
|---|---|---|---|---|
| `repositoryRoot` | Anchor local file inspection. | Yes | Current local checkout. | Must point at `codex-router`; no sibling repo traversal. |
| `expectedDocs` | List required Harness adoption docs. | Yes | Reviewed static list. | Must be explicit; no glob-only discovery as authority. |
| `allowedPaths` | Restrict files the checker may inspect. | Yes | Reviewed static list. | Initial value should be `docs/harness-adoption/*.md` plus repo metadata from `git`. |
| `forbiddenClaims` | Phrases or patterns that imply unsupported adoption, integration, implementation, or release action. | Yes | Reviewed static list. | Must be tested against explicit negative claims. |
| `requiredBoundaryClaims` | Phrases that must remain present. | Yes | Reviewed static list. | Examples: not integrated, not adopted, no adapter, no runtime integration, no implementation authorization. |
| `validationVocabulary` | Known report result labels. | Yes | Reviewed static list. | Suggested labels: `PASS`, `FAIL`, `BLOCKED`, `NOT_RUN`, `NOT_APPLICABLE`, `UNKNOWN`. |
| `gitContext` | Branch, status, and commit information for evidence. | Partial | Read-only local `git`. | May be injected in tests to avoid shelling out. |

The first implementation should not accept environment-derived configuration, network URLs, downstream repository paths, credentials, or live host objects.

## 5. Proposed Output Report

| Field | Purpose | Required | Notes |
|---|---|---|---|
| `status` | Top-level result. | Yes | Suggested values: `PASS`, `FAIL`, `BLOCKED`, `UNKNOWN`. |
| `repository` | Local repo evidence. | Yes | Include root, branch, and worktree summary. |
| `documents` | Expected file presence results. | Yes | Missing files are reported, not created. |
| `boundaryClaims` | Required negative boundary language results. | Yes | Evidence should include file path and short finding. |
| `overclaims` | Forbidden positive claim findings. | Yes | Must distinguish real overclaims from negated wording. |
| `scope` | Files and sources inspected. | Yes | Report unknowns rather than inferring safety. |
| `sideEffects` | Proof-style statement of actions not attempted. | Yes | Should say no writes, no staging, no commit, no push, no merge, no tag, no release, no deploy, no secrets, no host primitives. |
| `recommendation` | Suggested next action. | Yes | Only `stop`, `continue_docs_review`, or `escalate`. |

The default output should be stdout only. File output, JSON snapshots, or CI artifacts require separate approval.

## 6. Required Fixture Set

The first fixture set should be local, deterministic, and small.

| Fixture | Purpose | Expected result | Notes |
|---|---|---|---|
| `complete-docs-clean-boundaries` | All expected docs exist and contain required negative boundary language. | `PASS` | Golden path; no overclaims. |
| `missing-required-doc` | One expected adoption doc is absent. | `FAIL` | The checker reports the missing doc and does not create it. |
| `positive-integration-overclaim` | A doc says Harness is integrated. | `FAIL` | Confirms positive integration claims are blocked. |
| `negative-integration-boundary` | A doc says Harness is not integrated. | `PASS` | Prevents false positives on negated wording. |
| `positive-adoption-overclaim` | A doc says `codex-router` has adopted `governance-v0.1.0`. | `FAIL` | Confirms adoption overclaims are blocked. |
| `future-plan-language` | A doc describes a future checker or adapter proposal. | `PASS` | Future planning must not be mistaken for implementation. |
| `hard-gate-boundary-language` | A doc mentions push, merge, tag, release, and deploy as approval boundaries. | `PASS` | Human-gated boundary language is allowed. |
| `release-action-overclaim` | A doc claims push, merge, tag, release, deploy, or downstream adoption happened without evidence. | `FAIL` | Historical PR state should be handled separately. |
| `dirty-worktree-context` | Git context reports uncommitted changes. | `BLOCKED` | Report dirty state; do not modify or clean it. |
| `outside-allowed-path` | A candidate input points outside allowed docs paths. | `BLOCKED` | Prevents sibling repo or secret path inspection. |

Fixtures should not require GitHub, network access, live Harness source, Codex Desktop host primitives, downstream repositories, secrets, or environment variables.

## 7. Overclaim Detection Rules

The future checker should block unsupported positive claims about:

- Harness being integrated with `codex-router`;
- `codex-router` adopting `governance-v0.1.0`;
- a Harness adoption checker existing;
- a Harness adapter existing;
- runtime integration existing;
- hard gate policy adapter existing;
- checkpoint serializer existing;
- implementation being authorized;
- downstream adoption being complete;
- push, merge, tag, release, deploy, or downstream writes having happened without evidence.

The checker must not flag explicit negative boundary claims such as:

- Harness is not integrated;
- `codex-router` has not adopted `governance-v0.1.0`;
- no checker exists;
- no adapter exists;
- no runtime integration exists;
- implementation is not authorized;
- no push/merge/tag/release/deploy happened;
- future implementation, if separately approved later.

The first implementation should prefer transparent phrase rules over opaque scoring.

## 8. Side-Effect Boundary

Any future checker must prove that default operation does not:

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

The checker may read local Markdown docs and injected or read-only local Git metadata only.

## 9. Review Gates Before Implementation

Implementation remains blocked until these gates are reviewed:

- input contract reviewed;
- output report shape reviewed;
- expected docs list reviewed;
- allowed path list reviewed;
- forbidden claim list reviewed;
- required boundary claim list reviewed;
- fixture names and expected outcomes reviewed;
- no-secret-read proof reviewed;
- no-file-write proof reviewed;
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
- no CI changes;
- no automation helper;
- no downstream adoption;
- no push/merge/tag/release/deploy;
- no secret reading;
- no host primitive execution.

## 11. Recommended Next Step

Review this proposal as documentation only.

After this proposal is reviewed and merged, the next safe step is a separate docs-only test fixture plan that expands the fixture table into concrete fixture names, sample Markdown snippets, and expected report rows.

Do not create fixtures or code from this document.
