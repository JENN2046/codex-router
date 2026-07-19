# TypeScript Toolchain Stability Experiment

Status: active bounded experiment

Scope: macOS compile stability only

Does not authorize: generic retry, runtime-matrix changes, merge, release,
deploy, publish, or tag

## Incident Basis

Two independent GitHub Actions runs failed in `npm run build` on
`macos-latest` with Node `22.23.1` and TypeScript `6.0.3`:

- run `29655288120`, attempt 1, HEAD
  `4135186f31410d0ac754ade863512c9f9cf547df`;
- run `29671937193`, attempt 1, HEAD
  `2404384b51e93991dd841e8b3c955d475905fb7d`.

Both emitted the same bounded failure signature:
`typescript_maximum_call_stack`. Both complete reruns passed, and another
concurrent run at the second exact HEAD passed on the same macOS runner image.
The evidence supports an intermittent compiler/toolchain interaction; it does
not prove a deterministic source defect or a final upstream root cause.

## Experiment Matrix

The dedicated `TypeScript Toolchain Stability` workflow runs only when its
bounded workflow, package, lockfile, tsconfig, harness, or harness test changes.
It does not replace or weaken the existing 20-job `Codex Router CI` workflow.
It explicitly checks out `github.event.pull_request.head.sha`, so every sample
binds to the exact PR head rather than GitHub's synthetic pull-request merge ref.

Each row samples twenty independent clean compiles on `macos-latest`:

| Node | Compiler | Stack control | Purpose |
|---|---|---|---|
| 20 | TypeScript 5.9.3 | default | pre-upgrade baseline |
| 20 | TypeScript 6.0.3 | default | Node-version control |
| 22 | TypeScript 5.9.3 | default | compiler-version control |
| 22 | TypeScript 6.0.3 | default | incident configuration |
| 22 | TypeScript 6.0.3 | 8192 KiB | bounded stack-size diagnostic |

TypeScript 5.9.3 is installed through the exact npm alias
`typescript-5-9`; TypeScript 6.0.3 remains the repository compiler. Version
drift, arbitrary compiler identifiers, arbitrary stack sizes, and more than
fifty samples fail closed.

## Failure And Disclosure Semantics

Every compile is an independent sample. The harness continues after a failed
sample only to establish the observed failure rate. It records every failure,
returns a failed summary when any sample fails, and exits non-zero. A later
successful sample cannot mask an earlier failure.

Child compiler output is not replayed or durably retained. The harness emits only bounded JSON
records containing the sample number, pass/fail state, approved failure
signature, aggregate counts, toolchain versions, platform, architecture, and
stack control. It does not retain command output, source diagnostics, paths,
environment values, or credentials.

The fixed `8192 KiB` stack row is diagnostic evidence only. Success in that row
does not by itself authorize adopting a larger stack as the permanent build
configuration.

## Acceptance And Decision Rule

The experiment is acceptable only when:

1. every configured row completes twenty consecutive compiles with zero
   failures;
2. the unchanged full 20-job `Codex Router CI` workflow passes for the same PR
   HEAD;
3. no generic retry, `continue-on-error`, failure masking, Node 20/22 runtime
   matrix change, or required-context change is introduced.

If only the default TypeScript 6.0.3 incident row fails, the next proposal must
compare a bounded compiler-version adjustment. If the default row fails while
the fixed-stack row passes, that result remains diagnostic and requires a
separate root-cause decision. If no row fails, the incident remains a known
intermittent risk; one green experiment run is evidence, not proof that the
underlying flake is eliminated.
