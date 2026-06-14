import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runFormalReadonlyProviderIntegrationAcceptance,
  writeFormalReadonlyProviderIntegrationAcceptanceEvidence,
  type FormalReadonlyProviderIntegrationAcceptanceEvidence
} from "../scripts/run-formal-readonly-provider-integration-acceptance.js";

const now = "2026-06-15T00:00:00.000Z";
const forbiddenMarkers = [
  "APPROVE_FORMAL_CODEX_CLI_READONLY_PROVIDER_INTEGRATION_PR_15A",
  "APPROVE_FORMAL_CODEX_CLI_PROVIDER_INTEGRATION",
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

test("PR-15B local document records fake-spawner boundary", async () => {
  const document = await readFile(
    "docs/governance/PR_15B_FORMAL_READONLY_PROVIDER_INTEGRATION_LOCAL.md",
    "utf8"
  );
  const normalized = document.replace(/\s+/g, " ");

  assert.match(
    document,
    /PR_15B_FORMAL_READONLY_PROVIDER_INTEGRATION_LOCAL_RECORDED/
  );
  assert.match(document, /npm run acceptance:formal-readonly-provider-integration/);

  for (const phrase of [
    "This is not a real Codex CLI invocation",
    "does not authorize workspace-write",
    "local command execution",
    "protected remote execution",
    "push, release, or tag"
  ]) {
    assert.match(normalized, new RegExp(escapeRegExp(phrase)));
  }
});

test("formal read-only provider integration runs through fake-spawner dispatch", async () => {
  const evidence = await runFormalReadonlyProviderIntegrationAcceptance({
    generatedAt: now
  });

  assert.equal(
    evidence.schemaVersion,
    "codex-cli-formal-readonly-provider-integration-acceptance.v1"
  );
  assert.equal(evidence.generatedAt, now);
  assert.equal(
    evidence.mode,
    "formal-readonly-provider-integration-fake-spawner-local-only"
  );
  assert.equal(
    evidence.taskId,
    "codex-cli-formal-readonly-provider-integration-acceptance"
  );
  assert.deepEqual(evidence.checks, {
    taskbookGateAccepted: true,
    pr14ReadinessPassed: true,
    pr14AuthorizationPassed: true,
    runnerReady: true,
    registrySelectionOk: true,
    permitIssued: true,
    dispatchOk: true,
    fakeSpawnerUsed: true,
    injectedSpawnerGuarded: true,
    guardMissingBlocked: true,
    registryMismatchBlocked: true,
    writeAccessBlocked: true,
    noRealCodexCli: true,
    noWorkspaceWriteExecute: true,
    noLocalCommandExecute: true,
    noProtectedRemoteExecute: true,
    leakCheckPassed: true
  });
  assert.equal(evidence.summary.providerId, "codex-cli");
  assert.match(evidence.summary.manifestHash, /^[a-f0-9]{64}$/);
  assert.equal(evidence.summary.sideEffectClass, "read_only");
  assert.equal(evidence.summary.sandbox, "read-only");
  assert.equal(evidence.summary.status, "completed");
  assert.equal(evidence.summary.formalProviderDispatchCalls, 1);
  assert.equal(evidence.summary.fakeSpawnerCalls, 1);
  assert.deepEqual(evidence.counters, {
    fakeSpawnerSuccessCalls: 1,
    guardMissingSpawnCalls: 0,
    registryMismatchSpawnCalls: 0,
    writeAccessSpawnCalls: 0,
    realCodexCliCalls: 0,
    workspaceWriteExecuteCalls: 0,
    localCommandExecuteCalls: 0,
    protectedRemoteExecuteCalls: 0
  });
  assert.ok(evidence.blockingReasons.includes(
    "codex_cli_provider_real_execute_guard_missing"
  ));
  assert.ok(evidence.blockingReasons.includes(
    "codex_cli_provider_real_execute_registry_manifest_mismatch"
  ));
  assertSafeEvidence(evidence);
});

test("formal read-only provider integration evidence writer persists safe json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "formal-readonly-provider-integration-"));
  const evidencePath = join(dir, "evidence.json");
  const evidence = await runFormalReadonlyProviderIntegrationAcceptance({
    generatedAt: now
  });

  await writeFormalReadonlyProviderIntegrationAcceptanceEvidence(
    evidence,
    evidencePath
  );

  const raw = await readFile(evidencePath, "utf8");
  const parsed = JSON.parse(raw) as FormalReadonlyProviderIntegrationAcceptanceEvidence;

  assert.equal(parsed.checks.dispatchOk, true);
  assert.equal(parsed.checks.fakeSpawnerUsed, true);
  assert.equal(parsed.checks.noRealCodexCli, true);
  assert.equal(parsed.checks.noWorkspaceWriteExecute, true);
  assert.equal(parsed.checks.leakCheckPassed, true);
  assertSafeEvidence(parsed);
});

function assertSafeEvidence(
  evidence: FormalReadonlyProviderIntegrationAcceptanceEvidence
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
