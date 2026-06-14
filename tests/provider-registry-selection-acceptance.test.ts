import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runProviderRegistrySelectionAcceptance,
  writeProviderRegistrySelectionAcceptanceEvidence,
  type ProviderRegistrySelectionAcceptanceEvidence
} from "../scripts/run-provider-registry-selection-acceptance.js";

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

test("provider registry selection acceptance produces evidence object", async () => {
  const evidence = await runProviderRegistrySelectionAcceptance({
    generatedAt: now
  });

  assert.equal(evidence.schemaVersion, "provider-registry-selection-acceptance.v1");
  assert.equal(evidence.generatedAt, now);
  assert.equal(evidence.mode, "read-only-registry-selection");
  assert.equal(evidence.providerCount, 2);
  assert.equal(evidence.enabledProviderCount, 1);
  assert.equal(evidence.checks.codexCliRegistered, true);
  assert.equal(evidence.checks.attestationHashRecorded, true);
  assert.equal(evidence.checks.snapshotGenerated, true);
  assert.equal(evidence.checks.selectByProviderIdOk, true);
  assert.equal(evidence.checks.selectByGrantOk, true);
  assert.equal(evidence.checks.missingProviderBlocked, true);
  assert.equal(evidence.checks.disabledProviderBlockedByDefault, true);
  assert.equal(evidence.checks.manifestMismatchBlocked, true);
  assert.equal(evidence.checks.missingCapabilityBlocked, true);
  assert.equal(evidence.checks.unsupportedSandboxBlocked, true);
  assert.equal(evidence.checks.unsupportedSideEffectBlocked, true);
  assert.equal(evidence.checks.noRunPath, true);
  assert.equal(evidence.checks.leakCheckPassed, true);
  assert.equal(evidence.summary.providerId, "codex-cli");
  assert.match(evidence.summary.manifestHash, /^[a-f0-9]{64}$/);
  assertSafeEvidence(evidence);
});

test("provider registry selection acceptance writer persists safe json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "provider-registry-selection-acceptance-"));
  const evidencePath = join(dir, "evidence.json");
  const evidence = await runProviderRegistrySelectionAcceptance({
    generatedAt: now
  });

  await writeProviderRegistrySelectionAcceptanceEvidence(evidence, evidencePath);

  const raw = await readFile(evidencePath, "utf8");
  const parsed = JSON.parse(raw) as ProviderRegistrySelectionAcceptanceEvidence;

  assert.equal(parsed.schemaVersion, "provider-registry-selection-acceptance.v1");
  assert.equal(parsed.checks.selectByProviderIdOk, true);
  assert.equal(parsed.checks.selectByGrantOk, true);
  assert.equal(parsed.checks.leakCheckPassed, true);
  assertSafeEvidence(parsed);
});

function assertSafeEvidence(evidence: ProviderRegistrySelectionAcceptanceEvidence): void {
  const serialized = JSON.stringify(evidence);

  for (const marker of forbiddenMarkers) {
    assert.equal(
      serialized.includes(marker),
      false,
      `evidence must omit ${marker}`
    );
  }
}
