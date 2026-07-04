import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runReadOnlyControlChainAcceptance,
  runReadOnlyControlChainAcceptanceCli,
  writeReadOnlyControlChainAcceptanceEvidence,
  type ReadOnlyControlChainAcceptanceEvidence
} from "../scripts/run-readonly-control-chain-acceptance.js";

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
  "raw patch"
];

test("read-only control chain acceptance produces safe evidence", async () => {
  const evidence = await runReadOnlyControlChainAcceptance({
    generatedAt: now,
    commit: "test_commit"
  });

  assert.equal(evidence.schemaVersion, "read-only-control-chain-acceptance.v1");
  assert.equal(evidence.generatedAt, now);
  assert.equal(evidence.mode, "fake-readonly");
  assert.equal(evidence.taskId, "read-only-control-chain-acceptance");
  assert.equal(evidence.summary.providerId, "codex-cli");
  assert.equal(evidence.summary.sideEffectClass, "read_only");
  assert.equal(evidence.summary.sandbox, "read-only");
  assert.equal(evidence.summary.eventCount, 0);
  assert.deepEqual(evidence.checks, {
    runnerReady: true,
    preflightOk: true,
    approvalResolved: true,
    hostRouteCodexCli: true,
    toolAccessReadOnly: true,
    providerGrantPresent: true,
    permitIssued: true,
    dispatchOk: true,
    dryRunNoSpawn: true,
    workspaceWriteBlocked: true,
    providerGrantMissingBlocked: true,
    approvalPendingBlocked: true,
    preflightFailedBlocked: true,
    leakCheckPassed: true
  });
  assertSafeEvidence(evidence);
});

test("read-only control chain acceptance writer persists safe json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "readonly-chain-acceptance-"));
  const evidencePath = join(dir, "evidence.json");
  const evidence = await runReadOnlyControlChainAcceptance({
    generatedAt: now
  });

  await writeReadOnlyControlChainAcceptanceEvidence(evidence, evidencePath);

  const raw = await readFile(evidencePath, "utf8");
  const parsed = JSON.parse(raw) as ReadOnlyControlChainAcceptanceEvidence;

  assert.equal(parsed.schemaVersion, "read-only-control-chain-acceptance.v1");
  assert.equal(parsed.checks.dispatchOk, true);
  assert.equal(parsed.checks.leakCheckPassed, true);
  assertSafeEvidence(parsed);
});

test("read-only control chain acceptance check mode does not write evidence", async () => {
  const dir = await mkdtemp(join(tmpdir(), "readonly-chain-check-"));
  const evidencePath = join(dir, "evidence.json");

  const result = await runReadOnlyControlChainAcceptanceCli([
    "--check",
    "--output",
    evidencePath
  ]);

  assert.equal(result.checkMode, true);
  assert.equal(result.evidencePath, undefined);
  assert.equal(result.evidence.checks.dispatchOk, true);
  await assert.rejects(access(evidencePath));
});

function assertSafeEvidence(evidence: ReadOnlyControlChainAcceptanceEvidence): void {
  const serialized = JSON.stringify(evidence);

  for (const marker of forbiddenMarkers) {
    assert.equal(
      serialized.includes(marker),
      false,
      `evidence must omit ${marker}`
    );
  }
}
