import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatHostClientExecutorReviewBoundaryAuditResult,
  reviewHostClientExecutorReviewBoundaryAudit,
  type HostClientExecutorReviewBoundaryAuditInput
} from "../scripts/run-host-client-executor-review-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("host client executor review boundary audit passes for current evidence", async () => {
  const review = reviewHostClientExecutorReviewBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.phase12CloseoutRecorded, true);
  assert.equal(review.checks.currentStateRecorded, true);
  assert.equal(review.checks.controlPlaneCapabilityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.reviewSurfacePresent, true);
  assert.equal(review.checks.publicApiDelegatesReviewOnly, true);
  assert.equal(review.checks.reviewUsesCurrentLifecycleOnly, true);
  assert.equal(review.checks.bridgeAndDispatchIsolationRecorded, true);
  assert.equal(review.checks.idleClientFailsClosed, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.equal(review.summary.surface, "desktop_host_client_review");
  assert.equal(review.summary.boundaryMode, "review_only");
  assert.equal(review.summary.reviewResultStatus, "ready_for_host_executor_review");
  assert.equal(review.summary.recoveryActionDispatchAllowed, false);
  assert.equal(review.summary.hostBridgeCallAllowedByReview, false);
  assert.equal(review.summary.dispatchToHostAllowedByReview, false);
  assert.equal(review.summary.hostBridgeCallsDuringAudit, 0);
  assert.equal(review.summary.dispatchToHostCallsDuringAudit, 0);
});

test("host client executor review boundary audit blocks missing runner and README entries", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewHostClientExecutorReviewBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "host-client-executor-review-boundary",
      "archived-host-client-executor-review"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit host-client-executor-review-boundary",
      "npm run governance -- audit archived-host-client-executor-review"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "host_client_executor_review_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "host_client_executor_review_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("host client executor review boundary audit blocks broadened closeout docs", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewHostClientExecutorReviewBoundaryAudit({
    ...input,
    phase12CloseoutText: input.phase12CloseoutText
      .replaceAll("does not authorize recovery execution", "authorizes recovery execution")
      .replaceAll("This closeout does not authorize", "This closeout authorizes")
      .replaceAll("does not call bridge bindings", "may call bridge bindings")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "host_client_executor_review_boundary_phase12CloseoutRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "host_client_executor_review_boundary_noBroadExecutionAuthorization"
    )
  );
});

test("host client executor review boundary audit blocks review path dispatch calls", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewHostClientExecutorReviewBoundaryAudit({
    ...input,
    desktopHostClientSourceText: input.desktopHostClientSourceText.replace(
      "authorizeGovernanceOperatorActionHostExecutorReview({",
      "dispatchGovernanceOperatorActionHostExecutor({"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "host_client_executor_review_boundary_reviewSurfacePresent"
    )
  );
  assert.ok(
    review.reasons.includes(
      "host_client_executor_review_boundary_reviewUsesCurrentLifecycleOnly"
    )
  );
});

test("host client executor review boundary audit blocks weakened bridge isolation tests", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewHostClientExecutorReviewBoundaryAudit({
    ...input,
    desktopHostClientTestText: input.desktopHostClientTestText
      .replaceAll("assert.equal(calls.length, callCountBeforeReview)", "assert.ok(calls.length >= callCountBeforeReview)")
      .replaceAll("operator_action_host_executor_lifecycle_action_missing", "operator_action_host_executor_lifecycle_action_optional")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "host_client_executor_review_boundary_bridgeAndDispatchIsolationRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "host_client_executor_review_boundary_idleClientFailsClosed"
    )
  );
});

test("host client executor review boundary audit output stays summarized", async () => {
  const review = reviewHostClientExecutorReviewBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatHostClientExecutorReviewBoundaryAuditResult(review);
  const json = formatHostClientExecutorReviewBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /host bridge calls during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<HostClientExecutorReviewBoundaryAuditInput> = {}
): Promise<HostClientExecutorReviewBoundaryAuditInput> {
  return {
    phase12CloseoutText: await readFile(
      "docs/governance/PHASE_12_OPERATOR_ACTION_HOST_CLIENT_REVIEW_SURFACE_CLOSEOUT.md",
      "utf8"
    ),
    currentStateText: await readFile("docs/current/CURRENT_STATE.md", "utf8"),
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    desktopHostClientSourceText: await readFile(
      "packages/desktop-host-client/src/index.ts",
      "utf8"
    ),
    desktopHostClientTestText: await readFile(
      "tests/desktop-host-client.test.ts",
      "utf8"
    ),
    publicApiHostSourceText: await readFile(
      "packages/public-api/src/host.ts",
      "utf8"
    ),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    ...overrides
  };
}
