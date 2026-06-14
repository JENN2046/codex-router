import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runFormalRealReadonlySmokePreExecutionAcceptance,
  writeFormalRealReadonlySmokePreExecutionAcceptanceEvidence,
  type FormalRealReadonlySmokePreExecutionAcceptanceEvidence
} from "../scripts/run-formal-real-readonly-smoke-pre-execution-acceptance.js";

const now = "2026-06-15T00:00:00.000Z";
const forbiddenMarkers = [
  "APPROVE_FORMAL_REAL_CODEX_CLI_READONLY_SMOKE_PR_17A",
  "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE",
  "docs/governance/PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK.md",
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

test("formal real read-only smoke pre-execution acceptance stays local-only", async () => {
  const evidence = await runFormalRealReadonlySmokePreExecutionAcceptance({
    generatedAt: now
  });

  assert.equal(
    evidence.schemaVersion,
    "codex-cli-formal-real-readonly-smoke-pre-execution-acceptance.v1"
  );
  assert.equal(evidence.generatedAt, now);
  assert.equal(evidence.mode, "formal-real-readonly-smoke-pre-execution-local-only");
  assert.equal(
    evidence.taskId,
    "codex-cli-formal-real-readonly-smoke-pre-execution-acceptance"
  );
  assert.deepEqual(evidence.checks, {
    taskbookGateAccepted: true,
    taskbookEvidencePresent: true,
    taskbookDocPresent: true,
    smokeScriptDefaultEvidencePath: true,
    smokeScriptBlocksWithoutOperatorFlag: true,
    blockedSmokeDoesNotInvokeRunner: true,
    blockedSmokeWritesSanitizedEvidence: true,
    exactFutureCommandRequired: true,
    defaultEvidencePathRequired: true,
    formalDispatchBoundaryRequired: true,
    providerExecuteStillSeparate: true,
    noProviderExecute: true,
    noRealCodexCli: true,
    noWorkspaceWriteExecute: true,
    leakCheckPassed: true
  });
  assert.equal(evidence.summary.requiredProviderId, "codex-cli");
  assert.equal(evidence.summary.requiredSandbox, "read-only");
  assert.equal(evidence.summary.requiredSideEffectClass, "read_only");
  assert.equal(evidence.summary.requiredApprovalPolicy, "never");
  assert.equal(evidence.summary.requiredEvidencePathChoice, "default");
  assert.equal(
    evidence.summary.realSmokeDefaultEvidencePath,
    "docs/evidence/codex-cli-real-readonly-smoke.json"
  );
  assert.equal(evidence.summary.taskbookAcceptanceStatus, "accepted");
  assert.equal(evidence.summary.blockedSmokeStatus, "blocked");
  assert.equal(evidence.summary.blockedSmokeExitCode, 1);
  assert.equal(evidence.summary.localPreExecutionOnly, true);
  assert.equal(evidence.summary.futureRealCliInvocationRequiresSeparateAuthorization, true);
  assert.equal(evidence.summary.providerExecuteRequiresSeparateAuthorization, true);
  assert.equal(evidence.summary.workspaceWriteMustRemainClosed, true);
  assert.deepEqual(evidence.counters, {
    providerExecuteCalls: 0,
    realCodexCliCalls: 0,
    workspaceWriteExecuteCalls: 0,
    blockedSmokeRunnerCalls: 0
  });
  assert.deepEqual(evidence.blockingReasons, [
    "codex_cli_real_readonly_smoke_requires_operator_flag"
  ]);
  assertSafeEvidence(evidence);
});

test("formal real read-only smoke pre-execution writer persists safe json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "formal-real-readonly-smoke-pre-exec-"));
  const evidencePath = join(dir, "evidence.json");
  const evidence = await runFormalRealReadonlySmokePreExecutionAcceptance({
    generatedAt: now
  });

  await writeFormalRealReadonlySmokePreExecutionAcceptanceEvidence(
    evidence,
    evidencePath
  );

  const raw = await readFile(evidencePath, "utf8");
  const parsed = JSON.parse(raw) as FormalRealReadonlySmokePreExecutionAcceptanceEvidence;

  assert.equal(parsed.checks.taskbookGateAccepted, true);
  assert.equal(parsed.checks.smokeScriptBlocksWithoutOperatorFlag, true);
  assert.equal(parsed.checks.blockedSmokeDoesNotInvokeRunner, true);
  assert.equal(parsed.checks.noRealCodexCli, true);
  assert.equal(parsed.checks.noWorkspaceWriteExecute, true);
  assert.equal(parsed.checks.leakCheckPassed, true);
  assertSafeEvidence(parsed);
});

function assertSafeEvidence(
  evidence: FormalRealReadonlySmokePreExecutionAcceptanceEvidence
): void {
  const serialized = JSON.stringify(evidence);

  for (const marker of forbiddenMarkers) {
    assert.equal(serialized.includes(marker), false, marker);
  }
}
