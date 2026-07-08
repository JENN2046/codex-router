import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatApprovalGateBoundaryAuditResult,
  reviewApprovalGateBoundaryAudit,
  type ApprovalGateBoundaryAuditInput
} from "../scripts/run-approval-gate-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("approval gate boundary audit passes for current evidence", async () => {
  const review = reviewApprovalGateBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.sourceMarkersRecorded, true);
  assert.equal(review.checks.regressionCoverageRecorded, true);
  assert.equal(review.checks.noRuntimeInvocationSurface, true);
  assert.equal(
    review.summary.approvalGateMode,
    "approval_requirement_evaluation_only"
  );
  assert.equal(review.summary.approvalNotRequiredIsExecutionAuthorization, false);
  assert.equal(review.summary.approvalResolvedIsProviderExecutionAuthorization, false);
  assert.equal(review.summary.approvalResolvedIsCodexCliAuthorization, false);
  assert.equal(review.summary.approvalResolvedIsSubAgentRuntimeAuthorization, false);
  assert.equal(review.summary.approvalResolvedIsHostExecutorAuthorization, false);
  assert.equal(review.summary.approvalResolvedIsToolRuntimeAuthorization, false);
  assert.equal(review.summary.pendingGateIsRuntimeInvocation, false);
  assert.equal(review.summary.protectedBranchSignalIsWorkspaceWriteExecution, false);
  assert.equal(review.summary.dirtyWorkspaceSignalIsWorkspaceWriteExecution, false);
  assert.equal(review.summary.protectedKeywordSignalIsExternalWriteExecution, false);
  assert.equal(review.summary.approvalGateCallsDuringAudit, 0);
  assert.equal(review.summary.approvalResolutionChecksDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
});

test("approval gate boundary audit blocks missing registration", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewApprovalGateBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "approval-gate-boundary",
      "archived-approval-gate"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "approval-gate-boundary",
      "archived-approval-gate"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("approval_gate_boundary_governanceRunnerRegistered")
  );
  assert.ok(
    review.reasons.includes("approval_gate_boundary_governanceReadmeListsBoundary")
  );
});

test("approval gate boundary audit blocks missing control-plane authority", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewApprovalGateBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText
      .replaceAll("Approval gate boundary", "Approval gate")
      .replaceAll(
        "approval not_required status is not execution authorization",
        "approval not_required status authorizes execution"
      )
      .replaceAll(
        "protected branch and dirty workspace signals are not workspace-write execution",
        "protected branch and dirty workspace signals are workspace-write execution"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "approval_gate_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("approval gate boundary audit blocks source and test drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewApprovalGateBoundaryAudit({
    ...input,
    approvalGateSourceText: input.approvalGateSourceText
      .replaceAll("evaluateApprovalRequirement", "authorizeApprovalRequirement")
      .replaceAll("workspace:dirty", "workspace:executes"),
    approvalGateTestText: input.approvalGateTestText
      .replaceAll(
        "approval gate independently requires approval for protected write contexts",
        "approval gate authorizes protected write contexts"
      )
      .replaceAll("tool_access:protected_remote", "tool_access:execute_remote")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("approval_gate_boundary_sourceMarkersRecorded")
  );
  assert.ok(
    review.reasons.includes("approval_gate_boundary_regressionCoverageRecorded")
  );
});

test("approval gate boundary audit blocks runtime invocation markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewApprovalGateBoundaryAudit({
    ...input,
    approvalGateSourceText: `${input.approvalGateSourceText}
provider.execute(plan);
dispatchGovernanceOperatorActionHostExecutor(input);
spawnSubAgent(input);
`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("approval_gate_boundary_noRuntimeInvocationSurface")
  );
});

test("approval gate boundary audit formats sanitized text and json", async () => {
  const review = reviewApprovalGateBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatApprovalGateBoundaryAuditResult(review);
  const json = formatApprovalGateBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /provider execute calls during audit: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.providerExecuteCallsDuringAudit, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<ApprovalGateBoundaryAuditInput> = {}
): Promise<ApprovalGateBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    approvalGateSourceText: await readFile(
      "packages/governance-internal-approval-gate/src/index.ts",
      "utf8"
    ),
    approvalGateTestText: await readFile("tests/approval-gate.test.ts", "utf8"),
    ...overrides
  };
}
