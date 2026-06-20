import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatReadonlyRealSmokeChainLocalCandidateConsistencyResult,
  reviewReadonlyRealSmokeChainLocalCandidateConsistency,
  type ReadonlyRealSmokeChainLocalCandidateConsistencyInput
} from "../scripts/run-readonly-real-smoke-chain-local-candidate-consistency.js";

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

test("read-only real smoke chain local candidate approves the local chain", async () => {
  const review = reviewReadonlyRealSmokeChainLocalCandidateConsistency(
    await createInputFromWorkspace()
  );

  assert.equal(review.decision, "APPROVE_LOCAL_CANDIDATE");
  assert.deepEqual(review.reasons, []);
  assert.deepEqual(review.checks, {
    worktreeClean: true,
    branchMain: true,
    notBehindOrigin: true,
    packageScriptsPresent: true,
    chainIndexPassed: true,
    pr20aIndexRecorded: true,
    pr20bCandidateRecorded: true,
    realSmokeEvidencePassed: true,
    formalExecutionAuthClosed: true,
    formalFinalPreflightClosed: true,
    workspaceWriteClosed: true,
    providerExecuteClosed: true,
    evidenceSanitized: true,
    candidateNonAuthorizing: true,
    noProviderExecuteDuringCandidate: true,
    noRealCodexCliDuringCandidate: true,
    noWorkspaceWriteExecuteDuringCandidate: true
  });
  assert.equal(review.summary.packageScriptTargetCount, 1);
  assert.equal(review.summary.packageScriptMismatchCount, 0);
  assert.equal(review.summary.chainIndexStatus, "passed");
  assert.equal(review.summary.realSmokeSandbox, "read-only");
  assert.equal(review.summary.realSmokeApprovalPolicy, "never");
  assert.equal(review.summary.providerExecuteCallsDuringCandidate, 0);
  assert.equal(review.summary.realCodexCliCallsDuringCandidate, 0);
  assert.equal(review.summary.workspaceWriteExecuteCallsDuringCandidate, 0);
});

test("read-only real smoke chain local candidate blocks stale state", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewReadonlyRealSmokeChainLocalCandidateConsistency({
    ...input,
    chainIndexInput: {
      ...input.chainIndexInput,
      gitStatusShort: " M package.json\n",
      branch: "feature",
      aheadBehind: "96\t1",
      packageJsonText: JSON.stringify({ scripts: {} }),
      pr20aIndexText: "stale"
    }
  });

  assert.equal(review.decision, "BLOCK_LOCAL_CANDIDATE");
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_candidate_worktreeClean"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_candidate_branchMain"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_candidate_notBehindOrigin"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_candidate_packageScriptsPresent"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_candidate_chainIndexPassed"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_candidate_pr20aIndexRecorded"));
});

test("read-only real smoke chain local candidate blocks reopened gates", async () => {
  const input = await createInputFromWorkspace();
  const auth = JSON.parse(input.chainIndexInput.formalExecutionAuthEvidenceText);
  const preflight = JSON.parse(input.chainIndexInput.formalFinalPreflightEvidenceText);
  const receipt = JSON.parse(input.chainIndexInput.realSmokeEvidenceText);
  auth.checks.noProviderExecute = false;
  preflight.checks.noWorkspaceWriteExecute = false;
  receipt.status = "failed";

  const review = reviewReadonlyRealSmokeChainLocalCandidateConsistency({
    ...input,
    chainIndexInput: {
      ...input.chainIndexInput,
      realSmokeEvidenceText: JSON.stringify(receipt),
      formalExecutionAuthEvidenceText: JSON.stringify(auth),
      formalFinalPreflightEvidenceText: JSON.stringify(preflight)
    }
  });

  assert.equal(review.decision, "BLOCK_LOCAL_CANDIDATE");
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_candidate_chainIndexPassed"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_candidate_realSmokeEvidencePassed"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_candidate_formalExecutionAuthClosed"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_candidate_formalFinalPreflightClosed"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_candidate_workspaceWriteClosed"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_candidate_providerExecuteClosed"));
});

test("read-only real smoke chain local candidate output stays summarized", async () => {
  const review = reviewReadonlyRealSmokeChainLocalCandidateConsistency(
    await createInputFromWorkspace()
  );
  const text = formatReadonlyRealSmokeChainLocalCandidateConsistencyResult(review);
  const json = formatReadonlyRealSmokeChainLocalCandidateConsistencyResult(
    review,
    "json"
  );
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /decision: APPROVE_LOCAL_CANDIDATE/);
  assert.match(text, /real CLI calls during candidate: 0/);
  assert.equal(parsed.decision, "APPROVE_LOCAL_CANDIDATE");
  assert.equal(parsed.summary.realCodexCliCallsDuringCandidate, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<ReadonlyRealSmokeChainLocalCandidateConsistencyInput> = {}
): Promise<ReadonlyRealSmokeChainLocalCandidateConsistencyInput> {
  const [
    packageJsonText,
    pr13aIndexText,
    pr18cCloseoutText,
    pr19cCloseoutText,
    pr20aIndexText,
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
    readFile("docs/governance/PR_20A_READONLY_REAL_SMOKE_CHAIN_INDEX.md", "utf8"),
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
    chainIndexInput: {
      gitStatusShort: "",
      branch: "main",
      aheadBehind: "96\t0",
      packageJsonText,
      pr13aIndexText,
      pr18cCloseoutText,
      pr19cCloseoutText,
      pr20aIndexText,
      realSmokeEvidenceText,
      formalExecutionAuthEvidenceText,
      formalFinalPreflightEvidenceText
    },
    pr20bCandidateText: createPr20bCandidateText(),
    ...overrides
  };
}

function createPr20bCandidateText(): string {
  return [
    "PR_20B_READONLY_REAL_SMOKE_CHAIN_LOCAL_CANDIDATE_RECORDED",
    "npm run governance -- audit readonly-real-smoke-chain-candidate",
    "npm run governance -- audit readonly-real-smoke-chain-index",
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
