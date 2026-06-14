import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatFormalRealReadonlySmokeReceiptLocalAuditResult,
  reviewFormalRealReadonlySmokeReceiptLocalAudit,
  type FormalRealReadonlySmokeReceiptLocalAuditInput
} from "../scripts/run-formal-real-readonly-smoke-receipt-local-audit.js";

const forbiddenOutputMarkers = [
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

test("formal real read-only smoke receipt local audit passes for the default receipt", async () => {
  const review = reviewFormalRealReadonlySmokeReceiptLocalAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.deepEqual(review.checks, {
    worktreeClean: true,
    branchMain: true,
    packageScriptsPresent: true,
    smokeScriptDefaultEvidencePath: true,
    pr13aReceiptClosedOut: true,
    pr18cExecutionPreflightClosed: true,
    pr19aAuditRecorded: true,
    defaultReceiptPassed: true,
    defaultReceiptReadOnly: true,
    defaultReceiptCompleted: true,
    defaultReceiptSanitized: true,
    finalPreflightStillClosed: true,
    noProviderExecuteDuringAudit: true,
    noRealCodexCliDuringAudit: true,
    noWorkspaceWriteExecuteDuringAudit: true,
    auditNonAuthorizing: true
  });
  assert.equal(review.summary.packageScriptTargetCount, 4);
  assert.equal(review.summary.packageScriptMismatchCount, 0);
  assert.equal(review.summary.receiptStatus, "passed");
  assert.equal(review.summary.receiptSandbox, "read-only");
  assert.equal(review.summary.receiptApprovalPolicy, "never");
  assert.equal(review.summary.receiptExitCode, 0);
  assert.equal(review.summary.receiptRunStatus, "completed");
  assert.ok(review.summary.receiptEventCount > 0);
  assert.equal(review.summary.receiptParseErrorCount, 0);
  assert.equal(review.summary.finalPreflightCurrentExecutionClosed, true);
  assert.equal(review.summary.realCodexCliCallsDuringAudit, 0);
});

test("formal real read-only smoke receipt local audit blocks stale or broadened receipt", async () => {
  const input = await createInputFromWorkspace();
  const receipt = JSON.parse(input.defaultReceiptEvidenceText);
  receipt.status = "failed";
  receipt.summary.passed = false;
  receipt.checks.readOnlySandbox = false;
  receipt.checks.noWorkspaceWrite = false;
  receipt.plan.sandbox = "workspace-write";
  receipt.run.exitCode = 1;
  receipt.run.status = "failed";

  const review = reviewFormalRealReadonlySmokeReceiptLocalAudit({
    ...input,
    gitStatusShort: " M package.json\n",
    branch: "feature",
    packageJsonText: JSON.stringify({ scripts: {} }),
    defaultReceiptEvidenceText: JSON.stringify(receipt)
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_receipt_local_audit_worktreeClean"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_receipt_local_audit_branchMain"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_receipt_local_audit_packageScriptsPresent"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_receipt_local_audit_defaultReceiptPassed"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_receipt_local_audit_defaultReceiptReadOnly"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_receipt_local_audit_defaultReceiptCompleted"
  ));
  assert.equal(review.summary.receiptStatus, "failed");
  assert.equal(review.summary.receiptSandbox, "workspace-write");
});

test("formal real read-only smoke receipt local audit blocks reopened final preflight", async () => {
  const input = await createInputFromWorkspace();
  const finalPreflight = JSON.parse(input.finalPreflightEvidenceText);
  finalPreflight.checks.immediateExecutionBlocked = false;
  finalPreflight.checks.noRealCodexCli = false;
  finalPreflight.summary.currentExecutionMustRemainClosed = false;

  const review = reviewFormalRealReadonlySmokeReceiptLocalAudit({
    ...input,
    finalPreflightEvidenceText: JSON.stringify(finalPreflight)
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_receipt_local_audit_finalPreflightStillClosed"
  ));
  assert.equal(review.summary.finalPreflightCurrentExecutionClosed, false);
});

test("formal real read-only smoke receipt local audit output stays summarized", async () => {
  const review = reviewFormalRealReadonlySmokeReceiptLocalAudit(
    await createInputFromWorkspace()
  );
  const text = formatFormalRealReadonlySmokeReceiptLocalAuditResult(review);
  const json = formatFormalRealReadonlySmokeReceiptLocalAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /real CLI calls during audit: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.realCodexCliCallsDuringAudit, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<FormalRealReadonlySmokeReceiptLocalAuditInput> = {}
): Promise<FormalRealReadonlySmokeReceiptLocalAuditInput> {
  const [
    packageJsonText,
    smokeScriptText,
    pr13aCloseoutText,
    pr18cCloseoutText,
    defaultReceiptEvidenceText,
    finalPreflightEvidenceText
  ] = await Promise.all([
    readFile("package.json", "utf8"),
    readFile("scripts/run-codex-cli-real-readonly-smoke.ts", "utf8"),
    readFile("docs/governance/PR_13A_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT.md", "utf8"),
    readFile(
      "docs/governance/PR_18C_FORMAL_REAL_READONLY_SMOKE_EXECUTION_LOCAL_CLOSEOUT.md",
      "utf8"
    ),
    readFile("docs/evidence/codex-cli-real-readonly-smoke.json", "utf8"),
    readFile(
      "docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json",
      "utf8"
    )
  ]);

  return {
    gitStatusShort: "",
    branch: "main",
    packageJsonText,
    smokeScriptText,
    pr13aCloseoutText,
    pr18cCloseoutText,
    pr19aAuditText: createPr19aAuditText(),
    defaultReceiptEvidenceText,
    finalPreflightEvidenceText,
    ...overrides
  };
}

function createPr19aAuditText(): string {
  return [
    "PR_19A_FORMAL_REAL_READONLY_SMOKE_RECEIPT_LOCAL_AUDIT_RECORDED",
    "npm run audit:formal-real-readonly-smoke-receipt-local",
    "npm run audit:formal-real-readonly-smoke-receipt-local -- --json",
    "docs/evidence/codex-cli-real-readonly-smoke.json",
    "docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json",
    "does not authorize invoking the real Codex CLI",
    "does not authorize provider execute",
    "does not authorize workspace-write",
    "does not authorize push, release, or tag",
    "does not set the future execution operator flag"
  ].join("\n");
}
