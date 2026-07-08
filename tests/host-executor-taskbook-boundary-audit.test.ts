import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatHostExecutorTaskbookBoundaryAuditResult,
  reviewHostExecutorTaskbookBoundaryAudit,
  type HostExecutorTaskbookBoundaryAuditInput
} from "../scripts/run-host-executor-taskbook-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("host executor taskbook boundary audit passes for current taskbook authority", async () => {
  const review = reviewHostExecutorTaskbookBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.phase11TaskbookRecorded, true);
  assert.equal(review.checks.phase13TaskbookRecorded, true);
  assert.equal(review.checks.currentStateRecordsTaskbooks, true);
  assert.equal(review.checks.controlPlaneRecordsTaskbookAuthority, true);
  assert.equal(review.checks.governanceReadmeListsTaskbooks, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.phase11ImplementationGateRemainsNonExecuting, true);
  assert.equal(review.checks.phase13DispatchGateRemainsAuthorizationStop, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.equal(review.summary.taskbookExecutionAuthorized, false);
  assert.equal(review.summary.hostExecutorInvocationsDuringAudit, 0);
  assert.equal(review.summary.recoveryActionDispatchCallsDuringAudit, 0);
});

test("host executor taskbook boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewHostExecutorTaskbookBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "host-executor-taskbook-boundary",
      "archived-host-executor-taskbook"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "host_executor_taskbook_boundary_governanceRunnerRegistered"
    )
  );
});

test("host executor taskbook boundary audit blocks weakened Phase 11 non-executing gate", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewHostExecutorTaskbookBoundaryAudit({
    ...input,
    phase11TaskbookText: input.phase11TaskbookText
      .replaceAll("Exact token for a later non-executing implementation gate", "Exact token for implementation")
      .replaceAll("without calling the executor", "after calling the executor")
      .replaceAll("Recovery execution remains closed", "Recovery execution may proceed")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "host_executor_taskbook_boundary_phase11TaskbookRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "host_executor_taskbook_boundary_phase11ImplementationGateRemainsNonExecuting"
    )
  );
});

test("host executor taskbook boundary audit blocks weakened Phase 13 authorization stop", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewHostExecutorTaskbookBoundaryAudit({
    ...input,
    phase13TaskbookText: input.phase13TaskbookText
      .replaceAll("blocked until Jenn explicitly authorizes", "open without explicit authorization")
      .replaceAll("Stop and report `BLOCK` unless", "Continue unless")
      .replaceAll("read-only review of this taskbook", "dispatch review of this taskbook")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "host_executor_taskbook_boundary_phase13TaskbookRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "host_executor_taskbook_boundary_phase13DispatchGateRemainsAuthorizationStop"
    )
  );
});

test("host executor taskbook boundary audit blocks broadened authority docs", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewHostExecutorTaskbookBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "not execution authorization",
      "execution authorization"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "not recovery-action execution\n  authorization",
      "recovery-action execution authorization"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "host_executor_taskbook_boundary_controlPlaneRecordsTaskbookAuthority"
    )
  );
});

test("host executor taskbook boundary audit output stays summarized", async () => {
  const review = reviewHostExecutorTaskbookBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatHostExecutorTaskbookBoundaryAuditResult(review);
  const json = formatHostExecutorTaskbookBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /taskbook execution authorized: false/);
  assert.match(text, /host executor invocations during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<HostExecutorTaskbookBoundaryAuditInput> = {}
): Promise<HostExecutorTaskbookBoundaryAuditInput> {
  return {
    phase11TaskbookText: await readFile(
      "docs/governance/PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_TASKBOOK.md",
      "utf8"
    ),
    phase13TaskbookText: await readFile(
      "docs/governance/PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_TASKBOOK.md",
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
