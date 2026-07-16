---
title: ADR 011: Offline Execution Capsule Contract
status: accepted
date: 2026-07-15
validation:
  - node --import tsx --test tests/offline-execution-capsule.test.ts
  - npm run test:coverage:offline-execution-capsule
  - npm run governance -- audit offline-execution-capsule-boundary
  - npm run docs:governance
  - npm run typecheck
  - npm test
  - npm run build
---

# ADR 011: offline execution capsules remain test-only

## Context

The repository needs a deterministic way to evaluate a complete candidate file
tree without treating a model response, host wrapper, or partial patch as
trusted execution evidence. A future isolated worker might use gVisor or a
microVM, but no such worker, runtime-owned issuer, durable replay boundary, or
mechanically isolated filesystem is present in this change.

The v1 goal is therefore narrower: bind a synthetic, non-sensitive task and an
immutable content tree; let a registered in-process fake transform that tree;
and independently verify a complete output tree before constructing a
`GovernedFileChangeSet`.

## Decision

Introduce the internal `packages/execution-capsule` contract with these fixed
boundaries:

1. `offline-execution-capsule.v1` accepts only
   `synthetic_non_sensitive` tasks and fixes `executionMode` to
   `test_only_simulated`. The manifest binds canonical task bytes, the complete
   input tree, repository identity, `baseHead`, opaque correlation values,
   exact target paths, a nonce, expiry, limits, and the offline policy version.
2. Task, tree, manifest, and receipt schemas are strict. Task and tree objects
   stored in the content-addressed store must use exact canonical JSON bytes.
   Tree entries permit only regular files; existing `100644` and `100755`
   files may remain, updates must preserve mode, and creates must use `100644`.
3. The only store implementation shipped by this module is in memory. It copies
   on write and read, verifies SHA-256 and size on every consumption, rejects
   missing or corrupt data, and reuses an unchanged blob digest in the output
   manifest. The internal `ContentAddressedStore` interface still accepts a
   caller-injected implementation so tests can observe corruption and I/O
   boundaries. Caller-injected store side effects are not mechanically excluded;
   the boundary audit reports this limitation instead of treating the interface
   as an in-memory-only runtime guarantee.
4. The fake worker is registered through a module-private `WeakMap`. Arbitrary
   objects, proxies, accessors, executable output objects, and unregistered
   workers are rejected before caller code can be invoked. Registration marks
   a caller-trusted test fixture; it is not a sandbox or a capability boundary.
   The capsule module passes copied in-memory bytes and imports no filesystem,
   process, socket, provider, or host execution primitive, but the injected
   transform remains ordinary in-process caller code.
5. The verifier independently reloads the task and both complete trees. It
   checks every digest and binding, expiry, cleanup, nonce replay, target scope,
   mode stability, text encoding, credential-like content, sensitive paths,
   file/byte/diff limits, and canonical change hashing. Delete, rename,
   target-outside, changed binary, and no-change results fail closed.
   Before the fake worker copies or stores transform output, a prestore gate also
   validates the complete-tree file, byte, and manifest budgets; sensitive paths;
   credential-like content; and changed-file and changed-byte budgets.
6. A successful result is only `verified_offline`. The output receipt is
   simulated contract evidence: its checks are marked `simulated` and cannot
   claim that an argv or real check ran. It does not enter `PreviewReceipt`,
   permit, retain, apply, or workspace promotion flows.
7. Every assessment schema fixes runtime verification, real isolation,
   filesystem-topology proof, durable replay protection, injected-transform
   side-effect exclusion, live execution, auto-approval, retain, apply, output
   retention, and workspace-write eligibility to `false`.

Content addressing proves that the independently consumed bytes match their
digests. It does not prove worker fidelity, isolation, determinism, absence of
side effects in an external worker, or faithfulness to the task instruction.
Injected transform side effects are not mechanically excluded: a trusted test
fixture can still reference ambient globals or closures. The source audit proves
only that the capsule implementation itself has no runtime-I/O import or call
surface. Test authors remain responsible for keeping the injected transform
synthetic and deterministic.

## Trust disposition

The v1 receipt is not promotable. A real gVisor, microVM, OCI, Codex, App
Server, or provider-backed worker must use a new schema version and receive a
separate independent security review. A live implementation may not reuse the
v1 fake-worker identity, receipt type, or `verified_offline` assessment as an
execution permit.

The App Server exact-apply gap remains unresolved. This contract produces a
canonical `GovernedFileChangeSet`, but it does not prove that App Server can
apply those exact bytes, bind an approval response to them, or prevent runtime
drift after approval.

The real workspace promotion boundary remains a manual responsibility or a future trusted
protocol problem. This ADR does not authorize real Codex execution, provider
execution, workspace-write execution, retain, apply, release, deploy, or any
external write.

## Consequences

- Offline fixtures now have a content-addressed candidate-generation contract
  and a complete-tree verification path.
- Unchanged binary files may pass through by digest, while any new or modified
  binary content is blocked.
- Tests can exercise corruption, replay, schema drift, boundary violations, and
  limit handling without reading a source workspace or starting a process.
- The internal package is intentionally absent from `package.json` exports and
  all public facade modules.
- CAS identity and a fake receipt remain contract evidence, not trustworthy
  worker attestation or runtime authorization.
- The shipped CAS is in-memory-only, while an injected store remains trusted
  caller code whose filesystem, network, logging, and other side effects are not
  mechanically excluded.
- In-process transform determinism and side-effect freedom remain caller-trusted
  test-fixture assumptions, recorded explicitly as mechanically unproven.

## Verification

```bash
node --import tsx --test tests/offline-execution-capsule.test.ts
npm run test:coverage:offline-execution-capsule
npm run governance -- audit offline-execution-capsule-boundary
npm run docs:governance
npm run validate:pr
npm run typecheck
npm test
npm run build
npm run test:package-consumer
```

All commands above are offline repository checks. They do not start Codex or
App Server, call a provider, open a capsule socket, mount a source workspace,
or attempt real workspace-write.

## Change control

Adding a filesystem or remote CAS, a real worker, live-scoped receipt, public
export, automatic approval, retain/apply integration, or any promotion path
requires a new schema version, explicit operator authorization, and an
independent security review. A passing v1 audit is never an execution permit.
