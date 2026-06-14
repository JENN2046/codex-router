import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runPolicyRegistrySelectionAcceptance,
  writePolicyRegistrySelectionAcceptanceEvidence,
  type PolicyRegistrySelectionAcceptanceEvidence
} from "../scripts/run-policy-registry-selection-acceptance.js";

const now = "2026-06-14T00:00:00.000Z";
const forbiddenMarkers = [
  "execute",
  "invoke",
  "function",
  "secret",
  "token",
  "OPENAI_API_KEY",
  "sk-",
  "Bearer",
  "raw env",
  "raw command",
  "prompt",
  "args",
  "stdout",
  "stderr"
];

test("policy registry selection acceptance produces safe evidence", async () => {
  const evidence = await runPolicyRegistrySelectionAcceptance({
    generatedAt: now
  });

  assert.equal(evidence.schemaVersion, "policy-registry-selection-acceptance.v1");
  assert.equal(evidence.generatedAt, now);
  assert.equal(evidence.mode, "read-only-policy-registry-selection");
  assert.equal(evidence.taskId, "policy-registry-selection-acceptance");
  assert.deepEqual(evidence.checks, {
    routingGrantPresent: true,
    routingGrantManifestHashRecorded: true,
    runnerReadyWithRegistry: true,
    runnerSelectionRecorded: true,
    runnerSelectionOk: true,
    runnerMissingProviderBlocked: true,
    runnerDisabledProviderBlocked: true,
    runnerManifestMismatchBlocked: true,
    dispatcherMissingProviderBlocked: true,
    dispatcherDisabledProviderBlocked: true,
    dispatcherManifestMismatchBlocked: true,
    dispatcherBlockedBeforePlan: true,
    workspaceWriteRemainsBlocked: true,
    noRunPath: true,
    leakCheckPassed: true
  });
  assert.equal(evidence.summary.providerId, "codex-cli");
  assert.equal(evidence.summary.kind, "executor");
  assert.match(evidence.summary.manifestHash, /^[a-f0-9]{64}$/);
  assert.ok(evidence.summary.capabilityCount > 0);
  assert.ok(evidence.summary.sandboxProfileCount > 0);
  assert.ok(evidence.summary.sideEffectClassCount > 0);
  assert.deepEqual(evidence.counters, {
    providerPlanCalls: 0,
    providerSpawnCalls: 0
  });
  assert.ok(evidence.blockingReasons.includes(
    "provider_selection_provider_missing:codex-cli"
  ));
  assert.ok(evidence.blockingReasons.includes(
    "provider_selection_provider_disabled:codex-cli"
  ));
  assert.ok(evidence.blockingReasons.includes(
    "provider_selection_manifest_hash_mismatch"
  ));
  assert.ok(evidence.blockingReasons.includes(
    "runner_result_tool_access_not_read_only"
  ));
  assertSafeEvidence(evidence);
});

test("policy registry selection acceptance writer persists safe json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "policy-registry-selection-acceptance-"));
  const evidencePath = join(dir, "evidence.json");
  const evidence = await runPolicyRegistrySelectionAcceptance({
    generatedAt: now
  });

  await writePolicyRegistrySelectionAcceptanceEvidence(evidence, evidencePath);

  const raw = await readFile(evidencePath, "utf8");
  const parsed = JSON.parse(raw) as PolicyRegistrySelectionAcceptanceEvidence;

  assert.equal(parsed.schemaVersion, "policy-registry-selection-acceptance.v1");
  assert.equal(parsed.checks.runnerSelectionOk, true);
  assert.equal(parsed.checks.dispatcherBlockedBeforePlan, true);
  assert.equal(parsed.checks.noRunPath, true);
  assert.equal(parsed.checks.leakCheckPassed, true);
  assertSafeEvidence(parsed);
});

function assertSafeEvidence(evidence: PolicyRegistrySelectionAcceptanceEvidence): void {
  const serialized = JSON.stringify(evidence);

  for (const marker of forbiddenMarkers) {
    assert.equal(
      serialized.includes(marker),
      false,
      `evidence must omit ${marker}`
    );
  }
}
