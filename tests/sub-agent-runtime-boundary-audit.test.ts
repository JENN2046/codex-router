import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatSubAgentRuntimeBoundaryAuditResult,
  reviewSubAgentRuntimeBoundaryAudit,
  type SubAgentRuntimeBoundaryAuditInput
} from "../scripts/run-sub-agent-runtime-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("sub-agent runtime boundary audit passes for current evidence", async () => {
  const review = reviewSubAgentRuntimeBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.phase13AgentBackedBoundaryRecorded, true);
  assert.equal(review.checks.phase15ReviewOnlyRecorded, true);
  assert.equal(review.checks.phase15SandboxContractRecorded, true);
  assert.equal(review.checks.phase16ReviewOnlyRecorded, true);
  assert.equal(review.checks.phase16SandboxDryRunRecorded, true);
  assert.equal(review.checks.phase17TaskControlReviewOnlyRecorded, true);
  assert.equal(review.checks.phase18TaskControlSandboxRecorded, true);
  assert.equal(review.checks.controlPlaneCapabilityRecorded, true);
  assert.equal(review.checks.reviewOnlySubAgentIdentityConstrained, true);
  assert.equal(review.checks.sandboxAdaptersConstrained, true);
  assert.equal(review.checks.taskControlSandboxConstrained, true);
  assert.equal(review.checks.failClosedCoverageRecorded, true);
  assert.equal(review.checks.noBroadRuntimeAuthorization, true);
  assert.equal(review.summary.reviewAdapterKind, "sub_agent_adapter");
  assert.equal(review.summary.reviewInvocationSupported, false);
  assert.equal(review.summary.subAgentRuntimeExecutionAllowed, false);
  assert.equal(review.summary.subAgentRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.adapterInvocationsDuringAudit, 0);
});

test("sub-agent runtime boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewSubAgentRuntimeBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "sub-agent-runtime-boundary",
      "archived-agent-runtime-review"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("sub_agent_runtime_boundary_governanceRunnerRegistered")
  );
});

test("sub-agent runtime boundary audit blocks broadened review descriptor", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewSubAgentRuntimeBoundaryAudit({
    ...input,
    recoveryControlSourceText: input.recoveryControlSourceText.replaceAll(
      "invocationSupported: z.literal(false)",
      "invocationSupported: z.literal(true)"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "sub_agent_runtime_boundary_reviewOnlySubAgentIdentityConstrained"
    )
  );
  assert.ok(
    review.reasons.includes("sub_agent_runtime_boundary_noBroadRuntimeAuthorization")
  );
});

test("sub-agent runtime boundary audit blocks broadened docs", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewSubAgentRuntimeBoundaryAudit({
    ...input,
    phase15ReviewCloseoutText: input.phase15ReviewCloseoutText
      .replaceAll("executionBoundary = review_only", "executionBoundary = execute_runtime")
      .replaceAll("invocationSupported = false", "invocationSupported = true")
      .replaceAll(
        "sub-agent process or runtime invocation",
        "sub-agent runtime execution authorized"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("sub_agent_runtime_boundary_phase15ReviewOnlyRecorded")
  );
  assert.ok(
    review.reasons.includes("sub_agent_runtime_boundary_noBroadRuntimeAuthorization")
  );
});

test("sub-agent runtime boundary audit output stays summarized", async () => {
  const review = reviewSubAgentRuntimeBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatSubAgentRuntimeBoundaryAuditResult(review);
  const json = formatSubAgentRuntimeBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /sub-agent runtime calls during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<SubAgentRuntimeBoundaryAuditInput> = {}
): Promise<SubAgentRuntimeBoundaryAuditInput> {
  return {
    phase13AgentBackedBoundaryText: await readFile(
      "docs/governance/PHASE_13_AGENT_BACKED_RECOVERY_EXECUTOR_BOUNDARY.md",
      "utf8"
    ),
    phase15ReviewCloseoutText: await readFile(
      "docs/governance/PHASE_15_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_CLOSEOUT.md",
      "utf8"
    ),
    phase15SandboxCloseoutText: await readFile(
      "docs/governance/PHASE_15_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_CLOSEOUT.md",
      "utf8"
    ),
    phase16ReviewCloseoutText: await readFile(
      "docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md",
      "utf8"
    ),
    phase16SandboxCloseoutText: await readFile(
      "docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md",
      "utf8"
    ),
    phase17CloseoutText: await readFile(
      "docs/governance/PHASE_17_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md",
      "utf8"
    ),
    phase18CloseoutText: await readFile(
      "docs/governance/PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md",
      "utf8"
    ),
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    recoveryControlSourceText: await readFile(
      "packages/governance-internal-recovery-control/src/index.ts",
      "utf8"
    ),
    recoveryControlTestText: await readFile("tests/recovery-control.test.ts", "utf8"),
    phase15SandboxTestText: await readFile(
      "tests/phase15-agent-executor-adapter-sandbox-contract.test.ts",
      "utf8"
    ),
    phase16AuthorizationTestText: await readFile(
      "tests/phase16-agent-executor-adapter-dispatch-authorization.test.ts",
      "utf8"
    ),
    phase16SandboxTestText: await readFile(
      "tests/phase16-agent-executor-adapter-dispatch-sandbox-dry-run.test.ts",
      "utf8"
    ),
    phase17AuthorizationTestText: await readFile(
      "tests/phase17-agent-task-control-dispatch-authorization.test.ts",
      "utf8"
    ),
    phase18SandboxTestText: await readFile(
      "tests/phase18-agent-task-control-dispatch-sandbox-dry-run.test.ts",
      "utf8"
    ),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    ...overrides
  };
}
