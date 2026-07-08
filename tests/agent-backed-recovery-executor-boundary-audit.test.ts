import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatAgentBackedRecoveryExecutorBoundaryAuditResult,
  reviewAgentBackedRecoveryExecutorBoundaryAudit,
  type AgentBackedRecoveryExecutorBoundaryAuditInput
} from "../scripts/run-agent-backed-recovery-executor-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("agent-backed recovery executor boundary audit passes for current evidence", async () => {
  const review = reviewAgentBackedRecoveryExecutorBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.phase13BoundaryRecorded, true);
  assert.equal(review.checks.currentStateRecorded, true);
  assert.equal(review.checks.controlPlaneCapabilityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.sandboxReferenceFixtureConstrained, true);
  assert.equal(review.checks.sandboxReferenceTestCoverageRecorded, true);
  assert.equal(review.checks.taskControlSemanticsOnly, true);
  assert.equal(review.checks.sandboxEvidenceSanitized, true);
  assert.equal(review.checks.sandboxContainmentRecorded, true);
  assert.equal(review.checks.noProductionExecutorAuthorization, true);
  assert.equal(review.summary.executorBoundary, "host_provided_agent_backed");
  assert.equal(review.summary.sandboxReferenceKind, "sandbox_reference");
  assert.equal(review.summary.productionRecoveryExecutionAllowed, false);
  assert.equal(review.summary.codexCliAdapterAllowed, false);
  assert.equal(review.summary.subAgentRuntimeInvocationAllowedByRouter, false);
  assert.equal(review.summary.sandboxExecutorInvocationsDuringAudit, 0);
});

test("agent-backed recovery executor boundary audit blocks missing runner and README entries", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentBackedRecoveryExecutorBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "agent-backed-recovery-executor-boundary",
      "archived-agent-backed-boundary"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit agent-backed-recovery-executor-boundary",
      "npm run governance -- audit archived-agent-backed-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_backed_recovery_executor_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_backed_recovery_executor_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("agent-backed recovery executor boundary audit blocks production executor broadening", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentBackedRecoveryExecutorBoundaryAudit({
    ...input,
    phase13AgentBackedBoundaryText: input.phase13AgentBackedBoundaryText
      .replaceAll("not a production executor", "a production executor")
      .replaceAll("not a real business recovery run", "a real business recovery run")
      .replaceAll("This boundary does not authorize", "This boundary authorizes")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_backed_recovery_executor_boundary_phase13BoundaryRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_backed_recovery_executor_boundary_noProductionExecutorAuthorization"
    )
  );
});

test("agent-backed recovery executor boundary audit blocks weakened sandbox containment", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentBackedRecoveryExecutorBoundaryAudit({
    ...input,
    phase13FixtureText: input.phase13FixtureText
      .replaceAll("assertInsideSandbox(root, target)", "void target")
      .replaceAll("phase13_sandbox_symlink_escape", "phase13_sandbox_symlink_allowed")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_backed_recovery_executor_boundary_sandboxReferenceFixtureConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_backed_recovery_executor_boundary_sandboxContainmentRecorded"
    )
  );
});

test("agent-backed recovery executor boundary audit blocks raw evidence drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentBackedRecoveryExecutorBoundaryAudit({
    ...input,
    phase13FixtureText: input.phase13FixtureText
      .replaceAll("actionRefHash: stableSha256(invocation.actionRef)", "actionRef: invocation.actionRef")
      .replaceAll("checkpointRefHash: stableSha256(invocation.checkpointRef)", "checkpointRef: invocation.checkpointRef"),
    phase13TestText: input.phase13TestText.replaceAll(
      "serializedRecords.includes(checkpointRef), false",
      "serializedRecords.includes(checkpointRef), true"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_backed_recovery_executor_boundary_sandboxEvidenceSanitized"
    )
  );
});

test("agent-backed recovery executor boundary audit output stays summarized", async () => {
  const review = reviewAgentBackedRecoveryExecutorBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatAgentBackedRecoveryExecutorBoundaryAuditResult(review);
  const json = formatAgentBackedRecoveryExecutorBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /sandbox executor invocations during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<AgentBackedRecoveryExecutorBoundaryAuditInput> = {}
): Promise<AgentBackedRecoveryExecutorBoundaryAuditInput> {
  return {
    phase13AgentBackedBoundaryText: await readFile(
      "docs/governance/PHASE_13_AGENT_BACKED_RECOVERY_EXECUTOR_BOUNDARY.md",
      "utf8"
    ),
    currentStateText: await readFile("docs/current/CURRENT_STATE.md", "utf8"),
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    phase13TestText: await readFile(
      "tests/phase13-agent-backed-recovery-executor-boundary.test.ts",
      "utf8"
    ),
    phase13FixtureText: await readFile(
      "tests/fixtures/phase13-sandbox-reference-recovery-executor.ts",
      "utf8"
    ),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    ...overrides
  };
}
