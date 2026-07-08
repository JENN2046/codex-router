import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE
} from "../packages/governance-internal-workspace-write-guard/src/index.js";
import {
  formatFutureCodexCliCanaryExecutionGateAuditResult,
  readFutureCodexCliCanaryExecutionGateAheadBehind,
  reviewFutureCodexCliCanaryExecutionGateAudit,
  type FutureCodexCliCanaryExecutionGateAuditInput
} from "../scripts/run-future-codex-cli-canary-execution-gate-audit.js";

const execFileAsync = promisify(execFile);

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

test("future canary execution gate audit passes for local draft", async () => {
  const review = reviewFutureCodexCliCanaryExecutionGateAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.executionGateRecorded, true);
  assert.equal(review.checks.gateNonExecuting, true);
  assert.equal(review.checks.priorAuthorizationPacketRecorded, true);
  assert.equal(review.checks.priorChecklistRecorded, true);
  assert.equal(review.checks.priorControlledGateRecorded, true);
  assert.equal(review.checks.exactGateFieldsRecorded, true);
  assert.equal(review.checks.freshPreconditionsRecorded, true);
  assert.equal(review.checks.stopConditionsRecorded, true);
  assert.equal(review.checks.workspaceWriteAuthorizationEvidenceValid, true);
  assert.equal(review.checks.workspaceWritePreExecutionEvidenceValid, true);
  assert.equal(review.summary.canaryTargetFile, DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE);
  assert.equal(review.summary.providerExecuteCallsDuringGateDesign, 0);
  assert.equal(review.summary.realCodexCliCallsDuringGateDesign, 0);
  assert.equal(review.summary.workspaceWriteExecuteCallsDuringGateDesign, 0);
  assert.equal(review.summary.canaryFileWritesDuringGateDesign, 0);
});

test("future canary execution gate audit blocks broadened gate", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewFutureCodexCliCanaryExecutionGateAudit({
    ...input,
    executionGateDocText: input.executionGateDocText
      .replaceAll("It is not the canary execution itself.", "Run the canary now.")
      .replaceAll("push authorized: `false`", "push authorized: `true`")
      .replaceAll("target file: `tmp/codex-cli-write-canary.txt`", "target file: any file")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("future_codex_cli_canary_execution_gate_gateNonExecuting")
  );
  assert.ok(
    review.reasons.includes("future_codex_cli_canary_execution_gate_exactGateFieldsRecorded")
  );
});

test("future canary execution gate audit blocks stale evidence", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewFutureCodexCliCanaryExecutionGateAudit({
    ...input,
    workspaceWritePreExecutionEvidenceText: JSON.stringify({
      mode: "workspace-write-real-canary-pre-execution-local-only",
      checks: {
        authorizationAccepted: true,
        authorizationPacketAccepted: true,
        permitV2Accepted: true,
        permitV2Approved: true,
        permitV2Validated: false,
        packetActionBoundToConfig: true,
        packetPermitBindingAccepted: true,
        preExecutionGateReady: false,
        authorizationPacketFailureBlocksGate: false,
        existingCanaryFileBlocksGate: false
      },
      summary: {
        providerId: "codex-cli",
        packetSchemaVersion: "workspace-write-real-canary-authorization-packet.v1",
        permitSchemaVersion: "provider-workspace-write-execution-permit.v2",
        targetFile: "tmp/other.txt",
        sideEffectClass: "workspace_write",
        sandbox: "workspace-write",
        authorizationPacketStatus: "blocked",
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
      "future_codex_cli_canary_execution_gate_workspaceWritePreExecutionEvidenceValid"
    )
  );
});

test("future canary execution gate audit requires packet and permit v2 proof", async () => {
  const input = await createInputFromWorkspace();
  const evidence = JSON.parse(input.workspaceWritePreExecutionEvidenceText) as {
    checks: Record<string, boolean>;
    summary: Record<string, string>;
  };

  delete evidence.checks.permitV2Validated;
  delete evidence.checks.packetActionBoundToConfig;
  delete evidence.checks.packetPermitBindingAccepted;
  delete evidence.summary.packetSchemaVersion;
  delete evidence.summary.permitSchemaVersion;

  const review = reviewFutureCodexCliCanaryExecutionGateAudit({
    ...input,
    workspaceWritePreExecutionEvidenceText: JSON.stringify(evidence)
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "future_codex_cli_canary_execution_gate_workspaceWritePreExecutionEvidenceValid"
    )
  );
});

test("future canary execution gate audit blocks unsafe local state", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewFutureCodexCliCanaryExecutionGateAudit({
    ...input,
    gitStatusShort: " M package.json\n",
    branch: "feature",
    aheadBehind: "0\t1",
    canaryFileExists: true
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("future_codex_cli_canary_execution_gate_worktreeClean"));
  assert.ok(review.reasons.includes("future_codex_cli_canary_execution_gate_branchMain"));
  assert.ok(review.reasons.includes("future_codex_cli_canary_execution_gate_notBehindOrigin"));
  assert.ok(review.reasons.includes("future_codex_cli_canary_execution_gate_canaryFileAbsent"));
});

test("future canary execution gate audit fails closed without origin main", async () => {
  const dir = await mkdtemp(join(tmpdir(), "future-canary-gate-no-origin-"));
  await execFileAsync("git", ["init"], { cwd: dir });
  await execFileAsync("git", ["config", "user.email", "test@example.invalid"], {
    cwd: dir
  });
  await execFileAsync("git", ["config", "user.name", "Test User"], { cwd: dir });
  await writeFile(join(dir, "README.md"), "fixture\n", "utf8");
  await execFileAsync("git", ["add", "README.md"], { cwd: dir });
  await execFileAsync("git", ["commit", "-m", "fixture"], { cwd: dir });

  assert.equal(
    await readFutureCodexCliCanaryExecutionGateAheadBehind(dir),
    "0\t1"
  );
});

test("future canary execution gate audit output stays summarized", async () => {
  const review = reviewFutureCodexCliCanaryExecutionGateAudit(
    await createInputFromWorkspace()
  );
  const text = formatFutureCodexCliCanaryExecutionGateAuditResult(review);
  const json = formatFutureCodexCliCanaryExecutionGateAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /workspace-write execute calls during gate design: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<FutureCodexCliCanaryExecutionGateAuditInput> = {}
): Promise<FutureCodexCliCanaryExecutionGateAuditInput> {
  return {
    gitStatusShort: "",
    branch: "main",
    aheadBehind: "0\t0",
    packageJsonText: await readFile("package.json", "utf8"),
    executionGateDocText: await readFile(
      "docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_GATE.md",
      "utf8"
    ),
    authorizationPacketDocText: await readFile(
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
