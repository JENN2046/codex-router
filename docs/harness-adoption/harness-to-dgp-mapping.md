# Harness-to-DGP Mapping Specification

## 1. Status

This is a documentation-only mapping specification.

- `Codex_Autonomous_Work_Harness` is not integrated with `codex-router`.
- `codex-router` has not adopted `governance-v0.1.0`.
- No runtime adapter exists from this document.
- No automation helper exists from this document.
- This document does not change source code, package behavior, tests, scripts, releases, or downstream repositories.

## 2. Purpose

This document defines the first stable conceptual translation layer between `Codex_Autonomous_Work_Harness` `governance-v0.1.0` and existing `codex-router` DGP / runtime governance concepts.

The translation layer is intended to make future review easier by naming possible mapping points before any implementation work begins. It does not create a runtime contract, package boundary, adapter, helper, or adoption guarantee.

## 3. Mapping Principles

- Harness remains the external governance baseline.
- `codex-router` remains the runtime / policy SDK alignment target.
- Mapping must not bypass hard gates.
- Runtime integration must come later behind explicit adapter contracts and validation.
- Documentation mapping is not implementation.
- Existing `codex-router` repository rules, DGP principles, and observed runtime contracts remain authoritative inside this repository.
- Any future runtime mapping must preserve dry-run before execution, explicit dependency injection, named failures, auditability, and human approval for protected operations.

## 4. Autonomy Level Mapping

| Harness autonomy level | Meaning | Proposed codex-router surface | Fit | Runtime implication | Notes |
|---|---|---|---|---|---|
| A0 read-only analysis | Inspect, summarize, compare, or report without file modification. | `TaskClass: read_only`, `ToolAccessLevel: read_only`, `ExecutionProfileName: recon-only`, preflight/report-only docs. | DIRECT | No runtime write authority; no adapter required. | This is the safest match and should remain non-side-effectful. |
| A1 low-risk documentation | Create or update narrow documentation with staged review. | `small_edit`, `local_write`, docs-only workflow, explicit staging by path. | PARTIAL | Local file write only; no package, test, script, or runtime surface change. | Existing contracts do not name A1 directly; mapping is conceptual only. |
| A2 controlled governance change | Narrow implementation or policy change under validation and review. | `engineering`, `high-risk-change`, `approval-gate`, `runtime-control`, `strategy-router`, tests. | PARTIAL | Requires targeted implementation plan, tests, and broader validation when runtime governance is affected. | Governance behavior changes are not low-risk even when localized. |
| A3 executable helper introduction | Add a helper that can execute, invoke tools, or bridge host behavior. | `desktop-live-adapter`, host bridge, primitive handlers, `codex-cli-host` helpers. | PARTIAL | Runtime side effects become possible; design review and explicit adapter contract required. | This must not be introduced by documentation mapping alone. |
| A4 human-gated operation | Protected operation requiring explicit human approval. | `release-governance`, `protected_remote`, protected branches / keywords, approval gate, repo hard stop gates. | DIRECT | Must stop before protected remote, release, destructive, credential, or production actions until explicitly approved. | Mapping must preserve the human gate and cannot downgrade it. |

## 5. Risk Level Mapping

| Harness risk level | Meaning | Proposed codex-router risk / approval surface | Fit | Required gate | Notes |
|---|---|---|---|---|---|
| R0 read-only | No file writes or external side effects. | `read_only`, `recon-only`, preflight/report-only inspection. | DIRECT | No write gate; still obey secret and data boundaries. | Conceptually aligns with read-only reconnaissance. |
| R1 low-risk documentation | Narrow docs-only local change. | `small_edit`, `local_write`, docs-only staged review. | PARTIAL | Staged review before commit. | No source, tests, scripts, package, or runtime adapter changes. |
| R2 controlled governance change | Local governance or policy change with validation. | `engineering`, `high-risk-change`, `RiskLevel: medium/high`, runtime-control tests. | PARTIAL | Plan, targeted tests, diff review, and broader validation when shared behavior changes. | codex-router does not have a named R2 level. |
| R3 executable helper or boundary-sensitive change | Helper, adapter, host bridge, CLI execution, or boundary-sensitive integration. | `desktop-live-adapter`, `codex-cli-host`, `protectedToolAccess`, telemetry / checkpoint persistence. | PARTIAL | Explicit design approval plus runtime validation. | Side-effect potential requires stronger gates than docs mapping. |
| R4 hard-gated change | Push, merge, release, deploy, protected branch, secret, production config, destructive command, or remote write. | `protected_remote`, `release-governance`, approval gate, project hard stop gates. | DIRECT | Human approval required before action. | The gate is mandatory and cannot be bypassed by mapping. |
| R5 forbidden or unsafe | Irreversible, secret-exposing, production-damaging, unauthorized destructive, or policy-bypassing action. | Dangerous command denylist, stop conditions, secret policy, release boundary rules. | PARTIAL | Block or require a new explicit safe plan; do not execute by default. | codex-router has critical risk and hard stops, not a formal R5 enum. |

## 6. Hard Gate Mapping

| Hard gate | Harness rule | codex-router surface | Fit | Required behavior |
|---|---|---|---|---|
| push | Human approval before remote write. | `protected_remote`, `release-governance`, repo hard stop gates. | DIRECT | Stop before `git push` unless explicitly approved. |
| merge | Human approval before protected branch or PR merge. | protected branches, protected keyword `merge`, release-branch rules. | DIRECT | Stop before merge and report target/rollback path. |
| tag | Human approval before publishing version markers. | release hard stop gates. | DIRECT | Stop before tag creation or remote tag push. |
| release | Human approval before release action. | `release-governance`, memory/telemetry strict release pack. | DIRECT | Stop before release and require explicit approval. |
| deploy | Human approval before live deployment. | project hard stop gates, production boundary rules. | DIRECT | Stop before deployment or live service write. |
| secrets | Do not expose or modify credentials without explicit approval. | secret policy, env file protections. | DIRECT | Do not print, persist, copy, or alter secrets. |
| production config | Treat production configuration as protected. | high/critical risk rules, protected keywords, stop conditions. | DIRECT | Stop before changing production or stable config. |
| destructive commands | Block destructive commands by default. | dangerous command denylist. | DIRECT | Do not auto-run destructive commands. |
| downstream repository writes | No sibling/downstream writes without explicit scope. | repository scope rules and external-write policy. | DIRECT | Do not touch downstream repos during mapping work. |
| runtime side effects | Runtime execution requires explicit host boundary and validation. | `desktop-live-adapter`, host bridge, primitive handlers, `codex-cli-host`. | PARTIAL | Treat as future adapter work, not documentation mapping. |

## 7. Checkpoint Mapping

Harness checkpoint report concepts can map to existing `codex-router` checkpoint, audit, and evidence concepts as follows:

- status fields
  - Map to checkpoint status summaries, runner status, validation result labels, and final checkpoint reports.
- validation table
  - Map to explicit validation rows that separate required checks, performed checks, results, and evidence.
- evidence capture
  - Map to audit events, checkpoint ledger evidence refs, docs evidence artifacts, and command output summaries.
- staged review
  - Map to `git diff --cached`, explicit staged file review, `git diff --cached --check`, and no-commit-until-approved behavior.
- non-overclaiming validation language
  - Map to project validation discipline: do not say tests passed unless tests ran, do not say integrated unless integration exists, and do not treat documentation mapping as runtime validation.

This mapping is conceptual only. A future checkpoint serializer would need a reviewed schema before it could become runtime behavior.

## 8. Execution Flow Mapping

Conceptual flow only:

```text
Harness Goal
-> TaskEnvelope
-> classification / routing
-> approval gate
-> preflight
-> runtime-control
-> execution observation
-> checkpoint / audit
-> validation result
-> human approval boundary if needed
```

This flow is not implemented by this document. It describes how a future adapter might translate Harness language into existing `codex-router` DGP surfaces after explicit contract design and validation.

## 9. Missing Contracts

The following contracts are still missing before runtime integration:

- `HarnessGoal` schema
- `HarnessRisk` mapping type
- `HarnessAutonomy` mapping type
- hard gate policy adapter
- checkpoint report serializer
- validation result vocabulary mapping
- overclaim detection rules
- dry-run adoption checker

Until these contracts exist and are validated, `governance-v0.1.0` remains an external conceptual baseline only.

## 10. Non-goals

- no runtime integration
- no adapter implementation
- no helper script
- no package creation
- no source code change
- no downstream adoption
- no release/push/merge/tag/deploy

## 11. Recommended Next Step

Create a docs-only adapter contract proposal:

```text
docs/harness-adoption/harness-adapter-contract-proposal.md
```

Do not create that file in this task.
