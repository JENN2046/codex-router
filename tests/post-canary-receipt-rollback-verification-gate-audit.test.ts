import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE
} from "../packages/governance-internal-workspace-write-guard/src/index.js";
import {
  formatPostCanaryReceiptRollbackVerificationGateAuditResult,
  reviewPostCanaryReceiptRollbackVerificationGateAudit,
  type PostCanaryReceiptRollbackVerificationGateAuditInput
} from "../scripts/run-post-canary-receipt-rollback-verification-gate-audit.js";

const forbiddenOutputMarkers = [
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

test("post-canary receipt rollback gate audit passes for recorded canary evidence", async () => {
  const review = reviewPostCanaryReceiptRollbackVerificationGateAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.receiptRecorded, true);
  assert.equal(review.checks.receiptNonExecuting, true);
  assert.equal(review.checks.requiredReceiptFieldsRecorded, true);
  assert.equal(review.checks.stopConditionsRecorded, true);
  assert.equal(review.checks.realCanaryEvidenceValid, true);
  assert.equal(review.checks.rollbackVerified, true);
  assert.equal(review.summary.canaryTargetFile, DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE);
  assert.equal(review.summary.evidenceStatus, "passed");
  assert.equal(review.summary.executionStatus, "completed");
  assert.equal(review.summary.exitCode, 0);
  assert.equal(review.summary.parseErrorCount, 0);
  assert.equal(review.summary.providerExecuteCallsDuringReview, 0);
  assert.equal(review.summary.realCodexCliCallsDuringReview, 0);
  assert.equal(review.summary.workspaceWriteExecuteCallsDuringReview, 0);
  assert.equal(review.summary.canaryFileWritesDuringReview, 0);
  assert.equal(review.summary.additionalCanaryRunsDuringReview, 0);
});

test("post-canary receipt rollback gate audit blocks broadened receipt text", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewPostCanaryReceiptRollbackVerificationGateAudit({
    ...input,
    receiptDocText: input.receiptDocText
      .replaceAll("push authorized: `false`", "push authorized: `true`")
      .replaceAll(
        "It is not to run another workspace-write canary.",
        "Run another workspace-write canary."
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("post_canary_receipt_rollback_gate_receiptNonExecuting"));
  assert.ok(
    review.reasons.includes(
      "post_canary_receipt_rollback_gate_requiredReceiptFieldsRecorded"
    )
  );
});

test("post-canary receipt rollback gate audit blocks stale or unsafe evidence", async () => {
  const input = await createInputFromWorkspace();
  const evidence = JSON.parse(input.evidenceText) as Record<string, unknown>;
  const review = reviewPostCanaryReceiptRollbackVerificationGateAudit({
    ...input,
    evidenceText: JSON.stringify({
      ...evidence,
      status: "failed",
      approvalPacket: {
        targetFiles: ["tmp/other.txt"]
      },
      plan: {
        sandbox: "danger-full-access",
        approvalPolicy: "on-request"
      },
      run: {
        executionStatus: "failed",
        exitCode: 1,
        parseErrorCount: 1
      },
      summary: {
        passed: false,
        blockingReasons: ["unsafe"]
      }
    })
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("post_canary_receipt_rollback_gate_realCanaryEvidenceValid")
  );
  assert.ok(review.reasons.includes("post_canary_receipt_rollback_gate_rollbackVerified"));
});

test("post-canary receipt rollback gate audit blocks unsafe local state", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewPostCanaryReceiptRollbackVerificationGateAudit({
    ...input,
    gitStatusShort: " M package.json\n",
    branch: "docs/post-canary",
    aheadBehind: "1\t0",
    canaryFileExists: true
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("post_canary_receipt_rollback_gate_worktreeClean"));
  assert.ok(review.reasons.includes("post_canary_receipt_rollback_gate_branchMain"));
  assert.ok(review.reasons.includes("post_canary_receipt_rollback_gate_mainAlignedWithOrigin"));
  assert.ok(review.reasons.includes("post_canary_receipt_rollback_gate_canaryFileAbsent"));
});

test("post-canary receipt rollback gate audit output stays summarized", async () => {
  const review = reviewPostCanaryReceiptRollbackVerificationGateAudit(
    await createInputFromWorkspace()
  );
  const text = formatPostCanaryReceiptRollbackVerificationGateAuditResult(review);
  const json = formatPostCanaryReceiptRollbackVerificationGateAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /additional canary runs during review: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<PostCanaryReceiptRollbackVerificationGateAuditInput> = {}
): Promise<PostCanaryReceiptRollbackVerificationGateAuditInput> {
  return {
    gitStatusShort: "",
    branch: "main",
    aheadBehind: "0\t0",
    packageJsonText: await readFile("package.json", "utf8"),
    receiptDocText: await readFile(
      "docs/governance/POST_CANARY_RECEIPT_ROLLBACK_VERIFICATION_GATE.md",
      "utf8"
    ),
    evidenceText: await readFile(
      "docs/evidence/codex-cli-workspace-write-real-canary-latest.json",
      "utf8"
    ),
    canaryFileExists: false,
    ...overrides
  };
}
