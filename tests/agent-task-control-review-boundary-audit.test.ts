import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatAgentTaskControlReviewBoundaryAuditResult,
  reviewAgentTaskControlReviewBoundaryAudit,
  type AgentTaskControlReviewBoundaryAuditInput
} from "../scripts/run-agent-task-control-review-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("agent task control review boundary audit passes for current evidence", async () => {
  const review = reviewAgentTaskControlReviewBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.phase17TaskbookRecorded, true);
  assert.equal(review.checks.phase17CloseoutRecorded, true);
  assert.equal(review.checks.currentStateRecorded, true);
  assert.equal(review.checks.controlPlaneCapabilityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.implementationSurfacePresent, true);
  assert.equal(review.checks.taskControlClassConstrained, true);
  assert.equal(review.checks.phase16HashBindingRecorded, true);
  assert.equal(review.checks.operationRefsBoundToAction, true);
  assert.equal(review.checks.rollbackEvidenceSanitized, true);
  assert.equal(review.checks.failClosedCoverageRecorded, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.equal(review.summary.dispatchClass, "agent_task_control");
  assert.equal(review.summary.sideEffectClass, "agent_context_only");
  assert.equal(review.summary.boundaryMode, "review_only");
  assert.equal(review.summary.adapterInvocationAllowed, false);
  assert.equal(review.summary.subAgentRuntimeInvocationAllowed, false);
  assert.equal(review.summary.workspaceWriteAllowed, false);
  assert.equal(review.summary.adapterInvocationsDuringAudit, 0);
});

test("agent task control review boundary audit blocks missing runner and README entries", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentTaskControlReviewBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "agent-task-control-review-boundary",
      "archived-agent-task-control-review"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit agent-task-control-review-boundary",
      "npm run governance -- audit archived-agent-task-control-review"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_task_control_review_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_task_control_review_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("agent task control review boundary audit blocks broadened review docs", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentTaskControlReviewBoundaryAudit({
    ...input,
    phase17CloseoutText: input.phase17CloseoutText
      .replaceAll("requestedSideEffectClass = agent_context_only", "requestedSideEffectClass = workspace_write")
      .replaceAll("This closeout does not authorize", "This closeout authorizes")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_task_control_review_boundary_phase17CloseoutRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_task_control_review_boundary_noBroadExecutionAuthorization"
    )
  );
});

test("agent task control review boundary audit blocks weakened source literals", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentTaskControlReviewBoundaryAudit({
    ...input,
    recoveryControlSourceText: input.recoveryControlSourceText
      .replaceAll("requestedDispatchClass: \"agent_task_control\"", "requestedDispatchClass: \"review_only\"")
      .replaceAll("requestedSideEffectClass: \"agent_context_only\"", "requestedSideEffectClass: \"none\"")
      .replaceAll(
        "expectedAgentTaskControlOperationRef(packet.recommendedAction)",
        "packet.permittedTaskControlOperationRefs[0]"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_task_control_review_boundary_implementationSurfacePresent"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_task_control_review_boundary_taskControlClassConstrained"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_task_control_review_boundary_operationRefsBoundToAction"
    )
  );
});

test("agent task control review boundary audit blocks phase16 hash binding drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentTaskControlReviewBoundaryAudit({
    ...input,
    recoveryControlSourceText: input.recoveryControlSourceText.replaceAll(
      "operator_action_agent_task_control_dispatch_authorization_packet_phase16_review_hash_mismatch",
      "operator_action_agent_task_control_dispatch_authorization_packet_phase16_review_hash_ignored"
    ),
    phase17TestText: input.phase17TestText.replaceAll(
      "blocks phase16 review hash drift",
      "allows phase16 review hash drift"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_task_control_review_boundary_phase16HashBindingRecorded"
    )
  );
});

test("agent task control review boundary audit blocks raw rollback evidence drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentTaskControlReviewBoundaryAudit({
    ...input,
    phase17TestText: input.phase17TestText
      .replaceAll(
        "JSON.stringify(result).includes(checkpointRef), false",
        "JSON.stringify(result).includes(checkpointRef), true"
      )
      .replaceAll(
        "JSON.stringify(context.agentTaskControlDispatchAuthorizationPacket).includes(checkpointRef),\n    false",
        "JSON.stringify(context.agentTaskControlDispatchAuthorizationPacket).includes(checkpointRef),\n    true"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_task_control_review_boundary_rollbackEvidenceSanitized"
    )
  );
});

test("agent task control review boundary audit output stays summarized", async () => {
  const review = reviewAgentTaskControlReviewBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatAgentTaskControlReviewBoundaryAuditResult(review);
  const json = formatAgentTaskControlReviewBoundaryAuditResult(review, "json");
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
  overrides: Partial<AgentTaskControlReviewBoundaryAuditInput> = {}
): Promise<AgentTaskControlReviewBoundaryAuditInput> {
  return {
    phase17TaskbookText: await readFile(
      "docs/governance/PHASE_17_AGENT_TASK_CONTROL_DISPATCH_BOUNDARY_TASKBOOK.md",
      "utf8"
    ),
    phase17CloseoutText: await readFile(
      "docs/governance/PHASE_17_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md",
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
    phase17TestText: await readFile(
      "tests/phase17-agent-task-control-dispatch-authorization.test.ts",
      "utf8"
    ),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    ...overrides
  };
}
