import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatExecutionEligibilityBoundaryAuditResult,
  reviewExecutionEligibilityBoundaryAudit,
  type ExecutionEligibilityBoundaryAuditInput
} from "../scripts/run-execution-eligibility-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("execution eligibility boundary audit passes for current evidence", async () => {
  const review = reviewExecutionEligibilityBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneCapabilityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.eligibilityMarkersPresent, true);
  assert.equal(review.checks.permitStoreScopeBound, true);
  assert.equal(review.checks.coverageRecorded, true);
  assert.equal(review.checks.noBroadRuntimeAuthorization, true);
  assert.equal(
    review.summary.eligibilityMode,
    "admission_capability_permit_decision_only"
  );
  assert.equal(review.summary.eligibleStatusIsExecutionAuthorization, false);
  assert.equal(
    review.summary.validApprovalPermitIsProviderExecutionAuthorization,
    false
  );
  assert.equal(review.summary.capabilityGrantIsRuntimeInvocation, false);
  assert.equal(review.summary.permitStoreReadIsRuntimeInvocation, false);
  assert.equal(review.summary.providerPlanCreationAllowed, false);
  assert.equal(review.summary.providerExecuteAllowed, false);
  assert.equal(review.summary.codexCliInvocationAllowed, false);
  assert.equal(review.summary.subAgentRuntimeInvocationAllowed, false);
  assert.equal(review.summary.hostExecutorInvocationAllowed, false);
  assert.equal(review.summary.hostDispatchAllowed, false);
  assert.equal(review.summary.workspaceWriteExecutionAllowed, false);
  assert.equal(review.summary.executionEligibilityCallsDuringAudit, 0);
  assert.equal(review.summary.permitStoreReadsDuringAudit, 0);
  assert.equal(review.summary.providerPlanCreationCallsDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.codexCliCallsDuringAudit, 0);
  assert.equal(review.summary.subAgentRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.hostExecutorCallsDuringAudit, 0);
});

test("execution eligibility boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewExecutionEligibilityBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "execution-eligibility-boundary",
      "archived-eligibility-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_eligibility_boundary_governanceRunnerRegistered"
    )
  );
});

test("execution eligibility boundary audit blocks weakened eligibility markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewExecutionEligibilityBoundaryAudit({
    ...input,
    executionEligibilityText: input.executionEligibilityText
      .replaceAll("valid_approval_permit", "permit_authorized_execution")
      .replaceAll("capability_grants_satisfied", "capabilities_execute")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_eligibility_boundary_eligibilityMarkersPresent"
    )
  );
});

test("execution eligibility boundary audit blocks unscoped permit store reads", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewExecutionEligibilityBoundaryAudit({
    ...input,
    executionEligibilityText: input.executionEligibilityText
      .replaceAll("principalId: input.principal.principalId", "")
      .replaceAll("planHash: input.planHash", "")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("execution_eligibility_boundary_permitStoreScopeBound")
  );
});

test("execution eligibility boundary audit blocks runtime calls", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewExecutionEligibilityBoundaryAudit({
    ...input,
    executionEligibilityText:
      `${input.executionEligibilityText}\nprovider.execute({});\nrunCodexCli({});\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_eligibility_boundary_noBroadRuntimeAuthorization"
    )
  );
});

test("execution eligibility boundary audit output stays summarized", async () => {
  const review = reviewExecutionEligibilityBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatExecutionEligibilityBoundaryAuditResult(review);
  const json = formatExecutionEligibilityBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /eligibility mode: admission_capability_permit_decision_only/);
  assert.match(text, /execution eligibility calls during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<ExecutionEligibilityBoundaryAuditInput> = {}
): Promise<ExecutionEligibilityBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    executionEligibilityText: await readFile(
      "packages/execution-eligibility/src/index.ts",
      "utf8"
    ),
    executionEligibilityTestText: await readFile(
      "tests/execution-eligibility.test.ts",
      "utf8"
    ),
    ...overrides
  };
}
