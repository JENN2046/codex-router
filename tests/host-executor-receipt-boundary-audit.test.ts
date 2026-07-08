import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatHostExecutorReceiptBoundaryAuditResult,
  reviewHostExecutorReceiptBoundaryAudit,
  type HostExecutorReceiptBoundaryAuditInput
} from "../scripts/run-host-executor-receipt-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("host executor receipt boundary audit passes for current evidence", async () => {
  const review = reviewHostExecutorReceiptBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.phase14ContractRecorded, true);
  assert.equal(review.checks.currentStateRecorded, true);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.receiptStatusesConstrained, true);
  assert.equal(review.checks.terminalReasonCodeRequired, true);
  assert.equal(review.checks.receiptPropagationRecorded, true);
  assert.equal(review.checks.desktopHostClientReceiptSurfaceRecorded, true);
  assert.equal(review.checks.failClosedCoverageRecorded, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.deepEqual(review.summary.receiptStatuses, [
    "accepted",
    "running",
    "completed",
    "failed",
    "refused",
    "aborted"
  ]);
  assert.equal(review.summary.terminalStatusesRequireReasonCode, true);
  assert.equal(review.summary.dispatchResultMeansBusinessRecoveryCompleted, false);
  assert.equal(review.summary.executorInvocationsDuringAudit, 0);
});

test("host executor receipt boundary audit blocks missing runner and README entries", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewHostExecutorReceiptBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "host-executor-receipt-boundary",
      "archived-receipt-review"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit host-executor-receipt-boundary",
      "npm run governance -- audit archived-receipt-review"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "host_executor_receipt_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "host_executor_receipt_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("host executor receipt boundary audit blocks weakened terminal reason guard", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewHostExecutorReceiptBoundaryAudit({
    ...input,
    recoveryControlSourceText: input.recoveryControlSourceText
      .replaceAll(
        "operator_action_host_executor_dispatch_executor_terminal_status_requires_reason_code",
        "operator_action_host_executor_dispatch_executor_reason_optional"
      )
      .replaceAll(
        "operator_action_host_executor_dispatch_executor_reason_code_unsafe",
        "operator_action_host_executor_dispatch_executor_reason_code_unchecked"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "host_executor_receipt_boundary_terminalReasonCodeRequired"
    )
  );
});

test("host executor receipt boundary audit blocks broadened receipt semantics", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewHostExecutorReceiptBoundaryAudit({
    ...input,
    phase14ReceiptContractText: input.phase14ReceiptContractText
      .replaceAll(
        "does not mean business recovery finished",
        "means business recovery finished"
      )
      .replaceAll(
        "This boundary does not add",
        "This boundary may add"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("host_executor_receipt_boundary_phase14ContractRecorded")
  );
  assert.ok(
    review.reasons.includes(
      "host_executor_receipt_boundary_noBroadExecutionAuthorization"
    )
  );
});

test("host executor receipt boundary audit output stays summarized", async () => {
  const review = reviewHostExecutorReceiptBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatHostExecutorReceiptBoundaryAuditResult(review);
  const json = formatHostExecutorReceiptBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /executor invocations during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<HostExecutorReceiptBoundaryAuditInput> = {}
): Promise<HostExecutorReceiptBoundaryAuditInput> {
  return {
    phase14ReceiptContractText: await readFile(
      "docs/governance/PHASE_14_AGENT_EXECUTOR_RECEIPT_CONTRACT.md",
      "utf8"
    ),
    currentStateText: await readFile("docs/current/CURRENT_STATE.md", "utf8"),
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    recoveryControlSourceText: await readFile(
      "packages/governance-internal-recovery-control/src/index.ts",
      "utf8"
    ),
    recoveryControlTestText: await readFile("tests/recovery-control.test.ts", "utf8"),
    desktopHostClientTestText: await readFile(
      "tests/desktop-host-client.test.ts",
      "utf8"
    ),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    ...overrides
  };
}
