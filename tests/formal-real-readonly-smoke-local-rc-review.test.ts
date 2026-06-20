import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatFormalRealReadonlySmokeLocalRcReviewResult,
  reviewFormalRealReadonlySmokeLocalRc,
  type FormalRealReadonlySmokeLocalRcReviewInput
} from "../scripts/run-formal-real-readonly-smoke-local-rc-review.js";

const forbiddenOutputMarkers = [
  "APPROVE_FORMAL_REAL_CODEX_CLI_READONLY_SMOKE_EXECUTION_PR_18A",
  "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE",
  "smoke:readonly:real",
  "requestedAction",
  "prompt",
  "args",
  "stdout",
  "stderr",
  "raw command",
  "raw task envelope",
  "raw env",
  "raw token",
  "raw patch",
  "OPENAI_API_KEY",
  "sk-",
  "Bearer"
];

test("formal real read-only smoke local RC review approves the local candidate", async () => {
  const review = reviewFormalRealReadonlySmokeLocalRc(await createInputFromWorkspace());

  assert.equal(review.decision, "APPROVE_LOCAL_RC");
  assert.deepEqual(review.reasons, []);
  assert.deepEqual(review.checks, {
    worktreeClean: true,
    branchMain: true,
    notBehindOrigin: true,
    packageScriptsPresent: true,
    pr18cCloseoutRecorded: true,
    pr19aReceiptAuditRecorded: true,
    pr19bLocalRcRecorded: true,
    finalPreflightPassedAndClosed: true,
    defaultReceiptPassedReadOnly: true,
    workspaceWriteClosed: true,
    providerExecuteClosed: true,
    realCliNotInvokedByReview: true,
    evidenceSanitized: true,
    rcNonAuthorizing: true
  });
  assert.equal(review.summary.packageScriptTargetCount, 1);
  assert.equal(review.summary.packageScriptMismatchCount, 0);
  assert.equal(review.summary.behind, 0);
  assert.equal(review.summary.receiptStatus, "passed");
  assert.equal(review.summary.receiptSandbox, "read-only");
  assert.equal(review.summary.receiptApprovalPolicy, "never");
  assert.equal(review.summary.receiptExitCode, 0);
  assert.equal(review.summary.realCodexCliCallsDuringReview, 0);
});

test("formal real read-only smoke local RC review blocks stale state", async () => {
  const input = await createInputFromWorkspace();
  const receipt = JSON.parse(input.defaultReceiptEvidenceText);
  receipt.status = "failed";
  receipt.plan.sandbox = "workspace-write";
  receipt.checks.noWorkspaceWrite = false;

  const review = reviewFormalRealReadonlySmokeLocalRc({
    ...input,
    gitStatusShort: " M package.json\n",
    branch: "feature",
    aheadBehind: "92\t1",
    packageJsonText: JSON.stringify({ scripts: {} }),
    defaultReceiptEvidenceText: JSON.stringify(receipt),
    pr19bLocalRcText: "stale"
  });

  assert.equal(review.decision, "BLOCK_LOCAL_RC");
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_local_rc_worktreeClean"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_local_rc_branchMain"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_local_rc_notBehindOrigin"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_local_rc_packageScriptsPresent"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_local_rc_pr19bLocalRcRecorded"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_local_rc_defaultReceiptPassedReadOnly"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_local_rc_workspaceWriteClosed"
  ));
});

test("formal real read-only smoke local RC review blocks reopened preflight", async () => {
  const input = await createInputFromWorkspace();
  const finalPreflight = JSON.parse(input.finalPreflightEvidenceText);
  finalPreflight.checks.immediateExecutionBlocked = false;
  finalPreflight.checks.noProviderExecute = false;
  finalPreflight.summary.currentExecutionMustRemainClosed = false;

  const review = reviewFormalRealReadonlySmokeLocalRc({
    ...input,
    finalPreflightEvidenceText: JSON.stringify(finalPreflight)
  });

  assert.equal(review.decision, "BLOCK_LOCAL_RC");
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_local_rc_finalPreflightPassedAndClosed"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_local_rc_providerExecuteClosed"
  ));
});

test("formal real read-only smoke local RC review output stays summarized", async () => {
  const review = reviewFormalRealReadonlySmokeLocalRc(await createInputFromWorkspace());
  const text = formatFormalRealReadonlySmokeLocalRcReviewResult(review);
  const json = formatFormalRealReadonlySmokeLocalRcReviewResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /decision: APPROVE_LOCAL_RC/);
  assert.match(text, /real CLI calls during review: 0/);
  assert.equal(parsed.decision, "APPROVE_LOCAL_RC");
  assert.equal(parsed.summary.realCodexCliCallsDuringReview, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<FormalRealReadonlySmokeLocalRcReviewInput> = {}
): Promise<FormalRealReadonlySmokeLocalRcReviewInput> {
  const [
    packageJsonText,
    pr18cCloseoutText,
    pr19aReceiptAuditText,
    finalPreflightEvidenceText,
    defaultReceiptEvidenceText
  ] = await Promise.all([
    readFile("package.json", "utf8"),
    readFile(
      "docs/governance/PR_18C_FORMAL_REAL_READONLY_SMOKE_EXECUTION_LOCAL_CLOSEOUT.md",
      "utf8"
    ),
    readFile(
      "docs/governance/PR_19A_FORMAL_REAL_READONLY_SMOKE_RECEIPT_LOCAL_AUDIT.md",
      "utf8"
    ),
    readFile(
      "docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json",
      "utf8"
    ),
    readFile("docs/evidence/codex-cli-real-readonly-smoke.json", "utf8")
  ]);

  return {
    gitStatusShort: "",
    branch: "main",
    aheadBehind: "92\t0",
    packageJsonText,
    pr18cCloseoutText,
    pr19aReceiptAuditText,
    pr19bLocalRcText: createPr19bLocalRcText(),
    finalPreflightEvidenceText,
    defaultReceiptEvidenceText,
    ...overrides
  };
}

function createPr19bLocalRcText(): string {
  return [
    "PR_19B_FORMAL_REAL_READONLY_SMOKE_LOCAL_RC_REVIEW_RECORDED",
    "npm run governance -- audit formal-real-readonly-smoke-local-rc",
    "npm run governance -- audit formal-real-readonly-smoke-local-rc -- --json",
    "docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json",
    "docs/evidence/codex-cli-real-readonly-smoke.json",
    "does not authorize invoking the real Codex CLI",
    "does not authorize provider execute",
    "does not authorize workspace-write",
    "does not authorize push, release, or tag",
    "does not set the future execution operator flag"
  ].join("\n");
}
