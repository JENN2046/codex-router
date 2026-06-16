# Codex CLI Public Surface Reconciliation (2026-05-05)

## 1. Status

This is a read-only reconciliation report.

- It does not modify source code.
- It does not implement a new CLI wrapper.
- It does not run `codex exec`.
- It does not run real CLI smoke.
- It does not run workspace-write smoke.
- It does not create scripts, packages, tests, CI jobs, or evidence artifacts.
- It does not authorize push, merge, tag, release, deploy, external writes, downstream repository writes, or secret access.

## 2. Purpose

This report performs Step 1 from `docs/codex-public-surface-governance-recon-plan-20260505.md`.

The goal is to compare the official Codex CLI public surface with the current `codex-router` CLI governance wrapper and identify whether the next work should remain documentation-only, update tests, or move toward implementation.

## 3. Sources Inspected

Official sources:

- `https://developers.openai.com/codex/noninteractive`
- `https://developers.openai.com/codex/cli`

Local read-only sources:

- `docs/codex-public-surface-governance-recon-plan-20260505.md`
- `docs/codex-cli-smoke-strategy-20260428.md`
- `docs/codex-cli-real-host-smoke-release-checklist.md`
- `packages/codex-cli-host/src/index.ts`
- `packages/codex-cli-host/src/index-impl.ts`
- `tests/codex-cli-host.test.ts`
- `package.json`
- `codex --help`
- `codex exec --help`

No live `codex exec` command was run.

## 4. Official CLI Surface Observed

The official non-interactive route is `codex exec`.

Observed public behaviors:

| Official surface | Observed behavior | Governance relevance |
|---|---|---|
| `codex exec` | Non-interactive execution for automation, pipelines, and CLI workflows. | Primary public execution boundary. |
| `--sandbox` | Supports `read-only`, `workspace-write`, and `danger-full-access` in local help. Official docs recommend least permissions and caution around broad access. | Sandbox mapping must remain conservative. |
| `--ask-for-approval` / `-a` | Local help supports `untrusted`, `on-failure`, `on-request`, and `never`; `on-failure` is marked deprecated in help text. | Approval policy mapping must avoid deprecated or unsafe defaults. |
| `--json` | Official docs describe JSON Lines output for machine-readable event streams. | Required for parser and evidence generation. |
| `--output-schema` | Official docs describe schema-shaped final output for stable downstream fields. | Potential future evidence/report shape hook; not currently required by `codex-cli-host`. |
| `--ephemeral` | Official docs and local help support non-persistent sessions. | Useful for safe smoke and report-only tasks. |
| `--ignore-user-config` / `--ignore-rules` | Local help exposes these controls. | Potential future deterministic automation controls; must be explicit if used. |

## 5. Local CLI Wrapper Surface Observed

Current local wrapper anchor:

- `packages/codex-cli-host`

Current implementation observations:

| Local surface | Finding | Fit |
|---|---|---|
| `createCodexCliExecPlanFromRoutingDecision()` | Public production helper builds `codex exec --json --sandbox <mode>` plans from router-selected model and sandbox. | DIRECT |
| `createCodexCliExecPlan()` | Raw builder is internal/smoke-only and is not exported by the public production surface. | INTERNAL |
| `CodexCliSandboxMode` | Supports `read-only` and `workspace-write`; does not expose `danger-full-access`. | CONSERVATIVE |
| dangerous args guard | Blocks bypass aliases including `--dangerously-bypass-approvals-and-sandbox`, `--dangerously-bypass-hook-trust`, `--full-auto`, `--yolo`, and `danger-full-access`. | DIRECT |
| `parseCodexCliJsonl()` | Parses arbitrary JSON object lines and records parse diagnostics for invalid or non-object lines. | DIRECT |
| `validateCodexCliExecPlanForRun()` | Requires `exec`, `--json`, explicit sandbox, explicit approval policy, and blocks workspace-write unless `allowWriteSandbox` is true. | DIRECT |
| read-only smoke helpers | Model a read-only task with no file edits or external writes. | DIRECT |
| workspace-write smoke helpers | Require both `allowWriteSandbox` and the expected confirmation token before spawn. | DIRECT |

## 6. Alignment Assessment

| Surface | Official public behavior | Current `codex-router` behavior | Fit | Notes |
|---|---|---|---|---|
| Non-interactive execution | `codex exec` is the public automation route. | Wrapper plans use `exec`. | DIRECT | No live execution was run in this report. |
| JSONL output | `--json` emits JSONL event stream. | Wrapper always includes `--json`; parser keeps raw event objects and diagnostics. | DIRECT | Parser is intentionally event-name agnostic. |
| Sandbox policy | CLI exposes `read-only`, `workspace-write`, and `danger-full-access`. | Wrapper exposes only `read-only` and `workspace-write`. | CONSERVATIVE | Not exposing `danger-full-access` matches governance posture. |
| Approval policy | CLI exposes `untrusted`, deprecated `on-failure`, `on-request`, and `never`. | Validator allows `untrusted`, `on-request`, and `never`; excludes deprecated `on-failure`. | CONSERVATIVE | This is stricter than the local CLI help and appears desirable. |
| Bypass flags | CLI exposes a dangerous bypass flag. | Wrapper blocks bypass and full-auto flags. | DIRECT | This preserves hard-gate intent. |
| Structured final output | CLI exposes `--output-schema`. | No current wrapper mapping observed. | PARTIAL | Candidate future report/evidence shape hook; no immediate blocker. |
| Real host smoke | Official route requires real installed/logged-in CLI. | Real smoke is local/operator-gated and excluded from normal CI. | DIRECT | Existing smoke strategy is aligned. |
| Workspace write | CLI can run workspace-write sandbox. | Wrapper blocks until explicit allowance and confirmation. | DIRECT | Matches project hard-gate posture. |

## 7. Event Vocabulary Observation

Official docs describe JSONL event types such as:

- `thread.started`
- `turn.started`
- `turn.completed`
- `turn.failed`
- `item.*`
- `error`

Local tests use fixture events such as:

- `session.started`
- `agent_message`

This is not currently a runtime compatibility blocker because `parseCodexCliJsonl()` is generic and accepts any JSON object event. However, future test fixtures and documentation should prefer official event names when they intend to mirror current CLI output.

Recommended interpretation:

- Parser compatibility: acceptable.
- Fixture freshness: partial.
- Next action: update or add docs/tests only when a future CLI wrapper change needs event-specific assertions.

## 8. Validation And Evidence Boundaries

Existing `codex-router` smoke strategy remains valid:

| Layer | Status | Notes |
|---|---|---|
| CI contract smoke | Supported | Deterministic mock-spawner contract path. |
| Local read-only real smoke | Operator-gated | Requires installed/logged-in CLI and separate approval to run. |
| Local workspace-write real smoke | Hard-gated | Requires explicit env gates and confirmation. |

This reconciliation did not run:

- `codex exec`
- `npm run smoke:telemetry`
- `npm run smoke:workspace-write:telemetry`
- `npm run operator:acceptance`
- `npm run evidence:collect`

## 9. Findings Table

| Field | Value |
|---|---|
| `surface` | `cli` |
| `source` | Official Codex non-interactive docs, local CLI help, `packages/codex-cli-host`, CLI smoke docs, tests |
| `performed` | Read-only docs/package/help/test inspection |
| `finding` | Current `codex-cli-host` remains aligned with official `codex exec --json` as the public automation route and keeps sandbox/approval behavior conservative. |
| `governanceMapping` | `TaskEnvelope` -> `CodexCliExecPlan` -> `codex exec --json` -> JSONL parse/evidence -> hard-gated real smoke |
| `unknowns` | Live current CLI event stream was not revalidated; model availability was not checked; no real host smoke was run. |
| `blockedBy` | Live execution and evidence refresh require separate explicit approval. |
| `nextAction` | Keep CLI wrapper unchanged; consider a docs-only App Server protocol reconnaissance next. |

## 10. Risks

- Official JSONL event vocabulary may drift while generic parser remains permissive.
- `--output-schema` is available publicly but not currently represented in wrapper planning.
- Real host smoke evidence can become stale because it depends on installed CLI, login state, and model availability.
- Workspace-write smoke remains intentionally gated and should not be used for routine docs-only changes.

## 11. Recommendation

Do not change `packages/codex-cli-host` from this reconciliation.

The CLI public surface is already the strongest implemented public route in `codex-router`. The next useful low-risk step is to inspect the next public surface without implementation:

```text
Codex App Server Protocol Recon
```

Suggested future report:

```text
docs/codex-app-server-protocol-recon-20260505.md
```

Do not start `codex app-server`, expose a WebSocket listener, generate committed schemas, or implement an App Server adapter without a separate scoped approval.
