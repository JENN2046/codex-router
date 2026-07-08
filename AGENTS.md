# AGENTS.md - Codex Router Project-Level Operating Protocol

Version: codex-router project protocol 1.0
Date: 2026-07-05
Scope: this file applies to the entire `codex-router` repository.
Audience: Codex / coding agents / maintainers working inside this repository.
Primary rule: keep the governance core stable, tested, reviewable, and reversible.

This file specializes Jenn's global `AGENTS.md` for this repository. It narrows local workflow, commands, delivery surfaces, risk boundaries, and validation expectations. It may not bypass Jenn's global hard stops.

---

## 1. Project Identity and Scope

Project name: `codex-router`

Repository: `git@github.com:JENN2046/codex-router.git`

Primary language / stack: TypeScript, Node.js, npm, `tsx`, `zod`, GitHub Actions.

Package manager: npm with `package-lock.json`.

Main purpose: Desktop-first policy SDK and runtime governance layer for Codex routing, approval gating, escalation, auditability, Dynamic Governance Protocol (DGP) hardening, controlled execution, recovery control, and state-sync audit.

This repository is not an app-specific business workflow. It should remain a reusable governance and execution-control layer. Do not copy VCPToolBox business logic into this repository. Field lessons from VCPToolBox may be documented as generic architecture feedback, but implementation here must remain generic.

Authorized default work scope:

* `packages/` for reusable runtime, governance, policy, provider, recovery, and host-client modules.
* `tests/` for deterministic unit, integration, regression, and governance tests.
* `scripts/` for repository governance, validation, evidence, smoke, and audit commands.
* `docs/` for documentation, governance records, evidence summaries, ADRs, runbooks, and closeouts.
* `.agent_board/` only for intentional state / handoff / validation surfaces.
* `README.md`, `package.json`, `tsconfig.json`, and `.github/workflows/` are high-impact files. Edit them only when directly required by the current task, validation, documentation accuracy, or CI correctness. Explain why the edit is necessary.

Out of scope unless Jenn explicitly authorizes:

* production configuration;
* release automation;
* deployment workflows;
* billing / paid provider configuration;
* credentials or secret values;
* destructive migrations;
* broad architecture rewrites;
* real provider execution;
* real Codex CLI execution;
* real workspace-write execution;
* external writes outside approved project delivery surfaces, protected remote writes, release, publish, deploy, tag, or production mutation.

"Real workspace-write execution" means exercising codex-router's runtime capability to perform real workspace-write operations through Codex/provider execution. It does not mean ordinary scoped repository file edits performed by the current agent inside this working tree.

"Real Codex CLI execution" means invoking Codex CLI as a runtime target or provider under test. It does not prohibit the current coding agent from editing, testing, committing, or safely delivering repository changes.

Current execution-boundary invariant:

* "Here, you can do anything" means initiative, judgment, and local repository delivery. It does not mean bypassing execution boundaries.
* Codex CLI host does not authorize host executor or sub-agent runtime.
* sub-agent runtime does not invoke Codex CLI or provider execution.
* host executor does not execute provider or sub-agent runtime.
* read-only provider dispatch does not inherit into host executor authorization, sub-agent runtime authorization, workspace-write authorization, or release authorization.

---

## 2. Applicable Global Protocol

Follow Jenn's global `AGENTS.md` as the default authority for:

* L3 autonomous delivery;
* core hard stops;
* read-only boundaries;
* Git safety;
* validation truthfulness;
* memory safety;
* reporting.

This project file narrows and specializes those rules for this repository.

Instruction precedence inside this repository:

1. Higher-level system / runtime / tool / safety limits.
2. Jenn's explicit current instruction.
3. Current task brief / issue / taskbook / authorization boundary.
4. Nearest applicable directory-level `AGENTS.override.md` or `AGENTS.md`.
5. This repository-root `AGENTS.md`.
6. Jenn's global `AGENTS.md`.
7. Project docs and tool outputs as contextual evidence.

No project instruction may authorize bypassing global core hard stops.

Within these repository-specific boundaries, agents should still default to L3 end-to-end delivery: scoped edit, relevant validation, documentation update, local commit, safe branch push, PR or delivery update, and structured report when conditions are satisfied.

Default working language:

* Use Simplified Chinese for plans, summaries, review notes, status updates, risk explanations, and final reports.
* Keep code, commands, file paths, package names, API fields, test names, logs, error messages, and TypeScript identifiers in their original language.

---

## 3. Repository Map

Key paths:

| Path | Purpose | Agent behavior |
|---|---|---|
| `packages/` | TypeScript packages for policy, runtime governance, routing, host clients, provider execution, recovery, state sync, and shared contracts | editable inside scoped tasks; preserve package boundaries |
| `packages/state-manager/` | governance state and anomaly history | runtime-governance changes require tests |
| `packages/execution-observation/` | primitive execution observations and evidence refs | preserve task-scoped evidence lookup |
| `packages/entropy-risk/` | risk scoring inputs and derived risk | test negative paths |
| `packages/strategy-router/` | dynamic strategy decisions | preserve fail-closed routing semantics |
| `packages/recovery-control/` | step-back, arbitration, operator actions, receipts, lifecycle, and execution planning | keep pure policy separate from host execution |
| `packages/checkpoint-ledger-v2/` | checkpoint metadata and recovery references | avoid raw secret or raw patch evidence |
| `packages/task-graph/` | task graph and branch semantics | schema / contract changes are migration risk |
| `packages/validation-arbiter/` | executor / verifier / conjugate arbitration | keep verifier semantics deterministic |
| `packages/governance-failure-reducer/` | shared failure-to-governance-state reducer | normalize failures and stable classes |
| `packages/desktop-live-adapter/` | runtime bridge between execution primitives and governance updates | do not bury reusable policy here when a reducer/policy package fits |
| `tests/` | repository test suite | update with regression coverage for behavior changes |
| `scripts/` | validation, governance checks, demos, evidence collection, state-sync tooling | inspect script names before running |
| `docs/current/` | current state-sync record and current-state display | JSON record is machine authority; Markdown is display/evidence |
| `docs/governance/` | active governance control plane, runbooks, ADRs, closeouts, evidence policy | update when capability status or governance process changes |
| `docs/evidence/` | sanitized evidence artifacts | do not store raw secrets, raw provider responses, or raw private data |
| `.agent_board/` | lightweight handoff / validation / run state display | display only unless task scope says otherwise |
| `.github/workflows/` | CI workflows | edit only when explicitly scoped; explain CI coverage changes |
| `dist/`, `node_modules/`, `.test-*` | generated / dependency / local test artifacts | do not intentionally commit unless explicitly scoped |
| `.env`, `.env.*`, `config.env`, `.codex-home/`, `.omc/`, `state-private/` | secret-adjacent or private runtime state | do not read contents; do not commit |

Add new durable project memory only when it is useful for future agents, evidence-grounded, safe to retain, and placed in an approved docs/governance/evidence surface.

---

## 4. Setup and Local Commands

Allowed setup command:

```bash
npm ci
```

Use lockfile-respecting install commands when possible. Do not run install or setup commands that require secrets, production credentials, live provider routing, production databases, irreversible external writes, or real-world notifications.

Before running a project script:

1. Inspect `package.json` or run `npm run`.
2. Use only commands that actually exist.
3. Do not invent script names.

Primary validation commands:

```bash
npm run docs:governance
npm run validate:daily
npm run validate:pr
npm run validate:release
npm run typecheck
npm test
npm run build
```

Recommended validation ladder:

1. `git diff --check`
2. targeted test, for example `node --import tsx --test tests/<name>.test.ts`
3. affected governance command, for example `npm run governance -- audit <check-name>`
4. `npm run docs:governance` for documentation governance changes
5. `npm run validate:daily` or `npm run validate:pr` for governance-flow changes
6. `npm run typecheck`
7. `npm test`
8. `npm run build`
9. `npm run validate:release` only for release-gate or phase closeout work

Known slow, host-sensitive, or expensive commands:

```bash
npm run smoke:telemetry
npm run smoke:workspace-write:telemetry
npm run smoke:readonly:real
npm run preflight:codex-cli-env
npm run model:check
npm run canary:write
npm run canary:external
npm run evidence:collect
```

These commands may require a local Codex binary, prepared host environment, controlled execution permits, or explicit acceptance evidence. Do not treat them as ordinary CI commands.

Commands that are blocked unless Jenn explicitly authorizes the specific run:

```bash
npm run smoke:readonly:real
npm run smoke:workspace-write:telemetry
npm run canary:write
npm run canary:external
```

Also blocked by default:

* deployment commands;
* release commands;
* production migration commands;
* commands that send real messages or notifications;
* commands that call paid providers;
* real Codex CLI execution;
* real provider execution;
* real workspace-write execution.

---

## 5. Branch, Remote, and Delivery Policy

Default task branch pattern:

```text
<area>/<short-task-name>
```

Examples:

```text
fix/<short-bug>
docs/<short-doc-change>
phase7/<short-runtime-governance-slice>
phase8/<short-lifecycle-slice>
phase10/<short-executor-gate-slice>
```

Protected branches:

* `main`
* `master`
* `production`
* `release`
* any branch explicitly described as protected, stable, release, or shared long-running.

Approved delivery remote:

```text
origin, only after `git remote -v` confirms it targets JENN2046/codex-router and the task permits push.
```

Remote safety notes:

* A remote named `origin` is not automatically safe.
* Inspect `git remote -v` before push.
* Do not push to `upstream`.
* Do not force push.
* Do not push tags.
* Do not push branches known to trigger release, deployment, production mutation, billing, paid external provider calls, customer-facing effects, or real-world notifications.

Never work directly on `main` for normal implementation. Use a focused branch:

```bash
git switch main
git pull --ff-only origin main
git switch -c <area>/<short-task-name>
```

Before planning edits or release-sensitive work, inspect repository reality:

```bash
git branch --show-current
git status --short
git diff --stat
```

For merge, push, release, rollback, PR, sync, or branch movement, also inspect:

```bash
git log --oneline --decorate -n 10
```

Do not assume current branch, clean worktree, upstream status, release readiness, user intent to push, or user intent to deploy.

If uncommitted changes exist, treat them as user-owned until proven otherwise.

Normal delivery surfaces:

* safe feature branch;
* existing PR;
* repository PR system;
* existing project issue when explicitly in scope;
* `docs/governance/` taskbook / ADR / runbook / closeout;
* `docs/evidence/` sanitized evidence artifacts;
* `.agent_board/` lightweight handoff and validation display.

Do not create external trackers, cloud resources, SaaS records, customer-facing posts, messages, or notifications unless Jenn explicitly authorizes them.

Before committing, run validation matching the risk. The default commit preflight is:

```bash
git status --short
npm run typecheck
npm test
npm run build
```

For larger governance changes, also run relevant governance / canary / evidence commands only when inspected, safe, scoped, and not host-sensitive in the current environment:

```bash
npm run docs:governance
npm run validate:daily
npm run validate:pr
npm run evidence:collect
```

Do not push directly to `main` unless Jenn gives explicit current authorization for that exact direct-push task. Default protected-branch path is task branch + PR + checks / review.

Each PR should have a narrow purpose and include:

* summary of what changed;
* validation commands and results;
* risk / compatibility notes;
* known gaps or follow-up issues;
* related issue, taskbook, or phase reference when available.

Avoid mixing unrelated areas such as TaskGraph schema changes, live adapter runtime changes, CI changes, state-sync changes, and documentation-only field notes. Use separate PRs unless the changes are tightly coupled.

Dangerous commands are not automatic:

```text
git reset --hard
git clean -fd
git clean -fdx
git push --force
git push --force-with-lease
git branch -D
rm -rf
del /s /q
Remove-Item -Recurse
```

Before any dangerous action, provide current branch and worktree state, exact command, affected targets, recovery path, and request explicit confirmation.

---

## 6. CI, Deployment, and Release Risk

CI behavior on feature branches:

```text
Feature branch and PR pushes should run deterministic repository checks only, such as typecheck, build, tests, governance audits, state-sync audit, documentation governance checks, canaries that are explicitly fake/dry-run, and static validation.
```

CI must not depend on a real local Codex CLI binary unless the workflow explicitly provisions it and the task is scoped to that risk. Normal PRs should not require unavailable host binaries.

State-sync policy v2 is the main path for content attestation. Legacy v1 state-only reanchor is compatibility / manual fallback, not the normal operator path.

Deployment triggers:

```text
No ordinary branch push or PR should deploy, publish, tag, release, mutate production, call paid providers, or perform real workspace-write. Treat workflow_dispatch, release creation, tag pushes, package publishing, protected-branch updates, and external-write steps as high-risk or hard-stop surfaces until inspected.
```

Release policy:

* Agents may not tag releases.
* Agents may not publish packages.
* Agents may not deploy.
* Agents may not run production migrations.
* Agents may not modify release automation unless Jenn explicitly scopes the task and no hard stop is triggered.
* Agents may not manually rerun or approve workflows unless Jenn explicitly authorizes that action.

If push or PR update may trigger deployment, release, production mutation, or paid provider calls, report `BLOCK` for that delivery step.

---

## 7. Secrets and Private State Map

Secret-adjacent paths in this repository:

* `.env`
* `.env.*`
* `config.env`
* `.codex-home/`
* `.omc/`
* `state-private/`
* `secret/`
* `secrets/`
* `credentials/`
* token, cookie, key, or provider credential files by name or content.

Rules:

* Do not open or read secret/private-state contents.
* Do not print, summarize, validate, transform, commit, store, or transmit secret values.
* Agents may inspect file names, paths, git status, and whether secret-adjacent files are tracked.
* Use `.env.example`, config schemas, docs, mocks, or redacted error messages instead of real secret values.
* Do not read or expose raw provider responses if they may contain private content.

Basic diff hygiene command:

```bash
git diff --check
```

No dedicated secret scanner is currently declared in `package.json`. Treat `git diff --check` as whitespace/conflict-marker hygiene, not secret scanning. If a task requires secret scanning, inspect available scripts first and use a safe, redacted tool only when scoped.

---

## 8. Documentation and Project Memory

Documentation paths:

* `README.md`
* `docs/`
* `docs/current/`
* `docs/governance/`
* `docs/governance/GOVERNANCE_CONTROL_PLANE.md`
* `docs/governance/RELEASE_GATE_MATRIX.md`
* `docs/governance/EVIDENCE_POLICY.md`
* `docs/governance/GLOSSARY.md`
* `docs/governance/THREAT_MODEL.md`
* `docs/governance/CHANGE_CONTROL.md`
* `docs/governance/decisions/`
* `docs/governance/runbooks/`
* `docs/governance/templates/`

Update docs when commands, APIs, configuration, tests, directory structure, workflow, behavior, or architecture change inside task scope.

Approved project memory paths:

* `docs/governance/`
* `docs/governance/decisions/`
* `docs/governance/runbooks/`
* `docs/governance/templates/`
* `docs/governance/*_CLOSEOUT.md`
* `docs/evidence/`
* `docs/current/state-sync-record.json`
* `.agent_board/` for lightweight handoff / run-state display only.

Project memory should be durable, useful for future agents, evidence-grounded or clearly marked as assumption, and safe to retain.

Do not write personal long-term user memory from project work unless Jenn explicitly asks.

Do not write secrets, credentials, tokens, cookies, `.env` values, private keys, verification codes, production credentials, `state-private` contents, low-value logs, short-lived noise, or unverified guesses as facts.

State-sync discipline:

* `docs/current/state-sync-record.json` is machine-authoritative state-sync claim.
* `docs/current/CURRENT_STATE.md` and `.agent_board/*` are display / evidence surfaces, not authority.
* Policy v2 content attestation is the normal path.
* Legacy v1 reanchor / state-only flows are compatibility fallback only.

---

## 9. Read-Only / Audit-Only Behavior

When Jenn asks for read-only review, audit-only work, no file changes, no writes, or "not fixing yet":

* inspect only non-sensitive repository reality;
* do not edit files;
* do not create generated artifacts;
* do not update docs, reports, task notes, issues, PRs, or memory;
* do not commit;
* do not push;
* report findings in the allowed response surface.

If review is requested, default to code-review stance: findings first, ordered by severity, with file/line references; then open questions; then summary. If no issues are found, say so and mention residual test gaps.

---

## 10. Testing and Validation Policy

Every meaningful runtime behavior change needs a test.

Minimum expectations:

* new package: unit tests;
* new reducer / policy: unit tests for edge cases and immutability;
* new execution path: integration test where feasible;
* bug fix from review: regression test when practical;
* runtime-governance change: targeted test plus broader validation when justified.

Task-specific validation expectations:

| Change type | Required validation |
|---|---|
| unit-level bugfix | targeted `node --import tsx --test tests/<name>.test.ts` or `npm test` when narrow targeting is not available |
| API / schema / contract behavior change | targeted contract tests, relevant integration tests, `npm run typecheck` |
| runtime governance behavior change | negative-path tests, targeted tests, `npm run typecheck`, `npm test`, `npm run build` |
| state-sync behavior change | targeted state-sync tests, `node --import tsx scripts/run-state-sync-audit.ts --json` in the correct context, plus broader validation |
| CI / workflow change | static review, workflow-risk explanation, and local commands that approximate CI |
| docs-only change | static review, `git diff --check`, and `npm run docs:governance` when governance docs are touched |
| memory / security / boundary change | negative-path tests or dry-runs where practical, and explicit non-authorization statement |
| release / phase closeout | `npm run validate:release` when safe and scoped |

If broad validation fails, fix failures caused by the current change or directly related to the task. Treat failures as unrelated only with evidence.

Do not report `PASS` for a required validation gate that failed.

Use precise validation claims:

* `typecheck passed`
* `targeted test passed`
* `full npm test passed`
* `build passed`
* `CI passed`
* `real host smoke not run`
* `real Codex CLI not run`
* `real workspace-write not run`

Never say production is safe unless production-level validation actually happened.

---

## 11. Runtime Governance Architecture Guardrails

Prefer small, composable packages over large central files.

Keep these responsibilities separated:

* `state-manager`: governance state and anomaly history.
* `execution-observation`: primitive execution observations.
* `entropy-risk`: risk scoring inputs and derived risk.
* `strategy-router`: dynamic strategy decisions.
* `recovery-control`: step-back, arbitration packet semantics, operator action lifecycle, and pure recovery policy.
* `checkpoint-ledger-v2`: checkpoint metadata and recovery references.
* `task-graph`: task graph and branch semantics.
* `validation-arbiter`: executor / verifier / conjugate arbitration.
* `governance-failure-reducer`: shared failure-to-governance-state reducer.
* `desktop-live-adapter`: runtime bridge between execution primitives and governance updates.
* `provider-execution-runner`: controlled provider execution orchestration.
* `provider-registry`: explicit provider selection and registry metadata.
* `workspace-write-guard`: workspace-write boundary and guard semantics.

Do not bury governance logic inside `desktop-live-adapter` if it can be expressed as a tested reducer or policy module.

Preserve DGP principles:

1. Dry-run before execution.
2. Explicit injection for host bridges, stores, runtime executors, and external dependencies.
3. No hidden side effects.
4. Failure must be named with stable classes.
5. Failures should update governance state when a governance state is present.
6. Step-back must be actionable for host / UI / CLI presentation.
7. Auditability over cleverness.

Runtime failure handling rules:

* normalize unknown thrown values before storing them as `errorClass` or anomaly messages;
* do not assume `throw` values are `Error` instances;
* never let `errorClass` become `undefined`;
* use stable fallback strings such as `unknown_execution_error`;
* update governance state through shared reducer logic where available.

Expected failure chain:

```text
primitive failure
-> execution observation
-> anomaly record
-> risk re-score
-> strategy re-route
-> optional arbitration / step-back
-> host-consumable result
```

Controlled execution boundary:

* controlled read-only provider execution may be implemented only through explicit gates, explicit injected dependencies, deterministic permits, and tests.
* general provider execution remains blocked.
* real Codex CLI execution remains blocked unless Jenn explicitly authorizes the specific run.
* real workspace-write remains blocked by default.
* workspace-write fake canary must remain fake unless explicitly promoted through a separate authorization review.

---

## 12. Incidental Findings

Handle incidental findings this way:

* hard-stop finding: report `BLOCK`;
* directly related to task or validation credibility: fix within smallest effective scope;
* unrelated but useful: record as follow-up in a scoped PR note, issue, taskbook, or docs/governance surface when allowed;
* unrelated architecture concern: do not fix during current task unless Jenn explicitly expands scope.

Stop and ask for direction if:

* the change would alter public contracts broadly;
* a migration is needed;
* a failure path cannot be tested safely;
* CI requires unavailable external binaries;
* the task starts mixing unrelated architecture areas;
* secrets, credentials, or local config files appear in the diff;
* implementation starts drifting beyond the branch or issue scope.

When in doubt, preserve the current branch state and report the exact diff and risk.

---

## 13. Subagents and Review

Use subagents when parallel work, independent review, or domain separation adds clear value.

Suggested split for complex tasks:

* Commander: scope, risks, hard stops, decomposition.
* Worker A: implementation.
* Worker B: tests.
* Worker C: docs / project memory.
* Reviewer: safety, validation, scope, secret handling.
* Integrator: final consistency, validation, commit, safe push, PR update, report.

Subagent output is not final truth. Integrator remains responsible for final delivery.

For runtime-governance or migration work, prefer at least one independent review pass before final report.

---

## 14. Reporting Template

Every repository task must end with:

```text
Result:
Scope:
Changed files:
Validation:
Evidence:
Git delivery:
Delivery surface:
Memory:
Risks:
Incidental findings:
Next step:
```

Allowed result states: `PASS`, `PARTIAL`, `BLOCK`, `FAIL`, `FINDINGS_ONLY`, `NO_CHANGES`.

For commit / push / PR / issue / task note / memory write, include enough detail to audit the delivery.

For `BLOCK`, include blocked reason, hard stop, evidence, safe actions completed, unsafe action not performed, and options for Jenn.

Do not overclaim validation. State exactly what ran and what did not run.

---

## 15. Project Fill-In Status

Filled fields:

* Project name: `codex-router`
* Stack: TypeScript / Node.js / npm / `tsx` / GitHub Actions
* Editable source/test/docs paths: `packages/`, `tests/`, `scripts/`, `docs/`, scoped `.agent_board/`
* Package manager: npm
* Setup command: `npm ci`
* Validation commands: `npm run docs:governance`, `npm run validate:daily`, `npm run validate:pr`, `npm run validate:release`, `npm run typecheck`, `npm test`, `npm run build`
* Protected branches: `main`, `master`, `production`, `release`, and any explicitly protected branch
* Approved delivery remote: verified `origin`
* CI behavior: deterministic tests, build, typecheck, governance, state-sync, docs checks, and safe dry-run/fake canary checks
* Deployment / release triggers: treated as blocked unless explicitly scoped and authorized
* Secret-adjacent paths: `.env`, `.env.*`, `config.env`, `.codex-home/`, `.omc/`, `state-private/`, credentials/tokens/cookies/keys
* Docs paths: `README.md`, `docs/`, `docs/current/`, `docs/governance/`, `docs/evidence/`
* Project memory paths: `docs/governance/`, `docs/evidence/`, `docs/current/state-sync-record.json`, `.agent_board/`
* Blocked scripts / actions: real provider execution, real Codex CLI execution, real workspace-write, external write outside approved project delivery surfaces, deploy, release, publish, tag, production mutation
* Reporting / PR conventions: narrow branch, narrow PR, truthful validation, risk notes, known gaps, no direct `main` push by default

This file is ready to rely on as the project-level protocol for `codex-router`.
