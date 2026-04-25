# Final Host Locator

`packages/final-host-locator` provides a read-only gate for deciding whether a
discovered path is safe to treat as the final Codex Desktop host source.

It does not scan the whole filesystem, start processes, or modify host files.
The caller supplies candidate paths and observed signals, or asks the package to
probe a specific supplied path for shallow marker files. The locator returns a
structured source gate.

## Purpose

Use this before wiring `codex-router` into a host so that:

- packaged app runtimes are not mistaken for editable source trees;
- VCPChat or other validation hosts remain reference-only unless explicitly
  re-scoped;
- partial source candidates show the missing startup, runtime, or validation
  seams;
- the final-host integration can fail closed until an editable source boundary is
  known.

## Example

Manual signal input:

```ts
import { createFinalHostSourceGate } from "../packages/final-host-locator/src/index.js";

const gate = createFinalHostSourceGate({
  candidates: [
    {
      path: "C:/Users/617/AppData/Local/Packages/OpenAI.Codex_2p2nqsd0c76g0",
      label: "installed Codex package",
      role: "packaged_runtime",
      signals: {
        installedPackage: true
      }
    },
    {
      path: "A:/VCP/VCPChat",
      label: "VCPChat validation host",
      role: "reference_host",
      signals: {
        editableSource: true,
        existingCodexRouterBridge: true,
        startupSeam: true,
        hostRuntimeSurface: true,
        validationSurface: true
      }
    }
  ]
});
```

With only those two candidates, the result remains
`blocked_missing_editable_source`. That is intentional: the installed Codex app
package is a runtime artifact, and VCPChat is a reference host.

## Path Probe

Use `probeFinalHostCandidatePath()` or
`createFinalHostSourceGateFromPathProbes()` when a specific candidate source path
is available.

The probe is intentionally shallow:

- checks whether the supplied path exists;
- checks whether it is a readable directory;
- checks direct child entries for `.git`;
- checks only caller-provided marker files for startup, runtime, validation, and
  existing bridge signals;
- does not recursively inspect the tree;
- does not write to the candidate path.

Example:

```ts
import {
  createFinalHostSourceGateFromPathProbes
} from "../packages/final-host-locator/src/index.js";

const gate = await createFinalHostSourceGateFromPathProbes({
  candidates: [
    {
      path: "A:/CodexDesktop",
      label: "Codex Desktop source",
      role: "final_host_candidate",
      startupSeamMarkers: ["src/main.ts"],
      hostRuntimeSurfaceMarkers: ["src/runtime.ts"],
      validationSurfaceMarkers: ["package.json"]
    }
  ]
});
```

## Ready Condition

A candidate can be selected as the final host source only when it is submitted as
a `final_host_candidate` and has all of these signals:

- `editableSource`
- `startupSeam`
- `hostRuntimeSurface`
- `validationSurface`

Until those are present, final-host wiring should remain blocked.

## Evidence

Use `createFinalHostSourceGateEvidence()` to turn a source gate into a compact
artifact that can be logged, displayed, or attached to a final-host readiness
check.

```ts
import {
  createFinalHostSourceGateEvidence
} from "../packages/final-host-locator/src/index.js";

const evidence = createFinalHostSourceGateEvidence(gate, {
  hostLabel: "Codex Desktop final host preflight",
  notes: ["read_only_preflight"]
});
```

The evidence includes:

- `ready`
- selected source summary when ready
- candidate counts by kind
- blocking reasons
- required inputs
- candidate summaries
- optional notes

Candidate signals are included by default. Pass
`includeCandidateSignals: false` when a smaller display payload is preferred.
