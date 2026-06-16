import test from "node:test";
import assert from "node:assert/strict";
import {
  collectReadonlyProductizationAcceptanceInput,
  formatReadonlyProductizationAcceptanceResult,
  reviewReadonlyProductizationAcceptance,
  type ReadonlyProductizationAcceptanceInput
} from "../scripts/run-readonly-productization-acceptance.js";

const REAL_SMOKE_EVIDENCE =
  "docs/evidence/codex-cli-real-readonly-smoke.json";

const forbiddenOutputMarkers = [
  "raw prompt",
  "argv",
  "stdout",
  "stderr",
  "raw command",
  "raw env",
  "raw token",
  "raw patch",
  "OPENAI_API_KEY",
  "sk-",
  "Bearer"
];

const tokenLikePattern =
  /\b(?:sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|gh[pousr]_[A-Za-z0-9_]{8,})\b/;

test("read-only productization acceptance passes for clean local evidence", async () => {
  const review = reviewReadonlyProductizationAcceptance(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.deepEqual(review.checks, {
    worktreeClean: true,
    branchMain: true,
    notBehindOrigin: true,
    packageScriptsPresent: true,
    requiredEvidencePresent: true,
    evidenceSchemaStatusValid: true,
    formalGateChainClosed: true,
    productizationDocRecorded: true,
    roadmapUpdated: true,
    governanceDocsNonAuthorizing: true,
    readOnlyBoundaryPreserved: true,
    outputSanitized: true,
    noProviderExecuteDuringAudit: true,
    noRealCodexCliDuringAudit: true,
    noWorkspaceWriteDuringAudit: true,
    noEvidenceWriteDuringAudit: true
  });
  assert.equal(review.summary.packageScriptTargetCount, 6);
  assert.equal(review.summary.packageScriptMismatchCount, 0);
  assert.equal(review.summary.evidenceTargetCount, 10);
  assert.equal(review.summary.evidencePresentCount, 10);
  assert.equal(review.summary.evidenceSchemaStatusPassedCount, 10);
  assert.equal(review.summary.governanceDocPassedCount, 2);
  assert.equal(review.summary.readinessMatrixStatus, "passed");
});

test("read-only productization acceptance blocks missing package script", async () => {
  const input = await createInputFromWorkspace();
  const packageJson = JSON.parse(input.packageJsonText ?? "{}") as {
    scripts?: Record<string, string>;
  };
  delete packageJson.scripts?.["audit:readonly-productization"];

  const review = reviewReadonlyProductizationAcceptance({
    ...input,
    packageJsonText: JSON.stringify(packageJson)
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("readonly_productization_packageScriptsPresent")
  );
  assert.ok(
    review.missingItems.includes("package_script_readonly_productization")
  );
});

test("read-only productization acceptance blocks missing evidence", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewReadonlyProductizationAcceptance({
    ...input,
    evidenceTexts: {
      ...input.evidenceTexts,
      [REAL_SMOKE_EVIDENCE]: null
    },
    readinessMatrixInput: null,
    readinessMatrixCollectError: "missing evidence"
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("readonly_productization_requiredEvidencePresent")
  );
  assert.ok(
    review.reasons.includes("readonly_productization_evidenceSchemaStatusValid")
  );
  assert.ok(
    review.reasons.includes("readonly_productization_formalGateChainClosed")
  );
  assert.ok(
    review.missingItems.includes("evidence_real_readonly_smoke")
  );
});

test("read-only productization acceptance blocks evidence schema or status mismatch", async () => {
  const input = await createInputFromWorkspace();
  const realSmoke = JSON.parse(input.evidenceTexts[REAL_SMOKE_EVIDENCE] ?? "{}");
  realSmoke.schemaVersion = "codex-cli-real-readonly-smoke-gate.v0";
  realSmoke.status = "failed";

  const review = reviewReadonlyProductizationAcceptance({
    ...input,
    evidenceTexts: {
      ...input.evidenceTexts,
      [REAL_SMOKE_EVIDENCE]: JSON.stringify(realSmoke)
    }
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("readonly_productization_evidenceSchemaStatusValid")
  );
  assert.ok(
    review.reasons.includes("readonly_productization_readOnlyBoundaryPreserved")
  );
});

test("read-only productization acceptance blocks broadened authorization docs", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewReadonlyProductizationAcceptance({
    ...input,
    productizationDocText: (input.productizationDocText ?? "").replaceAll(
      "does not authorize workspace-write",
      "workspace-write authorized: `true`"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("readonly_productization_productizationDocRecorded")
  );
  assert.ok(
    review.reasons.includes("readonly_productization_governanceDocsNonAuthorizing")
  );
});

test("read-only productization acceptance output stays summarized and sanitized", async () => {
  const review = reviewReadonlyProductizationAcceptance(
    await createInputFromWorkspace()
  );
  const text = formatReadonlyProductizationAcceptanceResult(review);
  const json = formatReadonlyProductizationAcceptanceResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /real CLI calls during audit: 0/);
  assert.match(text, /workspace-write calls during audit: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.realCodexCliCallsDuringAudit, 0);
  assert.equal(parsed.summary.workspaceWriteCallsDuringAudit, 0);
  assert.equal(parsed.summary.evidenceWritesDuringAudit, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }

  assert.equal(tokenLikePattern.test(text), false);
  assert.equal(tokenLikePattern.test(json), false);
});

test("read-only productization acceptance records no execution or evidence writes", async () => {
  const review = reviewReadonlyProductizationAcceptance(
    await createInputFromWorkspace()
  );

  assert.equal(review.checks.noProviderExecuteDuringAudit, true);
  assert.equal(review.checks.noRealCodexCliDuringAudit, true);
  assert.equal(review.checks.noWorkspaceWriteDuringAudit, true);
  assert.equal(review.checks.noEvidenceWriteDuringAudit, true);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.realCodexCliCallsDuringAudit, 0);
  assert.equal(review.summary.workspaceWriteCallsDuringAudit, 0);
  assert.equal(review.summary.evidenceWritesDuringAudit, 0);
});

async function createInputFromWorkspace(
  overrides: Partial<ReadonlyProductizationAcceptanceInput> = {}
): Promise<ReadonlyProductizationAcceptanceInput> {
  const input = await collectReadonlyProductizationAcceptanceInput();
  assert.ok(input.readinessMatrixInput, "readiness matrix input must load");

  return {
    ...input,
    gitStatusShort: "",
    branch: "main",
    aheadBehind: "0\t0",
    readinessMatrixInput: {
      ...input.readinessMatrixInput,
      gitStatusShort: "",
      branch: "main",
      aheadBehind: "0\t0",
      formalIntegrationInput: {
        ...input.readinessMatrixInput.formalIntegrationInput,
        gitStatusShort: "",
        branch: "main"
      },
      providerIntegrationInput: {
        ...input.readinessMatrixInput.providerIntegrationInput,
        gitStatusShort: "",
        branch: "main"
      },
      dispatchBoundaryInput: {
        ...input.readinessMatrixInput.dispatchBoundaryInput,
        gitStatusShort: "",
        branch: "main"
      },
      formalRealSmokeRcInput: {
        ...input.readinessMatrixInput.formalRealSmokeRcInput,
        gitStatusShort: "",
        branch: "main",
        aheadBehind: "0\t0"
      },
      realSmokeChainInput: {
        ...input.readinessMatrixInput.realSmokeChainInput,
        candidateInput: {
          ...input.readinessMatrixInput.realSmokeChainInput.candidateInput,
          chainIndexInput: {
            ...input.readinessMatrixInput.realSmokeChainInput.candidateInput
              .chainIndexInput,
            gitStatusShort: "",
            branch: "main",
            aheadBehind: "0\t0"
          }
        }
      }
    },
    readinessMatrixCollectError: null,
    ...overrides
  };
}
