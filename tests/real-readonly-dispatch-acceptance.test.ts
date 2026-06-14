import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runRealReadOnlyDispatchAcceptance,
  writeRealReadOnlyDispatchAcceptanceEvidence,
  type RealReadOnlyDispatchAcceptanceEvidence
} from "../scripts/run-real-readonly-dispatch-acceptance.js";

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
  "Bearer"
];

test("real read-only dispatch acceptance produces safe fake-only evidence", async () => {
  const evidence = await runRealReadOnlyDispatchAcceptance({
    generatedAt: now
  });

  assert.equal(evidence.schemaVersion, "codex-cli-real-readonly-dispatch-acceptance.v1");
  assert.equal(evidence.generatedAt, now);
  assert.equal(evidence.mode, "real-readonly-provider-dispatch-fake");
  assert.equal(evidence.taskId, "codex-cli-real-readonly-dispatch-acceptance");
  assert.deepEqual(evidence.checks, {
    runnerReady: true,
    registrySelectionOk: true,
    realModeGuardProvided: true,
    permitIssued: true,
    dispatchOk: true,
    fakeSpawnerUsed: true,
    injectedSpawnerGuarded: true,
    guardMissingBlocked: true,
    registryMismatchBlocked: true,
    workspaceWriteBlocked: true,
    noRealCodexCli: true,
    leakCheckPassed: true
  });
  assert.equal(evidence.summary.providerId, "codex-cli");
  assert.match(evidence.summary.manifestHash, /^[a-f0-9]{64}$/);
  assert.equal(evidence.summary.sideEffectClass, "read_only");
  assert.equal(evidence.summary.sandbox, "read-only");
  assert.equal(evidence.summary.status, "completed");
  assert.equal(evidence.summary.eventCount, 1);
  assert.deepEqual(evidence.counters, {
    successSpawnCalls: 1,
    guardMissingSpawnCalls: 0,
    registryMismatchSpawnCalls: 0,
    workspaceWriteSpawnCalls: 0
  });
  assert.ok(evidence.blockingReasons.includes(
    "codex_cli_provider_real_execute_guard_missing"
  ));
  assert.ok(evidence.blockingReasons.includes(
    "codex_cli_provider_real_execute_registry_manifest_mismatch"
  ));
  assert.ok(evidence.blockingReasons.includes(
    "runner_result_tool_access_not_read_only"
  ));
  assertSafeEvidence(evidence);
});

test("real read-only dispatch acceptance writer persists safe json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "real-readonly-dispatch-acceptance-"));
  const evidencePath = join(dir, "evidence.json");
  const evidence = await runRealReadOnlyDispatchAcceptance({
    generatedAt: now
  });

  await writeRealReadOnlyDispatchAcceptanceEvidence(evidence, evidencePath);

  const raw = await readFile(evidencePath, "utf8");
  const parsed = JSON.parse(raw) as RealReadOnlyDispatchAcceptanceEvidence;

  assert.equal(parsed.schemaVersion, "codex-cli-real-readonly-dispatch-acceptance.v1");
  assert.equal(parsed.checks.dispatchOk, true);
  assert.equal(parsed.checks.noRealCodexCli, true);
  assert.equal(parsed.checks.leakCheckPassed, true);
  assertSafeEvidence(parsed);
});

function assertSafeEvidence(evidence: RealReadOnlyDispatchAcceptanceEvidence): void {
  const serialized = JSON.stringify(evidence);

  for (const marker of forbiddenMarkers) {
    assert.equal(
      serialized.includes(marker),
      false,
      `evidence must omit ${marker}`
    );
  }
}
