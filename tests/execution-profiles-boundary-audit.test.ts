import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatExecutionProfilesBoundaryAuditResult,
  reviewExecutionProfilesBoundaryAudit,
  type ExecutionProfilesBoundaryAuditInput
} from "../scripts/run-execution-profiles-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("execution profiles boundary audit passes for current evidence", async () => {
  const review = reviewExecutionProfilesBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.sourceMarkersPresent, true);
  assert.equal(review.checks.usageMarkersPresent, true);
  assert.equal(review.checks.coverageRecorded, true);
  assert.equal(review.checks.noRuntimeInvocationSurface, true);
  assert.equal(review.checks.outputSanitized, true);
  assert.equal(review.summary.executionProfilesMode, "profile_templates_only");
  assert.equal(review.summary.defaultToolAccessIsToolRuntimeAuthorization, false);
  assert.equal(
    review.summary.allowParallelIsSubAgentRuntimeAuthorization,
    false
  );
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.subAgentRuntimeCallsDuringAudit, 0);
});

test("execution profiles boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewExecutionProfilesBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "execution-profiles-boundary",
      "archived-execution-profiles"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_profiles_boundary_governanceRunnerRegistered"
    )
  );
});

test("execution profiles boundary audit blocks missing control-plane record", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewExecutionProfilesBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Execution profiles boundary",
      "Archived profiles boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_profiles_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("execution profiles boundary audit blocks source and usage drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewExecutionProfilesBoundaryAudit({
    ...input,
    executionProfilesSourceText: input.executionProfilesSourceText.replaceAll(
      "maxParallelAgents: number",
      "agentLimit: number"
    ),
    routingEngineSourceText: input.routingEngineSourceText.replaceAll(
      "profile.allowParallel",
      "profile.parallelAllowed"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("execution_profiles_boundary_sourceMarkersPresent")
  );
  assert.ok(
    review.reasons.includes("execution_profiles_boundary_usageMarkersPresent")
  );
});

test("execution profiles boundary audit blocks runtime invocation markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewExecutionProfilesBoundaryAudit({
    ...input,
    executionProfilesSourceText: `${input.executionProfilesSourceText}\nprovider.execute(plan);`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "execution_profiles_boundary_noRuntimeInvocationSurface"
    )
  );
});

test("execution profiles boundary audit formats sanitized text and json", async () => {
  const review = reviewExecutionProfilesBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatExecutionProfilesBoundaryAuditResult(review);
  const json = formatExecutionProfilesBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /execution profiles mode: profile_templates_only/);
  assert.match(text, /sub-agent runtime calls during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<ExecutionProfilesBoundaryAuditInput> = {}
): Promise<ExecutionProfilesBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    executionProfilesSourceText: await readFile(
      "packages/execution-profiles/src/index.ts",
      "utf8"
    ),
    routingEngineSourceText: await readFile(
      "packages/routing-engine/src/index.ts",
      "utf8"
    ),
    desktopAgentStrategySourceText: await readFile(
      "packages/desktop-agent-strategy/src/index.ts",
      "utf8"
    ),
    routingEngineTestText: await readFile("tests/routing-engine.test.ts", "utf8"),
    desktopAgentStrategyTestText: await readFile(
      "tests/desktop-agent-strategy.test.ts",
      "utf8"
    ),
    ...overrides
  };
}
