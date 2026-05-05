# Final Host Integration Evidence Plan (2026-05-05)

## 1. Status

This is a documentation-only evidence plan.

- It does not implement final host integration.
- It does not run real host smoke.
- It does not create adapters, scripts, packages, CI jobs, or release workflows.
- It does not authorize deployment, release, tag, merge, push, or downstream repository writes.
- It does not claim production certification for Codex Desktop, Codex CLI, or any downstream host.

## 2. Purpose

This document defines the evidence path for proving that `codex-router` can be exercised through real host boundaries after the current SDK baseline is clean.

The plan covers two host tracks:

- Codex Desktop final host integration evidence.
- Codex CLI real host smoke evidence.

It exists to separate SDK readiness from host acceptance. `codex-router` can be locally green while real host acceptance remains unproven until the host boundary is wired and smoke evidence is inspected.

## 3. Current Baseline

Current `codex-router` baseline:

- `main` is the sealed baseline branch for this plan.
- Harness adoption documentation is sealed as documentation-only planning.
- `docs/final-codex-desktop-host-integration-checklist-20260424.md` defines the Codex Desktop host checklist.
- `docs/codex-cli-real-host-smoke-release-checklist.md` defines the Codex CLI real host smoke checklist.
- `docs/codex-cli-smoke-strategy-20260428.md` separates CI contract smoke from local real host smoke.

This plan does not replace those documents. It organizes their evidence expectations into one decision path.

## 4. Evidence Tracks

| Track | Host boundary | Evidence purpose | Default action | Status |
|---|---|---|---|---|
| Codex Desktop final host | Real Codex Desktop host object and memory surface | Prove the final host can wire the `codex-desktop-live-host` starter and pass the structured smoke harness. | Plan only | NOT_RUN |
| Codex CLI real host | Installed and logged-in Codex CLI binary | Prove the guarded CLI host path can run read-only and explicitly gated workspace-write smoke on an operator machine. | Plan only | NOT_RUN |
| CI contract smoke | Mock spawner inside GitHub Actions or local CI-equivalent validation | Prove deterministic SDK smoke contracts without requiring a logged-in host binary. | Existing validation layer | AVAILABLE |

Status values in this plan are planning statuses only. They are not evidence that the smoke has passed.

## 5. Codex Desktop Evidence Path

Codex Desktop acceptance should start from the first-class final host starter:

- `createCodexDesktopLiveHostEmbeddingStarter()`

Required host methods:

- `read_thread_terminal`
- `spawn_agent`
- `wait_agent`
- `send_input`
- `close_agent`
- `shell_command`
- `apply_patch`
- `automation_update`
- `record_memory`
- `search_memory`

Recommended host method:

- `memory_overview`

Required preflight evidence:

| Evidence item | Required result | Notes |
|---|---|---|
| starter creation location | recorded | Must point to the final host integration layer. |
| `starter.inspect()` | `ready === true` | Must not hide missing methods. |
| `starter.getStatus()` | `pendingRequiredMethods.length === 0` | Optional method gaps must be named separately. |
| `starter.getStatus().nextAction` | `create_bundle` | Bundle creation must not happen before readiness. |
| `starter.assertReady()` | passes | Failure blocks live smoke. |

Required smoke evidence:

| Smoke lane | Required decision status | Required execution status | Required behavior |
|---|---|---|---|
| read-only | `ready` | `completed` | Exercises `read_thread_terminal` through the real host path. |
| engineering | `ready` | `completed` | Exercises agent, shell, patch, checkpoint, and memory surfaces. |
| release posture | `blocked_approval` | `not_ready` | Proves protected release-shaped action is approval-gated. |

Desktop acceptance is not complete until `runCodexDesktopLiveHostSmoke(starter).status === "passed"` and inspected evidence is recorded in the final host repository.

## 6. Codex CLI Evidence Path

Codex CLI real host acceptance should stay local and operator-gated.

Preflight commands:

```powershell
git branch --show-current
git status --short
git log --oneline --decorate -n 5
npm run typecheck
npm test
npm run build
npm run smoke:contract
codex --version
```

Read-only smoke command:

```powershell
npm run smoke:telemetry
```

Workspace-write smoke is optional and gated. It must run only after read-only smoke passes and only when the change needs bounded write evidence.

Required gates:

```powershell
$env:CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_ALLOW_WRITE="true"
$env:CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_CONFIRMATION="ALLOW_CODEX_CLI_WORKSPACE_WRITE_SMOKE"
```

Workspace-write smoke command:

```powershell
npm run smoke:workspace-write:telemetry
```

Expected evidence paths:

- `docs/evidence/codex-cli-readonly-smoke-telemetry-latest.json`
- `docs/evidence/codex-cli-workspace-write-smoke-telemetry-latest.json`
- `docs/evidence/codex-cli-workspace-write-smoke.txt`
- `docs/evidence/manifest-latest.json`

Evidence files must be inspected before they are committed. Local evidence may remain an operator artifact unless a release or PR explicitly requires checked-in evidence.

## 7. Evidence Record Shape

Every real host evidence record should be summarized with this shape:

| Field | Meaning | Required |
|---|---|---|
| `host` | `Codex Desktop` or `Codex CLI` | Yes |
| `repoRoot` | Local host repository root used for the smoke | Yes |
| `routerCommit` | `codex-router` commit under validation | Yes |
| `hostCommit` | Host repository commit, if applicable | Yes for Desktop |
| `smokeType` | `desktop-readonly`, `desktop-engineering`, `desktop-release-posture`, `cli-readonly`, or `cli-workspace-write` | Yes |
| `status` | `passed`, `failed`, `blocked`, or `not_run` | Yes |
| `decisionStatus` | Router decision status, where available | Yes when emitted |
| `executionStatus` | Host execution status, where available | Yes when emitted |
| `evidencePath` | File or artifact path containing inspected evidence | Yes |
| `operator` | Person or agent who ran the smoke | Yes |
| `timestamp` | Timestamp of the smoke run | Yes |
| `notValidated` | Explicit list of missing checks | Yes |
| `notes` | Short boundary or blocker notes | No |

Do not record secrets, raw prompts, full argv, tokens, credentials, `.env` values, production endpoints, or private host data in evidence records.

## 8. Stop Conditions

Stop instead of continuing if any condition appears:

- worktree has unrelated edits
- `.env`, `config.env`, credentials, tokens, or secrets appear in a diff
- target branch or repository is not the intended one
- Codex Desktop starter readiness is not true
- required host methods are missing, mocked, or no-op implementations
- release-posture smoke is not blocked by approval
- CLI binary is unavailable or not logged in
- read-only smoke fails
- workspace-write gates are missing or broadened
- workspace-write smoke touches files outside the expected evidence paths
- evidence contains raw prompt text, full argv, secrets, credentials, or production config
- the same smoke fails twice with the same blocker
- any command asks for broader sandbox, deployment, release, tag, merge, push, or external write authority

## 9. Hard Boundaries

This evidence plan does not authorize:

- editing Codex Desktop, Codex CLI, or downstream host repositories
- committing evidence files
- pushing branches
- opening PRs
- merging PRs
- tagging releases
- publishing packages
- deploying services
- reading or writing secrets
- broadening sandbox permissions
- bypassing approval gates
- replacing CI contract smoke with local real host smoke

Remote writes, branch deletion, release actions, deployments, and checked-in evidence still require a separate explicit approval.

## 10. Decision Rule

Use this decision rule after local `codex-router` validation is green:

| Condition | Decision |
|---|---|
| Documentation-only or SDK-internal change | CI contract smoke and standard project validation are enough unless host-sensitive behavior changed. |
| Codex CLI host behavior changed | Run read-only real CLI smoke; run workspace-write smoke only when write behavior changed and gates are approved. |
| Codex Desktop final host wiring changed | Run Desktop starter readiness and structured final-host smoke in the final host repository. |
| Evidence contains sensitive data or unexpected writes | Block, sanitize, and do not commit evidence. |
| Release posture does not block protected action | Block release and inspect approval gate mapping. |

## 11. Recommended Next Step

Use this plan as the preflight boundary for the next host-sensitive work item.

The smallest safe next step is a read-only final host readiness reconnaissance that identifies where the real Codex Desktop host object would be wired and whether the required runtime and memory primitives are available.

Do not modify the Codex Desktop repository or run live smoke from this planning task.
