import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatControlledProviderExecutionTaskbookReviewBoundaryAuditResult,
  reviewControlledProviderExecutionTaskbookReviewBoundaryAudit,
  type ControlledProviderExecutionTaskbookReviewBoundaryAuditInput
} from "../scripts/run-controlled-provider-execution-taskbook-review-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("controlled provider execution taskbook review boundary audit passes for current evidence", async () => {
  const review = reviewControlledProviderExecutionTaskbookReviewBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.reviewAuditRegistered, true);
  assert.equal(review.checks.reviewAuditMarkersPresent, true);
  assert.equal(review.checks.taskbookNonAuthorizationRecorded, true);
  assert.equal(review.checks.reviewCoverageRecorded, true);
  assert.equal(review.checks.reviewAuditGitStateGateRecorded, true);
  assert.equal(review.checks.noProviderRuntimeSurface, true);
  assert.equal(review.checks.outputSanitized, true);
  assert.equal(
    review.summary.reviewBoundaryMode,
    "git_state_and_artifact_review_gate_only"
  );
  assert.equal(review.summary.reviewAuditIsProviderExecuteAuthorization, false);
  assert.equal(review.summary.reviewAuditIsRealCodexCliAuthorization, false);
  assert.equal(review.summary.reviewAuditIsWorkspaceWriteAuthorization, false);
  assert.equal(review.summary.reviewAuditIsHostExecutorAuthorization, false);
  assert.equal(review.summary.reviewAuditIsSubAgentRuntimeAuthorization, false);
  assert.equal(review.summary.reviewAuditGitStateIsExecutionAuthorization, false);
  assert.equal(
    review.summary.reviewAuditWorktreeCleanIsProviderExecutionAuthorization,
    false
  );
  assert.equal(review.summary.providerExecuteCallsDuringBoundaryAudit, 0);
  assert.equal(review.summary.codexCliCallsDuringBoundaryAudit, 0);
  assert.equal(review.summary.workspaceWriteCallsDuringBoundaryAudit, 0);
  assert.equal(review.summary.hostExecutorCallsDuringBoundaryAudit, 0);
  assert.equal(review.summary.subAgentRuntimeCallsDuringBoundaryAudit, 0);
});

test("controlled provider execution taskbook review boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewControlledProviderExecutionTaskbookReviewBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "auditCheck(\"controlled-provider-execution-taskbook-review-boundary\", \"scripts/run-controlled-provider-execution-taskbook-review-boundary-audit.ts\"),",
      ""
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_taskbook_review_boundary_governanceRunnerRegistered"
    )
  );
});

test("controlled provider execution taskbook review boundary audit blocks missing control-plane authority", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewControlledProviderExecutionTaskbookReviewBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Controlled provider execution taskbook review boundary",
      "Archived controlled provider execution taskbook review boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_taskbook_review_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("controlled provider execution taskbook review boundary audit blocks review gate drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewControlledProviderExecutionTaskbookReviewBoundaryAudit({
    ...input,
    reviewAuditText: input.reviewAuditText
      .replaceAll("worktreeClean: input.gitStatusShort.trim() === \"\"", "worktreeClean: true")
      .replaceAll("noRealCodexCliDuringReview: true", "noRealCodexCliDuringReview: false")
      .replaceAll("noProviderExecuteDuringReview: true", "noProviderExecuteDuringReview: false")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_taskbook_review_boundary_reviewAuditMarkersPresent"
    )
  );
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_taskbook_review_boundary_reviewAuditGitStateGateRecorded"
    )
  );
});

test("controlled provider execution taskbook review boundary audit blocks broadened taskbook text", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewControlledProviderExecutionTaskbookReviewBoundaryAudit({
    ...input,
    taskbookText: input.taskbookText
      .replaceAll("This taskbook is local-only.", "This taskbook is executable.")
      .replaceAll("does not authorize provider execute", "authorizes provider execute")
      .replaceAll(
        "General provider execution remains closed.",
        "General provider execution is open."
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_taskbook_review_boundary_taskbookNonAuthorizationRecorded"
    )
  );
});

test("controlled provider execution taskbook review boundary audit blocks missing review coverage", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewControlledProviderExecutionTaskbookReviewBoundaryAudit({
    ...input,
    reviewTestText: input.reviewTestText.replaceAll(
      "controlled provider execution taskbook review blocks dirty worktree state",
      "controlled provider execution taskbook review accepts dirty worktree state"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_taskbook_review_boundary_reviewCoverageRecorded"
    )
  );
});

test("controlled provider execution taskbook review boundary audit blocks provider runtime markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewControlledProviderExecutionTaskbookReviewBoundaryAudit({
    ...input,
    reviewAuditText: `${input.reviewAuditText}\nprovider.execute(plan);`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_taskbook_review_boundary_noProviderRuntimeSurface"
    )
  );
});

test("controlled provider execution taskbook review boundary audit formats sanitized text and json", async () => {
  const review = reviewControlledProviderExecutionTaskbookReviewBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text =
    formatControlledProviderExecutionTaskbookReviewBoundaryAuditResult(review);
  const json = formatControlledProviderExecutionTaskbookReviewBoundaryAuditResult(
    review,
    "json"
  );
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /review boundary mode: git_state_and_artifact_review_gate_only/);
  assert.match(text, /provider execute calls during boundary audit: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.externalWriteCallsDuringBoundaryAudit, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<ControlledProviderExecutionTaskbookReviewBoundaryAuditInput> = {}
): Promise<ControlledProviderExecutionTaskbookReviewBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    taskbookText: await readFile(
      "docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md",
      "utf8"
    ),
    reviewAuditText: await readFile(
      "scripts/run-controlled-provider-execution-taskbook-review-audit.ts",
      "utf8"
    ),
    reviewTestText: await readFile(
      "tests/controlled-provider-execution-taskbook-review-audit.test.ts",
      "utf8"
    ),
    ...overrides
  };
}
