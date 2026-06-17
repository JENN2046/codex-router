import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatFormalRealReadonlySmokeRcLocalCloseoutAuditResult,
  reviewFormalRealReadonlySmokeRcLocalCloseoutAudit,
  type FormalRealReadonlySmokeRcLocalCloseoutAuditInput
} from "../scripts/run-formal-real-readonly-smoke-rc-local-closeout-audit.js";

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

test("formal real read-only smoke RC local closeout passes for the local RC chain", async () => {
  const review = reviewFormalRealReadonlySmokeRcLocalCloseoutAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.deepEqual(review.checks, {
    worktreeClean: true,
    branchMain: true,
    notBehindOrigin: true,
    packageScriptsPresent: true,
    pr18cCloseoutRecorded: true,
    pr19aReceiptAuditRecorded: true,
    pr19bLocalRcRecorded: true,
    pr19cCloseoutRecorded: true,
    finalPreflightClosed: true,
    defaultReceiptReadOnlyPassed: true,
    workspaceWriteClosed: true,
    providerExecuteClosed: true,
    evidenceSanitized: true,
    closeoutNonAuthorizing: true,
    noProviderExecuteDuringCloseout: true,
    noRealCodexCliDuringCloseout: true,
    noWorkspaceWriteExecuteDuringCloseout: true
  });
  assert.equal(review.summary.packageScriptTargetCount, 4);
  assert.equal(review.summary.packageScriptMismatchCount, 0);
  assert.equal(review.summary.behind, 0);
  assert.equal(review.summary.receiptStatus, "passed");
  assert.equal(review.summary.receiptSandbox, "read-only");
  assert.equal(review.summary.receiptApprovalPolicy, "never");
  assert.equal(review.summary.receiptExitCode, 0);
  assert.equal(review.summary.realCodexCliCallsDuringCloseout, 0);
});

test("formal real read-only smoke RC local closeout blocks stale or unsafe state", async () => {
  const input = await createInputFromWorkspace();
  const receipt = JSON.parse(input.defaultReceiptEvidenceText);
  receipt.status = "failed";
  receipt.plan.sandbox = "workspace-write";
  receipt.checks.noWorkspaceWrite = false;

  const review = reviewFormalRealReadonlySmokeRcLocalCloseoutAudit({
    ...input,
    gitStatusShort: " M package.json\n",
    branch: "feature",
    aheadBehind: "93\t1",
    packageJsonText: JSON.stringify({ scripts: {} }),
    pr19cCloseoutText: "stale",
    defaultReceiptEvidenceText: JSON.stringify(receipt)
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_rc_local_closeout_worktreeClean"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_rc_local_closeout_branchMain"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_rc_local_closeout_notBehindOrigin"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_rc_local_closeout_packageScriptsPresent"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_rc_local_closeout_pr19cCloseoutRecorded"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_rc_local_closeout_defaultReceiptReadOnlyPassed"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_rc_local_closeout_workspaceWriteClosed"
  ));
});

test("formal real read-only smoke RC local closeout fails closed when origin freshness is unknown", async () => {
  const review = reviewFormalRealReadonlySmokeRcLocalCloseoutAudit({
    ...(await createInputFromWorkspace()),
    aheadBehind: "unknown\tunknown"
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_rc_local_closeout_notBehindOrigin"
  ));
  assert.equal(review.summary.behind, -1);
});

test("formal real read-only smoke RC local closeout blocks reopened final preflight", async () => {
  const input = await createInputFromWorkspace();
  const finalPreflight = JSON.parse(input.finalPreflightEvidenceText);
  finalPreflight.checks.immediateExecutionBlocked = false;
  finalPreflight.checks.noProviderExecute = false;
  finalPreflight.summary.currentExecutionMustRemainClosed = false;

  const review = reviewFormalRealReadonlySmokeRcLocalCloseoutAudit({
    ...input,
    finalPreflightEvidenceText: JSON.stringify(finalPreflight)
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_rc_local_closeout_finalPreflightClosed"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_rc_local_closeout_providerExecuteClosed"
  ));
});

test("formal real read-only smoke RC local closeout output stays summarized", async () => {
  const review = reviewFormalRealReadonlySmokeRcLocalCloseoutAudit(
    await createInputFromWorkspace()
  );
  const text = formatFormalRealReadonlySmokeRcLocalCloseoutAuditResult(review);
  const json = formatFormalRealReadonlySmokeRcLocalCloseoutAuditResult(
    review,
    "json"
  );
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /real CLI calls during closeout: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.realCodexCliCallsDuringCloseout, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<FormalRealReadonlySmokeRcLocalCloseoutAuditInput> = {}
): Promise<FormalRealReadonlySmokeRcLocalCloseoutAuditInput> {
  const [
    packageJsonText,
    pr18cCloseoutText,
    pr19aReceiptAuditText,
    pr19bLocalRcText,
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
      "docs/governance/PR_19B_FORMAL_REAL_READONLY_SMOKE_LOCAL_RC_REVIEW.md",
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
    aheadBehind: "93\t0",
    packageJsonText,
    pr18cCloseoutText,
    pr19aReceiptAuditText,
    pr19bLocalRcText,
    pr19cCloseoutText: createPr19cCloseoutText(),
    finalPreflightEvidenceText,
    defaultReceiptEvidenceText,
    ...overrides
  };
}

function createPr19cCloseoutText(): string {
  return [
    "PR_19C_FORMAL_REAL_READONLY_SMOKE_LOCAL_RC_CLOSEOUT_COMPLETE",
    "npm run audit:formal-real-readonly-smoke-rc-local-closeout",
    "npm run audit:formal-real-readonly-smoke-rc-local-closeout -- --json",
    "docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json",
    "docs/evidence/codex-cli-real-readonly-smoke.json",
    "does not authorize invoking the real Codex CLI",
    "does not authorize provider execute",
    "does not authorize workspace-write",
    "does not authorize push, release, or tag",
    "does not set the future execution operator flag"
  ].join("\n");
}
