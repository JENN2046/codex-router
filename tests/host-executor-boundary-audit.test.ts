import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatHostExecutorBoundaryAuditResult,
  reviewHostExecutorBoundaryAudit,
  type HostExecutorBoundaryAuditInput
} from "../scripts/run-host-executor-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("host executor boundary audit passes for current boundary evidence", async () => {
  const review = reviewHostExecutorBoundaryAudit(await createInputFromWorkspace());

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.phase11CloseoutRecorded, true);
  assert.equal(review.checks.phase13CloseoutRecorded, true);
  assert.equal(review.checks.currentStateRecorded, true);
  assert.equal(review.checks.controlPlaneCapabilityRecorded, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.reviewSurfacePresent, true);
  assert.equal(review.checks.dispatchSurfacePresent, true);
  assert.equal(review.checks.explicitInjectionRequired, true);
  assert.equal(review.checks.dryRunDoesNotInvokeExecutor, true);
  assert.equal(review.checks.noGlobalHostLookup, true);
  assert.equal(review.checks.failClosedCoverageRecorded, true);
  assert.equal(review.checks.desktopHostClientIsolationRecorded, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.equal(review.summary.defaultRealExecutionAllowed, false);
  assert.equal(review.summary.hostExecutorInvocationsDuringAudit, 0);
});

test("host executor boundary audit blocks missing governance runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewHostExecutorBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "host-executor-boundary",
      "archived-host-executor"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("host_executor_boundary_governanceRunnerRegistered")
  );
});

test("host executor boundary audit blocks broadened Phase 13 authorization", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewHostExecutorBoundaryAudit({
    ...input,
    phase13CloseoutText: input.phase13CloseoutText
      .replaceAll("explicit-injection only", "implicit discovery allowed")
      .replaceAll("does not add a real host executor", "adds a real host executor")
      .replaceAll("does not invoke Codex CLI", "may invoke Codex CLI")
      .replaceAll("does not perform workspace-write", "may perform workspace-write")
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("host_executor_boundary_phase13CloseoutRecorded"));
  assert.ok(review.reasons.includes("host_executor_boundary_noBroadExecutionAuthorization"));
});

test("host executor boundary audit blocks weakened injected execution gate", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewHostExecutorBoundaryAudit({
    ...input,
    recoveryControlSourceText: input.recoveryControlSourceText.replaceAll(
      "input.auditSink === undefined",
      "false"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("host_executor_boundary_explicitInjectionRequired"));
});

test("host executor boundary audit output stays summarized", async () => {
  const review = reviewHostExecutorBoundaryAudit(await createInputFromWorkspace());
  const text = formatHostExecutorBoundaryAuditResult(review);
  const json = formatHostExecutorBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /host executor invocations during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<HostExecutorBoundaryAuditInput> = {}
): Promise<HostExecutorBoundaryAuditInput> {
  return {
    phase11CloseoutText: await readFile(
      "docs/governance/PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_CLOSEOUT.md",
      "utf8"
    ),
    phase13CloseoutText: await readFile(
      "docs/governance/PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_CLOSEOUT.md",
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
    recoveryControlTestText: await readFile("tests/recovery-control.test.ts", "utf8"),
    desktopHostClientTestText: await readFile("tests/desktop-host-client.test.ts", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    ...overrides
  };
}
