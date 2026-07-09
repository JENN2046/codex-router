import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatDesktopLiveAdapterDispatchBoundaryAuditResult,
  reviewDesktopLiveAdapterDispatchBoundaryAudit,
  type DesktopLiveAdapterDispatchBoundaryAuditInput
} from "../scripts/run-desktop-live-adapter-dispatch-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer ",
  "raw stdout",
  "raw stderr"
];

test("desktop live adapter dispatch boundary audit passes for current evidence", async () => {
  const review = reviewDesktopLiveAdapterDispatchBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneBoundaryRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.liveAdapterDispatchGuardsPresent, true);
  assert.equal(review.checks.hostClientForwardingGuardsPresent, true);
  assert.equal(review.checks.liveAdapterRegressionCoverageRecorded, true);
  assert.equal(review.checks.governanceFailureCoverageRecorded, true);
  assert.equal(review.checks.hostClientBoundaryCoverageRecorded, true);
  assert.equal(review.checks.noCrossRouteExecutionBroadening, true);
  assert.equal(review.summary.dispatchMode, "route_separated_host_dispatch_or_desktop_bridge");
  assert.equal(review.summary.codexCliHostDispatchAllowedWhenReadyAndRouted, true);
  assert.equal(review.summary.desktopPrimitiveExecutionAllowedWhenDesktopRouted, true);
  assert.equal(review.summary.blockedDecisionExecutionAllowed, false);
  assert.equal(review.summary.handlersOrBridgeRequiredForDesktopRoute, true);
  assert.equal(review.summary.governanceStateTaskScopeRequiredBeforeExecution, true);
  assert.equal(
    review.summary.controlledWorkspaceWriteDispatchAllowedWhenReadyAndLocalWrite,
    true
  );
  assert.equal(
    review.summary.controlledWorkspaceWriteDispatchFailureCreatesExecutionObservation,
    true
  );
  assert.equal(review.summary.bridgeInvocationAllowedByCodexCliRoute, false);
  assert.equal(review.summary.providerInvocationAllowedByDesktopLiveAdapter, false);
  assert.equal(review.summary.generalWorkspaceWriteExecutionAllowed, false);
  assert.equal(review.summary.workspaceWriteProviderExecuteAllowed, false);
  assert.equal(review.summary.liveAdapterCallsDuringAudit, 0);
  assert.equal(review.summary.dispatchToHostCallsDuringAudit, 0);
});

test("desktop live adapter dispatch boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewDesktopLiveAdapterDispatchBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "desktop-live-adapter-dispatch-boundary",
      "archived-desktop-live-adapter-dispatch"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "desktop_live_adapter_dispatch_boundary_governanceRunnerRegistered"
    )
  );
});

test("desktop live adapter dispatch boundary audit blocks broadened control plane", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewDesktopLiveAdapterDispatchBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText
      .replaceAll(
        "Desktop live adapter dispatch boundary | active / route-separated host dispatch or desktop bridge | No by itself",
        "Desktop live adapter dispatch boundary | active | Yes"
      )
      .replaceAll(
        "codex-cli routes do not invoke desktop bridge handlers",
        "codex-cli routes may invoke desktop bridge handlers"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "desktop_live_adapter_dispatch_boundary_controlPlaneBoundaryRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "desktop_live_adapter_dispatch_boundary_noCrossRouteExecutionBroadening"
    )
  );
});

test("desktop live adapter dispatch boundary audit blocks weakened route guard", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewDesktopLiveAdapterDispatchBoundaryAudit({
    ...input,
    desktopLiveAdapterSourceText: input.desktopLiveAdapterSourceText.replaceAll(
      "decisionResult.status === \"ready\" && decisionResult.decision.hostRoute === \"codex-cli\"",
      "decisionResult.decision.hostRoute === \"codex-cli\""
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "desktop_live_adapter_dispatch_boundary_liveAdapterDispatchGuardsPresent"
    )
  );
});

test("desktop live adapter dispatch boundary audit output stays summarized", async () => {
  const review = reviewDesktopLiveAdapterDispatchBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatDesktopLiveAdapterDispatchBoundaryAuditResult(review);
  const json = formatDesktopLiveAdapterDispatchBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /controlled workspace-write dispatch allowed when ready and local-write: true/);
  assert.match(text, /dispatchToHost calls during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<DesktopLiveAdapterDispatchBoundaryAuditInput> = {}
): Promise<DesktopLiveAdapterDispatchBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    desktopLiveAdapterSourceText: await readFile(
      "packages/desktop-live-adapter/src/index.ts",
      "utf8"
    ),
    desktopHostClientSourceText: await readFile(
      "packages/desktop-host-client/src/index.ts",
      "utf8"
    ),
    desktopLiveAdapterTestText: await readFile(
      "tests/desktop-live-adapter.test.ts",
      "utf8"
    ),
    desktopLiveAdapterGovernanceTestText: await readFile(
      "tests/desktop-live-adapter-governance.test.ts",
      "utf8"
    ),
    desktopHostClientTestText: await readFile(
      "tests/desktop-host-client.test.ts",
      "utf8"
    ),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    ...overrides
  };
}
