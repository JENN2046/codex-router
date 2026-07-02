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
npm run validate:pr
```

PR validation runs:

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run governance -- audit state-sync`

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
npm run governance -- audit state-sync
npm run governance -- acceptance readonly-chain
npm run governance -- operator readonly
```

The default `list` output is the current operating surface. Historical one-off
checks remain registered and executable; use `npm run governance -- list --all`
when intentionally looking for archived audit or acceptance commands.

Legacy per-check package script aliases have been removed. Use the consolidated `governance` runner instead.
