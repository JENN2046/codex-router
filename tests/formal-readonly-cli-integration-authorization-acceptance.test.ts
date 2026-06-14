import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PR_14B_FORMAL_READONLY_INTEGRATION_AUTHORIZATION_TOKEN,
  PR_14B_FORMAL_READONLY_INTEGRATION_COMMAND,
  evaluateFormalReadonlyIntegrationAuthorization,
  runFormalReadonlyIntegrationAuthorizationAcceptance,
  writeFormalReadonlyIntegrationAuthorizationAcceptanceEvidence,
  type FormalReadonlyIntegrationAuthorizationAcceptanceEvidence
} from "../scripts/run-formal-readonly-cli-integration-authorization-acceptance.js";

const now = "2026-06-15T00:00:00.000Z";
const forbiddenMarkers = [
  PR_14B_FORMAL_READONLY_INTEGRATION_AUTHORIZATION_TOKEN,
  PR_14B_FORMAL_READONLY_INTEGRATION_COMMAND,
  "APPROVE_FORMAL_CODEX_CLI_PROVIDER_INTEGRATION",
  "npm run smoke:readonly:real",
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

test("formal read-only integration authorization accepts only the exact local packet", () => {
  const authorization = evaluateFormalReadonlyIntegrationAuthorization({
    authorizationToken: PR_14B_FORMAL_READONLY_INTEGRATION_AUTHORIZATION_TOKEN,
    command: PR_14B_FORMAL_READONLY_INTEGRATION_COMMAND,
    providerId: "codex-cli",
    sandboxMode: "read-only",
    sideEffectClass: "read_only",
    approvalPolicy: "never",
    readinessEvidencePath:
      "docs/evidence/codex-cli-formal-readonly-integration-readiness.json",
    injectedSpawnerRequired: true,
    permitRequired: true,
    registrySelectionRequired: true,
    realExecutionAllowed: true,
    providerExecuteAuthorized: false,
    realCodexCliAuthorized: false,
    workspaceWriteAuthorized: false,
    pushAuthorized: false,
    releaseAuthorized: false,
    tagAuthorized: false
  });

  assert.equal(authorization.ok, true);
  assert.equal(authorization.status, "authorized");
  assert.deepEqual(authorization.reasons, []);
  assert.equal(authorization.summary.providerExecuteCalls, 0);
  assert.equal(authorization.summary.realCodexCliCalls, 0);
  assert.equal(authorization.summary.workspaceWriteExecuteCalls, 0);
});

test("formal read-only integration authorization fails closed on missing or broadened fields", () => {
  const missing = evaluateFormalReadonlyIntegrationAuthorization({});
  const broadened = evaluateFormalReadonlyIntegrationAuthorization({
    authorizationToken: "APPROVE_FORMAL_CODEX_CLI_PROVIDER_INTEGRATION",
    command: "npm run smoke:readonly:real",
    providerId: "codex-cli",
    sandboxMode: "workspace-write",
    sideEffectClass: "workspace_write",
    approvalPolicy: "on-request",
    injectedSpawnerRequired: false,
    permitRequired: false,
    registrySelectionRequired: false,
    realExecutionAllowed: true,
    workspaceWriteAuthorized: true
  });

  assert.equal(missing.ok, false);
  assert.ok(missing.reasons.includes(
    "formal_readonly_integration_authorization_exact_token_required"
  ));
  assert.ok(missing.reasons.includes(
    "formal_readonly_integration_authorization_readiness_evidence_required"
  ));
  assert.equal(broadened.ok, false);
  assert.ok(broadened.reasons.includes(
    "formal_readonly_integration_authorization_read_only_sandbox_required"
  ));
  assert.ok(broadened.reasons.includes(
    "formal_readonly_integration_authorization_workspace_write_must_remain_closed"
  ));
});

test("formal read-only integration authorization rejects execution and remote side effects", () => {
  const execution = evaluateFormalReadonlyIntegrationAuthorization({
    authorizationToken: PR_14B_FORMAL_READONLY_INTEGRATION_AUTHORIZATION_TOKEN,
    command: PR_14B_FORMAL_READONLY_INTEGRATION_COMMAND,
    providerId: "codex-cli",
    sandboxMode: "read-only",
    sideEffectClass: "read_only",
    approvalPolicy: "never",
    readinessEvidencePath:
      "docs/evidence/codex-cli-formal-readonly-integration-readiness.json",
    injectedSpawnerRequired: true,
    permitRequired: true,
    registrySelectionRequired: true,
    realExecutionAllowed: true,
    providerExecuteAuthorized: true,
    realCodexCliAuthorized: true,
    pushAuthorized: true,
    releaseAuthorized: true,
    tagAuthorized: true
  });

  assert.equal(execution.ok, false);
  assert.ok(execution.reasons.includes(
    "formal_readonly_integration_authorization_provider_execute_must_be_separate"
  ));
  assert.ok(execution.reasons.includes(
    "formal_readonly_integration_authorization_real_cli_must_be_separate"
  ));
  assert.ok(execution.reasons.includes(
    "formal_readonly_integration_authorization_push_must_be_separate"
  ));
  assert.ok(execution.reasons.includes(
    "formal_readonly_integration_authorization_release_must_be_separate"
  ));
  assert.ok(execution.reasons.includes(
    "formal_readonly_integration_authorization_tag_must_be_separate"
  ));
  assert.equal(execution.summary.providerExecuteCalls, 0);
  assert.equal(execution.summary.realCodexCliCalls, 0);
  assert.equal(execution.summary.workspaceWriteExecuteCalls, 0);
});

test("formal read-only integration authorization acceptance stays local-only and sanitized", async () => {
  const evidence = await runFormalReadonlyIntegrationAuthorizationAcceptance({
    generatedAt: now
  });

  assert.equal(
    evidence.schemaVersion,
    "codex-cli-formal-readonly-integration-authorization-acceptance.v1"
  );
  assert.equal(evidence.generatedAt, now);
  assert.equal(evidence.mode, "formal-readonly-integration-authorization-local-only");
  assert.equal(
    evidence.taskId,
    "codex-cli-formal-readonly-integration-authorization-acceptance"
  );
  assert.deepEqual(evidence.checks, {
    exactAuthorizationAccepted: true,
    missingAuthorizationBlocked: true,
    broadenedAuthorizationBlocked: true,
    executionAuthorizationRejected: true,
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
  assert.equal(evidence.summary.formalIntegrationAuthorizationOnly, true);
  assert.equal(evidence.summary.providerExecutionMustRemainSeparate, true);
  assert.equal(evidence.summary.realCliInvocationMustRemainSeparate, true);
  assert.equal(evidence.summary.workspaceWriteMustRemainClosed, true);
  assert.deepEqual(evidence.counters, {
    providerExecuteCalls: 0,
    realCodexCliCalls: 0,
    workspaceWriteExecuteCalls: 0
  });
  assertSafeEvidence(evidence);
});

test("formal read-only integration authorization writer persists safe json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "formal-readonly-auth-"));
  const evidencePath = join(dir, "evidence.json");
  const evidence = await runFormalReadonlyIntegrationAuthorizationAcceptance({
    generatedAt: now
  });

  await writeFormalReadonlyIntegrationAuthorizationAcceptanceEvidence(
    evidence,
    evidencePath
  );

  const raw = await readFile(evidencePath, "utf8");
  const parsed = JSON.parse(raw) as FormalReadonlyIntegrationAuthorizationAcceptanceEvidence;

  assert.equal(parsed.checks.exactAuthorizationAccepted, true);
  assert.equal(parsed.checks.executionAuthorizationRejected, true);
  assert.equal(parsed.checks.noRealCodexCli, true);
  assert.equal(parsed.checks.noWorkspaceWriteExecute, true);
  assert.equal(parsed.checks.leakCheckPassed, true);
  assertSafeEvidence(parsed);
});

function assertSafeEvidence(
  evidence: FormalReadonlyIntegrationAuthorizationAcceptanceEvidence
): void {
  const serialized = JSON.stringify(evidence);

  for (const marker of forbiddenMarkers) {
    assert.equal(
      serialized.includes(marker),
      false,
      `evidence must omit ${marker}`
    );
  }
}
