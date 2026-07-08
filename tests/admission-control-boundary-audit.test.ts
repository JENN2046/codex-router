import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatAdmissionControlBoundaryAuditResult,
  reviewAdmissionControlBoundaryAudit,
  type AdmissionControlBoundaryAuditInput
} from "../scripts/run-admission-control-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("admission control boundary audit passes for current evidence", async () => {
  const review = reviewAdmissionControlBoundaryAudit(
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
    review.summary.admissionControlMode,
    "admission_status_and_requirement_derivation_only"
  );
  assert.equal(review.summary.acceptedStatusIsExecutionAuthorization, false);
  assert.equal(review.summary.needsApprovalStatusIsApprovalGrant, false);
  assert.equal(review.summary.rejectedStatusIsRuntimeBlockExecution, false);
  assert.equal(review.summary.capabilityMatchIsRuntimeInvocation, false);
  assert.equal(review.summary.requiredApprovalIsProviderExecutionAuthorization, false);
  assert.equal(review.summary.requiredApprovalIsCodexCliAuthorization, false);
  assert.equal(review.summary.requiredApprovalIsSubAgentRuntimeAuthorization, false);
  assert.equal(review.summary.requiredApprovalIsHostExecutorAuthorization, false);
  assert.equal(review.summary.externalCapabilityIsExternalWriteExecution, false);
  assert.equal(review.summary.fileWriteCapabilityIsWorkspaceWriteExecution, false);
  assert.equal(review.summary.admissionControlCallsDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
});

test("admission control boundary audit blocks missing registration", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAdmissionControlBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "admission-control-boundary",
      "archived-admission-control"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "admission-control-boundary",
      "archived-admission-control"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "admission_control_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "admission_control_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("admission control boundary audit blocks missing control-plane authority", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAdmissionControlBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText
      .replaceAll("Admission control boundary", "Admission control")
      .replaceAll(
        "accepted status is not execution authorization",
        "accepted status authorizes execution"
      )
      .replaceAll(
        "file write capabilities are not workspace-write execution",
        "file write capabilities are workspace-write execution"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "admission_control_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("admission control boundary audit blocks source and test drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAdmissionControlBoundaryAudit({
    ...input,
    admissionControlSourceText: input.admissionControlSourceText
      .replaceAll("evaluateTaskAdmission", "authorizeTaskAdmission")
      .replaceAll("missing_required_write_capability", "write_capability_authorized"),
    admissionControlTestText: input.admissionControlTestText
      .replaceAll(
        "admission-control requires approval for external side effects",
        "admission-control executes external side effects"
      )
      .replaceAll(
        "admission-control preserves missing capability approvals when risk also requires approval",
        "admission-control ignores missing capability approvals"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("admission_control_boundary_sourceMarkersRecorded")
  );
  assert.ok(
    review.reasons.includes("admission_control_boundary_regressionCoverageRecorded")
  );
});

test("admission control boundary audit blocks runtime invocation markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAdmissionControlBoundaryAudit({
    ...input,
    admissionControlSourceText: `${input.admissionControlSourceText}
provider.execute(plan);
dispatchGovernanceOperatorActionHostExecutor(input);
spawnSubAgent(input);
`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("admission_control_boundary_noRuntimeInvocationSurface")
  );
});

test("admission control boundary audit formats sanitized text and json", async () => {
  const review = reviewAdmissionControlBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatAdmissionControlBoundaryAuditResult(review);
  const json = formatAdmissionControlBoundaryAuditResult(review, "json");
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
  overrides: Partial<AdmissionControlBoundaryAuditInput> = {}
): Promise<AdmissionControlBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    admissionControlSourceText: await readFile(
      "packages/admission-control/src/index.ts",
      "utf8"
    ),
    admissionControlTestText: await readFile("tests/admission-control.test.ts", "utf8"),
    ...overrides
  };
}
