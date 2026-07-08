# Validation Tiers

This repository uses three validation tiers so routine work does not need to
carry release-level governance checks.

## Daily

Use for local implementation loops and narrow reviews.

```bash
npm run validate:daily
npm run validate:daily -- --test tests/desktop-live-adapter.test.ts
```

Daily validation runs `npm run typecheck`. Targeted tests run only when the
caller names them with `--test`, `--targeted-test`, or a bare test path.

## PR

Use before opening or updating a normal pull request.

```bash
npm run typecheck
npm test
npm run build
npm run docs:governance
npm run governance -- audit execution-boundary-current-surface
```

State-sync for non-`main` PR branches should run through GitHub CI's
`pull_request` State Sync Audit or an explicit local pull-request context
simulation.

When the checkout has a valid local state-sync context, this shortcut runs the
same code checks plus local state-sync:

```bash
npm run validate:pr
```

`validate:pr` runs:

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run docs:governance`
- `npm run governance -- audit execution-boundary-current-surface`
- `npm run governance -- audit state-sync`

`validate:pr` includes the local execution-boundary current surface audit and
the local state-sync audit. On an ordinary non-`main` PR branch, run
typecheck/tests/build and the execution-boundary audit locally, then let GitHub
CI run the `pull_request` State Sync Audit, or run an explicit local
pull-request context simulation. Do not treat a bare local state-sync audit on a
non-`main` branch as the PR state-sync gate.

The execution-boundary current surface audit records
`narrow_readonly_provider_dispatch_without_boundary_inheritance`: read-only provider dispatch does not inherit into host executor authorization, read-only provider dispatch does not inherit into sub-agent runtime authorization, read-only provider dispatch does not inherit into workspace-write authorization, and read-only provider dispatch does not inherit into release authorization.
Codex CLI host does not authorize host executor or sub-agent runtime; sub-agent
runtime does not invoke Codex CLI or provider execution; host executor does not
execute provider or sub-agent runtime.

See [Release Gate Matrix](governance/RELEASE_GATE_MATRIX.md) for the current
branch/main/release split.

## Release

Use before release-sensitive review. This tier stays deterministic and avoids
real host dependencies by default.

```bash
npm run validate:release
```

Release validation runs the PR tier plus:

- `npm run canary`
- `npm run canary:write`
- `npm run smoke:contract`
- `npm run evidence:collect`

Real Codex CLI smoke, workspace-write telemetry smoke, and external canary
checks remain explicit local actions. They are not part of `validate:release`.

## Governance Check Runner

Use the consolidated runner to discover and execute audit, acceptance, and
operator checks without scanning the full `package.json` script list.

```bash
npm run governance -- list
npm run governance -- list --all
npm run governance -- audit execution-boundary-current-surface
npm run governance -- audit state-sync
npm run governance -- acceptance readonly-chain --check
npm run governance -- acceptance controlled-readonly-provider-execution --check
npm run governance -- operator readonly
```

The default `list` output is the current operating surface. Historical one-off
checks remain registered and executable; use `npm run governance -- list --all`
when intentionally looking for archived audit or acceptance commands.

Current acceptance checks refresh committed `docs/evidence/*.json` files by
default after a pass. Use `--check` for a no-write local review pass; omit
`--check` only when intentionally updating acceptance evidence.

Legacy per-check package script aliases have been removed. Use the consolidated `governance` runner instead.
