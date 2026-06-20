import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_AUTHORIZATION_TOKEN,
  PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_COMMAND,
  PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_PACKET,
  evaluateFormalRealReadonlySmokeExecutionAuthorization,
  runFormalRealReadonlySmokeExecutionAuthorizationAcceptance,
  writeFormalRealReadonlySmokeExecutionAuthorizationAcceptanceEvidence,
  type FormalRealReadonlySmokeExecutionAuthorizationAcceptanceEvidence
} from "../scripts/run-formal-real-readonly-smoke-execution-authorization-acceptance.js";

const now = "2026-06-15T00:00:00.000Z";
const forbiddenMarkers = [
  PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_AUTHORIZATION_TOKEN,
  PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_COMMAND,
  PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_PACKET,
  "APPROVE_FORMAL_REAL_CODEX_CLI_EXECUTION",
  "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE",
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

test("PR-18A execution authorization packet records exact local gate", async () => {
  const packet = await readFile(
    "docs/governance/PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_AUTHORIZATION_PACKET.md",
    "utf8"
  );
  const normalized = packet.replace(/\s+/g, " ");

  assert.match(
    packet,
    /PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_AUTHORIZATION_PACKET_RECORDED/
  );
  assert.match(packet, /APPROVE_FORMAL_REAL_CODEX_CLI_READONLY_SMOKE_EXECUTION_PR_18A/);
  assert.match(packet, /ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real/);
  assert.match(packet, /npm run governance -- acceptance formal-real-readonly-smoke-execution-auth/);

  for (const phrase of [
    "does not execute the real Codex CLI",
    "does not authorize this PR to run provider execute",
    "does not authorize workspace-write",
    "does not authorize local command execution",
    "does not authorize protected remote execution",
    "does not authorize push, release, or tag"
  ]) {
    assert.match(normalized, new RegExp(escapeRegExp(phrase)));
  }
});

test("formal real read-only smoke execution authorization accepts exact packet only", () => {
  const result = evaluateFormalRealReadonlySmokeExecutionAuthorization({
    authorizationToken:
      PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_AUTHORIZATION_TOKEN,
    authorizationPacketPath: PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_PACKET,
    command: PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_COMMAND,
    evidencePathChoice: "default",
    providerId: "codex-cli",
    sandboxMode: "read-only",
    sideEffectClass: "read_only",
    approvalPolicy: "never",
    taskbookEvidencePath:
      "docs/evidence/codex-cli-formal-real-readonly-smoke-taskbook-acceptance.json",
    preExecutionEvidencePath:
      "docs/evidence/codex-cli-formal-real-readonly-smoke-pre-execution-acceptance.json",
    localCloseoutDocPath:
      "docs/governance/PR_17C_FORMAL_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT.md",
    formalDispatchRequired: true,
    providerRegistryRequired: true,
    providerExecutionMetadataRequired: true,
    providerPermitRequired: true,
    operatorFlagRequired: true,
    defaultEvidencePathRequired: true,
    localPreflightRequired: true,
    currentExecutionRequested: false,
    providerExecuteNow: false,
    realCodexCliNow: false,
    workspaceWriteAuthorized: false,
    localCommandAuthorized: false,
    protectedRemoteAuthorized: false,
    pushAuthorized: false,
    releaseAuthorized: false,
    tagAuthorized: false
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "authorized");
  assert.deepEqual(result.reasons, []);
  assert.equal(result.summary.exactTokenMatched, true);
  assert.equal(result.summary.currentExecutionDisallowed, true);
  assert.equal(result.summary.providerExecuteNowDisallowed, true);
  assert.equal(result.summary.realCodexCliNowDisallowed, true);
  assert.equal(result.summary.providerExecuteCalls, 0);
  assert.equal(result.summary.realCodexCliCalls, 0);
  assert.equal(result.summary.workspaceWriteExecuteCalls, 0);
});

test("formal real read-only smoke execution authorization fails closed on broadened fields", () => {
  const missing = evaluateFormalRealReadonlySmokeExecutionAuthorization({});
  const broadened = evaluateFormalRealReadonlySmokeExecutionAuthorization({
    authorizationToken: "APPROVE_FORMAL_REAL_CODEX_CLI_EXECUTION",
    authorizationPacketPath: "docs/governance/PR_18_FORMAL_REAL_CLI_EXECUTION.md",
    command:
      "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real -- --sandbox workspace-write",
    evidencePathChoice: "one-off",
    providerId: "codex-cli",
    sandboxMode: "workspace-write",
    sideEffectClass: "workspace_write",
    approvalPolicy: "on-request",
    workspaceWriteAuthorized: true
  });

  assert.equal(missing.ok, false);
  assert.ok(missing.reasons.includes(
    "formal_real_readonly_smoke_execution_auth_exact_token_required"
  ));
  assert.ok(missing.reasons.includes(
    "formal_real_readonly_smoke_execution_auth_pre_execution_evidence_required"
  ));
  assert.equal(broadened.ok, false);
  assert.ok(broadened.reasons.includes(
    "formal_real_readonly_smoke_execution_auth_read_only_sandbox_required"
  ));
  assert.ok(broadened.reasons.includes(
    "formal_real_readonly_smoke_execution_auth_workspace_write_must_remain_closed"
  ));
});

test("formal real read-only smoke execution authorization blocks immediate execution", () => {
  const result = evaluateFormalRealReadonlySmokeExecutionAuthorization({
    authorizationToken:
      PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_AUTHORIZATION_TOKEN,
    authorizationPacketPath: PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_PACKET,
    command: PR_18A_FORMAL_REAL_READONLY_SMOKE_EXECUTION_COMMAND,
    evidencePathChoice: "default",
    providerId: "codex-cli",
    sandboxMode: "read-only",
    sideEffectClass: "read_only",
    approvalPolicy: "never",
    taskbookEvidencePath:
      "docs/evidence/codex-cli-formal-real-readonly-smoke-taskbook-acceptance.json",
    preExecutionEvidencePath:
      "docs/evidence/codex-cli-formal-real-readonly-smoke-pre-execution-acceptance.json",
    localCloseoutDocPath:
      "docs/governance/PR_17C_FORMAL_REAL_READONLY_SMOKE_LOCAL_CLOSEOUT.md",
    formalDispatchRequired: true,
    providerRegistryRequired: true,
    providerExecutionMetadataRequired: true,
    providerPermitRequired: true,
    operatorFlagRequired: true,
    defaultEvidencePathRequired: true,
    localPreflightRequired: true,
    currentExecutionRequested: true,
    providerExecuteNow: true,
    realCodexCliNow: true,
    pushAuthorized: true,
    releaseAuthorized: true,
    tagAuthorized: true
  });

  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes(
    "formal_real_readonly_smoke_execution_auth_current_execution_must_remain_closed"
  ));
  assert.ok(result.reasons.includes(
    "formal_real_readonly_smoke_execution_auth_provider_execute_now_blocked"
  ));
  assert.ok(result.reasons.includes(
    "formal_real_readonly_smoke_execution_auth_real_cli_now_blocked"
  ));
  assert.ok(result.reasons.includes(
    "formal_real_readonly_smoke_execution_auth_push_must_be_separate"
  ));
  assert.equal(result.summary.providerExecuteCalls, 0);
  assert.equal(result.summary.realCodexCliCalls, 0);
  assert.equal(result.summary.workspaceWriteExecuteCalls, 0);
});

test("formal real read-only smoke execution authorization evidence is local-only and sanitized", async () => {
  const evidence = await runFormalRealReadonlySmokeExecutionAuthorizationAcceptance({
    generatedAt: now
  });

  assert.equal(
    evidence.schemaVersion,
    "codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.v1"
  );
  assert.equal(evidence.generatedAt, now);
  assert.equal(
    evidence.mode,
    "formal-real-readonly-smoke-execution-authorization-local-only"
  );
  assert.equal(
    evidence.taskId,
    "codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance"
  );
  assert.deepEqual(evidence.checks, {
    exactAuthorizationAccepted: true,
    missingAuthorizationBlocked: true,
    broadenedAuthorizationBlocked: true,
    immediateExecutionBlocked: true,
    pushReleaseTagRejected: true,
    priorCloseoutRequired: true,
    formalBoundaryRequired: true,
    noProviderExecute: true,
    noRealCodexCli: true,
    noWorkspaceWriteExecute: true,
    leakCheckPassed: true
  });
  assert.equal(evidence.summary.requiredProviderId, "codex-cli");
  assert.equal(evidence.summary.requiredSandbox, "read-only");
  assert.equal(evidence.summary.requiredSideEffectClass, "read_only");
  assert.equal(evidence.summary.requiredApprovalPolicy, "never");
  assert.equal(evidence.summary.authorizationPacketOnly, true);
  assert.equal(evidence.summary.currentExecutionMustRemainClosed, true);
  assert.deepEqual(evidence.counters, {
    providerExecuteCalls: 0,
    realCodexCliCalls: 0,
    workspaceWriteExecuteCalls: 0
  });
  assertSafeEvidence(evidence);
});

test("formal real read-only smoke execution authorization writer persists safe json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "formal-real-readonly-smoke-exec-auth-"));
  const evidencePath = join(dir, "evidence.json");
  const evidence = await runFormalRealReadonlySmokeExecutionAuthorizationAcceptance({
    generatedAt: now
  });

  await writeFormalRealReadonlySmokeExecutionAuthorizationAcceptanceEvidence(
    evidence,
    evidencePath
  );

  const raw = await readFile(evidencePath, "utf8");
  const parsed =
    JSON.parse(raw) as FormalRealReadonlySmokeExecutionAuthorizationAcceptanceEvidence;

  assert.equal(parsed.checks.exactAuthorizationAccepted, true);
  assert.equal(parsed.checks.immediateExecutionBlocked, true);
  assert.equal(parsed.checks.noRealCodexCli, true);
  assert.equal(parsed.checks.noWorkspaceWriteExecute, true);
  assert.equal(parsed.checks.leakCheckPassed, true);
  assertSafeEvidence(parsed);
});

function assertSafeEvidence(
  evidence: FormalRealReadonlySmokeExecutionAuthorizationAcceptanceEvidence
): void {
  const serialized = JSON.stringify(evidence);

  for (const marker of forbiddenMarkers) {
    assert.equal(serialized.includes(marker), false, marker);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
