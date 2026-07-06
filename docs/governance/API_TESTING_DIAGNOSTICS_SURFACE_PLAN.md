# API Testing and Diagnostics Surface Plan

Status: active API surface follow-up.
Date: 2026-07-07
Scope: narrow review and plan for whether `./testing` and `./diagnostics`
should become root public package exports.

This plan records a source-driven decision for the API convergence work. It
does not authorize release, package publishing, production use, real provider
execution, real Codex CLI execution, workspace-write execution, external
writes, deployment, tags, or protected-branch mutation.

## Decision

Do not expose `./testing` or `./diagnostics` as root public package exports in
the current API convergence line.

Keep the current public root export map limited to:

```text
.
./sdk
./host
./protocol
./provider
./support
```

`./testing` and `./diagnostics` may be reconsidered only through separate
curation PRs with explicit export locks, negative tests, and a narrow source
ownership model. They must not be created by re-exporting existing fake,
smoke, evidence, script, or fixture surfaces wholesale.

## Source Evidence

- `package.json` currently maps only the six approved root public facades.
- `tests/public-api-surface.test.ts` explicitly rejects `./testing` and
  `./diagnostics` as root package exports.
- `packages/public-api/src/protocol.ts` intentionally exposes protocol
  skeleton builders such as `createMcpToolProviderSkeleton` and
  `createA2ARemoteAgentProviderSkeleton`, but does not expose
  `createFakeMcpToolProvider` or `createFakeA2ATransport`.
- `packages/protocol-mcp/src/index.ts` contains fake MCP provider helpers with
  `liveServerConnection: false`.
- `packages/protocol-a2a/src/index.ts` contains fake A2A transport helpers with
  `liveNetworkService: false` and disabled submit behavior by default.
- `packages/codex-cli-host/src/internal.ts` is explicitly documented as an
  internal/smoke surface.
- `packages/codex-cli-host/src/index.ts` exposes many host-sensitive smoke,
  preflight, model probe, and evidence helpers at the package source level, but
  these are not root public product facades.
- `package.json` scripts include smoke, canary, model, preflight, and evidence
  commands that are host-sensitive or authorization-gated by project protocol.
- `tests/fixtures/phase13-sandbox-reference-recovery-executor.ts` and
  `tests/fixtures/phase15-sandbox-reference-agent-executor-adapter.ts` are
  contract proof fixtures, not product executor APIs.

## Classification

| Surface | Decision | Reason |
|---|---|---|
| `createMcpToolProviderSkeleton` | Keep public through `./protocol`. | It is a disabled protocol skeleton and uses opaque refs rather than live server execution. |
| `createA2ARemoteAgentProviderSkeleton` | Keep public through `./protocol`. | It is a disabled remote-agent provider skeleton and does not start remote execution. |
| Support SPI in-memory stores and telemetry sinks | Keep public through `./support`. | These are curated support extension contracts and are already export-locked. |
| `createFakeMcpToolProvider` | Keep internal to protocol package / tests. | It is a fake provider fixture surface, not a stable consumer testing API. |
| `createFakeA2ATransport` and fake A2A transport types | Keep internal to protocol package / tests. | It simulates remote task state and could be mistaken for a supported public transport harness. |
| Test-local fake child processes, fake clocks, fake providers, fake spawners | Keep internal to tests. | They are implementation-specific fixtures tied to current test shape. |
| Phase 13 and Phase 15 sandbox reference executors | Keep internal to `tests/fixtures`. | They are contract witnesses for governance phases, not recovery or agent executor products. |
| `host-client-example` and target host skeleton helpers | Keep example-only. | They demonstrate host composition but should not define product API stability. |
| Codex CLI smoke task builders and smoke runners | Keep diagnostics-internal. | They are host-sensitive and can approach real Codex CLI or workspace-write boundaries. |
| `runAndWrite*Evidence` and `write*EvidenceFile` helpers | Keep diagnostics-internal. | They persist evidence and should remain under script/governance control rather than package API control. |
| `collect-evidence`, governance audit, state-sync, and reanchor scripts | Keep script/governance-only. | They are repository operating tools, not SDK consumer APIs. |
| Model checks, model probes, environment preflight helpers | Keep diagnostics-internal. | They inspect host/runtime readiness and may depend on local CLI or environment state. |
| Canary scripts and smoke telemetry scripts | Keep diagnostics-internal. | They are explicitly risk-tiered and authorization-sensitive. |
| Committed `docs/evidence/` JSON artifacts | Keep evidence records only. | They are historical artifacts, not importable APIs. |

## `./testing` Boundary

Current decision: closed.

Reason: the current testing candidates are mostly package-internal fakes,
test-local fixtures, phase contract witnesses, or examples. Exporting them now
would turn test implementation details into semver-like product commitments and
blur the boundary between public protocol skeletons and fake execution harnesses.

Future `./testing` can be reconsidered only if it is built as a curated facade
owned by `packages/public-api/src/testing.ts` or an equivalent explicit public
testing module. A future testing facade must satisfy all of these conditions:

- no broad `export *`;
- no imports from `tests/fixtures`;
- no real provider execution;
- no real Codex CLI execution;
- no workspace-write execution;
- no network writes;
- no shell/process runner;
- no evidence file writes by default;
- no host-client-example re-export;
- no fake helper whose name or behavior implies production runtime support;
- export lock fixture and negative tests for blocked fakes.

Acceptable future candidates would be pure in-memory builders, schema sample
factories, or disabled contract witnesses that are source-owned, documented,
and safe without host environment assumptions.

## `./diagnostics` Boundary

Current decision: closed.

Reason: the current diagnostics candidates are scripts, smoke runners,
preflight probes, evidence writers, telemetry smokes, model checks, canaries,
and governance audits. These are operating surfaces. Promoting them to a root
public package export would make it too easy for consumers to invoke
host-sensitive flows outside the repository's script-level guardrails.

Future `./diagnostics` can be reconsidered only for narrowly curated,
non-executing helpers, such as pure validators, summary formatters, or
sanitized evidence schema readers. A future diagnostics facade must satisfy all
of these conditions:

- no smoke runner exports;
- no `runAndWrite*` or `write*EvidenceFile` exports;
- no real Codex CLI execution path;
- no provider execution path;
- no workspace-write path;
- no canary execution path;
- no environment secret or credential reads;
- no host command spawning;
- no external network writes;
- no script re-exporting;
- explicit export lock fixture and negative tests for blocked smoke/evidence
  helpers.

Smoke, canary, model, preflight, evidence collection, state-sync, and governance
audit behavior should remain command-line and runbook controlled unless a
separate reviewed API design proves a safe pure-data subset.

## Implementation Plan

1. Keep the root `package.json` export map unchanged.
2. Keep `tests/public-api-surface.test.ts` rejecting `./testing` and
   `./diagnostics`.
3. Record this decision in the API convergence report.
4. If future public test utilities are needed, open a separate `./testing`
   curation PR with source-owned helpers and export locks.
5. If future public diagnostics utilities are needed, open a separate
   `./diagnostics` curation PR limited to pure non-executing validators or
   formatters.

## Non-Goals

- no new public `./testing` export;
- no new public `./diagnostics` export;
- no movement of test fixtures into public API;
- no promotion of smoke, canary, model, preflight, or evidence writers;
- no runtime behavior change;
- no provider execution;
- no Codex CLI execution;
- no workspace-write execution;
- no release, publish, deploy, tag, or protected-branch mutation.
