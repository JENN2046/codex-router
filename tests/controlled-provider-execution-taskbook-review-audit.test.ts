import test from "node:test";
import assert from "node:assert/strict";
import {
  PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK,
  PR_22A_CONTROLLED_PROVIDER_EXECUTION_TOKEN,
  collectControlledProviderExecutionTaskbookReviewAuditInput,
  formatControlledProviderExecutionTaskbookReviewAuditResult,
  reviewControlledProviderExecutionTaskbookReviewAudit,
  type ControlledProviderExecutionTaskbookReviewAuditInput
} from "../scripts/run-controlled-provider-execution-taskbook-review-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-",
  "Bearer",
  "raw env",
  "raw environment",
  "raw token"
];

test("controlled provider execution taskbook review passes for current planning line", async () => {
  const review = reviewControlledProviderExecutionTaskbookReviewAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.deepEqual(review.checks, {
    worktreeClean: true,
    packageScriptsPresent: true,
    taskbookRecorded: true,
    taskbookNonAuthorizing: true,
    futureGateExact: true,
    minimumSafeSliceBounded: true,
    invariantsRecorded: true,
    failureCasesRecorded: true,
    validationPlanRecorded: true,
    stopConditionsRecorded: true,
    priorCloseoutRecorded: true,
    readonlyProductizationRecorded: true,
    capabilityPolicyRecorded: true,
    governanceIndexRecorded: true,
    currentStateRecorded: true,
    generalExecutionClosed: true,
    outputSanitized: true,
    noProviderExecuteDuringReview: true,
    noRealCodexCliDuringReview: true,
    noWorkspaceWriteDuringReview: true,
    noEvidenceWriteDuringReview: true,
    noExternalWriteDuringReview: true
  });
  assert.equal(
    review.summary.taskbookPath,
    PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK
  );
  assert.equal(review.summary.futureAuthorizationTokenRecorded, true);
  assert.equal(review.summary.providerExecuteCallsDuringReview, 0);
  assert.equal(review.summary.realCodexCliCallsDuringReview, 0);
  assert.equal(review.summary.workspaceWriteCallsDuringReview, 0);
  assert.equal(review.summary.evidenceWritesDuringReview, 0);
  assert.equal(review.summary.externalWritesDuringReview, 0);
});

test("controlled provider execution taskbook review blocks broadened authorization text", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewControlledProviderExecutionTaskbookReviewAudit({
    ...input,
    taskbookText: input.taskbookText
      .replaceAll(
        PR_22A_CONTROLLED_PROVIDER_EXECUTION_TOKEN,
        "APPROVE_CONTROLLED_PROVIDER_EXECUTION"
      )
      .replaceAll("This taskbook is local-only.", "This taskbook is executable.")
      .replaceAll("does not authorize provider execute", "authorizes provider execute")
      .replaceAll(
        "require side effect class `read_only`",
        "allow side effect class `workspace_write`"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_taskbook_review_taskbookRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_taskbook_review_taskbookNonAuthorizing"
    )
  );
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_taskbook_review_futureGateExact"
    )
  );
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_taskbook_review_minimumSafeSliceBounded"
    )
  );
});

test("controlled provider execution taskbook review blocks missing prior artifacts", async () => {
  const review = reviewControlledProviderExecutionTaskbookReviewAudit({
    ...(await createInputFromWorkspace()),
    cliCloseoutText: "missing closeout",
    readonlyProductizationText: "missing productization",
    capabilityPolicyText: "general_provider_execution is open",
    currentStateText: "CURRENT_STATE_RECORDED"
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_taskbook_review_priorCloseoutRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_taskbook_review_readonlyProductizationRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_taskbook_review_capabilityPolicyRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_taskbook_review_currentStateRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_taskbook_review_generalExecutionClosed"
    )
  );
});

test("controlled provider execution taskbook review blocks dirty worktree state", async () => {
  const review = reviewControlledProviderExecutionTaskbookReviewAudit({
    ...(await createInputFromWorkspace()),
    gitStatusShort:
      " M docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md\n"
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_taskbook_review_worktreeClean"
    )
  );
});

test("controlled provider execution taskbook review output stays summarized and sanitized", async () => {
  const review = reviewControlledProviderExecutionTaskbookReviewAudit(
    await createInputFromWorkspace()
  );
  const text = formatControlledProviderExecutionTaskbookReviewAuditResult(review);
  const json = formatControlledProviderExecutionTaskbookReviewAuditResult(
    review,
    "json"
  );
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /provider execute calls during taskbook review: 0/);
  assert.match(text, /evidence writes during taskbook review: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.workspaceWriteCallsDuringReview, 0);
  assert.equal(parsed.summary.externalWritesDuringReview, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<ControlledProviderExecutionTaskbookReviewAuditInput> = {}
): Promise<ControlledProviderExecutionTaskbookReviewAuditInput> {
  const input = await collectControlledProviderExecutionTaskbookReviewAuditInput();

  return {
    ...input,
    gitStatusShort: "",
    branch: "feature/cli-provider-goal-audit",
    headShort: "91e3662",
    ...overrides
  };
}
