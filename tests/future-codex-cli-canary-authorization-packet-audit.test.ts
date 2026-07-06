import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE
} from "../packages/governance-internal-workspace-write-guard/src/index.js";
import {
  formatFutureCodexCliCanaryAuthorizationPacketAuditResult,
  reviewFutureCodexCliCanaryAuthorizationPacketAudit,
  type FutureCodexCliCanaryAuthorizationPacketAuditInput
} from "../scripts/run-future-codex-cli-canary-authorization-packet-audit.js";

const forbiddenOutputMarkers = [
  "requestedAction",
  "prompt",
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

test("future canary authorization packet audit passes for local draft", async () => {
  const review = reviewFutureCodexCliCanaryAuthorizationPacketAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.packetDraftRecorded, true);
  assert.equal(review.checks.packetNonAuthorizing, true);
  assert.equal(review.checks.priorChecklistRecorded, true);
  assert.equal(review.checks.priorControlledGateRecorded, true);
  assert.equal(review.checks.exactPacketFieldsRecorded, true);
  assert.equal(review.checks.freshPreflightRecorded, true);
  assert.equal(review.checks.workspaceWriteAuthorizationEvidenceValid, true);
  assert.equal(review.checks.workspaceWritePreExecutionEvidenceValid, true);
  assert.equal(review.summary.canaryTargetFile, DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE);
  assert.equal(review.summary.providerExecuteCallsDuringDraft, 0);
  assert.equal(review.summary.realCodexCliCallsDuringDraft, 0);
  assert.equal(review.summary.workspaceWriteExecuteCallsDuringDraft, 0);
  assert.equal(review.summary.canaryFileWritesDuringDraft, 0);
});

test("future canary authorization packet audit blocks broadened draft", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewFutureCodexCliCanaryAuthorizationPacketAudit({
    ...input,
    packetDocText: input.packetDocText
      .replaceAll("It is not the canary execution itself.", "Run the canary now.")
      .replaceAll("push authorized: `false`", "push authorized: `true`")
      .replaceAll("target file: `tmp/codex-cli-write-canary.txt`", "target file: any file")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("future_codex_cli_canary_authorization_packet_packetNonAuthorizing")
  );
  assert.ok(
    review.reasons.includes("future_codex_cli_canary_authorization_packet_exactPacketFieldsRecorded")
  );
});

test("future canary authorization packet audit blocks stale evidence", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewFutureCodexCliCanaryAuthorizationPacketAudit({
    ...input,
    workspaceWritePreExecutionEvidenceText: JSON.stringify({
      mode: "workspace-write-real-canary-pre-execution-local-only",
      checks: {
        authorizationAccepted: true,
        preExecutionGateReady: false,
        existingCanaryFileBlocksGate: false
      },
      summary: {
        providerId: "codex-cli",
        targetFile: "tmp/other.txt",
        sideEffectClass: "workspace_write",
        sandbox: "workspace-write",
        pushDisallowed: false,
        rollbackReady: false
      },
      counters: {
        providerExecuteCalls: 0,
        realCodexCliCalls: 0,
        workspaceWriteExecuteCalls: 1,
        canaryFileWrites: 0
      }
    })
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "future_codex_cli_canary_authorization_packet_workspaceWritePreExecutionEvidenceValid"
    )
  );
});

test("future canary authorization packet audit blocks unsafe local state", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewFutureCodexCliCanaryAuthorizationPacketAudit({
    ...input,
    gitStatusShort: " M package.json\n",
    branch: "feature",
    aheadBehind: "0\t1",
    canaryFileExists: true
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("future_codex_cli_canary_authorization_packet_worktreeClean"));
  assert.ok(review.reasons.includes("future_codex_cli_canary_authorization_packet_branchMain"));
  assert.ok(review.reasons.includes("future_codex_cli_canary_authorization_packet_notBehindOrigin"));
  assert.ok(review.reasons.includes("future_codex_cli_canary_authorization_packet_canaryFileAbsent"));
});

test("future canary authorization packet audit output stays summarized", async () => {
  const review = reviewFutureCodexCliCanaryAuthorizationPacketAudit(
    await createInputFromWorkspace()
  );
  const text = formatFutureCodexCliCanaryAuthorizationPacketAuditResult(review);
  const json = formatFutureCodexCliCanaryAuthorizationPacketAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /workspace-write execute calls during draft: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<FutureCodexCliCanaryAuthorizationPacketAuditInput> = {}
): Promise<FutureCodexCliCanaryAuthorizationPacketAuditInput> {
  return {
    gitStatusShort: "",
    branch: "main",
    aheadBehind: "0\t0",
    packageJsonText: await readFile("package.json", "utf8"),
    packetDocText: await readFile(
      "docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_AUTHORIZATION_PACKET.md",
      "utf8"
    ),
    checklistDocText: await readFile(
      "docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_PACKET_CHECKLIST.md",
      "utf8"
    ),
    controlledGateDocText: await readFile(
      "docs/governance/CONTROLLED_EXECUTION_GATE_NEXT_CODEX_CLI_STEP.md",
      "utf8"
    ),
    workspaceWriteAuthorizationEvidenceText: await readFile(
      "docs/evidence/workspace-write-real-canary-authorization-acceptance.json",
      "utf8"
    ),
    workspaceWritePreExecutionEvidenceText: await readFile(
      "docs/evidence/workspace-write-real-canary-pre-execution-acceptance.json",
      "utf8"
    ),
    canaryFileExists: false,
    ...overrides
  };
}
