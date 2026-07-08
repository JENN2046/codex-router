import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatAgentTaskControlSandboxBoundaryAuditResult,
  reviewAgentTaskControlSandboxBoundaryAudit,
  type AgentTaskControlSandboxBoundaryAuditInput
} from "../scripts/run-agent-task-control-sandbox-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("agent task control sandbox boundary audit passes for current boundary evidence", async () => {
  const review = reviewAgentTaskControlSandboxBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.phase17PrerequisiteRecorded, true);
  assert.equal(review.checks.phase18TaskbookRecorded, true);
  assert.equal(review.checks.phase18CloseoutRecorded, true);
  assert.equal(review.checks.currentStateRecorded, true);
  assert.equal(review.checks.controlPlaneCapabilityRecorded, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.implementationSurfacePresent, true);
  assert.equal(review.checks.separateAdapterKindEnforced, true);
  assert.equal(review.checks.explicitInjectionRequired, true);
  assert.equal(review.checks.failClosedBeforeAdapter, true);
  assert.equal(review.checks.sanitizedEvidenceBoundaryRecorded, true);
  assert.equal(review.checks.validationCoverageRecorded, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.equal(review.summary.dispatchClass, "agent_task_control");
  assert.equal(review.summary.sideEffectClass, "agent_context_only");
  assert.equal(review.summary.adapterKind, "sandbox_task_control_adapter");
  assert.equal(review.summary.realCodexCliCallsDuringAudit, 0);
  assert.equal(review.summary.adapterInvocationsDuringAudit, 0);
});

test("agent task control sandbox boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentTaskControlSandboxBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "agent-task-control-sandbox-boundary",
      "agent-task-control-sandbox-archived"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_task_control_sandbox_boundary_governanceRunnerRegistered"
    )
  );
});

test("agent task control sandbox boundary audit blocks missing Phase 18 current authority", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentTaskControlSandboxBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText
      .replaceAll(
        "[Phase 18 Agent Task Control Dispatch Sandbox Dry-Run Taskbook](PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md)",
        "[Archived Phase 18 Taskbook](PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md)"
      )
      .replaceAll(
        "| Agent task control dispatch sandbox dry-run closeout | `PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md` |",
        "| Archived task-control sandbox closeout | `PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md` |"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_task_control_sandbox_boundary_controlPlaneCapabilityRecorded"
    )
  );
});

test("agent task control sandbox boundary audit blocks broadened execution docs", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentTaskControlSandboxBoundaryAudit({
    ...input,
    phase18CloseoutText: input.phase18CloseoutText
      .replaceAll("It does not invoke Codex CLI", "It may invoke Codex CLI")
      .replaceAll("sandbox-only dry-run boundary", "production recovery boundary")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("agent_task_control_sandbox_boundary_phase18CloseoutRecorded")
  );
  assert.ok(
    review.reasons.includes(
      "agent_task_control_sandbox_boundary_noBroadExecutionAuthorization"
    )
  );
});

test("agent task control sandbox boundary audit blocks weakened injection gate", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentTaskControlSandboxBoundaryAudit({
    ...input,
    recoveryControlSourceText: input.recoveryControlSourceText.replaceAll(
      "input.evidenceSink === undefined",
      "false"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("agent_task_control_sandbox_boundary_explicitInjectionRequired")
  );
});

test("agent task control sandbox boundary audit output stays summarized", async () => {
  const review = reviewAgentTaskControlSandboxBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatAgentTaskControlSandboxBoundaryAuditResult(review);
  const json = formatAgentTaskControlSandboxBoundaryAuditResult(review, "json");
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
  overrides: Partial<AgentTaskControlSandboxBoundaryAuditInput> = {}
): Promise<AgentTaskControlSandboxBoundaryAuditInput> {
  return {
    phase17CloseoutText: await readFile(
      "docs/governance/PHASE_17_AGENT_TASK_CONTROL_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md",
      "utf8"
    ),
    phase18TaskbookText: await readFile(
      "docs/governance/PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_TASKBOOK.md",
      "utf8"
    ),
    phase18CloseoutText: await readFile(
      "docs/governance/PHASE_18_AGENT_TASK_CONTROL_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md",
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
    phase18TestText: await readFile(
      "tests/phase18-agent-task-control-dispatch-sandbox-dry-run.test.ts",
      "utf8"
    ),
    phase18FixtureText: await readFile(
      "tests/fixtures/phase18-sandbox-task-control-adapter.ts",
      "utf8"
    ),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    ...overrides
  };
}
