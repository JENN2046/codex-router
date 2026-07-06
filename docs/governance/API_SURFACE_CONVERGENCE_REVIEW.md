# API Surface Convergence Review

Status: active API convergence record.
Date: 2026-07-06
Scope: source-level API surface review for `codex-router`.

This report records the API surface convergence review performed against the
current repository code. It classifies which modules should be treated as real
external product interfaces, which modules should remain extension contracts,
and which modules are internal governance implementation details.

This report does not authorize release, package publishing, production use,
real provider execution, real Codex CLI execution, workspace-write execution,
external writes, deployment, tags, or protected-branch mutation.

## Implementation Status

Phase A is implemented as a source-level public facade and export lock. Phase B
moved the first high-risk governance core packages under explicit
`governance-internal-*` directories. Phase C has moved the approval,
checkpoint, runtime-control, run-manager, and validation-arbiter internal
package directories under the same naming convention. Phase D has applied the
support/SPI review: `redaction` is internalized, while observability, artifact
store, kernel store, and tool registry are retained as support modules. Phase E
adds an explicit public support SPI facade for those retained modules. Phase F
adds a root package export map for the implemented public facades. Phase G
records the narrow testing/diagnostics review and keeps `./testing` and
`./diagnostics` closed pending separate curation.

Implemented boundary:

- `packages/public-api/src/index.ts` is the explicit source-level public facade.
- `packages/public-api/src/sdk.ts`, `host.ts`, `protocol.ts`, `provider.ts`,
  and `support.ts` are explicit source-level subfacades.
- `packages/public-api/src/host.ts` owns declaration-safe host wrapper types for
  the public facade instead of re-exporting host implementation types that carry
  governance-internal references.
- `tests/public-api-surface.test.ts` locks the facade export list.
- `tests/public-api-surface.test.ts` also generates declaration-only output for
  the public package type targets and rejects public facade declarations that
  expose governance-internal host implementation paths.
- `tests/fixtures/public-api-surface-lock.fixture.json` records the approved
  runtime export names.
- `tests/fixtures/public-api-*-surface-lock.fixture.json` records the approved
  runtime export names for each subfacade.
- The facade exports product, host, protocol, and provider SPI surfaces.
- `packages/public-api/src/support.ts` is the explicit support SPI facade for
  retained support modules.
- `tests/fixtures/public-api-support-spi-surface-lock.fixture.json` records the
  approved support SPI runtime export names.
- The root `package.json` now maps only these package exports to built public
  facade outputs:
  - `.`
  - `./sdk`
  - `./host`
  - `./protocol`
  - `./provider`
  - `./support`
- `tsconfig.json` emits declaration files so the package `types` targets resolve
  after `npm run build`.
- The root export map intentionally does not expose `./testing`,
  `./diagnostics`, raw `packages/*` paths, or governance-internal modules.
- `docs/governance/API_TESTING_DIAGNOSTICS_SURFACE_PLAN.md` records the
  follow-up decision that `./testing` and `./diagnostics` remain closed for now.
- The support SPI facade exposes only curated telemetry, artifact store, kernel
  store, and tool registry contracts. It does not use `export *`.
- The support SPI facade intentionally excludes preflight-specific telemetry
  builders, JSONL event log internals, redaction internals, default tool
  manifest fixtures, and default tool registry helpers that would imply
  local-write or external-write capability.
- The facade intentionally does not export internal governance implementation
  modules such as recovery, workspace-write guard, provider execution runner,
  state manager, strategy router, entropy risk, execution observation, approval,
  checkpoint, runtime control, or validation arbiter internals.
- The first high-risk internal package directories now use explicit internal
  names:
  - `packages/governance-internal-recovery-control`
  - `packages/governance-internal-workspace-write-guard`
  - `packages/governance-internal-provider-execution-runner`
  - `packages/governance-internal-state-manager`
  - `packages/governance-internal-strategy-router`
  - `packages/governance-internal-entropy-risk`
  - `packages/governance-internal-execution-observation`
- The approval / checkpoint / runtime-control follow-up directories now use
  explicit internal names:
  - `packages/governance-internal-approval-gate`
  - `packages/governance-internal-approval-permit`
  - `packages/governance-internal-checkpoint-index`
  - `packages/governance-internal-checkpoint-ledger-v2`
  - `packages/governance-internal-runtime-control`
  - `packages/governance-internal-run-manager`
  - `packages/governance-internal-validation-arbiter`
- The support-layer decision slice internalizes the pure redaction utility:
  - `packages/governance-internal-redaction`
- The support-layer decision slice intentionally retains these directory names
  and exposes their supported SPI only through `packages/public-api/src/support.ts`:
  - `packages/observability`, because `TelemetrySink` is part of current host
    option types and now has an explicit host telemetry SPI facade.
  - `packages/kernel-store`, because `KernelStore` is part of current local
    runtime options used by SDK, CLI, and app-server entrypoints.
  - `packages/artifact-store`, because artifact persistence is a plausible
    testing / diagnostics / storage SPI and is now exposed through a curated
    support facade.
  - `packages/tool-registry`, because provider and MCP protocol surfaces already
    build public tool manifest types from it; only schemas, registry contracts,
    and the in-memory registry are exposed through the public support facade.
- Internal source, script, and test imports have been migrated to those new
  directory names.
- This rename and export-map work is an API boundary change only. It does not
  add runtime behavior, provider execution, Codex CLI execution,
  workspace-write execution, release automation, deployment, or package
  publishing.

Not yet implemented:

- removal of existing `packages/*/src/index.ts` exports;
- migration pressure on downstream consumers.
- any future `./testing` and `./diagnostics` package exports, because the
  current review decided those facades must remain closed until separately
  curated.

Those steps remain staged for follow-up PRs.

## Review Method

The review used source and test structure as evidence rather than project
positioning text.

Observed surfaces:

- root package metadata;
- package directory layout under `packages/`;
- `packages/*/src/index.ts` exports;
- direct imports from tests and runtime packages;
- existing public export lock tests;
- entrypoint shape for SDK, CLI, app-server, desktop host, provider, protocol,
  and recovery-control modules.

Key repository facts:

- The root `package.json` is private and has an `exports` map limited to the
  public facade outputs under `dist/packages/public-api/src/`.
- Only `packages/task-graph/package.json` and
  `packages/governance-failure-reducer/package.json` currently exist as
  package-level manifests.
- Most effective API surface is therefore created by source exports and test
  imports, not by a formal package export map.
- The widest export surfaces are low-level governance modules, not the thin
  product entrypoints.

Highest source export counts observed:

| Module | Export count | Review meaning |
|---|---:|---|
| `governance-internal-recovery-control` | 166 | Too broad for external product API. |
| `provider-core` | 81 | Candidate provider SPI, but needs a narrow facade. |
| `contracts` | 66 | Legacy / compatibility contract surface. |
| `observability` | 61 | Internal telemetry / audit implementation surface. |
| `kernel-contracts` | 51 | Candidate canonical public contract surface. |
| `task-graph` | 44 | Internal governance data structure unless explicitly productized. |
| `protocol-a2a` | 39 | Candidate protocol SPI. |
| `governance-internal-workspace-write-guard` | 38 | Internal safety implementation, not default product API. |
| `codex-desktop-live-host` | 36 | Candidate host integration API. |
| `delegation-policy` | 33 | Internal governance policy implementation. |

## Core Finding

The current repository has a strong governance core, but the public boundary is
not formally constrained. Internal modules are easy to import directly from
`packages/*/src/index.ts`, so tests and implementation code can accidentally
stabilize internal details as if they were product APIs.

The main convergence goal should be:

```text
Expose a small set of deliberate product and extension facades.
Treat the rest of the governance kernel as internal implementation.
```

## Classification

### External product interfaces

These modules should be treated as real external product-facing surfaces. They
should be stable, documented, export-locked, and eventually reachable through a
formal package export map.

| Module | External role | Convergence decision |
|---|---|---|
| `agent-os-sdk` | Primary programmatic SDK entrypoint. | Keep public. Prefer this as the default application integration API. |
| `agent-os-cli` | CLI command parsing and command runner surface. | Keep public as CLI implementation support, but do not expose internal runtime wiring. |
| `agent-os-app-server` | In-process app-server / HTTP handler adapter. | Keep public, but document that it is a handler surface, not a live production server. |
| `desktop-host-client` | Host client for desktop/runtime integration. | Keep public as an advanced host embedding API. |
| `codex-desktop-live-host` | Desktop live host bundle and starter surface. | Keep public as the higher-level host integration API. |

These should be the primary entrypoints a normal integrator sees first.

### External contracts and extension SPI

These modules may be public, but they should be exposed through narrow
contract-oriented facades instead of wholesale source exports.

| Module | External role | Convergence decision |
|---|---|---|
| `kernel-contracts` | Canonical schemas and data contracts. | Promote as the main public contract surface. |
| `protocol-mcp` | MCP manifest / descriptor / local adapter contracts. | Keep public, but replace broad `export *` with explicit exports. |
| `protocol-a2a` | Agent-to-agent protocol contracts. | Keep public as protocol SPI if actively supported. |
| `provider-core` | Provider author SPI. | Keep a narrow public provider contract facade. |
| `provider-registry` | Provider registration / selection support. | Keep a narrow advanced runtime setup facade. |
| `codex-desktop-bindings` | Low-level desktop runtime operation bindings. | Keep public only as host adapter SPI, not as default product API. |
| `codex-memory-adapter` | Memory adapter contract helpers. | Keep public only when memory integration is part of host extension. |
| `codex-memory-host-client` | Host memory client integration. | Keep public as optional host integration. |
| `codex-memory-mcp-client` | MCP memory client integration. | Keep public as optional adapter integration. |
| `codex-cli-host` | Controlled Codex CLI host adapter. | Keep as advanced / gated host surface, not as default SDK API. |

The provider and protocol APIs should be stable for extension authors, but they
should not force ordinary product users to understand the full governance
kernel.

### Internal governance implementation

These modules should not be treated as external product APIs. They may keep
source exports for internal tests and package composition, but they should not
be re-exported from public facades by default.

| Module group | Modules | Reason |
|---|---|---|
| Recovery and operator governance | `governance-internal-recovery-control`, `governance-internal-approval-gate`, `governance-internal-approval-permit`, `intent-gate`, `governance-internal-runtime-control`, `governance-internal-run-manager` | These define internal lifecycle, approval, dispatch, and recovery policy machinery. |
| Execution planning and guardrails | `execution-planner`, `execution-eligibility`, `governance-internal-provider-execution-runner`, `governance-internal-workspace-write-guard`, `tool-invocation-planner` | These are safety/control implementations; external callers should use higher-level facades. |
| Governance state and risk | `governance-internal-state-manager`, `governance-internal-strategy-router`, `governance-internal-entropy-risk`, `governance-internal-execution-observation`, `governance-failure-reducer`, `governance-internal-validation-arbiter` | These are internal reducers, risk models, and arbitration machinery. |
| Checkpoint and graph internals | `governance-internal-checkpoint-ledger-v2`, `governance-internal-checkpoint-index`, `task-graph` | These are internal data structures unless separately productized. |
| Configuration and policy internals | `policy-config`, `delegation-policy`, `recon-policy`, `capability`, `admission-control`, `preflight` | These should be consumed through SDK / host / provider flows. |
| Internal host/runtime plumbing | `desktop-live-adapter`, `desktop-decision-runner`, `desktop-agent-strategy`, `desktop-bridge`, `host-dispatcher`, `final-host-locator` | These are composition layers behind host-facing APIs. |
| Audit and support internals | `governance-internal-redaction`, `audit-memory`, `state-sync-audit` | Internal safety and audit implementation details. |
| Candidate support SPI | `observability`, `artifact-store`, `kernel-store`, `tool-registry` | These are not default product APIs, but current host/provider/protocol types depend on them or may need explicit future SPI facades. |

Important rule: `governance-internal-recovery-control` should not be exposed
wholesale. It is the largest current export surface and contains the most
sensitive governance lifecycle concepts. Only the specific dispatch, receipt,
and authorization contract types required by a public host facade should be
re-exported.

### Examples, diagnostics, and testing surfaces

These should remain outside the default product API. The narrow follow-up in
`API_TESTING_DIAGNOSTICS_SURFACE_PLAN.md` decided that `./testing` and
`./diagnostics` should not be opened in the current convergence line.

| Surface | Classification |
|---|---|
| `host-client-example` | Example only. |
| fake providers / fake transports | Internal tests and package-local examples only. |
| protocol skeleton providers | Curated protocol facade only when disabled and non-executing. |
| smoke helpers | Diagnostics-internal script/runbook surface only. |
| evidence collection helpers | Diagnostics / governance validation only; not root public API. |
| sandbox reference executors | Contract proof fixtures only; not production executor APIs. |

## Recommended Public Shape

The repository should converge toward a small number of explicit public
facades. Exact package names can be decided later, but the target shape should
look like this:

```text
./sdk
./host
./protocol
./provider
./support
```

Potential future `./testing` and `./diagnostics` facades are closed by default
and require separate curation before they can become public entrypoints.

Recommended facade responsibilities:

| Facade | Should expose | Should hide |
|---|---|---|
| `./sdk` | `AgentOsSdk`, `createAgentOsSdk`, SDK request/result types. | Recovery-control internals, provider execution runner internals, stores. |
| `./host` | desktop host client, live host starter, host embedding contracts. | Desktop adapter plumbing and decision-runner internals. |
| `./protocol` | canonical kernel contracts, MCP/A2A public protocol converters. | Local runtime implementation details and legacy adapters by default. |
| `./provider` | provider manifest schemas, provider interfaces, provider registry setup. | Execution runner internals and permit lifecycle internals. |
| `./support` | telemetry sink contracts, storage SPI, artifact store SPI, kernel store SPI, and curated tool registry contracts. | Redaction internals, JSONL event log internals, preflight-specific telemetry builders, and default tool manifests. |
| future `./testing` | Only separately curated pure in-memory builders, schema sample factories, or disabled contract witnesses. | Current fake providers, fake transports, test fixtures, sandbox reference executors, examples, production-facing entrypoints. |
| future `./diagnostics` | Only separately curated non-executing validators, summary formatters, or sanitized evidence schema readers. | Smoke runners, canaries, model probes, preflight probes, evidence writers, script re-exports, default SDK path. |

Example target imports:

```ts
import { createAgentOsSdk } from "codex-router/sdk";
import { createCodexDesktopLiveHostEmbeddingStarter } from "codex-router/host";
import { ProviderManifestSchema, type ExecutorProvider } from "codex-router/provider";
import { TaskSchema, RunSchema } from "codex-router/protocol";
import { createRecordingTelemetrySink, InMemoryKernelStore } from "codex-router/support";
```

## Recommended Convergence Sequence

1. Create explicit public facade modules for SDK, host, protocol, provider,
   and support. Testing and diagnostics remain closed pending separate curation.
2. Add public export lock tests for each implemented facade, following the existing
   `codex-cli-host` export lock pattern.
3. Promote `kernel-contracts` as the canonical public contract surface.
4. Mark `contracts` as legacy / compatibility unless a separate compatibility
   policy says otherwise.
5. Replace broad `export *` patterns on public surfaces with explicit exports.
6. Stop re-exporting internal governance modules from any product facade.
7. Keep the root `exports` map limited to curated public facades.
8. Keep internal tests allowed to import internal modules directly, but do not
   treat those imports as product API commitments.

## Immediate Non-Goals

This review does not recommend doing any of the following in the convergence
slice:

- no runtime behavior change;
- no package publishing;
- no release automation;
- no provider execution;
- no Codex CLI execution;
- no workspace-write execution;
- no public contract removal without compatibility review;
- no public `./testing` or `./diagnostics` export without a separate curation
  PR;
- no broad module rename;
- no migration that forces downstream callers before a facade exists.

## Acceptance Criteria For A Future Implementation PR

A future API surface convergence PR should be considered acceptable when:

1. public facades exist and are documented;
2. public facades have export lock tests;
3. internal governance modules are not re-exported from product facades;
4. `recovery-control` is not exposed wholesale;
5. protocol and provider SPI exports are explicit and narrow;
6. `kernel-contracts` is the canonical public contract surface;
7. legacy contract compatibility is documented;
8. `npm run typecheck`, targeted export-lock tests, and `npm test` pass or any
   limitation is reported truthfully.

## Decision Summary

`codex-router` should present itself externally as:

```text
SDK + host integration + protocol contracts + provider SPI
```

It should not present every governance package as a public product API.

The governance kernel can remain modular internally, but external consumers
should not need to depend on recovery lifecycle internals, execution guard
implementations, state reducers, risk scoring internals, checkpoint ledgers, or
diagnostic helpers. Any future advanced testing or diagnostics surface requires
a separate curated facade decision.
