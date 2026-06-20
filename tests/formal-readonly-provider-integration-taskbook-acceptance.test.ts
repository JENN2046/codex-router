import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TASKBOOK,
  PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TOKEN,
  evaluateFormalReadonlyProviderIntegrationTaskbook,
  runFormalReadonlyProviderIntegrationTaskbookAcceptance,
  writeFormalReadonlyProviderIntegrationTaskbookAcceptanceEvidence,
  type FormalReadonlyProviderIntegrationTaskbookAcceptanceEvidence
} from "../scripts/run-formal-readonly-provider-integration-taskbook-acceptance.js";

const now = "2026-06-15T00:00:00.000Z";
const forbiddenMarkers = [
  PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TOKEN,
  PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TASKBOOK,
  "APPROVE_FORMAL_CODEX_CLI_PROVIDER_INTEGRATION",
  "docs/governance/PR_15_PROVIDER_INTEGRATION.md",
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

test("PR-15A taskbook records exact gate and non-authorizations", async () => {
  const taskbook = await readFile(
    "docs/governance/PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TASKBOOK.md",
    "utf8"
  );
  const normalized = taskbook.replace(/\s+/g, " ");

  assert.match(
    taskbook,
    /PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TASKBOOK_RECORDED/
  );
  assert.match(taskbook, /APPROVE_FORMAL_CODEX_CLI_READONLY_PROVIDER_INTEGRATION_PR_15A/);
  assert.match(taskbook, /npm run governance -- acceptance formal-readonly-provider-integration-taskbook/);

  for (const phrase of [
    "not an authorization to invoke the real Codex CLI",
    "does not authorize workspace-write",
    "does not authorize local command execution",
    "does not authorize protected remote execution",
    "does not authorize push, release, or tag"
  ]) {
    assert.match(normalized, new RegExp(escapeRegExp(phrase)));
  }
});

test("formal read-only provider integration taskbook accepts exact local scope", () => {
  const result = evaluateFormalReadonlyProviderIntegrationTaskbook({
    authorizationToken: PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TOKEN,
    taskbookPath: PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TASKBOOK,
    implementationScope: "formal-readonly-provider-integration-local-only",
    providerId: "codex-cli",
    sandboxMode: "read-only",
    sideEffectClass: "read_only",
    approvalPolicy: "never",
    pr14ReadinessEvidencePath:
      "docs/evidence/codex-cli-formal-readonly-integration-readiness.json",
    pr14AuthorizationEvidencePath:
      "docs/evidence/codex-cli-formal-readonly-integration-authorization-acceptance.json",
    localOnly: true,
    registrySelectionRequired: true,
    providerPermitRequired: true,
    injectedSpawnerRequired: true,
    fakeSpawnerTestsRequired: true,
    sanitizedEvidenceRequired: true,
    realCodexCliAllowed: false,
    workspaceWriteAllowed: false,
    localCommandAllowed: false,
    protectedRemoteAllowed: false,
    pushAuthorized: false,
    releaseAuthorized: false,
    tagAuthorized: false
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "accepted");
  assert.deepEqual(result.reasons, []);
  assert.equal(result.summary.providerExecuteCalls, 0);
  assert.equal(result.summary.realCodexCliCalls, 0);
  assert.equal(result.summary.workspaceWriteExecuteCalls, 0);
});

test("formal read-only provider integration taskbook fails closed on missing or broadened fields", () => {
  const missing = evaluateFormalReadonlyProviderIntegrationTaskbook({});
  const broadened = evaluateFormalReadonlyProviderIntegrationTaskbook({
    authorizationToken: "APPROVE_FORMAL_CODEX_CLI_PROVIDER_INTEGRATION",
    taskbookPath: "docs/governance/PR_15_PROVIDER_INTEGRATION.md",
    implementationScope: "formal-provider-integration",
    providerId: "codex-cli",
    sandboxMode: "workspace-write",
    sideEffectClass: "workspace_write",
    approvalPolicy: "on-request",
    localOnly: false,
    realCodexCliAllowed: true,
    workspaceWriteAllowed: true
  });

  assert.equal(missing.ok, false);
  assert.ok(missing.reasons.includes(
    "formal_readonly_provider_integration_exact_token_required"
  ));
  assert.ok(missing.reasons.includes(
    "formal_readonly_provider_integration_exact_taskbook_required"
  ));
  assert.equal(broadened.ok, false);
  assert.ok(broadened.reasons.includes(
    "formal_readonly_provider_integration_local_scope_required"
  ));
  assert.ok(broadened.reasons.includes(
    "formal_readonly_provider_integration_workspace_write_must_remain_closed"
  ));
});

test("formal read-only provider integration taskbook rejects execution and remote side effects", () => {
  const result = evaluateFormalReadonlyProviderIntegrationTaskbook({
    authorizationToken: PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TOKEN,
    taskbookPath: PR_15A_FORMAL_READONLY_PROVIDER_INTEGRATION_TASKBOOK,
    implementationScope: "formal-readonly-provider-integration-local-only",
    providerId: "codex-cli",
    sandboxMode: "read-only",
    sideEffectClass: "read_only",
    approvalPolicy: "never",
    pr14ReadinessEvidencePath:
      "docs/evidence/codex-cli-formal-readonly-integration-readiness.json",
    pr14AuthorizationEvidencePath:
      "docs/evidence/codex-cli-formal-readonly-integration-authorization-acceptance.json",
    localOnly: true,
    registrySelectionRequired: true,
    providerPermitRequired: true,
    injectedSpawnerRequired: true,
    fakeSpawnerTestsRequired: true,
    sanitizedEvidenceRequired: true,
    realCodexCliAllowed: true,
    workspaceWriteAllowed: true,
    localCommandAllowed: true,
    protectedRemoteAllowed: true,
    pushAuthorized: true,
    releaseAuthorized: true,
    tagAuthorized: true
  });

  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes(
    "formal_readonly_provider_integration_real_cli_must_remain_closed"
  ));
  assert.ok(result.reasons.includes(
    "formal_readonly_provider_integration_workspace_write_must_remain_closed"
  ));
  assert.ok(result.reasons.includes(
    "formal_readonly_provider_integration_local_command_must_remain_closed"
  ));
  assert.ok(result.reasons.includes(
    "formal_readonly_provider_integration_protected_remote_must_remain_closed"
  ));
  assert.ok(result.reasons.includes(
    "formal_readonly_provider_integration_push_must_be_separate"
  ));
  assert.equal(result.summary.providerExecuteCalls, 0);
  assert.equal(result.summary.realCodexCliCalls, 0);
  assert.equal(result.summary.workspaceWriteExecuteCalls, 0);
});

test("formal read-only provider integration taskbook evidence stays local-only and sanitized", async () => {
  const evidence = await runFormalReadonlyProviderIntegrationTaskbookAcceptance({
    generatedAt: now
  });

  assert.equal(
    evidence.schemaVersion,
    "codex-cli-formal-readonly-provider-integration-taskbook-acceptance.v1"
  );
  assert.equal(evidence.generatedAt, now);
  assert.equal(evidence.mode, "formal-readonly-provider-integration-taskbook-local-only");
  assert.equal(
    evidence.taskId,
    "codex-cli-formal-readonly-provider-integration-taskbook-acceptance"
  );
  assert.deepEqual(evidence.checks, {
    exactTaskbookAccepted: true,
    missingTaskbookBlocked: true,
    broadenedScopeBlocked: true,
    forbiddenExecutionBlocked: true,
    pushReleaseTagRejected: true,
    noProviderExecute: true,
    noRealCodexCli: true,
    noWorkspaceWriteExecute: true,
    leakCheckPassed: true
  });
  assert.equal(evidence.summary.requiredProviderId, "codex-cli");
  assert.equal(evidence.summary.requiredSandbox, "read-only");
  assert.equal(evidence.summary.requiredSideEffectClass, "read_only");
  assert.equal(evidence.summary.requiredApprovalPolicy, "never");
  assert.equal(evidence.summary.localTaskbookOnly, true);
  assert.equal(evidence.summary.realCliInvocationMustRemainClosed, true);
  assert.equal(evidence.summary.workspaceWriteMustRemainClosed, true);
  assert.equal(evidence.summary.localCommandMustRemainClosed, true);
  assert.equal(evidence.summary.protectedRemoteMustRemainClosed, true);
  assert.deepEqual(evidence.counters, {
    providerExecuteCalls: 0,
    realCodexCliCalls: 0,
    workspaceWriteExecuteCalls: 0
  });
  assertSafeEvidence(evidence);
});

test("formal read-only provider integration taskbook writer persists safe json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "formal-readonly-provider-taskbook-"));
  const evidencePath = join(dir, "evidence.json");
  const evidence = await runFormalReadonlyProviderIntegrationTaskbookAcceptance({
    generatedAt: now
  });

  await writeFormalReadonlyProviderIntegrationTaskbookAcceptanceEvidence(
    evidence,
    evidencePath
  );

  const raw = await readFile(evidencePath, "utf8");
  const parsed =
    JSON.parse(raw) as FormalReadonlyProviderIntegrationTaskbookAcceptanceEvidence;

  assert.equal(parsed.checks.exactTaskbookAccepted, true);
  assert.equal(parsed.checks.forbiddenExecutionBlocked, true);
  assert.equal(parsed.checks.noRealCodexCli, true);
  assert.equal(parsed.checks.noWorkspaceWriteExecute, true);
  assert.equal(parsed.checks.leakCheckPassed, true);
  assertSafeEvidence(parsed);
});

function assertSafeEvidence(
  evidence: FormalReadonlyProviderIntegrationTaskbookAcceptanceEvidence
): void {
  const serialized = JSON.stringify(evidence);

  for (const marker of forbiddenMarkers) {
    assert.equal(serialized.includes(marker), false, marker);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
