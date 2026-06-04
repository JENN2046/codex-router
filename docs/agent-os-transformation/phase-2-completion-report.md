# Agent OS Kernel Phase 2 Completion Report

Date: 2026-06-04
Branch: `codex/agent-os-kernel-phase-0-1`

## Summary

Phase 2 adds the first local runtime MVP around the Phase 1 governance gate:

```text
Task
  -> Run
  -> Step
  -> EventLog
  -> Scheduler Lease
  -> ToolInvocationPlan
  -> Artifact
  -> Completion / Failure
```

This phase is intentionally local and deterministic. It does not implement distributed scheduling, multi-process locking, Rust daemons, real MCP/A2A networking, real HTTP calls, real shell execution, or real tool execution.

## New Packages

- `packages/kernel-store/src/index.ts`
  - `KernelStore` interface.
  - `InMemoryKernelStore` for `Run`, `Step`, `Event`, and kernel-contract `Artifact` records.
- `packages/kernel-store/src/jsonl-event-log.ts`
  - Append-only local JSONL event log.
  - Structured read errors and event payload redaction helper.
- `packages/run-manager/src/index.ts`
  - `RunManager` for `Run` and `Step` lifecycle transitions.
  - Appends kernel `Event` records on state changes.
- `packages/scheduler/src/index.ts`
  - `Scheduler` interface.
  - `InMemoryScheduler` queue and lease implementation.
- `packages/artifact-store/src/index.ts`
  - `ArtifactStore` interface.
  - `InMemoryArtifactStore` and `FileSystemArtifactStore`.
  - SHA-256 hashing and verification.
- `packages/tool-registry/src/index.ts`
  - Local registry for protocolized tool manifests.
  - No tool execution.
- `packages/tool-invocation-planner/src/index.ts`
  - Governed `ToolInvocationPlan` generation.
  - Combines tool manifest capabilities, grants, approval permits, policy decision hash, input hashing, redaction, and sandbox inference.

## Run / Step State Machines

Run lifecycle:

```text
queued
  -> running
running
  -> succeeded
  -> failed
queued | running
  -> cancelled

succeeded | failed | cancelled
  -> terminal
```

Step lifecycle:

```text
pending
  -> running
running
  -> succeeded
  -> failed
pending | running
  -> cancelled

succeeded | failed | cancelled | skipped
  -> terminal
```

`RunManager` rejects invalid transitions and terminal-state mutation. It does not execute tools or mutate external systems.

## Scheduler Queue And Lease

`InMemoryScheduler` provides a predictable local queue:

- `enqueueRun(runId, options)` adds a run to a local in-memory queue.
- `acquireLease(workerId, options)` returns one active lease for the next queued run.
- `renewLease(leaseId)` extends an active lease.
- `releaseLease(leaseId, result)` marks the lease released and queue item completed.
- `failLease(leaseId, error)` marks the lease failed and requeues only when attempts remain.
- `listQueue()` and `listLeases()` return snapshots.

Lease fields include:

- `leaseId`
- `runId`
- `workerId`
- `acquiredAt`
- `expiresAt`
- optional `heartbeatAt`
- optional `releasedAt`
- `status: active | released | expired | failed`
- `attempt`

Boundaries:

- Same run cannot have multiple active leases.
- Expired leases can be reacquired.
- Attempts increment deterministically.
- `maxAttempts` prevents further dispatch.
- There is no multi-process lock, daemon, distributed queue, or real async worker in Phase 2.

## EventLog JSONL Format

`JsonlEventLog` writes one kernel `Event` JSON object per line:

```json
{"schemaVersion":"kernel-event.v1","eventId":"event_001","eventType":"kernel.run.created","taskId":"task_001","runId":"run_001","createdAt":"2026-06-04T00:00:00.000Z","payload":{}}
```

Rules:

- Each appended event is serialized as one JSONL line.
- `undefined` fields are omitted.
- File missing on read returns an empty list.
- Invalid JSON or invalid event shape returns structured `JsonlEventLogReadError` details.
- `readByRunId` and `readByTaskId` filter local records.
- `verifyOrder()` checks append order by `createdAt`.
- `redactEventSecrets()` redacts secret-like payload keys before writing.

This is a local audit artifact only. It is not a tamper-proof ledger, remote log sink, or distributed event stream.

## ArtifactStore Directory Structure

`FileSystemArtifactStore` writes under a caller-provided `baseDir`. Tests use temporary directories only.

Each artifact is stored in an independent directory:

```text
<baseDir>/
  artifact_agent_kernel_phase_2_e2e_001/
    metadata.json
    payload
```

`metadata.json` includes:

- `artifactId`
- `taskId`
- optional `runId`
- `type: text | json | patch | file | report`
- `uri`
- `sha256`
- `sizeBytes`
- `createdAt`
- optional `contentType`
- optional `fileName`
- redacted `metadata`
- redacted `provenance`
- `alreadyRedacted`

Safety behavior:

- Artifact ids are restricted to safe path segments.
- Path traversal is rejected.
- Payload SHA-256 is computed on write.
- Duplicate same-hash writes are accepted.
- Duplicate different-hash writes are rejected unless `allowOverwrite` is explicit.
- Metadata and provenance redact secret-like keys.
- Payload is not automatically redacted; callers must pass already-redacted content or set `alreadyRedacted` truthfully.

## ToolRegistry And ToolInvocationPlan

`ToolRegistry` protocolizes tool descriptions without executing them.

Manifest fields include:

- `toolId`
- `provider: builtin | local | mcp | remote`
- `inputSchema`
- `outputSchema`
- `sideEffectClass`
- `requiredCapabilities`
- `defaultTimeoutMs`
- `auditPolicy`
- `redactionPolicy`
- optional `serverRef`
- optional `endpointRef`
- `metadata`

Registration rules:

- Duplicate `toolId` is rejected.
- Invalid manifests are rejected.
- Dangerous side effects require `requiredCapabilities`.
- `mcp` provider requires `serverRef` or `metadata.mcp`.
- `remote` provider requires `endpointRef` or `metadata.remote`.

Fixtures:

- `builtin.read_file`
- `builtin.apply_patch`
- `mcp.github.create_pull_request`
- `remote.agent.invoke`

`ToolInvocationPlan` creates an auditable pre-execution plan:

- `invocationId`
- `runId`
- `stepId`
- `toolId`
- `provider`
- `inputHash`
- redacted `inputPreview`
- `requiredCapabilities`
- `sideEffectClass`
- derived `sandboxProfile`
- `approvalRequired`
- `status: planned | blocked | waiting_approval`
- `reasons`

It hashes the proposed input and stores only a redacted preview. It does not invoke tools, call MCP, call HTTP, run shell commands, or read real files.

## Phase 2 E2E Flow

`tests/agent-kernel-phase-2.e2e.test.ts` demonstrates the minimal local loop:

```text
Principal
  -> Task
  -> PolicyDecision
  -> CapabilityGrant
  -> Admission accepted
  -> ExecutionEligibility eligible
  -> RunManager createRun
  -> Scheduler enqueue
  -> Scheduler acquireLease
  -> RunManager startRun
  -> RunManager createStep
  -> ToolRegistry register builtin.read_file
  -> ToolInvocationPlan planned
  -> RunManager startStep
  -> RunManager completeStep
  -> ArtifactStore write report artifact
  -> RunManager completeRun
  -> Scheduler releaseLease
  -> verify event order
  -> verify artifact hash
```

E2E boundaries:

- No real network access.
- No real shell execution.
- No real tool execution.
- No real README read.
- File writes are limited to a test temporary artifact directory.
- All ids are fixed.
- All time comes from a fake clock.

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
pass: 501/501
```

## Known Limits

- No distributed scheduler exists.
- No daemon or Rust runtime exists.
- No SQLite or database-backed store exists.
- No multi-process lease locking exists.
- No real MCP integration is executed.
- No A2A network integration is executed.
- No real HTTP request is performed.
- No shell command is executed by Phase 2 runtime packages.
- `ToolRegistry` registers descriptions only; it is not an executor.
- `ToolInvocationPlan` plans and gates; it does not execute.
- JSONL event logs are append-only by convention, not tamper-proof.
- Artifact payload redaction is caller-controlled.
- Artifact storage is local filesystem or memory only.
- Scheduler completion is coordinated by the caller; releasing a lease does not automatically complete a `Run`.
- E2E validates the local control loop, not production readiness.

## Phase 3 Migration Suggestions

- Add a durable store adapter, likely SQLite first, while preserving the `KernelStore` interface.
- Add a real append-only event log integrity chain using event hashes and previous hashes.
- Introduce an explicit tool executor boundary that accepts `ToolInvocationPlan` and remains dependency-injected.
- Add dry-run executor adapters for builtin tools before enabling any real side effects.
- Add MCP/A2A adapter interfaces with local fake implementations before real network clients.
- Add persisted scheduler state and process-safe lease acquisition if multi-process workers become a goal.
- Add artifact retention and cleanup policies.
- Add a unified `Run -> Step -> ToolInvocationPlan -> Artifact` audit view.
- Add policy packs that map task classes to required capability scopes.
- Consider package-level `package.json` exports once the monorepo publishing model is decided.
