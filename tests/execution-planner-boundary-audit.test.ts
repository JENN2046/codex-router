import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatExecutionPlannerBoundaryAuditResult,
  reviewExecutionPlannerBoundaryAudit,
  type ExecutionPlannerBoundaryAuditInput
} from "../scripts/run-execution-planner-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("execution planner boundary audit passes for current evidence", async () => {
  const review = reviewExecutionPlannerBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneCapabilityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.plannerMarkersPresent, true);
  assert.equal(review.checks.planStoreWritesLimitedToPlanState, true);
  assert.equal(review.checks.coverageRecorded, true);
  assert.equal(review.checks.noBroadRuntimeAuthorization, true);
  assert.equal(review.summary.plannerMode, "provider_execution_plan_only");
  assert.equal(review.summary.plannedStatusIsProviderExecutionAuthorization, false);
  assert.equal(review.summary.codexCliProviderSelectionIsCodexCliInvocation, false);
  assert.equal(
    review.summary.remoteAgentProviderSelectionIsSubAgentRuntimeInvocation,
    false
  );
  assert.equal(
    review.summary.workspaceWriteSideEffectClassIsWorkspaceWriteExecution,
    false
  );
  assert.equal(review.summary.localPlanStoreWritesAllowed, true);
  assert.equal(review.summary.planStoreWritesLimitedToPlanState, true);
  assert.equal(review.summary.providerPlanExecutionAllowed, false);
  assert.equal(review.summary.providerValidateExecutionPlanAllowed, false);
  assert.equal(review.summary.providerExecuteAllowed, false);
  assert.equal(review.summary.codexCliInvocationAllowed, false);
  assert.equal(review.summary.subAgentRuntimeInvocationAllowed, false);
  assert.equal(review.summary.hostExecutorInvocationAllowed, false);
  assert.equal(review.summary.hostDispatchAllowed, false);
  assert.equal(review.summary.workspaceWriteExecutionAllowed, false);
  assert.equal(review.summary.executionPlannerCallsDuringAudit, 0);
  assert.equal(review.summary.localPlanStoreWritesDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.codexCliCallsDuringAudit, 0);
  assert.equal(review.summary.subAgentRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.hostExecutorCallsDuringAudit, 0);
});

test("execution planner boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewExecutionPlannerBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "execution-planner-boundary",
      "archived-execution-planning-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_planner_boundary_governanceRunnerRegistered"
    )
  );
});

test("execution planner boundary audit blocks weakened planner markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewExecutionPlannerBoundaryAudit({
    ...input,
    executionPlannerText: input.executionPlannerText
      .replaceAll("provider_planned", "provider_ready_to_execute")
      .replaceAll("eligibility_missing_policy_approval_permit", "")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("execution_planner_boundary_plannerMarkersPresent")
  );
});

test("execution planner boundary audit blocks broadened plan store writes", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewExecutionPlannerBoundaryAudit({
    ...input,
    executionPlannerText:
      `${input.executionPlannerText}\nwriteFileSync(join(this.baseDir, "provider-output.json"), "{}");\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_planner_boundary_planStoreWritesLimitedToPlanState"
    )
  );
});

test("execution planner boundary audit blocks provider runtime calls", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewExecutionPlannerBoundaryAudit({
    ...input,
    executionPlannerText:
      `${input.executionPlannerText}\nprovider.planExecution({});\nprovider.execute({});\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_planner_boundary_noBroadRuntimeAuthorization"
    )
  );
});

test("execution planner boundary audit output stays summarized", async () => {
  const review = reviewExecutionPlannerBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatExecutionPlannerBoundaryAuditResult(review);
  const json = formatExecutionPlannerBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /planner mode: provider_execution_plan_only/);
  assert.match(text, /execution planner calls during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<ExecutionPlannerBoundaryAuditInput> = {}
): Promise<ExecutionPlannerBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    executionPlannerText: await readFile(
      "packages/execution-planner/src/index.ts",
      "utf8"
    ),
    executionPlannerTestText: await readFile(
      "tests/execution-planner.test.ts",
      "utf8"
    ),
    ...overrides
  };
}
