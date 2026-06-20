import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { parse } from "yaml";
import { collectEvidenceManifest } from "../scripts/collect-evidence.js";
import {
  getCanaryEvidencePaths,
  writeCanaryEvidence,
  type CanaryResult,
  type RiskLevel
} from "../scripts/run-canary-test.js";

test("canary evidence paths are risk-specific while preserving latest alias", () => {
  const evidenceDir = "/tmp/codex-router-evidence";
  const lowPaths = getCanaryEvidencePaths("low", evidenceDir).map((path) =>
    basename(path)
  );
  const mediumPaths = getCanaryEvidencePaths("medium", evidenceDir).map((path) =>
    basename(path)
  );
  const highPaths = getCanaryEvidencePaths("high", evidenceDir).map((path) =>
    basename(path)
  );

  assert.deepEqual(lowPaths, [
    "codex-cli-canary-low-latest.json",
    "codex-cli-canary-latest.json"
  ]);
  assert.deepEqual(mediumPaths, [
    "codex-cli-canary-medium-latest.json",
    "codex-cli-canary-latest.json"
  ]);
  assert.deepEqual(highPaths, [
    "codex-cli-canary-high-latest.json",
    "codex-cli-canary-latest.json"
  ]);
});

test("release canary evidence preserves low and medium results", async () => {
  const evidenceDir = await mkdtemp(join(tmpdir(), "codex-router-canary-evidence-"));

  try {
    await writeCanaryEvidence("low", createResult("low"), {
      evidenceDir,
      generatedAt: "2026-06-20T20:00:00.000Z"
    });
    await writeCanaryEvidence("medium", createResult("medium"), {
      evidenceDir,
      generatedAt: "2026-06-20T20:01:00.000Z"
    });

    const low = await readJson(join(evidenceDir, "codex-cli-canary-low-latest.json"));
    const medium = await readJson(join(evidenceDir, "codex-cli-canary-medium-latest.json"));
    const latest = await readJson(join(evidenceDir, "codex-cli-canary-latest.json"));
    const manifest = await collectEvidenceManifest(evidenceDir);
    const files = manifest.entries.map((entry) => entry.file);

    assert.equal(low.scenarioId, "CANARY-01");
    assert.equal(low.result.riskLevel, "low");
    assert.equal(medium.scenarioId, "CANARY-02");
    assert.equal(medium.result.riskLevel, "medium");
    assert.equal(latest.scenarioId, "CANARY-02");
    assert.ok(files.includes("codex-cli-canary-low-latest.json"));
    assert.ok(files.includes("codex-cli-canary-medium-latest.json"));
    assert.equal(manifest.byPhase["phase20-canary"]?.length, 3);
  } finally {
    await rm(evidenceDir, { recursive: true, force: true });
  }
});

test("CI uploads per-risk canary evidence before collecting the manifest", async () => {
  const workflow = parse(
    await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf-8")
  ) as {
    jobs: {
      canary: { steps: WorkflowStep[] };
      evidence: { steps: WorkflowStep[] };
    };
  };

  const canaryUpload = workflow.jobs.canary.steps.find((step) =>
    step.uses === "actions/upload-artifact@v4"
    && step.with?.name === "canary-evidence-node${{ matrix.node }}-${{ matrix.risk }}"
  );
  const canaryUploadPaths = splitWorkflowPath(canaryUpload?.with?.path);
  const evidenceDownload = workflow.jobs.evidence.steps.find((step) =>
    step.uses === "actions/download-artifact@v4"
  );

  assert.ok(canaryUpload);
  assert.deepEqual(canaryUploadPaths, [
    "docs/evidence/codex-cli-canary-${{ matrix.risk }}-latest.json",
    "docs/evidence/codex-cli-canary-latest.json"
  ]);
  assert.equal(evidenceDownload?.with?.pattern, "*-evidence-*");
  assert.equal(evidenceDownload?.with?.path, "docs/evidence/");
  assert.equal(evidenceDownload?.with?.["merge-multiple"], true);
});

function createResult(risk: RiskLevel): CanaryResult {
  return {
    status: "passed",
    taskId: `canary-${risk}`,
    governancePhase: "planning",
    riskLevel: risk,
    actionFamily: risk === "low" ? "execute" : "verify",
    verificationIntensity: risk === "low" ? "light" : "standard",
    checkpointPersisted: true,
    observationPersisted: true,
    requiresArbitration: false
  };
}

interface WorkflowStep {
  uses?: string;
  with?: {
    name?: string;
    path?: string;
    pattern?: string;
    "merge-multiple"?: boolean;
  };
}

function splitWorkflowPath(value: string | undefined): string[] {
  return (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function readJson(filePath: string): Promise<{
  scenarioId: string;
  result: { riskLevel: string };
}> {
  return JSON.parse(await readFile(filePath, "utf-8")) as {
    scenarioId: string;
    result: { riskLevel: string };
  };
}
