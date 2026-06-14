import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packetPath =
  "docs/governance/PR_14B_FORMAL_READONLY_CLI_INTEGRATION_AUTHORIZATION_PACKET.md";
const evidencePath =
  "docs/evidence/codex-cli-formal-readonly-integration-authorization-acceptance.json";

test("PR-14B formal read-only integration authorization packet records exact local gate", async () => {
  const [packet, evidenceRaw] = await Promise.all([
    readFile(packetPath, "utf8"),
    readFile(evidencePath, "utf8")
  ]);
  const evidence = JSON.parse(evidenceRaw) as {
    checks: Record<string, unknown>;
    summary: Record<string, unknown>;
    counters: Record<string, unknown>;
  };

  assert.match(
    packet,
    /PR_14B_FORMAL_READONLY_CLI_INTEGRATION_AUTHORIZATION_PACKET_RECORDED/
  );
  assert.match(
    packet,
    /APPROVE_FORMAL_CODEX_CLI_READONLY_PROVIDER_INTEGRATION_PR_14B/
  );
  assert.match(packet, /npm run acceptance:formal-readonly-integration/);
  assert.equal(evidence.checks.exactAuthorizationAccepted, true);
  assert.equal(evidence.checks.executionAuthorizationRejected, true);
  assert.equal(evidence.summary.providerExecutionMustRemainSeparate, true);
  assert.equal(evidence.summary.realCliInvocationMustRemainSeparate, true);
  assert.equal(evidence.counters.providerExecuteCalls, 0);
  assert.equal(evidence.counters.realCodexCliCalls, 0);
  assert.equal(evidence.counters.workspaceWriteExecuteCalls, 0);
});

test("PR-14B formal read-only integration authorization packet remains non-executing", async () => {
  const packet = await readFile(packetPath, "utf8");
  const normalized = packet.replace(/\s+/g, " ");

  for (const phrase of [
    "not an authorization to execute the provider",
    "real Codex CLI invocation",
    "workspace-write execute",
    "Provider execution and real CLI invocation must remain separate future gates",
    "still does not authorize or execute real provider execution"
  ]) {
    assert.match(normalized, new RegExp(escapeRegExp(phrase)));
  }
});

test("PR-14B formal read-only integration authorization evidence omits raw packet surfaces", async () => {
  const evidenceRaw = await readFile(evidencePath, "utf8");
  const serializedEvidence = JSON.stringify(JSON.parse(evidenceRaw));

  for (const marker of [
    "APPROVE_FORMAL_CODEX_CLI_READONLY_PROVIDER_INTEGRATION_PR_14B",
    "npm run acceptance:formal-readonly-integration",
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
  ]) {
    assert.equal(serializedEvidence.includes(marker), false, marker);
  }
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
