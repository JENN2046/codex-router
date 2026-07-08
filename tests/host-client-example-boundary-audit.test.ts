import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatHostClientExampleBoundaryAuditResult,
  reviewHostClientExampleBoundaryAudit,
  type HostClientExampleBoundaryAuditInput
} from "../scripts/run-host-client-example-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer ",
  "raw stdout",
  "raw stderr"
];

test("host client example boundary audit passes for current evidence", async () => {
  const review = reviewHostClientExampleBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneBoundaryRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.exampleFacadeGuardsPresent, true);
  assert.equal(review.checks.exampleRegressionCoverageRecorded, true);
  assert.equal(review.checks.noHostExecutorSurface, true);
  assert.equal(review.summary.exampleMode, "example_host_client_facade");
  assert.equal(review.summary.runResumeMode, "delegates_to_desktop_live_adapter");
  assert.equal(
    review.summary.exampleBridgeMode,
    "simulated_desktop_primitive_envelopes"
  );
  assert.equal(review.summary.exampleOnly, true);
  assert.equal(review.summary.simulatedShellPrimitiveAllowed, true);
  assert.equal(review.summary.simulatedPatchPrimitiveAllowed, true);
  assert.equal(review.summary.realShellProcessAllowed, false);
  assert.equal(review.summary.realWorkspaceWriteAllowed, false);
  assert.equal(review.summary.hostExecutorDispatchSurfacePresent, false);
  assert.equal(review.summary.codexCliInvocationAllowedByExample, false);
  assert.equal(review.summary.providerInvocationAllowedByExample, false);
  assert.equal(review.summary.subAgentRuntimeInvocationAllowed, false);
  assert.equal(review.summary.exampleClientCallsDuringAudit, 0);
  assert.equal(review.summary.liveAdapterCallsDuringAudit, 0);
  assert.equal(review.summary.hostExecutorInvocationsDuringAudit, 0);
});

test("host client example boundary audit blocks missing registration", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewHostClientExampleBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "host-client-example-boundary",
      "archived-example-client"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit host-client-example-boundary",
      "npm run governance -- audit archived-example-client"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("host_client_example_boundary_governanceRunnerRegistered")
  );
  assert.ok(
    review.reasons.includes("host_client_example_boundary_governanceReadmeListsBoundary")
  );
});

test("host client example boundary audit blocks weakened example facade", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewHostClientExampleBoundaryAudit({
    ...input,
    hostClientExampleSourceText: input.hostClientExampleSourceText
      .replaceAll("runDesktopTask({", "runDesktopTaskBypass({")
      .replaceAll(
        "createPrimitiveSuccessEnvelope(\"shell_command\"",
        "runRealShellCommand("
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("host_client_example_boundary_exampleFacadeGuardsPresent")
  );
});

test("host client example boundary audit blocks host executor surface drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewHostClientExampleBoundaryAudit({
    ...input,
    hostClientExampleSourceText: input.hostClientExampleSourceText.concat(
      "\nfunction dispatchCurrentOperatorActionHostExecutor() {}\n"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("host_client_example_boundary_noHostExecutorSurface")
  );
});

test("host client example boundary audit blocks broadened docs", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewHostClientExampleBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText
      .replaceAll("Host client example boundary", "Archived host client example boundary")
      .concat("\nhost client example workspace-write allowed: true\n")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("host_client_example_boundary_controlPlaneBoundaryRecorded")
  );
  assert.ok(
    review.reasons.includes("host_client_example_boundary_noBroadExecutionAuthorization")
  );
});

test("host client example boundary audit output stays summarized", async () => {
  const review = reviewHostClientExampleBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatHostClientExampleBoundaryAuditResult(review);
  const json = formatHostClientExampleBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /example client calls during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<HostClientExampleBoundaryAuditInput> = {}
): Promise<HostClientExampleBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    hostClientExampleSourceText: await readFile(
      "packages/host-client-example/src/index.ts",
      "utf8"
    ),
    hostClientExampleTestText: await readFile(
      "tests/host-client-example.test.ts",
      "utf8"
    ),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    ...overrides
  };
}
