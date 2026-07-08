import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatStrategyRouterExecutionBoundaryAuditResult,
  reviewStrategyRouterExecutionBoundaryAudit,
  type StrategyRouterExecutionBoundaryAuditInput
} from "../scripts/run-strategy-router-execution-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer ",
  "raw stdout",
  "raw stderr"
];

test("strategy router execution boundary audit passes for current evidence", async () => {
  const review = reviewStrategyRouterExecutionBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneBoundaryRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.strategyRoutingGuardsPresent, true);
  assert.equal(review.checks.strategyRegressionCoverageRecorded, true);
  assert.equal(review.checks.downstreamProviderHookBlockCoverageRecorded, true);
  assert.equal(review.checks.noCrossBoundaryExecutionBroadening, true);
  assert.equal(review.summary.strategyMode, "advisory_budget_signal_only");
  assert.equal(review.summary.executeActionFamilyIsAuthorization, false);
  assert.equal(review.summary.writeExecutionPredicateIsAuthorization, false);
  assert.equal(review.summary.executorBudgetIsRuntimeInvocation, false);
  assert.equal(review.summary.stepBackExecutorBudget, 0);
  assert.equal(review.summary.simulateExecutorBudget, 0);
  assert.equal(review.summary.providerRunnerBlocksStrategyStopBeforeHooks, true);
  assert.equal(review.summary.providerRunnerBlocksSimulateBeforeHooks, true);
  assert.equal(review.summary.providerRunnerBlocksRecoveryPhaseBeforeHooks, true);
  assert.equal(review.summary.codexCliInvocationAllowedByStrategyRouter, false);
  assert.equal(review.summary.providerInvocationAllowedByStrategyRouter, false);
  assert.equal(review.summary.subAgentRuntimeInvocationAllowed, false);
  assert.equal(review.summary.hostExecutorInvocationAllowed, false);
  assert.equal(review.summary.strategyRouterCallsDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
});

test("strategy router execution boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStrategyRouterExecutionBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "strategy-router-execution-boundary",
      "archived-strategy-router-execution"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "strategy_router_execution_boundary_governanceRunnerRegistered"
    )
  );
});

test("strategy router execution boundary audit blocks broadened control plane", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStrategyRouterExecutionBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText
      .replaceAll(
        "Strategy router execution boundary | active / advisory budget signal only | No",
        "Strategy router execution boundary | active | Yes"
      )
      .replaceAll(
        "`execute`, `verify`, and executor budget signals are routing advice, not runtime authorization",
        "strategy router execute action family is authorization: true"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "strategy_router_execution_boundary_controlPlaneBoundaryRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "strategy_router_execution_boundary_noCrossBoundaryExecutionBroadening"
    )
  );
});

test("strategy router execution boundary audit blocks weakened strategy guard", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewStrategyRouterExecutionBoundaryAudit({
    ...input,
    strategyRouterSourceText: input.strategyRouterSourceText.replaceAll(
      "actionFamily: \"simulate\"",
      "actionFamily: \"execute\""
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "strategy_router_execution_boundary_strategyRoutingGuardsPresent"
    )
  );
});

test("strategy router execution boundary audit output stays summarized", async () => {
  const review = reviewStrategyRouterExecutionBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatStrategyRouterExecutionBoundaryAuditResult(review);
  const json = formatStrategyRouterExecutionBoundaryAuditResult(review, "json");
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
  overrides: Partial<StrategyRouterExecutionBoundaryAuditInput> = {}
): Promise<StrategyRouterExecutionBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    strategyRouterSourceText: await readFile(
      "packages/governance-internal-strategy-router/src/index.ts",
      "utf8"
    ),
    strategyRouterTestText: await readFile("tests/strategy-router.test.ts", "utf8"),
    providerExecutionRunnerTestText: await readFile(
      "tests/provider-execution-runner.test.ts",
      "utf8"
    ),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    ...overrides
  };
}
