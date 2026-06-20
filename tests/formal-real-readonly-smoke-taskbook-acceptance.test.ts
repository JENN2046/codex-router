import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PR_17A_FORMAL_REAL_READONLY_SMOKE_COMMAND,
  PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK,
  PR_17A_FORMAL_REAL_READONLY_SMOKE_TOKEN,
  evaluateFormalRealReadonlySmokeTaskbook,
  runFormalRealReadonlySmokeTaskbookAcceptance,
  writeFormalRealReadonlySmokeTaskbookAcceptanceEvidence,
  type FormalRealReadonlySmokeTaskbookAcceptanceEvidence
} from "../scripts/run-formal-real-readonly-smoke-taskbook-acceptance.js";

const now = "2026-06-15T00:00:00.000Z";
const forbiddenMarkers = [
  PR_17A_FORMAL_REAL_READONLY_SMOKE_TOKEN,
  PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK,
  PR_17A_FORMAL_REAL_READONLY_SMOKE_COMMAND,
  "APPROVE_FORMAL_REAL_CODEX_CLI",
  "PR_17_FORMAL_REAL_CLI_SMOKE",
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

test("PR-17A taskbook records the formal real read-only smoke gate", async () => {
  const taskbook = await readFile(
    "docs/governance/PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK.md",
    "utf8"
  );
  const normalized = taskbook.replace(/\s+/g, " ");

  assert.match(taskbook, /PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK_RECORDED/);
  assert.match(taskbook, /APPROVE_FORMAL_REAL_CODEX_CLI_READONLY_SMOKE_PR_17A/);
  assert.match(taskbook, /ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real/);
  assert.match(taskbook, /npm run governance -- acceptance formal-real-readonly-smoke-taskbook/);
  assert.match(
    taskbook,
    /docs\/evidence\/codex-cli-formal-real-readonly-smoke-taskbook-acceptance\.json/
  );

  for (const phrase of [
    "does not authorize invoking the real Codex CLI",
    "does not authorize provider execute",
    "does not authorize workspace-write",
    "does not authorize local command execution",
    "does not authorize protected remote execution",
    "does not authorize push, release, or tag"
  ]) {
    assert.match(normalized, new RegExp(escapeRegExp(phrase)));
  }
});

test("formal real read-only smoke taskbook accepts exact local gate", () => {
  const result = evaluateFormalRealReadonlySmokeTaskbook({
    authorizationToken: PR_17A_FORMAL_REAL_READONLY_SMOKE_TOKEN,
    taskbookPath: PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK,
    command: PR_17A_FORMAL_REAL_READONLY_SMOKE_COMMAND,
    evidencePathChoice: "default",
    implementationScope: "formal-real-readonly-smoke-taskbook-local-only",
    providerId: "codex-cli",
    sandboxMode: "read-only",
    sideEffectClass: "read_only",
    approvalPolicy: "never",
    pr13AuthorizationEvidencePath:
      "docs/evidence/codex-cli-real-readonly-smoke-authorization-acceptance.json",
    pr16BoundaryEvidencePath:
      "docs/evidence/codex-cli-formal-readonly-dispatch-boundary-acceptance.json",
    pr16CloseoutDocPath:
      "docs/governance/PR_16B_FORMAL_READONLY_DISPATCH_BOUNDARY_LOCAL_CLOSEOUT.md",
    formalDispatchRequired: true,
    providerRegistryRequired: true,
    providerExecutionMetadataRequired: true,
    providerPermitRequired: true,
    injectedSpawnerRequiredForLocalTests: true,
    sanitizedEvidenceRequired: true,
    localPreflightRequired: true,
    realCodexCliAllowedByThisTaskbook: false,
    providerExecuteAllowedByThisTaskbook: false,
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
  assert.equal(result.summary.defaultEvidencePathDeclared, true);
  assert.equal(result.summary.formalDispatchRequired, true);
  assert.equal(result.summary.providerRegistryRequired, true);
  assert.equal(result.summary.providerExecutionMetadataRequired, true);
  assert.equal(result.summary.providerPermitRequired, true);
  assert.equal(result.summary.realCodexCliNotAuthorizedByThisTaskbook, true);
  assert.equal(result.summary.providerExecuteNotAuthorizedByThisTaskbook, true);
  assert.equal(result.summary.providerExecuteCalls, 0);
  assert.equal(result.summary.realCodexCliCalls, 0);
  assert.equal(result.summary.workspaceWriteExecuteCalls, 0);
});

test("formal real read-only smoke taskbook fails closed on missing or broadened fields", () => {
  const missing = evaluateFormalRealReadonlySmokeTaskbook({});
  const broadened = evaluateFormalRealReadonlySmokeTaskbook({
    authorizationToken: "APPROVE_FORMAL_REAL_CODEX_CLI",
    taskbookPath: "docs/governance/PR_17_FORMAL_REAL_CLI_SMOKE.md",
    command:
      "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real -- --sandbox workspace-write",
    evidencePathChoice: "one-off",
    implementationScope: "formal-real-cli-smoke",
    providerId: "codex-cli",
    sandboxMode: "workspace-write",
    sideEffectClass: "workspace_write",
    approvalPolicy: "on-request",
    realCodexCliAllowedByThisTaskbook: true,
    providerExecuteAllowedByThisTaskbook: true,
    workspaceWriteAllowed: true
  });

  assert.equal(missing.ok, false);
  assert.ok(missing.reasons.includes("formal_real_readonly_smoke_exact_token_required"));
  assert.ok(missing.reasons.includes("formal_real_readonly_smoke_exact_taskbook_required"));
  assert.equal(broadened.ok, false);
  assert.ok(broadened.reasons.includes(
    "formal_real_readonly_smoke_local_taskbook_scope_required"
  ));
  assert.ok(broadened.reasons.includes(
    "formal_real_readonly_smoke_default_evidence_path_required"
  ));
  assert.ok(broadened.reasons.includes(
    "formal_real_readonly_smoke_workspace_write_must_remain_closed"
  ));
});

test("formal real read-only smoke taskbook rejects execution and remote side effects", () => {
  const result = evaluateFormalRealReadonlySmokeTaskbook({
    authorizationToken: PR_17A_FORMAL_REAL_READONLY_SMOKE_TOKEN,
    taskbookPath: PR_17A_FORMAL_REAL_READONLY_SMOKE_TASKBOOK,
    command: PR_17A_FORMAL_REAL_READONLY_SMOKE_COMMAND,
    evidencePathChoice: "default",
    implementationScope: "formal-real-readonly-smoke-taskbook-local-only",
    providerId: "codex-cli",
    sandboxMode: "read-only",
    sideEffectClass: "read_only",
    approvalPolicy: "never",
    pr13AuthorizationEvidencePath:
      "docs/evidence/codex-cli-real-readonly-smoke-authorization-acceptance.json",
    pr16BoundaryEvidencePath:
      "docs/evidence/codex-cli-formal-readonly-dispatch-boundary-acceptance.json",
    pr16CloseoutDocPath:
      "docs/governance/PR_16B_FORMAL_READONLY_DISPATCH_BOUNDARY_LOCAL_CLOSEOUT.md",
    formalDispatchRequired: true,
    providerRegistryRequired: true,
    providerExecutionMetadataRequired: true,
    providerPermitRequired: true,
    injectedSpawnerRequiredForLocalTests: true,
    sanitizedEvidenceRequired: true,
    localPreflightRequired: true,
    realCodexCliAllowedByThisTaskbook: true,
    providerExecuteAllowedByThisTaskbook: true,
    workspaceWriteAllowed: true,
    localCommandAllowed: true,
    protectedRemoteAllowed: true,
    pushAuthorized: true,
    releaseAuthorized: true,
    tagAuthorized: true
  });

  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes(
    "formal_real_readonly_smoke_real_cli_requires_separate_execution_authorization"
  ));
  assert.ok(result.reasons.includes(
    "formal_real_readonly_smoke_provider_execute_requires_separate_authorization"
  ));
  assert.ok(result.reasons.includes(
    "formal_real_readonly_smoke_workspace_write_must_remain_closed"
  ));
  assert.ok(result.reasons.includes(
    "formal_real_readonly_smoke_local_command_must_remain_closed"
  ));
  assert.ok(result.reasons.includes(
    "formal_real_readonly_smoke_protected_remote_must_remain_closed"
  ));
  assert.ok(result.reasons.includes("formal_real_readonly_smoke_push_must_be_separate"));
  assert.equal(result.summary.providerExecuteCalls, 0);
  assert.equal(result.summary.realCodexCliCalls, 0);
  assert.equal(result.summary.workspaceWriteExecuteCalls, 0);
});

test("formal real read-only smoke taskbook evidence stays local-only and sanitized", async () => {
  const evidence = await runFormalRealReadonlySmokeTaskbookAcceptance({
    generatedAt: now
  });

  assert.equal(
    evidence.schemaVersion,
    "codex-cli-formal-real-readonly-smoke-taskbook-acceptance.v1"
  );
  assert.equal(evidence.generatedAt, now);
  assert.equal(evidence.mode, "formal-real-readonly-smoke-taskbook-local-only");
  assert.equal(evidence.taskId, "codex-cli-formal-real-readonly-smoke-taskbook-acceptance");
  assert.deepEqual(evidence.checks, {
    exactTaskbookAccepted: true,
    missingTaskbookBlocked: true,
    broadenedScopeBlocked: true,
    forbiddenExecutionBlocked: true,
    pushReleaseTagRejected: true,
    priorEvidenceRequired: true,
    defaultEvidencePathRequired: true,
    formalDispatchRequired: true,
    noProviderExecute: true,
    noRealCodexCli: true,
    noWorkspaceWriteExecute: true,
    leakCheckPassed: true
  });
  assert.equal(evidence.summary.requiredProviderId, "codex-cli");
  assert.equal(evidence.summary.requiredSandbox, "read-only");
  assert.equal(evidence.summary.requiredSideEffectClass, "read_only");
  assert.equal(evidence.summary.requiredApprovalPolicy, "never");
  assert.equal(evidence.summary.requiredEvidencePathChoice, "default");
  assert.equal(evidence.summary.realCliInvocationRequiresSeparateExecutionAuthorization, true);
  assert.equal(evidence.summary.providerExecuteRequiresSeparateExecutionAuthorization, true);
  assert.deepEqual(evidence.counters, {
    providerExecuteCalls: 0,
    realCodexCliCalls: 0,
    workspaceWriteExecuteCalls: 0
  });
  assertSafeEvidence(evidence);
});

test("formal real read-only smoke taskbook writer persists safe json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "formal-real-readonly-smoke-taskbook-"));
  const evidencePath = join(dir, "evidence.json");
  const evidence = await runFormalRealReadonlySmokeTaskbookAcceptance({
    generatedAt: now
  });

  await writeFormalRealReadonlySmokeTaskbookAcceptanceEvidence(
    evidence,
    evidencePath
  );

  const raw = await readFile(evidencePath, "utf8");
  const parsed =
    JSON.parse(raw) as FormalRealReadonlySmokeTaskbookAcceptanceEvidence;

  assert.equal(parsed.checks.exactTaskbookAccepted, true);
  assert.equal(parsed.checks.defaultEvidencePathRequired, true);
  assert.equal(parsed.checks.forbiddenExecutionBlocked, true);
  assert.equal(parsed.checks.noRealCodexCli, true);
  assert.equal(parsed.checks.noWorkspaceWriteExecute, true);
  assert.equal(parsed.checks.leakCheckPassed, true);
  assertSafeEvidence(parsed);
});

function assertSafeEvidence(
  evidence: FormalRealReadonlySmokeTaskbookAcceptanceEvidence
): void {
  const serialized = JSON.stringify(evidence);

  for (const marker of forbiddenMarkers) {
    assert.equal(serialized.includes(marker), false, marker);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
