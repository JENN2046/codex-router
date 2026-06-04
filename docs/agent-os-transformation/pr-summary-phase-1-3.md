# PR Summary: Agent OS Kernel Phases 1-3

## What Changed

This PR builds the Agent OS Kernel foundation across three local, deterministic phases:

- Phase 1: governance entry layer
  - Kernel contracts for principal, task, run, step, policy decision, capability grant, approval permit, event, artifact, and sandbox profile.
  - Admission control.
  - Capability scope parsing and matching.
  - Approval permit creation and validation.
  - Execution eligibility decisions.

- Phase 2: local runtime MVP
  - In-memory kernel store.
  - JSONL event log.
  - Run and step lifecycle manager.
  - In-memory scheduler and lease model.
  - In-memory and filesystem artifact stores.
  - Tool registry.
  - Tool invocation planner.
  - Local E2E proving task to run/step/tool-plan/artifact flow without executing tools.

- Phase 3: provider and protocol abstraction
  - Provider core contracts and provider manifests.
  - Codex CLI executor provider facade with execution disabled by default.
  - MCP bridge skeleton and tool manifest mapping.
  - Agent OS MCP server manifest with eight declared tools and no runtime.
  - A2A skeleton for agent cards, tasks, artifacts, and disabled remote-agent provider.
  - Provider registry.
  - Execution planner v2.
  - Rust sidecar boundary ADR.
  - E2E proving task to provider execution plan with `codex-cli` selected as a provider and no provider execution invoked.

## Why

The goal is to move `codex-router` from routing-policy pieces toward a reusable Agent OS Kernel control layer:

- named governance contracts
- explicit admission and eligibility gates
- auditable run, step, event, and artifact records
- provider abstraction instead of hard-coding Codex CLI as the kernel center
- protocol skeletons for MCP and A2A without prematurely enabling network side effects
- a clear future Rust sidecar boundary without starting a rewrite

This keeps the project focused on safety, reviewability, and reversible local progress before real execution paths are enabled.

## Safety Boundaries

- No real Codex CLI execution is enabled by default.
- No shell execution is introduced by the Phase 3 provider-planning E2E.
- No real MCP server is started.
- No MCP stdio command is executed; MCP command refs are opaque references.
- No MCP HTTP/SSE endpoint is called; endpoint refs are opaque references.
- No real A2A network service is started.
- No remote A2A task is submitted.
- No Rust daemon or sidecar runtime is implemented.
- No deployment, release, remote write, or production action is included.
- Provider planning is separated from provider execution.
- Codex CLI is represented as an executor provider, not as the Agent OS Kernel center.

## Tests Run

```text
npm run typecheck --if-present
```

Result:

```text
pass: tsc -p tsconfig.json --noEmit
```

```text
npm test --if-present
```

Result:

```text
pass: 552/552
```

No validation failures were observed while preparing the Phase 3 report and this PR summary.

## Known Limitations

- No real MCP server exists.
- No real A2A network exists.
- No real Rust daemon exists.
- No real Codex CLI execution exists in the provider facade by default.
- Scheduler remains a local MVP.
- Provider registry is in-memory.
- Execution planner v2 creates provider execution plans but does not execute providers.
- Agent OS MCP server manifest declares tools but no handlers.
- A2A remote-agent provider is disabled by default.
- Approval permit signatures are reserved but not implemented.
- Capability matching is intentionally minimal and not a full policy language.
- JSONL event logs are local audit artifacts, not tamper-proof ledgers.
- Phase 1-3 validate local control-plane behavior, not production readiness.

## Next Phases

- Add a provider execution runner that consumes `ProviderExecutionPlan` with dry-run first semantics.
- Add fake MCP server integration tests before enabling a real MCP runtime.
- Add fake A2A transport tests before enabling real network communication.
- Add durable provider/kernel storage if restart persistence becomes required.
- Add process-safe scheduler leases before multi-worker execution.
- Add a sidecar spike only when a concrete enforcement need exists, such as real shell execution, network egress, secret access, or non-bypassable local policy.
- Add an operator-facing audit view across `Run`, `Step`, `ProviderExecutionPlan`, `Event`, and `Artifact`.
- Keep real Codex CLI execution behind explicit approval, clear audit records, and disabled-by-default provider configuration.
