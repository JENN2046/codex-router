# Node 22 Patch Stability Stage 1 Experiment

Status: active bounded experiment; no mitigation adopted

Scope: exact-runtime macOS TypeScript compile stability only

Does not authorize: stack-size changes, retry, manual rerun, runtime-matrix
reduction, failure suppression, merge, release, deploy, publish, or tag

## Decision Basis

Draft PR #209 retained evidence that the bounded
`typescript_maximum_call_stack` signature can occur on `macos-latest` with
Node `22.23.1` under both TypeScript `5.9.3` and `6.0.3`. PR #210 then
established that a mitigation candidate must isolate the Node/V8 tuple while
preserving both compiler controls and the unchanged full CI matrix.

As of 2026-07-19, Node `22.23.1` is the latest published Node 22 LTS patch.
Node `22.23.0` is its immediate predecessor. Node `22.23.0` was a security
release, while Node `22.23.1` fixed unexpected HTTP agent behavior introduced
by that release:

- <https://nodejs.org/en/blog/release/v22.23.0>
- <https://nodejs.org/en/blog/release/v22.23.1>

Therefore `22.23.0` is a diagnostic comparison candidate, not an adoption or
downgrade proposal. A clean result may isolate the `22.23.0..22.23.1` patch
delta, but it cannot authorize pinning production or CI to `22.23.0`.

## Exact Runtime Matrix

The dedicated `Node 22 Patch Stability Stage 1` workflow runs only for a pull
request that changes its bounded workflow, package metadata, tsconfig, harness,
or harness test. It explicitly checks out
`github.event.pull_request.head.sha`. The harness independently fails closed
unless both the checked-out HEAD and the running Node version match the exact
values supplied by the matrix.

Each row performs twenty independent clean compiles on `macos-latest` using
the default Node stack:

| Role | Exact Node | Compiler | Compiles |
|---|---|---|---:|
| Node 20 control | 20.20.2 | TypeScript 5.9.3 | 20 |
| Node 20 control | 20.20.2 | TypeScript 6.0.3 | 20 |
| incident baseline | 22.23.1 | TypeScript 5.9.3 | 20 |
| incident baseline | 22.23.1 | TypeScript 6.0.3 | 20 |
| diagnostic candidate | 22.23.0 | TypeScript 5.9.3 | 20 |
| diagnostic candidate | 22.23.0 | TypeScript 6.0.3 | 20 |

One batch therefore contains 120 controlled compiles. Three independently
authorized exact-head batches would contain 360 controlled compiles, exceeding
the proposal's minimum of 300. Opening this draft PR authorizes only its normal
initial pull-request batch. A later batch requires a separate applicable PR or
CI trigger authorization; it is not an automatic retry after a failure.

TypeScript `5.9.3` is installed through the exact npm alias
`typescript-5-9`; TypeScript `6.0.3` remains the repository compiler. The
harness accepts only the three exact Node versions above, the two compiler
identifiers above, exactly twenty samples, and a forty-character exact HEAD
SHA. Version or ref drift fails before sampling.

## Failure And Disclosure Semantics

Every compile is an independent sample. The harness continues after a failed
sample only to measure the observed failure rate. It records the failure,
returns a failed summary when any sample fails, and exits non-zero. A later
successful sample cannot mask an earlier failure.

Child compiler output is scanned in memory but is not replayed or retained.
The harness emits only bounded JSON containing the sample number, pass/fail
state, approved failure signature, aggregate counts, exact HEAD, Node/V8 and
compiler versions, platform, architecture, runner image identifiers, and the
unchanged retry-policy flag. It does not emit source diagnostics, paths,
environment values, credentials, or child output.

No stack-size parameter or non-default stack invocation exists in this Stage 1
harness. The workflow contains no retry, `continue-on-error`, matrix reduction,
required-context change, or failure suppression.

## Batch Acceptance

An individual Stage 1 batch is acceptable only when:

1. all six rows complete 20/20 clean compiles with zero crash signatures;
2. both exact Node 22 patches pass under both compiler controls;
3. both exact Node 20 controls remain clean;
4. the unchanged full 20-job `Codex Router CI` passes on the same exact PR
   HEAD;
5. state-sync and execution-boundary audits pass on that exact HEAD; and
6. no retry, rerun-as-masking, stack control, `continue-on-error`, matrix
   reduction, required-context change, or failure suppression is used.

One green batch is preliminary evidence, not mitigation acceptance. Candidate
eligibility still requires three independently authorized green batches and a
separate implementation proposal. Any observed bounded compiler crash fails
the batch and remains evidence; it must not be retried into a green result.

## Decision Outcomes

- If `22.23.0` and `22.23.1` both reproduce the signature, retain the broader
  Node/V8 or compiler-stack hypothesis and wait for an upstream candidate.
- If only `22.23.1` reproduces it, investigate the narrow patch delta and an
  upstream fix; do not adopt `22.23.0` as a downgrade.
- If only one compiler fails under either Node patch, retain the other compiler
  as a control; do not infer a TypeScript-only mitigation from one batch.
- If all rows pass, record the batch as preliminary evidence and stop until a
  separately authorized second trigger.

Draft PR #209 remains the unmerged evidence carrier. This Stage 1 experiment
does not change the normal Node 20/22 CI matrix, repository build command,
runtime behavior, release path, deployment path, package publication, or tag
state.
