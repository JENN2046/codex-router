import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatFormalReadonlyIntegrationLocalCloseoutAuditResult,
  reviewFormalReadonlyIntegrationLocalCloseoutAudit,
  type FormalReadonlyIntegrationLocalCloseoutAuditInput
} from "../scripts/run-formal-readonly-cli-integration-local-closeout-audit.js";

const forbiddenOutputMarkers = [
  "APPROVE_FORMAL_CODEX_CLI_READONLY_PROVIDER_INTEGRATION_PR_14B",
  "npm run acceptance:formal-readonly-integration",
  "APPROVE_FORMAL_CODEX_CLI_PROVIDER_INTEGRATION",
  "npm run smoke:readonly:real",
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

test("formal read-only integration local closeout audit passes for committed PR-14 state", async () => {
  const review = reviewFormalReadonlyIntegrationLocalCloseoutAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.deepEqual(review.checks, {
    worktreeClean: true,
    branchMain: true,
    packageScriptsPresent: true,
    pr14aPreflightRecorded: true,
    pr14bAuthorizationRecorded: true,
    pr14cCloseoutRecorded: true,
    readinessEvidencePassed: true,
    authorizationEvidencePassed: true,
    providerGatePreserved: true,
    noProviderExecute: true,
    noRealCodexCli: true,
    noWorkspaceWriteExecute: true,
    evidenceSanitized: true,
    closeoutNonAuthorizing: true
  });
  assert.equal(review.summary.packageScriptTargetCount, 3);
  assert.equal(review.summary.packageScriptMismatchCount, 0);
  assert.equal(review.summary.readinessStatus, "passed");
  assert.equal(review.summary.authorizationExactPacket, true);
  assert.equal(review.summary.providerExecuteCalls, 0);
  assert.equal(review.summary.realCodexCliCalls, 0);
  assert.equal(review.summary.workspaceWriteExecuteCalls, 0);
  assert.equal(review.summary.formalIntegrationAuthorized, false);
});

test("formal read-only integration local closeout audit blocks stale or broadened evidence", async () => {
  const input = await createInputFromWorkspace();
  const readinessEvidence = JSON.parse(input.readinessEvidenceText);
  readinessEvidence.status = "blocked";
  readinessEvidence.summary.formalIntegrationAuthorized = true;
  const authorizationEvidence = JSON.parse(input.authorizationEvidenceText);
  authorizationEvidence.counters.realCodexCliCalls = 1;

  const review = reviewFormalReadonlyIntegrationLocalCloseoutAudit({
    ...input,
    gitStatusShort: " M package.json\n",
    branch: "feature",
    packageJsonText: JSON.stringify({ scripts: {} }),
    readinessEvidenceText: JSON.stringify(readinessEvidence),
    authorizationEvidenceText: JSON.stringify(authorizationEvidence)
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes(
    "formal_readonly_integration_local_closeout_worktreeClean"
  ));
  assert.ok(review.reasons.includes(
    "formal_readonly_integration_local_closeout_branchMain"
  ));
  assert.ok(review.reasons.includes(
    "formal_readonly_integration_local_closeout_packageScriptsPresent"
  ));
  assert.ok(review.reasons.includes(
    "formal_readonly_integration_local_closeout_readinessEvidencePassed"
  ));
  assert.ok(review.reasons.includes(
    "formal_readonly_integration_local_closeout_noRealCodexCli"
  ));
  assert.equal(review.summary.realCodexCliCalls, 1);
  assert.equal(review.summary.formalIntegrationAuthorized, true);
});

test("formal read-only integration local closeout audit output stays summarized", async () => {
  const review = reviewFormalReadonlyIntegrationLocalCloseoutAudit(
    await createInputFromWorkspace()
  );
  const text = formatFormalReadonlyIntegrationLocalCloseoutAuditResult(review);
  const json = formatFormalReadonlyIntegrationLocalCloseoutAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
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
  overrides: Partial<FormalReadonlyIntegrationLocalCloseoutAuditInput> = {}
): Promise<FormalReadonlyIntegrationLocalCloseoutAuditInput> {
  const [
    packageJsonText,
    providerSourceText,
    pr14aPreflightText,
    pr14bAuthorizationText,
    pr14cCloseoutText,
    readinessEvidenceText,
    authorizationEvidenceText
  ] = await Promise.all([
    readFile("package.json", "utf8"),
    readFile("packages/providers/codex-cli/src/index.ts", "utf8"),
    readFile("docs/governance/PR_14A_FORMAL_READONLY_CLI_INTEGRATION_PREFLIGHT.md", "utf8"),
    readFile(
      "docs/governance/PR_14B_FORMAL_READONLY_CLI_INTEGRATION_AUTHORIZATION_PACKET.md",
      "utf8"
    ),
    readFile(
      "docs/governance/PR_14C_FORMAL_READONLY_CLI_INTEGRATION_LOCAL_CLOSEOUT.md",
      "utf8"
    ),
    readFile("docs/evidence/codex-cli-formal-readonly-integration-readiness.json", "utf8"),
    readFile(
      "docs/evidence/codex-cli-formal-readonly-integration-authorization-acceptance.json",
      "utf8"
    )
  ]);

  return {
    gitStatusShort: "",
    branch: "main",
    packageJsonText,
    providerSourceText,
    pr14aPreflightText,
    pr14bAuthorizationText,
    pr14cCloseoutText,
    readinessEvidenceText,
    authorizationEvidenceText,
    ...overrides
  };
}
