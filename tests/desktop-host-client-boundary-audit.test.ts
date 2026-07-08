import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatDesktopHostClientBoundaryAuditResult,
  reviewDesktopHostClientBoundaryAudit,
  type DesktopHostClientBoundaryAuditInput
} from "../scripts/run-desktop-host-client-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("desktop host client boundary audit passes for current evidence", async () => {
  const review = reviewDesktopHostClientBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneBoundaryRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.clientFacadeGuardsPresent, true);
  assert.equal(review.checks.publicApiDelegatesToInternalClient, true);
  assert.equal(review.checks.clientRegressionCoverageRecorded, true);
  assert.equal(review.checks.publicApiCoverageRecorded, true);
  assert.equal(review.summary.facadeMode, "desktop_host_client_facade");
  assert.equal(review.summary.runResumeMode, "delegates_to_desktop_live_adapter");
  assert.equal(
    review.summary.operatorActionDispatchMode,
    "review_or_explicit_injected_dispatch"
  );
  assert.equal(review.summary.bridgeOrBindingsRequired, true);
  assert.equal(review.summary.runDelegatesToLiveAdapter, true);
  assert.equal(review.summary.resumeDelegatesToLiveAdapter, true);
  assert.equal(review.summary.reviewUsesCurrentLifecycleOnly, true);
  assert.equal(review.summary.dispatchDelegatesToRecoveryControl, true);
  assert.equal(review.summary.dryRunDispatchAllowed, true);
  assert.equal(review.summary.executeInjectedDispatchAllowed, true);
  assert.equal(review.summary.defaultRealExecutionAllowed, false);
  assert.equal(review.summary.defaultHostExecutorLookupAllowed, false);
  assert.equal(review.summary.directDispatchToHostAllowedByClient, false);
  assert.equal(review.summary.codexCliInvocationAllowedByClient, false);
  assert.equal(review.summary.providerInvocationAllowedByClient, false);
  assert.equal(review.summary.subAgentRuntimeInvocationAllowed, false);
  assert.equal(review.summary.workspaceWriteAllowedByClient, false);
  assert.equal(review.summary.clientCallsDuringAudit, 0);
  assert.equal(review.summary.liveAdapterCallsDuringAudit, 0);
  assert.equal(review.summary.hostExecutorInvocationsDuringAudit, 0);
});

test("desktop host client boundary audit blocks missing registration", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewDesktopHostClientBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "desktop-host-client-boundary",
      "archived-desktop-client"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit desktop-host-client-boundary",
      "npm run governance -- audit archived-desktop-client"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("desktop_host_client_boundary_governanceRunnerRegistered")
  );
  assert.ok(
    review.reasons.includes("desktop_host_client_boundary_governanceReadmeListsBoundary")
  );
});

test("desktop host client boundary audit blocks weakened client facade", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewDesktopHostClientBoundaryAudit({
    ...input,
    desktopHostClientSourceText: input.desktopHostClientSourceText
      .replaceAll("runDesktopTask({", "runDesktopTaskBypass({")
      .replaceAll(
        "dispatchGovernanceOperatorActionHostExecutor({",
        "dispatchDirectHostExecutor({"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("desktop_host_client_boundary_clientFacadeGuardsPresent")
  );
});

test("desktop host client boundary audit blocks public API delegation drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewDesktopHostClientBoundaryAudit({
    ...input,
    publicApiHostSourceText: input.publicApiHostSourceText
      .replaceAll(
        "return this.inner.dispatchCurrentOperatorActionHostExecutor(",
        "return dispatchDirectlyFromPublicApi("
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "desktop_host_client_boundary_publicApiDelegatesToInternalClient"
    )
  );
});

test("desktop host client boundary audit blocks broadened docs", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewDesktopHostClientBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText
      .replaceAll("Desktop host client boundary", "Archived desktop host client boundary")
      .concat("\ndesktop host client provider invocation allowed: true\n")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("desktop_host_client_boundary_controlPlaneBoundaryRecorded")
  );
  assert.ok(
    review.reasons.includes("desktop_host_client_boundary_noBroadExecutionAuthorization")
  );
});

test("desktop host client boundary audit output stays summarized", async () => {
  const review = reviewDesktopHostClientBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatDesktopHostClientBoundaryAuditResult(review);
  const json = formatDesktopHostClientBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /client calls during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<DesktopHostClientBoundaryAuditInput> = {}
): Promise<DesktopHostClientBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    desktopHostClientSourceText: await readFile(
      "packages/desktop-host-client/src/index.ts",
      "utf8"
    ),
    publicApiHostSourceText: await readFile(
      "packages/public-api/src/host.ts",
      "utf8"
    ),
    desktopHostClientTestText: await readFile(
      "tests/desktop-host-client.test.ts",
      "utf8"
    ),
    publicApiSurfaceTestText: await readFile(
      "tests/public-api-surface.test.ts",
      "utf8"
    ),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    ...overrides
  };
}
