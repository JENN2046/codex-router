import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatReadonlyFormalIntegrationReadinessMatrixAuditResult,
  reviewReadonlyFormalIntegrationReadinessMatrixAudit,
  type ReadonlyFormalIntegrationReadinessMatrixAuditInput
} from "../scripts/run-readonly-formal-integration-readiness-matrix-audit.js";
import {
  collectFormalReadonlyIntegrationLocalCloseoutAuditInput
} from "../scripts/run-formal-readonly-cli-integration-local-closeout-audit.js";
import {
  collectFormalReadonlyProviderIntegrationLocalCloseoutAuditInput
} from "../scripts/run-formal-readonly-provider-integration-local-closeout-audit.js";
import {
  collectFormalReadonlyDispatchBoundaryLocalCloseoutAuditInput
} from "../scripts/run-formal-readonly-dispatch-boundary-local-closeout-audit.js";
import {
  collectFormalRealReadonlySmokeRcLocalCloseoutAuditInput
} from "../scripts/run-formal-real-readonly-smoke-rc-local-closeout-audit.js";
import {
  collectReadonlyRealSmokeChainLocalCloseoutAuditInput
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

test("read-only formal integration readiness matrix passes for local chain", async () => {
  const review = reviewReadonlyFormalIntegrationReadinessMatrixAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.deepEqual(review.checks, {
    worktreeClean: true,
    branchMain: true,
    notBehindOrigin: true,
    packageScriptsPresent: true,
    formalIntegrationClosed: true,
    providerIntegrationClosed: true,
    dispatchBoundaryClosed: true,
    formalRealSmokeRcClosed: true,
    realSmokeChainClosed: true,
    matrixDocRecorded: true,
    allMatrixRowsPassed: true,
    readOnlyBoundaryPreserved: true,
    workspaceWriteClosed: true,
    providerExecuteClosedForMatrix: true,
    realCliNotInvokedByMatrix: true,
    evidenceSanitized: true,
    matrixNonAuthorizing: true
  });
  assert.equal(review.summary.matrixRowCount, 5);
  assert.equal(review.summary.passedMatrixRowCount, 5);
  assert.equal(review.summary.packageScriptTargetCount, 6);
  assert.equal(review.summary.packageScriptMismatchCount, 0);
  assert.equal(review.summary.providerExecuteCallsDuringMatrix, 0);
  assert.equal(review.summary.realCodexCliCallsDuringMatrix, 0);
  assert.equal(review.summary.workspaceWriteExecuteCallsDuringMatrix, 0);
});

test("read-only formal integration readiness matrix blocks stale state", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewReadonlyFormalIntegrationReadinessMatrixAudit({
    ...input,
    gitStatusShort: " M package.json\n",
    branch: "feature",
    aheadBehind: "0\t1",
    packageJsonText: JSON.stringify({ scripts: {} }),
    pr21aMatrixText: "stale"
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("readonly_formal_integration_matrix_worktreeClean"));
  assert.ok(review.reasons.includes("readonly_formal_integration_matrix_branchMain"));
  assert.ok(review.reasons.includes("readonly_formal_integration_matrix_notBehindOrigin"));
  assert.ok(review.reasons.includes("readonly_formal_integration_matrix_packageScriptsPresent"));
  assert.ok(review.reasons.includes("readonly_formal_integration_matrix_matrixDocRecorded"));
});

test("read-only formal integration readiness matrix blocks reopened gates", async () => {
  const input = await createInputFromWorkspace();
  const providerEvidence = JSON.parse(
    input.providerIntegrationInput.integrationEvidenceText
  );
  providerEvidence.summary.sideEffectClass = "local_command";
  providerEvidence.checks.noWorkspaceWriteExecute = false;
  providerEvidence.counters.workspaceWriteExecuteCalls = 1;

  const smokeEvidence = JSON.parse(
    input.realSmokeChainInput.candidateInput.chainIndexInput
      .formalExecutionAuthEvidenceText
  );
  smokeEvidence.checks.noProviderExecute = false;

  const review = reviewReadonlyFormalIntegrationReadinessMatrixAudit({
    ...input,
    providerIntegrationInput: {
      ...input.providerIntegrationInput,
      integrationEvidenceText: JSON.stringify(providerEvidence)
    },
    realSmokeChainInput: {
      ...input.realSmokeChainInput,
      candidateInput: {
        ...input.realSmokeChainInput.candidateInput,
        chainIndexInput: {
          ...input.realSmokeChainInput.candidateInput.chainIndexInput,
          formalExecutionAuthEvidenceText: JSON.stringify(smokeEvidence)
        }
      }
    }
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("readonly_formal_integration_matrix_providerIntegrationClosed"));
  assert.ok(review.reasons.includes("readonly_formal_integration_matrix_realSmokeChainClosed"));
  assert.ok(review.reasons.includes("readonly_formal_integration_matrix_allMatrixRowsPassed"));
  assert.ok(review.reasons.includes("readonly_formal_integration_matrix_readOnlyBoundaryPreserved"));
  assert.ok(review.reasons.includes("readonly_formal_integration_matrix_workspaceWriteClosed"));
  assert.ok(review.reasons.includes("readonly_formal_integration_matrix_providerExecuteClosedForMatrix"));
});

test("read-only formal integration readiness matrix output stays summarized", async () => {
  const review = reviewReadonlyFormalIntegrationReadinessMatrixAudit(
    await createInputFromWorkspace()
  );
  const text = formatReadonlyFormalIntegrationReadinessMatrixAuditResult(review);
  const json = formatReadonlyFormalIntegrationReadinessMatrixAuditResult(
    review,
    "json"
  );
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /matrix rows passed: 5\/5/);
  assert.match(text, /real CLI calls during matrix: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.matrixRowCount, 5);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<ReadonlyFormalIntegrationReadinessMatrixAuditInput> = {}
): Promise<ReadonlyFormalIntegrationReadinessMatrixAuditInput> {
  const formalIntegrationInput =
    await collectFormalReadonlyIntegrationLocalCloseoutAuditInput();
  const providerIntegrationInput =
    await collectFormalReadonlyProviderIntegrationLocalCloseoutAuditInput();
  const dispatchBoundaryInput =
    await collectFormalReadonlyDispatchBoundaryLocalCloseoutAuditInput();
  const formalRealSmokeRcInput =
    await collectFormalRealReadonlySmokeRcLocalCloseoutAuditInput();
  const realSmokeChainInput =
    await collectReadonlyRealSmokeChainLocalCloseoutAuditInput();

  return {
    gitStatusShort: "",
    branch: "main",
    aheadBehind: "0\t0",
    packageJsonText: await readFile("package.json", "utf8"),
    pr21aMatrixText: createPr21aMatrixText(),
    formalIntegrationInput: {
      ...formalIntegrationInput,
      gitStatusShort: "",
      branch: "main"
    },
    providerIntegrationInput: {
      ...providerIntegrationInput,
      gitStatusShort: "",
      branch: "main"
    },
    dispatchBoundaryInput: {
      ...dispatchBoundaryInput,
      gitStatusShort: "",
      branch: "main"
    },
    formalRealSmokeRcInput: {
      ...formalRealSmokeRcInput,
      gitStatusShort: "",
      branch: "main",
      aheadBehind: "0\t0"
    },
    realSmokeChainInput: {
      ...realSmokeChainInput,
      candidateInput: {
        ...realSmokeChainInput.candidateInput,
        chainIndexInput: {
          ...realSmokeChainInput.candidateInput.chainIndexInput,
          gitStatusShort: "",
          branch: "main",
          aheadBehind: "0\t0"
        }
      }
    },
    ...overrides
  };
}

function createPr21aMatrixText(): string {
  return [
    "PR_21A_READONLY_FORMAL_INTEGRATION_READINESS_MATRIX_RECORDED",
    "npm run audit:readonly-formal-integration-matrix",
    "npm run audit:readonly-real-smoke-chain-local-closeout",
    "PR_14C_FORMAL_READONLY_CLI_INTEGRATION_LOCAL_CLOSEOUT_COMPLETE",
    "PR_15C_FORMAL_READONLY_PROVIDER_INTEGRATION_LOCAL_CLOSEOUT_COMPLETE",
    "PR_16B_FORMAL_READONLY_DISPATCH_BOUNDARY_LOCAL_CLOSEOUT_COMPLETE",
    "PR_19C_FORMAL_REAL_READONLY_SMOKE_LOCAL_RC_CLOSEOUT_COMPLETE",
    "PR_20C_READONLY_REAL_SMOKE_CHAIN_LOCAL_CLOSEOUT_COMPLETE",
    "does not authorize invoking the real Codex CLI",
    "does not authorize provider execute",
    "does not authorize workspace-write",
    "does not authorize push, release, or tag",
    "does not set an execution operator flag"
  ].join("\n");
}
