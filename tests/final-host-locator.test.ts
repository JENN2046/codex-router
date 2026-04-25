import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createFinalHostSourceGateFromPathProbes,
  createFinalHostSourceGateEvidence,
  createFinalHostSourceGate,
  inspectFinalHostCandidate,
  probeFinalHostCandidatePath
} from "../packages/final-host-locator/src/index.js";

test("final host locator blocks packaged runtime as non-editable source", () => {
  const inspection = inspectFinalHostCandidate({
    path: "C:/Users/617/AppData/Local/Packages/OpenAI.Codex_2p2nqsd0c76g0",
    label: "installed Codex package",
    role: "packaged_runtime",
    signals: {
      installedPackage: true
    }
  });

  assert.equal(inspection.kind, "packaged_runtime");
  assert.equal(inspection.status, "blocked");
  assert.equal(inspection.canUseAsFinalHostSource, false);
  assert.deepEqual(inspection.blockingReasons, [
    "final_host_source_is_packaged_runtime"
  ]);
});

test("final host locator keeps VCPChat as reference-only unless explicitly re-scoped", () => {
  const gate = createFinalHostSourceGate({
    generatedAt: "2026-04-24T00:00:00.000Z",
    candidates: [
      {
        path: "A:/VCP/VCPChat",
        label: "VCPChat validation host",
        role: "reference_host",
        signals: {
          editableSource: true,
          gitRepository: true,
          writableWorkspace: true,
          existingCodexRouterBridge: true,
          startupSeam: true,
          hostRuntimeSurface: true,
          validationSurface: true
        }
      },
      {
        path: "C:/Users/617/AppData/Local/Packages/OpenAI.Codex_2p2nqsd0c76g0",
        label: "installed Codex package",
        role: "packaged_runtime",
        signals: {
          installedPackage: true
        }
      }
    ]
  });

  assert.equal(gate.schemaVersion, 1);
  assert.equal(gate.status, "blocked_missing_editable_source");
  assert.equal(gate.referenceHosts.length, 1);
  assert.equal(gate.packagedRuntimes.length, 1);
  assert.equal(gate.selectedSource, undefined);
  assert.ok(gate.blockingReasons.includes("editable_final_host_source_not_found"));
  assert.ok(gate.blockingReasons.includes("final_host_source_is_reference_host_only"));
});

test("final host locator selects an editable source only after required seams exist", () => {
  const gate = createFinalHostSourceGate({
    generatedAt: "2026-04-24T00:00:00.000Z",
    candidates: [
      {
        path: "A:/CodexDesktop",
        label: "Codex Desktop source",
        role: "final_host_candidate",
        signals: {
          editableSource: true,
          gitRepository: true,
          writableWorkspace: true,
          startupSeam: true,
          hostRuntimeSurface: true,
          validationSurface: true
        }
      }
    ]
  });

  assert.equal(gate.status, "ready_for_mapping");
  assert.equal(gate.blockingReasons.length, 0);
  assert.equal(gate.selectedSource?.path, "A:/CodexDesktop");
  assert.equal(gate.selectedSource?.canUseAsFinalHostSource, true);
});

test("final host locator reports missing mapping seams on partial source candidates", () => {
  const inspection = inspectFinalHostCandidate({
    path: "A:/CodexDesktop",
    role: "final_host_candidate",
    signals: {
      editableSource: true,
      gitRepository: true,
      writableWorkspace: true
    }
  });

  assert.equal(inspection.kind, "editable_source");
  assert.equal(inspection.status, "blocked");
  assert.deepEqual(inspection.blockingReasons, [
    "missing_startup_or_extension_seam",
    "missing_host_runtime_surface",
    "missing_validation_surface"
  ]);
});

test("final host locator probes a supplied source path without recursive scanning", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-router-final-host-"));
  await mkdir(join(root, ".git"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src", "main.ts"), "export const startup = true;\n");
  await writeFile(join(root, "src", "runtime.ts"), "export const runtime = true;\n");
  await writeFile(join(root, "package.json"), "{\"scripts\":{\"test\":\"node --test\"}}\n");

  const gate = await createFinalHostSourceGateFromPathProbes({
    generatedAt: "2026-04-24T00:00:00.000Z",
    candidates: [
      {
        path: root,
        label: "temporary Codex Desktop source",
        role: "final_host_candidate",
        startupSeamMarkers: ["src/main.ts"],
        hostRuntimeSurfaceMarkers: ["src/runtime.ts"],
        validationSurfaceMarkers: ["package.json"]
      }
    ]
  });

  assert.equal(gate.status, "ready_for_mapping");
  assert.equal(gate.selectedSource?.signals.editableSource, true);
  assert.equal(gate.selectedSource?.signals.gitRepository, true);
  assert.equal(gate.selectedSource?.signals.startupSeam, true);
  assert.equal(gate.selectedSource?.signals.hostRuntimeSurface, true);
  assert.equal(gate.selectedSource?.signals.validationSurface, true);
});

test("final host locator probe leaves partial source candidates blocked", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-router-final-host-partial-"));
  await mkdir(join(root, ".git"));

  const probe = await probeFinalHostCandidatePath({
    path: root,
    role: "final_host_candidate",
    startupSeamMarkers: ["src/main.ts"],
    hostRuntimeSurfaceMarkers: ["src/runtime.ts"],
    validationSurfaceMarkers: ["package.json"]
  });
  const inspection = inspectFinalHostCandidate(probe.candidate);

  assert.equal(probe.exists, true);
  assert.equal(probe.isDirectory, true);
  assert.equal(inspection.status, "blocked");
  assert.deepEqual(inspection.blockingReasons, [
    "missing_startup_or_extension_seam",
    "missing_host_runtime_surface",
    "missing_validation_surface"
  ]);
});

test("final host locator probe records missing supplied paths as blocked candidates", async () => {
  const missingPath = join(tmpdir(), "codex-router-final-host-missing");
  const probe = await probeFinalHostCandidatePath({
    path: missingPath,
    role: "final_host_candidate"
  });
  const inspection = inspectFinalHostCandidate(probe.candidate);

  assert.equal(probe.exists, false);
  assert.ok(probe.notes.includes("path_not_found"));
  assert.equal(inspection.status, "blocked");
  assert.ok(inspection.blockingReasons.includes("missing_editable_source_signal"));
});

test("final host locator evidence summarizes blocked source gates", () => {
  const gate = createFinalHostSourceGate({
    generatedAt: "2026-04-24T00:00:00.000Z",
    candidates: [
      {
        path: "A:/VCP/VCPChat",
        role: "reference_host",
        signals: {
          editableSource: true,
          startupSeam: true,
          hostRuntimeSurface: true,
          validationSurface: true
        }
      },
      {
        path: "C:/Users/617/AppData/Local/Packages/OpenAI.Codex_2p2nqsd0c76g0",
        role: "packaged_runtime",
        signals: {
          installedPackage: true
        }
      }
    ]
  });
  const evidence = createFinalHostSourceGateEvidence(gate, {
    hostLabel: "Codex Desktop final host preflight",
    notes: ["read_only_preflight"]
  });

  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.ready, false);
  assert.equal(evidence.status, "blocked_missing_editable_source");
  assert.equal(evidence.hostLabel, "Codex Desktop final host preflight");
  assert.equal(evidence.summary.totalCandidates, 2);
  assert.equal(evidence.summary.packagedRuntimeCandidates, 1);
  assert.equal(evidence.summary.referenceHostCandidates, 1);
  assert.equal(evidence.summary.blockedCandidates, 1);
  assert.ok(evidence.blockingReasons.includes("editable_final_host_source_not_found"));
  assert.deepEqual(evidence.notes, ["read_only_preflight"]);
});

test("final host locator evidence records selected source for ready gates", () => {
  const gate = createFinalHostSourceGate({
    generatedAt: "2026-04-24T00:00:00.000Z",
    candidates: [
      {
        path: "A:/CodexDesktop",
        label: "Codex Desktop source",
        role: "final_host_candidate",
        signals: {
          editableSource: true,
          startupSeam: true,
          hostRuntimeSurface: true,
          validationSurface: true
        }
      }
    ]
  });
  const evidence = createFinalHostSourceGateEvidence(gate);

  assert.equal(evidence.ready, true);
  assert.equal(evidence.status, "ready_for_mapping");
  assert.deepEqual(evidence.selectedSource, {
    path: "A:/CodexDesktop",
    label: "Codex Desktop source"
  });
  assert.deepEqual(evidence.blockingReasons, []);
});

test("final host locator evidence can omit candidate signals for compact display", () => {
  const gate = createFinalHostSourceGate({
    generatedAt: "2026-04-24T00:00:00.000Z",
    candidates: [
      {
        path: "A:/CodexDesktop",
        role: "final_host_candidate",
        signals: {
          editableSource: true,
          startupSeam: true,
          hostRuntimeSurface: true,
          validationSurface: true
        }
      }
    ]
  });
  const evidence = createFinalHostSourceGateEvidence(gate, {
    includeCandidateSignals: false
  });

  assert.equal("signals" in evidence.candidates[0]!, false);
});
