# Public Contract Compatibility Closeout

status: active API surface closeout
Date: 2026-07-07
Scope: public contract entrypoint compatibility for `codex-router`.

This closeout records the final narrow API surface decision for public
contracts. It does not authorize package publishing, production use, real
provider execution, real Codex CLI execution, workspace-write execution,
external writes, deployment, release, tags, or protected-branch mutation.

## Decision

`kernel-contracts` is the formal public contract source for canonical task,
run, policy, approval, principal, capability, tool, artifact, and event shapes.

New consumers should import those contracts through the curated package facade:

```ts
import { TaskSchema, RunSchema, PolicyDecisionSchema } from "codex-router/protocol";
```

The supported consumer entrypoint is `./protocol`, not a raw source path and not
a direct root export for `./kernel-contracts`.

`contracts` remains a legacy / compatibility surface for older router,
desktop-planning, and migration paths. It is retained so existing internal code
and compatibility shims do not need a forced migration in this closeout. It is
not the preferred surface for new consumers and must not be exported from
`codex-router/protocol` or from the root package export map.

## Consumer Guidance

Use these entrypoints:

| Consumer need | Preferred entrypoint |
|---|---|
| SDK integration | `codex-router/sdk` |
| Desktop or host integration | `codex-router/host` |
| Canonical kernel contracts and protocol adapters | `codex-router/protocol` |
| Provider author SPI | `codex-router/provider` |
| Curated support SPI | `codex-router/support` |

Do not use these as new product entrypoints:

| Surface | Reason |
|---|---|
| `codex-router/contracts` | legacy compatibility surface only |
| `codex-router/kernel-contracts` | canonical source, but exposed to consumers through `./protocol` |
| `packages/*/src/index.ts` | source layout is not a product API commitment |
| governance-internal packages | implementation detail, not an external product contract |

## Why Legacy Remains

The legacy `contracts` module contains older shapes such as task envelopes,
routing decisions, desktop execution plans, desktop primitives, and related
parse helpers. Those names still support existing internal flows and migration
paths.

Keeping the module in the repository avoids an unnecessary compatibility break.
Closing it at the public facade prevents new consumers from depending on that
older contract family as the forward path.

## Enforcement

The public API surface tests now enforce this boundary:

- the root `exports` map remains limited to `.`, `./sdk`, `./host`,
  `./protocol`, `./provider`, and `./support`;
- root exports must not add `./contracts`, `./kernel-contracts`,
  `./protocol-mcp`, or `./protocol-a2a` as bypass paths;
- `./protocol` must expose canonical kernel contract names such as
  `TaskSchema`, `RunSchema`, `PolicyDecisionSchema`, `ApprovalPermitSchema`,
  and their parse/hash helpers;
- `./protocol` must not expose legacy compatibility names such as
  `TaskEnvelopeSchema`, `RoutingDecisionSchema`, `DesktopExecutionPlanSchema`,
  `DesktopPrimitiveSchema`, `parseTaskEnvelope`, or `parseRoutingDecision`;
- generated public declarations must not reference the legacy
  `../../contracts/src/index.js` module.

## Verification Commands

Expected validation for this closeout:

```bash
git diff --check
node --import tsx --test tests/public-api-surface.test.ts
npm run docs:governance
npm run typecheck
npm test
npm run build
```

## Remaining Risks

- `packages/contracts/src/index.ts` still exists for compatibility and internal
  use; this closeout does not remove it.
- Direct source imports from repository internals remain possible inside the
  monorepo; the public package export map and facade tests define the supported
  consumer boundary.
- Any future attempt to productize legacy `contracts` names requires a separate
  compatibility review and explicit facade decision.
