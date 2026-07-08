import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatAgentExecutorAdapterReviewBoundaryAuditResult,
  reviewAgentExecutorAdapterReviewBoundaryAudit,
  type AgentExecutorAdapterReviewBoundaryAuditInput
} from "../scripts/run-agent-executor-adapter-review-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("agent executor adapter review boundary audit passes for current evidence", async () => {
  const review = reviewAgentExecutorAdapterReviewBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.phase15ReviewOnlyRecorded, true);
  assert.equal(review.checks.phase16ReviewOnlyRecorded, true);
  assert.equal(review.checks.currentStateRecorded, true);
  assert.equal(review.checks.controlPlaneCapabilityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.implementationSurfacePresent, true);
  assert.equal(review.checks.reviewOnlyDescriptorConstrained, true);
  assert.equal(review.checks.dispatchReviewOnlyConstrained, true);
  assert.equal(review.checks.failClosedCoverageRecorded, true);
  assert.equal(review.checks.rollbackEvidenceSanitized, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.equal(review.summary.adapterKind, "sub_agent_adapter");
  assert.equal(review.summary.executionBoundary, "review_only");
  assert.equal(review.summary.invocationSupported, false);
  assert.equal(review.summary.sideEffectBoundary, "none");
  assert.equal(review.summary.dispatchClass, "review_only");
  assert.equal(review.summary.dispatchSideEffectClass, "none");
  assert.equal(review.summary.adapterInvocationAllowed, false);
  assert.equal(review.summary.subAgentRuntimeInvocationAllowed, false);
  assert.equal(review.summary.adapterInvocationsDuringAudit, 0);
});

test("agent executor adapter review boundary audit blocks missing runner and README entries", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentExecutorAdapterReviewBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "agent-executor-adapter-review-boundary",
      "archived-agent-executor-adapter-review"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit agent-executor-adapter-review-boundary",
      "npm run governance -- audit archived-agent-executor-adapter-review"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_executor_adapter_review_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_executor_adapter_review_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("agent executor adapter review boundary audit blocks broadened review docs", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentExecutorAdapterReviewBoundaryAudit({
    ...input,
    phase15ReviewCloseoutText: input.phase15ReviewCloseoutText
      .replaceAll("invocationSupported = false", "invocationSupported = true")
      .replaceAll("sideEffectBoundary = none", "sideEffectBoundary = workspace_write"),
    phase16ReviewCloseoutText: input.phase16ReviewCloseoutText.replaceAll(
      "This closeout does not authorize",
      "This closeout authorizes"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_executor_adapter_review_boundary_phase15ReviewOnlyRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_executor_adapter_review_boundary_noBroadExecutionAuthorization"
    )
  );
});

test("agent executor adapter review boundary audit blocks weakened source literals", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentExecutorAdapterReviewBoundaryAudit({
    ...input,
    recoveryControlSourceText: input.recoveryControlSourceText
      .replaceAll("invocationSupported: z.literal(false)", "invocationSupported: z.literal(true)")
      .replaceAll("requestedSideEffectClass: \"none\"", "requestedSideEffectClass: \"sandbox_only\"")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_executor_adapter_review_boundary_implementationSurfacePresent"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_executor_adapter_review_boundary_reviewOnlyDescriptorConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_executor_adapter_review_boundary_dispatchReviewOnlyConstrained"
    )
  );
});

test("agent executor adapter review boundary audit blocks raw rollback evidence drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentExecutorAdapterReviewBoundaryAudit({
    ...input,
    phase16AuthorizationTestText: input.phase16AuthorizationTestText
      .replaceAll(
        "JSON.stringify(result).includes(checkpointRef), false",
        "JSON.stringify(result).includes(checkpointRef), true"
      )
      .replaceAll(
        "JSON.stringify(context.dispatchAuthorizationPacket).includes(checkpointRef), false",
        "JSON.stringify(context.dispatchAuthorizationPacket).includes(checkpointRef), true"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_executor_adapter_review_boundary_rollbackEvidenceSanitized"
    )
  );
});

test("agent executor adapter review boundary audit output stays summarized", async () => {
  const review = reviewAgentExecutorAdapterReviewBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatAgentExecutorAdapterReviewBoundaryAuditResult(review);
  const json = formatAgentExecutorAdapterReviewBoundaryAuditResult(review, "json");
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
  overrides: Partial<AgentExecutorAdapterReviewBoundaryAuditInput> = {}
): Promise<AgentExecutorAdapterReviewBoundaryAuditInput> {
  return {
    phase15ReviewCloseoutText: await readFile(
      "docs/governance/PHASE_15_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_CLOSEOUT.md",
      "utf8"
    ),
    phase16ReviewCloseoutText: await readFile(
      "docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md",
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
    recoveryControlTestText: await readFile(
      "tests/recovery-control.test.ts",
      "utf8"
    ),
    phase16AuthorizationTestText: await readFile(
      "tests/phase16-agent-executor-adapter-dispatch-authorization.test.ts",
      "utf8"
    ),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    ...overrides
  };
}
