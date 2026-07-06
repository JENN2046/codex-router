import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PR_12B_REAL_CANARY_ALLOWED_ACTION,
  PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
  PR_12B_REAL_CANARY_WORKSPACE,
  WORKSPACE_WRITE_REAL_CANARY_CONFIG_ENV
} from "../packages/governance-internal-workspace-write-guard/src/index.js";
import {
  runWorkspaceWriteRealCanaryPreExecutionAcceptance,
  writeWorkspaceWriteRealCanaryPreExecutionAcceptanceEvidence,
  type WorkspaceWriteRealCanaryPreExecutionAcceptanceEvidence
} from "../scripts/run-workspace-write-real-canary-pre-execution-acceptance.js";

const now = "2026-06-14T00:00:00.000Z";
const forbiddenMarkers = [
  PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
  PR_12B_REAL_CANARY_WORKSPACE,
  PR_12B_REAL_CANARY_ALLOWED_ACTION,
  "requestedAction",
  "prompt",
  "args",
  "stdout",
  "stderr",
  "raw command",
  "raw task envelope",
  "raw env",
  "raw token",
  "raw patch",
  "OPENAI_API_KEY",
  "sk-",
  "Bearer",
  "APPROVE_WORKSPACE_WRITE",
  "canary=ready"
];

test("workspace-write real canary pre-execution acceptance stays local-only", async () => {
  const evidence = await runWorkspaceWriteRealCanaryPreExecutionAcceptance({
    generatedAt: now
  });

  assert.equal(
    evidence.schemaVersion,
    "workspace-write-real-canary-pre-execution-acceptance.v1"
  );
  assert.equal(evidence.generatedAt, now);
  assert.equal(evidence.mode, "workspace-write-real-canary-pre-execution-local-only");
  assert.equal(evidence.taskId, "workspace-write-real-canary-pre-execution-acceptance");
  assert.deepEqual(evidence.checks, {
    authorizationAccepted: true,
    canaryReadinessReady: true,
    preExecutionGateReady: true,
    authorizationFailureBlocksGate: true,
    readinessFailureBlocksGate: true,
    existingCanaryFileBlocksGate: true,
    canaryFileAbsentBeforeAndAfter: true,
    noProviderExecute: true,
    noRealCodexCli: true,
    noWorkspaceWriteExecute: true,
    noCanaryFileWrite: true,
    leakCheckPassed: true
  });
  assert.equal(evidence.summary.providerId, "codex-cli");
  assert.match(evidence.summary.manifestHash, /^[a-f0-9]{64}$/);
  assert.equal(evidence.summary.targetFile, "tmp/codex-cli-write-canary.txt");
  assert.equal(evidence.summary.sideEffectClass, "workspace_write");
  assert.equal(evidence.summary.sandbox, "workspace-write");
  assert.equal(evidence.summary.authorizationStatus, "authorized");
  assert.equal(evidence.summary.readinessStatus, "ready");
  assert.equal(evidence.summary.gateStatus, "ready");
  assert.equal(evidence.summary.pushDisallowed, true);
  assert.equal(evidence.summary.rollbackReady, true);
  assert.deepEqual(evidence.counters, {
    providerExecuteCalls: 0,
    realCodexCliCalls: 0,
    workspaceWriteExecuteCalls: 0,
    canaryFileWrites: 0
  });
  assert.ok(evidence.blockingReasons.includes(
    "workspace_write_real_canary_pre_execution_authorization_blocked"
  ));
  assert.ok(evidence.blockingReasons.includes(
    "workspace_write_real_canary_pre_execution_readiness_blocked"
  ));
  assert.ok(evidence.blockingReasons.includes(
    "workspace_write_real_canary_pre_execution_canary_file_must_be_absent"
  ));
  assertSafeEvidence(evidence);
});

test("workspace-write real canary pre-execution acceptance writer persists safe json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "workspace-write-real-canary-pre-execution-"));
  const evidencePath = join(dir, "evidence.json");
  const evidence = await runWorkspaceWriteRealCanaryPreExecutionAcceptance({
    generatedAt: now
  });

  await writeWorkspaceWriteRealCanaryPreExecutionAcceptanceEvidence(
    evidence,
    evidencePath
  );

  const raw = await readFile(evidencePath, "utf8");
  const parsed = JSON.parse(raw) as WorkspaceWriteRealCanaryPreExecutionAcceptanceEvidence;

  assert.equal(
    parsed.schemaVersion,
    "workspace-write-real-canary-pre-execution-acceptance.v1"
  );
  assert.equal(parsed.checks.preExecutionGateReady, true);
  assert.equal(parsed.checks.noWorkspaceWriteExecute, true);
  assert.equal(parsed.checks.noRealCodexCli, true);
  assert.equal(parsed.checks.noCanaryFileWrite, true);
  assert.equal(parsed.checks.leakCheckPassed, true);
  assertSafeEvidence(parsed);
});

test("workspace-write real canary pre-execution acceptance reads canary config from env", async () => {
  const evidence = await runWorkspaceWriteRealCanaryPreExecutionAcceptance({
    generatedAt: now,
    env: {
      [WORKSPACE_WRITE_REAL_CANARY_CONFIG_ENV.targetFile]: "tmp/configured-pre-canary.txt",
      [WORKSPACE_WRITE_REAL_CANARY_CONFIG_ENV.workspace]: "D:/configured/pre-repo",
      [WORKSPACE_WRITE_REAL_CANARY_CONFIG_ENV.branch]: "canary/pre",
      [WORKSPACE_WRITE_REAL_CANARY_CONFIG_ENV.allowedAction]: "one configured pre canary write"
    }
  });
  const serialized = JSON.stringify(evidence);

  assert.equal(evidence.checks.authorizationAccepted, true);
  assert.equal(evidence.checks.canaryReadinessReady, true);
  assert.equal(evidence.checks.preExecutionGateReady, true);
  assert.equal(evidence.summary.targetFile, "tmp/configured-pre-canary.txt");
  assert.equal(serialized.includes("D:/configured/pre-repo"), false);
  assert.equal(serialized.includes("one configured pre canary write"), false);
});

function assertSafeEvidence(
  evidence: WorkspaceWriteRealCanaryPreExecutionAcceptanceEvidence
): void {
  const serialized = JSON.stringify(evidence);

  for (const marker of forbiddenMarkers) {
    assert.equal(
      serialized.includes(marker),
      false,
      `evidence must omit ${marker}`
    );
  }
}
