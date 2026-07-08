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

test("legacy state-sync reanchor runner is not a default package script", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf-8")
  ) as { scripts?: Record<string, string> };
  const runner = await readFile(
    new URL("../scripts/run-state-sync-main-reanchor.ts", import.meta.url),
    "utf-8"
  );

  assert.equal(packageJson.scripts?.["state-sync:reanchor-main"], undefined);
  assert.match(runner, /export async function runStateSyncMainReanchor/);
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

test("CI runs governance audits before evidence collection", async () => {
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
      "execution-boundary": {
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
  const executionBoundaryJob = workflow.jobs["execution-boundary"];
  const checkoutStep = stateSyncJob.steps.find((step) =>
    step.uses === "actions/checkout@v4"
  );
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
  assert.equal(checkoutStep?.with?.["fetch-depth"], 0);
  assert.equal(checkoutStep?.with?.ref, "${{ github.sha }}");
  assert.ok(gateStep?.run?.includes('${{ github.event_name }}'));
  assert.ok(gateStep?.run?.includes('claim?.subject?.branch === "main"'));
  assert.ok(gateStep?.run?.includes(
    'claim?.subject?.upstream === "refs/remotes/origin/main"'
  ));
  assert.ok(gateStep?.run?.includes(
    'claim?.transition?.kind === "state_only_pushed"'
  ));
  assert.ok(gateStep?.run?.includes("const v2StateSyncRecord"));
  assert.ok(gateStep?.run?.includes("claim?.schemaVersion === 2"));
  assert.ok(gateStep?.run?.includes(
    'claim?.policyVersion === "state-sync-policy.v2"'
  ));
  assert.ok(gateStep?.run?.includes(
    "v2 state-sync-policy record or legacy v1 main/state_only_pushed fallback record exists"
  ));
  assert.equal(npmCiStep?.if, "steps.state-sync-gate.outputs.run_audit == 'true'");
  assert.equal(auditStep?.if, "steps.state-sync-gate.outputs.run_audit == 'true'");
  assert.ok(auditStep);
  assert.equal(executionBoundaryJob.needs, "test");
  assert.equal(executionBoundaryJob.if, undefined);
  assert.ok(executionBoundaryJob.steps.some((step) => step.run === "npm ci"));
  assert.ok(executionBoundaryJob.steps.some(
    (step) => step.run === "npm run governance -- audit execution-boundary-current-surface"
  ));
  assert.ok(workflow.jobs.evidence.needs.includes("state-sync"));
  assert.ok(workflow.jobs.evidence.needs.includes("execution-boundary"));
});

test("state-sync reanchor workflow is a manual legacy fallback", async () => {
  const workflow = parse(
    await readFile(
      new URL("../.github/workflows/state-sync-reanchor-pr.yml", import.meta.url),
      "utf-8"
    )
  ) as {
    name: string;
    on: {
      push?: { branches: string[] };
      workflow_dispatch?: Record<string, never> | null;
    };
    permissions: {
      contents: string;
      "pull-requests": string;
    };
    concurrency: {
      group: string;
      "cancel-in-progress": boolean;
    };
    jobs: {
      "reanchor-pr": {
        name: string;
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

  assert.equal(workflow.name, "State Sync Reanchor PR (Legacy v1 Manual Fallback)");
  assert.equal(
    workflow.jobs["reanchor-pr"].name,
    "Prepare State Sync Reanchor PR (Legacy v1 Manual Fallback)"
  );
  assert.ok(workflow.on.workflow_dispatch !== undefined);
  assert.equal(workflow.on.push, undefined);
  assert.equal(workflow.permissions.contents, "write");
  assert.equal(workflow.permissions["pull-requests"], "write");
  assert.equal(workflow.concurrency.group, "state-sync-reanchor-main");
  assert.equal(workflow.concurrency["cancel-in-progress"], true);
  assert.equal(checkout?.with?.ref, "main");
  assert.equal(checkout?.with?.["fetch-depth"], 0);
  assert.equal(gate?.run, "node --import tsx scripts/resolve-state-sync-reanchor-pr-gate.ts");
  assert.ok(prepare?.run?.includes("scripts/prepare-state-sync-reanchor.ts --write"));
  assert.ok(prepare?.run?.includes("scripts/verify-state-sync-reanchor-diff.ts"));
  assert.ok(commit?.run?.includes("git switch -c state-sync/reanchor-main"));
  assert.ok(commit?.run?.includes("scripts/verify-state-sync-reanchor-diff.ts --cached"));
  assert.ok(commit?.run?.includes("scripts/run-state-sync-audit.ts --json"));
  assert.equal(push?.id, "push-reanchor");
  assert.ok(push?.run?.includes('echo "pushed_reanchor=false" >> "$GITHUB_OUTPUT"'));
  assert.ok(push?.run?.includes(
    "git fetch origin +refs/heads/main:refs/remotes/origin/main"
  ));
  assert.ok(push?.run?.includes(
    "observed_main_sha=\"$(git rev-parse --verify refs/remotes/origin/main)\""
  ));
  assert.ok(push?.run?.includes('if [ "$observed_main_sha" != "${GITHUB_SHA}" ]; then'));
  assert.ok(push?.run?.includes("skipping stale reanchor push"));
  assert.ok(push?.run?.includes(
    "git fetch origin +refs/heads/state-sync/reanchor-main:refs/remotes/origin/state-sync/reanchor-main || true"
  ));
  assert.ok(push?.run?.includes(
    "expected_reanchor_sha=\"$(git rev-parse --verify refs/remotes/origin/state-sync/reanchor-main 2>/dev/null || true)\""
  ));
  assert.ok(push?.run?.includes(
    "git push --force-with-lease=refs/heads/state-sync/reanchor-main:$expected_reanchor_sha origin HEAD:refs/heads/state-sync/reanchor-main"
  ));
  assert.ok(push?.run?.includes(
    "git push --force-with-lease=refs/heads/state-sync/reanchor-main: origin HEAD:refs/heads/state-sync/reanchor-main"
  ));
  assert.ok(push?.run?.includes('echo "pushed_reanchor=true" >> "$GITHUB_OUTPUT"'));
  assert.ok(!push?.run?.includes("HEAD:refs/heads/main"));
  assert.equal(
    pr?.if,
    "steps.reanchor-gate.outputs.run_reanchor == 'true' && steps.push-reanchor.outputs.pushed_reanchor == 'true'"
  );
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
