import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatFormalReadonlyProviderIntegrationLocalCloseoutAuditResult,
  reviewFormalReadonlyProviderIntegrationLocalCloseoutAudit,
  type FormalReadonlyProviderIntegrationLocalCloseoutAuditInput
} from "../scripts/run-formal-readonly-provider-integration-local-closeout-audit.js";

const forbiddenOutputMarkers = [
  "APPROVE_FORMAL_CODEX_CLI_READONLY_PROVIDER_INTEGRATION_PR_15A",
  "APPROVE_FORMAL_CODEX_CLI_PROVIDER_INTEGRATION",
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

test("formal read-only provider integration local closeout audit passes for committed PR-15 state", async () => {
  const review = reviewFormalReadonlyProviderIntegrationLocalCloseoutAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.deepEqual(review.checks, {
    worktreeClean: true,
    branchMain: true,
    packageScriptsPresent: true,
    pr15aTaskbookRecorded: true,
    pr15bLocalRecorded: true,
    pr15cCloseoutRecorded: true,
    taskbookEvidencePassed: true,
    integrationEvidencePassed: true,
    registrySelectionProved: true,
    permitIssued: true,
    fakeSpawnerOnly: true,
    guardMissingBlocked: true,
    registryMismatchBlocked: true,
    writeAccessBlocked: true,
    noRealCodexCli: true,
    noWorkspaceWriteExecute: true,
    noLocalCommandExecute: true,
    noProtectedRemoteExecute: true,
    evidenceSanitized: true,
    closeoutNonAuthorizing: true
  });
  assert.equal(review.summary.packageScriptTargetCount, 1);
  assert.equal(review.summary.packageScriptMismatchCount, 0);
  assert.equal(review.summary.providerId, "codex-cli");
  assert.equal(review.summary.sideEffectClass, "read_only");
  assert.equal(review.summary.sandbox, "read-only");
  assert.equal(review.summary.status, "completed");
  assert.equal(review.summary.formalProviderDispatchCalls, 1);
  assert.equal(review.summary.fakeSpawnerCalls, 1);
  assert.equal(review.summary.realCodexCliCalls, 0);
  assert.equal(review.summary.workspaceWriteExecuteCalls, 0);
  assert.equal(review.summary.localCommandExecuteCalls, 0);
  assert.equal(review.summary.protectedRemoteExecuteCalls, 0);
});

test("formal read-only provider integration local closeout audit blocks stale or broadened evidence", async () => {
  const input = await createInputFromWorkspace();
  const integrationEvidence = JSON.parse(input.integrationEvidenceText);
  integrationEvidence.checks.dispatchOk = false;
  integrationEvidence.checks.noRealCodexCli = false;
  integrationEvidence.counters.fakeSpawnerSuccessCalls = 2;
  integrationEvidence.counters.realCodexCliCalls = 1;
  integrationEvidence.summary.realCodexCliCalls = 1;

  const review = reviewFormalReadonlyProviderIntegrationLocalCloseoutAudit({
    ...input,
    gitStatusShort: " M package.json\n",
    branch: "feature",
    packageJsonText: JSON.stringify({ scripts: {} }),
    integrationEvidenceText: JSON.stringify(integrationEvidence)
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes(
    "formal_readonly_provider_integration_local_closeout_worktreeClean"
  ));
  assert.ok(review.reasons.includes(
    "formal_readonly_provider_integration_local_closeout_branchMain"
  ));
  assert.ok(review.reasons.includes(
    "formal_readonly_provider_integration_local_closeout_packageScriptsPresent"
  ));
  assert.ok(review.reasons.includes(
    "formal_readonly_provider_integration_local_closeout_integrationEvidencePassed"
  ));
  assert.ok(review.reasons.includes(
    "formal_readonly_provider_integration_local_closeout_fakeSpawnerOnly"
  ));
  assert.ok(review.reasons.includes(
    "formal_readonly_provider_integration_local_closeout_noRealCodexCli"
  ));
  assert.equal(review.summary.realCodexCliCalls, 1);
});

test("formal read-only provider integration local closeout audit output stays summarized", async () => {
  const review = reviewFormalReadonlyProviderIntegrationLocalCloseoutAudit(
    await createInputFromWorkspace()
  );
  const text = formatFormalReadonlyProviderIntegrationLocalCloseoutAuditResult(review);
  const json = formatFormalReadonlyProviderIntegrationLocalCloseoutAuditResult(
    review,
    "json"
  );
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /fake spawner calls: 1/);
  assert.match(text, /real CLI calls: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.fakeSpawnerCalls, 1);
  assert.equal(parsed.summary.realCodexCliCalls, 0);
  assert.equal(parsed.summary.workspaceWriteExecuteCalls, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<FormalReadonlyProviderIntegrationLocalCloseoutAuditInput> = {}
): Promise<FormalReadonlyProviderIntegrationLocalCloseoutAuditInput> {
  const [
    packageJsonText,
    pr15aTaskbookText,
    pr15bLocalText,
    taskbookEvidenceText,
    integrationEvidenceText
  ] = await Promise.all([
    readFile("package.json", "utf8"),
    readFile(
      "docs/governance/PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TASKBOOK.md",
      "utf8"
    ),
    readFile(
      "docs/governance/PR_15B_FORMAL_READONLY_PROVIDER_INTEGRATION_LOCAL.md",
      "utf8"
    ),
    readFile(
      "docs/evidence/codex-cli-formal-readonly-provider-integration-taskbook-acceptance.json",
      "utf8"
    ),
    readFile(
      "docs/evidence/codex-cli-formal-readonly-provider-integration-acceptance.json",
      "utf8"
    )
  ]);

  return {
    gitStatusShort: "",
    branch: "main",
    packageJsonText,
    pr15aTaskbookText,
    pr15bLocalText,
    pr15cCloseoutText: createCloseoutDocumentText(),
    taskbookEvidenceText,
    integrationEvidenceText,
    ...overrides
  };
}

function createCloseoutDocumentText(): string {
  return [
    "PR_15C_FORMAL_READONLY_PROVIDER_INTEGRATION_LOCAL_CLOSEOUT_COMPLETE",
    "npm run governance -- audit formal-readonly-provider-integration-local",
    "npm run governance -- audit formal-readonly-provider-integration-local -- --json",
    "docs/evidence/codex-cli-formal-readonly-provider-integration-taskbook-acceptance.json",
    "docs/evidence/codex-cli-formal-readonly-provider-integration-acceptance.json",
    "does not authorize real Codex CLI invocation",
    "does not authorize workspace-write",
    "does not authorize local command",
    "does not authorize protected remote",
    "does not authorize push, release, or tag"
  ].join("\n");
}
