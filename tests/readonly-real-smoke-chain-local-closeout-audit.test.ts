import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatReadonlyRealSmokeChainLocalCloseoutAuditResult,
  reviewReadonlyRealSmokeChainLocalCloseoutAudit,
  type ReadonlyRealSmokeChainLocalCloseoutAuditInput
} from "../scripts/run-readonly-real-smoke-chain-local-closeout-audit.js";

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

test("read-only real smoke chain local closeout passes for the local chain", async () => {
  const review = reviewReadonlyRealSmokeChainLocalCloseoutAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.deepEqual(review.checks, {
    worktreeClean: true,
    branchMain: true,
    notBehindOrigin: true,
    packageScriptsPresent: true,
    candidateApproved: true,
    pr20aIndexRecorded: true,
    pr20bCandidateRecorded: true,
    pr20cCloseoutRecorded: true,
    realSmokeEvidencePassed: true,
    formalGatesClosed: true,
    workspaceWriteClosed: true,
    providerExecuteClosed: true,
    evidenceSanitized: true,
    closeoutNonAuthorizing: true,
    noProviderExecuteDuringCloseout: true,
    noRealCodexCliDuringCloseout: true,
    noWorkspaceWriteExecuteDuringCloseout: true
  });
  assert.equal(review.summary.packageScriptTargetCount, 1);
  assert.equal(review.summary.packageScriptMismatchCount, 0);
  assert.equal(review.summary.candidateDecision, "APPROVE_LOCAL_CANDIDATE");
  assert.equal(review.summary.realSmokeSandbox, "read-only");
  assert.equal(review.summary.realSmokeApprovalPolicy, "never");
  assert.equal(review.summary.realCodexCliCallsDuringCloseout, 0);
});

test("read-only real smoke chain local closeout blocks stale candidate state", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewReadonlyRealSmokeChainLocalCloseoutAudit({
    ...input,
    candidateInput: {
      ...input.candidateInput,
      chainIndexInput: {
        ...input.candidateInput.chainIndexInput,
        gitStatusShort: " M package.json\n",
        branch: "feature",
        aheadBehind: "97\t1",
        packageJsonText: JSON.stringify({ scripts: {} })
      }
    }
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_local_closeout_worktreeClean"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_local_closeout_branchMain"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_local_closeout_notBehindOrigin"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_local_closeout_packageScriptsPresent"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_local_closeout_candidateApproved"));
});

test("read-only real smoke chain local closeout blocks reopened execution gates", async () => {
  const input = await createInputFromWorkspace();
  const auth = JSON.parse(
    input.candidateInput.chainIndexInput.formalExecutionAuthEvidenceText
  );
  const preflight = JSON.parse(
    input.candidateInput.chainIndexInput.formalFinalPreflightEvidenceText
  );
  auth.checks.noProviderExecute = false;
  preflight.checks.noWorkspaceWriteExecute = false;

  const review = reviewReadonlyRealSmokeChainLocalCloseoutAudit({
    ...input,
    candidateInput: {
      ...input.candidateInput,
      chainIndexInput: {
        ...input.candidateInput.chainIndexInput,
        formalExecutionAuthEvidenceText: JSON.stringify(auth),
        formalFinalPreflightEvidenceText: JSON.stringify(preflight)
      }
    }
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_local_closeout_candidateApproved"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_local_closeout_formalGatesClosed"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_local_closeout_workspaceWriteClosed"));
  assert.ok(review.reasons.includes("readonly_real_smoke_chain_local_closeout_providerExecuteClosed"));
});

test("read-only real smoke chain local closeout output stays summarized", async () => {
  const review = reviewReadonlyRealSmokeChainLocalCloseoutAudit(
    await createInputFromWorkspace()
  );
  const text = formatReadonlyRealSmokeChainLocalCloseoutAuditResult(review);
  const json = formatReadonlyRealSmokeChainLocalCloseoutAuditResult(
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
  overrides: Partial<ReadonlyRealSmokeChainLocalCloseoutAuditInput> = {}
): Promise<ReadonlyRealSmokeChainLocalCloseoutAuditInput> {
  const [
    packageJsonText,
    pr13aIndexText,
    pr18cCloseoutText,
    pr19cCloseoutText,
    pr20aIndexText,
    realSmokeEvidenceText,
    formalExecutionAuthEvidenceText,
    formalFinalPreflightEvidenceText,
    pr20bCandidateText
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
    ),
    readFile(
      "docs/governance/PR_20B_READONLY_REAL_SMOKE_CHAIN_LOCAL_CANDIDATE.md",
      "utf8"
    )
  ]);

  return {
    candidateInput: {
      chainIndexInput: {
        gitStatusShort: "",
        branch: "main",
        aheadBehind: "97\t0",
        packageJsonText,
        pr13aIndexText,
        pr18cCloseoutText,
        pr19cCloseoutText,
        pr20aIndexText,
        realSmokeEvidenceText,
        formalExecutionAuthEvidenceText,
        formalFinalPreflightEvidenceText
      },
      pr20bCandidateText
    },
    pr20cCloseoutText: createPr20cCloseoutText(),
    ...overrides
  };
}

function createPr20cCloseoutText(): string {
  return [
    "PR_20C_READONLY_REAL_SMOKE_CHAIN_LOCAL_CLOSEOUT_COMPLETE",
    "npm run governance -- audit readonly-real-smoke-chain-local-closeout",
    "npm run governance -- audit readonly-real-smoke-chain-candidate",
    "npm run governance -- audit readonly-real-smoke-chain-index",
    "docs/governance/PR_20A_READONLY_REAL_SMOKE_CHAIN_INDEX.md",
    "docs/governance/PR_20B_READONLY_REAL_SMOKE_CHAIN_LOCAL_CANDIDATE.md",
    "docs/governance/PR_20C_READONLY_REAL_SMOKE_CHAIN_LOCAL_CLOSEOUT.md",
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
