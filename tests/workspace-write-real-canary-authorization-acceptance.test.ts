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
} from "../packages/workspace-write-guard/src/index.js";
import {
  runWorkspaceWriteRealCanaryAuthorizationAcceptance,
  writeWorkspaceWriteRealCanaryAuthorizationAcceptanceEvidence,
  type WorkspaceWriteRealCanaryAuthorizationAcceptanceEvidence
} from "../scripts/run-workspace-write-real-canary-authorization-acceptance.js";

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
  "A:/other/repo",
  "tmp/not-the-canary.txt",
  "general workspace write"
];

test("workspace-write real canary authorization acceptance stays local-only", async () => {
  const evidence = await runWorkspaceWriteRealCanaryAuthorizationAcceptance({
    generatedAt: now
  });

  assert.equal(
    evidence.schemaVersion,
    "workspace-write-real-canary-authorization-acceptance.v1"
  );
  assert.equal(evidence.generatedAt, now);
  assert.equal(evidence.mode, "workspace-write-real-canary-authorization-local-only");
  assert.equal(evidence.taskId, "workspace-write-real-canary-authorization-acceptance");
  assert.deepEqual(evidence.checks, {
    exactAuthorizationAccepted: true,
    missingAuthorizationBlocked: true,
    broadenedAuthorizationBlocked: true,
    pushAuthorizationRejected: true,
    canaryFileAbsentBeforeAndAfter: true,
    noProviderExecute: true,
    noRealCodexCli: true,
    noWorkspaceWriteExecute: true,
    noCanaryFileWrite: true,
    leakCheckPassed: true
  });
  assert.equal(evidence.summary.targetFile, "tmp/codex-cli-write-canary.txt");
  assert.equal(evidence.summary.branch, "main");
  assert.equal(evidence.summary.requiredSandbox, "workspace-write");
  assert.equal(evidence.summary.requiredRollback, true);
  assert.equal(evidence.summary.pushMustBeSeparate, true);
  assert.equal(evidence.summary.exactPhraseMatched, true);
  assert.equal(evidence.summary.workspaceMatched, true);
  assert.equal(evidence.summary.fixedTargetMatched, true);
  assert.equal(evidence.summary.boundedActionMatched, true);
  assert.deepEqual(evidence.counters, {
    providerExecuteCalls: 0,
    realCodexCliCalls: 0,
    workspaceWriteExecuteCalls: 0,
    canaryFileWrites: 0
  });
  assert.ok(evidence.blockingReasons.includes(
    "workspace_write_real_canary_authorization_exact_phrase_required"
  ));
  assert.ok(evidence.blockingReasons.includes(
    "workspace_write_real_canary_authorization_workspace_write_sandbox_required"
  ));
  assert.ok(evidence.blockingReasons.includes(
    "workspace_write_real_canary_authorization_push_must_be_separate"
  ));
  assertSafeEvidence(evidence);
});

test("workspace-write real canary authorization acceptance writer persists safe json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "workspace-write-real-canary-auth-"));
  const evidencePath = join(dir, "evidence.json");
  const evidence = await runWorkspaceWriteRealCanaryAuthorizationAcceptance({
    generatedAt: now
  });

  await writeWorkspaceWriteRealCanaryAuthorizationAcceptanceEvidence(
    evidence,
    evidencePath
  );

  const raw = await readFile(evidencePath, "utf8");
  const parsed = JSON.parse(raw) as WorkspaceWriteRealCanaryAuthorizationAcceptanceEvidence;

  assert.equal(
    parsed.schemaVersion,
    "workspace-write-real-canary-authorization-acceptance.v1"
  );
  assert.equal(parsed.checks.exactAuthorizationAccepted, true);
  assert.equal(parsed.checks.broadenedAuthorizationBlocked, true);
  assert.equal(parsed.checks.noWorkspaceWriteExecute, true);
  assert.equal(parsed.checks.noRealCodexCli, true);
  assert.equal(parsed.checks.leakCheckPassed, true);
  assertSafeEvidence(parsed);
});

test("workspace-write real canary authorization acceptance reads canary config from env", async () => {
  const evidence = await runWorkspaceWriteRealCanaryAuthorizationAcceptance({
    generatedAt: now,
    env: {
      [WORKSPACE_WRITE_REAL_CANARY_CONFIG_ENV.targetFile]: "tmp/configured-auth-canary.txt",
      [WORKSPACE_WRITE_REAL_CANARY_CONFIG_ENV.workspace]: "D:/configured/auth-repo",
      [WORKSPACE_WRITE_REAL_CANARY_CONFIG_ENV.branch]: "canary/auth",
      [WORKSPACE_WRITE_REAL_CANARY_CONFIG_ENV.allowedAction]: "one configured auth canary write"
    }
  });
  const serialized = JSON.stringify(evidence);

  assert.equal(evidence.checks.exactAuthorizationAccepted, true);
  assert.equal(evidence.summary.targetFile, "tmp/configured-auth-canary.txt");
  assert.equal(evidence.summary.branch, "canary/auth");
  assert.equal(evidence.summary.workspaceMatched, true);
  assert.equal(evidence.summary.fixedTargetMatched, true);
  assert.equal(evidence.summary.boundedActionMatched, true);
  assert.equal(serialized.includes("D:/configured/auth-repo"), false);
  assert.equal(serialized.includes("one configured auth canary write"), false);
});

function assertSafeEvidence(
  evidence: WorkspaceWriteRealCanaryAuthorizationAcceptanceEvidence
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
