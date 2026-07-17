---
title: R3B-2B Core-only Artifact Design Taskbook
status: revised_design_candidate_independent_rereview_required
owner: governance
created: 2026-07-17
last_verified: 2026-07-17
verified_by:
  - main@751abc9019be047c30ca1a4a96c795835997e2ee
  - TypeScript AST runtime and declaration closure traversal
  - npm pack --dry-run --ignore-scripts --json
  - R3B-2B design independent review verdict REOPEN
  - strict TypeScript Program with types empty and skipLibCheck false
supersedes: []
superseded_by: null
applies_to:
  - R3B-2B
  - core-only-artifact
  - byte-level-decomposition
  - package-surface
  - declaration-consumer-contract
---

# R3B-2B Core-only Artifact Design Taskbook

## 1. Authorization And Status

```text
task: R3B_2B_CORE_ONLY_ARTIFACT
mode: REVISED_DESIGN_ONLY
repository: JENN2046/codex-router
design_base: 751abc9019be047c30ca1a4a96c795835997e2ee
design_branch: design/r3b2b-core-only-artifact
R3B_2A: CLOSED
R3B_2B_initial_design_review: REOPEN
R3B_2B_revised_design: CANDIDATE
R3B_2B_implementation: NOT_AUTHORIZED
branch_push: NOT_AUTHORIZED
pull_request: NOT_AUTHORIZED
merge: NOT_AUTHORIZED
release_deploy_publish: NOT_AUTHORIZED
provider_execution: NOT_AUTHORIZED
workspace_write_execution: NOT_AUTHORIZED
```

Initial design authorization:

```text
APPROVE_R3B_2B_CORE_ONLY_ARTIFACT_DESIGN_ONLY
```

Independent review authorization:

```text
APPROVE_R3B_2B_CORE_ONLY_ARTIFACT_DESIGN_INDEPENDENT_REVIEW
```

Revision authorization:

```text
APPROVE_R3B_2B_CORE_ONLY_ARTIFACT_DESIGN_REVISION
```

This revision changes only this taskbook. It does not change source,
`package.json`, `package-lock.json`, `tsconfig.json`, build scripts, workflows,
Ruleset, or the actual packed artifact. It does not implement an allowlist,
import firewall, provider execution, or workspace-write path.

## 2. Why The Initial Design Reopened

The initial design proposed selecting 36 compiled files from the existing full
`dist`. Its relative runtime and declaration closure was accurate, but the
design did not satisfy two mandatory consumer/artifact conditions.

### 2.1 `provider.execute` remained in the tarball

The selected declaration closure included:

```text
dist/packages/provider-core/src/index.d.ts
```

That monolithic declaration contains `ExecutorProvider.execute`. A semantic
claim that no concrete provider package or runtime call is exported does not
satisfy the stronger requirement that the packed artifact itself exclude this
provider execution contract.

### 2.2 the declaration consumer contract was incomplete

The selected declarations included `NodeJS.ProcessEnv` in:

```text
dist/packages/file-change-preview/src/index.d.ts
dist/packages/retain-control/src/index.d.ts
```

A strict TypeScript Program with `types: []` and `skipLibCheck: false` produced
three `TS2503 Cannot find namespace 'NodeJS'` errors. The current package
consumer uses `--skipLibCheck`, so it did not test this contract.

### 2.3 package metadata was not exact

The current dry-run pack contains three non-`dist` files:

```text
README.AGENTS_OS.md
README.md
package.json
```

The initial design named only `README.md` and `package.json`. The revised
artifact manifest treats all three as exact expected entries.

Independent review therefore returned `REOPEN`. The revised design resolves
these findings rather than weakening the original acceptance criteria.

## 3. Revised Architecture Decision

Use the existing clean TypeScript build and existing `dist` topology, but first
decompose two monolithic source/declaration boundaries:

```text
kernel-contracts/src/public.ts
  canonical current contracts only
  no legacy adapter edge

provider-core/src/governance-public.ts
  manifest schemas, manifest helpers, and GovernanceProvider only
  no ExecutorProvider, execute member, permit lifecycle, or runtime provider API
```

Then package the exact compiled closure of the five formal public facades.

This is a byte-level source/declaration decomposition, not merely a package
export restriction. The forbidden declarations and legacy module are not
present in the resulting tarball.

### Why no separate `dist-core`

A second `outDir` does not tree-shake TypeScript modules and would reproduce the
same monolithic `.js` and `.d.ts` problem. The revised design makes the source
module boundary match the artifact boundary, so the normal build can emit a
clean selectable closure without a new compiler, bundler, dependency, or
duplicate output tree.

### Why no declaration bundler

A declaration bundler would add dependencies, lockfile changes, a new build
stage, and a second source of public API truth. Small explicit module splits are
more reviewable and preserve the existing compiler and source maps of
responsibility.

## 4. Supported Package Identity

The complete supported package surface remains exactly:

| Export | Runtime target | Declaration target |
| --- | --- | --- |
| `./protocol` | `dist/packages/public-api/src/protocol.js` | `dist/packages/public-api/src/protocol.d.ts` |
| `./policy` | `dist/packages/public-api/src/policy.js` | `dist/packages/public-api/src/policy.d.ts` |
| `./codex-adapter` | `dist/packages/public-api/src/codex-adapter.js` | `dist/packages/public-api/src/codex-adapter.d.ts` |
| `./evidence` | `dist/packages/public-api/src/evidence.js` | `dist/packages/public-api/src/evidence.d.ts` |
| `./provider` | `dist/packages/public-api/src/provider.js` | `dist/packages/public-api/src/provider.d.ts` |

No root convenience export or historical alias is added. The five facade export
names and runtime behavior must remain unchanged.

## 5. Kernel Contract Decomposition

### 5.1 new `core.ts`

Move the canonical base schemas, types, parsers, and hashing implementation
currently defined directly in `packages/kernel-contracts/src/index.ts` into:

```text
packages/kernel-contracts/src/core.ts
```

The move is mechanical. It must not change schema shape, default, parser,
hashing, export name, or runtime behavior.

### 5.2 new `public.ts`

Create:

```ts
export * from "./core.js";
export * from "./codex-governance.js";
```

This is the canonical dependency target for the five formal facades and their
artifact closure. It must not import or export `legacy-adapter` or
`contracts/src/index`.

### 5.3 compatibility `index.ts`

Retain the existing internal compatibility identity through:

```ts
export * from "./public.js";
export * from "./legacy-adapter.js";
```

Internal consumers outside the core artifact may continue to use the old index
while migration is evaluated separately. The package export map does not expose
this raw module.

### 5.4 remove the circular public edge

Change `codex-governance.ts` to import its base kernel symbols from `core.js`,
not `index.js`. The legacy adapter may retain its compatibility import from the
index because neither file enters the target artifact.

### 5.5 selected import rewrites

Only artifact-reachable modules must change their kernel import from
`kernel-contracts/src/index.js` to `kernel-contracts/src/public.js`:

```text
packages/authorization-kernel/src/index.ts
packages/capability/src/index.ts
packages/codex-adapter/src/command-approval.ts
packages/codex-adapter/src/index.ts
packages/codex-adapter/src/v2-wire.ts
packages/file-change-preview/src/index.ts
packages/public-api/src/evidence.ts
packages/public-api/src/policy.ts
packages/public-api/src/protocol.ts
packages/retain-control/src/index.ts
```

This list is closed for the candidate. A closure audit must identify any missed
edge rather than widening the artifact back to `kernel-contracts/index`.

### 5.6 legacy adapter verdict

The legacy adapter remains a **temporary v0.1 compatibility contract for
internal source consumers**, but it is separated from the core artifact.

Target tarball exclusions:

```text
dist/packages/contracts/src/index.js
dist/packages/contracts/src/index.d.ts
dist/packages/kernel-contracts/src/index.js
dist/packages/kernel-contracts/src/index.d.ts
dist/packages/kernel-contracts/src/legacy-adapter.js
dist/packages/kernel-contracts/src/legacy-adapter.d.ts
```

This preserves source compatibility without treating historical compatibility
code as part of the supported five-entry artifact.

## 6. Provider Contract Decomposition

Create:

```text
packages/provider-core/src/governance-public.ts
```

Move exactly these supported schemas, types, interface, and functions from the
monolithic provider core into it:

```text
ProviderKindSchema
ProviderSideEffectClassSchema
ProviderSecurityBoundarySchema
ProviderRequiredConfigSchema
ProviderManifestSchema
ProviderKind
ProviderSideEffectClass
ProviderSecurityBoundary
ProviderRequiredConfig
ProviderManifest
GovernanceProvider
parseProviderManifest
hashProviderManifest
providerSupportsSideEffectClass
assertProviderSupportsSideEffectClass
providerSupportsSandboxProfile
assertProviderSupportsSandboxProfile
```

Move the private helpers required only by these public functions with them:

```text
networkAccessImplies
writableRootsImply
writableRootImplies
normalizeRootPattern
trimTrailingSlash
envPolicyImplies
stableStringifyProviderObject
```

The module may import only:

```text
node:crypto
node:path
zod
../../kernel-contracts/src/public.js
```

It must not contain or reference:

```text
ExecutorProvider
ProviderExecutionContext
ProviderExecutionResult
provider.execute
execute as a provider member
ToolProvider invocation
RemoteAgentProvider runtime
ModelProvider runtime
provider permit lifecycle
provider execution runner
workspace-write executor
```

`packages/provider-core/src/index.ts` must import and re-export the moved names
so existing internal source imports retain their identity. The remaining
provider-core implementation may continue to depend on those names, but its
compiled `index.js` and `index.d.ts` do not enter the core artifact.

Change `packages/public-api/src/provider.ts` to import and re-export only from
`governance-public.js`.

The `GovernanceProvider` shape remains manifest-only. No public runtime export
or type name changes.

## 7. `NodeJS.ProcessEnv` Consumer Contract

Do not add `@types/node` as a runtime dependency or peer dependency. Do not rely
on downstream consumers enabling `skipLibCheck`.

Add the same non-ambient structural alias in each affected source module:

```ts
type ProcessEnvironment = Record<string, string | undefined>;
```

Replace every `NodeJS.ProcessEnv` annotation in:

```text
packages/file-change-preview/src/index.ts
packages/retain-control/src/index.ts
```

with `ProcessEnvironment`.

This replacement is type-only and structurally equivalent for environment
objects. It must not change environment construction, sanitization, mutation,
child-process options, command execution, or runtime behavior.

Why replace every occurrence rather than only the three emitted references:

- it prevents a later exported signature from reintroducing the ambient type;
- it makes the source module's declaration contract self-contained;
- it avoids relying on current declaration-elision details;
- it keeps `package-lock.json` and dependency policy unchanged.

Required strict consumer proof:

```text
types: []
skipLibCheck: false
strict: true
module: NodeNext
moduleResolution: NodeNext
no @types/node installed in the blank consumer
TS2503 count: 0
```

The audit must also scan every packed `.d.ts` AST and reject references to the
`NodeJS` namespace.

## 8. Revised Exact Target Closure

The revised target has 17 runtime files and 15 declaration files. The provider
split also removes the monolithic provider core's tool-registry dependency from
the formal five-entry closure.

### 8.1 runtime allowlist: 17 files

```text
dist/packages/authorization-kernel/src/index.js
dist/packages/capability/src/index.js
dist/packages/codex-adapter/src/command-approval.js
dist/packages/codex-adapter/src/index.js
dist/packages/codex-adapter/src/permission-profile.js
dist/packages/codex-adapter/src/v2-wire.js
dist/packages/file-change-preview/src/index.js
dist/packages/kernel-contracts/src/codex-governance.js
dist/packages/kernel-contracts/src/core.js
dist/packages/kernel-contracts/src/public.js
dist/packages/provider-core/src/governance-public.js
dist/packages/public-api/src/codex-adapter.js
dist/packages/public-api/src/evidence.js
dist/packages/public-api/src/policy.js
dist/packages/public-api/src/protocol.js
dist/packages/public-api/src/provider.js
dist/packages/retain-control/src/index.js
```

### 8.2 declaration allowlist: 15 files

```text
dist/packages/authorization-kernel/src/index.d.ts
dist/packages/codex-adapter/src/index.d.ts
dist/packages/codex-adapter/src/permission-profile.d.ts
dist/packages/codex-adapter/src/v2-wire.d.ts
dist/packages/file-change-preview/src/index.d.ts
dist/packages/kernel-contracts/src/codex-governance.d.ts
dist/packages/kernel-contracts/src/core.d.ts
dist/packages/kernel-contracts/src/public.d.ts
dist/packages/provider-core/src/governance-public.d.ts
dist/packages/public-api/src/codex-adapter.d.ts
dist/packages/public-api/src/evidence.d.ts
dist/packages/public-api/src/policy.d.ts
dist/packages/public-api/src/protocol.d.ts
dist/packages/public-api/src/provider.d.ts
dist/packages/retain-control/src/index.d.ts
```

The missing declaration counterparts are intentional and must be proven
unreachable:

```text
dist/packages/capability/src/index.d.ts
dist/packages/codex-adapter/src/command-approval.d.ts
```

They are runtime dependencies but are not referenced by any supported
declaration edge.

### 8.3 exact package manifest: 35 entries

```text
32 compiled allowlist files
README.AGENTS_OS.md
README.md
package.json
```

The exact normalized pack file set must equal these 35 entries. npm-default
metadata is not an open-ended exception. If npm adds any other file, the audit
fails until the expected manifest is explicitly reviewed.

The `files` array must name all 32 compiled paths and both README files
individually. `package.json` is npm-mandatory metadata and remains part of the
expected manifest. No positive glob or directory include is allowed.

### 8.4 external dependency closure

Expected runtime external imports:

```text
node:child_process
node:crypto
node:fs/promises
node:os
node:path
node:util
zod
```

Expected declaration external import:

```text
zod
```

Expected ambient namespace dependencies:

```text
none
```

`yaml` remains a declared dependency but is not used by the five-entry closure.
Dependency cleanup is outside R3B-2B.

## 9. Required Exclusions

The artifact contains no file outside the 32-file compiled allowlist. This
closed positive rule is authoritative; the following negative groups make the
security intent explicit.

### 9.1 provider execution and workspace-write Runtime

```text
dist/packages/provider-core/src/index.*
dist/packages/providers/**
dist/packages/provider-registry/**
dist/packages/governance-internal-provider-execution-runner/**
dist/packages/governance-internal-controlled-provider-dispatcher/**
dist/packages/governance-internal-workspace-write-executor/**
dist/packages/governance-internal-workspace-write-guard/**
dist/packages/host-dispatcher/**
```

No packed `.js` or `.d.ts` may contain a `provider.execute` member access,
`ExecutorProvider` declaration, or provider interface member named `execute`.

The supported `./evidence` API still includes governed rollback. Its existing
filesystem and child-process behavior is not a provider or workspace-write
executor, but it remains a capability-bearing public contract and must be
reported as a residual risk.

### 9.2 Agent OS, Desktop, MCP/A2A, and host Runtime

```text
dist/packages/agent-os-*/**
dist/packages/codex-cli-host/**
dist/packages/codex-desktop-*/**
dist/packages/codex-memory-*/**
dist/packages/desktop-*/**
dist/packages/protocol-mcp/**
dist/packages/protocol-a2a/**
dist/packages/host-client-example/**
```

### 9.3 old public facades

```text
dist/packages/public-api/src/index.js
dist/packages/public-api/src/index.d.ts
dist/packages/public-api/src/sdk.js
dist/packages/public-api/src/sdk.d.ts
dist/packages/public-api/src/host.js
dist/packages/public-api/src/host.d.ts
dist/packages/public-api/src/support.js
dist/packages/public-api/src/support.d.ts
```

### 9.4 historical compatibility

```text
dist/packages/contracts/**
dist/packages/kernel-contracts/src/index.*
dist/packages/kernel-contracts/src/legacy-adapter.*
```

### 9.5 fixtures, tests, scripts, and evidence

```text
dist/tests/**
dist/scripts/**
dist/packages/*/test-fixtures/**
tests/**
scripts/**
docs/evidence/**
```

### 9.6 stale package aliases

These must remain absent from `package.json.exports` and fail to resolve after
installation:

```text
.
./sdk
./host
./support
./contracts
./kernel-contracts
./protocol-mcp
./protocol-a2a
./testing
./diagnostics
```

## 10. Mechanical Artifact Proof

The future audit must operate on both `npm pack --dry-run` output and an actual
tarball installed into an isolated blank consumer.

Required checks:

1. derive runtime and declaration closure from the five `exports` targets with
   the TypeScript AST;
2. traverse `import`, `export ... from`, `export * from`, and import-type nodes;
3. reject unresolved, escaping, non-literal dynamic, CommonJS, case-ambiguous,
   or non-canonical edges;
4. compare the compiled closure to the exact 32-file allowlist;
5. compare the normalized pack manifest to exactly 35 entries;
6. resolve every relative edge again from the installed artifact;
7. parse all packed `.d.ts` with `types: []`, `skipLibCheck: false` and require
   zero errors;
8. reject any `NodeJS` namespace reference in a packed declaration;
9. reject `ExecutorProvider`, a provider interface member named `execute`, or a
   `provider.execute` member access in packed JavaScript or declarations;
10. reject all forbidden paths and stale export aliases from section 9;
11. inspect the five runtime namespaces and compare them to their approved
    facade surface locks;
12. report only bounded reason enums and normalized artifact paths.

Required result projection:

```text
artifactEntryCount: 35
runtimeClosureCount: 17
declarationClosureCount: 15
unexpectedArtifactFiles: 0
unresolvedRuntimeEdges: 0
unresolvedDeclarationEdges: 0
strictDeclarationErrors: 0
nodeAmbientReferences: 0
providerExecuteReferences: 0
executorProviderDeclarations: 0
workspaceWriteExecutorFiles: 0
legacyCompatibilityFiles: 0
runtimeFamilyFiles: 0
oldFacadeFiles: 0
testFixtureFiles: 0
staleAliasesResolved: 0
```

Unlike the initial design, the revised candidate has no semantic-only exception
for `provider.execute`. Any occurrence is a hard failure.

## 11. Negative Fixture Tests

| Fixture | Mutation | Required failure |
| --- | --- | --- |
| exact revised artifact | exact 35 entries | pass |
| missing runtime edge | remove one imported `.js` | `runtime_closure_missing` |
| missing declaration edge | remove one imported `.d.ts` | `declaration_closure_missing` |
| unexpected metadata | add another root metadata file | `artifact_manifest_mismatch` |
| broad directory leak | add unrelated `dist/packages` file | `artifact_file_not_allowlisted` |
| provider index | add `provider-core/src/index.d.ts` | `provider_core_internal_present` |
| executor declaration | add `ExecutorProvider` with `execute` | `provider_execute_contract_present` |
| provider call | add `provider.execute(plan)` | `provider_execute_call_present` |
| workspace executor | add exact executor path | `workspace_write_executor_present` |
| legacy adapter | add either legacy adapter file | `legacy_compatibility_present` |
| legacy contracts | add `contracts/src/index.*` | `legacy_compatibility_present` |
| kernel old index | import `kernel-contracts/src/index.js` | `legacy_import_edge_present` |
| Node ambient | add `NodeJS.ProcessEnv` to `.d.ts` | `declaration_node_ambient_present` |
| old facade | add any old public facade pair member | `legacy_facade_present` |
| Runtime family | add Agent OS/Desktop/MCP file | corresponding Runtime reason |
| test fixture | add `test-fixtures` path | `test_fixture_present` |
| stale alias | add forbidden export key | `stale_package_alias_present` |
| relative escape | import outside allowlist | `artifact_import_outside_allowlist` |
| dynamic import | add non-literal dynamic import | `artifact_dynamic_import_unverifiable` |
| CJS edge | add `require(...)` | `artifact_commonjs_edge_unverifiable` |
| path ambiguity | duplicate normalized/case-folded path | `artifact_path_not_canonical` |

Tests use synthetic fixtures only. They must not invoke a provider, executor,
Codex CLI, network, workspace-write path, release, deploy, or publish.

## 12. Consumer Non-regression

The installed-tarball consumer must:

1. build from clean `dist`;
2. pack into an isolated temporary directory with lifecycle scripts disabled;
3. install the tarball, `zod`, and `yaml` into a blank ESM project;
4. not install `@types/node`;
5. typecheck value and type imports from all five entries with `strict`,
   `types: []`, and `skipLibCheck: false`;
6. dynamically import all five installed entries;
7. assert the exact approved namespace surface for each entry;
8. perform pure schema/hash/classification smoke only;
9. reject bare root and every stale alias;
10. run the exact artifact audit against installed files;
11. remove the temporary consumer and tarball.

Representative symbols:

```text
./protocol       CapabilityFactsSchema
./policy         deriveCapabilityFacts
./codex-adapter  CodexSdkAdapter
./evidence       RetainReceiptSchema
./provider       ProviderManifestSchema and GovernanceProvider type
```

The smoke must not call `runGovernedRollback`, instantiate a live transport,
execute a provider, write the workspace, or contact an external service.

## 13. Exact Future Implementation Diff

Implementation is not authorized. A separately authorized implementation is
expected to touch only:

```text
A packages/kernel-contracts/src/core.ts
A packages/kernel-contracts/src/public.ts
M packages/kernel-contracts/src/index.ts
M packages/kernel-contracts/src/codex-governance.ts

A packages/provider-core/src/governance-public.ts
M packages/provider-core/src/index.ts

M packages/authorization-kernel/src/index.ts
M packages/capability/src/index.ts
M packages/codex-adapter/src/command-approval.ts
M packages/codex-adapter/src/index.ts
M packages/codex-adapter/src/v2-wire.ts
M packages/file-change-preview/src/index.ts
M packages/retain-control/src/index.ts

M packages/public-api/src/protocol.ts
M packages/public-api/src/policy.ts
M packages/public-api/src/evidence.ts
M packages/public-api/src/provider.ts

M package.json
A scripts/run-core-only-artifact-audit.ts
A tests/core-only-artifact-audit.test.ts
M scripts/test-package-consumer.ts
M tests/package-consumer.test.ts
M docs/governance/R3B_2B_CORE_ONLY_ARTIFACT_DESIGN_TASKBOOK.md
```

`package.json` may change only its `files` array from `dist/packages` to the 32
exact compiled paths plus the two README paths. Its exports, dependencies,
version, `private`, and scripts remain unchanged; the audit runs by direct
command unless a separate script-registration scope is authorized.

Expected unchanged:

```text
package-lock.json
tsconfig.json
.github/workflows/**
Ruleset
all source files not listed above
```

If implementation needs another source file, dependency, lockfile change,
compiler option, build command, workflow, or public export change, stop and
revise the taskbook before proceeding.

## 14. Validation Ladder

After separate implementation authorization:

```bash
git diff --check
node --import tsx --test tests/core-only-artifact-audit.test.ts
node --import tsx --test tests/package-consumer.test.ts
node --import tsx scripts/run-core-only-artifact-audit.ts
npm run test:package-consumer
npm run audit:clean-build-determinism
npm run typecheck
npm test
npm run build
npm run docs:governance
```

Additional exact checks:

```text
strict installed consumer without @types/node: PASS
five facade runtime export locks: unchanged
kernel contract schema/hash fixtures: unchanged
provider manifest hash fixtures: unchanged
legacy adapter internal tests: PASS
dirty/empty build manifest equality: PASS
dirty/empty 35-entry pack manifest equality: PASS
real provider calls: 0
workspace-write execution calls: 0
workflow dispatch/rerun calls: 0
release/deploy/publish calls: 0
```

No CI follows automatically. Jenn separately decides whether a future branch,
PR, and natural CI run are authorized.

## 15. Failure Handling And Rollback

Fail closed on any unexpected file, missing edge, strict declaration error,
Node ambient reference, provider execution contract, legacy compatibility file,
Runtime file, old facade, fixture, stale alias, or public namespace difference.

Before publish, rollback is local and Git-reversible:

1. revert the exact implementation commit;
2. rebuild from empty `dist`;
3. rerun existing package consumer and clean-build determinism checks;
4. confirm the prior 229-entry pack only as rollback evidence;
5. leave R3B-2B reopened rather than weakening the negative criteria.

No database, provider state, Runtime migration, release artifact, or external
consumer state is changed by the proposed implementation. Publish remains
outside scope and is not treated as reversible.

## 16. Residual Risks

- Moving kernel definitions is mechanically large even though behavior should
  be unchanged; schema, hash, and export-lock regression tests are mandatory.
- Internal modules importing `kernel-contracts/index` retain the legacy adapter;
  only the packed five-entry closure is legacy-free.
- The provider split must avoid duplicate schema instances or divergent helper
  implementations; `index.ts` must re-export the same moved bindings.
- `ProcessEnvironment` is structurally compatible with `NodeJS.ProcessEnv`, but
  downstream code that depended on the nominal namespace spelling may observe a
  declaration-text change. Strict structural consumer tests reduce this risk.
- `./evidence` intentionally retains governed rollback and Node child-process /
  filesystem imports; core-only does not mean side-effect-incapable.
- Static allowlists drift when a supported facade gains a dependency; closure
  mismatch must be reviewed rather than automatically accepted.
- `README.AGENTS_OS.md` remains intentionally present as npm-default metadata;
  removing or renaming it is outside this design.
- `yaml` remains declared but unused by this closure; dependency cleanup is a
  separate decision.
- Cross-platform path normalization and npm metadata behavior require the
  supported Linux, macOS, and Windows matrix before closeout.
- The package remains private and no publish path is authorized.

## 17. Revised Design Acceptance Gate

This revised design is ready only for another independent design review. That
review must confirm:

```text
the predicted 17 runtime / 15 declaration closure is mechanically derivable
the exact artifact manifest is 35 entries
provider.execute and ExecutorProvider are absent at byte/AST level
legacy adapter and contracts are absent from the artifact
NodeJS ambient declaration dependencies are zero
five supported public namespaces remain identical
the implementation diff is sufficient and no hidden build dependency exists
```

Until that review passes and Jenn provides a separate implementation
authorization, the formal state is:

```text
R3B-2A CLOSED
R3B-2B INITIAL DESIGN REVIEW REOPENED
R3B-2B REVISED DESIGN CANDIDATE
R3B-2B IMPLEMENTATION NOT AUTHORIZED
```
