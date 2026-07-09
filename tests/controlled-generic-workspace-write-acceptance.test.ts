import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runControlledGenericWorkspaceWriteAcceptance,
  runControlledGenericWorkspaceWriteAcceptanceCli,
  writeControlledGenericWorkspaceWriteAcceptanceEvidence,
  type ControlledGenericWorkspaceWriteAcceptanceEvidence
} from "../scripts/run-controlled-generic-workspace-write-acceptance.js";

const now = "2026-07-10T00:00:00.000Z";
const forbiddenMarkers = [
  "created controlled generic workspace write",
  "updated controlled generic workspace write",
  "initial edit value",
  "initial delete value",
  "stdout",
  "stderr",
  "raw command",
  "raw env",
  "raw patch",
  "OPENAI_API_KEY",
  "sk-",
  "Bearer"
];

test("controlled generic workspace-write acceptance covers local runner execution", async () => {
  const evidence = await runControlledGenericWorkspaceWriteAcceptance({
    generatedAt: now
  });

  assert.equal(evidence.schemaVersion, "controlled-generic-workspace-write-acceptance.v1");
  assert.equal(evidence.generatedAt, now);
  assert.equal(evidence.mode, "controlled-generic-workspace-write-local-runner");
  assert.equal(evidence.taskId, "controlled-generic-workspace-write-acceptance");
  assert.deepEqual(evidence.checks, {
    preflightReadyWithoutMutation: true,
    executeSucceeded: true,
    createUpdateDeleteCovered: true,
    permitConsumedOnce: true,
    replayBlocked: true,
    patchGuardPassed: true,
    rollbackVerified: true,
    worktreeCleanAfterExecution: true,
    createdFileRolledBack: true,
    updatedFileRestored: true,
    deletedFileRestored: true,
    wroteOnlyPermittedTargets: true,
    noProviderExecute: true,
    noRealCodexCli: true,
    noExternalWrite: true,
    evidenceSanitized: true
  });
  assert.equal(evidence.summary.providerId, "local-workspace-write-executor");
  assert.equal(evidence.summary.sideEffectClass, "workspace_write");
  assert.equal(evidence.summary.sandbox, "workspace-write");
  assert.deepEqual(evidence.summary.operationKinds, ["write", "write", "delete"]);
  assert.equal(evidence.summary.maxChangedFiles, 3);
  assert.equal(evidence.summary.changedFileCount, 3);
  assert.equal(evidence.summary.preflightStatus, "ready");
  assert.equal(evidence.summary.executionStatus, "passed");
  assert.equal(evidence.summary.replayStatus, "blocked");
  assert.match(evidence.summary.manifestHash, /^[a-f0-9]{64}$/);
  assert.match(evidence.summary.expectedPatchHash ?? "", /^[a-f0-9]{64}$/);
  assert.match(evidence.summary.actualPatchHash ?? "", /^[a-f0-9]{64}$/);
  assert.deepEqual(evidence.counters, {
    preflightWorkspaceWriteExecuteCalls: 0,
    executionWorkspaceWriteExecuteCalls: 1,
    replayWorkspaceWriteExecuteCalls: 0,
    fileWriteCalls: 2,
    fileDeleteCalls: 1,
    providerExecuteCalls: 0,
    realCodexCliCalls: 0,
    externalWriteCalls: 0
  });
  assert.ok(
    evidence.blockingReasons.includes(
      "workspace_write_execution_permit_v2_already_consumed_by_store"
    )
  );
  assertSafeEvidence(evidence);
});

test("controlled generic workspace-write acceptance check mode does not write evidence", async () => {
  const dir = await mkdtemp(join(tmpdir(), "controlled-generic-ww-check-"));
  const evidencePath = join(dir, "evidence.json");
  const result = await runControlledGenericWorkspaceWriteAcceptanceCli([
    "--check",
    "--output",
    evidencePath
  ]);

  assert.equal(result.checkMode, true);
  assert.equal(result.evidencePath, undefined);
  assert.equal(existsSync(evidencePath), false);
  assert.equal(result.evidence.checks.executeSucceeded, true);
  assert.equal(result.evidence.checks.rollbackVerified, true);
  assertSafeEvidence(result.evidence);
});

test("controlled generic workspace-write acceptance writer persists safe json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "controlled-generic-ww-acceptance-"));
  const evidencePath = join(dir, "evidence.json");
  const evidence = await runControlledGenericWorkspaceWriteAcceptance({
    generatedAt: now
  });

  await writeControlledGenericWorkspaceWriteAcceptanceEvidence(evidence, evidencePath);

  const raw = await readFile(evidencePath, "utf8");
  const parsed = JSON.parse(raw) as ControlledGenericWorkspaceWriteAcceptanceEvidence;

  assert.equal(parsed.schemaVersion, "controlled-generic-workspace-write-acceptance.v1");
  assert.equal(parsed.checks.createUpdateDeleteCovered, true);
  assert.equal(parsed.checks.permitConsumedOnce, true);
  assert.equal(parsed.checks.replayBlocked, true);
  assert.equal(parsed.checks.rollbackVerified, true);
  assert.equal(parsed.checks.evidenceSanitized, true);
  assertSafeEvidence(parsed);
});

function assertSafeEvidence(evidence: ControlledGenericWorkspaceWriteAcceptanceEvidence): void {
  const serialized = JSON.stringify(evidence);

  for (const marker of forbiddenMarkers) {
    assert.equal(serialized.includes(marker), false, `evidence must omit ${marker}`);
  }
}
