import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatControlledProviderExecutionTaskbookBoundaryAuditResult,
  reviewControlledProviderExecutionTaskbookBoundaryAudit,
  type ControlledProviderExecutionTaskbookBoundaryAuditInput
} from "../scripts/run-controlled-provider-execution-taskbook-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("controlled provider execution taskbook boundary audit passes for current evidence", async () => {
  const review = reviewControlledProviderExecutionTaskbookBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.taskbookMarkersPresent, true);
  assert.equal(review.checks.reviewCoverageRecorded, true);
  assert.equal(review.checks.noRuntimeInvocationSurface, true);
  assert.equal(review.checks.outputSanitized, true);
  assert.equal(review.summary.taskbookMode, "local_only_minimal_slice_taskbook");
  assert.equal(review.summary.taskbookIsProviderExecuteAuthorization, false);
  assert.equal(review.summary.taskbookIsRealCodexCliAuthorization, false);
  assert.equal(review.summary.taskbookIsWorkspaceWriteAuthorization, false);
  assert.equal(review.summary.taskbookIsHostExecutorAuthorization, false);
  assert.equal(review.summary.taskbookIsSubAgentRuntimeAuthorization, false);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.codexCliCallsDuringAudit, 0);
  assert.equal(review.summary.workspaceWriteCallsDuringAudit, 0);
  assert.equal(review.summary.hostExecutorCallsDuringAudit, 0);
  assert.equal(review.summary.subAgentRuntimeCallsDuringAudit, 0);
});

test("controlled provider execution taskbook boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewControlledProviderExecutionTaskbookBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "controlled-provider-execution-taskbook-boundary",
      "archived-controlled-provider-execution-taskbook"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_taskbook_boundary_governanceRunnerRegistered"
    )
  );
});

test("controlled provider execution taskbook boundary audit blocks missing control-plane authority", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewControlledProviderExecutionTaskbookBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Controlled provider execution taskbook boundary",
      "Archived controlled provider execution taskbook"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_taskbook_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("controlled provider execution taskbook boundary audit blocks broadened taskbook text", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewControlledProviderExecutionTaskbookBoundaryAudit({
    ...input,
    taskbookText: input.taskbookText
      .replaceAll("This taskbook is local-only.", "This taskbook is executable.")
      .replaceAll("does not authorize provider execute", "authorizes provider execute")
      .replaceAll(
        "execution mode remains disabled unless explicitly selected",
        "execution mode is enabled by default"
      )
      .replaceAll(
        "General provider execution remains closed.",
        "General provider execution is open."
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_taskbook_boundary_taskbookMarkersPresent"
    )
  );
});

test("controlled provider execution taskbook boundary audit blocks missing review coverage", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewControlledProviderExecutionTaskbookBoundaryAudit({
    ...input,
    taskbookReviewTestText: input.taskbookReviewTestText.replaceAll(
      "controlled provider execution taskbook review blocks broadened authorization text",
      "controlled provider execution taskbook review accepts broadened authorization text"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_taskbook_boundary_reviewCoverageRecorded"
    )
  );
});

test("controlled provider execution taskbook boundary audit blocks runtime invocation markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewControlledProviderExecutionTaskbookBoundaryAudit({
    ...input,
    taskbookText: `${input.taskbookText}\nprovider.execute(plan);`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_taskbook_boundary_noRuntimeInvocationSurface"
    )
  );
});

test("controlled provider execution taskbook boundary audit formats sanitized text and json", async () => {
  const review = reviewControlledProviderExecutionTaskbookBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatControlledProviderExecutionTaskbookBoundaryAuditResult(review);
  const json = formatControlledProviderExecutionTaskbookBoundaryAuditResult(
    review,
    "json"
  );
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /taskbook mode: local_only_minimal_slice_taskbook/);
  assert.match(text, /provider execute calls during audit: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.externalWriteCallsDuringAudit, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<ControlledProviderExecutionTaskbookBoundaryAuditInput> = {}
): Promise<ControlledProviderExecutionTaskbookBoundaryAuditInput> {
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
    taskbookReviewTestText: await readFile(
      "tests/controlled-provider-execution-taskbook-review-audit.test.ts",
      "utf8"
    ),
    ...overrides
  };
}
