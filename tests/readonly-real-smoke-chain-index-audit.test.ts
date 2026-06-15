import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatReadonlyRealSmokeChainIndexAuditResult,
  reviewReadonlyRealSmokeChainIndexAudit,
  type ReadonlyRealSmokeChainIndexAuditInput
} from "../scripts/run-readonly-real-smoke-chain-index-audit.js";

const forbiddenOutputMarkers = [
  "APPROVE_FORMAL_REAL_CODEX_CLI_READONLY_SMOKE_EXECUTION_PR_18A",
  "APPROVE_REAL_CODEX_CLI_READONLY_SMOKE_PR_13A",
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

test("read-only real smoke chain index audit passes for the local chain", async () => {
  const review = reviewReadonlyRealSmokeChainIndexAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.deepEqual(review.checks, {
    worktreeClean: true,
    branchMain: true,
    notBehindOrigin: true,
    packageScriptsPresent: true,
    pr13aIndexRecorded: true,
    pr18cCloseoutRecorded: true,
    pr19cCloseoutRecorded: true,
    pr20aIndexRecorded: true,
    realSmokeEvidencePassed: true,
    formalExecutionAuthClosed: true,
    formalFinalPreflightClosed: true,
    workspaceWriteClosed: true,
    providerExecuteClosed: true,
    evidenceSanitized: true,
    indexNonAuthorizing: true,
    noProviderExecuteDuringIndex: true,
    noRealCodexCliDuringIndex: true,
    noWorkspaceWriteExecuteDuringIndex: true
  });
  assert.equal(review.summary.packageScriptTargetCount, 4);
  assert.equal(review.summary.packageScriptMismatchCount, 0);
  assert.equal(review.summary.realSmokeStatus, "passed");
  assert.equal(review.summary.realSmokeSandbox, "read-only");
  assert.equal(review.summary.realSmokeApprovalPolicy, "never");
  assert.equal(review.summary.realSmokeExitCode, 0);
  assert.equal(review.summary.realCodexCliCallsDuringIndex, 0);
});

test("read-only real smoke chain index audit blocks stale or unsafe receipt", async () => {
  const input = await createInputFromWorkspace();
  const receipt = JSON.parse(input.realSmokeEvidenceText);
  receipt.status = "failed";
  receipt.plan.sandbox = "workspace-write";
  receipt.checks.noWorkspaceWrite = false;

  const review = reviewReadonlyRealSmokeChainIndexAudit({
    ...input,
    gitStatusShort: " M package.json\n",
    branch: "feature",
    aheadBehind: "95\t1",
    packageJsonText: JSON.stringify({ scripts: {} }),
    pr20aIndexText: "stale",
    realSmokeEvidenceText: JSON.stringify(receipt)
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_index_worktreeClean"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_index_branchMain"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_index_notBehindOrigin"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_index_packageScriptsPresent"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_index_pr20aIndexRecorded"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_index_realSmokeEvidencePassed"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_index_workspaceWriteClosed"));
});

test("read-only real smoke chain index audit blocks reopened formal gates", async () => {
  const input = await createInputFromWorkspace();
  const auth = JSON.parse(input.formalExecutionAuthEvidenceText);
  const preflight = JSON.parse(input.formalFinalPreflightEvidenceText);
  auth.checks.noProviderExecute = false;
  preflight.checks.immediateExecutionBlocked = false;
  preflight.summary.currentExecutionMustRemainClosed = false;

  const review = reviewReadonlyRealSmokeChainIndexAudit({
    ...input,
    formalExecutionAuthEvidenceText: JSON.stringify(auth),
    formalFinalPreflightEvidenceText: JSON.stringify(preflight)
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_index_formalExecutionAuthClosed"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_index_formalFinalPreflightClosed"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_index_providerExecuteClosed"));
});

test("read-only real smoke chain index audit output stays summarized", async () => {
  const review = reviewReadonlyRealSmokeChainIndexAudit(
    await createInputFromWorkspace()
  );
  const text = formatReadonlyRealSmokeChainIndexAuditResult(review);
  const json = formatReadonlyRealSmokeChainIndexAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /real CLI calls during index: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.realCodexCliCallsDuringIndex, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<ReadonlyRealSmokeChainIndexAuditInput> = {}
): Promise<ReadonlyRealSmokeChainIndexAuditInput> {
  const [
    packageJsonText,
    pr13aIndexText,
    pr18cCloseoutText,
    pr19cCloseoutText,
    realSmokeEvidenceText,
    formalExecutionAuthEvidenceText,
    formalFinalPreflightEvidenceText
  ] = await Promise.all([
    readFile("package.json", "utf8"),
    readFile("docs/governance/PR_13A_REAL_READONLY_SMOKE_LOCAL_AUDIT_INDEX.md", "utf8"),
    readFile(
      "docs/governance/PR_18C_FORMAL_REAL_READONLY_SMOKE_EXECUTION_LOCAL_CLOSEOUT.md",
      "utf8"
    ),
    readFile(
      "docs/governance/PR_19C_FORMAL_REAL_READONLY_SMOKE_LOCAL_RC_CLOSEOUT.md",
      "utf8"
    ),
    readFile("docs/evidence/codex-cli-real-readonly-smoke.json", "utf8"),
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
    aheadBehind: "95\t0",
    packageJsonText,
    pr13aIndexText,
    pr18cCloseoutText,
    pr19cCloseoutText,
    pr20aIndexText: createPr20aIndexText(),
    realSmokeEvidenceText,
    formalExecutionAuthEvidenceText,
    formalFinalPreflightEvidenceText,
    ...overrides
  };
}

function createPr20aIndexText(): string {
  return [
    "PR_20A_READONLY_REAL_SMOKE_CHAIN_INDEX_RECORDED",
    "npm run audit:readonly-real-smoke-chain-index",
    "npm run audit:readonly-real-smoke-chain-index -- --json",
    "docs/evidence/codex-cli-real-readonly-smoke.json",
    "docs/evidence/codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.json",
    "docs/evidence/codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.json",
    "does not authorize invoking the real Codex CLI",
    "does not authorize provider execute",
    "does not authorize workspace-write",
    "does not authorize push, release, or tag",
    "does not set an execution operator flag"
  ].join("\n");
}
