---
title: ADR 009: App Server No-environment Proposal Contract
status: accepted
date: 2026-07-14
validation:
  - npm run test:app-server:no-environment-proposal
  - npm run typecheck
  - npm test
  - npm run build
---

# ADR 009: no-environment proposals remain offline-only

## Context

The exact-version `0.144.1` review found no client-controlled delayed-apply
protocol. It also found that `turn/start.environments: []` disables environment
access for that turn and that environment-dependent shell, `apply_patch`,
permission-request, and local-file tools are not registered when no environment
exists. `turn/start.outputSchema` can constrain the final assistant message.

Those source facts identify a possible proposal channel, but they do not prove
that inherited MCP, web, extension, dynamic, collaboration, or provider tool
surfaces are absent in a live effective configuration.

## Decision

Implement a strict offline-only contract with five boundaries:

1. Both thread and turn requests contain exact empty `environments` arrays.
   Dynamic tools are empty, input is text-only, approval is `never`, the
   permission profile is `:read-only`, and the proposal output schema is fixed.
2. Raw event ingestion accepts only a single correlated `agentMessage`
   lifecycle under strict `0.144.1` notification schemas. A contract nonce,
   monotonic sequence and injected replay store bind the offline transcript;
   the parsed contract is cloned before use. Any tool, approval, permission, command, file-change, MCP, web,
   provider, collaboration, process, shell, unknown item, replay, ordering
   error, or correlation drift blocks the session.
3. The final JSON proposal is one `update` bound to schema version, canonical
   target path, base SHA-256, after SHA-256, a bounded unified diff, and the
   exact source content supplied as non-sensitive UTF-8 data.
4. Verification clones a clean, exactly bound Git source without local or hard
   links, removes the remote, rejects filters, fsmonitor, upload-pack hooks,
   repository attributes, partial clones, alternates, submodules, unsafe
   temp-root containment, ignored or ordinary extra paths, and target mode
   changes. Source preflight rejects
   executable Git configuration before status inspection, and every Git child
   receives explicit fsmonitor, hook, and user-attribute overrides. The patch is
   applied only in that disposable clone and the final hash is verified.
5. Source HEAD, status, and target hash are re-read after clone verification.
   Cleanup failure blocks the receipt. Nothing applies the proposal to the
   source workspace.

## Security disposition

The contract is eligible only for deterministic offline tests. It intentionally
keeps these values false:

- `effectiveToolInventoryMechanicallyBound`;
- `liveExecutionAuthorized`;
- `liveSmokeEligible`;
- `realWorkspaceWriteAuthorized`.

`outputSchema` constrains output shape; it is not a capability boundary. Plan
Mode instructions are also not a capability boundary. Neither may be used to
relax this decision.

## Consequences

- codex-router can validate a structured proposal and its patch mechanics
  without giving App Server a workspace environment;
- synthetic patches may modify only disposable independent clones during
  offline verification;
- no successful offline receipt can authorize live execution or source writes;
- inherited live tool inventory remains the blocking trust boundary.

## Verification and change control

```bash
npm run test:app-server:no-environment-proposal
npm run typecheck
npm test
npm run build
```

This verification may create disposable Git repositories below the host temp
directory and apply synthetic patches only inside their independent clones. It
does not start Codex or App Server, connect a client, call a provider, or run a
real workspace-write smoke.

The first independent review found one P1 (source `git status` could invoke a
repository-local fsmonitor/filter before rejection) and three P2 findings
(non-exact/rebindable/replayable event input, ignored path and mode drift, and
source-contained temp roots). The implementation now rejects those cases and
the regression suite uses hostile direct/included sentinel hooks plus
exact-schema, replay, ignored-path, mode-change, and containment negatives. A
second independent read-only review found no remaining P1/P2. Acceptance here
is strictly offline-only and does not change any live authorization field.

Any future live consideration requires a separate independent security review
that mechanically binds the effective tool inventory and exact runtime request.
It also requires a new explicit authorization. Until both exist, the real App
Server workspace-write preflight remains blocked.
