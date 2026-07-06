import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE
} from "../packages/governance-internal-workspace-write-guard/src/index.js";
import {
  formatFutureCodexCliCanaryPacketChecklistAuditResult,
  reviewFutureCodexCliCanaryPacketChecklistAudit,
  type FutureCodexCliCanaryPacketChecklistAuditInput
} from "../scripts/run-future-codex-cli-canary-packet-checklist-audit.js";

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

test("future canary packet checklist passes for current local evidence", async () => {
  const review = reviewFutureCodexCliCanaryPacketChecklistAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.checklistRecorded, true);
  assert.equal(review.checks.checklistNonAuthorizing, true);
  assert.equal(review.checks.priorControlledGateRecorded, true);
  assert.equal(review.checks.readonlySmokeReceiptValid, true);
  assert.equal(review.checks.workspaceWriteAuthorizationEvidenceValid, true);
  assert.equal(review.checks.workspaceWritePreExecutionEvidenceValid, true);
  assert.equal(review.checks.exactPacketFieldsRecorded, true);
  assert.equal(review.checks.preExecutionInvariantsRecorded, true);
  assert.equal(review.summary.canaryTargetFile, DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE);
  assert.equal(review.summary.providerExecuteCallsDuringChecklist, 0);
  assert.equal(review.summary.realCodexCliCallsDuringChecklist, 0);
  assert.equal(review.summary.workspaceWriteExecuteCallsDuringChecklist, 0);
  assert.equal(review.summary.canaryFileWritesDuringChecklist, 0);
});

test("future canary packet checklist blocks stale receipts", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewFutureCodexCliCanaryPacketChecklistAudit({
    ...input,
    readonlySmokeReceiptText: JSON.stringify({
      status: "passed",
      plan: {
        sandbox: "workspace-write",
        approvalPolicy: "on-request"
      },
      checks: {
        noWorkspaceWrite: false
      },
      summary: {
        passed: true
      }
    }),
    workspaceWriteAuthorizationEvidenceText: JSON.stringify({
      mode: "workspace-write-real-canary-authorization-local-only",
      checks: {
        exactAuthorizationAccepted: true,
        broadenedAuthorizationBlocked: false,
        pushAuthorizationRejected: false
      },
      summary: {
        targetFile: "tmp/other.txt",
        branch: "main",
        requiredSandbox: "workspace-write",
        requiredRollback: false,
        pushMustBeSeparate: false
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
    review.reasons.includes("future_codex_cli_canary_packet_checklist_readonlySmokeReceiptValid")
  );
  assert.ok(
    review.reasons.includes(
      "future_codex_cli_canary_packet_checklist_workspaceWriteAuthorizationEvidenceValid"
    )
  );
});

test("future canary packet checklist blocks broadened packet fields", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewFutureCodexCliCanaryPacketChecklistAudit({
    ...input,
    checklistDocText: input.checklistDocText
      .replaceAll("It is not the canary execution itself.", "Run the canary now.")
      .replaceAll("target file: `tmp/codex-cli-write-canary.txt`", "target file: any file")
      .replaceAll("push authorized: `false`", "push authorized: `true`")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("future_codex_cli_canary_packet_checklist_checklistNonAuthorizing")
  );
  assert.ok(
    review.reasons.includes("future_codex_cli_canary_packet_checklist_exactPacketFieldsRecorded")
  );
});

test("future canary packet checklist blocks unsafe local state", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewFutureCodexCliCanaryPacketChecklistAudit({
    ...input,
    gitStatusShort: " M package.json\n",
    branch: "feature",
    aheadBehind: "0\t1",
    canaryFileExists: true
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("future_codex_cli_canary_packet_checklist_worktreeClean"));
  assert.ok(review.reasons.includes("future_codex_cli_canary_packet_checklist_branchMain"));
  assert.ok(review.reasons.includes("future_codex_cli_canary_packet_checklist_notBehindOrigin"));
  assert.ok(review.reasons.includes("future_codex_cli_canary_packet_checklist_canaryFileAbsent"));
});

test("future canary packet checklist output stays summarized", async () => {
  const review = reviewFutureCodexCliCanaryPacketChecklistAudit(
    await createInputFromWorkspace()
  );
  const text = formatFutureCodexCliCanaryPacketChecklistAuditResult(review);
  const json = formatFutureCodexCliCanaryPacketChecklistAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /workspace-write execute calls during checklist: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<FutureCodexCliCanaryPacketChecklistAuditInput> = {}
): Promise<FutureCodexCliCanaryPacketChecklistAuditInput> {
  return {
    gitStatusShort: "",
    branch: "main",
    aheadBehind: "0\t0",
    packageJsonText: await readFile("package.json", "utf8"),
    checklistDocText: await readFile(
      "docs/governance/FUTURE_CODEX_CLI_CANARY_EXECUTION_PACKET_CHECKLIST.md",
      "utf8"
    ),
    controlledGateDocText: await readFile(
      "docs/governance/CONTROLLED_EXECUTION_GATE_NEXT_CODEX_CLI_STEP.md",
      "utf8"
    ),
    readonlySmokeReceiptText:
      await readFile("docs/evidence/codex-cli-real-readonly-smoke.json", "utf8"),
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
