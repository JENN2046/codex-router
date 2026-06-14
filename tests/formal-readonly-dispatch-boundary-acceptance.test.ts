import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runFormalReadonlyDispatchBoundaryAcceptance,
  writeFormalReadonlyDispatchBoundaryAcceptanceEvidence,
  type FormalReadonlyDispatchBoundaryAcceptanceEvidence
} from "../scripts/run-formal-readonly-dispatch-boundary-acceptance.js";

const now = "2026-06-15T00:00:00.000Z";
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

test("formal read-only dispatch boundary acceptance requires formal wrapper gates", async () => {
  const evidence = await runFormalReadonlyDispatchBoundaryAcceptance({
    generatedAt: now
  });

  assert.equal(
    evidence.schemaVersion,
    "codex-cli-formal-readonly-dispatch-boundary-acceptance.v1"
  );
  assert.equal(evidence.generatedAt, now);
  assert.equal(evidence.mode, "formal-readonly-dispatch-boundary-local-only");
  assert.deepEqual(evidence.checks, {
    runnerReady: true,
    formalWrapperRequiresRegistry: true,
    formalWrapperRequiresMetadata: true,
    registrySelectionOk: true,
    permitIssued: true,
    formalDispatchOk: true,
    fakeSpawnerUsed: true,
    guardMismatchBlocked: true,
    writeAccessBlocked: true,
    noRealCodexCli: true,
    noWorkspaceWriteExecute: true,
    noLocalCommandExecute: true,
    noProtectedRemoteExecute: true,
    leakCheckPassed: true
  });
  assert.deepEqual(evidence.counters, {
    successSpawnCalls: 1,
    missingRegistrySpawnCalls: 0,
    missingMetadataSpawnCalls: 0,
    guardMismatchSpawnCalls: 0,
    writeAccessSpawnCalls: 0,
    realCodexCliCalls: 0,
    workspaceWriteExecuteCalls: 0,
    localCommandExecuteCalls: 0,
    protectedRemoteExecuteCalls: 0
  });
  assert.ok(evidence.blockingReasons.includes(
    "host_dispatcher_formal_read_only_provider_registry_required"
  ));
  assert.ok(evidence.blockingReasons.includes(
    "host_dispatcher_formal_read_only_provider_metadata_required"
  ));
  assert.ok(evidence.blockingReasons.includes(
    "codex_cli_provider_real_execute_registry_manifest_mismatch"
  ));
  assert.ok(evidence.blockingReasons.includes(
    "runner_result_tool_access_not_read_only"
  ));
  assertSafeEvidence(evidence);
});

test("formal read-only dispatch boundary writer persists safe json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "formal-readonly-dispatch-boundary-"));
  const evidencePath = join(dir, "evidence.json");
  const evidence = await runFormalReadonlyDispatchBoundaryAcceptance({
    generatedAt: now
  });

  await writeFormalReadonlyDispatchBoundaryAcceptanceEvidence(evidence, evidencePath);

  const raw = await readFile(evidencePath, "utf8");
  const parsed = JSON.parse(raw) as FormalReadonlyDispatchBoundaryAcceptanceEvidence;

  assert.equal(parsed.checks.formalDispatchOk, true);
  assert.equal(parsed.checks.formalWrapperRequiresRegistry, true);
  assert.equal(parsed.checks.formalWrapperRequiresMetadata, true);
  assert.equal(parsed.checks.noRealCodexCli, true);
  assert.equal(parsed.checks.noWorkspaceWriteExecute, true);
  assertSafeEvidence(parsed);
});

function assertSafeEvidence(
  evidence: FormalReadonlyDispatchBoundaryAcceptanceEvidence
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
