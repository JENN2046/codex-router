import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatFormalRealReadonlySmokeLocalCloseoutAuditResult,
  reviewFormalRealReadonlySmokeLocalCloseoutAudit,
  type FormalRealReadonlySmokeLocalCloseoutAuditInput
} from "../scripts/run-formal-real-readonly-smoke-local-closeout-audit.js";

const forbiddenOutputMarkers = [
  "APPROVE_FORMAL_REAL_CODEX_CLI_READONLY_SMOKE_PR_17A",
  "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE",
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

test("formal real read-only smoke local closeout audit passes for PR-17A/B state", async () => {
  const review = reviewFormalRealReadonlySmokeLocalCloseoutAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.deepEqual(review.checks, {
    worktreeClean: true,
    branchMain: true,
    packageScriptsPresent: true,
    pr17aTaskbookRecorded: true,
    pr17bPreExecutionRecorded: true,
    pr17cCloseoutRecorded: true,
    taskbookEvidencePassed: true,
    preExecutionEvidencePassed: true,
    smokeScriptDefaultEvidencePath: true,
    smokeScriptBlocksWithoutOperatorFlag: true,
    exactFutureCommandRequired: true,
    defaultEvidencePathRequired: true,
    formalDispatchBoundaryRequired: true,
    providerExecuteStillSeparate: true,
    noProviderExecute: true,
    noRealCodexCli: true,
    noWorkspaceWriteExecute: true,
    evidenceSanitized: true,
    closeoutNonAuthorizing: true
  });
  assert.equal(review.summary.packageScriptTargetCount, 3);
  assert.equal(review.summary.packageScriptMismatchCount, 0);
  assert.equal(review.summary.providerId, "codex-cli");
  assert.equal(review.summary.sideEffectClass, "read_only");
  assert.equal(review.summary.sandbox, "read-only");
  assert.equal(review.summary.approvalPolicy, "never");
  assert.equal(review.summary.evidencePathChoice, "default");
  assert.equal(
    review.summary.realSmokeDefaultEvidencePath,
    "docs/evidence/codex-cli-real-readonly-smoke.json"
  );
  assert.equal(review.summary.taskbookAcceptanceStatus, "accepted");
  assert.equal(review.summary.blockedSmokeStatus, "blocked");
  assert.equal(review.summary.blockedSmokeRunnerCalls, 0);
  assert.equal(review.summary.providerExecuteCalls, 0);
  assert.equal(review.summary.realCodexCliCalls, 0);
  assert.equal(review.summary.workspaceWriteExecuteCalls, 0);
});

test("formal real read-only smoke local closeout audit blocks stale or broadened state", async () => {
  const input = await createInputFromWorkspace();
  const preExecutionEvidence = JSON.parse(input.preExecutionEvidenceText);
  preExecutionEvidence.checks.smokeScriptBlocksWithoutOperatorFlag = false;
  preExecutionEvidence.checks.noRealCodexCli = false;
  preExecutionEvidence.counters.blockedSmokeRunnerCalls = 1;
  preExecutionEvidence.counters.realCodexCliCalls = 1;

  const review = reviewFormalRealReadonlySmokeLocalCloseoutAudit({
    ...input,
    gitStatusShort: " M package.json\n",
    branch: "feature",
    packageJsonText: JSON.stringify({ scripts: {} }),
    realSmokeScriptText: input.realSmokeScriptText.replace(
      "docs/evidence/codex-cli-real-readonly-smoke.json",
      "docs/evidence/changed.json"
    ),
    preExecutionEvidenceText: JSON.stringify(preExecutionEvidence)
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_local_closeout_worktreeClean"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_local_closeout_branchMain"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_local_closeout_packageScriptsPresent"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_local_closeout_preExecutionEvidencePassed"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_local_closeout_smokeScriptDefaultEvidencePath"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_local_closeout_smokeScriptBlocksWithoutOperatorFlag"
  ));
  assert.ok(review.reasons.includes(
    "formal_real_readonly_smoke_local_closeout_noRealCodexCli"
  ));
  assert.equal(review.summary.blockedSmokeRunnerCalls, 1);
  assert.equal(review.summary.realCodexCliCalls, 1);
});

test("formal real read-only smoke local closeout audit output stays summarized", async () => {
  const review = reviewFormalRealReadonlySmokeLocalCloseoutAudit(
    await createInputFromWorkspace()
  );
  const text = formatFormalRealReadonlySmokeLocalCloseoutAuditResult(review);
  const json = formatFormalRealReadonlySmokeLocalCloseoutAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /blocked smoke runner calls: 0/);
  assert.match(text, /real CLI calls: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.blockedSmokeRunnerCalls, 0);
  assert.equal(parsed.summary.realCodexCliCalls, 0);
  assert.equal(parsed.summary.workspaceWriteExecuteCalls, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<FormalRealReadonlySmokeLocalCloseoutAuditInput> = {}
): Promise<FormalRealReadonlySmokeLocalCloseoutAuditInput> {
  const [
    packageJsonText,
    realSmokeScriptText,
    pr17aTaskbookText,
    pr17bPreExecutionText,
    taskbookEvidenceText,
    preExecutionEvidenceText
  ] = await Promise.all([
    readFile("package.json", "utf8"),
    readFile("scripts/run-codex-cli-real-readonly-smoke.ts", "utf8"),
    readFile("docs/governance/PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK.md", "utf8"),
    readFile("docs/governance/PR_17B_FORMAL_REAL_READONLY_SMOKE_PRE_EXECUTION.md", "utf8"),
    readFile(
      "docs/evidence/codex-cli-formal-real-readonly-smoke-taskbook-acceptance.json",
      "utf8"
    ),
    readFile(
      "docs/evidence/codex-cli-formal-real-readonly-smoke-pre-execution-acceptance.json",
      "utf8"
    )
  ]);

  return {
    gitStatusShort: "",
    branch: "main",
    packageJsonText,
    realSmokeScriptText,
    pr17aTaskbookText,
    pr17bPreExecutionText,
    pr17cCloseoutText: createCloseoutDocumentText(),
    taskbookEvidenceText,
    preExecutionEvidenceText,
    ...overrides
  };
}

function createCloseoutDocumentText(): string {
  return [
    "PR_17C_FORMAL_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT_COMPLETE",
    "npm run audit:formal-real-readonly-smoke-local",
    "npm run audit:formal-real-readonly-smoke-local -- --json",
    "docs/evidence/codex-cli-formal-real-readonly-smoke-taskbook-acceptance.json",
    "docs/evidence/codex-cli-formal-real-readonly-smoke-pre-execution-acceptance.json",
    "does not authorize invoking the real Codex CLI",
    "does not authorize provider execute",
    "does not authorize workspace-write",
    "does not authorize local command",
    "does not authorize protected remote",
    "does not authorize push, release, or tag"
  ].join("\n");
}
