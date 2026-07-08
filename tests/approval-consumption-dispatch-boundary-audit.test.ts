import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatApprovalConsumptionDispatchBoundaryAuditResult,
  reviewApprovalConsumptionDispatchBoundaryAudit,
  type ApprovalConsumptionDispatchBoundaryAuditInput
} from "../scripts/run-approval-consumption-dispatch-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("approval consumption dispatch boundary audit passes for current evidence", async () => {
  const review = reviewApprovalConsumptionDispatchBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.matrixMarkersPresent, true);
  assert.equal(review.checks.coverageRecorded, true);
  assert.equal(review.checks.noRuntimeInvocationSurface, true);
  assert.equal(review.checks.outputSanitized, true);
  assert.equal(
    review.summary.approvalConsumptionDispatchMode,
    "approval_consumption_dispatch_matrix_only"
  );
  assert.equal(review.summary.matrixIsProviderExecuteAuthorization, false);
  assert.equal(review.summary.matrixIsRealCodexCliAuthorization, false);
  assert.equal(review.summary.matrixIsWorkspaceWriteAuthorization, false);
  assert.equal(review.summary.matrixIsHostExecutorAuthorization, false);
  assert.equal(review.summary.matrixIsSubAgentRuntimeAuthorization, false);
  assert.equal(
    review.summary.approvalPermitConsumptionIsProviderExecutionAuthorization,
    false
  );
  assert.equal(
    review.summary.hostDispatcherPreconditionIsProviderExecuteAuthorization,
    false
  );
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.codexCliCallsDuringAudit, 0);
  assert.equal(review.summary.workspaceWriteCallsDuringAudit, 0);
  assert.equal(review.summary.hostExecutorCallsDuringAudit, 0);
  assert.equal(review.summary.subAgentRuntimeCallsDuringAudit, 0);
});

test("approval consumption dispatch boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewApprovalConsumptionDispatchBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "approval-consumption-dispatch-boundary",
      "archived-approval-consumption-dispatch"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "approval_consumption_dispatch_boundary_governanceRunnerRegistered"
    )
  );
});

test("approval consumption dispatch boundary audit blocks missing control-plane authority", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewApprovalConsumptionDispatchBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Approval consumption dispatch boundary",
      "Archived approval consumption dispatch"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "approval_consumption_dispatch_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("approval consumption dispatch boundary audit blocks matrix and coverage drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewApprovalConsumptionDispatchBoundaryAudit({
    ...input,
    matrixDocText: input.matrixDocText
      .replaceAll(
        "does not authorize real provider execution",
        "authorizes real provider execution"
      )
      .replaceAll(
        "read-only evidence remains separated from workspace-write and real execution",
        "read-only evidence may be reused as real execution"
      ),
    matrixTestText: input.matrixTestText.replaceAll(
      "approval consumption dispatch matrix blocks reopened coverage gaps",
      "approval consumption dispatch matrix accepts reopened coverage gaps"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "approval_consumption_dispatch_boundary_matrixMarkersPresent"
    )
  );
  assert.ok(
    review.reasons.includes(
      "approval_consumption_dispatch_boundary_coverageRecorded"
    )
  );
});

test("approval consumption dispatch boundary audit blocks runtime invocation markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewApprovalConsumptionDispatchBoundaryAudit({
    ...input,
    matrixDocText: `${input.matrixDocText}\ndispatchToHost(action);`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "approval_consumption_dispatch_boundary_noRuntimeInvocationSurface"
    )
  );
});

test("approval consumption dispatch boundary audit formats sanitized text and json", async () => {
  const review = reviewApprovalConsumptionDispatchBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatApprovalConsumptionDispatchBoundaryAuditResult(review);
  const json = formatApprovalConsumptionDispatchBoundaryAuditResult(
    review,
    "json"
  );
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(
    text,
    /approval consumption dispatch mode: approval_consumption_dispatch_matrix_only/
  );
  assert.match(text, /provider execute calls during audit: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.externalWriteCallsDuringAudit, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<ApprovalConsumptionDispatchBoundaryAuditInput> = {}
): Promise<ApprovalConsumptionDispatchBoundaryAuditInput> {
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
    matrixTestText: await readFile(
      "tests/approval-consumption-dispatch-matrix-audit.test.ts",
      "utf8"
    ),
    ...overrides
  };
}
