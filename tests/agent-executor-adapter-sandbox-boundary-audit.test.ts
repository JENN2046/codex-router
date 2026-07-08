import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatAgentExecutorAdapterSandboxBoundaryAuditResult,
  reviewAgentExecutorAdapterSandboxBoundaryAudit,
  type AgentExecutorAdapterSandboxBoundaryAuditInput
} from "../scripts/run-agent-executor-adapter-sandbox-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("agent executor adapter sandbox boundary audit passes for current evidence", async () => {
  const review = reviewAgentExecutorAdapterSandboxBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.phase15SandboxContractRecorded, true);
  assert.equal(review.checks.phase16SandboxDryRunRecorded, true);
  assert.equal(review.checks.currentStateRecorded, true);
  assert.equal(review.checks.controlPlaneCapabilityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.implementationSurfacePresent, true);
  assert.equal(review.checks.sandboxReferenceFixtureConstrained, true);
  assert.equal(review.checks.failClosedCoverageRecorded, true);
  assert.equal(review.checks.sandboxEvidenceSanitized, true);
  assert.equal(review.checks.sandboxContainmentRecorded, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.equal(review.summary.adapterKind, "sandbox_reference_adapter");
  assert.equal(review.summary.sideEffectBoundary, "sandbox_only");
  assert.equal(review.summary.dispatchClass, "sandbox_contract");
  assert.equal(review.summary.productionRecoveryExecutionAllowed, false);
  assert.equal(review.summary.subAgentRuntimeAdapterAllowed, false);
  assert.equal(review.summary.adapterInvocationsDuringAudit, 0);
});

test("agent executor adapter sandbox boundary audit blocks missing runner and README entries", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentExecutorAdapterSandboxBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "agent-executor-adapter-sandbox-boundary",
      "archived-agent-executor-sandbox"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit agent-executor-adapter-sandbox-boundary",
      "npm run governance -- audit archived-agent-executor-sandbox"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_executor_adapter_sandbox_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_executor_adapter_sandbox_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("agent executor adapter sandbox boundary audit blocks broadened sandbox docs", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentExecutorAdapterSandboxBoundaryAudit({
    ...input,
    phase16SandboxCloseoutText: input.phase16SandboxCloseoutText
      .replaceAll("requestedSideEffectClass = sandbox_only", "requestedSideEffectClass = workspace_write")
      .replaceAll("This closeout does not authorize", "This closeout authorizes")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_executor_adapter_sandbox_boundary_phase16SandboxDryRunRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_executor_adapter_sandbox_boundary_noBroadExecutionAuthorization"
    )
  );
});

test("agent executor adapter sandbox boundary audit blocks weakened sandbox containment", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentExecutorAdapterSandboxBoundaryAudit({
    ...input,
    phase15FixtureText: input.phase15FixtureText
      .replaceAll("assertInsideSandbox(root, target)", "void target")
      .replaceAll("phase15_sandbox_symlink_escape", "phase15_sandbox_symlink_allowed")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_executor_adapter_sandbox_boundary_sandboxReferenceFixtureConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_executor_adapter_sandbox_boundary_sandboxContainmentRecorded"
    )
  );
});

test("agent executor adapter sandbox boundary audit blocks raw rollback evidence drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentExecutorAdapterSandboxBoundaryAudit({
    ...input,
    phase15FixtureText: input.phase15FixtureText.replaceAll(
      "checkpointRefHash: stableSha256(invocation.checkpointRef)",
      "checkpointRef: invocation.checkpointRef"
    ),
    phase16TestText: input.phase16TestText.replaceAll(
      "JSON.stringify(result).includes(checkpointRef), false",
      "JSON.stringify(result).includes(checkpointRef), true"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_executor_adapter_sandbox_boundary_sandboxEvidenceSanitized"
    )
  );
});

test("agent executor adapter sandbox boundary audit output stays summarized", async () => {
  const review = reviewAgentExecutorAdapterSandboxBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatAgentExecutorAdapterSandboxBoundaryAuditResult(review);
  const json = formatAgentExecutorAdapterSandboxBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /adapter invocations during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<AgentExecutorAdapterSandboxBoundaryAuditInput> = {}
): Promise<AgentExecutorAdapterSandboxBoundaryAuditInput> {
  return {
    phase15SandboxCloseoutText: await readFile(
      "docs/governance/PHASE_15_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_CLOSEOUT.md",
      "utf8"
    ),
    phase16SandboxCloseoutText: await readFile(
      "docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md",
      "utf8"
    ),
    currentStateText: await readFile("docs/current/CURRENT_STATE.md", "utf8"),
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    recoveryControlSourceText: await readFile(
      "packages/governance-internal-recovery-control/src/index.ts",
      "utf8"
    ),
    phase15TestText: await readFile(
      "tests/phase15-agent-executor-adapter-sandbox-contract.test.ts",
      "utf8"
    ),
    phase16TestText: await readFile(
      "tests/phase16-agent-executor-adapter-dispatch-sandbox-dry-run.test.ts",
      "utf8"
    ),
    phase15FixtureText: await readFile(
      "tests/fixtures/phase15-sandbox-reference-agent-executor-adapter.ts",
      "utf8"
    ),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    ...overrides
  };
}
