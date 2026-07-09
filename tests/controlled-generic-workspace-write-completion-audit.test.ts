import test from "node:test";
import assert from "node:assert/strict";
import {
  collectControlledGenericWorkspaceWriteCompletionAuditInput,
  formatControlledGenericWorkspaceWriteCompletionAuditResult,
  reviewControlledGenericWorkspaceWriteCompletionAudit
} from "../scripts/run-controlled-generic-workspace-write-completion-audit.js";

const forbiddenOutputMarkers = [
  "created controlled generic workspace write",
  "updated controlled generic workspace write",
  "initial edit value",
  "initial delete value",
  "OPENAI_API_KEY",
  "sk-",
  "Bearer"
];

test("controlled generic workspace-write completion audit passes for current evidence", async () => {
  const review = reviewControlledGenericWorkspaceWriteCompletionAudit(
    await collectControlledGenericWorkspaceWriteCompletionAuditInput()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.deepEqual(review.checks, {
    executorSupportsGenericOperations: true,
    runnerRoutesThroughLocalExecutor: true,
    dispatcherBindsPreflightAndOperations: true,
    hostAndDesktopSurfacesRouteControlledDispatch: true,
    agentOsPublicSurfacesExposePrepareAndDispatch: true,
    acceptanceEvidenceProvesCreateUpdateDeleteRollback: true,
    releaseGateRecordsGuardedControlledGenericReadiness: true,
    governanceSurfacesRegistered: true,
    noBroadAuthorizationText: true,
    evidenceSanitized: true
  });
  assert.equal(
    review.summary.completionMode,
    "controlled_generic_workspace_write_end_to_end_audit_only"
  );
  assert.equal(review.summary.controlledGenericWorkspaceWriteImplemented, true);
  assert.equal(review.summary.controlledGenericWorkspaceWriteAcceptanceCurrent, true);
  assert.equal(review.summary.defaultGeneralWorkspaceWriteAllowed, false);
  assert.equal(review.summary.providerExecuteForWorkspaceWriteAllowed, false);
  assert.equal(review.summary.realCodexCliWorkspaceWriteAllowed, false);
  assert.equal(review.summary.externalWriteAllowed, false);
  assert.equal(review.summary.auditWorkspaceWriteCalls, 0);
  assert.equal(review.summary.auditEvidenceWrites, 0);
});

test("controlled generic workspace-write completion audit blocks missing executor coverage", async () => {
  const input = await collectControlledGenericWorkspaceWriteCompletionAuditInput();
  const review = reviewControlledGenericWorkspaceWriteCompletionAudit({
    ...input,
    workspaceWriteExecutorTestText: input.workspaceWriteExecutorTestText.replaceAll(
      "workspace-write executor supports update and delete operations with rollback",
      "workspace-write executor skips update delete rollback"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_generic_workspace_write_completion_executorSupportsGenericOperations"
    )
  );
});

test("controlled generic workspace-write completion audit blocks dispatcher drift", async () => {
  const input = await collectControlledGenericWorkspaceWriteCompletionAuditInput();
  const review = reviewControlledGenericWorkspaceWriteCompletionAudit({
    ...input,
    controlledProviderDispatcherTestText:
      input.controlledProviderDispatcherTestText.replaceAll(
        "controlled provider dispatcher binds workspace-write operation manifest before runner",
        "controlled provider dispatcher skips operation manifest binding"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_generic_workspace_write_completion_dispatcherBindsPreflightAndOperations"
    )
  );
});

test("controlled generic workspace-write completion audit blocks stale acceptance evidence", async () => {
  const input = await collectControlledGenericWorkspaceWriteCompletionAuditInput();
  const review = reviewControlledGenericWorkspaceWriteCompletionAudit({
    ...input,
    acceptanceEvidenceText: input.acceptanceEvidenceText.replace(
      "\"executionWorkspaceWriteExecuteCalls\": 1",
      "\"executionWorkspaceWriteExecuteCalls\": 0"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_generic_workspace_write_completion_acceptanceEvidenceProvesCreateUpdateDeleteRollback"
    )
  );
});

test("controlled generic workspace-write completion audit blocks broadened authorization text", async () => {
  const input = await collectControlledGenericWorkspaceWriteCompletionAuditInput();
  const review = reviewControlledGenericWorkspaceWriteCompletionAudit({
    ...input,
    releaseGateDocText: `${input.releaseGateDocText}\ngeneral workspace-write authorized: \`true\`\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_generic_workspace_write_completion_noBroadAuthorizationText"
    )
  );
});

test("controlled generic workspace-write completion audit output stays summarized", async () => {
  const review = reviewControlledGenericWorkspaceWriteCompletionAudit(
    await collectControlledGenericWorkspaceWriteCompletionAuditInput()
  );
  const text = formatControlledGenericWorkspaceWriteCompletionAuditResult(review);
  const json = formatControlledGenericWorkspaceWriteCompletionAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /completion mode: controlled_generic_workspace_write_end_to_end_audit_only/);
  assert.match(text, /controlled generic workspace-write implemented: true/);
  assert.match(text, /default general workspace-write allowed: false/);
  assert.match(text, /workspace-write calls during audit: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.auditWorkspaceWriteCalls, 0);
  assert.equal(parsed.summary.auditEvidenceWrites, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});
