---
title: R3B-2B Core-only Artifact Design Taskbook
status: design_complete_implementation_not_authorized
owner: governance
created: 2026-07-17
last_verified: 2026-07-17
verified_by:
  - main@751abc9019be047c30ca1a4a96c795835997e2ee
  - TypeScript AST runtime import/export closure traversal
  - TypeScript AST declaration import/export closure traversal
  - npm pack --dry-run --ignore-scripts --json
  - package consumer and public facade source review
supersedes: []
superseded_by: null
applies_to:
  - R3B-2B
  - core-only-artifact
  - package-surface
  - declaration-closure
---

# R3B-2B Core-only Artifact Design Taskbook

## 1. Authorization And Status

```text
task: R3B_2B_CORE_ONLY_ARTIFACT
mode: DESIGN_ONLY
repository: JENN2046/codex-router
design_base: 751abc9019be047c30ca1a4a96c795835997e2ee
design_branch: design/r3b2b-core-only-artifact
R3B_2A: CLOSED
R3B_2B_design: AUTHORIZED
R3B_2B_implementation: NOT_AUTHORIZED
branch_push: NOT_AUTHORIZED
pull_request: NOT_AUTHORIZED
merge: NOT_AUTHORIZED
release_deploy_publish: NOT_AUTHORIZED
provider_execution: NOT_AUTHORIZED
workspace_write_execution: NOT_AUTHORIZED
```

Jenn authorized this design-only task with:

```text
APPROVE_R3B_2B_CORE_ONLY_ARTIFACT_DESIGN_ONLY
```

This taskbook records analysis and a future implementation proposal. It does
not change `package.json`, `package-lock.json`, `tsconfig.json`, source,
build scripts, workflows, Ruleset, or the current packed artifact. It does not
implement an artifact allowlist or import firewall.

## 2. Decision Summary

The first implementation candidate should continue to use the existing clean
`dist` build and select an exact file-level closure for packaging. It should not
create a second TypeScript build output merely to reproduce the same module
graph.

The selected-file design has these exact properties:

- five supported package exports remain unchanged;
- the artifact includes 19 runtime files and 17 declaration files;
- every relative JavaScript and declaration dependency is present;
- no directory-level `dist/packages` include remains;
- the four unexported public facade pairs, Runtime packages, test fixtures, and
  historical packages outside the dependency closure are absent;
- `package.json` and `README.md` remain package metadata in addition to the 36
  selected `dist` files.

This design also records a material limitation. File selection can prove the
absence of concrete provider implementations and executor packages, but it
cannot prove byte-level absence of every execution-related type or vocabulary
inside an otherwise required monolithic file:

- `dist/packages/provider-core/src/index.d.ts` contains the internal
  `ExecutorProvider.execute` declaration even though `./provider` exports only
  the manifest-only `GovernanceProvider` SPI;
- `dist/packages/provider-core/src/index.js` contains workspace-write permit
  contract helpers that are not re-exported by `./provider`;
- `dist/packages/retain-control/src/index.js` contains the governed rollback
  implementation, including a `git` child process, because
  `./evidence` explicitly and currently exports `runGovernedRollback`;
- `kernel-contracts/index` imports and re-exports the legacy adapter even though
  the five formal facades do not explicitly re-export its names.

Therefore the selected-file candidate is the minimum packaging change, but its
acceptance claim must be **no forbidden concrete Runtime/executor module and no
forbidden package export**, not **no execution-related token anywhere in the
tarball**. If Jenn requires literal byte-level absence, a separately authorized
source/facade decomposition is required before the artifact can close. A second
`outDir` by itself does not solve this because TypeScript does not tree-shake
monolithic source modules.

## 3. Current Package Facts

At the reviewed base:

```text
package: codex-router@0.1.0
package type: module
private: true
current files rule: dist/packages + README.md
current dry-run pack entries: 229
current public-api emitted files: 18
current kernel-contract fixture emitted files: 30
```

The complete supported package exports are exactly:

| Export | Runtime target | Declaration target |
| --- | --- | --- |
| `./protocol` | `dist/packages/public-api/src/protocol.js` | `dist/packages/public-api/src/protocol.d.ts` |
| `./policy` | `dist/packages/public-api/src/policy.js` | `dist/packages/public-api/src/policy.d.ts` |
| `./codex-adapter` | `dist/packages/public-api/src/codex-adapter.js` | `dist/packages/public-api/src/codex-adapter.d.ts` |
| `./evidence` | `dist/packages/public-api/src/evidence.js` | `dist/packages/public-api/src/evidence.d.ts` |
| `./provider` | `dist/packages/public-api/src/provider.js` | `dist/packages/public-api/src/provider.d.ts` |

There is no supported bare package export. `codex-router`, raw `packages/*`
subpaths, and all former facade aliases must remain blocked by the package
export map.

## 4. Closure Method

The closure was established independently for runtime and declarations from
the compiled outputs at the reviewed base.

For each export target, the analysis:

1. parsed static `import`, `export ... from`, and `export * from` declarations
   with the TypeScript parser;
2. resolved every relative specifier exactly from the importing file;
3. recursively traversed `.js` files for runtime and `.d.ts` files for types;
4. failed on any unresolved relative edge;
5. recorded Node built-ins and external package imports separately;
6. unioned the five closures without inferring directory ownership.

Dynamic imports are not present in the selected closure. A future audit must
still reject non-literal dynamic imports or `require` calls rather than silently
omitting them.

External runtime dependencies are exactly:

```text
node:child_process
node:crypto
node:fs/promises
node:os
node:path
node:util
zod
```

The declaration closure has one external dependency: `zod`. `yaml` is a
package dependency but is not used by the five-entry closure at this base. The
artifact slice must not opportunistically remove dependencies in R3B-2B;
dependency cleanup is a separate package-contract decision.

## 5. Exact Per-entry Closure

### 5.1 `./protocol`

Runtime:

```text
dist/packages/contracts/src/index.js
dist/packages/kernel-contracts/src/codex-governance.js
dist/packages/kernel-contracts/src/index.js
dist/packages/kernel-contracts/src/legacy-adapter.js
dist/packages/public-api/src/protocol.js
```

Declarations:

```text
dist/packages/contracts/src/index.d.ts
dist/packages/kernel-contracts/src/codex-governance.d.ts
dist/packages/kernel-contracts/src/index.d.ts
dist/packages/kernel-contracts/src/legacy-adapter.d.ts
dist/packages/public-api/src/protocol.d.ts
```

### 5.2 `./policy`

Runtime:

```text
dist/packages/authorization-kernel/src/index.js
dist/packages/capability/src/index.js
dist/packages/contracts/src/index.js
dist/packages/file-change-preview/src/index.js
dist/packages/kernel-contracts/src/codex-governance.js
dist/packages/kernel-contracts/src/index.js
dist/packages/kernel-contracts/src/legacy-adapter.js
dist/packages/public-api/src/policy.js
```

Declarations:

```text
dist/packages/authorization-kernel/src/index.d.ts
dist/packages/contracts/src/index.d.ts
dist/packages/file-change-preview/src/index.d.ts
dist/packages/kernel-contracts/src/codex-governance.d.ts
dist/packages/kernel-contracts/src/index.d.ts
dist/packages/kernel-contracts/src/legacy-adapter.d.ts
dist/packages/public-api/src/policy.d.ts
```

### 5.3 `./codex-adapter`

Runtime:

```text
dist/packages/authorization-kernel/src/index.js
dist/packages/capability/src/index.js
dist/packages/codex-adapter/src/command-approval.js
dist/packages/codex-adapter/src/index.js
dist/packages/codex-adapter/src/permission-profile.js
dist/packages/codex-adapter/src/v2-wire.js
dist/packages/contracts/src/index.js
dist/packages/file-change-preview/src/index.js
dist/packages/kernel-contracts/src/codex-governance.js
dist/packages/kernel-contracts/src/index.js
dist/packages/kernel-contracts/src/legacy-adapter.js
dist/packages/public-api/src/codex-adapter.js
dist/packages/retain-control/src/index.js
```

Declarations:

```text
dist/packages/codex-adapter/src/index.d.ts
dist/packages/codex-adapter/src/permission-profile.d.ts
dist/packages/codex-adapter/src/v2-wire.d.ts
dist/packages/contracts/src/index.d.ts
dist/packages/file-change-preview/src/index.d.ts
dist/packages/kernel-contracts/src/codex-governance.d.ts
dist/packages/kernel-contracts/src/index.d.ts
dist/packages/kernel-contracts/src/legacy-adapter.d.ts
dist/packages/public-api/src/codex-adapter.d.ts
dist/packages/retain-control/src/index.d.ts
```

`command-approval.js` is required at runtime but its declaration file is not
reachable from the supported `codex-adapter.d.ts` closure.

### 5.4 `./evidence`

Runtime:

```text
dist/packages/contracts/src/index.js
dist/packages/kernel-contracts/src/codex-governance.js
dist/packages/kernel-contracts/src/index.js
dist/packages/kernel-contracts/src/legacy-adapter.js
dist/packages/public-api/src/evidence.js
dist/packages/retain-control/src/index.js
```

Declarations:

```text
dist/packages/contracts/src/index.d.ts
dist/packages/kernel-contracts/src/codex-governance.d.ts
dist/packages/kernel-contracts/src/index.d.ts
dist/packages/kernel-contracts/src/legacy-adapter.d.ts
dist/packages/public-api/src/evidence.d.ts
dist/packages/retain-control/src/index.d.ts
```

### 5.5 `./provider`

Runtime:

```text
dist/packages/contracts/src/index.js
dist/packages/kernel-contracts/src/codex-governance.js
dist/packages/kernel-contracts/src/index.js
dist/packages/kernel-contracts/src/legacy-adapter.js
dist/packages/provider-core/src/index.js
dist/packages/public-api/src/provider.js
dist/packages/tool-registry/src/index.js
```

Declarations:

```text
dist/packages/contracts/src/index.d.ts
dist/packages/kernel-contracts/src/codex-governance.d.ts
dist/packages/kernel-contracts/src/index.d.ts
dist/packages/kernel-contracts/src/legacy-adapter.d.ts
dist/packages/provider-core/src/index.d.ts
dist/packages/public-api/src/provider.d.ts
dist/packages/tool-registry/src/index.d.ts
```

## 6. Exact File-level Allowlist

The proposed selected-file artifact has exactly these 36 compiled files.

Runtime, 19 files:

```text
dist/packages/authorization-kernel/src/index.js
dist/packages/capability/src/index.js
dist/packages/codex-adapter/src/command-approval.js
dist/packages/codex-adapter/src/index.js
dist/packages/codex-adapter/src/permission-profile.js
dist/packages/codex-adapter/src/v2-wire.js
dist/packages/contracts/src/index.js
dist/packages/file-change-preview/src/index.js
dist/packages/kernel-contracts/src/codex-governance.js
dist/packages/kernel-contracts/src/index.js
dist/packages/kernel-contracts/src/legacy-adapter.js
dist/packages/provider-core/src/index.js
dist/packages/public-api/src/codex-adapter.js
dist/packages/public-api/src/evidence.js
dist/packages/public-api/src/policy.js
dist/packages/public-api/src/protocol.js
dist/packages/public-api/src/provider.js
dist/packages/retain-control/src/index.js
dist/packages/tool-registry/src/index.js
```

Declarations, 17 files:

```text
dist/packages/authorization-kernel/src/index.d.ts
dist/packages/codex-adapter/src/index.d.ts
dist/packages/codex-adapter/src/permission-profile.d.ts
dist/packages/codex-adapter/src/v2-wire.d.ts
dist/packages/contracts/src/index.d.ts
dist/packages/file-change-preview/src/index.d.ts
dist/packages/kernel-contracts/src/codex-governance.d.ts
dist/packages/kernel-contracts/src/index.d.ts
dist/packages/kernel-contracts/src/legacy-adapter.d.ts
dist/packages/provider-core/src/index.d.ts
dist/packages/public-api/src/codex-adapter.d.ts
dist/packages/public-api/src/evidence.d.ts
dist/packages/public-api/src/policy.d.ts
dist/packages/public-api/src/protocol.d.ts
dist/packages/public-api/src/provider.d.ts
dist/packages/retain-control/src/index.d.ts
dist/packages/tool-registry/src/index.d.ts
```

`package.json` is always included by npm. `README.md` remains an intentional
package file. Any npm-default metadata file must be modeled explicitly by the
artifact audit and must not be mistaken for an unexpected compiled module.

The allowlist is a closed set of individual normalized POSIX paths. Globs,
package directories, `dist/packages`, and prefix-based positive inclusion are
not allowed.

## 7. Artifact Identity Decision

### Selected decision

Use the existing deterministic `dist` build and select the exact 36-file
closure during packaging.

Reasons:

- build determinism is already independently established for the current
  `dist` output;
- the package export targets already point into that output;
- no output-path, compiler, or declaration topology change is required;
- a second TypeScript output would compile the same transitive modules and
  would not tree-shake monolithic files;
- exact file selection gives a smaller and more reviewable implementation diff.

### Rejected first-slice alternative

Do not add `dist-core`, a second `tsconfig`, copied source trees, or a bundler in
the first artifact-selection slice. Those changes expand build topology without
solving the monolithic-file limitation by themselves.

### Escalation condition

Use a later source/facade decomposition only if byte-level absence is required.
That decomposition must create dedicated public modules whose runtime and
declaration content contains only the intended public contract. It would need
separate compatibility analysis for at least `provider-core`,
`kernel-contracts`, and `retain-control`; it is not an automatic extension of
the file-selection implementation.

## 8. Legacy Adapter Decision

`legacy-adapter` is classified as a **temporary v0.1 compatibility contract**,
not a preferred public API and not a permanent core identity.

Current facts:

- `kernel-contracts/src/index.ts` uses `export * from "./legacy-adapter.js"`;
- every formal entry reaches `kernel-contracts/index`;
- the legacy adapter reaches `contracts/index`;
- removing either legacy-adapter pair or contracts pair breaks both runtime and
  declaration closure;
- the five formal facade sources explicitly enumerate exports and do not name
  the legacy adapter functions;
- raw `kernel-contracts` and `contracts` package subpaths are not package
  exports.

R3B-2B therefore keeps the four legacy compatibility files that are mechanically
required:

```text
dist/packages/contracts/src/index.js
dist/packages/contracts/src/index.d.ts
dist/packages/kernel-contracts/src/legacy-adapter.js
dist/packages/kernel-contracts/src/legacy-adapter.d.ts
```

This is compatibility retention, not a recommendation for new consumers.
Separating it requires replacing the broad `kernel-contracts/index` dependency
with a legacy-free public contract module and proving that all named facade
exports remain identical. That is a public-contract/source change and requires
separate authorization.

## 9. Required Exclusions

### 9.1 Unexported former public facades

The artifact must exclude all eight emitted files:

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

They are neither package exports nor members of the five-entry closure. Their
presence would reintroduce Agent OS, Desktop, MCP/A2A, storage, telemetry, and
host Runtime dependency paths.

### 9.2 Runtime and execution packages

The artifact must contain no files under any package directory other than the
ten package roots represented in the 36-file allowlist:

```text
authorization-kernel
capability
codex-adapter
contracts
file-change-preview
kernel-contracts
provider-core
public-api
retain-control
tool-registry
```

In particular, this excludes every concrete Runtime family, including:

```text
agent-os-*
codex-cli-host
codex-desktop-*
codex-memory-*
desktop-*
protocol-mcp
protocol-a2a
providers
provider-registry
governance-internal-provider-execution-runner
governance-internal-controlled-provider-dispatcher
governance-internal-workspace-write-executor
governance-internal-workspace-write-guard
governance-internal-runtime-control
host-dispatcher
execution-capsule
```

The exact allowlist, rather than this illustrative deny list, is authoritative.
A newly named package fails as an unexpected file even if it does not match a
known deny prefix.

### 9.3 Test, fixture, script, and generated evidence files

The packed artifact must contain no path under:

```text
dist/tests/
dist/scripts/
dist/packages/*/test-fixtures/
tests/
scripts/
docs/evidence/
```

The current 30 emitted kernel-contract test-fixture files are excluded.

### 9.4 Stale aliases and historical surfaces

The artifact and export map must not expose or retain package aliases for:

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

The package tarball may retain the four compatibility closure files listed in
section 8, but consumers must not be able to resolve them through a package
subpath. Physical compatibility dependency is distinct from a supported alias.

## 10. Mechanical Negative Proof

The future audit must operate on the actual `npm pack` file manifest and on the
installed tarball, not only on source intent.

Required assertions:

1. the normalized pack file set equals package metadata plus the exact 36-file
   allowlist; no extra compiled path is tolerated;
2. every package export target exists in the tarball;
3. recursive runtime and declaration closure from all five export targets is
   complete and is a subset of the allowlist;
4. no closure edge resolves outside the selected files or through a forbidden
   package root;
5. the eight old facade files are absent;
6. all test-fixture, test, script, evidence, Runtime, concrete provider,
   provider registry, executor, dispatcher, Desktop, Agent OS, MCP, and A2A
   files are absent;
7. bare root and stale aliases fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`;
8. runtime namespace inspection of `codex-router/provider` exposes no
   `execute`, provider implementation, registry, runner, or dispatcher export;
9. no selected runtime file contains a call expression whose property name is
   `execute` on a provider-like receiver, and no selected module imports a
   concrete provider or execution-runner package;
10. no selected runtime file imports the workspace-write executor package or
    exports a workspace-write executor;
11. the audit reports the known monolithic-file exceptions from section 2 and
    does not convert semantic absence into a false byte-level claim.

The negative result contract should distinguish:

```text
concreteProviderExecutionModulePresent: false
providerExecuteRuntimeCallPresent: false
workspaceWriteExecutorModulePresent: false
agentOsRuntimePresent: false
desktopRuntimePresent: false
mcpRuntimePresent: false
legacyFacadePresent: false
testFixturePresent: false
stalePackageAliasPresent: false
byteLevelExecutionVocabularyAbsent: false
```

The final field remains `false` for the selected-file design because the
required monolithic declaration/runtime files contain non-exported execution
contracts and the supported evidence API contains governed rollback behavior.
No closeout may relabel it `true` without source/facade decomposition evidence.

## 11. Negative Fixture And Unit Test Design

The future artifact audit should expose pure functions for closure and manifest
classification, with synthetic temporary fixtures only. Required fixtures:

| Fixture | Mutation | Required failure |
| --- | --- | --- |
| clean exact artifact | exact metadata + 36 files | pass |
| missing runtime edge | remove one imported `.js` | `runtime_closure_missing` |
| missing declaration edge | remove one imported `.d.ts` | `declaration_closure_missing` |
| undeclared extra file | add an unrelated `.js` | `artifact_file_not_allowlisted` |
| old root facade | add `public-api/src/index.js` | `legacy_facade_present` |
| old sdk/host/support facade | add either pair member | `legacy_facade_present` |
| concrete provider | add `packages/providers/...` | `provider_runtime_present` |
| provider runner | add provider execution runner path | `provider_execution_runner_present` |
| workspace-write executor | add exact executor or guard path | `workspace_write_runtime_present` |
| Agent OS Runtime | add an `agent-os-*` path | `agent_os_runtime_present` |
| Desktop Runtime | add a `desktop-*` or `codex-desktop-*` path | `desktop_runtime_present` |
| MCP Runtime | add `protocol-mcp` output | `mcp_runtime_present` |
| test fixture | add `test-fixtures/...` | `test_fixture_present` |
| stale alias | add a forbidden export key | `stale_package_alias_present` |
| relative escape | import outside allowlist | `artifact_import_outside_allowlist` |
| unresolved dynamic import | add non-literal import | `artifact_dynamic_import_unverifiable` |
| case/path ambiguity | duplicate normalized path | `artifact_path_not_canonical` |
| provider call | add a provider-like `.execute(...)` call | `provider_execute_runtime_call_present` |

The test must check both `.js` and `.d.ts` edges. A JavaScript-only pass is a
failure. Tests must not invoke a real provider, executor, Codex CLI, network,
workspace-write path, release, deploy, or publish.

## 12. Consumer Non-regression Design

The current `test-package-consumer` already builds, packs, installs into a blank
temporary consumer, typechecks representative imports from all five subpaths,
and proves that the bare root is blocked. It does not yet runtime-import all
five entries or smoke representative exports from each one.

The implementation candidate must extend the installed-tarball consumer test
to perform all of the following:

1. build before pack;
2. create the tarball in an isolated temporary directory with scripts disabled;
3. install the tarball and its declared dependencies into a blank ESM consumer;
4. typecheck value and type imports from all five supported entries with
   `moduleResolution: NodeNext` and `strict` enabled;
5. dynamically import all five entries from the installed package;
6. assert a minimal stable runtime symbol from each namespace;
7. perform only pure/non-executing smoke operations, such as schema parsing,
   manifest hashing, or capability classification;
8. assert bare root and every stale alias are blocked;
9. run the exact artifact and closure audit against the installed files;
10. remove the temporary consumer and tarball.

Representative smoke symbols:

```text
./protocol       CapabilityFactsSchema
./policy         deriveCapabilityFacts
./codex-adapter  CodexSdkAdapter
./evidence       RetainReceiptSchema
./provider       ProviderManifestSchema
```

The smoke must not call `runGovernedRollback`, instantiate a live App Server
transport, execute a provider, write the workspace, or contact an external
service.

## 13. TypeScript And Import Compatibility Impact

### Package consumers

Supported import specifiers do not change. Deep imports that relied on the
physical `dist/packages` tree were never package exports and are intentionally
not preserved. Filesystem-relative imports into `node_modules/codex-router`
are unsupported and may stop working.

### Declarations

All 17 declaration files are required. The package cannot omit apparently
internal declarations merely because a representative consumer does not name
their types. TypeScript may resolve re-exports and imported helper types while
checking downstream declarations.

### Internal relative imports

The compiled files use repository-shaped relative imports. Keeping the same
paths under `dist/packages` avoids rewriting specifiers. The closure audit must
resolve from the installed artifact, not assume that source-relative paths are
valid.

### Legacy compatibility

The legacy adapter remains physically present only because it is a transitive
dependency of `kernel-contracts/index`. It remains inaccessible through a
package export. Removing it in a later slice requires a new public contract
module and consumer compatibility proof.

### Runtime side effects

Importing the five formal entries does not itself execute a provider or
workspace-write executor. Some supported APIs are capability-bearing:
`./evidence` exposes governed rollback and the adapter/evidence closure imports
Node child-process and filesystem modules. Core-only packaging therefore means
curated supported surface and absence of Runtime implementations, not a pure or
side-effect-incapable library.

## 14. Proposed Future Implementation Diff

Implementation is not authorized. If separately authorized for the
selected-file candidate, the expected diff is:

```text
M package.json
  replace "dist/packages" in files with the exact 36 paths in section 6;
  retain README.md;
  do not change exports, dependencies, version, private, or scripts unless a
  separately reviewed audit command registration is authorized.

A scripts/run-core-only-artifact-audit.ts
  parse package exports and compiled import graphs;
  compare runtime/declaration closure to the closed allowlist;
  validate npm pack dry-run and installed artifact manifests;
  enforce negative path/export/runtime-call rules;
  emit only bounded status/reason data.

A tests/core-only-artifact-audit.test.ts
  implement the synthetic fixtures in section 11.

M scripts/test-package-consumer.ts
  add installed runtime imports, five-entry smoke, stale-alias negatives, and
  exact artifact verification.

M tests/package-consumer.test.ts
  update command-stage/unit expectations for the added checks.

M docs/governance/R3B_2B_CORE_ONLY_ARTIFACT_DESIGN_TASKBOOK.md
  record implementation authorization and observed evidence only after it is
  received and executed.
```

Expected unchanged files:

```text
package-lock.json
tsconfig.json
packages/**
.github/workflows/**
Ruleset
```

If implementation shows that `package-lock.json` changes, stop and explain why;
the file allowlist edit should not alter dependency resolution. If literal
byte-level absence is required, discard this small diff proposal and prepare a
separate source-decomposition taskbook rather than silently expanding scope.

## 15. Future Validation Ladder

After separate implementation authorization, run locally:

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

Required observed results:

```text
runtime closure: 19 / 19 present
declaration closure: 17 / 17 present
selected dist files: exactly 36
unexpected dist files: 0
supported exports installed/typechecked/imported/smoked: 5 / 5
bare root and stale aliases resolved: 0
concrete provider execution modules: 0
workspace-write executor modules: 0
Agent OS/Desktop/MCP Runtime modules: 0
old public facade files: 0
test fixtures: 0
real provider calls: 0
workspace-write execution calls: 0
release/deploy/publish calls: 0
```

The clean-build determinism audit must still pass and must report the new pack
manifest consistently from both dirty and empty build starts. No workflow
rerun or dispatch follows automatically; Jenn decides whether to authorize a
natural CI validation through a future PR.

## 16. Failure Handling And Rollback

Fail closed if any file is missing, extra, unresolved, non-canonical, or outside
the closure; if any declaration edge is missing; if a stale alias resolves; or
if an installed consumer cannot typecheck or import one of the five entries.

Before any publish, rollback is fully local and Git-reversible:

1. revert the `package.json` file allowlist change;
2. remove the new audit/test files and revert consumer-test extensions;
3. rebuild from an empty `dist`;
4. rerun the existing determinism and package consumer checks;
5. confirm the old 229-entry dry-run surface only as a rollback fact, not as a
   desired core-only result.

No Runtime migration, database state, provider state, release artifact, or
external consumer state is changed by the proposed implementation. A published
package cannot be treated as locally reversible and remains outside this task.

## 17. Residual Risks

- Static allowlists drift when a supported facade gains a dependency; the
  closure audit must make drift a reviewable failure.
- The selected files are source-module-sized, not symbol-tree-shaken; required
  monolithic modules retain non-public contracts and implementation helpers.
- Literal byte-level absence of `execute` and workspace-write vocabulary is not
  proven by this design.
- `./evidence` deliberately exposes governed rollback and therefore retains
  filesystem and child-process capability.
- The legacy adapter remains a transitive compatibility dependency until a
  separately authorized contract split.
- `yaml` remains declared although the five-entry closure does not import it;
  changing dependencies is outside this slice.
- npm includes package metadata by default; the audit must normalize these
  rules without widening the compiled-file allowlist.
- Platform path case and separator differences can hide duplicate or escaping
  paths unless canonicalization is tested on Linux, macOS, and Windows.
- A passing local consumer does not prove every downstream TypeScript version;
  the supported compiler/Node matrix remains the project matrix.
- The package is currently private and no publish path is authorized; artifact
  proof is local/package-consumer evidence only.

## 18. Entry Gate For Implementation

No implementation may begin from this taskbook alone. A future authorization
must identify which acceptance claim is intended:

```text
SELECTED_FILE_SEMANTIC_BOUNDARY
  exact 36-file artifact;
  no concrete Runtime/executor module;
  no forbidden export or provider.execute runtime call;
  known non-exported monolithic declarations/contracts retained.

BYTE_LEVEL_CORE_DECOMPOSITION
  source/facade restructuring required first;
  literal execution-related declaration/runtime content removed from the
  packed artifact;
  larger compatibility and package-surface review required.
```

Until Jenn gives a new exact authorization, the formal state is:

```text
R3B-2A CLOSED
R3B-2B DESIGN COMPLETE
R3B-2B IMPLEMENTATION NOT AUTHORIZED
```
