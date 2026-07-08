import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatAgentExecutorAdapterTaskbookBoundaryAuditResult,
  reviewAgentExecutorAdapterTaskbookBoundaryAudit,
  type AgentExecutorAdapterTaskbookBoundaryAuditInput
} from "../scripts/run-agent-executor-adapter-taskbook-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("agent executor adapter taskbook boundary audit passes for current taskbooks", async () => {
  const review = reviewAgentExecutorAdapterTaskbookBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.phase15TaskbookRecorded, true);
  assert.equal(review.checks.phase16AuthorizationTaskbookRecorded, true);
  assert.equal(review.checks.phase16SandboxTaskbookRecorded, true);
  assert.equal(review.checks.currentStateRecordsTaskbooks, true);
  assert.equal(review.checks.controlPlaneRecordsTaskbookAuthority, true);
  assert.equal(review.checks.governanceReadmeListsTaskbooks, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.phase15ApprovalsRemainNarrow, true);
  assert.equal(review.checks.phase16CandidateApprovalsRemainInactive, true);
  assert.equal(review.checks.phase16SandboxApprovalRemainsNarrow, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.equal(review.summary.taskbookExecutionAuthorized, false);
  assert.equal(review.summary.adapterAutoDiscoveryAllowed, false);
  assert.equal(review.summary.adapterInvocationsDuringAudit, 0);
});

test("agent executor adapter taskbook boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentExecutorAdapterTaskbookBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "agent-executor-adapter-taskbook-boundary",
      "archived-agent-executor-adapter-taskbook"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_executor_adapter_taskbook_boundary_governanceRunnerRegistered"
    )
  );
});

test("agent executor adapter taskbook boundary audit blocks broadened Phase 15 adapter approval", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentExecutorAdapterTaskbookBoundaryAudit({
    ...input,
    phase15TaskbookText: input.phase15TaskbookText
      .replaceAll(
        "Real Codex-backed, sub-agent-backed, provider-backed, or workspace-write\nadapter approval is intentionally not defined here",
        "Real Codex-backed, sub-agent-backed, provider-backed, and workspace-write adapter approval is defined here"
      )
      .replaceAll(
        "The implemented boundary still cannot call an adapter",
        "The implemented boundary can call an adapter"
      )
      .replaceAll(
        "real recovery-action execution requires a separate taskbook",
        "real recovery-action execution is authorized by this taskbook"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_executor_adapter_taskbook_boundary_phase15TaskbookRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_executor_adapter_taskbook_boundary_phase15ApprovalsRemainNarrow"
    )
  );
});

test("agent executor adapter taskbook boundary audit blocks active Phase 16 candidate grants", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentExecutorAdapterTaskbookBoundaryAudit({
    ...input,
    phase16AuthorizationTaskbookText: input.phase16AuthorizationTaskbookText
      .replaceAll(
        "No Phase 16 implementation approval is consumed by this taskbook",
        "Phase 16 implementation approval is consumed by this taskbook"
      )
      .replaceAll(
        "These candidate strings are not active grants",
        "These candidate strings are active grants"
      )
      .replaceAll(
        "The next safe implementation stop is a non-executing review-only schema",
        "The next safe implementation stop is an executing dispatch runner"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_executor_adapter_taskbook_boundary_phase16AuthorizationTaskbookRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_executor_adapter_taskbook_boundary_phase16CandidateApprovalsRemainInactive"
    )
  );
});

test("agent executor adapter taskbook boundary audit blocks broadened sandbox dry-run semantics", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentExecutorAdapterTaskbookBoundaryAudit({
    ...input,
    phase16SandboxTaskbookText: input.phase16SandboxTaskbookText
      .replaceAll(
        "The sandbox dry-run is not business recovery execution",
        "The sandbox dry-run is business recovery execution"
      )
      .replaceAll(
        "must not be treated as this approval",
        "may be treated as this approval"
      )
      .replaceAll(
        "completed` means the sandbox dispatch transaction completed, not that recovery\ncompleted",
        "completed` means recovery completed"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_executor_adapter_taskbook_boundary_phase16SandboxTaskbookRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_executor_adapter_taskbook_boundary_phase16SandboxApprovalRemainsNarrow"
    )
  );
});

test("agent executor adapter taskbook boundary audit output stays summarized", async () => {
  const review = reviewAgentExecutorAdapterTaskbookBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatAgentExecutorAdapterTaskbookBoundaryAuditResult(review);
  const json = formatAgentExecutorAdapterTaskbookBoundaryAuditResult(review, "json");
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
  overrides: Partial<AgentExecutorAdapterTaskbookBoundaryAuditInput> = {}
): Promise<AgentExecutorAdapterTaskbookBoundaryAuditInput> {
  return {
    phase15TaskbookText: await readFile(
      "docs/governance/PHASE_15_AGENT_EXECUTOR_ADAPTER_AUTHORIZATION_TASKBOOK.md",
      "utf8"
    ),
    phase16AuthorizationTaskbookText: await readFile(
      "docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_TASKBOOK.md",
      "utf8"
    ),
    phase16SandboxTaskbookText: await readFile(
      "docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md",
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
