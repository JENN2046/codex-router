import test from "node:test";
import assert from "node:assert/strict";
import {
  collectStateSyncBoundaryAuditInput,
  formatStateSyncBoundaryAuditResult,
  reviewStateSyncBoundaryAudit
} from "../scripts/run-state-sync-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("state-sync boundary audit passes for current evidence", async () => {
  const review = reviewStateSyncBoundaryAudit(
    await collectStateSyncBoundaryAuditInput()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.deepEqual(review.checks, {
    controlPlaneAuthorityRecorded: true,
    governanceReadmeListsBoundary: true,
    governanceRunnerRegistersBoundary: true,
    stateSyncGateRemainsRegistered: true,
    ciKeepsStateSyncGate: true,
    collectorRecordsGitObservationOnly: true,
    packageRecordsStateConsistencyOnly: true,
    currentStateRecordsBoundary: true,
    structuredRecordUsesPolicyV2: true,
    coverageRecorded: true,
    docsNonAuthorizing: true,
    outputSanitized: true
  });
  assert.equal(
    review.summary.stateSyncBoundaryMode,
    "state_consistency_observation_gate_only"
  );
  assert.equal(review.summary.stateSyncIsProviderExecuteAuthorization, false);
  assert.equal(review.summary.stateSyncIsRealCodexCliAuthorization, false);
  assert.equal(review.summary.stateSyncIsWorkspaceWriteAuthorization, false);
  assert.equal(review.summary.stateSyncIsPushAuthorization, false);
  assert.equal(review.summary.stateSyncIsReleaseAuthorization, false);
  assert.equal(review.summary.stateWritesDuringBoundaryAudit, 0);
  assert.equal(review.summary.remoteWritesDuringBoundaryAudit, 0);
});

test("state-sync boundary audit blocks missing boundary registration", async () => {
  const input = await collectStateSyncBoundaryAuditInput();
  const review = reviewStateSyncBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "state-sync-boundary",
      "state-sync-static-missing"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit state-sync-boundary",
      "npm run governance -- audit state-sync-static-missing"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "state_sync_boundary_governanceRunnerRegistersBoundary"
    )
  );
  assert.ok(
    review.reasons.includes(
      "state_sync_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("state-sync boundary audit blocks removed state-sync gate", async () => {
  const input = await collectStateSyncBoundaryAuditInput();
  const review = reviewStateSyncBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replace(
      "auditCheck(\"state-sync\", \"scripts/run-state-sync-audit.ts\")",
      "auditCheck(\"state-sync-removed\", \"scripts/run-state-sync-audit.ts\")"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("state_sync_boundary_stateSyncGateRemainsRegistered")
  );
});

test("state-sync boundary audit blocks missing CI state-sync gate", async () => {
  const input = await collectStateSyncBoundaryAuditInput();
  const review = reviewStateSyncBoundaryAudit({
    ...input,
    ciWorkflowText: input.ciWorkflowText.replace(
      "npm run governance -- audit state-sync",
      "npm run governance -- audit state-audit-skipped"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_boundary_ciKeepsStateSyncGate"));
});

test("state-sync boundary audit blocks collector drift", async () => {
  const input = await collectStateSyncBoundaryAuditInput();
  const review = reviewStateSyncBoundaryAudit({
    ...input,
    stateSyncAuditText: input.stateSyncAuditText.replace(
      "git([\"status\", \"--short\"], cwd)",
      "staticStatusOnly(cwd)"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "state_sync_boundary_collectorRecordsGitObservationOnly"
    )
  );
});

test("state-sync boundary audit blocks broadened docs", async () => {
  const input = await collectStateSyncBoundaryAuditInput();
  const review = reviewStateSyncBoundaryAudit({
    ...input,
    currentStateText: `${input.currentStateText}\nstate-sync authorized release: \`true\`\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_boundary_docsNonAuthorizing"));
});

test("state-sync boundary audit blocks non-v2 structured record", async () => {
  const input = await collectStateSyncBoundaryAuditInput();
  const claim = JSON.parse(input.stateSyncRecordText) as Record<string, unknown>;
  claim.policyVersion = "state-sync-policy.v1";

  const review = reviewStateSyncBoundaryAudit({
    ...input,
    stateSyncRecordText: JSON.stringify(claim)
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("state_sync_boundary_structuredRecordUsesPolicyV2")
  );
});

test("state-sync boundary audit blocks missing test coverage", async () => {
  const input = await collectStateSyncBoundaryAuditInput();
  const review = reviewStateSyncBoundaryAudit({
    ...input,
    stateSyncTestText: input.stateSyncTestText.replace(
      "assert.equal(review.summary.stateWritesDuringAudit, 0)",
      "assert.equal(review.summary.stateWriteCounterSkipped, 0)"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("state_sync_boundary_coverageRecorded"));
});

test("state-sync boundary audit output stays summarized", async () => {
  const review = reviewStateSyncBoundaryAudit(
    await collectStateSyncBoundaryAuditInput()
  );
  const text = formatStateSyncBoundaryAuditResult(review);
  const json = formatStateSyncBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /boundary mode: state_consistency_observation_gate_only/);
  assert.match(text, /state-sync is provider execute authorization: false/);
  assert.match(text, /state writes during boundary audit: 0/);
  assert.match(text, /remote writes during boundary audit: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.stateWritesDuringBoundaryAudit, 0);
  assert.equal(parsed.summary.remoteWritesDuringBoundaryAudit, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});
