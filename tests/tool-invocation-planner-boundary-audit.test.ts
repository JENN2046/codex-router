import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatToolInvocationPlannerBoundaryAuditResult,
  reviewToolInvocationPlannerBoundaryAudit,
  type ToolInvocationPlannerBoundaryAuditInput
} from "../scripts/run-tool-invocation-planner-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("tool invocation planner boundary audit passes for current evidence", async () => {
  const review = reviewToolInvocationPlannerBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.registryMarkersRecorded, true);
  assert.equal(review.checks.plannerMarkersRecorded, true);
  assert.equal(review.checks.registryRegressionCoverageRecorded, true);
  assert.equal(review.checks.plannerRegressionCoverageRecorded, true);
  assert.equal(review.checks.noDefaultRuntimeInvocationSurface, true);
  assert.equal(
    review.summary.toolInvocationPlannerMode,
    "tool_manifest_and_invocation_plan_only"
  );
  assert.equal(review.summary.plannedStatusIsRuntimeInvocation, false);
  assert.equal(
    review.summary.remoteAgentToolManifestIsSubAgentRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.externalWriteToolManifestIsExternalWriteAuthorization,
    false
  );
  assert.equal(review.summary.approvalPermitIsToolRuntimeAuthorization, false);
  assert.equal(review.summary.localWriteToolPlanIsWorkspaceWriteExecution, false);
  assert.equal(review.summary.toolRegistryCallsDuringAudit, 0);
  assert.equal(review.summary.toolInvocationPlansDuringAudit, 0);
  assert.equal(review.summary.toolRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.subAgentRuntimeCallsDuringAudit, 0);
});

test("tool invocation planner boundary audit blocks missing registration", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewToolInvocationPlannerBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "tool-invocation-planner-boundary",
      "archived-tool-invocation-planner"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "tool-invocation-planner-boundary",
      "archived-tool-invocation-planner"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "tool_invocation_planner_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "tool_invocation_planner_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("tool invocation planner boundary audit blocks missing control-plane authority", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewToolInvocationPlannerBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText
      .replaceAll("Tool invocation planner boundary", "Tool invocation planner")
      .replaceAll(
        "planned tool invocation status is not runtime invocation",
        "planned tool invocation status can invoke runtime"
      )
      .replaceAll(
        "remote.agent.invoke is not sub-agent runtime authorization",
        "remote.agent.invoke is sub-agent runtime authorization"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "tool_invocation_planner_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("tool invocation planner boundary audit blocks source and test drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewToolInvocationPlannerBoundaryAudit({
    ...input,
    toolRegistrySourceText: input.toolRegistrySourceText.replaceAll(
      "remoteAgentInvokeToolManifest",
      "remoteAgentInvokeRuntime"
    ),
    toolInvocationPlannerSourceText: input.toolInvocationPlannerSourceText.replaceAll(
      "tool_invocation_sandbox_exceeds_policy",
      "tool_invocation_sandbox_policy_ignored"
    ),
    toolRegistryTestText: input.toolRegistryTestText.replaceAll(
      "tool registry remote agent required capabilities are canonical",
      "tool registry remote agent invokes runtime"
    ),
    toolInvocationPlannerTestText: input.toolInvocationPlannerTestText.replaceAll(
      "tool invocation planner blocks tool sandboxes that exceed policy",
      "tool invocation planner allows tool sandboxes that exceed policy"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "tool_invocation_planner_boundary_registryMarkersRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "tool_invocation_planner_boundary_plannerMarkersRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "tool_invocation_planner_boundary_registryRegressionCoverageRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "tool_invocation_planner_boundary_plannerRegressionCoverageRecorded"
    )
  );
});

test("tool invocation planner boundary audit blocks runtime invocation markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewToolInvocationPlannerBoundaryAudit({
    ...input,
    toolInvocationPlannerSourceText: `${input.toolInvocationPlannerSourceText}
provider.execute(plan);
dispatchGovernanceOperatorActionHostExecutor(input);
spawnSubAgent(input);
writeFile("artifact.json", "{}");
`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "tool_invocation_planner_boundary_noDefaultRuntimeInvocationSurface"
    )
  );
});

test("tool invocation planner boundary audit formats sanitized text and json", async () => {
  const review = reviewToolInvocationPlannerBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatToolInvocationPlannerBoundaryAuditResult(review);
  const json = formatToolInvocationPlannerBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /tool runtime calls during audit: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.toolRuntimeCallsDuringAudit, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<ToolInvocationPlannerBoundaryAuditInput> = {}
): Promise<ToolInvocationPlannerBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    toolRegistrySourceText: await readFile(
      "packages/tool-registry/src/index.ts",
      "utf8"
    ),
    toolInvocationPlannerSourceText: await readFile(
      "packages/tool-invocation-planner/src/index.ts",
      "utf8"
    ),
    toolRegistryTestText: await readFile("tests/tool-registry.test.ts", "utf8"),
    toolInvocationPlannerTestText: await readFile(
      "tests/tool-invocation-planner.test.ts",
      "utf8"
    ),
    ...overrides
  };
}
