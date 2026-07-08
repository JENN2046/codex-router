import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatCapabilityTaxonomyBoundaryAuditResult,
  reviewCapabilityTaxonomyBoundaryAudit,
  type CapabilityTaxonomyBoundaryAuditInput
} from "../scripts/run-capability-taxonomy-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("capability taxonomy boundary audit passes for current evidence", async () => {
  const review = reviewCapabilityTaxonomyBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.taxonomyMarkersPresent, true);
  assert.equal(review.checks.coverageRecorded, true);
  assert.equal(review.checks.noRuntimeInvocationSurface, true);
  assert.equal(review.checks.outputSanitized, true);
  assert.equal(
    review.summary.capabilityTaxonomyMode,
    "capability_classification_and_escalation_policy_only"
  );
  assert.equal(
    review.summary.generalProviderExecutionClassIsProviderExecuteAuthorization,
    false
  );
  assert.equal(
    review.summary.capabilityEscalationPolicyIsRuntimeAuthorization,
    false
  );
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.codexCliCallsDuringAudit, 0);
  assert.equal(review.summary.workspaceWriteCallsDuringAudit, 0);
  assert.equal(review.summary.externalWriteCallsDuringAudit, 0);
});

test("capability taxonomy boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCapabilityTaxonomyBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "capability-taxonomy-boundary",
      "archived-capability-taxonomy"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "capability_taxonomy_boundary_governanceRunnerRegistered"
    )
  );
});

test("capability taxonomy boundary audit blocks missing control-plane authority", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCapabilityTaxonomyBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Capability taxonomy boundary",
      "Archived capability taxonomy"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "capability_taxonomy_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("capability taxonomy boundary audit blocks taxonomy and coverage drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCapabilityTaxonomyBoundaryAudit({
    ...input,
    taxonomyDocText: input.taxonomyDocText
      .replaceAll("`general_provider_execution`", "`default_provider_execution`")
      .replaceAll(
        "A successful bounded canary does not promote either class",
        "A successful bounded canary promotes provider execution"
      ),
    taxonomyTestText: input.taxonomyTestText.replaceAll(
      "capability taxonomy escalation policy audit blocks broadened policy text",
      "capability taxonomy escalation policy accepts broadened policy text"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("capability_taxonomy_boundary_taxonomyMarkersPresent")
  );
  assert.ok(
    review.reasons.includes("capability_taxonomy_boundary_coverageRecorded")
  );
});

test("capability taxonomy boundary audit blocks runtime invocation markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCapabilityTaxonomyBoundaryAudit({
    ...input,
    taxonomyDocText: `${input.taxonomyDocText}\nprovider.execute(plan);`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "capability_taxonomy_boundary_noRuntimeInvocationSurface"
    )
  );
});

test("capability taxonomy boundary audit formats sanitized text and json", async () => {
  const review = reviewCapabilityTaxonomyBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatCapabilityTaxonomyBoundaryAuditResult(review);
  const json = formatCapabilityTaxonomyBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(
    text,
    /capability taxonomy mode: capability_classification_and_escalation_policy_only/
  );
  assert.match(text, /provider execute calls during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<CapabilityTaxonomyBoundaryAuditInput> = {}
): Promise<CapabilityTaxonomyBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    taxonomyDocText: await readFile(
      "docs/governance/CAPABILITY_TAXONOMY_ESCALATION_POLICY.md",
      "utf8"
    ),
    taxonomyTestText: await readFile(
      "tests/capability-taxonomy-escalation-policy-audit.test.ts",
      "utf8"
    ),
    ...overrides
  };
}
