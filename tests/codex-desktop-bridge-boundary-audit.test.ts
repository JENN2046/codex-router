import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatCodexDesktopBridgeBoundaryAuditResult,
  reviewCodexDesktopBridgeBoundaryAudit,
  type CodexDesktopBridgeBoundaryAuditInput
} from "../scripts/run-codex-desktop-bridge-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer ",
  "super-secret-token",
  "raw-secret-token",
  "Begin Patch",
  "stdout",
  "stderr"
];

test("codex desktop bridge boundary audit passes for current evidence", async () => {
  const review = reviewCodexDesktopBridgeBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneBoundaryRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.bindingsSourceGuardsPresent, true);
  assert.equal(review.checks.liveAdapterBridgeHelpersPresent, true);
  assert.equal(review.checks.bindingsRegressionCoverageRecorded, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.equal(review.summary.bridgeMode, "explicit_injected_desktop_host_bridge");
  assert.equal(review.summary.runtimeToolInvocationAllowedByDefault, false);
  assert.equal(review.summary.explicitInjectedRuntimeRequired, true);
  assert.equal(review.summary.shellGovernancePolicySupported, true);
  assert.equal(review.summary.rawShellAllowedByDefault, false);
  assert.equal(review.summary.patchBodyStoredInResult, false);
  assert.equal(review.summary.secretRedactionRequired, true);
  assert.equal(review.summary.codexCliInvocationAllowed, false);
  assert.equal(review.summary.providerInvocationAllowed, false);
  assert.equal(review.summary.subAgentRuntimeInvocationAllowed, false);
  assert.equal(review.summary.hostExecutorInvocationAllowed, false);
  assert.equal(review.summary.bridgeCallsDuringAudit, 0);
  assert.equal(review.summary.runtimeToolCallsDuringAudit, 0);
});

test("codex desktop bridge boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCodexDesktopBridgeBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "codex-desktop-bridge-boundary",
      "archived-codex-desktop-bridge"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("codex_desktop_bridge_boundary_governanceRunnerRegistered")
  );
});

test("codex desktop bridge boundary audit blocks broadened control plane", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCodexDesktopBridgeBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText
      .replaceAll(
        "Codex desktop bridge boundary | active / explicit injected desktop host bridge | No by default",
        "Codex desktop bridge boundary | active | Yes"
      )
      .replaceAll(
        "runtime tool invocation is not default-authorized",
        "runtime tool invocation is default-authorized"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("codex_desktop_bridge_boundary_controlPlaneBoundaryRecorded")
  );
  assert.ok(
    review.reasons.includes("codex_desktop_bridge_boundary_noBroadExecutionAuthorization")
  );
});

test("codex desktop bridge boundary audit blocks weakened shell guard", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCodexDesktopBridgeBoundaryAudit({
    ...input,
    codexDesktopBindingsSourceText: input.codexDesktopBindingsSourceText.replaceAll(
      "codex_desktop_shell_raw_command_disallowed",
      "codex_desktop_shell_raw_command_allowed"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("codex_desktop_bridge_boundary_bindingsSourceGuardsPresent")
  );
});

test("codex desktop bridge boundary audit output stays summarized", async () => {
  const review = reviewCodexDesktopBridgeBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatCodexDesktopBridgeBoundaryAuditResult(review);
  const json = formatCodexDesktopBridgeBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /runtime tool calls during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<CodexDesktopBridgeBoundaryAuditInput> = {}
): Promise<CodexDesktopBridgeBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    codexDesktopBindingsSourceText: await readFile(
      "packages/codex-desktop-bindings/src/index.ts",
      "utf8"
    ),
    desktopLiveAdapterSourceText: await readFile(
      "packages/desktop-live-adapter/src/index.ts",
      "utf8"
    ),
    codexDesktopBindingsTestText: await readFile(
      "tests/codex-desktop-bindings.test.ts",
      "utf8"
    ),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    ...overrides
  };
}
