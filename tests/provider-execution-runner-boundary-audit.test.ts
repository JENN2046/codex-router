import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatProviderExecutionRunnerBoundaryAuditResult,
  reviewProviderExecutionRunnerBoundaryAudit,
  type ProviderExecutionRunnerBoundaryAuditInput
} from "../scripts/run-provider-execution-runner-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("provider execution runner boundary audit passes for current evidence", async () => {
  const review = reviewProviderExecutionRunnerBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneCapabilityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.controlledReadOnlyExecuteGatePresent, true);
  assert.equal(review.checks.runnerRegressionCoverageRecorded, true);
  assert.equal(review.checks.governanceStopCoverageRecorded, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.equal(review.summary.runnerMode, "controlled_readonly_and_workspace_write_gate");
  assert.equal(review.summary.controlledReadOnlyExecuteAllowed, true);
  assert.equal(review.summary.controlledReadOnlyProviderId, "codex-cli");
  assert.equal(review.summary.controlledReadOnlySideEffectClass, "read_only");
  assert.equal(review.summary.controlledReadOnlySandbox, "read-only");
  assert.equal(review.summary.permitRequired, true);
  assert.equal(review.summary.preflightArtifactBindingRequired, true);
  assert.equal(review.summary.realExecutionGuardRequired, true);
  assert.equal(review.summary.governanceStrategyStopBlocksBeforeProviderHooks, true);
  assert.equal(review.summary.simulateBlocksBeforeProviderHooks, true);
  assert.equal(review.summary.recoveryPhaseBlocksBeforeProviderHooks, true);
  assert.equal(review.summary.nonCodexProviderExecutionAllowed, false);
  assert.equal(review.summary.workspaceWriteAllowedByRunner, true);
  assert.equal(review.summary.workspaceWriteProviderExecuteAllowed, false);
  assert.equal(review.summary.defaultRealCodexCliAllowed, false);
  assert.equal(review.summary.providerRunnerCallsDuringAudit, 0);
  assert.equal(review.summary.providerPlanExecutionCallsDuringAudit, 0);
  assert.equal(review.summary.providerValidateExecutionPlanCallsDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
});

test("provider execution runner boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewProviderExecutionRunnerBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "provider-execution-runner-boundary",
      "archived-provider-execution-runner"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "provider_execution_runner_boundary_governanceRunnerRegistered"
    )
  );
});

test("provider execution runner boundary audit blocks weakened source guard", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewProviderExecutionRunnerBoundaryAudit({
    ...input,
    providerRunnerSourceText: input.providerRunnerSourceText
      .replaceAll(
        "controlled_readonly_requires_codex_cli_provider",
        "controlled_readonly_allows_any_provider"
      )
      .replaceAll(
        "controlled_readonly_environment_preflight_artifact_hash_required",
        "controlled_readonly_environment_preflight_artifact_hash_optional"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "provider_execution_runner_boundary_controlledReadOnlyExecuteGatePresent"
    )
  );
});

test("provider execution runner boundary audit blocks missing governance stop coverage", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewProviderExecutionRunnerBoundaryAudit({
    ...input,
    providerRunnerTestText: input.providerRunnerTestText
      .replaceAll(
        "provider execution runner blocks simulate-only governance states before provider hooks",
        "provider execution runner allows simulate-only governance states"
      )
      .replaceAll(
        "controlled_readonly_provider_governance_state_phase_blocked:recovery",
        "controlled_readonly_provider_governance_state_phase_allowed:recovery"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "provider_execution_runner_boundary_runnerRegressionCoverageRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "provider_execution_runner_boundary_governanceStopCoverageRecorded"
    )
  );
});

test("provider execution runner boundary audit blocks broadened docs", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewProviderExecutionRunnerBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText
      .replaceAll(
        "Provider execution runner boundary",
        "Archived provider execution runner boundary"
      )
      .concat("\nprovider execution runner workspace-write provider execute allowed: true\n")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "provider_execution_runner_boundary_controlPlaneCapabilityRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "provider_execution_runner_boundary_noBroadExecutionAuthorization"
    )
  );
});

test("provider execution runner boundary audit output stays summarized", async () => {
  const review = reviewProviderExecutionRunnerBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatProviderExecutionRunnerBoundaryAuditResult(review);
  const json = formatProviderExecutionRunnerBoundaryAuditResult(review, "json");
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
  overrides: Partial<ProviderExecutionRunnerBoundaryAuditInput> = {}
): Promise<ProviderExecutionRunnerBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    providerRunnerSourceText: await readFile(
      "packages/governance-internal-provider-execution-runner/src/index.ts",
      "utf8"
    ),
    providerRunnerTestText: await readFile(
      "tests/provider-execution-runner.test.ts",
      "utf8"
    ),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    ...overrides
  };
}
