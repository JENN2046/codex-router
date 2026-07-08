import test from "node:test";
import assert from "node:assert/strict";
import {
  collectPreflightBoundaryAuditInput,
  formatPreflightBoundaryAuditResult,
  reviewPreflightBoundaryAudit
} from "../scripts/run-preflight-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("preflight boundary audit passes for current evidence", async () => {
  const review = reviewPreflightBoundaryAudit(
    await collectPreflightBoundaryAuditInput()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.sourceMarkersRecorded, true);
  assert.equal(review.checks.regressionCoverageRecorded, true);
  assert.equal(review.checks.noRuntimeInvocationSurface, true);
  assert.equal(review.checks.outputSanitized, true);
  assert.equal(review.summary.preflightMode, "pre_execution_signal_evaluation_only");
  assert.equal(review.summary.preflightOkIsExecutionAuthorization, false);
  assert.equal(review.summary.missingToolCheckIsToolRuntimeAuthorization, false);
  assert.equal(review.summary.authAvailableIsProviderExecutionAuthorization, false);
  assert.equal(review.summary.workspaceCleanIsWorkspaceWriteAuthorization, false);
  assert.equal(review.summary.protectedBranchCheckIsWorkspaceWriteExecution, false);
  assert.equal(review.summary.memoryOverviewIsRuntimeAuthorization, false);
  assert.equal(review.summary.memoryHealthStatusIsSubAgentRuntimeAuthorization, false);
  assert.equal(review.summary.memoryWarningIsHostExecutorAuthorization, false);
  assert.equal(review.summary.memoryBlockingIssueIsProviderExecutionAuthorization, false);
  assert.equal(review.summary.preflightCallsDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.codexCliCallsDuringAudit, 0);
  assert.equal(review.summary.subAgentRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.hostExecutorCallsDuringAudit, 0);
  assert.equal(review.summary.hostDispatchCallsDuringAudit, 0);
  assert.equal(review.summary.toolRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.shellProcessCallsDuringAudit, 0);
  assert.equal(review.summary.networkCallsDuringAudit, 0);
  assert.equal(review.summary.workspaceWriteCallsDuringAudit, 0);
  assert.equal(review.summary.externalWriteCallsDuringAudit, 0);
});

test("preflight boundary audit blocks missing registration", async () => {
  const input = await collectPreflightBoundaryAuditInput();
  const review = reviewPreflightBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "preflight-boundary",
      "archived-signal-check-boundary"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit preflight-boundary",
      "npm run governance -- audit archived-signal-check-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("preflight_boundary_governanceRunnerRegistered")
  );
  assert.ok(
    review.reasons.includes("preflight_boundary_governanceReadmeListsBoundary")
  );
});

test("preflight boundary audit blocks missing control-plane authority", async () => {
  const input = await collectPreflightBoundaryAuditInput();
  const review = reviewPreflightBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText
      .replaceAll("Preflight boundary", "Preflight checks")
      .replaceAll(
        "preflight ok is not execution authorization",
        "preflight ok authorizes execution"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("preflight_boundary_controlPlaneAuthorityRecorded")
  );
});

test("preflight boundary audit blocks source and test drift", async () => {
  const input = await collectPreflightBoundaryAuditInput();
  const review = reviewPreflightBoundaryAudit({
    ...input,
    preflightSourceText: input.preflightSourceText
      .replaceAll("export function runPreflight", "export function authorizePreflight")
      .replaceAll("workspace_dirty", "workspace_write_authorized"),
    preflightTestText: input.preflightTestText.replaceAll(
      "preflight blocks write-capable work on risky workspace state",
      "preflight authorizes write-capable work on risky workspace state"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("preflight_boundary_sourceMarkersRecorded"));
  assert.ok(
    review.reasons.includes("preflight_boundary_regressionCoverageRecorded")
  );
});

test("preflight boundary audit blocks runtime invocation markers", async () => {
  const input = await collectPreflightBoundaryAuditInput();
  const review = reviewPreflightBoundaryAudit({
    ...input,
    preflightSourceText: `${input.preflightSourceText}\nprovider.execute(plan);\ndispatchToHost(task);\nspawnSubAgent(task);\nwriteFile(path, data);\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("preflight_boundary_noRuntimeInvocationSurface")
  );
});

test("preflight boundary audit formats sanitized text and json", async () => {
  const review = reviewPreflightBoundaryAudit(
    await collectPreflightBoundaryAuditInput()
  );
  const text = formatPreflightBoundaryAuditResult(review);
  const json = formatPreflightBoundaryAuditResult(review, "json");

  assert.match(text, /Preflight boundary audit/);
  assert.match(text, /preflight ok is execution authorization: false/);
  assert.match(text, /Codex CLI calls during audit: 0/);
  assert.equal(JSON.parse(json).status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false);
    assert.equal(json.includes(marker), false);
  }
});
