# Codex Router

`codex-router` is a policy-based Codex execution-governance layer above the
official Codex App Server and SDK. It decides capability, approval, preview,
evidence, reconciliation, and explicit rollback. Codex remains responsible for
authentication, threads, streaming, and applying accepted file changes.

The current target is an auditable pre-production beta, not a general provider
runtime or a production-readiness claim.

## Supported Boundary

The router owns:

- structured `CapabilityFacts` and monotonic `AuthorizationDecision`;
- thread/turn/item/request correlation for normalized App Server events;
- hard-boundary and allowlist evaluation for create/update file changes;
- pending approval journals, retain verification, and receipts;
- operator-permitted, drift-checked Git rollback.

The router does not directly apply a proposed Codex patch. It does not expose a
general provider executor, authenticate Codex, own history/streaming, or
authorize real provider execution, remote writes, release, deployment, or
package publication.

Automatic acceptance is currently a fake-transport acceptance path only. The
default process runner has no OS network/filesystem sandbox and is explicitly
ineligible. No live isolation enforcer ships in `0.1.0`, so live App Server
profiles remain `observe_only`. The repository-internal test factory is not a
live security claim.

## Public Package Surface

There is no root convenience export. The complete supported package surface is:

- `codex-router/protocol` — canonical governance contracts;
- `codex-router/policy` — fact extraction, authorization, canonicalization, and
  auto-approval policy evaluation;
- `codex-router/codex-adapter` — App Server governance and read-only SDK adapters;
- `codex-router/evidence` — preview, journal, retain, and rollback contracts;
- `codex-router/provider` — manifest, capability, security-boundary helpers, and
  the manifest-only `GovernanceProvider` SPI.

```ts
import { CapabilityFactsSchema } from "codex-router/protocol";
import { authorizeCapabilityFacts } from "codex-router/policy";
import { CodexAppServerAdapter } from "codex-router/codex-adapter";
import { RetainReceiptSchema } from "codex-router/evidence";
```

Agent OS, Desktop host, MCP/A2A, telemetry/store implementations, legacy
contracts, and provider execution packages are internal compatibility surfaces.
New authorization code must use `kernel-contracts` through the named public
subpaths.

## Non-configurable Safety Rules

Policy configuration cannot auto-approve:

- delete or rename (the beta declines them before App Server apply);
- command or permission requests (exact proposals require a human);
- secret/env/credential paths or credential-like proposed content;
- protected branches, dirty worktrees, or HEAD mismatch;
- network, external targets, release, deploy, or ambiguous/unknown facts;
- create/update without an exact expected after-hash;
- update without an exact before-hash;
- preview without an in-module trusted isolation binding and green exact-argv
  checks.

Replay, disconnect, schema/profile drift, and unresolved journal state after a
restart quarantine the adapter session. They never resume automatic acceptance.

## Validation

```bash
npm run typecheck
npm test
npm run build
npm run test:package-consumer
npm run test:governance-coverage
npm run test:governance-properties
npm run docs:governance
```

`npm run test:package-consumer` is self-contained after `npm ci`: it runs the
repository build before packing and typechecking the blank consumer.

The coverage gate requires at least 90% branch coverage independently for
authorization, preview, and retain/permit/rollback. CI is configured for Node
20/22 and Linux/Windows/macOS acceptance, with the coverage gate on Node 22.
Ordinary CI does not run a real Codex CLI, real App Server, provider execution,
real source-workspace write, or external canary.

## Documentation

- [Architecture](docs/governance/CODEX_EXECUTION_GOVERNANCE_ARCHITECTURE.md)
- [App Server adapter ADR](docs/governance/decisions/ADR_006_CODEX_APP_SERVER_GOVERNANCE_ADAPTER.md)
- [File-change governance runbook](docs/governance/runbooks/CODEX_APP_SERVER_FILE_CHANGE_GOVERNANCE.md)
- [Gate 0 baseline](docs/governance/CODEX_GOVERNANCE_BASELINE.md)

Live schema generation, a real App Server smoke, provider execution, and real
workspace-write remain separately authorized actions and are not implied by the
deterministic acceptance suite.
