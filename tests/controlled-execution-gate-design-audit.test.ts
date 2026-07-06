import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE
} from "../packages/governance-internal-workspace-write-guard/src/index.js";
import {
  formatControlledExecutionGateDesignAuditResult,
  reviewControlledExecutionGateDesignAudit,
  type ControlledExecutionGateDesignAuditInput
} from "../scripts/run-controlled-execution-gate-design-audit.js";

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

test("controlled execution gate design audit passes for current local evidence", async () => {
  const review = reviewControlledExecutionGateDesignAudit(await createInputFromWorkspace());

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.designRecorded, true);
  assert.equal(review.checks.designNonAuthorizing, true);
  assert.equal(review.checks.realReadonlySmokePassed, true);
  assert.equal(review.checks.canaryAuthorizationEvidenceReady, true);
  assert.equal(review.checks.canaryPreExecutionEvidenceReady, true);
  assert.equal(review.checks.futurePacketFieldsExact, true);
  assert.equal(review.summary.canaryTargetFile, DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE);
  assert.equal(review.summary.providerExecuteCallsDuringDesign, 0);
  assert.equal(review.summary.realCodexCliCallsDuringDesign, 0);
  assert.equal(review.summary.workspaceWriteExecuteCallsDuringDesign, 0);
  assert.equal(review.summary.canaryFileWritesDuringDesign, 0);
});

test("controlled execution gate design audit blocks stale receipts", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewControlledExecutionGateDesignAudit({
    ...input,
    realReadonlySmokeReceiptText: JSON.stringify({
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
    workspaceWritePreExecutionEvidenceText: JSON.stringify({
      mode: "workspace-write-real-canary-pre-execution-local-only",
      checks: {
        authorizationAccepted: true,
        preExecutionGateReady: false
      },
      summary: {
        targetFile: "tmp/other.txt",
        sideEffectClass: "workspace_write",
        sandbox: "workspace-write",
        pushDisallowed: false,
        rollbackReady: false
      },
      counters: {
        workspaceWriteExecuteCalls: 1,
        realCodexCliCalls: 0,
        providerExecuteCalls: 0
      }
    })
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("controlled_execution_gate_design_realReadonlySmokePassed"));
  assert.ok(
    review.reasons.includes("controlled_execution_gate_design_canaryPreExecutionEvidenceReady")
  );
});

test("controlled execution gate design audit blocks broadened design", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewControlledExecutionGateDesignAudit({
    ...input,
    designDocText: input.designDocText
      .replaceAll("It is not to run workspace-write execution.", "Run workspace-write now.")
      .replaceAll("target file: `tmp/codex-cli-write-canary.txt`", "target file: any file")
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes("controlled_execution_gate_design_designNonAuthorizing"));
  assert.ok(review.reasons.includes("controlled_execution_gate_design_futurePacketFieldsExact"));
});

test("controlled execution gate design audit output stays summarized", async () => {
  const review = reviewControlledExecutionGateDesignAudit(await createInputFromWorkspace());
  const text = formatControlledExecutionGateDesignAuditResult(review);
  const json = formatControlledExecutionGateDesignAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /workspace-write execute calls during design: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<ControlledExecutionGateDesignAuditInput> = {}
): Promise<ControlledExecutionGateDesignAuditInput> {
  return {
    gitStatusShort: "",
    branch: "main",
    packageJsonText: await readFile("package.json", "utf8"),
    designDocText: await readFile(
      "docs/governance/CONTROLLED_EXECUTION_GATE_NEXT_CODEX_CLI_STEP.md",
      "utf8"
    ),
    realReadonlySmokeReceiptText:
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
