# Agent OS Kernel Phase 1 Completion Report

Date: 2026-06-04
Branch: `codex/agent-os-kernel-phase-0-1`
Baseline before this report: `69f723a`

## Summary

Phase 1 turns the Phase 0 kernel contract schemas into a local governance entry layer:

```text
Task
  -> AdmissionDecision
  -> Capability check
  -> ApprovalPermit validation
  -> ExecutionEligibilityDecision
```

This phase remains local and deterministic. It does not start a scheduler, call MCP/A2A services, execute tools, persist permits to external storage, or change Codex CLI host runtime behavior.

## New Packages

- `packages/admission-control/src/index.ts`
  - First gate for a kernel `Task`.
  - Produces an `AdmissionDecision`.
- `packages/capability/src/index.ts`
  - String capability scope parser and matcher.
  - Supports exact match, `/**` path wildcard, deny priority, grant expiry/revocation, and principal/task/run context checks.
- `packages/approval-permit/src/index.ts`
  - Creates and validates durable `ApprovalPermit` objects bound to task, run, principal, policy hash, plan hash, and capability scopes.
  - Uses local SHA-256 hashing only. Signature is reserved but not implemented.
- `packages/execution-eligibility/src/index.ts`
  - Lightweight final eligibility layer that composes admission, capability, and approval permit checks.
  - Produces an `ExecutionEligibilityDecision`.

Each package has a clear entry point at `src/index.ts`. There is no root-level global export requirement in this phase.

## Public APIs

### `packages/kernel-contracts`

Phase 1 public contracts include:

- `PrincipalSchema` / `Principal`
- `AgentManifestSchema` / `AgentManifest`
- `TaskSchema` / `Task`
- `RunSchema` / `Run`
- `StepSchema` / `Step`
- `PolicyDecisionSchema` / `PolicyDecision`
- `CapabilityScopeSchema` / `CapabilityScope`
- `CapabilityGrantSchema` / `CapabilityGrant`
- `ApprovalPermitSchema` / `ApprovalPermit`
- `ToolManifestSchema` / `ToolManifest`
- `ToolInvocationSchema` / `ToolInvocation`
- `ArtifactSchema` / `Artifact`
- `EventSchema` / `Event`
- `SandboxProfileSchema` / `SandboxProfile`
- `ExecutionLeaseSchema` / `ExecutionLease`
- Legacy compatibility:
  - `legacyTaskEnvelopeToKernelTask`
  - `legacyRoutingDecisionToPolicyDecision`
  - `legacyTaskAndRoutingToRunSeed`
  - `createLegacyCompatibilityEvent`
  - backward-compatible wrappers `createTaskFromLegacyTaskEnvelope` and `createPolicyDecisionFromLegacyRoutingDecision`

`ApprovalPermitSchema` was extended compatibly with optional binding fields:

- `principalId`
- `approverId`
- `policyDecisionHash`
- `capabilityScopes`
- `createdAt`
- `revokedReason`
- `signature`

Existing legacy fields remain available.

### `packages/admission-control`

- `AdmissionStatus`
- `AdmissionDecision`
- `EvaluateTaskAdmissionInput`
- `evaluateTaskAdmission(input)`

Core outcomes:

- `accepted`
- `rejected`
- `needs_clarification`
- `needs_approval`

### `packages/capability`

- `ParsedCapabilityScope`
- `CapabilityGrantLike`
- `CapabilityCheckOptions`
- `CapabilityCheckResult`
- `parseCapabilityScope(scope)`
- `capabilityImplies(grantScope, requestedScope)`
- `hasCapabilityGrant(grants, requestedScope, options)`
- `explainCapabilityDecision(grants, requestedScope, options)`

Supported scope examples:

- `fs.read:/repo/**`
- `fs.write:/repo/docs/**`
- `shell.exec:pytest`
- `network.egress:api.github.com`
- `mcp.call:github.create_pull_request`
- `memory.read:project`
- `memory.write:project`
- `secret.read:deny`

`fs.write` does not imply `fs.read`.

### `packages/approval-permit`

- `CreateApprovalPermitInput`
- `ApprovalPermitValidationContext`
- `ApprovalPermitValidationResult`
- `createApprovalPermit(input)`
- `hashApprovalScope(input)`
- `validateApprovalPermit(permit, context)`
- `revokeApprovalPermit(permit, revokedAt, reason)`

Validation binds approval to:

- `taskId`
- `runId`
- `principalId`
- `policyDecisionHash`
- `planHash`
- requested capability scopes
- expiry and revocation state

### `packages/execution-eligibility`

- `ExecutionEligibilityStatus`
- `ExecutionEligibilityDecision`
- `EvaluateExecutionEligibilityInput`
- `evaluateExecutionEligibility(input)`

Core outcomes:

- `eligible`
- `blocked`
- `waiting_approval`

## Flow

```text
Kernel Task + Principal + optional Agent + PolicyDecision
        |
        v
Admission Control
  - rejects missing principal / missing intent / blocked policy
  - marks destructive, production, secret, external-side-effect work as approval-needed
        |
        v
Capability Matcher
  - evaluates requested scopes against capability grants
  - deny scopes override allows
  - expired/revoked/wrong principal/wrong task/wrong run grants are ignored
        |
        v
Approval Permit
  - validates taskId, runId, principalId
  - validates policyDecisionHash and planHash
  - validates expiry/revocation
  - validates requested capability scopes are covered
        |
        v
Execution Eligibility
  - blocked: admission rejected, policy blocked, or explicit capability deny
  - waiting_approval: missing capability or approval required without a valid permit
  - eligible: read-only capability path or valid approval permit path
```

## Complete Flow Evidence

`tests/execution-eligibility.test.ts` includes a complete Phase 1 flow test:

```text
execution eligibility covers a complete Phase 1 kernel flow
```

The test constructs or references:

- `Task`
- `Principal`
- `PolicyDecision`
- `CapabilityGrant`
- `ApprovalPermit`
- `ExecutionEligibilityDecision`

It verifies that a permitted write scope produces `status: "eligible"` and records the accepted permit id.

## Validation

Commands run for this completion task:

```text
npx tsx --test tests/execution-eligibility.test.ts
npm run typecheck --if-present
npm test --if-present
```

Observed results:

```text
npx tsx --test tests/execution-eligibility.test.ts
pass: 9/9

npm run typecheck --if-present
pass: tsc -p tsconfig.json --noEmit

npm test --if-present
pass: 444/444
```

An intermediate `npm run typecheck --if-present` attempt while adding the complete flow test failed because optional `CapabilityGrant` fields were passed into a strict capability grant context. The fixture defines those fields, and the test now narrows them before passing them into `evaluateExecutionEligibility`.

## Known Limits

- No scheduler is implemented.
- No MCP or A2A network integration is implemented.
- No Rust runtime work is included.
- No real tool execution is performed by Phase 1 packages.
- Approval permit signatures are reserved but not implemented.
- Approval permits are not persisted to an external database.
- Capability scopes use a minimal controlled matcher, not a full glob engine.
- `/**` wildcard support is intentionally narrow and path-prefix based.
- Capability grants are accepted as local in-memory inputs for now.
- Execution eligibility does not mutate run state; it only returns a decision object.
- Kernel contracts now include compatibility metadata fields, but old contracts remain present.

## Phase 2 Suggestions

- Introduce a scheduler-facing `Run` lifecycle reducer that consumes `ExecutionEligibilityDecision`.
- Add a durable local permit/grant store interface with in-memory and file-backed test adapters.
- Define first-class string capability scopes in `kernel-contracts` instead of keeping string scopes only in the capability package.
- Add signed approval permits or a signing abstraction, still keeping tests deterministic.
- Add policy packs for common task classes: read-only, local write, release, network, secrets.
- Add an audit event bridge that emits `Event` records for admission, capability, approval, and eligibility decisions.
- Add examples under `examples/` once the public API stabilizes enough for external consumers.
- Consider package-level `package.json` exports only after the monorepo publish shape is decided.
