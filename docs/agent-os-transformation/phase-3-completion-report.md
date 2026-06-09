# Agent OS Kernel Phase 3 Completion Report

Date: 2026-06-04
Branch: `codex/agent-os-kernel-phase-0-1`

## Summary

Phase 3 adds the provider and protocol abstraction layer around the Phase 1/2 local kernel:

```text
Task
  -> AdmissionDecision
  -> ExecutionEligibilityDecision
  -> RunManager createRun
  -> ProviderRegistry
  -> ProviderExecutionPlan
  -> Event
  -> Report Artifact
```

The purpose of this phase is to prove that the Agent OS Kernel can route toward a provider execution plan while remaining provider-agnostic. Codex CLI is modeled as one executor provider, not as the kernel center.

This phase remains local and deterministic. It does not start a real MCP server, call A2A over a network, start a Rust daemon, execute the real Codex CLI, run shell commands through the provider path, or perform remote side effects.

## New Packages And Documents

- `packages/provider-core/src/index.ts`
  - Shared provider contracts, manifests, execution plan schemas, side-effect classes, and sandbox support helpers.
- `packages/providers/codex-cli/src/index.ts`
  - Codex CLI executor provider facade.
  - Execution is disabled by default.
- `packages/protocol-mcp/src/index.ts`
  - MCP server/tool reference schemas, MCP tool manifest mapping, and disabled MCP tool provider skeleton.
- `packages/protocol-mcp/src/agent-os-server-manifest.ts`
  - Manifest-only Agent OS MCP server declaration.
- `packages/protocol-a2a/src/index.ts`
  - A2A agent card/task/artifact mapping skeleton and disabled remote agent provider.
- `packages/provider-registry/src/index.ts`
  - Local provider registry with manifest validation and provider selection filters.
- `packages/execution-planner/src/index.ts`
  - Provider execution planner v2.
- `docs/adr/0001-rust-sidecar-boundary.md`
  - Proposed boundary for a future Rust enforcement sidecar.
- `tests/agent-kernel-phase-3-provider.e2e.test.ts`
  - Phase 3 provider planning E2E proof.

## 1. Provider-Core Design

`provider-core` defines the shared vocabulary for provider integration:

- Provider kinds:
  - `model`
  - `executor`
  - `tool`
  - `remote_agent`
- Side-effect classes:
  - `none`
  - `read`
  - `read_only`
  - `local_write`
  - `workspace_write`
  - `local_command`
  - `external_write`
  - `external_side_effects`
  - `protected_remote`
  - `destructive`
  - `secret_access`
  - `unknown`
- Provider manifest fields:
  - `providerId`
  - `kind`
  - `displayName`
  - `version`
  - `capabilities`
  - `requiredConfig`
  - `securityBoundary`
  - `supportedSandboxProfiles`
  - `supportedSideEffectClasses`
  - `enabled`
  - `metadata`

Provider interfaces include:

- `ExecutorProvider`
  - `planExecution`
  - `validateExecutionPlan`
  - `execute`
- `ToolProvider`
  - `listTools`
  - `getTool`
  - `planInvocation`
  - `invoke`
- `RemoteAgentProvider`
  - `getAgentCard`
  - `createRemoteTask`
  - `getRemoteTask`
  - `cancelRemoteTask`
  - `streamRemoteTaskEvents`
- `ModelProvider`
  - `listModels`
  - `selectModel`
  - `probeModel`

Plan schemas added in this layer:

- `ExecutorExecutionPlanSchema`
- `ToolProviderInvocationPlanSchema`

Support helpers check whether a provider supports a requested side-effect class or sandbox profile. These helpers are used by the registry and planner, but they do not execute providers.

## 2. Codex CLI Provider Facade

`CodexCliExecutorProvider` wraps the existing Codex CLI host planning surface as a provider facade.

Implemented behavior:

- Exposes provider id `codex-cli`.
- Exposes kind `executor`.
- Defines security boundary metadata for process isolation, restricted network posture, workspace-write capability, and brokered secret access.
- Supports read-only and workspace-write sandbox profiles.
- Supports these side-effect classes:
  - `read_only`
  - `workspace_write`
  - `local_command`
- Converts kernel `Task`, `Run`, `PolicyDecision`, and sandbox input into an `ExecutorExecutionPlan`.
- Stores sanitized Codex CLI plan metadata with prompt omitted.
- Rejects direct provider input overrides for model, sandbox, or CLI args.
- Validates the generated provider plan against provider metadata and host plan alignment.
- Throws `codex_cli_provider_execute_disabled` when `execute` is called with default options.

Boundary:

- No real Codex CLI process is spawned by default.
- No shell command is invoked by the provider facade tests.
- The provider facade can plan and validate; actual execution remains intentionally disabled unless a future explicit runtime path is introduced.
- Codex CLI is one provider plugged into the kernel, not the kernel's source of authority.

## 3. MCP Bridge Skeleton

`protocol-mcp` adds a bridge skeleton for mapping MCP tool descriptions into local Agent OS tool/provider contracts.

Implemented behavior:

- `McpServerRefSchema` describes MCP server references.
- Stdio references use opaque `commandRef` values such as `mcp-command:local-dev`; raw shell commands are rejected.
- HTTP/SSE references use opaque `endpointRef` values such as `mcp-endpoint:local-dev`; raw URLs are not embedded.
- `mcpToolToToolManifest` maps an MCP tool descriptor into a `ToolRegistry` manifest.
- `toolManifestToMcpToolDescriptor` maps a registered tool manifest back to an MCP-style descriptor.
- Missing MCP side-effect annotations default to `unknown`, which requires approval.
- `createMcpToolProviderSkeleton` creates a `ToolProvider` with:
  - an allowlist gate
  - a provider manifest
  - planning support for allowlisted tools
  - disabled invocation

Boundary:

- No live MCP server is started.
- Stdio `commandRef` is never executed.
- HTTP/SSE `endpointRef` is never called.
- `invoke` throws `mcp_tool_provider_invoke_disabled`.

## 4. Agent OS MCP Server Manifest

`agent-os-server-manifest.ts` declares an Agent OS MCP server manifest without implementing a runtime.

The manifest has:

- `serverId: "agent-os"`
- `runtimeImplemented: false`
- exactly eight declared tools:
  - `agentos.create_task`
  - `agentos.get_run`
  - `agentos.list_runs`
  - `agentos.cancel_run`
  - `agentos.approve_run`
  - `agentos.list_artifacts`
  - `agentos.get_artifact`
  - `agentos.search_events`

Safety rules:

- Tool id must match tool name.
- Required capabilities are validated per tool.
- Read/list/search tools must use `sideEffectClass: "read"`.
- Mutating tools must not be read-only.
- Mutating tools require either `approvalRequired: true` or `metadata.policyGated`.
- Tool ids are unique and stable.

Boundary:

- This is a manifest-only declaration.
- No MCP server runtime or handlers exist in Phase 3.
- `agentos.create_task`, `agentos.cancel_run`, and `agentos.approve_run` are declared as policy-gated future tools, not live callable behavior.

## 5. A2A Skeleton

`protocol-a2a` adds a skeleton for mapping kernel objects to A2A-shaped objects and for representing disabled remote-agent providers.

Implemented behavior:

- `agentManifestToA2AAgentCard` maps an `AgentManifest` into an A2A agent card skeleton.
- `taskToA2ATaskSkeleton` maps a kernel `Task` and `Run` into an A2A task skeleton.
- `artifactToA2AArtifactSkeleton` maps kernel artifacts into A2A artifact skeletons.
- `runStatusToA2AStatus` and `a2aStatusToRunStatus` map local status names.
- A2A endpoints are metadata references, not raw URLs.
- Anonymous remote invocation is rejected.
- `createA2ARemoteAgentProviderSkeleton` creates a disabled `RemoteAgentProvider`.

Boundary:

- No A2A network service is started.
- No remote task is submitted.
- No streaming network connection is opened.
- The generated remote-agent provider is disabled by default.
- `createRemoteTask`, `cancelRemoteTask`, and `streamRemoteTaskEvents` throw `a2a_remote_agent_provider_disabled`.

## 6. Provider Registry

`ProviderRegistry` provides the local selection surface for providers.

Implemented behavior:

- Registers providers with manifest validation.
- Rejects duplicate provider ids.
- Requires a security boundary in every manifest.
- Verifies that provider implementation shape matches manifest `kind`.
- Rejects manifest/provider id mismatches and kind mismatches.
- Requires remote-agent provider auth schemes.
- Rejects anonymous remote-agent auth schemes.
- Excludes disabled providers from normal listing and automatic selection.
- Supports lookup and filters by:
  - provider id
  - kind
  - enabled/disabled state
  - side-effect class
  - sandbox profile

Boundary:

- Registry is local and in-memory.
- Registry does not execute providers.
- Registry selection is metadata-based and does not probe remote availability.

## 7. Execution Planner V2

`planProviderExecution` produces a `ProviderExecutionPlan` from kernel state and registry state.

Inputs:

- `Task`
- `Run`
- `Principal`
- `PolicyDecision`
- `ExecutionEligibilityDecision`
- `ProviderRegistry`
- optional preferred provider id
- fixed `now`

Outputs include:

- `schemaVersion: "provider-execution-plan.v2"`
- `planId`
- `taskId`
- `runId`
- `providerId`
- `providerKind`
- `status`
- `inputHash`
- `policyDecisionHash`
- `requiredCapabilities`
- `requiredApprovals`
- `sandboxProfile`
- `sideEffectClass`
- `reasons`
- `createdAt`

Planner statuses:

- `planned`
- `blocked`
- `waiting_approval`

Planner behavior:

- Parses kernel objects before planning.
- Derives side-effect class from policy capabilities and sandbox profile.
- Resolves a preferred provider or finds a provider matching side-effect and sandbox requirements.
- Blocks missing, disabled, unsupported-side-effect, and unsupported-sandbox providers.
- Blocks task/run/policy/eligibility mismatch.
- Carries through blocked and waiting-approval eligibility states.
- Uses stable hashes for input and policy decision evidence.

Boundary:

- The planner does not invoke provider `planExecution`.
- The planner does not invoke provider `execute`.
- The planner does not call Codex CLI, MCP, A2A, shell, or network.
- It produces an auditable selection/eligibility plan only.

## 8. Rust Sidecar ADR Summary

`docs/adr/0001-rust-sidecar-boundary.md` defines Rust as a future local enforcement boundary, not a Phase 3 implementation.

Decision:

- TypeScript remains the system of record for contracts, policy, MCP/A2A adapters, provider integration, and SDK-friendly APIs.
- Rust may be introduced later for enforcement properties that are harder to guarantee in TypeScript alone.

Possible future Rust responsibilities:

- process sandbox
- filesystem boundary
- network egress policy
- secret broker
- append-only event log hardening
- artifact hashing/signing
- resource quota
- local daemon

Explicit Phase 3 boundary:

- No Rust crate was added.
- No build-system change was made.
- No live sidecar daemon exists.
- Transport choice is intentionally deferred.

The ADR says to revisit Rust when real shell execution, network egress, secret access, multiple workers, or non-bypassable local enforcement becomes active.

## 9. Phase 3 E2E Test Result

`tests/agent-kernel-phase-3-provider.e2e.test.ts` proves the provider-planning flow:

```text
Principal
  -> AgentManifest
  -> Task
  -> PolicyDecision
  -> CapabilityGrant
  -> Admission accepted
  -> ApprovalPermit optional
  -> ExecutionEligibility eligible
  -> RunManager createRun
  -> ProviderRegistry register CodexCliExecutorProvider
  -> planProviderExecution
  -> ProviderExecutionPlan status planned
  -> providerId codex-cli
  -> provider execution disabled / not invoked
  -> append Event
  -> write report Artifact
```

The test asserts:

- `ProviderExecutionPlan.status === "planned"`
- `providerId === "codex-cli"`
- `providerKind === "executor"`
- side effect class is `read_only`
- sandbox network access is `none`
- writable roots are empty
- `CodexCliExecutorProvider` metadata says execution is disabled by default
- provider `planExecution` is not invoked by `planProviderExecution`
- provider `execute` is not invoked
- a kernel event is appended for provider planning
- an in-memory report artifact is written and hash-verified

E2E boundaries:

- No real Codex CLI execution.
- No shell execution.
- No network access.
- No MCP server.
- No A2A network.
- All ids are fixed.
- Time comes from a fake clock.
- Artifact storage is in-memory for this test.

## Validation

Commands run for this completion report:

```text
npm run typecheck --if-present
npm test --if-present
```

Observed results:

```text
npm run typecheck --if-present
pass: tsc -p tsconfig.json --noEmit

npm test --if-present
pass: 552/552
```

No validation failures were observed while preparing this report.

## 10. Known Limits

- No real MCP server exists.
- No real A2A network exists.
- No real Rust daemon exists.
- No real Codex CLI execution exists in the provider facade by default.
- Scheduler remains a local MVP.
- Provider registry is in-memory and does not persist provider state.
- Execution planner v2 produces a plan but does not execute provider runtime hooks.
- MCP bridge uses opaque refs and manifest mapping only.
- Agent OS MCP manifest declares tools but no handlers.
- A2A provider skeleton is disabled by default.
- Rust sidecar transport and lifecycle are not selected.
- No production readiness claim is made by Phase 3.

## Phase 4 Suggestions

- Add a real provider execution runner that consumes `ProviderExecutionPlan` but preserves dry-run first behavior.
- Add a durable provider registry/store if provider configuration needs to survive process restart.
- Add fake MCP server tests before any real MCP runtime.
- Add fake A2A transport tests before any real network client.
- Add a sidecar spike only when a concrete enforcement use case is ready.
- Add persisted scheduler state and process-safe lease acquisition before multi-worker execution.
- Define an operator-facing audit view for `Run -> ProviderExecutionPlan -> Event -> Artifact`.
- Keep Codex CLI execution behind explicit approval and disabled-by-default provider settings.
