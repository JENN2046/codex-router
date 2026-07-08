import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatDelegationPolicyBoundaryAuditResult,
  reviewDelegationPolicyBoundaryAudit,
  type DelegationPolicyBoundaryAuditInput
} from "../scripts/run-delegation-policy-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("delegation policy boundary audit passes for current evidence", async () => {
  const review = reviewDelegationPolicyBoundaryAudit(
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
    review.summary.delegationPolicyMode,
    "delegation_level_approval_requirement_and_recovery_filter_only"
  );
  assert.equal(review.summary.fullDelegationIsExecutionAuthorization, false);
  assert.equal(review.summary.requiresApprovalFalseIsExecutionAuthorization, false);
  assert.equal(review.summary.approvedProposalIsRuntimeAuthorization, false);
  assert.equal(review.summary.appliedProposalIsProviderExecutionAuthorization, false);
  assert.equal(review.summary.filteredRecoveryActionIsHostExecutorAuthorization, false);
  assert.equal(review.summary.recoveryActionListIsRecoveryExecution, false);
  assert.equal(review.summary.historicalTrustIsRuntimeAuthorization, false);
  assert.equal(review.summary.recordedResumeIsRuntimeInvocation, false);
  assert.equal(review.summary.fileStorePersistenceIsWorkspaceWriteExecution, false);
  assert.equal(review.summary.delegationPolicyCallsDuringAudit, 0);
  assert.equal(review.summary.fileStoreWritesDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
});

test("delegation policy boundary audit blocks missing registration", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewDelegationPolicyBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "delegation-policy-boundary",
      "archived-delegation-policy"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "delegation-policy-boundary",
      "archived-delegation-policy"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "delegation_policy_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "delegation_policy_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("delegation policy boundary audit blocks missing control-plane authority", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewDelegationPolicyBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText
      .replaceAll("Delegation policy boundary", "Delegation policy")
      .replaceAll(
        "full_delegation is not execution authorization",
        "full_delegation authorizes execution"
      )
      .replaceAll(
        "delegation file-store persistence is not workspace-write execution",
        "delegation file-store persistence is workspace-write execution"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "delegation_policy_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("delegation policy boundary audit blocks source and test drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewDelegationPolicyBoundaryAudit({
    ...input,
    delegationPolicySourceText: input.delegationPolicySourceText
      .replaceAll("calculateDelegationLevel", "authorizeDelegationLevel")
      .replaceAll("filterRecoveryActions", "executeRecoveryActions"),
    delegationPolicyTestText: input.delegationPolicyTestText
      .replaceAll(
        "delegation-policy: requiresApproval returns false for full_delegation low risk",
        "delegation-policy: full_delegation executes low risk"
      )
      .replaceAll(
        "delegation-policy: FileDelegationHistoryStore persists to disk",
        "delegation-policy: FileDelegationHistoryStore executes workspace write"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("delegation_policy_boundary_sourceMarkersRecorded")
  );
  assert.ok(
    review.reasons.includes("delegation_policy_boundary_regressionCoverageRecorded")
  );
});

test("delegation policy boundary audit blocks runtime invocation markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewDelegationPolicyBoundaryAudit({
    ...input,
    delegationPolicySourceText: `${input.delegationPolicySourceText}
provider.execute(plan);
dispatchGovernanceOperatorActionHostExecutor(input);
spawnSubAgent(input);
`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("delegation_policy_boundary_noRuntimeInvocationSurface")
  );
});

test("delegation policy boundary audit formats sanitized text and json", async () => {
  const review = reviewDelegationPolicyBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatDelegationPolicyBoundaryAuditResult(review);
  const json = formatDelegationPolicyBoundaryAuditResult(review, "json");
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
  overrides: Partial<DelegationPolicyBoundaryAuditInput> = {}
): Promise<DelegationPolicyBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    delegationPolicySourceText: await readFile(
      "packages/delegation-policy/src/index.ts",
      "utf8"
    ),
    delegationPolicyTestText: await readFile("tests/delegation-policy.test.ts", "utf8"),
    ...overrides
  };
}
