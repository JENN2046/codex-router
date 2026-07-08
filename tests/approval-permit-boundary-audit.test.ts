import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatApprovalPermitBoundaryAuditResult,
  reviewApprovalPermitBoundaryAudit,
  type ApprovalPermitBoundaryAuditInput
} from "../scripts/run-approval-permit-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("approval permit boundary audit passes for current evidence", async () => {
  const review = reviewApprovalPermitBoundaryAudit(
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
    review.summary.approvalPermitMode,
    "permit_creation_validation_revocation_and_store_only"
  );
  assert.equal(review.summary.validPermitIsProviderExecutionAuthorization, false);
  assert.equal(review.summary.validPermitIsCodexCliAuthorization, false);
  assert.equal(review.summary.validPermitIsSubAgentRuntimeAuthorization, false);
  assert.equal(review.summary.validPermitIsHostExecutorAuthorization, false);
  assert.equal(review.summary.validPermitIsToolRuntimeAuthorization, false);
  assert.equal(review.summary.shellCapabilityScopeIsShellExecution, false);
  assert.equal(review.summary.externalCapabilityScopeIsExternalWriteExecution, false);
  assert.equal(review.summary.storePersistenceIsWorkspaceWriteExecution, false);
  assert.equal(review.summary.approvalPermitCallsDuringAudit, 0);
  assert.equal(review.summary.permitValidationCallsDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
});

test("approval permit boundary audit blocks missing registration", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewApprovalPermitBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "approval-permit-boundary",
      "archived-approval-permit"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "approval-permit-boundary",
      "archived-approval-permit"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "approval_permit_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "approval_permit_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("approval permit boundary audit blocks missing control-plane authority", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewApprovalPermitBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText
      .replaceAll("Approval permit boundary", "Approval permit")
      .replaceAll(
        "valid permits are not provider execution authorization",
        "valid permits authorize provider execution"
      )
      .replaceAll(
        "approval permit store persistence is not workspace-write execution",
        "approval permit store persistence is workspace-write execution"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "approval_permit_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("approval permit boundary audit blocks source and test drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewApprovalPermitBoundaryAudit({
    ...input,
    approvalPermitSourceText: input.approvalPermitSourceText
      .replaceAll("validateApprovalPermit", "authorizeApprovalPermit")
      .replaceAll("missing_capability_scope", "scope_allowed_without_check"),
    approvalPermitTestText: input.approvalPermitTestText
      .replaceAll(
        "approval permit rejects missing requested capability scopes",
        "approval permit ignores missing requested capability scopes"
      )
      .replaceAll(
        "approval permit accepts external capability scopes",
        "approval permit executes external capability scopes"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("approval_permit_boundary_sourceMarkersRecorded")
  );
  assert.ok(
    review.reasons.includes("approval_permit_boundary_regressionCoverageRecorded")
  );
});

test("approval permit boundary audit blocks runtime invocation markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewApprovalPermitBoundaryAudit({
    ...input,
    approvalPermitSourceText: `${input.approvalPermitSourceText}
provider.execute(plan);
dispatchGovernanceOperatorActionHostExecutor(input);
spawnSubAgent(input);
`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("approval_permit_boundary_noRuntimeInvocationSurface")
  );
});

test("approval permit boundary audit formats sanitized text and json", async () => {
  const review = reviewApprovalPermitBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatApprovalPermitBoundaryAuditResult(review);
  const json = formatApprovalPermitBoundaryAuditResult(review, "json");
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
  overrides: Partial<ApprovalPermitBoundaryAuditInput> = {}
): Promise<ApprovalPermitBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    approvalPermitSourceText: await readFile(
      "packages/governance-internal-approval-permit/src/index.ts",
      "utf8"
    ),
    approvalPermitTestText: await readFile("tests/approval-permit.test.ts", "utf8"),
    ...overrides
  };
}
