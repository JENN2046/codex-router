# Codex CLI Host

`packages/codex-cli-host` is the first narrow adapter seam for treating Codex
CLI as a supported host route for `codex-router`.

It builds safe command plans, can run guarded `codex exec --json` processes, and
parses CLI output so execution evidence inherits one policy boundary.

## Current Local Recon

Read-only local reconnaissance on `2026-04-24` found:

- installed CLI: `codex-cli 0.125.0` as of the `2026-04-25` recheck
- npm entry: `C:\Users\617\AppData\Roaming\npm\codex.ps1`
- package: `@openai/codex`
- runtime: native `codex.exe` from `@openai/codex-win32-x64`

Useful CLI surfaces:

- `codex exec --json`
- `codex exec resume --last --json`
- `codex mcp-server`
- experimental `codex exec-server`
- experimental `codex app-server`
- `codex plugin`
- `codex mcp`

Because the npm package is mostly a Node shim around a native binary, the first
adapter should wrap process or server protocols rather than importing internal
JavaScript modules.

## Official Entry Recheck

The `2026-04-25` official-docs recheck found that the Microsoft Store Codex app
is still not the editable source boundary for this project. The supported
programmable route is Codex CLI / SDK / App Server, with plugins available as a
Codex-facing extension mechanism.

See:

- `docs/codex-official-entry-recon-20260425.md`

## Main Entry

Use:

- `createCodexCliExecPlanFromRoutingDecision()`
- `validateCodexCliExecPlanForRun()`
- `runCodexCliExecPlan()`
- `createCodexCliReadOnlySmokeTask()`
- `runCodexCliReadOnlySmoke()`
- `createCodexCliReadOnlySmokeEvidence()`
- `writeCodexCliReadOnlySmokeEvidenceFile()`
- `runAndWriteCodexCliReadOnlySmokeEvidence()`
- `parseCodexCliJsonl()`
- `inspectCodexCliCommandOutput()`
- `fetchOpenAiModelCatalog()`
- `parseOpenAiModelCatalogResponse()`
- `checkCodexCliModelCatalogAtStartup()`
- `createCodexCliModelCliProbeEvidence()`
- `writeCodexCliModelCliProbeEvidenceFile()`
- `runAndWriteCodexCliModelCliProbeEvidence()`
- `createCodexCliModelCheckEvidence()`
- `writeCodexCliModelCheckEvidenceFile()`
- `runAndWriteCodexCliModelCheckEvidence()`
- `detectCodexCliModelCatalogDrift()`
- `checkCodexCliModelAvailability()`
- `checkCodexCliExecPlanModelAvailability()`
- `getKnownCodexCliModelIds()`
- `resolveCodexCliSandbox()`
- `resolveCodexCliSandboxForRoutingDecision()`
- `createCodexCliWorkspaceWriteSmokeEvidence()`
- `writeCodexCliWorkspaceWriteSmokeEvidenceFile()`
- `runAndWriteCodexCliWorkspaceWriteSmokeEvidence()`

## Exec Plan

Production callers should build CLI plans from a routed policy decision:

```ts
import { createCodexCliExecPlanFromRoutingDecision } from "../packages/codex-cli-host/src/index.js";

const plan = createCodexCliExecPlanFromRoutingDecision(task, decision, {
  ephemeral: true
});
```

The plan is shaped for:

```text
codex -a <approval-policy> exec --json --sandbox <mode> --cd <repo> <prompt>
```

Defaults:

- read-only tasks use `--sandbox read-only`
- write-shaped tasks use `--sandbox workspace-write`
- approval metadata defaults to `on-request`
- for Codex CLI `0.125.0`, the approval flag is emitted before `exec` as
  `-a <approval-policy>`
- dangerous bypass flags are rejected
- `--skip-git-repo-check` is not emitted by default
- production plans from `createCodexCliExecPlanFromRoutingDecision()` always
  emit `--ignore-user-config`, so Router controls the effective Codex config

The adapter intentionally does not emit:

- `--dangerously-bypass-approvals-and-sandbox`
- `--dangerously-bypass-hook-trust`
- `--full-auto`
- `--yolo`
- `danger-full-access`

The raw `createCodexCliExecPlan()` builder remains internal/smoke-only under
`packages/codex-cli-host/src/internal.ts`. Production paths should use
`createCodexCliExecPlanFromRoutingDecision()` so model and sandbox come from the
router decision rather than caller-supplied raw options.

When the caller already has a `RoutingDecision`, use:

```ts
const plan = createCodexCliExecPlanFromRoutingDecision(task, decision, {
  ephemeral: true
});
```

That helper binds the policy-selected model to CLI argv as `--model <selectedModel>`
and derives the CLI sandbox from `decision.execution.toolAccess`. Read-only tool
access maps to `--sandbox read-only`; all write-capable tool access maps to
`--sandbox workspace-write`. The helper rejects task/decision id mismatches and
does not allow callers to override `model`, `sandbox`, or user-config posture, so
the CLI plan inherits the router decision and Router-owned config posture instead
of shadowing it.

For user-controlled model choice, keep the same helper and turn on the explicit
preference switch:

```ts
const plan = createCodexCliExecPlanFromRoutingDecision(task, decision, {
  modelSelection: {
    mode: "user_preference",
    requestedModel: "gpt-5.3-codex"
  },
  ephemeral: true
});
```

Default mode is `auto`, which always uses `decision.execution.selectedModel`.
`user_preference` lets the caller request a model, but the helper still resolves
the final model. A request for a model at least as strong as the router-selected
model is accepted and emitted as `--model <requestedModel>`. A weaker request is
rejected by default, the plan falls back to the router-selected model, and the
rejection is recorded in `plan.modelResolution` plus `plan.warnings`.

Model strength is not treated as a simple marketing-order list. The helper keeps
a local strength profile with capability and latency separated. In that profile,
`gpt-5.3-codex-spark` is classified as latency-optimized for real-time Codex
work, while `gpt-5.4-mini` is classified as a newer general small model with a
higher capability floor. That means a user preference from
`gpt-5.3-codex-spark` to `gpt-5.4-mini` is accepted rather than treated as a
downgrade. Runtime escalation uses the same project order:

```text
gpt-5.3-codex-spark -> gpt-5.4-mini -> gpt-5.3-codex -> gpt-5.4 -> gpt-5.1-codex-max
```

This ranking is a project governance floor, not a universal benchmark claim.
Spark still has a better latency profile; mini is treated as the stronger
general capability choice.

## Model Catalog Drift Detection

Official model availability can change. The adapter therefore exposes a small
catalog check that compares local policy models with the official model list.
The official OpenAI API shape is:

```text
GET https://api.openai.com/v1/models
```

with a list response containing model objects such as `id`, `object`, `created`,
and `owned_by`.

Use:

```ts
const catalog = await fetchOpenAiModelCatalog({
  apiKey: process.env.OPENAI_API_KEY
});

const drift = detectCodexCliModelCatalogDrift({
  officialModels: catalog
});
```

For host startup, fetch once and keep the catalog as the runtime guard input:

```ts
const startupCheck = await checkCodexCliModelCatalogAtStartup({
  apiKey: process.env.OPENAI_API_KEY
});

const run = await runCodexCliExecPlan(plan, {
  modelCatalog: startupCheck.catalog,
  requireModelCatalog: true
});
```

For per-run checks without a live network request, pass a previously fetched
catalog into `checkCodexCliModelAvailability()` or directly into
`runCodexCliExecPlan()`. When `requireModelCatalog` is true, the runner blocks
before spawning Codex CLI if no catalog is available. If the selected
`plan.model` is absent from the catalog, the runner also blocks before spawn
with `codex_cli_model_unavailable:<model>`.

The detector reports:

- `availableKnownModels`: local policy models still present in the official list
- `missingKnownModels`: local policy models absent from the official list
- `untrackedOfficialModels`: relevant official GPT/Codex models not yet modeled
  by local policy
- `ignoredOfficialModelCount`: official models outside the GPT/Codex relevance
  filter, such as embedding, audio, or image models

`fetchOpenAiModelCatalog()` reads `OPENAI_API_KEY` by default, but callers can
inject `apiKey`, `baseUrl`, or `fetch` for testing. Do not log the API key or raw
headers. If live catalog access is unavailable, callers should keep using the
local policy and surface the drift check as unavailable rather than blocking
normal offline operation.

## Model Check Command

Use the explicit operator command when you want a model availability artifact:

```text
npm run model:check
```

By default this uses the logged-in Codex CLI session, not `OPENAI_API_KEY`.
It runs a read-only `codex exec --json --model <model>` probe with `-a never`,
`--ephemeral`, and the normal Git repository check. This is the right mode for
checking whether the current Codex account can execute the selected model before
a real task.

The command reads:

- `CODEX_CLI_MODEL_CHECK_SOURCE`: `cli` by default, or `catalog`
- `CODEX_CLI_MODEL_CHECK_MODEL`: model to probe in `cli` mode, default
  `gpt-5.4-mini`
- `CODEX_CLI_MODEL_CHECK_MODE`: `strict` by default, or `warn`
- `CODEX_CLI_MODEL_CHECK_CODEX_COMMAND`: optional Codex command override
- `CODEX_CLI_MODEL_CHECK_CWD`: optional working directory for the probe
- `CODEX_CLI_MODEL_CHECK_TIMEOUT_MS`: optional probe timeout
- `CODEX_CLI_MODEL_CHECK_EVIDENCE_PATH`: optional output path, default
  `docs/evidence/codex-cli-model-check-latest.json`

For the deeper official catalog drift check, set:

```text
CODEX_CLI_MODEL_CHECK_SOURCE=catalog
```

Catalog mode reads:

- `OPENAI_API_KEY`: required for the live `/models` request
- `OPENAI_BASE_URL`: optional override, default `https://api.openai.com/v1`

Strict mode exits non-zero if the selected CLI model probe fails, if catalog
access is unavailable in catalog mode, or if the official catalog has drift
against local policy. Warn mode records the same evidence but does not turn
unavailable access into a blocking result. Evidence records sanitized metadata
only; it does not persist API keys, Authorization headers, raw request headers,
or the raw probe prompt.

For execution-time enforcement, `runCodexCliExecPlan()` can now reuse a cached
CLI probe or run one automatically before the main task spawn:

```ts
const run = await runCodexCliExecPlan(plan, {
  autoProbeModelWithCli: true,
  requireModelProbe: true
});
```

Relevant options:

- `modelProbe`: reuse a previously captured CLI probe evidence object
- `requireModelProbe`: block execution if probe evidence is required but missing
  or failed
- `autoProbeModelWithCli`: run the same logged-in CLI model probe automatically
  before the main spawn
- `modelProbeStrict`: treat auto-probe failures as blocking even when
  `requireModelProbe` is false
- `modelProbeTimeoutMs`: override the probe timeout
- `modelProbeCacheTtlMs`: cache a passed probe in memory for a short TTL
- `disableModelProbeCache`: disable the in-memory passed-probe cache
- `telemetryStore`: optionally emit best-effort cache hit/miss telemetry events
- `skipExecutionModelProbe`: explicitly disable the default automatic probe

The auto-probe path uses the same selected `plan.model`, runs read-only with
`-a never`, and does not recurse into itself.

When `plan.model` is present, `runCodexCliExecPlan()` now defaults to:

- `autoProbeModelWithCli: true`
- `requireModelProbe: true`

So governed Codex CLI execution probes the selected model before the main task
spawn unless the caller explicitly opts out with `skipExecutionModelProbe: true`.
Passed probes are cached in memory for 5 minutes by default, keyed by command,
working directory, and model, so repeated executions do not need to probe every
time. Failed probes are not cached. When a `telemetryStore` is supplied, the
runner emits `codex cli model probe cache miss` and `codex cli model probe cache hit`
events as best-effort observability signals.

## Guarded Runner

`runCodexCliExecPlan()` accepts a `CodexCliExecPlan`, validates it again before
spawning a process, captures stdout/stderr, and returns
`inspectCodexCliCommandOutput()` evidence.

Default runner gates:

- command must be non-empty
- plan must use `codex exec`
- plan must include `--json`
- sandbox must be `read-only` or `workspace-write`
- approval policy must be `untrusted`, `on-request`, or `never`
- dangerous bypass arguments are rejected even if a plan is manually forged
- argv `--sandbox` and approval values must match plan metadata
- `workspace-write` plans require `allowWriteSandbox: true`
- `--skip-git-repo-check` is blocked unless the caller passes
  `allowSkipGitRepoCheck: true`
- `workspace-write` plans may never use `--skip-git-repo-check`
- `workspace-write` plans require a known repo root, `worktreeClean: true`,
  a recorded `beforeCommit`, a rollback command, and a target allowlist through
  `workspaceWritePreflight`
- JSONL output is semantically inspected before the run is considered complete:
  unknown strict events fail closed, secret-like event content is blocked,
  read-only runs cannot report file changes or write commands, workspace-write
  file-change events must match task target files, and remote-write commands
  such as push, merge, tag, release, or publish are blocked
- when a `modelCatalog` is supplied, the selected `plan.model` must be present
- when `requireModelCatalog` is true, execution is blocked until a catalog is
  supplied

The default implementation uses `child_process.spawn()` with `shell: false`.
Tests use an injectable spawner so the policy and evidence behavior can be
validated without running live Codex CLI work.

## Provider Prompt Handoff

The Codex CLI executor provider still omits the raw task prompt from provider
plan metadata and artifacts. Plan metadata records only a one-shot handoff
handle, the provider input hash, and a prompt content hash. The raw prompt is
kept in a short-lived in-memory handoff store owned by the provider instance.

Non-dry-run provider execution must consume that handoff exactly once before it
spawns Codex CLI. The provider checks plan id, run id, task id, input hash, and
content hash before rebuilding the final `codex exec` argv. Missing, expired,
reused, or mismatched handoffs fail closed before spawn. Dry-runs validate the
sanitized plan and never consume or expose the raw prompt.

## Read-Only Smoke

`runCodexCliReadOnlySmoke()` is the explicit safe smoke wrapper for the
official CLI route. It creates or accepts a read-only task envelope, forces:

- `--sandbox read-only`
- `-a never` for non-interactive smoke execution
- `--json`
- `--ephemeral` by default
- a default `180000` ms timeout window

Read-only smoke does not skip the Git repository check by default. A smoke or
canary fixture that must exercise `--skip-git-repo-check` has to set
`planOptions.skipGitRepoCheck: true` and pass `allowSkipGitRepoCheck: true`.
Workspace-write smoke never allows this flag.

It does not expose `allowWriteSandbox`. Any write-capable CLI run must use the
lower-level guarded runner directly and pass the normal project approval rules.
The process runner ignores child stdin for non-interactive execution while still
capturing stdout and stderr, so Codex CLI does not wait for extra terminal
input.

Use `createCodexCliReadOnlySmokeEvidence()` to persist a compact result. The
evidence intentionally omits the full prompt and raw argv so task details or
config overrides are not accidentally copied into docs or memory.

For host or operator workflows that need an artifact on disk, use:

- `writeCodexCliReadOnlySmokeEvidenceFile(evidence, path)`
- `runAndWriteCodexCliReadOnlySmokeEvidence({ evidencePath, ... })`

These helpers create parent directories and write formatted JSON evidence. They
do not relax the read-only smoke policy and they persist failed pre-run
validation evidence without spawning Codex CLI.

When `planOptions.model` is set, `runCodexCliReadOnlySmoke()` also forwards an
optional `telemetryStore` into the guarded runner so repeated smoke runs can
surface model probe cache miss/hit events through the normal observability sink.

For an explicit acceptance pass, run:

```powershell
npm run smoke:telemetry
```

That command clears the in-memory probe cache, runs the modeled read-only smoke
twice, captures telemetry, and writes a combined artifact to
`docs/evidence/codex-cli-readonly-smoke-telemetry-latest.json`.

## Workspace-Write Preflight

`createCodexCliWorkspaceWriteSmokePreflight()` prepares the next smoke stage
without executing it. It creates a bounded `workspace-write` task that targets
only:

- `docs/evidence/codex-cli-workspace-write-smoke.txt`

The preflight is `blocked` unless both gates are present:

- `allowWriteSandbox: true`
- confirmation string: `ALLOW_CODEX_CLI_WORKSPACE_WRITE_SMOKE`

It also requires the workspace-write safety packet to be complete:

- a known repo root or working directory
- `repoContext.worktreeClean: true`
- a recorded `beforeCommit`
- a rollback command derived from that commit and the target files
- target files that match the smoke target allowlist
- no `--skip-git-repo-check`

Use `createCodexCliWorkspaceWriteSmokePreflightEvidence()` and
`writeCodexCliWorkspaceWriteSmokePreflightEvidenceFile()` to persist a compact
preflight artifact. The evidence omits the raw prompt and argv, records the
target files and modules, and does not spawn Codex CLI.

Use `createCodexCliWorkspaceWriteSmokeApprovalPacket()` and
`writeCodexCliWorkspaceWriteSmokeApprovalPacketFile()` to prepare the operator
confirmation material before any live write-capable smoke. The approval packet
records:

- repo state supplied by the caller
- sanitized command preview with the task prompt omitted
- exact target file list
- required gates
- blockers
- rollback strategy

Use `createCodexCliWorkspaceWriteSmokeEvidence()` and
`writeCodexCliWorkspaceWriteSmokeEvidenceFile()` to persist the bounded
workspace-write outcome once the gated runner has been exercised. The evidence
follows the same compact posture as the read-only smoke artifact and omits the
raw prompt and full argv.

`runCodexCliWorkspaceWriteSmoke()` is the gated execution helper for the same
bounded task. It first runs the same preflight. If either gate is missing, it
returns `blocked` and does not spawn Codex CLI. If both gates are present, it
calls the guarded process runner with `allowWriteSandbox: true` and a default
`180000` ms timeout window.

For operator workflows that need a single artifact on disk, use:

- `runAndWriteCodexCliWorkspaceWriteSmokeEvidence({ evidencePath, ... })`

The current blocked workspace-write evidence artifact was written to:

- `docs/evidence/codex-cli-workspace-write-smoke-evidence-20260425.json`

The first live workspace-write success artifact was written to:

- `docs/evidence/codex-cli-workspace-write-smoke-live-fixed-20260425.json`

For a gated double-run telemetry acceptance, use:

```powershell
$env:CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_ALLOW_WRITE="true"
$env:CODEX_CLI_WORKSPACE_WRITE_SMOKE_TELEMETRY_CONFIRMATION="ALLOW_CODEX_CLI_WORKSPACE_WRITE_SMOKE"
npm run smoke:workspace-write:telemetry
```

That command stays blocked unless both gates are present. When allowed, it
clears the in-memory probe cache, runs the bounded workspace-write smoke twice,
captures telemetry, and writes a combined artifact to
`docs/evidence/codex-cli-workspace-write-smoke-telemetry-latest.json`.

## Governance V2 and Recovery

`runCodexCliExecPlan()` now carries a V2 governance bundle through execution.
The bundle includes:

- `state`: phase, strategy, risk score, anomaly ledger, and approvals.
- `observation`: parsed signals (blocked/failed/degraded context) and status.
- `strategy`: `continue`, `verify`, `lockdown`, `step_back`, or `abort`.
- `ledgerEntry`: checkpoint state and reversible/irreversible action tracking.
- optional `arbitrationPacket`: machine review packet when escalation is needed.

The step policy is enforced on anomaly count:

- anomaly count `1`: strategy escalates to `verify`.
- anomaly count `2`: strategy escalates to `lockdown`.
- anomaly count `3`: strategy enters `step_back` and execution is hard-blocked.

In this release track, write sandbox is disallowed in `lockdown` and `step_back`
to keep workspace-write recovery bounded. If `step_back` is active, execution
helpers return `codex_cli_governance_step_back_active` before process spawn.

Evidence serializers expose compact governance metadata so acceptance and smoke
artifacts can be checked without leaking full governance internals.

## Operator Acceptance

`runCodexCliOperatorAcceptance()` is the formal operator-task acceptance helper
for `runCodexCliExecPlan()`. It accepts a normal task envelope, builds the exec
plan, applies the same guarded validation path, fans telemetry into an internal
recording sink plus any caller-provided telemetry sink, and returns a compact
acceptance result object.

For a one-shot CLI entrypoint that also persists a sanitized artifact, use:

```powershell
npm run operator:acceptance
```

That default mode is read-only. It writes a compact artifact to:

- `docs/evidence/codex-cli-operator-acceptance-readonly-latest.json`

Workspace-write mode writes to:

- `docs/evidence/codex-cli-operator-acceptance-workspace-write-latest.json`

Optional environment overrides:

- `CODEX_CLI_OPERATOR_ACCEPTANCE_MODE=workspace-write`
- `CODEX_CLI_OPERATOR_ACCEPTANCE_MODEL=<model>`
- `CODEX_CLI_OPERATOR_ACCEPTANCE_EVIDENCE_PATH=<path>`
- `CODEX_CLI_OPERATOR_ACCEPTANCE_CODEX_COMMAND=<command>`
- `CODEX_CLI_OPERATOR_ACCEPTANCE_CWD=<cwd>`
- `CODEX_CLI_OPERATOR_ACCEPTANCE_MODEL_PROBE_TIMEOUT_MS=<ms>`

Workspace-write mode remains explicitly gated:

```powershell
$env:CODEX_CLI_OPERATOR_ACCEPTANCE_MODE="workspace-write"
$env:CODEX_CLI_OPERATOR_ACCEPTANCE_ALLOW_WRITE="true"
$env:CODEX_CLI_OPERATOR_ACCEPTANCE_CONFIRMATION="ALLOW_CODEX_CLI_WORKSPACE_WRITE_SMOKE"
npm run operator:acceptance
```

For manual release-only acceptance, command wrappers are available:

```powershell
npm run operator:acceptance:readonly
npm run operator:acceptance:release
```

The release wrapper pre-fills:

- `CODEX_CLI_OPERATOR_ACCEPTANCE_MODE=workspace-write`
- `CODEX_CLI_OPERATOR_ACCEPTANCE_ALLOW_WRITE=true`
- `CODEX_CLI_OPERATOR_ACCEPTANCE_CONFIRMATION=ALLOW_CODEX_CLI_WORKSPACE_WRITE_SMOKE`

The persisted evidence omits the raw prompt and full argv, records the task
summary, target files, model, sandbox, approval policy, validation blockers,
run result, and captured telemetry messages.

For a formal double-run telemetry acceptance, use:

```powershell
npm run operator:acceptance:telemetry
```

That default mode is read-only. It clears the in-memory model probe cache, runs
operator acceptance twice, and requires the evidence to contain both:

- `codex cli model probe cache miss`
- `codex cli model probe cache hit`

The read-only telemetry artifact is written to:

- `docs/evidence/codex-cli-operator-acceptance-telemetry-readonly-latest.json`

Workspace-write telemetry acceptance remains gated:

```powershell
$env:CODEX_CLI_OPERATOR_ACCEPTANCE_TELEMETRY_MODE="workspace-write"
$env:CODEX_CLI_OPERATOR_ACCEPTANCE_TELEMETRY_ALLOW_WRITE="true"
$env:CODEX_CLI_OPERATOR_ACCEPTANCE_TELEMETRY_CONFIRMATION="ALLOW_CODEX_CLI_WORKSPACE_WRITE_SMOKE"
npm run operator:acceptance:telemetry
```

The workspace-write telemetry artifact is written to:

- `docs/evidence/codex-cli-operator-acceptance-telemetry-workspace-write-latest.json`

Telemetry mode also accepts:

- `CODEX_CLI_OPERATOR_ACCEPTANCE_TELEMETRY_MODEL_PROBE_TIMEOUT_MS=<ms>`
- `CODEX_CLI_OPERATOR_ACCEPTANCE_TELEMETRY_CODEX_COMMAND=<command>`
- `CODEX_CLI_OPERATOR_ACCEPTANCE_TELEMETRY_CWD=<cwd>`

On this Windows host, the live smoke helpers now auto-resolve the installed
package's direct `codex.exe` entry before spawning. That avoids the
Node-process `spawn codex ENOENT` case seen in this session, while still
leaving an explicit `codexCommand` override available for callers who need one.
The bare `codex` shim still resolves in PowerShell, but the runner now prefers
the native executable path when it can find it. That is a local runtime
inference, not a universal CLI rule.

## Output Inspection

`inspectCodexCliCommandOutput()` parses stdout as JSONL and extracts stderr
warnings. Stderr warnings do not fail a command by themselves; non-zero exit
codes or invalid JSONL do.

This matters because local `codex --help` commands have emitted warnings about
stale `~\.codex\tmp\arg0` cleanup being denied. That should be surfaced as
diagnostic evidence, not automatically treated as a failed host smoke.

## Verification Snapshot

The CLI host line is now implemented and documented as a guarded, split
adapter:

- `index.ts` remains a façade and re-exports `index-impl.ts`.
- governance V2 lives in `governance-v2.ts`.
- export-lock fixtures cover the public host surface and the governance-v2
  surface.
- operator acceptance wrappers exist for read-only and release-only
  workspace-write runs.
- workspace-write remains explicitly gated behind the
  `ALLOW_CODEX_CLI_WORKSPACE_WRITE_SMOKE` confirmation path.

Validated on `2026-04-27`:

- `npm run build` passed.
- `npm test` passed, `202/202`.
- the documented `operator:acceptance` and smoke wrappers were exercised live:
  all lanes passed (read-only, workspace-write, telemetry miss→hit).
- previous `spawn EPERM` blocker is resolved in this environment; the default
  spawner now falls back to `shell: true` when the native `.exe` spawn hits
  EPERM on Windows.

Current evidence files:

- `docs/evidence/codex-cli-operator-acceptance-readonly-latest.json`
- `docs/evidence/codex-cli-operator-acceptance-workspace-write-latest.json`
- `docs/evidence/codex-cli-operator-acceptance-telemetry-readonly-latest.json`
- `docs/evidence/codex-cli-readonly-smoke-telemetry-latest.json`
- `docs/evidence/codex-cli-workspace-write-smoke-telemetry-latest.json`
