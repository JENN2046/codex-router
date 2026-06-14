import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runWorkspaceWriteFakeCanaryAcceptance,
  writeWorkspaceWriteFakeCanaryAcceptanceEvidence,
  type WorkspaceWriteFakeCanaryAcceptanceEvidence
} from "../scripts/run-workspace-write-fake-canary-acceptance.js";

const now = "2026-06-14T00:00:00.000Z";
const forbiddenMarkers = [
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
  "canary=ready",
  "canary=wrong-target"
];

test("workspace-write fake canary acceptance proves fixed target without execution", async () => {
  const evidence = await runWorkspaceWriteFakeCanaryAcceptance({
    generatedAt: now
  });

  assert.equal(evidence.schemaVersion, "workspace-write-fake-canary-acceptance.v1");
  assert.equal(evidence.generatedAt, now);
  assert.equal(evidence.mode, "workspace-write-fake-canary-local-only");
  assert.equal(evidence.taskId, "workspace-write-fake-canary-acceptance");
  assert.deepEqual(evidence.checks, {
    fixedCanaryTarget: true,
    approvedPermitCreated: true,
    nonCanaryTargetRejected: true,
    patchGuardPassedForCanaryDiff: true,
    patchGuardBlocksNonCanaryDiff: true,
    rollbackEvidenceReady: true,
    canaryFileAbsentBeforeAndAfter: true,
    noProviderExecute: true,
    noRealCodexCli: true,
    noWorkspaceWriteExecute: true,
    leakCheckPassed: true
  });
  assert.equal(evidence.summary.providerId, "codex-cli");
  assert.match(evidence.summary.manifestHash, /^[a-f0-9]{64}$/);
  assert.equal(evidence.summary.targetFile, "tmp/codex-cli-write-canary.txt");
  assert.equal(evidence.summary.sideEffectClass, "workspace_write");
  assert.equal(evidence.summary.sandbox, "workspace-write");
  assert.equal(evidence.summary.maxChangedFiles, 1);
  assert.equal(evidence.summary.maxDiffLines, 2);
  assert.match(evidence.summary.patchHash, /^[a-f0-9]{64}$/);
  assert.equal(evidence.summary.changedFileCount, 1);
  assert.equal(evidence.summary.diffLineCount, 1);
  assert.equal(evidence.summary.rollbackAvailable, true);
  assert.deepEqual(evidence.counters, {
    providerExecuteCalls: 0,
    realCodexCliCalls: 0,
    workspaceWriteExecuteCalls: 0,
    canaryFileWrites: 0
  });
  assert.ok(evidence.blockingReasons.includes("workspace_write_fake_canary_target_mismatch"));
  assert.ok(evidence.blockingReasons.includes(
    "workspace_write_patch_guard_changed_file_not_permitted:tmp/not-the-canary.txt"
  ));
  assertSafeEvidence(evidence);
});

test("workspace-write fake canary acceptance writer persists safe json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "workspace-write-fake-canary-acceptance-"));
  const evidencePath = join(dir, "evidence.json");
  const evidence = await runWorkspaceWriteFakeCanaryAcceptance({
    generatedAt: now
  });

  await writeWorkspaceWriteFakeCanaryAcceptanceEvidence(evidence, evidencePath);

  const raw = await readFile(evidencePath, "utf8");
  const parsed = JSON.parse(raw) as WorkspaceWriteFakeCanaryAcceptanceEvidence;

  assert.equal(parsed.schemaVersion, "workspace-write-fake-canary-acceptance.v1");
  assert.equal(parsed.checks.fixedCanaryTarget, true);
  assert.equal(parsed.checks.noWorkspaceWriteExecute, true);
  assert.equal(parsed.checks.noRealCodexCli, true);
  assert.equal(parsed.checks.leakCheckPassed, true);
  assertSafeEvidence(parsed);
});

function assertSafeEvidence(evidence: WorkspaceWriteFakeCanaryAcceptanceEvidence): void {
  const serialized = JSON.stringify(evidence);

  for (const marker of forbiddenMarkers) {
    assert.equal(
      serialized.includes(marker),
      false,
      `evidence must omit ${marker}`
    );
  }
}
