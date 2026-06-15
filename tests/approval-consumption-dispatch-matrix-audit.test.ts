import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatApprovalConsumptionDispatchMatrixAuditResult,
  reviewApprovalConsumptionDispatchMatrixAudit,
  type ApprovalConsumptionDispatchMatrixAuditInput
} from "../scripts/run-approval-consumption-dispatch-matrix-audit.js";

const forbiddenOutputMarkers = [
  "APPROVE_FORMAL_REAL_CODEX_CLI_READONLY_SMOKE_EXECUTION_PR_18A",
  "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE",
  "ALLOW_CODEX_CLI_WORKSPACE_WRITE_SMOKE",
  "requestedAction",
  "prompt",
  "stdout",
  "stderr",
  "raw command",
  "raw env",
  "raw token",
  "raw patch",
  "OPENAI_API_KEY",
  "sk-",
  "Bearer"
];

test("approval consumption dispatch matrix passes for local evidence", async () => {
  const review = reviewApprovalConsumptionDispatchMatrixAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.summary.approvalCoverageRows, 4);
  assert.equal(review.summary.dispatchCoverageRows, 3);
  assert.equal(review.summary.redactionCoverageRows, 6);
  assert.equal(review.summary.providerExecuteCallsDuringMatrix, 0);
  assert.equal(review.summary.realCodexCliCallsDuringMatrix, 0);
  assert.equal(review.summary.workspaceWriteExecuteCallsDuringMatrix, 0);
  assert.equal(review.checks.matrixNonAuthorizing, true);
  assert.equal(review.checks.evidenceSanitized, true);
});

test("approval consumption dispatch matrix blocks stale state", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewApprovalConsumptionDispatchMatrixAudit({
    ...input,
    gitStatusShort: " M package.json\n",
    branch: "feature",
    aheadBehind: "0\t1",
    packageJsonText: JSON.stringify({ scripts: {} }),
    matrixDocText: "stale",
    approvalCloseoutText: "stale"
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("approval_consumption_dispatch_matrix_worktreeClean"));
  assert.ok(review.reasons.includes("approval_consumption_dispatch_matrix_branchMain"));
  assert.ok(review.reasons.includes("approval_consumption_dispatch_matrix_notBehindOrigin"));
  assert.ok(review.reasons.includes("approval_consumption_dispatch_matrix_packageScriptPresent"));
  assert.ok(review.reasons.includes("approval_consumption_dispatch_matrix_matrixDocRecorded"));
  assert.ok(review.reasons.includes("approval_consumption_dispatch_matrix_approvalConsumptionCloseoutRecorded"));
});

test("approval consumption dispatch matrix blocks reopened coverage gaps", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewApprovalConsumptionDispatchMatrixAudit({
    ...input,
    mcpRuntimeTestText: "missing consumption coverage",
    hostDispatcherTestText: "missing dispatch coverage",
    redactionTestText: "missing redaction coverage"
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("approval_consumption_dispatch_matrix_mcpConsumptionCoveragePresent"));
  assert.ok(review.reasons.includes("approval_consumption_dispatch_matrix_providerDispatchPreconditionsCovered"));
  assert.ok(review.reasons.includes("approval_consumption_dispatch_matrix_workspaceWriteRejectBeforeSpawnCovered"));
  assert.ok(review.reasons.includes("approval_consumption_dispatch_matrix_invalidRunnerStateBlockedCovered"));
  assert.ok(review.reasons.includes("approval_consumption_dispatch_matrix_auditRedactionCoveragePresent"));
});

test("approval consumption dispatch matrix output stays summarized", async () => {
  const review = reviewApprovalConsumptionDispatchMatrixAudit(
    await createInputFromWorkspace()
  );
  const text = formatApprovalConsumptionDispatchMatrixAuditResult(review);
  const json = formatApprovalConsumptionDispatchMatrixAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /approval coverage rows: 4\/4/);
  assert.match(text, /dispatch coverage rows: 3\/3/);
  assert.match(text, /redaction coverage rows: 6\/6/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<ApprovalConsumptionDispatchMatrixAuditInput> = {}
): Promise<ApprovalConsumptionDispatchMatrixAuditInput> {
  return {
    gitStatusShort: "",
    branch: "main",
    aheadBehind: "0\t0",
    packageJsonText: await readFile("package.json", "utf8"),
    matrixDocText: await readFile(
      "docs/governance/APPROVAL_CONSUMPTION_DISPATCH_AUDIT_MATRIX.md",
      "utf8"
    ),
    approvalCloseoutText: await readFile(
      "docs/governance/APPROVAL_CONSUMPTION_HARDENING_LOCAL_CLOSEOUT.md",
      "utf8"
    ),
    approvalPermitTestText: await readFile("tests/approval-permit.test.ts", "utf8"),
    executionEligibilityTestText:
      await readFile("tests/execution-eligibility.test.ts", "utf8"),
    mcpRuntimeTestText:
      await readFile("tests/agent-os-mcp-local-runtime.test.ts", "utf8"),
    sdkTestText: await readFile("tests/agent-os-sdk.test.ts", "utf8"),
    cliTestText: await readFile("tests/agent-os-cli.test.ts", "utf8"),
    appServerTestText: await readFile("tests/agent-os-app-server.test.ts", "utf8"),
    hostDispatcherTestText: await readFile("tests/host-dispatcher.test.ts", "utf8"),
    redactionTestText: await readFile("tests/redaction.test.ts", "utf8"),
    jsonlEventLogTestText: await readFile("tests/jsonl-event-log.test.ts", "utf8"),
    artifactStoreTestText: await readFile("tests/artifact-store.test.ts", "utf8"),
    toolInvocationPlannerTestText:
      await readFile("tests/tool-invocation-planner.test.ts", "utf8"),
    resultEnvelopeText:
      await readFile("packages/desktop-live-adapter/src/result-envelope.ts", "utf8"),
    workspaceWriteGuardTestText:
      await readFile("tests/workspace-write-guard.test.ts", "utf8"),
    ...overrides
  };
}
