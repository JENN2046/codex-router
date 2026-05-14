# Codex Governance Suite SideEffectClass Taxonomy

## 1. Status

This is a docs-only taxonomy planning document.

It is not:

- an implementation
- an enforcement layer
- a schema
- a package
- a checker
- a Harness adapter
- runtime integration
- memory integration
- CI
- a monorepo plan

No implementation is authorized by this document.

Current baseline:

- `Codex Governance Suite` remains a strategic and management umbrella only.
- `Codex_Autonomous_Work_Harness`, `codex-router`, and `codex-memory` remain separate repositories.
- Harness is not integrated with `codex-router`.
- `codex-router` has not adopted `governance-v0.1.0`.
- No Harness adapter exists.
- No runtime integration exists.
- No governed memory behavior is active.

## 2. Purpose

This document defines review vocabulary for classifying side effects before any future checker, adapter, runtime, or memory implementation is proposed.

It helps future docs distinguish:

- read-only inspection
- report-only output
- observe-only runtime inspection
- local writes
- audit writes
- memory reads and writes
- MCP calls
- runtime execution
- remote writes
- production writes
- destructive operations

This taxonomy is not enforced by code, does not detect side effects, does not create a checker, does not create runtime mapping, and does not create memory behavior.

## 3. Scope

In scope:

- docs-only side-effect vocabulary
- planning-level class definitions
- hard gate classification
- automation eligibility language
- memory tool side-effect classification
- Codex public surface classification
- Git operation classification

Out of scope:

- source code
- schema
- package
- script
- test
- CI
- checker implementation
- Harness adapter
- runtime behavior
- memory calls
- MCP calls
- `codex exec`
- App Server
- monorepo or workspace configuration
- release, deploy, or tag

## 4. Taxonomy Principles

- Read-only is not the same as zero-side-effect.
- Report-only must not write durable state by default.
- Observe-only may inspect runtime state but must not mutate it.
- Audit-write must be separated from read-only.
- Memory-write must always be hard-gated.
- Runtime-execution must be separately authorized.
- Remote-write must be separately authorized.
- Production-write must be separately authorized.
- Destructive-operation must be blocked by default.
- Mixed actions inherit the highest-risk side-effect class.
- Documentation wording must not imply enforcement.

## 5. SideEffectClass Summary Table

| Class | Plain meaning | Examples | Default gate | A4.8 eligible? |
|---|---|---|---|---|
| `read-only` | Inspect existing local repository state without writing durable state. | `git status`, `git diff`, local Markdown reads. | Allowed when in scope. | Yes. |
| `report-only` | Produce human-readable output without durable writes. | Console summary, PR review text. | Allowed when in scope. | Yes, if no durable write. |
| `observe-only` | Inspect runtime or host state without mutation. | Future runtime health probe. | Separate review; may need redaction. | Not by default. |
| `local-docs-write` | Modify local documentation files. | Markdown edits under approved docs scope. | Allowed under scoped docs task. | Yes within approved docs scope. |
| `local-source-write` | Modify local source or runtime files. | TypeScript source edit. | Separate implementation scope. | No for docs-only work. |
| `audit-write` | Write durable audit or recall traces while reading or reporting. | Search operation that records recall audit. | Explicit scope required. | No by default. |
| `memory-read` | Read memory state without memory write. | Future memory query. | Explicit memory scope required. | No by default. |
| `memory-write` | Write memory, diary, DB, vector index, shadow store, or write audit. | `record_memory`. | Human approval only. | No. |
| `mcp-call` | Invoke an MCP tool or connector. | Future GitHub, memory, or host MCP call. | Classify per tool. | Only if explicitly scoped. |
| `runtime-execution` | Start or invoke executable runtime surfaces. | `codex exec`, App Server, host primitive. | Separate approval. | No by default. |
| `remote-write` | Mutate remote refs, PRs, issues, or service objects. | Push branch, create PR, delete remote branch. | Explicit A4.8-R or human approval. | Yes only under explicit docs-only remote ceiling. |
| `production-write` | Mutate production, release, deployment, database, or live service state. | Deploy, release, production config change. | Human approval only. | No. |
| `secret-access` | Inspect or modify secrets, credentials, env files, or private runtime logs. | `.env` read, token inspection. | Hard stop. | No. |
| `destructive-operation` | Delete, reset, force-push, or irreversibly mutate data/history. | `git reset --hard`, force push, data deletion. | Blocked by default. | No. |

## 6. Class Definitions

### `read-only`

Meaning:

- Inspect existing local repository state without durable writes.

Permits:

- reading local docs
- reading repository metadata
- `git status`
- `git diff`
- `git log`

Forbids:

- writing files
- writing memory
- writing audit logs
- updating remote refs
- mutating runtime state
- mutating production state

Required review language:

- Say what was inspected.
- Say whether inspection was local or external.
- Do not call runtime inspection read-only if it depends on live host state; classify that as observe-only.

Future automation:

- Eligible for A4.8 when inside repository scope and non-secret.

### `report-only`

Meaning:

- Produce stdout or a human-readable report without writing durable state.

Permits:

- final reports
- PR review summaries
- console-only validation summaries

Forbids:

- writing report files unless also classified as a write class
- updating audit trails unless also classified as audit-write
- posting remote comments unless also classified as remote-write

Required review language:

- State whether the report was durable or ephemeral.
- If written to disk, also classify as local-docs-write or local-output-write.

Future automation:

- Eligible for A4.8 if no durable write occurs.

### `observe-only`

Meaning:

- Inspect runtime health or state without mutating runtime or durable state.

Permits:

- future health checks
- future runtime state observation
- future host status inspection

Forbids:

- starting runtime surfaces unless separately authorized
- mutating runtime state
- writing logs, memory, or config as a side effect

Required review language:

- State the observed surface.
- State redaction assumptions.
- State whether any durable trace was written.

Future automation:

- Not eligible by default; requires separate scoped approval.

### `local-docs-write`

Meaning:

- Modify local documentation files inside an approved docs scope.

Permits:

- Markdown edits under `docs/`
- docs-only README updates
- local docs commits when all gates pass

Forbids:

- source changes
- package changes
- schema changes
- scripts
- tests
- CI files

Required review language:

- List changed Markdown files.
- State that the change is docs-only.
- State validation and skipped validation.

Future automation:

- Eligible for A4.8 within approved docs scope.

### `local-source-write`

Meaning:

- Modify local source, runtime, package, schema, script, test, or CI files.

Permits:

- Nothing in docs-only phases.

Forbids:

- treating source edits as docs-only
- mixing source changes into governance planning branches

Required review language:

- Requires separate implementation scope and validation plan.

Future automation:

- Not eligible under current docs-only work.

### `audit-write`

Meaning:

- A read, search, or report action writes a durable audit trace.

Permits:

- Only when audit recording is explicitly scoped.

Forbids:

- calling the action read-only without noting the audit write
- hidden durable traces

Required review language:

- State where audit data is written.
- State whether secrets or private data may appear.
- State retention and rollback assumptions when known.

Future automation:

- Not eligible by default.

### `memory-read`

Meaning:

- A memory query reads memory but does not intentionally write memory.

Permits:

- Nothing in the current docs-only phase.

Forbids:

- calling memory tools under current non-memory tasks
- treating memory results as authority over repository reality
- hiding recall audit side effects

Required review language:

- State memory source.
- State whether recall audit or query trace is written.
- State that memory is advisory unless separately scoped.

Future automation:

- Not eligible by default.

### `memory-write`

Meaning:

- Write memory, diary, DB, vector index, shadow store, or write audit.

Permits:

- Nothing without explicit human approval.

Forbids:

- automatic `record_memory`
- implicit memory updates
- memory writes during docs-only tasks

Required review language:

- State exact target memory surface.
- State rollback/removal path if any.
- State why explicit approval applies.

Future automation:

- No. Human approval only.

### `mcp-call`

Meaning:

- Invoke an MCP tool or connector.

Permits:

- Only tools explicitly allowed by task scope.

Forbids:

- treating all MCP calls as read-only
- calling memory MCP tools without explicit memory approval
- calling write-capable tools under read-only review

Required review language:

- Name the tool.
- Classify it by actual behavior.
- State whether it is local-read, local-write, remote-write, memory-read, memory-write, or runtime-execution.

Future automation:

- Only if explicitly scoped and classified per tool.

### `runtime-execution`

Meaning:

- Run Codex CLI, App Server, host primitive, shell execution, or other executable runtime surface.

Permits:

- Nothing under current docs-only taxonomy work.

Forbids:

- `codex exec`
- App Server startup
- host primitive execution
- runtime mutation

Required review language:

- State exact runtime surface.
- State expected side effects.
- State approval and rollback assumptions.

Future automation:

- No by default; requires separate approval.

### `remote-write`

Meaning:

- Mutate remote refs, PRs, issues, review state, or external service records.

Permits:

- Push branch and create PR only under explicit A4.8-R docs-only ceiling.

Forbids:

- remote branch mutation outside scope
- push outside approved branch
- issue/PR mutation outside approved task

Required review language:

- State repository.
- State branch or object.
- State exact action and rollback path.

Future automation:

- Eligible only under explicit A4.8-R docs-only ceiling.

### `production-write`

Meaning:

- Mutate production, release, deployment, database, live service, or production config state.

Permits:

- Nothing under current governance suite docs phases.

Forbids:

- deploy
- release
- production config changes
- live service mutation
- real-data migration

Required review language:

- Human approval required before action.

Future automation:

- No. Human approval only.

### `secret-access`

Meaning:

- Inspect or modify secrets, tokens, credentials, `.env`, production config, or private runtime logs.

Permits:

- Nothing under current docs-only work.

Forbids:

- reading `.env`
- printing tokens
- modifying credentials
- storing secrets in docs, memory, or logs

Required review language:

- Stop and request explicit approval if access is truly required.

Future automation:

- No.

### `destructive-operation`

Meaning:

- Delete, reset, force-push, destroy data, mutate credentials, or perform irreversible cleanup.

Permits:

- Nothing by default.

Forbids:

- `git reset --hard`
- force push
- branch deletion unless explicitly scoped
- data destruction
- irreversible cleanup

Required review language:

- Name exact target.
- Explain rollback or lack of rollback.
- Require explicit approval.

Future automation:

- No. Blocked by default.

## 7. Memory Tool Classification

| Tool | Proposed class | Why | Default policy | Notes |
|---|---|---|---|---|
| `memory_overview` | `observe-only` / `report-only` candidate | It may summarize memory runtime state without writing memory, but it still touches a memory surface. | Not zero-side-effect; requires explicit memory scope. | No memory tool is authorized by this document. |
| `search_memory` | `memory-read` plus possible `audit-write` | A memory query may write recall audit or query traces. | Must not be called read-only by default. | No memory call is allowed by this document. |
| `record_memory` | `memory-write` | It writes memory, diary, DB, vector index, shadow store, or write audit. | Human approval only. | Must remain hard-gated. |

Conclusions:

- `memory_overview` may be an observe-only/report-only candidate, not zero-side-effect.
- `search_memory` must not be called read-only by default if recall audit or query traces are written.
- `record_memory` is memory-write and must remain hard-gated.
- No memory tool is authorized by this document.
- No memory call is allowed by this document.

## 8. Codex Public Surface Classification

| Surface | Proposed class | First-safe posture | Notes |
|---|---|---|---|
| Codex CLI | `runtime-execution` when executing, `read-only` only for local metadata inspection | Docs-only review before any execution. | `codex exec` is runtime-execution and not currently authorized. |
| Codex SDK | Future automation surface | Not a current first implementation target. | Requires separate implementation scope. |
| Codex App Server | Broad protocol/runtime surface | Do not start under docs-only work. | Starting it is runtime-execution and not currently authorized. |
| Codex MCP | `mcp-call`, class per tool | Classify each tool independently. | MCP calls are not universally read-only. |
| Codex Desktop internal host object | Conceptual-only for this phase | Not current implementation target. | No host object access is authorized. |

Conclusions:

- Codex CLI may be a future controlled execution surface, but `codex exec` is runtime-execution.
- Codex SDK is a future automation surface, not current first implementation.
- App Server is a broad protocol surface; starting it is runtime-execution and not currently authorized.
- MCP calls must be classified per tool, not treated as universally read-only.
- Desktop internal host object remains conceptual-only and is not a current implementation target.

## 9. Git / Repository Operation Classification

| Operation | Class | Default gate |
|---|---|---|
| `git status` | `read-only` | Allowed when in scope. |
| `git diff` | `read-only` | Allowed when in scope. |
| `git log` | `read-only` | Allowed when in scope. |
| Markdown edit | `local-docs-write` | Allowed within approved docs scope. |
| local commit | local repository mutation | Allowed only under scoped A4.8 docs rules. |
| push branch | `remote-write` | Allowed only under explicit A4.8-R docs-only ceiling. |
| create PR | `remote-write` | Allowed only under explicit A4.8-R docs-only ceiling. |
| merge PR | `remote-write` | Human approval required. |
| delete remote branch | `remote-write` | Human approval required unless explicitly scoped. |
| tag | `remote-write` / release-sensitive | Human approval required. |
| release | `production-write` | Human approval required. |
| deploy | `production-write` | Human approval required. |
| force push | `destructive-operation` | Blocked by default unless explicitly scoped. |
| reset hard | `destructive-operation` | Blocked by default unless explicitly scoped. |

Conclusions:

- `git status`, `git diff`, and `git log` are read-only.
- Markdown edit is local-docs-write.
- Local commit is local repo mutation and allowed only under scoped A4.8 docs rules.
- Push branch and create PR are remote-write and allowed only under explicit A4.8-R docs-only ceiling.
- Merge, tag, release, and deploy remain hard gates.
- Force push and reset hard are destructive-operation unless explicitly scoped.

## 10. Automation Eligibility Matrix

| Class | A4.8 docs-only eligible? | A4.8-R eligible? | Requires human approval? | Notes |
|---|---|---|---|---|
| `read-only` | Yes | Yes | No, when in scope. | Local non-secret inspection only. |
| `report-only` | Yes, if no durable write | Yes, if no durable write | No, when in scope. | Durable report writes need additional class. |
| `observe-only` | No by default | Maybe with explicit scope | Usually yes. | Runtime/host observation can expose sensitive state. |
| `local-docs-write` | Yes within approved docs scope | Yes within approved docs scope | No, when scoped. | Must stay Markdown/docs-only. |
| local commit | Yes within approved docs-only scope | Yes within approved docs-only scope | No, when all gates pass. | Local repo mutation; inspect diff first. |
| push branch | No | Yes only under A4.8-R docs-only ceiling | Yes unless ceiling explicitly allows it. | Remote-write. |
| create PR | No | Yes only under A4.8-R docs-only ceiling | Yes unless ceiling explicitly allows it. | Remote-write. |
| merge PR | No | No | Yes. | Human approval required. |
| `memory-write` | No | No | Yes. | Human approval only. |
| `runtime-execution` | No | No by default | Yes. | Separate approval required. |
| `production-write` | No | No | Yes. | Human approval only. |
| `destructive-operation` | No | No | Yes, and blocked by default. | Requires exact scope and recovery path. |

## 11. Hard Gate Matrix

| Gate | Trigger | Required action |
|---|---|---|
| Push outside A4.8-R docs-only ceiling | Any remote push not explicitly covered by docs-only branch scope. | Stop and request human approval. |
| Merge | Merge PR or branch into protected/shared branch. | Human approval required. |
| Tag | Create or move tag. | Human approval required. |
| Release | Publish release or release artifact. | Human approval required. |
| Deploy | Deploy or mutate live service. | Human approval required. |
| `record_memory` | Any memory write. | Human approval required. |
| `search_memory` default automation | Any automatic memory search. | Stop unless explicit memory scope exists. |
| `codex exec` | Codex CLI execution. | Separate approval required. |
| App Server startup | Starting Codex App Server. | Separate approval required. |
| MCP write tool | MCP tool may write local, remote, memory, runtime, or external state. | Classify and request approval if not explicitly scoped. |
| `.env` / secrets | Reading or modifying secrets, env files, tokens, credentials, private runtime logs. | Stop and request explicit approval. |
| Production config | Any production endpoint/config/live-service change. | Human approval required. |
| Schema/package creation | JSON Schema, TypeScript type package, package manifest, workspace/package config. | Separate implementation approval required. |
| Checker implementation | Any checker source, script, test, fixture runner, or CI integration. | Separate implementation approval required. |
| Adapter implementation | Any Harness adapter code or runtime bridge. | Separate implementation approval required. |
| CI workflow change | Any workflow or CI gate modification. | Separate approval required. |
| Monorepo/workspace config | Any workspace or monorepo setup. | Separate approval required. |

## 12. Review Checklist

Reviewers should ask:

- Does the text call a write path read-only?
- Does the text hide audit-write under read-only?
- Does the text imply memory calls are authorized?
- Does the text imply runtime execution is safe?
- Does the text keep merge/tag/release/deploy human-gated?
- Does the text classify mixed operations by highest-risk side effect?
- Does the text avoid implementation claims?

## 13. Missing Work

Still missing:

- no implemented side-effect classifier
- no schema
- no checker
- no fixture set
- no router dry-run mapping
- no memory policy implementation
- no Codex public surface adapter
- no CI enforcement
- no release gate implementation
- no implementation approval

## 14. Non-Authorization Gates

This document does not authorize:

- source code
- packages
- schemas
- scripts
- tests
- CI
- checker
- Harness adapter
- runtime integration
- `codex-memory` call
- `record_memory`
- `search_memory`
- `codex exec`
- App Server
- MCP calls
- monorepo config
- workspace config
- release
- deploy
- tag
- merge

## 15. Next Safe Step

The next safe step after this document should remain docs-only.

Suggested next safe tasks:

- checker strategy planning
- checker fixtures planning

Do not recommend implementation yet.

## 16. Overclaim Warnings

Do not say:

- side-effect taxonomy is enforced
- read-only means zero-side-effect
- `search_memory` is read-only by default
- `record_memory` can be auto-triggered
- `codex exec` is harmless
- App Server is safe to start by default
- MCP calls are read-only
- merge can be automated
- checker exists
- adapter exists

Acceptable wording:

- docs-only taxonomy
- planning vocabulary
- future review aid
- side-effect class candidate
- non-authorization gate
- separately approved future implementation
