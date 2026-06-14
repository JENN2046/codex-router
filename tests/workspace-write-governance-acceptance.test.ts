import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runWorkspaceWriteGovernanceAcceptance,
  writeWorkspaceWriteGovernanceAcceptanceEvidence,
  type WorkspaceWriteGovernanceAcceptanceEvidence
} from "../scripts/run-workspace-write-governance-acceptance.js";

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
  "old line",
  "new line",
  "const fixture"
];

test("workspace-write governance acceptance produces safe local-only evidence", async () => {
  const evidence = await runWorkspaceWriteGovernanceAcceptance({
    generatedAt: now
  });

  assert.equal(evidence.schemaVersion, "workspace-write-governance-acceptance.v1");
  assert.equal(evidence.generatedAt, now);
  assert.equal(evidence.mode, "workspace-write-governance-local-only");
  assert.equal(evidence.taskId, "workspace-write-governance-acceptance");
  assert.deepEqual(evidence.checks, {
    approvedPermitCreated: true,
    blockedPermitRejected: true,
    legacyReadOnlyPermitStillRejectsWorkspaceWrite: true,
    patchGuardPassed: true,
    patchGuardBlocksFileCount: true,
    patchGuardBlocksDiffLines: true,
    patchGuardBlocksOutOfBounds: true,
    patchGuardBlocksSecretLikeContent: true,
    rollbackEvidenceReady: true,
    rollbackEvidenceBlocksMissingBeforeCommit: true,
    noProviderExecute: true,
    noRealCodexCli: true,
    noWorkspaceWriteExecute: true,
    leakCheckPassed: true
  });
  assert.equal(evidence.summary.providerId, "codex-cli");
  assert.match(evidence.summary.manifestHash, /^[a-f0-9]{64}$/);
  assert.match(evidence.summary.patchHash, /^[a-f0-9]{64}$/);
  assert.equal(evidence.summary.sideEffectClass, "workspace_write");
  assert.equal(evidence.summary.sandbox, "workspace-write");
  assert.equal(evidence.summary.targetFileCount, 1);
  assert.equal(evidence.summary.changedFileCount, 1);
  assert.equal(evidence.summary.diffLineCount, 2);
  assert.equal(evidence.summary.rollbackAvailable, true);
  assert.deepEqual(evidence.counters, {
    providerExecuteCalls: 0,
    realCodexCliCalls: 0,
    workspaceWriteExecuteCalls: 0
  });
  assert.ok(evidence.blockingReasons.includes(
    "workspace_write_provider_execution_permit_operator_authorization_required"
  ));
  assert.ok(evidence.blockingReasons.includes(
    "workspace_write_patch_guard_changed_files_exceed_max"
  ));
  assert.ok(evidence.blockingReasons.includes(
    "workspace_write_patch_guard_secret_like_content"
  ));
  assert.ok(evidence.blockingReasons.includes(
    "workspace_write_rollback_plan_before_commit_required"
  ));
  assertSafeEvidence(evidence);
});

test("workspace-write governance acceptance writer persists safe json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "workspace-write-governance-acceptance-"));
  const evidencePath = join(dir, "evidence.json");
  const evidence = await runWorkspaceWriteGovernanceAcceptance({
    generatedAt: now
  });

  await writeWorkspaceWriteGovernanceAcceptanceEvidence(evidence, evidencePath);

  const raw = await readFile(evidencePath, "utf8");
  const parsed = JSON.parse(raw) as WorkspaceWriteGovernanceAcceptanceEvidence;

  assert.equal(parsed.schemaVersion, "workspace-write-governance-acceptance.v1");
  assert.equal(parsed.checks.patchGuardPassed, true);
  assert.equal(parsed.checks.rollbackEvidenceReady, true);
  assert.equal(parsed.checks.noWorkspaceWriteExecute, true);
  assert.equal(parsed.checks.leakCheckPassed, true);
  assertSafeEvidence(parsed);
});

function assertSafeEvidence(evidence: WorkspaceWriteGovernanceAcceptanceEvidence): void {
  const serialized = JSON.stringify(evidence);

  for (const marker of forbiddenMarkers) {
    assert.equal(
      serialized.includes(marker),
      false,
      `evidence must omit ${marker}`
    );
  }
}
