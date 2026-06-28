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

test("CI uploads node-scoped canary evidence before collecting the manifest", async () => {
  const workflow = parse(
    await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf-8")
  ) as {
    jobs: {
      canary: {
        strategy: { matrix: { node: number[]; risk: RiskLevel[] } };
        steps: WorkflowStep[];
      };
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
  const nodeScopedCopy = workflow.jobs.canary.steps.find((step) =>
    step.name === "Preserve node-scoped canary evidence"
  );
  const nodeRiskEvidenceNames = workflow.jobs.canary.strategy.matrix.node.flatMap((node) =>
    workflow.jobs.canary.strategy.matrix.risk.map((risk) =>
      `codex-cli-canary-node${node}-${risk}-latest.json`
    )
  );

  assert.ok(canaryUpload);
  assert.ok(nodeScopedCopy?.run?.includes(
    "docs/evidence/codex-cli-canary-${{ matrix.risk }}-latest.json"
  ));
  assert.ok(nodeScopedCopy?.run?.includes(
    "docs/evidence/codex-cli-canary-node${{ matrix.node }}-${{ matrix.risk }}-latest.json"
  ));
  assert.deepEqual(canaryUploadPaths, [
    "docs/evidence/codex-cli-canary-node${{ matrix.node }}-${{ matrix.risk }}-latest.json",
    "docs/evidence/codex-cli-canary-latest.json"
  ]);
  assert.equal(new Set(nodeRiskEvidenceNames).size, 4);
  assert.deepEqual(nodeRiskEvidenceNames, [
    "codex-cli-canary-node20-low-latest.json",
    "codex-cli-canary-node20-medium-latest.json",
    "codex-cli-canary-node22-low-latest.json",
    "codex-cli-canary-node22-medium-latest.json"
  ]);
  assert.equal(evidenceDownload?.with?.pattern, "*-evidence-*");
  assert.equal(evidenceDownload?.with?.path, "docs/evidence/");
  assert.equal(evidenceDownload?.with?.["merge-multiple"], true);
});

test("CI runs real state-sync audit for PR and main push before evidence collection", async () => {
  const workflow = parse(
    await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf-8")
  ) as {
    on: {
      push: { branches: string[] };
      pull_request: { branches: string[] };
    };
    jobs: {
      "state-sync": {
        if?: string;
        needs: string;
        steps: WorkflowStep[];
      };
      evidence: {
        needs: string[];
      };
    };
  };

  const stateSyncJob = workflow.jobs["state-sync"];
  const gateStep = stateSyncJob.steps.find((step) =>
    step.id === "state-sync-gate"
  );
  const npmCiStep = stateSyncJob.steps.find((step) => step.run === "npm ci");
  const auditStep = stateSyncJob.steps.find((step) =>
    step.run === "npm run governance -- audit state-sync"
  );

  assert.deepEqual(workflow.on.push.branches, ["main"]);
  assert.deepEqual(workflow.on.pull_request.branches, ["main"]);
  assert.equal(stateSyncJob.needs, "test");
  assert.equal(stateSyncJob.if, undefined);
  assert.ok(gateStep?.run?.includes('${{ github.event_name }}'));
  assert.ok(gateStep?.run?.includes('claim?.subject?.branch === "main"'));
  assert.ok(gateStep?.run?.includes(
    'claim?.subject?.upstream === "refs/remotes/origin/main"'
  ));
  assert.ok(gateStep?.run?.includes(
    'claim?.transition?.kind === "state_only_pushed"'
  ));
  assert.ok(gateStep?.run?.includes("main/state_only_pushed record exists"));
  assert.equal(npmCiStep?.if, "steps.state-sync-gate.outputs.run_audit == 'true'");
  assert.equal(auditStep?.if, "steps.state-sync-gate.outputs.run_audit == 'true'");
  assert.ok(auditStep);
  assert.ok(workflow.jobs.evidence.needs.includes("state-sync"));
});

test("state-sync reanchor workflow opens a bounded PR instead of pushing main", async () => {
  const workflow = parse(
    await readFile(
      new URL("../.github/workflows/state-sync-reanchor-pr.yml", import.meta.url),
      "utf-8"
    )
  ) as {
    on: { push: { branches: string[] } };
    permissions: {
      contents: string;
      "pull-requests": string;
    };
    jobs: {
      "reanchor-pr": {
        steps: WorkflowStep[];
      };
    };
  };

  const steps = workflow.jobs["reanchor-pr"].steps;
  const checkout = steps.find((step) => step.uses === "actions/checkout@v4");
  const gate = steps.find((step) => step.id === "reanchor-gate");
  const prepare = steps.find((step) => step.name === "Prepare state-sync reanchor");
  const commit = steps.find((step) => step.name === "Commit state-sync reanchor branch");
  const push = steps.find((step) => step.name === "Push state-sync reanchor branch");
  const pr = steps.find((step) =>
    step.name === "Create or update state-sync reanchor PR"
  );

  assert.deepEqual(workflow.on.push.branches, ["main"]);
  assert.equal(workflow.permissions.contents, "write");
  assert.equal(workflow.permissions["pull-requests"], "write");
  assert.equal(checkout?.with?.ref, "main");
  assert.equal(checkout?.with?.["fetch-depth"], 0);
  assert.equal(gate?.run, "node --import tsx scripts/resolve-state-sync-reanchor-pr-gate.ts");
  assert.ok(prepare?.run?.includes("scripts/prepare-state-sync-reanchor.ts --write"));
  assert.ok(prepare?.run?.includes("scripts/verify-state-sync-reanchor-diff.ts"));
  assert.ok(commit?.run?.includes("git switch -c state-sync/reanchor-main"));
  assert.ok(commit?.run?.includes("scripts/verify-state-sync-reanchor-diff.ts --cached"));
  assert.ok(commit?.run?.includes("scripts/run-state-sync-audit.ts --json"));
  assert.ok(push?.run?.includes(
    "git push --force-with-lease origin HEAD:refs/heads/state-sync/reanchor-main"
  ));
  assert.ok(!push?.run?.includes("HEAD:refs/heads/main"));
  assert.ok(pr?.run?.includes("scripts/create-state-sync-reanchor-pr.ts"));
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
  id?: string;
  if?: string;
  name?: string;
  shell?: string;
  uses?: string;
  run?: string;
  with?: {
    "fetch-depth"?: number;
    name?: string;
    path?: string;
    pattern?: string;
    ref?: string;
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
