import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PR_18B_FORMAL_REAL_READONLY_SMOKE_FINAL_PREFLIGHT_PACKET,
  evaluateFormalRealReadonlySmokeFinalPreflight,
  runFormalRealReadonlySmokeFinalPreflightAcceptance,
  writeFormalRealReadonlySmokeFinalPreflightAcceptanceEvidence,
  type FormalRealReadonlySmokeFinalPreflightAcceptanceEvidence
} from "../scripts/run-formal-real-readonly-smoke-final-preflight-acceptance.js";

const now = "2026-06-15T00:00:00.000Z";
const forbiddenMarkers = [
  "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE",
  "smoke:readonly:real",
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

test("PR-18B final preflight packet records the local-only gate", async () => {
  const packet = await readFile(
    "docs/governance/PR_18B_FORMAL_REAL_READONLY_SMOKE_FINAL_PREFLIGHT.md",
    "utf8"
  );
  const normalized = packet.replace(/\s+/g, " ");

  assert.match(packet, /PR_18B_FORMAL_REAL_READONLY_SMOKE_FINAL_PREFLIGHT_RECORDED/);
  assert.match(packet, /npm run governance -- acceptance formal-real-readonly-smoke-final-preflight/);
  assert.match(packet, /npm run governance -- acceptance formal-real-readonly-smoke-execution-auth/);

  for (const phrase of [
    "does not set the future execution operator flag",
    "does not run the real Codex CLI",
    "does not authorize provider execute",
    "does not authorize workspace-write",
    "does not authorize push, release, or tag"
  ]) {
    assert.match(normalized, new RegExp(escapeRegExp(phrase)));
  }
});

test("formal real read-only smoke final preflight accepts exact local gate", () => {
  const result = evaluateFormalRealReadonlySmokeFinalPreflight({
    preflightPacketPath: PR_18B_FORMAL_REAL_READONLY_SMOKE_FINAL_PREFLIGHT_PACKET,
    authorizationEvidencePath:
      "docs/evidence/codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.json",
    localCloseoutAuditRequired: true,
    authorizationAcceptanceRequired: true,
    taskbookAcceptanceRequired: true,
    preExecutionAcceptanceRequired: true,
    smokeScriptTestsRequired: true,
    typecheckRequired: true,
    fullTestRequired: true,
    worktreeCleanRequired: true,
    branchMainRequired: true,
    notBehindRequired: true,
    defaultEvidencePathRequired: true,
    providerId: "codex-cli",
    sandboxMode: "read-only",
    sideEffectClass: "read_only",
    approvalPolicy: "never",
    formalDispatchRequired: true,
    providerRegistryRequired: true,
    providerExecutionMetadataRequired: true,
    providerPermitRequired: true,
    currentExecutionRequested: false,
    operatorFlagSetByThisPreflight: false,
    providerExecuteNow: false,
    realCodexCliNow: false,
    workspaceWriteAuthorized: false,
    pushAuthorized: false,
    releaseAuthorized: false,
    tagAuthorized: false
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "accepted");
  assert.deepEqual(result.reasons, []);
  assert.equal(result.summary.fullTestRequired, true);
  assert.equal(result.summary.worktreeCleanRequired, true);
  assert.equal(result.summary.operatorFlagNotSetByPreflight, true);
  assert.equal(result.summary.realCodexCliCalls, 0);
  assert.equal(result.summary.workspaceWriteExecuteCalls, 0);
});

test("formal real read-only smoke final preflight blocks missing or broadened gates", () => {
  const missing = evaluateFormalRealReadonlySmokeFinalPreflight({});
  const broadened = evaluateFormalRealReadonlySmokeFinalPreflight({
    preflightPacketPath: "docs/governance/PR_18_REAL_CLI_PREFLIGHT.md",
    authorizationEvidencePath:
      "docs/evidence/codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.json",
    sandboxMode: "workspace-write",
    sideEffectClass: "workspace_write",
    approvalPolicy: "on-request",
    workspaceWriteAuthorized: true
  });

  assert.equal(missing.ok, false);
  assert.ok(missing.reasons.includes(
    "formal_real_readonly_smoke_final_preflight_exact_packet_required"
  ));
  assert.ok(missing.reasons.includes(
    "formal_real_readonly_smoke_final_preflight_authorization_evidence_required"
  ));
  assert.equal(broadened.ok, false);
  assert.ok(broadened.reasons.includes(
    "formal_real_readonly_smoke_final_preflight_read_only_sandbox_required"
  ));
  assert.ok(broadened.reasons.includes(
    "formal_real_readonly_smoke_final_preflight_workspace_write_must_remain_closed"
  ));
});

test("formal real read-only smoke final preflight blocks immediate execution", () => {
  const result = evaluateFormalRealReadonlySmokeFinalPreflight({
    preflightPacketPath: PR_18B_FORMAL_REAL_READONLY_SMOKE_FINAL_PREFLIGHT_PACKET,
    authorizationEvidencePath:
      "docs/evidence/codex-cli-formal-real-readonly-smoke-execution-authorization-acceptance.json",
    localCloseoutAuditRequired: true,
    authorizationAcceptanceRequired: true,
    taskbookAcceptanceRequired: true,
    preExecutionAcceptanceRequired: true,
    smokeScriptTestsRequired: true,
    typecheckRequired: true,
    fullTestRequired: true,
    worktreeCleanRequired: true,
    branchMainRequired: true,
    notBehindRequired: true,
    defaultEvidencePathRequired: true,
    providerId: "codex-cli",
    sandboxMode: "read-only",
    sideEffectClass: "read_only",
    approvalPolicy: "never",
    formalDispatchRequired: true,
    providerRegistryRequired: true,
    providerExecutionMetadataRequired: true,
    providerPermitRequired: true,
    currentExecutionRequested: true,
    operatorFlagSetByThisPreflight: true,
    providerExecuteNow: true,
    realCodexCliNow: true,
    pushAuthorized: true,
    releaseAuthorized: true,
    tagAuthorized: true
  });

  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes(
    "formal_real_readonly_smoke_final_preflight_current_execution_must_remain_closed"
  ));
  assert.ok(result.reasons.includes(
    "formal_real_readonly_smoke_final_preflight_must_not_set_operator_flag"
  ));
  assert.ok(result.reasons.includes(
    "formal_real_readonly_smoke_final_preflight_real_cli_now_blocked"
  ));
  assert.ok(result.reasons.includes(
    "formal_real_readonly_smoke_final_preflight_push_must_be_separate"
  ));
});

test("formal real read-only smoke final preflight evidence is local-only and sanitized", async () => {
  const evidence = await runFormalRealReadonlySmokeFinalPreflightAcceptance({
    generatedAt: now
  });

  assert.equal(
    evidence.schemaVersion,
    "codex-cli-formal-real-readonly-smoke-final-preflight-acceptance.v1"
  );
  assert.equal(evidence.generatedAt, now);
  assert.equal(evidence.mode, "formal-real-readonly-smoke-final-preflight-local-only");
  assert.equal(evidence.taskId, "codex-cli-formal-real-readonly-smoke-final-preflight-acceptance");
  assert.deepEqual(evidence.checks, {
    exactPreflightAccepted: true,
    missingPreflightBlocked: true,
    broadenedPreflightBlocked: true,
    immediateExecutionBlocked: true,
    pushReleaseTagRejected: true,
    requiredValidationChainDeclared: true,
    formalBoundaryRequired: true,
    noProviderExecute: true,
    noRealCodexCli: true,
    noWorkspaceWriteExecute: true,
    leakCheckPassed: true
  });
  assert.equal(evidence.summary.requiredValidationCommandCount, 7);
  assert.equal(evidence.summary.operatorFlagMustNotBeSetByPreflight, true);
  assert.deepEqual(evidence.counters, {
    providerExecuteCalls: 0,
    realCodexCliCalls: 0,
    workspaceWriteExecuteCalls: 0
  });
  assertSafeEvidence(evidence);
});

test("formal real read-only smoke final preflight writer persists safe json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "formal-real-readonly-smoke-final-preflight-"));
  const evidencePath = join(dir, "evidence.json");
  const evidence = await runFormalRealReadonlySmokeFinalPreflightAcceptance({
    generatedAt: now
  });

  await writeFormalRealReadonlySmokeFinalPreflightAcceptanceEvidence(
    evidence,
    evidencePath
  );

  const raw = await readFile(evidencePath, "utf8");
  const parsed =
    JSON.parse(raw) as FormalRealReadonlySmokeFinalPreflightAcceptanceEvidence;

  assert.equal(parsed.checks.exactPreflightAccepted, true);
  assert.equal(parsed.checks.immediateExecutionBlocked, true);
  assert.equal(parsed.checks.noRealCodexCli, true);
  assert.equal(parsed.checks.noWorkspaceWriteExecute, true);
  assert.equal(parsed.checks.leakCheckPassed, true);
  assertSafeEvidence(parsed);
});

function assertSafeEvidence(
  evidence: FormalRealReadonlySmokeFinalPreflightAcceptanceEvidence
): void {
  const serialized = JSON.stringify(evidence);

  for (const marker of forbiddenMarkers) {
    assert.equal(serialized.includes(marker), false, marker);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
