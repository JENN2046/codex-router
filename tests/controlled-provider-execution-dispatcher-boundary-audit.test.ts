import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatControlledProviderExecutionDispatcherBoundaryAuditResult,
  reviewControlledProviderExecutionDispatcherBoundaryAudit,
  type ControlledProviderExecutionDispatcherBoundaryAuditInput
} from "../scripts/run-controlled-provider-execution-dispatcher-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("controlled provider execution dispatcher boundary audit passes", async () => {
  const review = reviewControlledProviderExecutionDispatcherBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.dispatchPreflightMatrixStillRecorded, true);
  assert.equal(review.checks.dispatcherSourceRecorded, true);
  assert.equal(review.checks.dispatcherRegressionCoverageRecorded, true);
  assert.equal(review.checks.noDirectRuntimeInvocation, true);
  assert.equal(review.summary.dispatcherMode, "controlled_readonly_pre_runner_dispatcher");
  assert.equal(review.summary.consumesDispatchPreflightSchema, true);
  assert.equal(review.summary.callsRunnerBoundary, true);
  assert.equal(review.summary.callsProviderExecuteDirectly, false);
  assert.equal(review.summary.authorizesWorkspaceWrite, false);
  assert.equal(review.summary.providerExecutionPlanHashRequired, true);
  assert.equal(review.summary.providerRegistrySelectionRequired, true);
  assert.equal(review.summary.permitValidationRequired, true);
  assert.equal(review.summary.preflightArtifactBindingRequired, true);
  assert.equal(review.summary.governanceStrategyStopRequired, true);
  assert.equal(review.summary.runnerInvocationsDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
});

test("controlled provider execution dispatcher boundary audit blocks missing registration", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewControlledProviderExecutionDispatcherBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "controlled-provider-execution-dispatcher-boundary",
      "archived-controlled-provider-execution-dispatcher"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_dispatcher_boundary_governanceRunnerRegistered"
    )
  );
});

test("controlled provider execution dispatcher boundary audit blocks weakened source", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewControlledProviderExecutionDispatcherBoundaryAudit({
    ...input,
    dispatcherSourceText: input.dispatcherSourceText
      .replaceAll("validateProviderExecutionPermitForPlan", "validateProviderExecutionPermitLater")
      .replaceAll("controlled_readonly_dispatch_governance_strategy_blocked", "controlled_readonly_dispatch_governance_strategy_allowed")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_dispatcher_boundary_dispatcherSourceRecorded"
    )
  );
});

test("controlled provider execution dispatcher boundary audit blocks missing regression coverage", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewControlledProviderExecutionDispatcherBoundaryAudit({
    ...input,
    dispatcherTestText: input.dispatcherTestText
      .replaceAll(
        "controlled provider dispatcher blocks permit drift before runner",
        "controlled provider dispatcher permits drift later"
      )
      .replaceAll("execute, 0", "execute, 1")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_dispatcher_boundary_dispatcherRegressionCoverageRecorded"
    )
  );
});

test("controlled provider execution dispatcher boundary audit blocks direct runtime invocation markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewControlledProviderExecutionDispatcherBoundaryAudit({
    ...input,
    dispatcherSourceText: `${input.dispatcherSourceText}\nprovider.execute(plan);\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_dispatcher_boundary_noDirectRuntimeInvocation"
    )
  );
});

test("controlled provider execution dispatcher boundary audit scans linked authority docs for runtime invocation markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewControlledProviderExecutionDispatcherBoundaryAudit({
    ...input,
    dispatchPreflightMatrixText:
      `${input.dispatchPreflightMatrixText}\nprovider.execute(plan);\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_dispatcher_boundary_noDirectRuntimeInvocation"
    )
  );
});

test("controlled provider execution dispatcher boundary audit output stays sanitized", async () => {
  const review = reviewControlledProviderExecutionDispatcherBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatControlledProviderExecutionDispatcherBoundaryAuditResult(review);
  const json = formatControlledProviderExecutionDispatcherBoundaryAuditResult(
    review,
    "json"
  );
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
  overrides: Partial<ControlledProviderExecutionDispatcherBoundaryAuditInput> = {}
): Promise<ControlledProviderExecutionDispatcherBoundaryAuditInput> {
  return {
    controlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    dispatcherSourceText: await readFile(
      "packages/governance-internal-controlled-provider-dispatcher/src/index.ts",
      "utf8"
    ),
    dispatcherTestText: await readFile(
      "tests/controlled-provider-dispatcher.test.ts",
      "utf8"
    ),
    dispatchPreflightMatrixText: await readFile(
      "docs/governance/CONTROLLED_PROVIDER_EXECUTION_DISPATCH_PREFLIGHT_MATRIX.md",
      "utf8"
    ),
    ...overrides
  };
}
