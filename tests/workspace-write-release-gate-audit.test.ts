import test from "node:test";
import assert from "node:assert/strict";
import {
  collectWorkspaceWriteReleaseGateAuditInput,
  formatWorkspaceWriteReleaseGateAuditResult,
  reviewWorkspaceWriteReleaseGateAudit
} from "../scripts/run-workspace-write-release-gate-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("workspace-write release gate audit passes for current evidence", async () => {
  const review = reviewWorkspaceWriteReleaseGateAudit(
    await collectWorkspaceWriteReleaseGateAuditInput()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.deepEqual(review.checks, {
    governanceRunnerRegistered: true,
    governanceReadmeListsGate: true,
    currentStateListsGate: true,
    validationReleaseTierAligned: true,
    releaseMatrixRecordsGate: true,
    workspaceGateRecordsBlockedPosture: true,
    permitV2Recorded: true,
    fakeCanaryV2Recorded: true,
    controlledGenericLocalWorkspaceWriteRecorded: true,
    controlledGenericWorkspaceWriteAcceptanceRegistered: true,
    evidencePolicySanitized: true,
    threatModelStopsRecorded: true,
    implementationCoverageRecorded: true,
    noBroadAuthorizationText: true,
    noRuntimeInvocationSurface: true,
    outputSanitized: true
  });
  assert.equal(
    review.summary.workspaceWriteReleaseGateMode,
    "promotion_review_gate_only"
  );
  assert.equal(
    review.summary.controlledGenericLocalWorkspaceWriteStatus,
    "guarded_explicit_permit_local_runner_with_rollback"
  );
  assert.equal(
    review.summary.controlledGenericWorkspaceWriteAcceptanceStatus,
    "current_local_temp_repo_execute_and_rollback"
  );
  assert.equal(review.summary.realWorkspaceWriteDefault, "blocked");
  assert.equal(review.summary.generalWorkspaceWriteDefault, "blocked");
  assert.equal(
    review.summary.workspaceWriteReleaseGateIsWorkspaceWriteAuthorization,
    false
  );
  assert.equal(
    review.summary.workspaceWriteReleaseGateIsRealCodexCliAuthorization,
    false
  );
  assert.equal(review.summary.releaseValidationIncludesFakeCanary, true);
  assert.equal(review.summary.releaseValidationIncludesEvidenceCollection, true);
  assert.equal(review.summary.workspaceWriteCallsDuringAudit, 0);
  assert.equal(review.summary.evidenceWritesDuringAudit, 0);
});

test("workspace-write release gate audit blocks missing runner and current entries", async () => {
  const input = await collectWorkspaceWriteReleaseGateAuditInput();
  const review = reviewWorkspaceWriteReleaseGateAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "workspace-write-release-gate",
      "ww-release-gate-missing"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit workspace-write-release-gate",
      "npm run governance -- audit ww-release-gate-missing"
    ),
    currentStateText: input.currentStateText.replaceAll(
      "npm run governance -- audit workspace-write-release-gate",
      "npm run governance -- audit ww-release-gate-missing"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "workspace_write_release_gate_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "workspace_write_release_gate_governanceReadmeListsGate"
    )
  );
  assert.ok(
    review.reasons.includes(
      "workspace_write_release_gate_currentStateListsGate"
    )
  );
});

test("workspace-write release gate audit blocks release validation drift", async () => {
  const input = await collectWorkspaceWriteReleaseGateAuditInput();
  const review = reviewWorkspaceWriteReleaseGateAudit({
    ...input,
    packageJsonText: input.packageJsonText.replace(
      "\"canary:write\": \"node --import tsx scripts/run-canary-test.ts --risk medium\"",
      "\"canary:write\": \"node --import tsx scripts/run-canary-test.ts --risk low\""
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "workspace_write_release_gate_validationReleaseTierAligned"
    )
  );
});

test("workspace-write release gate audit blocks broadened workspace-write docs", async () => {
  const input = await collectWorkspaceWriteReleaseGateAuditInput();
  const review = reviewWorkspaceWriteReleaseGateAudit({
    ...input,
    workspaceWriteReleaseGateText: input.workspaceWriteReleaseGateText.replace(
      "Workspace-write real canary | Experimental and blocked by default.",
      "Workspace-write real canary | Guarded by default"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "workspace_write_release_gate_workspaceGateRecordsBlockedPosture"
    )
  );
  assert.ok(
    review.reasons.includes(
      "workspace_write_release_gate_noBroadAuthorizationText"
    )
  );
});

test("workspace-write release gate audit blocks missing permit v2 binding", async () => {
  const input = await collectWorkspaceWriteReleaseGateAuditInput();
  const review = reviewWorkspaceWriteReleaseGateAudit({
    ...input,
    providerCoreText: input.providerCoreText.replaceAll(
      "rollback_command_hash_mismatch",
      "rollback_command_hash_ignored"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("workspace_write_release_gate_permitV2Recorded")
  );
});

test("workspace-write release gate audit blocks fake canary drift", async () => {
  const input = await collectWorkspaceWriteReleaseGateAuditInput();
  const review = reviewWorkspaceWriteReleaseGateAudit({
    ...input,
    fakeCanaryAcceptanceText: input.fakeCanaryAcceptanceText.replaceAll(
      "workspaceWriteExecuteCalls",
      "wwExecuteCallsIgnored"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("workspace_write_release_gate_fakeCanaryV2Recorded")
  );
});

test("workspace-write release gate audit blocks generic local workspace-write drift", async () => {
  const input = await collectWorkspaceWriteReleaseGateAuditInput();
  const review = reviewWorkspaceWriteReleaseGateAudit({
    ...input,
    workspaceWriteExecutorTestText: input.workspaceWriteExecutorTestText.replaceAll(
      "workspace-write executor supports update and delete operations with rollback",
      "workspace-write executor skips update and delete coverage"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "workspace_write_release_gate_controlledGenericLocalWorkspaceWriteRecorded"
    )
  );
});

test("workspace-write release gate audit blocks missing controlled generic acceptance", async () => {
  const input = await collectWorkspaceWriteReleaseGateAuditInput();
  const review = reviewWorkspaceWriteReleaseGateAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "controlled-generic-workspace-write",
      "controlled-generic-workspace-write-missing"
    ),
    controlledGenericWorkspaceWriteAcceptanceTestText:
      input.controlledGenericWorkspaceWriteAcceptanceTestText.replaceAll(
        "controlled generic workspace-write acceptance covers local runner execution",
        "controlled generic workspace-write acceptance skips local runner execution"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "workspace_write_release_gate_controlledGenericWorkspaceWriteAcceptanceRegistered"
    )
  );
});

test("workspace-write release gate audit blocks stale controlled generic evidence", async () => {
  const input = await collectWorkspaceWriteReleaseGateAuditInput();
  const review = reviewWorkspaceWriteReleaseGateAudit({
    ...input,
    controlledGenericWorkspaceWriteAcceptanceEvidenceText:
      input.controlledGenericWorkspaceWriteAcceptanceEvidenceText.replace(
        "\"executionWorkspaceWriteExecuteCalls\": 1",
        "\"executionWorkspaceWriteExecuteCalls\": 0"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "workspace_write_release_gate_controlledGenericWorkspaceWriteAcceptanceRegistered"
    )
  );
});

test("workspace-write release gate audit blocks evidence policy drift", async () => {
  const input = await collectWorkspaceWriteReleaseGateAuditInput();
  const review = reviewWorkspaceWriteReleaseGateAudit({
    ...input,
    evidencePolicyText: input.evidencePolicyText.replaceAll(
      "raw stdout/stderr transcript",
      "summarized stdout/stderr transcript"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "workspace_write_release_gate_evidencePolicySanitized"
    )
  );
});

test("workspace-write release gate audit blocks missing coverage", async () => {
  const input = await collectWorkspaceWriteReleaseGateAuditInput();
  const review = reviewWorkspaceWriteReleaseGateAudit({
    ...input,
    fakeCanaryTestText: input.fakeCanaryTestText.replaceAll(
      "permitV2ReplayBlocked",
      "permitV2ReplayIgnored"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "workspace_write_release_gate_implementationCoverageRecorded"
    )
  );
});

test("workspace-write release gate audit blocks runtime markers in gate docs", async () => {
  const input = await collectWorkspaceWriteReleaseGateAuditInput();
  const review = reviewWorkspaceWriteReleaseGateAudit({
    ...input,
    workspaceWriteReleaseGateText: `${input.workspaceWriteReleaseGateText}\nwriteFile(target, patch)\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "workspace_write_release_gate_noRuntimeInvocationSurface"
    )
  );
});

test("workspace-write release gate audit output stays summarized", async () => {
  const review = reviewWorkspaceWriteReleaseGateAudit(
    await collectWorkspaceWriteReleaseGateAuditInput()
  );
  const text = formatWorkspaceWriteReleaseGateAuditResult(review);
  const json = formatWorkspaceWriteReleaseGateAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /release gate mode: promotion_review_gate_only/);
  assert.match(
    text,
    /controlled generic local workspace-write status: guarded_explicit_permit_local_runner_with_rollback/
  );
  assert.match(
    text,
    /controlled generic workspace-write acceptance status: current_local_temp_repo_execute_and_rollback/
  );
  assert.match(text, /real workspace-write default: blocked/);
  assert.match(text, /release gate is workspace-write authorization: false/);
  assert.match(text, /workspace-write calls during audit: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.workspaceWriteCallsDuringAudit, 0);
  assert.equal(parsed.summary.evidenceWritesDuringAudit, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});
