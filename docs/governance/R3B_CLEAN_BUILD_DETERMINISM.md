---
title: R3B Clean-build Determinism
status: active
owner: governance
created: 2026-07-17
last_verified: 2026-07-17
verified_by:
  - PR #196 merged as bc98b88cbca80e60855dc7a0b16dab06d848430f
  - Codex current-head review of d974e3f131a60d35fa76460d33abf5ea345ad6de
  - Codex Router CI run 29547606677 attempt 2
  - npm run audit:clean-build-determinism
  - node --import tsx --test tests/clean-build-determinism.test.ts
  - npm run typecheck
  - npm run build
  - PR #198 merged as d9312acec1389a65c532685ee1b1122f065f853d
  - Codex Router CI run 29583678323
supersedes: []
superseded_by: null
applies_to:
  - build-output
  - package-dry-run
  - R3B-2A
---

# R3B Clean-build Determinism

This bounded R3B-2A candidate makes the default TypeScript build remove the
repository-local `dist` directory before compilation. Its only architectural
claim is that current build output is derived from current source rather than
from a previously dirty output directory.

`scripts/clean-build-output.ts` fails closed unless all of these facts hold:

- the working root identifies package `codex-router`;
- `tsconfig.json` declares an `outDir` that resolves exactly to `<root>/dist`;
- an existing `dist` path is a directory and not a symbolic link.

Only that validated `dist` directory is removed. The cleaner does not remove
source packages, change TypeScript inputs, select public entrypoints, or write
outside the isolated build fixture used by its audit.

## Mechanical Evidence

Run:

```bash
npm run audit:clean-build-determinism
```

The audit copies the current build inputs into an ignored, repository-local
fixture and performs this sequence:

1. add a synthetic source package and build it, proving its output exists;
2. delete that source package while leaving its emitted output in `dist`;
3. run the default build and prove the removed package output is absent;
4. record every `dist` file path, byte length, and SHA-256 digest;
5. record the `npm pack --dry-run --ignore-scripts --json` file manifest;
6. remove `dist`, rebuild from empty output, and record both manifests again;
7. require the dirty-output and empty-output manifests to be identical.

The audit uses `npm pack --dry-run`; it does not publish, install, or retain a
tarball. Its result fixes the claim scope to `clean_build_determinism_only` and
reports these non-claims mechanically:

```text
coreOnlyArtifactProven: false
artifactAllowlistChanged: false
runtimeSurfaceChanged: false
```

## Explicit Non-claims

This work does not establish a core-only artifact. `tsconfig.json` still
compiles the existing source surface, and `package.json.files` still includes
the existing `dist/packages` tree. Runnable Runtime and historical code remain
in the default build and pack surface exactly as recorded by the R3B read-only
inventory.

This candidate does not add an artifact allowlist, import firewall, source
package deletion, Runtime migration, workflow or Ruleset change, Node 20
maintenance, provider/worker/workspace-write authority, or App Server live
execution. Those boundaries require separate review and authorization.

## Independent Review And Finalization

PR #196 merged as `bc98b88cbca80e60855dc7a0b16dab06d848430f` on
2026-07-17. Independent review found no blocking defect in the bounded cleaner
or determinism claim. A post-merge local audit again proved identical dirty and
empty build results: `1032` `dist` files and `229` pack entries, with no
core-only, allowlist, or Runtime-surface claim.

Post-merge CI run `29547606677` attempt 1 failed once on macOS / Node 22 while
the audit reported only `clean_build_determinism_unknown_error`; matrix
fail-fast cancelled the remaining cross-platform jobs. The complete attempt 2
then passed all 20 jobs on the unchanged merge commit, including Linux,
Windows, and macOS on Node 20 and 22. The same PR head had also passed its full
current-head matrix before merge.

The initial R3B-2A disposition was therefore
`PASS_WITH_DISCLOSED_TRANSIENT_CI_DIAGNOSTIC_RISK`. The transient failure was
not reproduced, but its normalized reason did not preserve enough detail to
identify the originating filesystem or child-process error.

PR #198 subsequently added the bounded stage/category diagnostic projection
without changing the determinism algorithm, workflow, Ruleset, or package
surface. Its exact PR head and merge commit passed complete 20-job CI runs,
including Linux, macOS, and Windows acceptance on Node 20 and 22. The
diagnostic-observability gap is closed by
`R3B_2A_DIAGNOSTICS_ONLY_RECLOSEOUT.md`; the unknown historical host/runtime
cause remains a disclosed transient CI risk.

R3B-2A is re-closed as
`CLOSED_WITH_BOUNDED_DIAGNOSTICS_AND_DISCLOSED_TRANSIENT_CI_RISK` when the
diagnostics re-closeout enters `main`. R3B-2B remains unauthorized and does not
follow automatically. Its artifact allowlist, core-only packaging boundary,
and later import-firewall work require a separate exact scope, review, and
authorization.
