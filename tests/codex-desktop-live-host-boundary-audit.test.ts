import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatCodexDesktopLiveHostBoundaryAuditResult,
  reviewCodexDesktopLiveHostBoundaryAudit,
  type CodexDesktopLiveHostBoundaryAuditInput
} from "../scripts/run-codex-desktop-live-host-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer ",
  "raw stdout",
  "raw stderr"
];

test("codex desktop live host boundary audit passes for current evidence", async () => {
  const review = reviewCodexDesktopLiveHostBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneBoundaryRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.liveHostCompositionGuardsPresent, true);
  assert.equal(review.checks.liveHostRegressionCoverageRecorded, true);
  assert.equal(review.checks.noCrossBoundaryExecutionBroadening, true);
  assert.equal(
    review.summary.liveHostMode,
    "explicit_current_host_runtime_and_memory_bundle"
  );
  assert.equal(review.summary.bundleCreationRequiresReadyHost, true);
  assert.equal(review.summary.runtimeMethodsRequired, true);
  assert.equal(review.summary.memoryMethodsRequired, true);
  assert.equal(review.summary.bridgeCreatedFromInjectedRuntime, true);
  assert.equal(review.summary.desktopHostClientCreatedWithInjectedBridge, true);
  assert.equal(review.summary.smokeCreatesBundleOnlyAfterReadiness, true);
  assert.equal(review.summary.defaultRuntimeToolInvocationAllowed, false);
  assert.equal(review.summary.codexCliInvocationAllowedByLiveHostBoundary, false);
  assert.equal(review.summary.providerInvocationAllowed, false);
  assert.equal(review.summary.subAgentRuntimeInvocationAllowed, false);
  assert.equal(review.summary.hostExecutorInvocationAllowed, false);
  assert.equal(review.summary.liveHostBundleCreationsDuringAudit, 0);
  assert.equal(review.summary.hostClientRunCallsDuringAudit, 0);
  assert.equal(review.summary.smokeRunsDuringAudit, 0);
});

test("codex desktop live host boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCodexDesktopLiveHostBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "codex-desktop-live-host-boundary",
      "archived-codex-desktop-live-host"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "codex_desktop_live_host_boundary_governanceRunnerRegistered"
    )
  );
});

test("codex desktop live host boundary audit blocks broadened control plane", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCodexDesktopLiveHostBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText
      .replaceAll(
        "Codex desktop live host boundary | active / explicit current host runtime and memory bundle | No by itself",
        "Codex desktop live host boundary | active | Yes"
      )
      .replaceAll(
        "does not authorize Codex CLI, provider execution, sub-agent runtime, host executor, workspace-write, or external write by itself",
        "Codex desktop live host Codex CLI invocation allowed: true"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "codex_desktop_live_host_boundary_controlPlaneBoundaryRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "codex_desktop_live_host_boundary_noCrossBoundaryExecutionBroadening"
    )
  );
});

test("codex desktop live host boundary audit blocks weakened readiness guard", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCodexDesktopLiveHostBoundaryAudit({
    ...input,
    liveHostSourceText: input.liveHostSourceText.replaceAll(
      "if (!inspection.ready || starterStatus.pendingRequiredMethods.length > 0)",
      "if (starterStatus.pendingRequiredMethods.length > 0)"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "codex_desktop_live_host_boundary_liveHostCompositionGuardsPresent"
    )
  );
});

test("codex desktop live host boundary audit output stays summarized", async () => {
  const review = reviewCodexDesktopLiveHostBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatCodexDesktopLiveHostBoundaryAuditResult(review);
  const json = formatCodexDesktopLiveHostBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /host client run calls during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<CodexDesktopLiveHostBoundaryAuditInput> = {}
): Promise<CodexDesktopLiveHostBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    liveHostSourceText: await readFile(
      "packages/codex-desktop-live-host/src/index.ts",
      "utf8"
    ),
    liveHostTestText: await readFile(
      "tests/codex-desktop-live-host.test.ts",
      "utf8"
    ),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    ...overrides
  };
}
