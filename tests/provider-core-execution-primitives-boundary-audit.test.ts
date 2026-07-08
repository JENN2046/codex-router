import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatProviderCoreExecutionPrimitivesBoundaryAuditResult,
  reviewProviderCoreExecutionPrimitivesBoundaryAudit,
  type ProviderCoreExecutionPrimitivesBoundaryAuditInput
} from "../scripts/run-provider-core-execution-primitives-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("provider-core execution primitives boundary audit passes for current evidence", async () => {
  const review = reviewProviderCoreExecutionPrimitivesBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneBoundaryRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.providerCorePrimitiveSchemasPresent, true);
  assert.equal(review.checks.providerCorePermitGuardsPresent, true);
  assert.equal(review.checks.providerCoreRegressionCoverageRecorded, true);
  assert.equal(review.checks.providerRegistryRemoteAgentGuardsPresent, true);
  assert.equal(review.checks.providerRegistryRemoteAgentCoverageRecorded, true);
  assert.equal(review.checks.toolInvocationPlannerCoverageRecorded, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.equal(review.summary.providerCorePrimitiveMode, "manifest_permit_plan_only");
  assert.equal(review.summary.remoteAgentExecutionAllowed, false);
  assert.equal(review.summary.toolRuntimeInvocationAllowed, false);
  assert.equal(review.summary.workspaceWriteExecutionAllowedByProviderCore, false);
  assert.equal(review.summary.generalProviderExecutionAllowed, false);
  assert.equal(review.summary.providerCoreRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.remoteAgentRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.toolRuntimeCallsDuringAudit, 0);
});

test("provider-core execution primitives boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewProviderCoreExecutionPrimitivesBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "provider-core-execution-primitives-boundary",
      "archived-provider-core-primitives"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "provider_core_execution_primitives_boundary_governanceRunnerRegistered"
    )
  );
});

test("provider-core execution primitives boundary audit blocks broadened control plane", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewProviderCoreExecutionPrimitivesBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText
      .replaceAll(
        "Provider-core execution primitives | active / manifest / permit / plan primitives only | No",
        "Provider-core execution primitives | active | Yes"
      )
      .replaceAll(
        "remote-agent, tool, and workspace-write primitives are not runtime authorization",
        "remote-agent, tool, and workspace-write primitives are runtime authorization"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "provider_core_execution_primitives_boundary_controlPlaneBoundaryRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "provider_core_execution_primitives_boundary_noBroadExecutionAuthorization"
    )
  );
});

test("provider-core execution primitives boundary audit blocks weakened permit guards", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewProviderCoreExecutionPrimitivesBoundaryAudit({
    ...input,
    providerCoreSourceText: input.providerCoreSourceText.replaceAll(
      "createApprovedWorkspaceWriteProviderExecutionPermitV2",
      "createOptionalWorkspaceWriteProviderExecutionPermitV2"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "provider_core_execution_primitives_boundary_providerCorePermitGuardsPresent"
    )
  );
});

test("provider-core execution primitives boundary audit output stays summarized", async () => {
  const review = reviewProviderCoreExecutionPrimitivesBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatProviderCoreExecutionPrimitivesBoundaryAuditResult(review);
  const json = formatProviderCoreExecutionPrimitivesBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /provider-core runtime calls during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<ProviderCoreExecutionPrimitivesBoundaryAuditInput> = {}
): Promise<ProviderCoreExecutionPrimitivesBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    providerCoreSourceText: await readFile(
      "packages/provider-core/src/index.ts",
      "utf8"
    ),
    providerRegistrySourceText: await readFile(
      "packages/provider-registry/src/index.ts",
      "utf8"
    ),
    providerCoreTestText: await readFile("tests/provider-core.test.ts", "utf8"),
    providerRegistryTestText: await readFile(
      "tests/provider-registry.test.ts",
      "utf8"
    ),
    toolInvocationPlannerTestText: await readFile(
      "tests/tool-invocation-planner.test.ts",
      "utf8"
    ),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    ...overrides
  };
}
