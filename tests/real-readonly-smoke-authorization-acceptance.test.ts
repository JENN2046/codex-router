import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PR_13A_REAL_READONLY_SMOKE_AUTHORIZATION_TOKEN,
  PR_13A_REAL_READONLY_SMOKE_COMMAND,
  evaluateRealReadonlySmokeAuthorization,
  runRealReadonlySmokeAuthorizationAcceptance,
  writeRealReadonlySmokeAuthorizationAcceptanceEvidence,
  type RealReadonlySmokeAuthorizationAcceptanceEvidence
} from "../scripts/run-real-readonly-smoke-authorization-acceptance.js";

const now = "2026-06-14T00:00:00.000Z";
const forbiddenMarkers = [
  PR_13A_REAL_READONLY_SMOKE_AUTHORIZATION_TOKEN,
  PR_13A_REAL_READONLY_SMOKE_COMMAND,
  "APPROVE_REAL_CODEX_CLI",
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

test("real read-only smoke authorization accepts only the PR-13A exact packet", () => {
  const authorization = evaluateRealReadonlySmokeAuthorization({
    authorizationToken: PR_13A_REAL_READONLY_SMOKE_AUTHORIZATION_TOKEN,
    command: PR_13A_REAL_READONLY_SMOKE_COMMAND,
    sandboxMode: "read-only",
    approvalPolicy: "never",
    evidencePathChoice: "default",
    workspaceWriteAuthorized: false,
    pushAuthorized: false,
    releaseAuthorized: false,
    tagAuthorized: false
  });

  assert.equal(authorization.ok, true);
  assert.equal(authorization.status, "authorized");
  assert.deepEqual(authorization.reasons, []);
  assert.deepEqual(authorization.summary, {
    exactTokenMatched: true,
    exactCommandMatched: true,
    readOnlySandboxMatched: true,
    approvalPolicyNeverMatched: true,
    evidencePathChoiceDeclared: true,
    workspaceWriteDisallowed: true,
    pushDisallowed: true,
    releaseDisallowed: true,
    tagDisallowed: true,
    providerExecuteCalls: 0,
    realCodexCliCalls: 0,
    workspaceWriteExecuteCalls: 0
  });
});

test("real read-only smoke authorization fails closed on missing or broadened fields", () => {
  const missing = evaluateRealReadonlySmokeAuthorization({});
  const broadened = evaluateRealReadonlySmokeAuthorization({
    authorizationToken: "APPROVE_REAL_CODEX_CLI",
    command: "ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real -- --sandbox workspace-write",
    sandboxMode: "workspace-write",
    approvalPolicy: "on-request",
    workspaceWriteAuthorized: true,
    pushAuthorized: false,
    releaseAuthorized: false,
    tagAuthorized: false
  });

  assert.equal(missing.ok, false);
  assert.ok(missing.reasons.includes(
    "codex_cli_real_readonly_smoke_authorization_exact_token_required"
  ));
  assert.ok(missing.reasons.includes(
    "codex_cli_real_readonly_smoke_authorization_exact_command_required"
  ));
  assert.equal(broadened.ok, false);
  assert.ok(broadened.reasons.includes(
    "codex_cli_real_readonly_smoke_authorization_read_only_sandbox_required"
  ));
  assert.ok(broadened.reasons.includes(
    "codex_cli_real_readonly_smoke_authorization_workspace_write_must_remain_closed"
  ));
  assert.equal(broadened.summary.providerExecuteCalls, 0);
  assert.equal(broadened.summary.realCodexCliCalls, 0);
  assert.equal(broadened.summary.workspaceWriteExecuteCalls, 0);
});

test("real read-only smoke authorization keeps push release and tag separate", () => {
  const authorization = evaluateRealReadonlySmokeAuthorization({
    authorizationToken: PR_13A_REAL_READONLY_SMOKE_AUTHORIZATION_TOKEN,
    command: PR_13A_REAL_READONLY_SMOKE_COMMAND,
    sandboxMode: "read-only",
    approvalPolicy: "never",
    evidencePathChoice: "one-off",
    workspaceWriteAuthorized: false,
    pushAuthorized: true,
    releaseAuthorized: true,
    tagAuthorized: true
  });

  assert.equal(authorization.ok, false);
  assert.ok(authorization.reasons.includes(
    "codex_cli_real_readonly_smoke_authorization_push_must_be_separate"
  ));
  assert.ok(authorization.reasons.includes(
    "codex_cli_real_readonly_smoke_authorization_release_must_be_separate"
  ));
  assert.ok(authorization.reasons.includes(
    "codex_cli_real_readonly_smoke_authorization_tag_must_be_separate"
  ));
});

test("real read-only smoke authorization acceptance stays local-only and sanitized", async () => {
  const evidence = await runRealReadonlySmokeAuthorizationAcceptance({
    generatedAt: now
  });

  assert.equal(
    evidence.schemaVersion,
    "codex-cli-real-readonly-smoke-authorization-acceptance.v1"
  );
  assert.equal(evidence.generatedAt, now);
  assert.equal(evidence.mode, "real-readonly-smoke-authorization-local-only");
  assert.equal(evidence.taskId, "codex-cli-real-readonly-smoke-authorization-acceptance");
  assert.deepEqual(evidence.checks, {
    exactAuthorizationAccepted: true,
    missingAuthorizationBlocked: true,
    broadenedAuthorizationBlocked: true,
    pushReleaseTagRejected: true,
    noProviderExecute: true,
    noRealCodexCli: true,
    noWorkspaceWriteExecute: true,
    leakCheckPassed: true
  });
  assert.equal(evidence.summary.requiredSandbox, "read-only");
  assert.equal(evidence.summary.requiredApprovalPolicy, "never");
  assert.equal(evidence.summary.evidencePathChoiceRequired, true);
  assert.equal(evidence.summary.workspaceWriteMustRemainClosed, true);
  assert.equal(evidence.summary.pushReleaseTagMustBeSeparate, true);
  assert.deepEqual(evidence.counters, {
    providerExecuteCalls: 0,
    realCodexCliCalls: 0,
    workspaceWriteExecuteCalls: 0
  });
  assertSafeEvidence(evidence);
});

test("real read-only smoke authorization acceptance writer persists safe json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "real-readonly-smoke-auth-"));
  const evidencePath = join(dir, "evidence.json");
  const evidence = await runRealReadonlySmokeAuthorizationAcceptance({
    generatedAt: now
  });

  await writeRealReadonlySmokeAuthorizationAcceptanceEvidence(evidence, evidencePath);

  const raw = await readFile(evidencePath, "utf8");
  const parsed = JSON.parse(raw) as RealReadonlySmokeAuthorizationAcceptanceEvidence;

  assert.equal(
    parsed.schemaVersion,
    "codex-cli-real-readonly-smoke-authorization-acceptance.v1"
  );
  assert.equal(parsed.checks.exactAuthorizationAccepted, true);
  assert.equal(parsed.checks.broadenedAuthorizationBlocked, true);
  assert.equal(parsed.checks.noRealCodexCli, true);
  assert.equal(parsed.checks.noWorkspaceWriteExecute, true);
  assert.equal(parsed.checks.leakCheckPassed, true);
  assertSafeEvidence(parsed);
});

function assertSafeEvidence(
  evidence: RealReadonlySmokeAuthorizationAcceptanceEvidence
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
