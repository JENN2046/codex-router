# macOS Node 22 TypeScript Compiler-Stack Mitigation Proposal

Status: proposal only; implementation not authorized

Scope: intermittent TypeScript compiler stack overflow on GitHub-hosted macOS
with Node 22

Does not authorize: workflow rerun, generic retry, `continue-on-error`, failure
masking, Node runtime-matrix changes, TypeScript version changes, permanent
stack-size changes, merge, release, deploy, publish, or tag

## Evidence Basis

Two post-merge CI incidents failed during `npm run build` on macOS, Node
`22.23.1`, and TypeScript `6.0.3` with the bounded signature
`typescript_maximum_call_stack`:

- run `29655288120`, attempt 1, exact HEAD
  `4135186f31410d0ac754ade863512c9f9cf547df`;
- run `29671937193`, attempt 1, exact HEAD
  `2404384b51e93991dd841e8b3c955d475905fb7d`.

Draft experiment PR
[#209](https://github.com/JENN2046/codex-router/pull/209) compared Node 20 and
Node 22, TypeScript 5.9.3 and 6.0.3, and one fixed `8192 KiB` stack diagnostic.
Its exact-head run
[`29676398234`](https://github.com/JENN2046/codex-router/actions/runs/29676398234)
recorded one `typescript_maximum_call_stack` failure at iteration 15 in the
Node 22, TypeScript 5.9.3, default-stack row: 19/20 passed. The other four rows
passed 20/20. The unchanged full CI run
[`29676398229`](https://github.com/JENN2046/codex-router/actions/runs/29676398229)
passed all 20 jobs on the same exact head.

A supporting pre-correction run `29676098929` recorded the same signature once
in 20 compiles on Node 22 with TypeScript 6.0.3 at default stack. Because that
run preceded the explicit pull-request-head checkout correction, it supports
cross-version diagnosis but is not exact-head acceptance evidence.

The evidence establishes a low-frequency Node 22/macOS compiler-stack failure
that can occur across both tested TypeScript versions. It does not establish a
deterministic source defect, a TypeScript-version-only regression, a final
Node/V8 root cause, or a safe permanent stack-size mitigation.

## Decision Constraints

The mitigation investigation must preserve these constraints:

1. Do not introduce automatic or generic retry. A compiler crash must remain a
   visible failure.
2. Do not treat TypeScript 5.9.3 as a mitigation; it reproduced the same
   bounded signature.
3. Do not adopt `8192 KiB` stack solely because its diagnostic row passed.
4. Do not remove or weaken the Node 20/22 project validation matrix.
5. Do not weaken the existing 20-job CI, required status, merge lock, or
   state-sync semantics.
6. Do not retain raw compiler output, paths, environment values, credentials,
   or provider responses. Evidence remains bounded to approved signatures and
   aggregate toolchain facts.

## Proposed Investigation

### Stage 1: Pin And Observe The Runtime Tuple

For each approved experiment batch, record only bounded facts:

- exact PR head SHA;
- exact Node, V8, TypeScript, macOS runner image, and architecture versions;
- default or controlled stack setting;
- attempted, passed, and failed compile counts;
- approved failure signature counts;
- confirmation that retry policy was unchanged.

Continue the Node 20 controls and both TypeScript versions. Any Node 22 patch
candidate must be pinned to an exact semver for comparison; a floating `22`
selector cannot establish which runtime changed the result.

### Stage 2: Isolate Node/V8 From Compiler Version

Compare separately approved exact Node 22 patch candidates while keeping the
source tree, compiler version, clean-build behavior, runner class, sample
count, and default stack constant. Run both TypeScript controls for every
candidate. A TypeScript-only adjustment is rejected unless it independently
passes the full cross-control acceptance rule.

The fixed-stack row may continue only as a diagnostic control. It may show that
available stack depth affects the failure, but it cannot by itself identify the
root cause or authorize a build-command change.

### Stage 3: Rank Candidate Mitigations

Evaluate candidates in this order:

1. an exact Node 22 patch update that remains within the existing Node 22
   matrix and passes both compiler controls;
2. an upstream Node/V8 or TypeScript resolution supported by a bounded
   reproducer and exact version evidence;
3. a narrowly scoped compiler invocation stack control, only if default-stack
   failures remain reproducible, the controlled stack is consistently clean,
   and a separate authorization accepts the operational tradeoff.

No candidate may be implemented in this proposal PR. A candidate that reaches
acceptance requires a separate implementation branch and PR.

## Acceptance Gate

A mitigation candidate is eligible for a separate implementation proposal
only when all of the following hold:

1. at least three independently triggered exact-head evaluation batches pass;
2. each batch completes all five controlled rows with 20/20 compiles and zero
   crash signatures, for at least 300 consecutive controlled compiles total;
3. both Node 22 compiler-version controls pass at default stack;
4. both Node 20 controls remain clean;
5. the fixed-stack row is not the only passing Node 22 row;
6. the unchanged full 20-job `Codex Router CI` passes on every evaluated exact
   head;
7. no retry, rerun-as-masking, `continue-on-error`, matrix reduction, required
   context change, or failure suppression is used;
8. state-sync and execution-boundary audits pass on the exact reviewed head.

Each evaluation trigger must be separately authorized by the applicable PR or
CI workflow scope. Three batches are independent observations, not automatic
retries after a failure.

## Stop And Escalation Rules

- If both TypeScript versions continue to fail under the same exact Node 22
  candidate, stop treating compiler downgrade as a mitigation and escalate the
  Node/V8 runtime hypothesis.
- If only the controlled-stack row remains clean, record the correlation and
  require a separate stack-policy risk decision; do not modify the build.
- If a Node 22 patch candidate passes only one or two batches, retain it as
  preliminary evidence and continue no further without authorization.
- If the full CI matrix fails outside the bounded compiler signature, diagnose
  that failure independently; do not attribute it to this incident by default.
- If bounded evidence cannot distinguish the candidates, stop with an
  unresolved upstream toolchain risk rather than hiding the crash.

## Delivery Boundary

This document proposes investigation and acceptance criteria only. It creates
no runtime capability, provider execution, workspace-write authority, release
path, deployment path, package publication, merge authorization, CI retry
policy, or permanent toolchain change. Draft PR #209 remains the unmerged
experiment evidence carrier.
