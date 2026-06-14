import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatRealReadonlySmokeLocalCloseoutAuditResult,
  reviewRealReadonlySmokeLocalCloseoutAudit,
  type RealReadonlySmokeLocalCloseoutAuditInput
} from "../scripts/run-real-readonly-smoke-local-closeout-audit.js";

const forbiddenOutputMarkers = [
  "APPROVE_REAL_CODEX_CLI_READONLY_SMOKE_PR_13A",
  "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real",
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

test("real read-only smoke local closeout audit passes for the committed PR-13A state", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewRealReadonlySmokeLocalCloseoutAudit(input);

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.deepEqual(review.checks, {
    worktreeClean: true,
    branchMain: true,
    packageScriptsPresent: true,
    closeoutRecorded: true,
    receiptRecorded: true,
    taskbookStillGated: true,
    authCompatibilityRecorded: true,
    smokeEvidencePassed: true,
    authEvidenceLocalOnly: true,
    evidenceSanitized: true,
    boundariesClosed: true
  });
  assert.equal(review.summary.packageScriptTargetCount, 3);
  assert.equal(review.summary.packageScriptMismatchCount, 0);
  assert.equal(review.summary.smokeStatus, "passed");
  assert.equal(review.summary.smokeSandbox, "read-only");
  assert.equal(review.summary.smokeApprovalPolicy, "never");
  assert.equal(review.summary.smokeExitCode, 0);
  assert.equal(review.summary.providerExecuteCalls, 0);
  assert.equal(review.summary.realCodexCliCallsDuringAudit, 0);
  assert.equal(review.summary.workspaceWriteExecuteCalls, 0);
});

test("real read-only smoke local closeout audit blocks stale or broadened inputs", async () => {
  const input = await createInputFromWorkspace({
    gitStatusShort: " M package.json\n",
    branch: "feature",
    packageJsonText: JSON.stringify({ scripts: {} }),
    closeoutText: "missing closeout",
    smokeEvidenceText: JSON.stringify({
      schemaVersion: "codex-cli-real-readonly-smoke-gate.v1",
      mode: "real-readonly-smoke",
      status: "blocked",
      checks: {
        operatorFlagPresent: true,
        runnerInvoked: true,
        readOnlySandbox: false,
        approvalPolicyNever: false,
        noWorkspaceWrite: false,
        noFileWrite: false,
        sanitizedEvidence: false
      },
      plan: {
        sandbox: "workspace-write",
        approvalPolicy: "on-request"
      },
      run: {
        exitCode: 1,
        status: "failed",
        timedOut: false,
        killed: false
      }
    })
  });
  const review = reviewRealReadonlySmokeLocalCloseoutAudit(input);

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("real_readonly_smoke_audit_worktree_dirty"));
  assert.ok(review.reasons.includes("real_readonly_smoke_audit_branch_not_main"));
  assert.ok(review.reasons.includes("real_readonly_smoke_audit_package_scripts_missing"));
  assert.ok(review.reasons.includes("real_readonly_smoke_audit_closeout_missing"));
  assert.ok(review.reasons.includes("real_readonly_smoke_audit_smoke_evidence_not_passed"));
  assert.ok(review.reasons.includes("real_readonly_smoke_audit_evidence_leak_marker"));
});

test("real read-only smoke local closeout audit blocks missing auth acceptance evidence", async () => {
  const input = await createInputFromWorkspace({
    authEvidenceText: JSON.stringify({
      schemaVersion: "codex-cli-real-readonly-smoke-authorization-acceptance.v1",
      mode: "real-readonly-smoke-authorization-local-only",
      checks: {
        exactAuthorizationAccepted: true,
        broadenedAuthorizationBlocked: true,
        pushReleaseTagRejected: true,
        noProviderExecute: true,
        noRealCodexCli: false,
        noWorkspaceWriteExecute: true,
        leakCheckPassed: true
      },
      counters: {
        providerExecuteCalls: 0,
        realCodexCliCalls: 1,
        workspaceWriteExecuteCalls: 0
      }
    })
  });
  const review = reviewRealReadonlySmokeLocalCloseoutAudit(input);

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("real_readonly_smoke_audit_auth_evidence_not_local_only"));
});

test("real read-only smoke local closeout audit output stays summarized", async () => {
  const review = reviewRealReadonlySmokeLocalCloseoutAudit(
    await createInputFromWorkspace()
  );
  const text = formatRealReadonlySmokeLocalCloseoutAuditResult(review);
  const json = formatRealReadonlySmokeLocalCloseoutAuditResult(review, "json");
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
  overrides: Partial<RealReadonlySmokeLocalCloseoutAuditInput> = {}
): Promise<RealReadonlySmokeLocalCloseoutAuditInput> {
  const [
    packageJsonText,
    closeoutText,
    receiptText,
    taskbookText,
    authCompatibilityText,
    smokeEvidenceText,
    authEvidenceText
  ] = await Promise.all([
    readFile("package.json", "utf8"),
    readFile("docs/governance/PR_13A_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT.md", "utf8"),
    readFile("docs/governance/PR_13A_REAL_READONLY_SMOKE_RECEIPT.md", "utf8"),
    readFile("docs/governance/PR_13A_READONLY_REAL_CLI_PREFLIGHT_TASKBOOK.md", "utf8"),
    readFile(
      "docs/governance/PR_13A_READONLY_REAL_CLI_AUTHORIZATION_PACKET_COMPATIBILITY.md",
      "utf8"
    ),
    readFile("docs/evidence/codex-cli-real-readonly-smoke.json", "utf8"),
    readFile(
      "docs/evidence/codex-cli-real-readonly-smoke-authorization-acceptance.json",
      "utf8"
    )
  ]);

  return {
    gitStatusShort: "",
    branch: "main",
    packageJsonText,
    closeoutText,
    receiptText,
    taskbookText,
    authCompatibilityText,
    smokeEvidenceText,
    authEvidenceText,
    ...overrides
  };
}
