import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatCapabilityTaxonomyEscalationPolicyBoundaryAuditResult,
  reviewCapabilityTaxonomyEscalationPolicyBoundaryAudit,
  type CapabilityTaxonomyEscalationPolicyBoundaryAuditInput
} from "../scripts/run-capability-taxonomy-escalation-policy-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("capability taxonomy escalation policy boundary audit passes for current evidence", async () => {
  const review = reviewCapabilityTaxonomyEscalationPolicyBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.escalationPolicyAuditRegistered, true);
  assert.equal(review.checks.policyNonAuthorizationRecorded, true);
  assert.equal(review.checks.escalationPolicyAuditGateRecorded, true);
  assert.equal(review.checks.escalationPolicyCoverageRecorded, true);
  assert.equal(review.checks.noRuntimeInvocationSurface, true);
  assert.equal(review.checks.outputSanitized, true);
  assert.equal(
    review.summary.escalationPolicyMode,
    "capability_escalation_policy_only"
  );
  assert.equal(review.summary.escalationPolicyIsProviderExecuteAuthorization, false);
  assert.equal(review.summary.escalationPolicyIsCodexCliAuthorization, false);
  assert.equal(review.summary.escalationPolicyIsWorkspaceWriteAuthorization, false);
  assert.equal(review.summary.escalationPolicyIsHostExecutorAuthorization, false);
  assert.equal(review.summary.escalationPolicyIsSubAgentRuntimeAuthorization, false);
  assert.equal(review.summary.escalationPolicyIsToolRuntimeAuthorization, false);
  assert.equal(review.summary.escalationPolicyIsExternalWriteAuthorization, false);
  assert.equal(review.summary.escalationPolicyIsReleaseAuthorization, false);
  assert.equal(review.summary.escalationPolicyIsSecretAccessAuthorization, false);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.codexCliCallsDuringAudit, 0);
  assert.equal(review.summary.workspaceWriteCallsDuringAudit, 0);
  assert.equal(review.summary.hostExecutorCallsDuringAudit, 0);
  assert.equal(review.summary.subAgentRuntimeCallsDuringAudit, 0);
});

test("capability taxonomy escalation policy boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCapabilityTaxonomyEscalationPolicyBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "auditCheck(\"capability-taxonomy-escalation-policy-boundary\", \"scripts/run-capability-taxonomy-escalation-policy-boundary-audit.ts\"),",
      ""
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "capability_taxonomy_escalation_policy_boundary_governanceRunnerRegistered"
    )
  );
});

test("capability taxonomy escalation policy boundary audit blocks missing control-plane authority", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCapabilityTaxonomyEscalationPolicyBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Capability taxonomy escalation policy boundary",
      "Archived capability taxonomy escalation policy boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "capability_taxonomy_escalation_policy_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("capability taxonomy escalation policy boundary audit blocks policy drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCapabilityTaxonomyEscalationPolicyBoundaryAudit({
    ...input,
    escalationPolicyDocText: input.escalationPolicyDocText
      .replaceAll("push authorized: `false`", "push authorized: `true`")
      .replaceAll(
        "It is not to run workspace-write execution or general provider execution.",
        "It may run workspace-write execution or general provider execution."
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "capability_taxonomy_escalation_policy_boundary_policyNonAuthorizationRecorded"
    )
  );
});

test("capability taxonomy escalation policy boundary audit blocks review gate drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCapabilityTaxonomyEscalationPolicyBoundaryAudit({
    ...input,
    escalationPolicyAuditText: input.escalationPolicyAuditText
      .replaceAll("worktreeClean: input.gitStatusShort.trim() === \"\"", "worktreeClean: true")
      .replaceAll(
        "providerExecuteCallsDuringTaxonomyReview: 0",
        "providerExecuteCallsDuringTaxonomyReview: 1"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "capability_taxonomy_escalation_policy_boundary_escalationPolicyAuditGateRecorded"
    )
  );
});

test("capability taxonomy escalation policy boundary audit blocks missing coverage", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCapabilityTaxonomyEscalationPolicyBoundaryAudit({
    ...input,
    escalationPolicyTestText: input.escalationPolicyTestText.replaceAll(
      "capability taxonomy escalation policy audit blocks stale evidence or local target",
      "capability taxonomy escalation policy audit accepts stale evidence or local target"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "capability_taxonomy_escalation_policy_boundary_escalationPolicyCoverageRecorded"
    )
  );
});

test("capability taxonomy escalation policy boundary audit blocks runtime invocation markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCapabilityTaxonomyEscalationPolicyBoundaryAudit({
    ...input,
    escalationPolicyDocText: `${input.escalationPolicyDocText}\nprovider.execute(plan);`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "capability_taxonomy_escalation_policy_boundary_noRuntimeInvocationSurface"
    )
  );
});

test("capability taxonomy escalation policy boundary audit formats sanitized text and json", async () => {
  const review = reviewCapabilityTaxonomyEscalationPolicyBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatCapabilityTaxonomyEscalationPolicyBoundaryAuditResult(review);
  const json = formatCapabilityTaxonomyEscalationPolicyBoundaryAuditResult(
    review,
    "json"
  );
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /escalation policy mode: capability_escalation_policy_only/);
  assert.match(text, /provider execute calls during audit: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.externalWriteCallsDuringAudit, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<CapabilityTaxonomyEscalationPolicyBoundaryAuditInput> = {}
): Promise<CapabilityTaxonomyEscalationPolicyBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    escalationPolicyDocText: await readFile(
      "docs/governance/CAPABILITY_TAXONOMY_ESCALATION_POLICY.md",
      "utf8"
    ),
    escalationPolicyAuditText: await readFile(
      "scripts/run-capability-taxonomy-escalation-policy-audit.ts",
      "utf8"
    ),
    escalationPolicyTestText: await readFile(
      "tests/capability-taxonomy-escalation-policy-audit.test.ts",
      "utf8"
    ),
    ...overrides
  };
}
