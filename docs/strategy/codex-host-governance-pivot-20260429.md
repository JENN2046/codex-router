# Codex Host Governance Pivot Recon

> Date: 2026-04-29
> Scope: OpenAI Codex public roadmap signals and `codex-router` direction reset
> Mode: reconnaissance
> Status: draft for strategy decision

## Executive Summary

`codex-router` should pivot away from being a general Codex router, command
center, multi-agent scheduler, or host execution platform.

OpenAI is already moving Codex into those layers:

- Codex App as an agent command center
- multi-agent and worktree management
- skills, plugins, apps, MCP, browser, and computer use
- automations and long-running scheduled work
- sandbox, approval, rules, hooks, managed configuration, and App Server
- GitHub Action and SDK-based automation
- enterprise analytics, compliance export, and managed requirements

The remaining defensible gap is not "how to run Codex." It is:

```text
prove what Codex actually did,
under which host/sandbox/approval boundary,
with what evidence,
and whether that evidence satisfies a release or governance policy.
```

Recommended new positioning:

```text
codex-router -> Codex Host Governance Harness
```

The project should become a local-first evidence, audit, and policy verification
harness for Codex CLI, Codex App Server, local host execution, CI runs, and
release signoff.

## Evidence Sources

This note uses public information observed on 2026-04-29 plus local repository
inspection.

Primary OpenAI / official sources:

- `https://openai.com/index/introducing-the-codex-app/`
- `https://openai.com/index/codex-for-almost-everything/`
- `https://openai.com/index/openai-on-aws/`
- `https://developers.openai.com/codex/open-source`
- `https://developers.openai.com/codex/feature-maturity`
- `https://developers.openai.com/codex/sdk`
- `https://developers.openai.com/codex/noninteractive`
- `https://developers.openai.com/codex/app-server`
- `https://developers.openai.com/codex/rules`
- `https://developers.openai.com/codex/hooks`
- `https://developers.openai.com/codex/concepts/sandboxing`
- `https://developers.openai.com/codex/agent-approvals-security`
- `https://developers.openai.com/codex/enterprise/governance`
- `https://developers.openai.com/codex/enterprise/managed-configuration`
- `https://developers.openai.com/codex/github-action`
- `https://developers.openai.com/codex/app/automations`
- `https://developers.openai.com/codex/app/local-environments`
- `https://developers.openai.com/codex/app/computer-use`
- `https://help.openai.com/en/articles/11369540`
- `https://help.openai.com/en/articles/11752874-chatgpt-codex`

Public issue / release signals:

- `https://github.com/openai/codex/releases`
- `https://github.com/openai/codex/issues/15310`
- `https://github.com/openai/codex/issues/17179`
- `https://github.com/openai/codex/issues/15292`
- `https://github.com/openai/codex/issues/18113`
- `https://github.com/openai/codex/issues/14068`
- `https://github.com/openai/codex/issues/15305`
- `https://github.com/openai/codex/issues/15309`

Local repo signals:

- `README.md`
- `docs/codex-official-entry-recon-20260425.md`
- `docs/codex-cli-host.md`
- `docs/codex-cli-smoke-strategy-20260428.md`
- `docs/codex-cli-real-host-smoke-release-checklist.md`
- `docs/desktop-live-recovery-result-contract-20260428.md`
- `docs/dgp-roadmap-phase-15-20.md`
- `packages/codex-cli-host`
- `packages/governance-failure-reducer`
- `packages/recovery-control`
- `packages/validation-arbiter`
- `packages/observability`

## OpenAI Coverage Map

### 1. Agent Command Center

OpenAI publicly positions the Codex App as a command center for agents. The app
supports parallel agent work, project-organized threads, diff review, editor
handoff, and built-in worktree support.

Implication:

`codex-router` should not compete by building its own agent command center,
thread manager, or worktree-oriented execution UI.

### 2. Multi-Agent and Worktrees

Codex now exposes stable local multi-agent features. Local `codex features list`
on 2026-04-29 showed:

```text
multi_agent      stable true
multi_agent_v2   under development false
```

The App documentation also describes automations that can run in either the
local project or a background worktree.

Implication:

`desktop-agent-strategy`, `delegation-policy`, and `task-graph` should no
longer be treated as a product-level orchestration system. If retained, they
should be internal evidence and recovery metadata.

### 3. Skills, Plugins, Apps, MCP

OpenAI has made skills and plugins first-class Codex extension mechanisms.
Plugins can combine skills, app integrations, and MCP servers. The App Server
protocol can pass `skill` input items directly.

Implication:

Reusable task workflows should move toward Codex skills or plugins. This repo
should only keep workflow logic when it is specifically about governance
verification.

### 4. Automation

Codex App automations can schedule recurring background tasks, use skills, run
against local projects or worktrees, and report findings in a triage queue.
OpenAI also provides a GitHub Action for CI/CD automation around `codex exec`.

Implication:

`codex-router` should not become a scheduler or automation product. Its role
should be to validate automation boundaries and produce evidence:

- which sandbox was active
- whether rules and hooks were applied
- whether file changes were bounded
- whether approvals were requested, accepted, declined, or bypassed
- whether CI evidence is deterministic or local-only

### 5. Sandbox, Approvals, Rules, Hooks

OpenAI already exposes the core control plane:

- sandbox modes: `read-only`, `workspace-write`, `danger-full-access`
- approval policies: `untrusted`, `on-request`, `never`
- writable roots
- protected `.git`, `.codex`, and `.agents` paths
- command `rules`
- lifecycle `hooks`
- automatic approval reviews
- managed requirements

Local `codex features list` also showed:

```text
guardian_approval stable true
codex_hooks       stable true
shell_tool        stable true
unified_exec      stable false on this Windows host
```

Implication:

The project should not define a parallel permission model as its main product.
It should verify and record how OpenAI's permission model behaved for a specific
run.

### 6. App Server and SDK

OpenAI exposes a Codex SDK and an App Server protocol. App Server already
streams structured events for:

- turns
- plans
- command executions
- file changes
- MCP tool calls
- dynamic tool calls
- collab tool calls
- web searches
- command execution approval requests
- file change approval requests
- network approval context

Implication:

`host-dispatcher` and any custom host protocol should be treated as transitional.
Long-term, a governance harness should ingest Codex App Server events rather
than invent a competing protocol.

### 7. Enterprise Governance

OpenAI documents:

- analytics dashboard
- Analytics API
- Compliance API
- cloud-managed `requirements.toml`
- MDM/system requirements
- managed hooks
- command rules
- MCP allowlists
- feature pinning

Implication:

Enterprise governance is not empty territory. The gap is narrower: local run
proof, artifact-level evidence, policy verification, and release signoff.

## Remaining Gap

The strongest gap is local and evidence-centered.

Official Help Center notes that Codex usage in local environments is not
available in the Compliance API. The ChatGPT agent Help Center also says
conversations involving agent tasks appear in Compliance API logs, but individual
agent actions such as virtual computer usage and app requests do not.

That leaves an important operator question:

```text
Can I prove, from local evidence, that this Codex run obeyed my intended
sandbox, approval, file, network, branch, and recovery policy?
```

OpenAI has control surfaces, but public docs do not show a complete local-first
evidence artifact standard for:

- sandbox proof
- approval proof
- rules / hooks proof
- file mutation boundaries
- `.git` mutation boundaries
- local host smoke proof
- CI contract vs real-host distinction
- failure-to-governance-state reduction
- step-back / recovery arbitration
- release signoff bundles

This is the viable project niche.

## Public Reliability Signals

Public issues in `openai/codex` show that sandbox and approval propagation is a
real operational pain point.

Observed themes:

- Desktop automations can start with an unintended sandbox policy.
- App Server tool commands can inherit a stricter sandbox than requested.
- Allowed command rules can still result in approval prompts when sandbox escape
  is involved.
- Approved escalated commands can retain restricted network policy.
- Review subagents can fail to inherit runtime sandbox overrides.
- Windows sandbox setup can affect ACL or ownership state.

These issues should not be treated as permanent product gaps. OpenAI may fix
them quickly. But they validate the need for a harness that detects, records,
and reports such mismatches at the project/operator level.

## Local Project Assessment

Current README says:

```text
codex-router is a Desktop-first policy SDK for Codex.
It assumes Codex Desktop already provides the execution runtime,
then adds the missing governance layer.
```

That remains close to the right idea, but the phrase `router` now points in the
wrong direction. The project should emphasize governance, evidence, and
verification rather than routing or execution orchestration.

### Preserve and Promote

These modules align with the pivot:

- `codex-cli-host`
- `approval-gate`
- `preflight`
- `policy-config`
- `observability`
- `audit-memory`
- `checkpoint-ledger-v2`
- `execution-observation`
- `governance-failure-reducer`
- `recovery-control`
- `validation-arbiter`
- real host smoke evidence docs

Why:

They can become the foundation for:

- `HostRunEvidence`
- `SandboxEvidence`
- `ApprovalEvidence`
- `CommandEvidence`
- `FileChangeEvidence`
- `HookEvidence`
- `RulesEvidence`
- `FailureEvidence`
- `RecoveryEvidence`
- `ReleaseSignoffEvidence`

### Reframe or Freeze

These modules overlap with OpenAI platform direction:

- `desktop-agent-strategy`
- `delegation-policy`
- `task-graph`
- `host-dispatcher`
- broad routing/model/agent execution logic
- Desktop command-center embedding surfaces

Recommended treatment:

- do not delete immediately
- stop expanding them as product-facing APIs
- reclassify them as internal evidence, recovery, or compatibility helpers
- avoid marketing them as the project differentiator

### Keep as Transitional

These areas may remain useful while Codex APIs stabilize:

- `desktop-live-adapter`
- `desktop-host-client`
- `codex-desktop-bindings`
- `codex-desktop-live-host`
- `host-client-example`

Recommended treatment:

- do not deepen them into a parallel Desktop platform
- use them as compatibility adapters
- prefer App Server / CLI event ingestion when possible

## Recommended New Architecture

### Core Concept

```text
Codex Host Governance Harness
```

The harness does not decide how Codex should perform all work. It verifies a
specific Codex run against a declared policy and emits evidence.

### Suggested Package Direction

New or renamed public surfaces:

- `host-evidence`
- `sandbox-proof`
- `approval-proof`
- `rules-hooks-proof`
- `codex-cli-evidence-adapter`
- `app-server-evidence-adapter`
- `release-signoff`
- `governance-policy-verifier`

Existing packages can feed these surfaces:

- `codex-cli-host` -> Codex CLI evidence adapter
- `observability` -> telemetry and alert sink
- `governance-failure-reducer` -> failure normalization
- `recovery-control` -> recovery action model
- `validation-arbiter` -> verifier / executor disagreement evidence
- `checkpoint-ledger-v2` -> artifact references and run lineage

### Evidence Flow

```text
Codex run
  -> collect host events
  -> normalize command/file/tool/approval items
  -> attach sandbox and rules context
  -> reduce failures into governance state
  -> verify against policy
  -> emit JSON evidence
  -> emit Markdown release/signoff summary
```

### Policy Questions to Answer

The harness should answer:

- Was this run local, cloud, CI, App Server, or CLI?
- Which Codex version and feature flags were active?
- Which sandbox mode was requested?
- Which sandbox mode was actually observed?
- Was network enabled, disabled, or approved by destination?
- Which files changed?
- Did any path escape the allowed workspace roots?
- Did `.git`, `.codex`, `.agents`, env files, or secrets appear in the change or
  command surface?
- Which approvals were requested?
- Which approvals were accepted, declined, or auto-reviewed?
- Did hooks run?
- Did rules match?
- Did command output or run state suggest sandbox drift?
- Was failure reduced to a stable governance state?
- Is release signoff blocked, warning, or passed?

## VCPToolBox Stable Line Findings

### Source State

Local VCPToolBox production-line inspection used read-only evidence from:

- `A:\VCP\VCPToolBox-prod-stable-clean`
- current branch observed during inspection:
  `codex/prod-stable-upstream-tail-20260429`
- current HEAD observed during inspection:
  `7f87c62 Merge pull request #22 from JENN2046/codex/prod-stable-upstream-safe-sync-20260429`
- tracking target observed during inspection:
  `origin/prod/stable`

The older local worktree `A:\VCP\VCPToolBox-prod-stable` was also observed, but
it was `behind 39` from `origin/prod/stable` and contained untracked runtime
artifacts. It should not be treated as the current implementation reference.

The clean worktree itself was not pristine during inspection: it contained a
staged documentation rename and an unstaged `README.md` change. Those were
treated as user-owned and were not modified.

### Implementation Pattern

VCPToolBox is not a Codex host in the same sense as OpenAI Codex CLI or Codex
Desktop. It is an application runtime with:

- a manifest-driven plugin system
- direct and stdio plugin execution
- tool-call parsing and execution loops
- tool approval requests over the admin/WebSocket surface
- a Codex memory MCP endpoint
- local RAG memory and recall auditing
- AgentAssistant / TaskAssistant automation
- AI Image dry-run planning and explicitly gated execution

The central runtime chain is:

```text
model response
  -> VCP tool parser
  -> ToolExecutor
  -> PluginManager.processToolCall
  -> optional ToolApprovalManager gate
  -> plugin execution or direct service call
  -> normalized tool result
  -> loop back into chat completion
```

Key files:

- `A:\VCP\VCPToolBox-prod-stable-clean\modules\vcpLoop\toolExecutor.js`
- `A:\VCP\VCPToolBox-prod-stable-clean\Plugin.js`
- `A:\VCP\VCPToolBox-prod-stable-clean\modules\chatCompletionHandler.js`
- `A:\VCP\VCPToolBox-prod-stable-clean\modules\handlers\nonStreamHandler.js`
- `A:\VCP\VCPToolBox-prod-stable-clean\modules\handlers\streamHandler.js`

### Tool Approval

`ToolApprovalManager` is a local application approval gate, not a host sandbox.
It supports:

- global enable / disable
- approve-all mode
- tool-level rules
- command-level rules
- `::SilentReject` rules
- config hot reload via watcher
- admin UI editing in `AdminPanel-Vue`

At execution time, `PluginManager.processToolCall` asks the approval manager for
a decision. If approval is required, it stores a pending approval promise,
broadcasts a `tool_approval_request`, and waits for an admin response or
timeout.

Key files:

- `A:\VCP\VCPToolBox-prod-stable-clean\modules\toolApprovalManager.js`
- `A:\VCP\VCPToolBox-prod-stable-clean\Plugin.js`
- `A:\VCP\VCPToolBox-prod-stable-clean\routes\admin\config.js`
- `A:\VCP\VCPToolBox-prod-stable-clean\AdminPanel-Vue\src\views\ToolApprovalManager.vue`

Implication for `codex-router`:

This is useful as a field pattern for approval evidence, but it should not be
copied as the governance core. The missing layer is independent verification:
what approval was requested, who or what accepted it, what command or file
action was allowed, and whether the resulting execution stayed within policy.

### Codex Memory Bridge

VCPToolBox exposes `/mcp/codex-memory` as a JSON-RPC MCP-style endpoint with
three tools:

- `record_memory`
- `search_memory`
- `memory_overview`

`record_memory` calls `PluginManager.processToolCall("CodexMemoryBridge", ...)`
with explicit execution context:

```text
agentAlias: Codex
agentId: codex-desktop
requestSource: codex-desktop-mcp
```

`CodexMemoryBridge` itself is a fail-closed write policy:

- requires `agentAlias=Codex`
- requires title/content/evidence
- accepts `process` and `knowledge` targets
- requires strict `knowledge` writes:
  `validated=true`, `reusable=true`, `sensitivity=none`
- allows `process` writes only if they contain checkpoint/risk/todo/pending or
  stage-conclusion language
- rejects high-risk sensitivity markers such as credential/token/API key terms
- writes audit records to `logs/codex-memory-bridge.jsonl`

Recall uses `modules/codexMemorySearch.js` and RAGDiaryPlugin embedding/search.
Overview uses `modules/codexMemoryOverview.js` and
`modules/codexMemoryAdaptive.js` to summarize writes, recalls, memory links,
and adaptive recall hints.

Key files:

- `A:\VCP\VCPToolBox-prod-stable-clean\routes\codexMemoryMcp.js`
- `A:\VCP\VCPToolBox-prod-stable-clean\Plugin\CodexMemoryBridge\codex-memory-bridge.js`
- `A:\VCP\VCPToolBox-prod-stable-clean\modules\codexMemorySearch.js`
- `A:\VCP\VCPToolBox-prod-stable-clean\modules\codexMemoryOverview.js`
- `A:\VCP\VCPToolBox-prod-stable-clean\modules\codexMemoryAdaptive.js`
- `A:\VCP\VCPToolBox-prod-stable-clean\routes\admin\codexMemory.js`

Important mismatch:

The production-line worktree tracked
`Plugin/CodexMemoryBridge/codex-memory-bridge.js`, but no
`Plugin/CodexMemoryBridge/plugin-manifest.json` was present. Tests inject the
plugin manifest manually, while `docs/CODEX_MEMORY_BRIDGE.md` still lists a
manifest as a related file. Since `PluginManager` discovers legacy plugins by
`plugin-manifest.json`, this should be treated as a wiring risk until runtime
loading is confirmed or a manifest is restored.

Implication for `codex-router`:

This is the strongest VCP lesson. Keep the idea of a write-time policy gate and
audit log, but make it generic:

```text
host event -> explicit execution context -> policy gate -> evidence log
```

The harness should verify that context is present and authoritative rather than
trusting a prompt-level claim that "Codex wrote this."

### AgentAssistant and TaskAssistant

AgentAssistant implements app-level multi-agent communication:

- agent identity/config loading
- context TTL and per-session history
- temporary contact mode
- async delegation with bounded rounds and timeout
- `[[NextHeartbeat::seconds]]`
- `[[TaskComplete]]` and `[[TaskFailed]]`
- task archive and callback reporting
- optional temporary tool-description injection

TaskAssistant schedules and dispatches app tasks to AgentAssistant:

- `globalEnabled` defaults false
- task schedule modes include interval, cron, once, manual
- dispatch defaults to AgentAssistant
- scheduler/manual trigger call AgentAssistant through `/v1/human/tool`

Key files:

- `A:\VCP\VCPToolBox-prod-stable-clean\Plugin\AgentAssistant\AgentAssistant.js`
- `A:\VCP\VCPToolBox-prod-stable-clean\Plugin\VCPTaskAssistant\vcp-task-assistant.js`
- `A:\VCP\VCPToolBox-prod-stable-clean\routes\admin\taskAssistant.js`
- `A:\VCP\VCPToolBox-prod-stable-clean\routes\taskScheduler.js`
- `A:\VCP\VCPToolBox-prod-stable-clean\docs\AGENT_AND_TASK_SYSTEM_GUIDE.md`

Implication for `codex-router`:

This confirms that app-specific scheduling and agent orchestration should remain
outside `codex-router`. The harness may observe and verify such task runs, but
should not become VCP's task center.

### AI Image Pipeline Governance

The current production head contains a more mature AI Image governance layer
than the older local `prod/stable` worktree. The added line includes:

- `modules/pipelineSafetyGate.js`
- `modules/pipelineStateManager.js`
- `modules/pipelineAuditLogger.js`
- `modules/aiImagePipelineExecutor.js`
- `modules/aiImageExecutionAdapter.js`
- `routes/admin/aiImageAgents.js`
- `AdminPanel-Vue/src/views/AiImageAgents.vue`
- `tests/pipelineSafetyGate.test.js`

The safety model is explicit:

- AI Image admin route is disabled unless
  `ENABLE_AI_IMAGE_AGENTS_ROUTE === "true"`
- real execution is disabled unless
  `ENABLE_AI_IMAGE_REAL_EXECUTION === "true"`
- pipeline execution requires `AIGENT_PIPELINE_ALLOW_EXECUTION`
- `/dry-run` forces dry-run
- `/execute` still forces dry-run unless `dryRun=false`, `confirm=true`, and
  `operator` are present
- executor checks the safety decision before execution
- real execution is limited by an allowlist; currently only `DoubaoGen`

The AdminPanel UI also limits real execution to one step and requires explicit
operator confirmation.

Key files:

- `A:\VCP\VCPToolBox-prod-stable-clean\modules\pipelineSafetyGate.js`
- `A:\VCP\VCPToolBox-prod-stable-clean\modules\aiImagePipelineExecutor.js`
- `A:\VCP\VCPToolBox-prod-stable-clean\modules\aiImageExecutionAdapter.js`
- `A:\VCP\VCPToolBox-prod-stable-clean\routes\admin\aiImageAgents.js`
- `A:\VCP\VCPToolBox-prod-stable-clean\AdminPanel-Vue\src\views\AiImageAgents.vue`
- `A:\VCP\VCPToolBox-prod-stable-clean\docs\AI_IMAGE_STAGE6_HANDOFF_20260426.md`

Implication for `codex-router`:

This maps closely to the desired governance harness shape:

```text
state -> safety gate -> audit event -> dry-run result or explicit execution
```

However, VCP is domain-specific. `codex-router` should extract only the generic
governance pattern: structured safety decisions, explicit environment gates,
request-level confirmations, allowlists, and audit events.

### Production Baseline Controls

The stable line now includes production baseline controls:

- `docs/PROD_STABLE_BASELINE.md`
- `docs/PROD_STABLE_DEPLOYMENT_RUNBOOK.md`
- `scripts/check-prod-baseline.js`
- CI runs `npm run test:baseline`, `npm test`, photo-studio tests, and
  DingTalk CLI tests
- Docker build runs with `push: false`
- real config, env files, logs, sqlite/db files, vector stores, plugin state,
  generated images, and runtime auth code are denied in tracked files
- production flags and `dws:*` scripts require explicit human confirmation

Implication for `codex-router`:

This supports the pivot toward release evidence. The reusable concept is not a
VCP-specific CI matrix; it is "baseline policy as executable checks plus a
release runbook that separates safe local validation from live external writes."

### Bottom Line From VCP

VCPToolBox proves that the useful project direction is not "build another Codex
router." VCP already has app-specific routing, agents, tasks, plugins, and
approval UI. OpenAI already has the Codex host, command center, skills, sandbox,
and app server direction.

The durable gap for `codex-router` is the layer both systems still need:

```text
evidence that a host run obeyed its declared governance boundary.
```

VCP contributes concrete implementation lessons:

- explicit execution context must travel with tool calls
- direct memory writes should be blocked unless they use a policy gate
- approval decisions should be auditable, not merely interactive
- dry-run and real execution should be structurally separate
- production flags must be denied by default
- release checks should look for runtime artifacts and secret-bearing files
- app-specific orchestration belongs in the app, not in the governance harness

## Proposed Roadmap

### Phase A: Pivot Documentation

Deliverables:

- strategy note
- module disposition table
- new naming and README wording
- public scope statement

Exit criteria:

- repository no longer describes itself primarily as a router
- overlapping modules are marked frozen or internal

### Phase B: Evidence Schema V1

Deliverables:

- `HostRunEvidence`
- `SandboxEvidence`
- `ApprovalEvidence`
- `CommandEvidence`
- `FileChangeEvidence`
- `PolicyVerificationResult`
- `ReleaseSignoffEvidence`

Exit criteria:

- contract tests for schema stability
- redaction rules for prompts, secrets, env, and full argv

### Phase C: CLI Evidence Adapter

Deliverables:

- parse `codex exec --json`
- capture version, feature flags, sandbox args, approval policy
- preserve current contract smoke vs real host smoke split

Exit criteria:

- contract smoke remains deterministic in CI
- local real-host smoke produces signoff evidence

### Phase D: App Server Evidence Adapter

Deliverables:

- ingest App Server JSON-RPC event stream
- normalize command/file/tool/approval items
- record dynamic tool and MCP approval outcomes

Exit criteria:

- can produce evidence without owning the App Server protocol

### Phase E: Governance Verifier

Deliverables:

- policy verifier for sandbox, approval, path, network, and branch constraints
- release signoff markdown generator
- mismatch diagnostics

Exit criteria:

- failed policy returns named findings
- pass state is evidence-backed, not assumed

## Immediate Recommendation

Create a follow-up PR that:

1. Renames the top-level positioning from `Desktop-first policy SDK for Codex
   routing` to `local-first governance and evidence harness for Codex host
   execution`.
2. Adds a module disposition table:
   - preserve
   - reframe
   - freeze
   - transitional
3. Marks router / multi-agent / worktree / delegation areas as non-expansion
   zones.
4. Promotes the real-host smoke and evidence path as the core product proof.

## Non-Goals

The project should not attempt to become:

- a Codex App replacement
- a worktree manager
- a general multi-agent orchestrator
- a scheduler
- a plugin marketplace
- an enterprise MDM / RBAC control plane
- a new App Server protocol
- a parallel sandbox implementation

## One-Line Direction

```text
Do not route Codex.
Prove Codex stayed inside the route it claimed to follow.
```
