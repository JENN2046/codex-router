# governance-v0.1.0 Adoption Dry-Run

## 1. Status

This is a documentation-only dry-run record.

- `Codex_Autonomous_Work_Harness` is not integrated with `codex-router`.
- `codex-router` has not adopted `governance-v0.1.0`.
- The current relationship is conceptual alignment only.
- No source code, runtime package, adapter, helper, automation, release flow, or downstream repository behavior is changed by this document.

## 2. Purpose

This document preserves the first safe mapping between `Codex_Autonomous_Work_Harness` `governance-v0.1.0` concepts and existing `codex-router` DGP / runtime governance concepts.

The goal is to record where the concepts appear compatible, where they only partially align, and where a future adoption path would need explicit design before implementation.

The dry-run conclusion is conservative:

- alignment appears viable as an external governance baseline;
- current evidence supports conceptual mapping only;
- runtime implementation is not the next safe step;
- the next safe step should remain documentation-only.

## 3. Existing codex-router surfaces

Observed `codex-router` governance surfaces include:

- `TaskEnvelope` / `RoutingDecision`
  - `packages/contracts/src/index.ts` defines task class, risk level, tool access, approval status, runtime signals, checkpoint refs, desktop operations, and desktop execution plans.
- intent gate / routing engine
  - `packages/intent-gate` classifies task intent.
  - `packages/routing-engine` chooses model, tool access, execution profile, approval reasons, parallelism, and host route.
  - `routing-policy.yaml` defines policy version, protected branches, protected keywords, protected tool access, memory health packs, and telemetry alert presets.
- approval gate
  - `packages/approval-gate` converts routing approval signals into pending / resolved approval state and blocks unresolved gates.
- runtime-control
  - `packages/runtime-control` evaluates runtime signals such as failures, validation failure, scope expansion, context pressure, and high-risk signals.
  - `packages/strategy-router` maps governance state to actions such as `execute`, `verify`, `simulate`, `step_back`, `fork`, and `abort`.
- checkpoint / audit
  - `packages/checkpoint-ledger-v2` records checkpoint ledger entries, reversible actions, and irreversible actions requiring human review.
  - `packages/checkpoint-index` and `packages/audit-memory` support checkpoint lookup, audit events, memory checkpoint records, and resume evidence.
- observability
  - `packages/observability` provides telemetry events, sinks, fanout, delivery metrics, alert thresholds, and alert delivery suppression windows.
- desktop-live-adapter
  - `packages/desktop-live-adapter` runs only from a decision result, requires explicit primitive handlers or a host bridge, records primitive outcomes, and can update governance state on execution failures.
- validation scripts
  - `package.json` exposes `npm run typecheck`, `npm test`, `npm run build`, `npm run canary`, `npm run canary:write`, `npm run evidence:collect`, and Codex CLI smoke / operator acceptance commands.

## 4. Harness-to-codex-router mapping

| Harness concept | codex-router surface | Fit | Notes | Next action |
|---|---|---|---|---|
| A0 read-only analysis | `TaskClass: read_only`, `ToolAccessLevel: read_only`, `ExecutionProfileName: recon-only` | DIRECT | Existing routing surfaces support read-only analysis and reconnaissance behavior. | Document as the safest conceptual match. |
| A1 low-risk documentation | `small_edit`, `local_write`, documentation-only repo workflow, staged review before commit | PARTIAL | codex-router can represent small local edits, but it does not have a named A1 autonomy level. | Define as a documentation mapping, not a runtime alias. |
| A2 controlled governance change | `engineering`, `high-risk-change`, `approval-gate`, `runtime-control`, `strategy-router` | PARTIAL | Controlled local implementation is represented, but governance-runtime changes are high-risk under project rules. | Require explicit design and tests before any implementation. |
| A3 executable helper introduction | `desktop-live-adapter`, host bridge, primitive handlers, `codex-cli-host` helpers | PARTIAL | Executable helpers exist as host-bound surfaces, but introducing a new helper can create side effects. | Treat as future high-risk design work, not part of adoption dry-run. |
| A4 human-gated operation | `release-governance`, `protected_remote`, protected branches / keywords, approval gate | DIRECT | Human gating for protected remote or release-like actions is already a core boundary. | Preserve as a hard boundary. |
| R0-R5 risk levels | `RiskLevel: low/medium/high`, `DgpRiskLevel: low/medium/high/critical`, entropy-risk score | PARTIAL | codex-router does not use six Harness risk levels. Direct conversion would create false precision. | Create an explicit non-equivalence table before any runtime use. |
| hard gates | `AGENTS.md` hard stop gates, `approval-gate`, `preflight`, protected rules in `routing-policy.yaml` | DIRECT | Existing repo rules and packages already model protected branch, protected keyword, dirty workspace, and protected tool access gates. | Keep Harness gates subordinate to repo hard gates. |
| staged review | execution profile stages, `validation-arbiter`, `strategy-router` verification, checkpoint stages | PARTIAL | Staged governance exists, but Harness staged review is not a named codex-router contract. | Specify a doc-level mapping first. |
| checkpoint report | `CheckpointRef`, `checkpoint-ledger-v2`, `audit-memory`, evidence docs | PARTIAL | Checkpoint and audit primitives exist; a Harness checkpoint report schema is not present. | Define a report-only schema in documentation before implementation. |
| dry-run/report-only helpers | `recon-only`, `preflight`, `simulate`, read-only smoke / preflight docs | PARTIAL | Dry-run principles exist, but there is no Harness-named report-only helper. | Map to existing read-only and simulate concepts first. |
| push/merge/tag/release/deploy approval boundary | `protected_remote`, `release-governance`, protected keywords, project hard stop gates | DIRECT | Existing policy requires explicit human approval for release and remote side-effect boundaries. | Preserve without weakening or bypassing. |

## 5. Collision and risk analysis

- vocabulary mismatch
  - Harness `A0-A4` autonomy levels do not directly equal `codex-router` task classes, execution profiles, or tool access levels.
  - Harness `R0-R5` risk levels do not directly equal `low`, `medium`, `high`, or `critical`.
  - Any future mapping should say "conceptual mapping" unless implemented and tested.
- authority mismatch
  - `codex-router` repository rules, observed repo state, and explicit user instruction remain authoritative.
  - Harness should not become an implicit authority layer without a reviewed adoption spec.
- runtime side-effect risk
  - `desktop-live-adapter`, host bridges, primitive handlers, and Codex CLI host helpers can reach executable behavior.
  - Runtime integration would require design review, tests, and explicit approval.
- validation claim risk
  - A dry-run report is not equivalent to typecheck, test, build, canary, smoke, or CI validation.
  - Documentation must not imply operational readiness.
- remote/release boundary risk
  - Push, merge, tag, release, deploy, protected branch movement, and remote writes remain human-gated.
  - Harness concepts must not downgrade these gates.
- overclaiming risk
  - This document records compatibility signals only.
  - It does not prove adoption, integration, runtime behavior, or downstream safety.

## 6. Non-goals

- no runtime integration
- no adapter implementation
- no automation helper
- no package creation
- no source code change
- no downstream repo adoption
- no release action

## 7. Recommended next step

Create a second documentation spec:

```text
docs/harness-adoption/harness-to-dgp-mapping.md
```

That document should define a conservative, non-runtime mapping between Harness `A0-A4` / `R0-R5` and existing `codex-router` DGP concepts.

Do not create that file as part of this task.

## 8. Validation expectation

This document should be validated as docs-only and staged review only.

Expected checks:

- confirm only this Markdown file is staged;
- confirm no source, package, test, script, or runtime adapter file changed;
- run `git diff --cached --check`;
- do not commit until explicitly approved after staged review.
