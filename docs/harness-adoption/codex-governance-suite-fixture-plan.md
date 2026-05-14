# Codex Governance Suite Fixture Plan

## 1. Status

This is a docs-only fixture planning document.

It is not:

- a fixture set
- a fixture directory
- a test suite
- a checker implementation
- a checker fixture runner
- a package
- a schema
- a script
- a CI workflow
- a Harness adapter
- runtime integration
- memory integration
- MCP integration
- a monorepo plan

No implementation is authorized by this document.

Current baseline:

- `Codex Governance Suite` remains a strategic and management umbrella only.
- `Codex_Autonomous_Work_Harness`, `codex-router`, and `codex-memory` remain separate repositories.
- Harness is not integrated with `codex-router`.
- `codex-router` has not adopted `governance-v0.1.0`.
- No Harness adapter exists.
- No checker exists.
- No fixture set exists.
- No runtime integration exists.
- No governed memory behavior is active.

## 2. Purpose

This document plans candidate fixture coverage for a future Codex Governance Suite checker review.

The purpose is to make future checker behavior reviewable before code exists by naming the kinds of Markdown snippets, injected metadata, expected report rows, and boundary cases that reviewers should expect.

This document does not create fixtures, tests, fixture files, fixture directories, checker code, schemas, packages, scripts, CI jobs, or runtime behavior.

## 3. Scope

In scope:

- docs-only fixture planning
- candidate future fixture categories
- candidate Markdown snippets
- conceptual expected report vocabulary
- side-effect expectation planning
- memory, runtime, CI, remote-write, and secret-access exclusions
- review gates before any future fixture or checker implementation

Out of scope:

- source code
- package creation
- schema creation
- script creation
- test creation
- fixture creation
- fixture directory creation
- fixture runner
- CI workflow changes
- checker implementation
- Harness adapter implementation
- runtime execution
- memory calls
- MCP calls
- `codex exec`
- App Server startup
- downstream repository scanning
- monorepo or workspace configuration
- release, deploy, tag, merge

## 4. Fixture Principles

Future fixtures, if separately approved, should be:

- docs-first
- local-repo-only
- deterministic
- small enough for code review
- free of secrets, tokens, credentials, `.env` files, and private runtime logs
- independent of sibling repositories
- independent of live Harness runtime state
- independent of `codex-memory`
- independent of MCP calls
- independent of GitHub network state by default
- independent of runtime execution
- removable without changing product behavior

Future fixtures should model text and explicitly injected context only.

Future fixtures should not require:

- reading downstream repositories
- reading private runtime state
- reading memory stores
- writing memory
- writing audit logs
- starting App Server
- running `codex exec`
- posting to GitHub
- pushing, merging, tagging, releasing, or deploying

## 5. Candidate Fixture Model

A future fixture could contain conceptual inputs such as:

| Candidate field | Meaning | Boundary |
|---|---|---|
| `name` | Human-readable fixture name. | Planning vocabulary only. |
| `markdown` | Local Markdown snippet or document sample. | No real fixture file is created here. |
| `expectedFinding` | Candidate finding identifier. | Not an implemented enum. |
| `expectedStatus` | Candidate report status. | Not an implemented schema. |
| `expectedRecommendation` | Candidate reviewer action. | Not an implemented policy. |
| `sideEffectsExpected` | Whether future checker behavior should imply a side effect. | Planning-only assertion. |

This model is descriptive only. It is not JSON Schema, TypeScript, package metadata, or a test contract.

## 6. Candidate Report Vocabulary

Candidate future status values:

- `PASS`
- `FAIL`
- `BLOCKED`
- `UNKNOWN`

Candidate future recommendations:

- `continue_docs_review`
- `stop`
- `escalate_for_scope`
- `request_explicit_approval`

Candidate future finding families:

- `required_boundary_present`
- `required_boundary_missing`
- `negative_boundary_not_overclaim`
- `unsupported_implementation_claim`
- `unsupported_runtime_claim`
- `unsupported_memory_claim`
- `unsupported_monorepo_claim`
- `side_effect_boundary_missing`
- `secret_or_env_path_blocked`
- `remote_write_requires_approval`

This vocabulary is for planning only and must not be described as implemented validation.

## 7. Baseline Boundary Fixtures

| Candidate fixture | Sample Markdown snippet | Expected status | Expected finding | Expected recommendation |
|---|---|---|---|---|
| `suite-boundary-clean` | `Codex Governance Suite remains a strategic and management umbrella only. No implementation is authorized.` | `PASS` | `required_boundary_present` | `continue_docs_review` |
| `suite-implemented-overclaim` | `Codex Governance Suite is implemented as a platform.` | `FAIL` | `unsupported_implementation_claim` | `stop` |
| `separate-repositories-clean` | `Codex_Autonomous_Work_Harness, codex-router, and codex-memory remain separate repositories.` | `PASS` | `required_boundary_present` | `continue_docs_review` |
| `monorepo-overclaim` | `The suite combines Harness, router, and memory into one monorepo.` | `FAIL` | `unsupported_monorepo_claim` | `stop` |
| `no-adapter-clean` | `No Harness adapter exists.` | `PASS` | `negative_boundary_not_overclaim` | `continue_docs_review` |
| `adapter-exists-overclaim` | `The Harness adapter exists and maps goals into router runtime inputs.` | `FAIL` | `unsupported_implementation_claim` | `stop` |

These are candidate fixtures only. They are not implemented tests.

## 8. Contract Topic Fixtures

Future fixture planning should cover every proposed contract topic:

| Contract topic | Candidate clean snippet | Candidate blocked snippet | Review purpose |
|---|---|---|---|
| `HarnessGoal` | `HarnessGoal is a future contract topic.` | `HarnessGoal is implemented in codex-router.` | Distinguish topic planning from implementation. |
| `GovernanceDecision` | `GovernanceDecision is candidate vocabulary for future review.` | `GovernanceDecision now gates runtime execution.` | Prevent runtime-gate overclaim. |
| `MemoryOverviewPolicy` | `MemoryOverviewPolicy remains docs-only planning.` | `MemoryOverviewPolicy queries codex-memory.` | Preserve memory boundary. |
| `SideEffectClass` | `SideEffectClass is review vocabulary.` | `SideEffectClass is enforced by CI.` | Prevent enforcement overclaim. |
| `CheckpointEvidence` | `CheckpointEvidence describes future evidence vocabulary.` | `CheckpointEvidence writes audit logs.` | Prevent hidden audit-write behavior. |
| `ValidationVocabulary` | `ValidationVocabulary names future report terms.` | `ValidationVocabulary validates all governance docs.` | Prevent validation overclaim. |
| `ProjectProfile` | `ProjectProfile may describe repository roles later.` | `ProjectProfile configures a suite monorepo.` | Preserve repository separation. |

Each future fixture should include both an allowed planning phrase and a blocked implementation phrase.

## 9. Checker Strategy Fixtures

Future checker-strategy fixtures should verify that docs can say:

- future checker could inspect local Markdown
- future checker could produce a report-only summary
- future checker must be read-only, report-only, and local-repo-only first
- future checker must not read secrets
- future checker must not call memory
- future checker must not execute runtime surfaces

Future checker-strategy fixtures should block claims that:

- a checker exists
- a checker is implemented
- a checker validates governance
- a checker enforces boundaries
- a checker runs in CI
- a checker writes durable report files by default
- a checker posts PR comments by default

## 10. Side-Effect Fixtures

Future side-effect fixtures should cover:

| Candidate fixture | Side-effect class | Expected status | Boundary |
|---|---|---|---|
| `local-markdown-read` | `read-only` | `PASS` | Candidate input only. |
| `stdout-report-only` | `report-only` | `PASS` | No durable write. |
| `write-report-file` | `local-docs-write` or local output write | `BLOCKED` | Requires separate approval. |
| `read-env-file` | `secret-access` | `BLOCKED` | Hard stop. |
| `query-memory` | `memory-read` plus possible `audit-write` | `BLOCKED` | Requires separate memory scope. |
| `record-memory` | `memory-write` | `BLOCKED` | Human approval only. |
| `start-app-server` | `runtime-execution` | `BLOCKED` | Requires separate runtime scope. |
| `post-pr-comment` | `remote-write` | `BLOCKED` | Requires explicit remote approval. |
| `push-branch` | `remote-write` | `BLOCKED` | Requires explicit remote approval. |
| `deploy-release` | `production-write` | `BLOCKED` | Not eligible for docs-only automation. |

These rows describe future review cases only. They do not grant permission to run any command or tool.

## 11. Memory Boundary Fixtures

Future memory-boundary fixtures should include clean negative statements:

- `No governed memory behavior is active.`
- `Memory may be mentioned only as a boundary and future review topic.`
- `Any memory-aware checker requires separate scope and approval.`

Future memory-boundary fixtures should block overclaims:

- `Codex Governance Suite has active governed memory behavior.`
- `The checker queries codex-memory.`
- `The checker records memory evidence.`
- `MemoryOverviewPolicy persists decisions.`
- `record_memory is safe to call by default.`

No future fixture should call `codex-memory`, `memory_overview`, `search_memory`, or `record_memory`.

## 12. Runtime And Remote Boundary Fixtures

Future runtime-boundary fixtures should block claims that:

- runtime integration exists
- `codex exec` is part of the checker
- App Server is started for fixture validation
- host primitives are invoked
- live adapter execution is required

Future remote-boundary fixtures should block claims that:

- push is automatic
- merge is automatic
- PR comments are posted by default
- tags are created by default
- release or deploy follows checker success

Merge, tag, release, and deploy must remain human-gated and outside fixture execution.

## 13. Candidate Fixture Grouping

Candidate future groups:

- `baseline-boundaries`
- `contract-topic-language`
- `checker-strategy-language`
- `side-effect-classification`
- `memory-boundary-language`
- `runtime-boundary-language`
- `remote-action-boundaries`
- `secret-path-boundaries`
- `negative-claim-handling`
- `overclaim-warning-language`

This grouping is conceptual only. It does not create directories or files.

## 14. Conceptual Future Location

If future fixtures are separately approved, reviewers may consider a location such as:

```text
tests/fixtures/codex-governance-suite-checker/
```

This path is conceptual only.

This document does not create:

- `tests/`
- fixture folders
- fixture files
- snapshot files
- report files
- package files
- test runner configuration

## 15. Review Gates Before Fixtures Or Code

Before any future fixture files or checker code are proposed, reviewers should require:

- fixture name review
- sample snippet review
- expected finding vocabulary review
- expected recommendation vocabulary review
- negative-claim handling review
- side-effect class review
- secret path blocking review
- memory boundary review
- runtime boundary review
- remote-write boundary review
- ownership and future file location review
- rollback/removal path review
- validation plan review
- implementation approval

These gates are planning requirements, not implemented gates.

## 16. Missing Work

Still missing:

- no fixture files
- no fixture directories
- no fixture runner
- no fixture tests
- no checker implementation
- no checker package
- no checker schema
- no checker script
- no CI integration
- no runtime integration
- no memory integration
- no MCP integration
- no implementation readiness gate document for Codex Governance Suite
- no implementation approval

## 17. Non-Authorization Gates

This document does not authorize:

- source code
- packages
- schemas
- scripts
- tests
- fixtures
- fixture directories
- fixture runner
- CI
- checker
- Harness adapter
- runtime integration
- `codex-memory` call
- `memory_overview`
- `record_memory`
- `search_memory`
- `codex exec`
- App Server
- MCP calls
- downstream repository scans
- monorepo config
- workspace config
- release
- deploy
- tag
- merge

## 18. Next Safe Step

The next safe step after this document should remain docs-only.

Suggested next safe task:

- implementation readiness gate planning for Codex Governance Suite

Do not recommend implementation yet.

## 19. Overclaim Warnings

Do not say:

- fixtures exist
- fixtures are implemented
- fixtures are complete
- tests exist for Codex Governance Suite checker behavior
- checker exists
- checker is implemented
- checker validates governance
- checker enforces boundaries
- checker runs in CI
- runtime integration is complete
- MCP integration is complete
- memory integration is complete
- memory persists decisions
- adapter support is implemented
- schema is enforced
- package is published
- monorepo support is complete
- full coverage
- ready for release

Acceptable wording:

- docs-only fixture plan
- candidate future fixture
- conceptual fixture group
- planned expected finding
- future checker could use
- not yet implemented
- no fixture files exist
- non-authorization gate
- separately approved future implementation
