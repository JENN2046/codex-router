import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatDesktopDecisionRunnerBoundaryAuditResult,
  reviewDesktopDecisionRunnerBoundaryAudit,
  type DesktopDecisionRunnerBoundaryAuditInput
} from "../scripts/run-desktop-decision-runner-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("desktop decision runner boundary audit passes for current evidence", async () => {
  const review = reviewDesktopDecisionRunnerBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneCapabilityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.decisionRunnerMarkersPresent, true);
  assert.equal(review.checks.routingEngineGrantIsPlanOnly, true);
  assert.equal(review.checks.agentStrategyIsAssignmentOnly, true);
  assert.equal(review.checks.desktopBridgePlanMarkersPresent, true);
  assert.equal(review.checks.coverageRecorded, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.equal(review.summary.runnerMode, "decision_package_only");
  assert.equal(review.summary.readyStatusIsExecutionAuthorization, false);
  assert.equal(review.summary.providerSelectionIsProviderExecute, false);
  assert.equal(review.summary.agentStrategyIsSubAgentRuntimeInvocation, false);
  assert.equal(review.summary.desktopPrimitiveInvocationAllowed, false);
  assert.equal(review.summary.hostDispatchAllowed, false);
  assert.equal(review.summary.providerExecuteAllowed, false);
  assert.equal(review.summary.codexCliInvocationAllowed, false);
  assert.equal(review.summary.subAgentRuntimeInvocationAllowed, false);
  assert.equal(review.summary.workspaceWriteExecutionAllowed, false);
  assert.equal(review.summary.desktopDecisionRunnerCallsDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
});

test("desktop decision runner boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewDesktopDecisionRunnerBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "desktop-decision-runner-boundary",
      "archived-decision-runner-audit"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "desktop_decision_runner_boundary_governanceRunnerRegistered"
    )
  );
});

test("desktop decision runner boundary audit blocks weakened decision markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewDesktopDecisionRunnerBoundaryAudit({
    ...input,
    desktopDecisionRunnerText: input.desktopDecisionRunnerText
      .replaceAll("createDesktopExecutionPlan(decision, { authorized: true })", "")
      .replaceAll("selectProviderForRoutingDecision", "executeProviderForRoutingDecision")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "desktop_decision_runner_boundary_decisionRunnerMarkersPresent"
    )
  );
});

test("desktop decision runner boundary audit blocks broad execution calls", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewDesktopDecisionRunnerBoundaryAudit({
    ...input,
    desktopDecisionRunnerText:
      `${input.desktopDecisionRunnerText}\ndispatchReadOnlyRunnerResultToProvider({});\nprovider.execute({});\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "desktop_decision_runner_boundary_noBroadExecutionAuthorization"
    )
  );
});

test("desktop decision runner boundary audit blocks assignment becoming runtime spawn", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewDesktopDecisionRunnerBoundaryAudit({
    ...input,
    desktopAgentStrategyText:
      `${input.desktopAgentStrategyText}\nspawn_agent({ role: \"analyst\" });\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "desktop_decision_runner_boundary_noBroadExecutionAuthorization"
    )
  );
});

test("desktop decision runner boundary audit output stays summarized", async () => {
  const review = reviewDesktopDecisionRunnerBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatDesktopDecisionRunnerBoundaryAuditResult(review);
  const json = formatDesktopDecisionRunnerBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /desktop decision runner calls during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<DesktopDecisionRunnerBoundaryAuditInput> = {}
): Promise<DesktopDecisionRunnerBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    desktopDecisionRunnerText: await readFile(
      "packages/desktop-decision-runner/src/index.ts",
      "utf8"
    ),
    routingEngineText: await readFile("packages/routing-engine/src/index.ts", "utf8"),
    desktopAgentStrategyText: await readFile(
      "packages/desktop-agent-strategy/src/index.ts",
      "utf8"
    ),
    desktopBridgeText: await readFile("packages/desktop-bridge/src/index.ts", "utf8"),
    desktopDecisionRunnerTestText: await readFile(
      "tests/desktop-decision-runner.test.ts",
      "utf8"
    ),
    desktopDecisionRunnerGovernanceTestText: await readFile(
      "tests/desktop-decision-runner-governance.test.ts",
      "utf8"
    ),
    routingEngineTestText: await readFile("tests/routing-engine.test.ts", "utf8"),
    desktopAgentStrategyTestText: await readFile(
      "tests/desktop-agent-strategy.test.ts",
      "utf8"
    ),
    desktopLiveAdapterTestText: await readFile(
      "tests/desktop-live-adapter.test.ts",
      "utf8"
    ),
    ...overrides
  };
}
