# Codex Governance Suite Report-Only Checker Implementation Proposal

## 1. Status

This is a docs-only implementation proposal for a possible future minimal Codex Governance Suite report-only checker.

It is not:

- implementation approval
- checker implementation
- a package
- a schema
- a script
- a test suite
- a fixture set
- a CI workflow
- a Harness adapter
- runtime integration
- memory integration
- MCP integration
- a monorepo plan
- release approval
- deployment approval

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

This proposal describes the smallest reviewable shape for a future local checker that would inspect Harness adoption Markdown and print a human-readable report.

The purpose is to make the first possible implementation decision concrete enough to approve or reject later.

This proposal does not create code, packages, schemas, scripts, tests, fixtures, CI, runtime behavior, memory behavior, MCP behavior, remote-write behavior, tags, releases, or deployments.

## 3. Proposed Minimum Behavior

If separately approved later, the first checker should be:

- read-only
- report-only
- local-repo-only
- deterministic
- removable without runtime impact
- independent of Harness runtime state
- independent of `codex-memory`
- independent of MCP calls
- independent of `codex exec`
- independent of Codex App Server
- disabled from CI unless CI is separately approved
- free of secret reads
- free of downstream repository scans
- free of remote writes

Candidate behavior:

- read selected local Markdown files under `docs/harness-adoption/`
- detect required docs-only and non-authorization statements
- detect positive overclaim phrases
- classify explicit negative boundary statements separately from overclaims
- print a human-readable report to stdout
- exit with a review-oriented status only after a separate implementation scope defines exact behavior

This proposal does not approve that behavior.

## 4. Candidate Future Target Files

Candidate future implementation file, if separately approved:

- `scripts/check-harness-adoption-docs.ts`

Candidate future package script, if separately approved:

- `harness-adoption:check`

Non-target files for the first implementation:

- `packages/**`
- `src/**`
- `.github/workflows/**`
- `tests/**`
- `docs/harness-adoption/*.schema.json`
- `docs/harness-adoption/fixtures/**`
- `codex-memory` files or sibling repositories
- `.env`
- secret, token, credential, production config, or private runtime log files

This proposal does not create or modify any candidate target file.

## 5. Input Boundary

Allowed future inputs:

- local Markdown files under `docs/harness-adoption/`
- `docs/harness-adoption/README.md`
- local Git status and diff summaries only if separately scoped as checker evidence

Forbidden inputs:

- source files as governance truth
- package manifests as governance truth
- schemas
- generated artifacts
- fixtures unless separately approved
- `.env`
- `config.env`
- secrets
- tokens
- credentials
- production config
- private runtime logs
- runtime host objects
- `codex-memory`
- `memory_overview`
- `search_memory`
- `record_memory`
- MCP tools
- downstream repositories
- remote service data

The first implementation must treat documentation as review input, not as an executable contract.

## 6. Output Boundary

Allowed future output:

- console text
- report text written to stdout

Forbidden output:

- modifying Markdown files
- writing durable report files by default
- writing JSON contract output treated as implemented schema
- updating audit logs
- posting PR comments
- creating GitHub issues
- writing memory records
- updating remote branches
- changing CI status checks
- changing runtime state

If a later proposal wants durable report files, PR comments, machine-readable output, or CI status, it must receive separate approval and a higher side-effect classification.

## 7. Candidate Report Shape

A future report may include:

- checked files
- missing required docs-only statements
- missing non-authorization statements
- possible overclaim phrases
- explicit negative boundary statements found
- repository separation notes
- memory boundary notes
- runtime boundary notes
- MCP boundary notes
- CI boundary notes
- skipped checks
- final review verdict

Allowed future verdict vocabulary:

- `PASS_DOCS_REVIEW`
- `WARN_DOCS_REVIEW`
- `FAIL_OVERCLAIM`
- `FAIL_MISSING_BOUNDARY`
- `FAIL_SCOPE_DRIFT`

These verdict names are proposal vocabulary only. They are not implemented statuses.

## 8. Candidate Rule Categories

Future rule categories may include:

- docs-only status required
- no implementation authorization required
- repository separation required
- Harness integration must remain negative unless implemented later
- `governance-v0.1.0` adoption must remain negative unless implemented later
- Harness adapter existence must remain negative unless implemented later
- checker existence must remain negative until code exists
- runtime integration must remain negative unless implemented later
- memory behavior must remain negative unless implemented later
- monorepo language must remain forbidden unless separately approved
- next step must remain gated before implementation

Positive overclaim examples to flag:

- Codex Governance Suite is implemented
- checker exists
- checker is implemented
- checker validates governance
- checker enforces boundaries
- checker runs in CI
- Harness adapter exists
- runtime integration exists
- MCP integration exists
- memory integration exists
- governed memory behavior is active
- schema is enforced
- package is published
- monorepo support is complete
- full coverage exists
- ready for release

The checker must not flag the same phrases when they appear as explicit negative statements or forbidden examples.

## 9. Side-Effect Class

The first implementation proposal target side-effect class is:

- `read-only` for local Markdown input
- `report-only` for stdout report output
- `local-repo-only` for repository boundary

Excluded side-effect classes:

- `local-source-write`
- `local-docs-write`
- `local-output-write` by default
- `runtime-execution`
- `memory-read`
- `memory-write`
- `mcp-call`
- `remote-write`
- `production-write`
- `secret-access`
- `destructive-operation`

Any future change that writes files, queries memory, runs runtime behavior, calls MCP tools, posts to GitHub, or enters CI must be reviewed as a separate side-effect expansion.

## 10. Validation Plan For Future Implementation

If separately approved later, a first implementation PR should validate:

- changed files are exactly the approved checker implementation files
- no packages, schemas, tests, CI, runtime, adapter, or memory files are changed unless separately approved
- the checker reads only approved Markdown inputs
- the checker prints only report text
- overclaim examples are flagged
- explicit negative statements are not treated as overclaims
- forbidden files such as `.env` are not read
- no memory, MCP, runtime, remote-write, tag, release, or deploy behavior exists

Candidate local validation commands, if separately approved after implementation exists:

- `git status --short --branch`
- `git diff --name-status`
- `git diff --stat`
- `git diff --check`
- a direct local checker invocation

This proposal does not run or create those implementation validations.

## 11. Rollback And Removal Plan

If a future checker is approved and later needs removal, rollback should be limited to:

- removing the checker implementation file
- removing the package script if one was separately approved
- removing any checker-specific docs line added by that implementation PR

Rollback must not affect:

- runtime packages
- DGP policy modules
- Harness adapter proposals
- memory integration
- MCP integration
- CI workflows
- release configuration
- repository structure

## 12. Decision Gate Before Code

After this proposal is reviewed, the project must stop before implementation.

The human decision must choose one of:

- proceed to a separately scoped minimal report-only checker implementation
- revise this proposal
- keep the suite at docs-first planning only

Proceeding to code requires a new explicit goal that names:

- exact target files
- exact non-target files
- side-effect class
- validation commands
- rollback path
- remote-write boundary
- memory boundary
- runtime boundary
- CI boundary

## 13. Current Non-Authorization

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

## 14. Final Recommendation

Review this proposal as the final docs-only step before deciding whether to enter the first code-level checker task.

The recommended next action after merge is a human decision gate, not implementation by default.
