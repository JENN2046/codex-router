# Source/Release Package Boundary

SOURCE_RELEASE_PACKAGE_BOUNDARY_RECORDED

This repository keeps the reviewable source package separate from release
evidence. The audit is intentionally read-only and builds an archive pack-plan
manifest from the local filesystem; it does not create archives, copy files, or
print file contents.

## source-review.zip

The source review package is for human and automated source inspection. It may
include repository policy and review inputs:

- `.github/`
- `docs/`, excluding `docs/evidence/`
- `packages/`
- `scripts/`
- `tests/`
- `AGENTS.md`
- `PROJECT_CONTINUE_ANCHOR.md`
- `README.md`
- `README.AGENTS_OS.md`
- `package.json`
- `package-lock.json`
- `routing-policy.yaml`
- `tsconfig.json`

It must not include generated release material, local state, dependencies, or
temporary files:

- `.git/`
- `.agent_board/`
- `.codex-home/`
- `.omc/`
- `node_modules/`
- `dist/`
- `coverage/`
- `docs/evidence/`
- `.env`, `.env.*`, `config.env`
- `.test-*`
- `tmp-*`

## release-evidence.zip

The release evidence package is for generated build, test, and audit artifacts.
It may include:

- `docs/evidence/`
- `dist/`
- `coverage/`
- `test-output/`
- `test-results/`
- `reports/`
- `logs/`

It must not include source roots or local state:

- `.git/`
- `.agent_board/`
- `.codex-home/`
- `.omc/`
- `node_modules/`
- `.github/`
- `packages/`
- `scripts/`
- `tests/`
- `docs/` outside `docs/evidence/`
- root review files such as `package.json`, `tsconfig.json`, or
  `routing-policy.yaml`
- `.env`, `.env.*`, `config.env`
- `.test-*`
- `tmp-*`

## Audit

Run:

```bash
npm run governance -- audit source-release-package-boundary
```

The audit scans the archive pack-plan manifest that would feed
`source-review.zip` and `release-evidence.zip`, requires a clean `main` worktree
that is not behind `origin/main`, verifies that the two profiles are disjoint,
and reports only summarized counts.
