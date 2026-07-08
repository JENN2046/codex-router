import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatAgentTaskControlTaskbookBoundaryAuditResult,
  reviewAgentTaskControlTaskbookBoundaryAudit,
  type AgentTaskControlTaskbookBoundaryAuditInput
} from "../scripts/run-agent-task-control-taskbook-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("agent task-control taskbook boundary audit passes for current taskbooks", async () => {
  const review = reviewAgentTaskControlTaskbookBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.phase17TaskbookRecorded, true);
  assert.equal(review.checks.phase18TaskbookRecorded, true);
  assert.equal(review.checks.currentStateRecordsTaskbooks, true);
  assert.equal(review.checks.controlPlaneRecordsTaskbookAuthority, true);
  assert.equal(review.checks.governanceReadmeListsTaskbooks, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.phase17ApprovalRemainsInactive, true);
  assert.equal(review.checks.phase18ApprovalRemainsInactive, true);
  assert.equal(review.checks.taskControlOwnershipRemainsHostBound, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.equal(review.summary.dispatchClass, "agent_task_control");
  assert.equal(review.summary.sideEffectClass, "agent_context_only");
  assert.equal(review.summary.taskbookExecutionAuthorized, false);
  assert.equal(review.summary.subAgentRuntimeInvocationAllowed, false);
  assert.equal(review.summary.adapterInvocationsDuringAudit, 0);
});

test("agent task-control taskbook boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentTaskControlTaskbookBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "agent-task-control-taskbook-boundary",
      "archived-agent-task-control-taskbook"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_task_control_taskbook_boundary_governanceRunnerRegistered"
    )
  );
});

test("agent task-control taskbook boundary audit blocks active Phase 17 approval grants", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentTaskControlTaskbookBoundaryAudit({
    ...input,
    phase17TaskbookText: input.phase17TaskbookText
      .replaceAll(
        "No Phase 17 implementation approval is consumed by this taskbook",
        "Phase 17 implementation approval is consumed by this taskbook"
      )
      .replaceAll(
        "That string is not active unless Jenn provides it in a later task context",
        "That string is active without later task context"
      )
      .replaceAll(
        "Without that exact approval, continuation remains review, planning, or\ndocumentation only",
        "Without that exact approval, continuation may invoke task control"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_task_control_taskbook_boundary_phase17TaskbookRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_task_control_taskbook_boundary_phase17ApprovalRemainsInactive"
    )
  );
});

test("agent task-control taskbook boundary audit blocks broad Phase 18 sandbox approval", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentTaskControlTaskbookBoundaryAudit({
    ...input,
    phase18TaskbookText: input.phase18TaskbookText
      .replaceAll(
        "This taskbook is planning authority only. It does not authorize implementation\nor adapter invocation",
        "This taskbook authorizes implementation and adapter invocation"
      )
      .replaceAll(
        "That string is not active unless Jenn provides it in a later task context",
        "That string is active without later task context"
      )
      .replaceAll(
        "Vague instructions such as \"continue\", \"next phase\", \"sandbox dry-run\", or\nbranch names must not be treated as this approval",
        "Vague instructions may be treated as this approval"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_task_control_taskbook_boundary_phase18TaskbookRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_task_control_taskbook_boundary_phase18ApprovalRemainsInactive"
    )
  );
});

test("agent task-control taskbook boundary audit blocks weakened host ownership", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentTaskControlTaskbookBoundaryAudit({
    ...input,
    phase17TaskbookText: input.phase17TaskbookText.replaceAll(
      "The host layer, not `codex-router`, owns any future Codex, sub-agent, or agent\nruntime integration",
      "`codex-router` owns future Codex, sub-agent, or agent runtime integration"
    ),
    phase18TaskbookText: input.phase18TaskbookText.replaceAll(
      "The future sandbox adapter is a contract witness, not a recovery engine",
      "The future sandbox adapter is a recovery engine"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_task_control_taskbook_boundary_phase17TaskbookRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_task_control_taskbook_boundary_taskControlOwnershipRemainsHostBound"
    )
  );
});

test("agent task-control taskbook boundary audit output stays summarized", async () => {
  const review = reviewAgentTaskControlTaskbookBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatAgentTaskControlTaskbookBoundaryAuditResult(review);
  const json = formatAgentTaskControlTaskbookBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /taskbook execution authorized: false/);
  assert.match(text, /adapter invocations during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<AgentTaskControlTaskbookBoundaryAuditInput> = {}
): Promise<AgentTaskControlTaskbookBoundaryAuditInput> {
  return {
    phase17TaskbookText: await readFile(
      "docs/governance/PHASE_17_AGENT_TASK_CONTROL_DISPATCH_BOUNDARY_TASKBOOK.md",
      "utf8"
    ),
    phase18TaskbookText: await readFile(
      "docs/governance/PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md",
      "utf8"
    ),
    currentStateText: await readFile("docs/current/CURRENT_STATE.md", "utf8"),
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    ...overrides
  };
}
