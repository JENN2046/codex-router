import test from "node:test";
import assert from "node:assert/strict";
import {
  collectReadonlyProductizationBoundaryAuditInput,
  formatReadonlyProductizationBoundaryAuditResult,
  reviewReadonlyProductizationBoundaryAudit,
  type ReadonlyProductizationBoundaryAuditInput
} from "../scripts/run-readonly-productization-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("read-only productization boundary audit passes for current evidence", async () => {
  const review = reviewReadonlyProductizationBoundaryAudit(
    await collectReadonlyProductizationBoundaryAuditInput()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.deepEqual(review.checks, {
    controlPlaneAuthorityRecorded: true,
    governanceReadmeListsBoundary: true,
    governanceRunnerRegistered: true,
    acceptanceGateRegistered: true,
    acceptanceGateRecorded: true,
    productizationDocsNonAuthorizing: true,
    roadmapRecordsLocalOnlyGate: true,
    coverageRecorded: true,
    noRuntimeInvocationSurface: true,
    outputSanitized: true
  });
  assert.equal(
    review.summary.readonlyProductizationBoundaryMode,
    "local_readonly_productization_acceptance_gate_only"
  );
  assert.equal(
    review.summary.readonlyProductizationIsProviderExecuteAuthorization,
    false
  );
  assert.equal(
    review.summary.readonlyProductizationIsRealCodexCliAuthorization,
    false
  );
  assert.equal(
    review.summary.readonlyProductizationIsWorkspaceWriteAuthorization,
    false
  );
  assert.equal(
    review.summary.readonlyProductizationIsEvidenceRefreshAuthorization,
    false
  );
  assert.equal(review.summary.providerExecuteCallsDuringBoundaryAudit, 0);
  assert.equal(review.summary.codexCliCallsDuringBoundaryAudit, 0);
  assert.equal(review.summary.workspaceWriteCallsDuringBoundaryAudit, 0);
  assert.equal(review.summary.evidenceWritesDuringBoundaryAudit, 0);
});

test("read-only productization boundary audit blocks missing runner and README entries", async () => {
  const input = await collectReadonlyProductizationBoundaryAuditInput();
  const review = reviewReadonlyProductizationBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "readonly-productization-boundary",
      "readonly-productization-static-missing"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit readonly-productization-boundary",
      "npm run governance -- audit readonly-productization-static-missing"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "readonly_productization_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "readonly_productization_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("read-only productization boundary audit blocks missing control-plane authority", async () => {
  const input = await collectReadonlyProductizationBoundaryAuditInput();
  const review = reviewReadonlyProductizationBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Read-only productization boundary",
      "Read-only productization historical note"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "readonly_productization_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("read-only productization boundary audit blocks acceptance gate drift", async () => {
  const input = await collectReadonlyProductizationBoundaryAuditInput();
  const review = reviewReadonlyProductizationBoundaryAudit({
    ...input,
    acceptanceText: input.acceptanceText.replaceAll(
      "git([\"status\", \"--short\"], cwd)",
      "staticStatusOnly(cwd)"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "readonly_productization_boundary_acceptanceGateRecorded"
    )
  );
});

test("read-only productization boundary audit blocks broadened productization docs", async () => {
  const input = await collectReadonlyProductizationBoundaryAuditInput();
  const review = reviewReadonlyProductizationBoundaryAudit({
    ...input,
    productizationDocText: input.productizationDocText.replaceAll(
      "does not authorize workspace-write",
      "workspace-write authorized: `true`"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "readonly_productization_boundary_productizationDocsNonAuthorizing"
    )
  );
});

test("read-only productization boundary audit blocks roadmap drift", async () => {
  const input = await collectReadonlyProductizationBoundaryAuditInput();
  const review = reviewReadonlyProductizationBoundaryAudit({
    ...input,
    roadmapText: input.roadmapText.replaceAll(
      "READONLY_PRODUCTIZATION_ACCEPTANCE_RECORDED",
      "READONLY_PRODUCTIZATION_ACCEPTANCE_STALE"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "readonly_productization_boundary_roadmapRecordsLocalOnlyGate"
    )
  );
});

test("read-only productization boundary audit blocks missing coverage", async () => {
  const input = await collectReadonlyProductizationBoundaryAuditInput();
  const review = reviewReadonlyProductizationBoundaryAudit({
    ...input,
    testText: input.testText.replaceAll(
      "read-only productization acceptance blocks broadened authorization docs",
      "read-only productization acceptance skips broadened authorization docs"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "readonly_productization_boundary_coverageRecorded"
    )
  );
});

test("read-only productization boundary audit blocks runtime markers in docs", async () => {
  const input = await collectReadonlyProductizationBoundaryAuditInput();
  const review = reviewReadonlyProductizationBoundaryAudit({
    ...input,
    productizationDocText: `${input.productizationDocText}\nprovider.execute(task)\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "readonly_productization_boundary_noRuntimeInvocationSurface"
    )
  );
});

test("read-only productization boundary audit output stays summarized", async () => {
  const review = reviewReadonlyProductizationBoundaryAudit(
    await collectReadonlyProductizationBoundaryAuditInput()
  );
  const text = formatReadonlyProductizationBoundaryAuditResult(review);
  const json = formatReadonlyProductizationBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(
    text,
    /boundary mode: local_readonly_productization_acceptance_gate_only/
  );
  assert.match(text, /productization is provider execute authorization: false/);
  assert.match(text, /provider execute calls during boundary audit: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.providerExecuteCallsDuringBoundaryAudit, 0);
  assert.equal(parsed.summary.evidenceWritesDuringBoundaryAudit, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});
