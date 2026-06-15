import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE
} from "../packages/workspace-write-guard/src/index.js";
import {
  formatFutureCodexCliCanaryPreExecutionReviewAuditResult,
  reviewFutureCodexCliCanaryPreExecutionReviewAudit,
  type FutureCodexCliCanaryPreExecutionReviewAuditInput
} from "../scripts/run-future-codex-cli-canary-pre-execution-review-audit.js";

const forbiddenOutputMarkers = [
  "requestedAction",
  "prompt",
  "stdout",
  "stderr",
  "raw command",
  "raw env",
  "raw token",
  "raw patch",
  "OPENAI_API_KEY",
  "sk-",
  "Bearer"
];

test("future canary pre-execution review audit passes for local draft", async () => {
  const review = reviewFutureCodexCliCanaryPreExecutionReviewAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.preExecutionReviewRecorded, true);
  assert.equal(review.checks.reviewNonExecuting, true);
  assert.equal(review.checks.priorExecutionGateRecorded, true);
  assert.equal(review.checks.exactReviewFieldsRecorded, true);
  assert.equal(review.checks.freshPreconditionsRecorded, true);
  assert.equal(review.checks.stopConditionsRecorded, true);
  assert.equal(review.summary.canaryTargetFile, DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE);
  assert.equal(review.summary.providerExecuteCallsDuringReview, 0);
  assert.equal(review.summary.realCodexCliCallsDuringReview, 0);
  assert.equal(review.summary.workspaceWriteExecuteCallsDuringReview, 0);
  assert.equal(review.summary.canaryFileWritesDuringReview, 0);
});

test("future canary pre-execution review audit blocks broadened review", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewFutureCodexCliCanaryPreExecutionReviewAudit({
    ...input,
    reviewDocText: input.reviewDocText
      .replaceAll("It is not the canary execution itself.", "Run the canary now.")
      .replaceAll("push authorized: `false`", "push authorized: `true`")
      .replaceAll("target file: `tmp/codex-cli-write-canary.txt`", "target file: any file")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("future_codex_cli_canary_pre_execution_review_reviewNonExecuting")
  );
  assert.ok(
    review.reasons.includes(
      "future_codex_cli_canary_pre_execution_review_exactReviewFieldsRecorded"
    )
  );
});

test("future canary pre-execution review audit blocks stale evidence", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewFutureCodexCliCanaryPreExecutionReviewAudit({
    ...input,
    workspaceWriteAuthorizationEvidenceText: JSON.stringify({
      mode: "workspace-write-real-canary-authorization-local-only",
      checks: {
        exactAuthorizationAccepted: true,
        broadenedAuthorizationBlocked: false,
        pushAuthorizationRejected: false
      },
      summary: {
        targetFile: "tmp/other.txt",
        branch: "main",
        requiredSandbox: "workspace-write",
        requiredRollback: false,
        pushMustBeSeparate: false
      },
      counters: {
        providerExecuteCalls: 0,
        realCodexCliCalls: 0,
        workspaceWriteExecuteCalls: 1,
        canaryFileWrites: 0
      }
    })
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "future_codex_cli_canary_pre_execution_review_workspaceWriteAuthorizationEvidenceValid"
    )
  );
});

test("future canary pre-execution review audit blocks unsafe local state", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewFutureCodexCliCanaryPreExecutionReviewAudit({
    ...input,
    gitStatusShort: " M package.json\n",
    branch: "feature",
    aheadBehind: "1\t0",
    canaryFileExists: true
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("future_codex_cli_canary_pre_execution_review_worktreeClean"));
  assert.ok(review.reasons.includes("future_codex_cli_canary_pre_execution_review_branchMain"));
  assert.ok(
    review.reasons.includes("future_codex_cli_canary_pre_execution_review_mainAlignedWithOrigin")
  );
  assert.ok(review.reasons.includes("future_codex_cli_canary_pre_execution_review_canaryFileAbsent"));
});

test("future canary pre-execution review audit output stays summarized", async () => {
  const review = reviewFutureCodexCliCanaryPreExecutionReviewAudit(
    await createInputFromWorkspace()
  );
  const text = formatFutureCodexCliCanaryPreExecutionReviewAuditResult(review);
  const json = formatFutureCodexCliCanaryPreExecutionReviewAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /workspace-write execute calls during review: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<FutureCodexCliCanaryPreExecutionReviewAuditInput> = {}
): Promise<FutureCodexCliCanaryPreExecutionReviewAuditInput> {
  return {
    gitStatusShort: "",
    branch: "main",
    aheadBehind: "0\t0",
    packageJsonText: await readFile("package.json", "utf8"),
    reviewDocText: await readFile(
      "docs/governance/FUTURE_CODEX_CLI_CANARY_PRE_EXECUTION_REVIEW.md",
      "utf8"
    ),
    executionGateDocText: await readFile(
      "docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_GATE.md",
      "utf8"
    ),
    authorizationPacketDocText: await readFile(
      "docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_AUTHORIZATION_PACKET.md",
      "utf8"
    ),
    checklistDocText: await readFile(
      "docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_PACKET_CHECKLIST.md",
      "utf8"
    ),
    controlledGateDocText: await readFile(
      "docs/governance/CONTROLLED_EXECUTION_GATE_NEXT_CODEX_CLI_STEP.md",
      "utf8"
    ),
    workspaceWriteAuthorizationEvidenceText: await readFile(
      "docs/evidence/workspace-write-real-canary-authorization-acceptance.json",
      "utf8"
    ),
    workspaceWritePreExecutionEvidenceText: await readFile(
      "docs/evidence/workspace-write-real-canary-pre-execution-acceptance.json",
      "utf8"
    ),
    canaryFileExists: false,
    ...overrides
  };
}
