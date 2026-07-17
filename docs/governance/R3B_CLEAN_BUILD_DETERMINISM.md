---
title: R3B Clean-build Determinism
status: implementation_candidate
owner: governance
created: 2026-07-17
last_verified: 2026-07-17
verified_by:
  - npm run audit:clean-build-determinism
  - node --import tsx --test tests/clean-build-determinism.test.ts
  - npm run typecheck
  - npm run build
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

## Disposition

R3B-2A remains an implementation candidate until its PR is independently
reviewed and merged. No R3B-2B artifact-boundary work follows automatically.
