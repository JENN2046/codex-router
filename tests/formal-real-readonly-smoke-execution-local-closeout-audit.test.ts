import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatFormalRealReadonlySmokeExecutionLocalCloseoutAuditResult,
  reviewFormalRealReadonlySmokeExecutionLocalCloseoutAudit,
  type FormalRealReadonlySmokeExecutionLocalCloseoutAuditInput
} from "../scripts/run-formal-real-readonly-smoke-execution-local-closeout-audit.js";

const forbiddenOutputMarkers = [
  "APPROVE_FORMAL_REAL_CODEX_CLI_READONLY_SMOKE_EXECUTION_PR_18A",
  "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE",
  "smoke:readonly:real",
  "workspace-write",
  "on-request",
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

test("formal real read-only smoke execution closeout audit passes for PR-18A/B state", async () => {
  const review = reviewFormalRealReadonlySmokeExecutionLocalCloseoutAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.deepEqual(review.checks, {
    worktreeClean: true,
    branchMain: true,
    packageScriptsPresent: true,
    priorLocalCloseoutRecorded: true,
    pr18aAuthorizationRecorded: true,
    pr18bFinalPreflightRecorded: true,
    pr18cCloseoutRecorded: true,
    executionAuthorizationEvidencePassed: true,
    finalPreflightEvidencePassed: true,
    requiredValidationChainDeclared: true,
    priorCloseoutRequired: true,
    formalBoundaryRequired: true,
    defaultEvidencePathRequired: true,
    operatorFlagNotSetByPreflight: true,
    currentExecutionBlocked: true,
    noProviderExecute: true,
    noRealCodexCli: true,
    noWorkspaceWriteExecute: true,
    evidenceSanitized: true,
    closeoutNonAuthorizing: true
  });
  assert.equal(review.summary.packageScriptTargetCount, 1);
  assert.equal(review.summary.packageScriptMismatchCount, 0);
  assert.equal(review.summary.providerId, "codex-cli");
  assert.equal(review.summary.sideEffectClass, "read_only");
  assert.equal(review.summary.sandbox, "read-only");
  assert.equal(review.summary.approvalPolicy, "never");
  assert.equal(review.summary.evidencePathChoice, "default");
  assert.equal(review.summary.requiredValidationCommandCount, 7);
  assert.equal(review.summary.currentExecutionMustRemainClosed, true);
  assert.equal(review.summary.operatorFlagMustNotBeSetByPreflight, true);
  assert.equal(review.summary.providerExecuteCalls, 0);
  assert.equal(review.summary.realCodexCliCalls, 0);
  assert.equal(review.summary.workspaceWriteExecuteCalls, 0);
});

test("formal real read-only smoke execution closeout audit blocks stale or broadened state", async () => {
  const input = await createInputFromWorkspace();
  const finalPreflightEvidence = JSON.parse(input.finalPreflightEvidenceText);
  finalPreflightEvidence.checks.requiredValidationChainDeclared = false;
  finalPreflightEvidence.summary.operatorFlagMustNotBeSetByPreflight = false;
  finalPreflightEvidence.counters.realCodexCliCalls = 1;

  const review = reviewFormalRealReadonlySmokeExecutionLocalCloseoutAudit({
    ...input,
    gitStatusShort: " M package.json\n",
    branch: "feature",
    packageJsonText: JSON.stringify({ scripts: {} }),
    pr18bFinalPreflightText: input.pr18bFinalPreflightText.replace(
      "PR_18B_FORMAL_REAL_READONLY_SMOKE_FINAL_PREFLIGHT_RECORDED",
      "STALE_PREFLIGHT"
    ),
    finalPreflightEvidenceText: JSON.stringify(finalPreflightEvidence)
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_execution_local_closeout_worktreeClean"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_execution_local_closeout_branchMain"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_execution_local_closeout_packageScriptsPresent"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_execution_local_closeout_pr18bFinalPreflightRecorded"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_execution_local_closeout_finalPreflightEvidencePassed"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_execution_local_closeout_requiredValidationChainDeclared"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_execution_local_closeout_operatorFlagNotSetByPreflight"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_execution_local_closeout_noRealCodexCli"
  ));
  assert.equal(review.summary.realCodexCliCalls, 1);
});

test("formal real read-only smoke execution closeout audit output stays summarized", async () => {
  const review = reviewFormalRealReadonlySmokeExecutionLocalCloseoutAudit(
    await createInputFromWorkspace()
  );
  const text =
    formatFormalRealReadonlySmokeExecutionLocalCloseoutAuditResult(review);
  const json =
    formatFormalRealReadonlySmokeExecutionLocalCloseoutAuditResult(
      review,
      "json"
    );
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /required validation commands: 7/);
  assert.match(text, /real CLI calls: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.realCodexCliCalls, 0);
  assert.equal(parsed.summary.workspaceWriteExecuteCalls, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<FormalRealReadonlySmokeExecutionLocalCloseoutAuditInput> = {}
): Promise<FormalRealReadonlySmokeExecutionLocalCloseoutAuditInput> {
  const [
    packageJsonText,
    pr17cCloseoutText,
    pr18aAuthorizationText,
    pr18bFinalPreflightText,
    executionAuthorizationEvidenceText,
    finalPreflightEvidenceText
  ] = await Promise.all([
    readFile("package.json", "utf8"),
    readFile("docs/governance/PR_17C_FORMAL_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT.md", "utf8"),
    readFile(
      "docs/governance/PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_AUTHORIZATION_PACKET.md",
      "utf8"
    ),
    readFile(
      "docs/governance/PR_18B_FORMAL_REAL_READONLY_SMOKE_FINAL_PREFLIGHT.md",
      "utf8"
    ),
    readFile(
      "docs/evidence/codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.json",
      "utf8"
    ),
    readFile(
      "docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json",
      "utf8"
    )
  ]);

  return {
    gitStatusShort: "",
    branch: "main",
    packageJsonText,
    pr17cCloseoutText,
    pr18aAuthorizationText,
    pr18bFinalPreflightText,
    pr18cCloseoutText: createCloseoutDocumentText(),
    executionAuthorizationEvidenceText,
    finalPreflightEvidenceText,
    ...overrides
  };
}

function createCloseoutDocumentText(): string {
  return [
    "PR_18C_FORMAL_REAL_READONLY_SMOKE_EXECUTION_LOCAL_CLOSEOUT_COMPLETE",
    "npm run governance -- audit formal-real-readonly-smoke-execution-local",
    "npm run governance -- audit formal-real-readonly-smoke-execution-local -- --json",
    "docs/evidence/codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.json",
    "docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json",
    "does not authorize invoking the real Codex CLI",
    "does not authorize provider execute",
    "does not authorize workspace-write",
    "does not authorize local command",
    "does not authorize protected remote",
    "does not authorize push, release, or tag",
    "does not set the future execution operator flag"
  ].join("\n");
}
