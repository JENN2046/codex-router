import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatApprovalConsumptionDispatchMatrixBoundaryAuditResult,
  reviewApprovalConsumptionDispatchMatrixBoundaryAudit,
  type ApprovalConsumptionDispatchMatrixBoundaryAuditInput
} from "../scripts/run-approval-consumption-dispatch-matrix-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("approval consumption dispatch matrix boundary audit passes for current evidence", async () => {
  const review = reviewApprovalConsumptionDispatchMatrixBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.matrixAuditRegistered, true);
  assert.equal(review.checks.matrixAuditGateRecorded, true);
  assert.equal(review.checks.matrixDocNonAuthorizationRecorded, true);
  assert.equal(review.checks.matrixCoverageRecorded, true);
  assert.equal(review.checks.noRuntimeInvocationSurface, true);
  assert.equal(review.checks.outputSanitized, true);
  assert.equal(
    review.summary.matrixBoundaryMode,
    "git_state_and_artifact_matrix_gate_only"
  );
  assert.equal(review.summary.matrixAuditIsProviderExecuteAuthorization, false);
  assert.equal(review.summary.matrixAuditIsRealCodexCliAuthorization, false);
  assert.equal(review.summary.matrixAuditIsWorkspaceWriteAuthorization, false);
  assert.equal(review.summary.matrixAuditIsHostExecutorAuthorization, false);
  assert.equal(review.summary.matrixAuditIsSubAgentRuntimeAuthorization, false);
  assert.equal(review.summary.matrixAuditIsToolRuntimeAuthorization, false);
  assert.equal(review.summary.matrixAuditGitStateIsExecutionAuthorization, false);
  assert.equal(
    review.summary.matrixAuditWorktreeCleanIsProviderExecutionAuthorization,
    false
  );
  assert.equal(review.summary.providerExecuteCallsDuringBoundaryAudit, 0);
  assert.equal(review.summary.codexCliCallsDuringBoundaryAudit, 0);
  assert.equal(review.summary.workspaceWriteCallsDuringBoundaryAudit, 0);
  assert.equal(review.summary.hostExecutorCallsDuringBoundaryAudit, 0);
  assert.equal(review.summary.subAgentRuntimeCallsDuringBoundaryAudit, 0);
});

test("approval consumption dispatch matrix boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewApprovalConsumptionDispatchMatrixBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "auditCheck(\"approval-consumption-dispatch-matrix-boundary\", \"scripts/run-approval-consumption-dispatch-matrix-boundary-audit.ts\"),",
      ""
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "approval_consumption_dispatch_matrix_boundary_governanceRunnerRegistered"
    )
  );
});

test("approval consumption dispatch matrix boundary audit blocks missing control-plane authority", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewApprovalConsumptionDispatchMatrixBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Approval consumption dispatch matrix boundary",
      "Archived approval consumption dispatch matrix boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "approval_consumption_dispatch_matrix_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("approval consumption dispatch matrix boundary audit blocks matrix gate drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewApprovalConsumptionDispatchMatrixBoundaryAudit({
    ...input,
    matrixAuditText: input.matrixAuditText
      .replaceAll("worktreeClean: input.gitStatusShort.trim() === \"\"", "worktreeClean: true")
      .replaceAll("providerExecuteCallsDuringMatrix: 0", "providerExecuteCallsDuringMatrix: 1")
      .replaceAll("workspaceWriteRejectBeforeSpawnCovered", "workspaceWriteMaySpawn")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "approval_consumption_dispatch_matrix_boundary_matrixAuditGateRecorded"
    )
  );
});

test("approval consumption dispatch matrix boundary audit blocks broadened matrix docs", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewApprovalConsumptionDispatchMatrixBoundaryAudit({
    ...input,
    matrixDocText: input.matrixDocText
      .replaceAll(
        "It does not authorize real provider execution",
        "It authorizes real provider execution"
      )
      .replaceAll("it does not run the real CLI", "it may run the real CLI")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "approval_consumption_dispatch_matrix_boundary_matrixDocNonAuthorizationRecorded"
    )
  );
});

test("approval consumption dispatch matrix boundary audit blocks missing coverage", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewApprovalConsumptionDispatchMatrixBoundaryAudit({
    ...input,
    matrixTestText: input.matrixTestText.replaceAll(
      "approval consumption dispatch matrix blocks reopened coverage gaps",
      "approval consumption dispatch matrix accepts reopened coverage gaps"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "approval_consumption_dispatch_matrix_boundary_matrixCoverageRecorded"
    )
  );
});

test("approval consumption dispatch matrix boundary audit blocks runtime invocation markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewApprovalConsumptionDispatchMatrixBoundaryAudit({
    ...input,
    matrixDocText: `${input.matrixDocText}\ndispatchToHost(action);`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "approval_consumption_dispatch_matrix_boundary_noRuntimeInvocationSurface"
    )
  );
});

test("approval consumption dispatch matrix boundary audit formats sanitized text and json", async () => {
  const review = reviewApprovalConsumptionDispatchMatrixBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatApprovalConsumptionDispatchMatrixBoundaryAuditResult(review);
  const json = formatApprovalConsumptionDispatchMatrixBoundaryAuditResult(
    review,
    "json"
  );
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /matrix boundary mode: git_state_and_artifact_matrix_gate_only/);
  assert.match(text, /provider execute calls during boundary audit: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.externalWriteCallsDuringBoundaryAudit, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<ApprovalConsumptionDispatchMatrixBoundaryAuditInput> = {}
): Promise<ApprovalConsumptionDispatchMatrixBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    matrixDocText: await readFile(
      "docs/governance/APPROVAL_CONSUMPTION_DISPATCH_AUDIT_MATRIX.md",
      "utf8"
    ),
    matrixAuditText: await readFile(
      "scripts/run-approval-consumption-dispatch-matrix-audit.ts",
      "utf8"
    ),
    matrixTestText: await readFile(
      "tests/approval-consumption-dispatch-matrix-audit.test.ts",
      "utf8"
    ),
    ...overrides
  };
}
