# Agent OS Kernel Phase 1 Baseline

Date: 2026-06-04
Workspace: `A:\codex-router`
Branch: `codex/agent-os-kernel-phase-0-1`
Commit: `7748de4`

## Runtime Versions

| Tool | Version |
|---|---|
| Node.js | `v22.22.0` |
| npm | `10.9.4` |

## Required Command Results

| Command | Status | Output summary |
|---|---|---|
| `npm ci` | passed | Installed `10` packages from the existing lockfile in about `1s`; npm reported `4 packages are looking for funding`. |
| `npm run typecheck --if-present` | passed | Ran `tsc -p tsconfig.json --noEmit`; completed with exit code `0`. |
| `npm test --if-present` | passed | Ran `tsx --test tests/*.test.ts`; TAP summary reported `399` tests, `399` pass, `0` fail, `0` cancelled, `0` skipped, `0` todo. |

No failing required command was observed during this baseline pass.

## Current Packages

- `approval-gate`
- `audit-memory`
- `checkpoint-index`
- `checkpoint-ledger-v2`
- `codex-cli-host`
- `codex-desktop-bindings`
- `codex-desktop-live-host`
- `codex-memory-adapter`
- `codex-memory-host-client`
- `codex-memory-mcp-client`
- `contracts`
- `delegation-policy`
- `desktop-agent-strategy`
- `desktop-bridge`
- `desktop-decision-runner`
- `desktop-host-client`
- `desktop-live-adapter`
- `entropy-risk`
- `execution-observation`
- `execution-profiles`
- `final-host-locator`
- `governance-failure-reducer`
- `host-client-example`
- `host-dispatcher`
- `intent-gate`
- `kernel-contracts`
- `observability`
- `policy-config`
- `preflight`
- `recon-policy`
- `recovery-control`
- `routing-engine`
- `runtime-control`
- `state-manager`
- `strategy-router`
- `task-graph`
- `validation-arbiter`

## `kernel-contracts` Public Exports

Collected with:

```powershell
npx tsx -e "import('./packages/kernel-contracts/src/index.ts').then((mod) => console.log(Object.keys(mod).sort().join('\n')));"
```

Exports:

- `AgentManifestSchema`
- `ApprovalPermitSchema`
- `ArtifactSchema`
- `CapabilityAccessSchema`
- `CapabilityGrantSchema`
- `CapabilityScopeKindSchema`
- `CapabilityScopeSchema`
- `EventSchema`
- `ExecutionLeaseSchema`
- `KernelTimestampSchema`
- `PolicyDecisionSchema`
- `PrincipalKindSchema`
- `PrincipalSchema`
- `RunSchema`
- `RunStatusSchema`
- `SandboxProfileSchema`
- `StepSchema`
- `StepStatusSchema`
- `TaskSchema`
- `ToolInvocationSchema`
- `ToolManifestSchema`
- `createPolicyDecisionFromLegacyRoutingDecision`
- `createTaskFromLegacyTaskEnvelope`
- `hashKernelObject`
- `parseApprovalPermit`
- `parseCapabilityScope`
- `parsePolicyDecision`
- `parsePrincipal`
- `parseTask`

## Notes

- This task intentionally made no business-code changes.
- Existing `contracts` were not deleted or modified.
- Existing Codex CLI host runtime behavior was not modified.
- No canary, evidence collection, live Codex CLI smoke, deployment, release, or real external side-effect command was run.

