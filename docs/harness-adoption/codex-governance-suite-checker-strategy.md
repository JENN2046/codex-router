# Codex Governance Suite Checker Strategy

## 1. Status

This is a docs-only checker strategy planning document.

It is not:

- a checker implementation
- a checker package
- a checker schema
- a checker fixture runner
- a script
- a test suite
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
- No runtime integration exists.
- No governed memory behavior is active.

## 2. Purpose

This document defines a future checker strategy for reviewing Codex Governance Suite planning documents before any checker implementation is proposed.

The strategy is limited to planning a read-only, report-only, local-repo-only review posture. It describes what a future checker could inspect, what it must not do, and what gates must be reviewed before any code exists.

This document does not validate, enforce, block, execute, or gate governance behavior.

## 3. Scope

In scope:

- docs-only checker strategy
- candidate input boundaries
- candidate report shape
- overclaim detection categories
- side-effect boundaries
- memory, runtime, CI, and remote-write exclusions
- review gates before any future implementation

Out of scope:

- source code
- package creation
- schema creation
- script creation
- test creation
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

## 4. Strategy Principles

- A future checker must be planned as read-only, report-only, and local-repo-only first.
- A future checker must not mutate files, memory, runtime state, remote refs, PRs, issues, releases, deployments, or production state.
- A future checker must not read `.env`, secrets, tokens, credentials, private runtime logs, or downstream repositories.
- A future checker must distinguish positive overclaims from explicit negative boundary statements.
- A future checker must treat contract topics as vocabulary, not implemented APIs.
- A future checker must classify mixed actions by the highest-risk side-effect class.
- A future checker must remain outside CI unless a separate CI scope is approved.
- Documentation language must not imply that a checker already exists.

## 5. Candidate Checker Questions

| Question | Why it matters | Current status |
|---|---|---|
| Does a document say it is docs-only? | Prevents planning docs from becoming implementation authority. | Strategy only. |
| Does a document avoid implementation claims? | Prevents false platform, checker, adapter, runtime, or memory claims. | Strategy only. |
| Does a document keep repository roles separate? | Prevents monorepo or dependency-direction drift. | Strategy only. |
| Does a document classify memory and runtime side effects? | Prevents hidden memory, MCP, or runtime assumptions. | Strategy only. |
| Does a document keep merge/tag/release/deploy human-gated? | Preserves remote and production boundaries. | Strategy only. |
| Does a document define next steps as docs-only unless separately approved? | Keeps staged governance review explicit. | Strategy only. |

## 6. Candidate Inputs

Allowed future input candidates:

- local Markdown docs under `docs/harness-adoption/`
- directory-level README text under `docs/harness-adoption/README.md`
- local Git metadata such as branch, status, and diff summaries when explicitly scoped

Forbidden inputs:

- `.env`
- secrets
- tokens
- credentials
- private runtime logs
- runtime host objects
- `codex-memory`
- MCP memory queries
- downstream repositories
- remote service data unless separately approved

Input boundary:

- This strategy does not authorize any checker input. It only names candidate inputs for future review.

## 7. Candidate Report Shape

A future report could be human-readable and report-only.

Candidate sections:

- checked files
- detected boundary statements
- possible overclaim phrases
- memory boundary notes
- runtime boundary notes
- side-effect class notes
- skipped checks
- non-authorization confirmation
- recommended next docs-only action

Forbidden report behavior:

- writing durable files by default
- updating audit logs by default
- posting PR comments by default
- creating machine-readable contract output treated as implemented
- declaring full validation or enforcement

Report boundary:

- If a future report writes to disk, it must also be classified as local-docs-write or local-output-write.
- If a future report posts to GitHub, it must also be classified as remote-write.

## 8. Overclaim Detection Strategy

Candidate future checker behavior:

- flag positive claims that a suite, contract, checker, adapter, schema, package, CI rule, runtime integration, MCP integration, memory behavior, or monorepo exists
- ignore or classify separately explicit negative statements such as "No checker exists"
- flag vague release-readiness or full-coverage claims
- flag wording that turns docs into enforcement

Candidate forbidden phrases:

- checker is implemented
- implemented checker
- checker implementation exists
- production-ready checker
- checker enforces
- checker validates all
- fixtures are complete
- CI runs the checker
- CI enforces governance docs
- runtime integration is complete
- runtime uses this checker
- MCP integration is complete
- memory integration is complete
- memory persists decisions
- adapter support is implemented
- schema is enforced
- package is published
- monorepo support is complete
- workspace-wide enforcement
- end-to-end governance validation
- full coverage
- ready for release

Safer wording:

- checker strategy proposal
- planned checker behavior
- candidate checker rule
- future checker could flag
- recommended scan phrase
- example fixture to add
- CI integration candidate
- runtime integration is out of scope
- MCP integration is out of scope
- memory behavior is not implemented
- schema draft
- package boundary proposal
- coverage target
- validation gap
- not yet implemented
- requires tests before enforcement

## 9. Side-Effect Boundary

Checker strategy classification:

| Activity | Side-effect class | Current authorization |
|---|---|---|
| Read local Markdown docs | `read-only` | Candidate future input only. |
| Print a report to stdout | `report-only` | Candidate future output only. |
| Write a report to disk | `local-docs-write` or local output write | Not authorized here. |
| Post a report to GitHub | `remote-write` | Not authorized here. |
| Read runtime state | `observe-only` / `runtime-execution` depending on surface | Not authorized here. |
| Query memory | `memory-read` plus possible `audit-write` | Not authorized here. |
| Write memory | `memory-write` | Not authorized here. |
| Run checker in CI | CI / automation side effect | Not authorized here. |

Excluded classes:

- `local-source-write`
- `runtime-execution`
- `memory-read`
- `memory-write`
- `mcp-call`
- `remote-write`
- `production-write`
- `secret-access`
- `destructive-operation`

## 10. Memory Boundary

This strategy does not authorize:

- `codex-memory`
- `memory_overview`
- `search_memory`
- `record_memory`
- MCP memory queries
- memory storage reads
- memory storage writes
- memory audit writes
- governed memory behavior

Memory may be mentioned only as a boundary and future review topic.

Any future memory-aware checker must be separately scoped and must classify memory access according to the SideEffectClass taxonomy.

## 11. Runtime Boundary

This strategy does not authorize:

- `codex exec`
- Codex App Server startup
- host primitive invocation
- runtime state mutation
- runtime observation
- live adapter execution
- shell execution as checker behavior

Runtime may be mentioned only as a boundary and future review topic.

Any future runtime-aware checker must be separately scoped and must classify runtime access according to the SideEffectClass taxonomy.

## 12. CI And Automation Boundary

This strategy does not authorize:

- CI workflow changes
- CI checker execution
- automated governance enforcement
- release gates
- deploy gates
- merge gates
- required status checks

Future CI integration may be documented only as a candidate after a read-only/report-only/local-repo-only checker design is reviewed.

## 13. Review Gates Before Any Future Code

Before any future checker implementation is proposed, reviewers should require:

- input contract review
- output format review
- false-positive handling review
- explicit negation handling review
- no-secret/no-write proof review
- side-effect classification review
- ownership and file location review
- rollback/removal path review
- validation plan review
- implementation approval

These gates are planning requirements, not implemented gates.

## 14. Missing Work

Still missing:

- no checker implementation
- no checker package
- no checker schema
- no checker script
- no checker tests
- no fixture runner
- no fixture set for Codex Governance Suite checker strategy
- no CI integration
- no runtime integration
- no memory integration
- no false-positive test corpus
- no rollback/removal plan for implementation
- no implementation approval

## 15. Non-Authorization Gates

This document does not authorize:

- source code
- packages
- schemas
- scripts
- tests
- fixtures
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

## 16. Next Safe Step

The next safe step after this document should remain docs-only.

Suggested next safe tasks:

- checker fixtures planning
- implementation readiness gate planning

Do not recommend implementation yet.

## 17. Overclaim Warnings

Do not say:

- checker exists
- checker is implemented
- checker validates governance
- checker enforces boundaries
- checker runs in CI
- fixtures are complete
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

- docs-only checker strategy
- future checker could flag
- candidate checker rule
- recommended scan phrase
- report-only strategy
- read-only candidate input
- non-authorization gate
- separately approved future implementation
