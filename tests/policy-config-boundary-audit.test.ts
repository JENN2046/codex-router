import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatPolicyConfigBoundaryAuditResult,
  reviewPolicyConfigBoundaryAudit,
  type PolicyConfigBoundaryAuditInput
} from "../scripts/run-policy-config-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("policy config boundary audit passes for current evidence", async () => {
  const review = reviewPolicyConfigBoundaryAudit(await createInputFromWorkspace());

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.sourceMarkersPresent, true);
  assert.equal(review.checks.routingPolicyMarkersPresent, true);
  assert.equal(review.checks.coverageRecorded, true);
  assert.equal(review.checks.noRuntimeInvocationSurface, true);
  assert.equal(review.checks.outputSanitized, true);
  assert.equal(
    review.summary.policyConfigMode,
    "policy_schema_and_signal_resolution_only"
  );
  assert.equal(review.summary.hostRouteIsHostDispatchAuthorization, false);
  assert.equal(review.summary.codexCliHostRouteIsCodexCliInvocation, false);
  assert.equal(review.summary.protectedRemoteToolPolicyIsExternalWriteAuthorization, false);
  assert.equal(review.summary.subAgentRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.hostExecutorCallsDuringAudit, 0);
});

test("policy config boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewPolicyConfigBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "policy-config-boundary",
      "archived-policy-config"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("policy_config_boundary_governanceRunnerRegistered")
  );
});

test("policy config boundary audit blocks missing control-plane authority", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewPolicyConfigBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Policy config boundary",
      "Archived policy config"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("policy_config_boundary_controlPlaneAuthorityRecorded")
  );
});

test("policy config boundary audit blocks source, policy, and coverage drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewPolicyConfigBoundaryAudit({
    ...input,
    policyConfigSourceText: input.policyConfigSourceText.replaceAll(
      "Missing host route for task class",
      "Host route is optional"
    ),
    routingPolicyText: input.routingPolicyText.replaceAll(
      "read_only: \"codex-cli\"",
      "read_only: \"desktop\""
    ),
    policyConfigTestText: input.policyConfigTestText.replaceAll(
      "policy config requires explicit host routes for every task class",
      "policy config accepts missing host routes for task classes"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("policy_config_boundary_sourceMarkersPresent"));
  assert.ok(
    review.reasons.includes("policy_config_boundary_routingPolicyMarkersPresent")
  );
  assert.ok(review.reasons.includes("policy_config_boundary_coverageRecorded"));
});

test("policy config boundary audit blocks runtime invocation markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewPolicyConfigBoundaryAudit({
    ...input,
    policyConfigSourceText: `${input.policyConfigSourceText}\nspawnSubAgent(policy);`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("policy_config_boundary_noRuntimeInvocationSurface")
  );
});

test("policy config boundary audit formats sanitized text and json", async () => {
  const review = reviewPolicyConfigBoundaryAudit(await createInputFromWorkspace());
  const text = formatPolicyConfigBoundaryAuditResult(review);
  const json = formatPolicyConfigBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /policy config mode: policy_schema_and_signal_resolution_only/);
  assert.match(text, /host executor calls during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<PolicyConfigBoundaryAuditInput> = {}
): Promise<PolicyConfigBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    policyConfigSourceText: await readFile(
      "packages/policy-config/src/index.ts",
      "utf8"
    ),
    policyConfigTestText: await readFile("tests/policy-config.test.ts", "utf8"),
    routingPolicyText: await readFile("routing-policy.yaml", "utf8"),
    ...overrides
  };
}
