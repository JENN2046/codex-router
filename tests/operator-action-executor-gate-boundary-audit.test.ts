import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatOperatorActionExecutorGateBoundaryAuditResult,
  reviewOperatorActionExecutorGateBoundaryAudit,
  type OperatorActionExecutorGateBoundaryAuditInput
} from "../scripts/run-operator-action-executor-gate-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("operator action executor gate boundary audit passes for current evidence", async () => {
  const review = reviewOperatorActionExecutorGateBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.phase10CloseoutRecorded, true);
  assert.equal(review.checks.currentStateRecorded, true);
  assert.equal(review.checks.controlPlaneCapabilityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.planOnlySurfacePresent, true);
  assert.equal(review.checks.durableReceiptProofRequired, true);
  assert.equal(review.checks.lifecycleAndAllowlistBound, true);
  assert.equal(review.checks.checkpointPropagationRecorded, true);
  assert.equal(review.checks.providerRunnerSummarySanitized, true);
  assert.equal(review.checks.failClosedCoverageRecorded, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.equal(review.summary.gateMode, "plan_only");
  assert.equal(review.summary.executionAuthorizedByGate, false);
  assert.equal(review.summary.hostExecutorInvocationAllowed, false);
  assert.equal(review.summary.providerExecutionAllowed, false);
  assert.equal(review.summary.hostExecutorInvocationsDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
});

test("operator action executor gate boundary audit blocks missing runner and README entries", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewOperatorActionExecutorGateBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "operator-action-executor-gate-boundary",
      "archived-operator-action-executor-gate"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit operator-action-executor-gate-boundary",
      "npm run governance -- audit archived-operator-action-executor-gate"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "operator_action_executor_gate_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "operator_action_executor_gate_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("operator action executor gate boundary audit blocks broadened closeout docs", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewOperatorActionExecutorGateBoundaryAudit({
    ...input,
    phase10CloseoutText: input.phase10CloseoutText
      .replaceAll("executionMode: \"plan_only\"", "executionMode: \"execute\"")
      .replaceAll("This closeout does not authorize", "This closeout authorizes")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "operator_action_executor_gate_boundary_phase10CloseoutRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "operator_action_executor_gate_boundary_noBroadExecutionAuthorization"
    )
  );
});

test("operator action executor gate boundary audit blocks weakened source guards", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewOperatorActionExecutorGateBoundaryAudit({
    ...input,
    recoveryControlSourceText: input.recoveryControlSourceText
      .replaceAll("input.executionMode !== \"plan_only\"", "input.executionMode !== \"execute\"")
      .replaceAll(
        "operator_action_executor_receipt_consumption_store_proof_missing",
        "operator_action_executor_receipt_consumption_store_proof_optional"
      )
      .replaceAll("operator_action_executor_action_not_allowed", "operator_action_executor_action_allowed")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "operator_action_executor_gate_boundary_planOnlySurfacePresent"
    )
  );
  assert.ok(
    review.reasons.includes(
      "operator_action_executor_gate_boundary_durableReceiptProofRequired"
    )
  );
  assert.ok(
    review.reasons.includes(
      "operator_action_executor_gate_boundary_lifecycleAndAllowlistBound"
    )
  );
});

test("operator action executor gate boundary audit blocks weakened provider summary evidence", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewOperatorActionExecutorGateBoundaryAudit({
    ...input,
    providerRunnerTestText: input.providerRunnerTestText
      .replaceAll("operatorActionSummary?.present, true", "operatorActionSummary?.present, false")
      .replaceAll("execute: 0", "execute: 1")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "operator_action_executor_gate_boundary_providerRunnerSummarySanitized"
    )
  );
});

test("operator action executor gate boundary audit output stays summarized", async () => {
  const review = reviewOperatorActionExecutorGateBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatOperatorActionExecutorGateBoundaryAuditResult(review);
  const json = formatOperatorActionExecutorGateBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /provider execute calls during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<OperatorActionExecutorGateBoundaryAuditInput> = {}
): Promise<OperatorActionExecutorGateBoundaryAuditInput> {
  return {
    phase10CloseoutText: await readFile(
      "docs/governance/PHASE_10_OPERATOR_ACTION_EXECUTOR_GATE_CLOSEOUT.md",
      "utf8"
    ),
    currentStateText: await readFile("docs/current/CURRENT_STATE.md", "utf8"),
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    recoveryControlSourceText: await readFile(
      "packages/governance-internal-recovery-control/src/index.ts",
      "utf8"
    ),
    recoveryControlTestText: await readFile(
      "tests/recovery-control.test.ts",
      "utf8"
    ),
    providerRunnerSourceText: await readFile(
      "packages/governance-internal-provider-execution-runner/src/index.ts",
      "utf8"
    ),
    providerRunnerTestText: await readFile(
      "tests/provider-execution-runner.test.ts",
      "utf8"
    ),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    ...overrides
  };
}
