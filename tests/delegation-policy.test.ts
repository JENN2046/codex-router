import test from "node:test";
import assert from "node:assert/strict";
import {
  createDelegationHistory,
  recordResume,
  recordApproval,
  recordRejection,
  calculateDelegationLevel,
  generateAdjustmentProposal,
  requiresApproval,
  getRequiredApprovers,
  parseDelegationHistory,
  deriveDelegationFromApprovals,
  delegationLevelToHistoricalTrust,
  approveProposal,
  rejectProposal,
  applyApprovedProposal,
  filterRecoveryActions,
  createRecordingDelegationHistoryStore,
  createFileDelegationHistoryStore
} from "../packages/delegation-policy/src/index.js";
import type { GovernanceState, ApprovalHistoryRecord } from "../packages/state-manager/src/index.js";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// ── Helpers ──────────────────────────────────────────────────────────────────

function createLowRiskState(): GovernanceState["risk"] {
  return {
    entanglement: 0.2,
    entropy: 0.2,
    failureCost: 0.2,
    reversibility: 0.8,
    contextPressure: 0.2,
    historicalTrust: 0.5,
    globalCoherence: 0.9,
    finalRiskLevel: "low"
  };
}

function createHighRiskState(): GovernanceState["risk"] {
  return {
    entanglement: 0.8,
    entropy: 0.8,
    failureCost: 0.8,
    reversibility: 0.2,
    contextPressure: 0.7,
    historicalTrust: 0.3,
    globalCoherence: 0.5,
    finalRiskLevel: "high"
  };
}

function createCriticalRiskState(): GovernanceState["risk"] {
  return {
    ...createHighRiskState(),
    finalRiskLevel: "critical"
  };
}

// ── Factory tests ───────────────────────────────────────────────────────────

test("delegation-policy: createDelegationHistory initializes with zero counts", () => {
  const history = createDelegationHistory({
    taskId: "test-task",
    operationClass: "file_write",
    now: () => "2026-04-28T00:00:00.000Z"
  });

  assert.equal(history.resumeCount, 0);
  assert.equal(history.approvalCount, 0);
  assert.equal(history.rejectionCount, 0);
  assert.equal(history.firstCreatedAt, "2026-04-28T00:00:00.000Z");
});

// ── Record tests ────────────────────────────────────────────────────────────

test("delegation-policy: recordResume increments resume count", () => {
  const history = createDelegationHistory({ taskId: "test-task", operationClass: "file_write" });
  const { history: updated, record } = recordResume(history, {
    taskId: "test-task",
    reason: "human approved",
    actor: "user",
    createdAt: "2026-04-28T00:00:00.000Z"
  });

  assert.equal(updated.resumeCount, 1);
  assert.equal(updated.lastResumeAt, "2026-04-28T00:00:00.000Z");
  assert.equal(record.resumeId, "test-task:resume:1");
});

test("delegation-policy: recordApproval increments approval count", () => {
  const history = createDelegationHistory({ taskId: "test-task", operationClass: "file_write" });
  const updated = recordApproval(history);
  assert.equal(updated.approvalCount, 1);
});

test("delegation-policy: recordRejection increments rejection count", () => {
  const history = createDelegationHistory({ taskId: "test-task", operationClass: "file_write" });
  const updated = recordRejection(history);
  assert.equal(updated.rejectionCount, 1);
});

// ── Level calculation tests ─────────────────────────────────────────────────

test("delegation-policy: calculateDelegationLevel returns full_control for 0 resumes", () => {
  const history = createDelegationHistory({ taskId: "test-task", operationClass: "file_write" });
  assert.equal(calculateDelegationLevel(history), "full_control");
});

test("delegation-policy: calculateDelegationLevel returns supervised for 1 resume", () => {
  let history = createDelegationHistory({ taskId: "test-task", operationClass: "file_write" });
  const r1 = recordResume(history, { taskId: "test-task", reason: "ok", actor: "user", createdAt: "2026-04-28T00:00:00.000Z" });
  history = r1.history;
  assert.equal(calculateDelegationLevel(history), "supervised");
});

test("delegation-policy: calculateDelegationLevel returns trusted for 2 resumes", () => {
  let history = createDelegationHistory({ taskId: "test-task", operationClass: "file_write" });
  const r1 = recordResume(history, { taskId: "test-task", reason: "ok", actor: "user", createdAt: "2026-04-28T00:00:00.000Z" });
  history = r1.history;
  const r2 = recordResume(history, { taskId: "test-task", reason: "ok", actor: "user", createdAt: "2026-04-28T00:00:00.000Z" });
  history = r2.history;
  assert.equal(calculateDelegationLevel(history), "trusted");
});

test("delegation-policy: calculateDelegationLevel returns autonomous for 3 resumes", () => {
  let history = createDelegationHistory({ taskId: "test-task", operationClass: "file_write" });
  for (let i = 0; i < 3; i++) {
    const r = recordResume(history, { taskId: "test-task", reason: "ok", actor: "user", createdAt: "2026-04-28T00:00:00.000Z" });
    history = r.history;
  }
  assert.equal(calculateDelegationLevel(history), "autonomous");
});

test("delegation-policy: calculateDelegationLevel returns full_delegation for 5 resumes", () => {
  let history = createDelegationHistory({ taskId: "test-task", operationClass: "file_write" });
  for (let i = 0; i < 5; i++) {
    const r = recordResume(history, { taskId: "test-task", reason: "ok", actor: "user", createdAt: "2026-04-28T00:00:00.000Z" });
    history = r.history;
  }
  assert.equal(calculateDelegationLevel(history), "full_delegation");
});

test("delegation-policy: calculateDelegationLevel resets to full_control on rejection", () => {
  let history = createDelegationHistory({ taskId: "test-task", operationClass: "file_write" });
  for (let i = 0; i < 3; i++) {
    const r = recordResume(history, { taskId: "test-task", reason: "ok", actor: "user", createdAt: "2026-04-28T00:00:00.000Z" });
    history = r.history;
  }
  assert.equal(calculateDelegationLevel(history), "autonomous");

  const rejected = recordRejection(history);
  assert.equal(calculateDelegationLevel(rejected), "full_control");
});

// ── Proposal generation tests ───────────────────────────────────────────────

test("delegation-policy: generateAdjustmentProposal creates proposal", () => {
  const history = createDelegationHistory({ taskId: "test-task", operationClass: "file_write" });
  const proposal = generateAdjustmentProposal({
    taskId: "test-task",
    operationClass: "file_write",
    history,
    now: () => "2026-04-28T00:00:00.000Z"
  });

  assert.equal(proposal.status, "pending_review");
  assert.equal(proposal.currentLevel, "full_control");
  assert.equal(proposal.proposedLevel, "supervised");
});

// ── Approval check tests ────────────────────────────────────────────────────

test("delegation-policy: requiresApproval returns true for irreversible actions", () => {
  const result = requiresApproval({
    level: "full_delegation",
    riskLevel: createLowRiskState(),
    isIrreversible: true,
    isHighRiskOperation: false
  });
  assert.equal(result, true);
});

test("delegation-policy: requiresApproval returns false for full_delegation low risk", () => {
  const result = requiresApproval({
    level: "full_delegation",
    riskLevel: createLowRiskState(),
    isIrreversible: false,
    isHighRiskOperation: false
  });
  assert.equal(result, false);
});

test("delegation-policy: requiresApproval returns true for critical risk at autonomous", () => {
  const result = requiresApproval({
    level: "autonomous",
    riskLevel: createCriticalRiskState(),
    isIrreversible: false,
    isHighRiskOperation: false
  });
  assert.equal(result, true);
});

test("delegation-policy: requiresApproval returns true for high risk at trusted", () => {
  const result = requiresApproval({
    level: "trusted",
    riskLevel: createHighRiskState(),
    isIrreversible: false,
    isHighRiskOperation: false
  });
  assert.equal(result, true);
});

test("delegation-policy: getRequiredApprovers returns empty for full_delegation", () => {
  const approvers = getRequiredApprovers("full_delegation", "file_write");
  assert.deepEqual(approvers, []);
});

test("delegation-policy: getRequiredApprovers returns supervisor for autonomous", () => {
  const approvers = getRequiredApprovers("autonomous", "file_write");
  assert.deepEqual(approvers, ["supervisor"]);
});

test("delegation-policy: getRequiredApprovers returns human for full_control", () => {
  const approvers = getRequiredApprovers("full_control", "file_write");
  assert.deepEqual(approvers, ["human"]);
});

// ── Bridge: deriveDelegationFromApprovals tests ──────────────────────────────

test("delegation-policy: deriveDelegationFromApprovals counts resume/approve/reject", () => {
  const approvals: ApprovalHistoryRecord[] = [
    { approvalId: "a1", taskId: "t1", action: "resume", actor: "human", createdAt: "2026-04-28T00:00:00.000Z" },
    { approvalId: "a2", taskId: "t1", action: "approve", actor: "human", createdAt: "2026-04-28T00:01:00.000Z" },
    { approvalId: "a3", taskId: "t1", action: "resume", actor: "human", createdAt: "2026-04-28T00:02:00.000Z" },
    { approvalId: "a4", taskId: "t1", action: "reject", actor: "human", createdAt: "2026-04-28T00:03:00.000Z" }
  ];

  const history = deriveDelegationFromApprovals(approvals, "t1", "file_write");

  assert.equal(history.resumeCount, 2);
  assert.equal(history.approvalCount, 1);
  assert.equal(history.rejectionCount, 1);
  assert.equal(history.lastResumeAt, "2026-04-28T00:02:00.000Z");
});

test("delegation-policy: deriveDelegationFromApprovals handles empty list", () => {
  const history = deriveDelegationFromApprovals([], "t1", "file_write");

  assert.equal(history.resumeCount, 0);
  assert.equal(history.approvalCount, 0);
  assert.equal(history.rejectionCount, 0);
});

test("delegation-policy: deriveDelegationFromApprovals → calculateDelegationLevel chain", () => {
  const approvals: ApprovalHistoryRecord[] = [
    { approvalId: "a1", taskId: "t1", action: "resume", actor: "human", createdAt: "2026-04-28T00:00:00.000Z" },
    { approvalId: "a2", taskId: "t1", action: "resume", actor: "human", createdAt: "2026-04-28T00:01:00.000Z" },
    { approvalId: "a3", taskId: "t1", action: "resume", actor: "human", createdAt: "2026-04-28T00:02:00.000Z" }
  ];

  const history = deriveDelegationFromApprovals(approvals, "t1", "file_write");
  const level = calculateDelegationLevel(history);

  assert.equal(level, "autonomous");
});

// ── Historical trust mapping tests ────────────────────────────────────────────

test("delegation-policy: delegationLevelToHistoricalTrust returns ascending trust", () => {
  assert.equal(delegationLevelToHistoricalTrust("full_control"), 0.30);
  assert.equal(delegationLevelToHistoricalTrust("supervised"), 0.50);
  assert.equal(delegationLevelToHistoricalTrust("trusted"), 0.70);
  assert.equal(delegationLevelToHistoricalTrust("autonomous"), 0.85);
  assert.equal(delegationLevelToHistoricalTrust("full_delegation"), 0.95);
});

test("delegation-policy: delegationLevelToHistoricalTrust is monotonically increasing", () => {
  const levels = ["full_control", "supervised", "trusted", "autonomous", "full_delegation"] as const;
  for (let i = 1; i < levels.length; i++) {
    const prev = delegationLevelToHistoricalTrust(levels[i - 1]!);
    const curr = delegationLevelToHistoricalTrust(levels[i]!);
    assert.ok(curr > prev, `${levels[i]} (${curr}) > ${levels[i - 1]} (${prev})`);
  }
});

// ── Proposal lifecycle tests ──────────────────────────────────────────────────

test("delegation-policy: approveProposal sets status to approved", () => {
  const history = createDelegationHistory({ taskId: "t1", operationClass: "file_write" });
  const proposal = generateAdjustmentProposal({
    taskId: "t1", operationClass: "file_write", history,
    now: () => "2026-04-28T00:00:00.000Z"
  });

  const approved = approveProposal(proposal);
  assert.equal(approved.status, "approved");
  assert.equal(approved.proposalId, proposal.proposalId);
});

test("delegation-policy: rejectProposal sets status to rejected", () => {
  const history = createDelegationHistory({ taskId: "t1", operationClass: "file_write" });
  const proposal = generateAdjustmentProposal({
    taskId: "t1", operationClass: "file_write", history,
    now: () => "2026-04-28T00:00:00.000Z"
  });

  const rejected = rejectProposal(proposal);
  assert.equal(rejected.status, "rejected");
});

test("delegation-policy: applyApprovedProposal returns new level when approved", () => {
  const history = createDelegationHistory({ taskId: "t1", operationClass: "file_write" });
  const proposal = generateAdjustmentProposal({
    taskId: "t1", operationClass: "file_write", history,
    now: () => "2026-04-28T00:00:00.000Z"
  });
  const approved = approveProposal(proposal);
  const newLevel = applyApprovedProposal(approved);

  assert.equal(newLevel, "supervised");
});

test("delegation-policy: applyApprovedProposal returns current level when pending", () => {
  const history = createDelegationHistory({ taskId: "t1", operationClass: "file_write" });
  const proposal = generateAdjustmentProposal({
    taskId: "t1", operationClass: "file_write", history,
    now: () => "2026-04-28T00:00:00.000Z"
  });

  const newLevel = applyApprovedProposal(proposal); // still pending_review
  assert.equal(newLevel, "full_control");
});

// ── Recovery action filtering tests ───────────────────────────────────────────

test("delegation-policy: filterRecoveryActions restricts actions at full_control", () => {
  const actions = filterRecoveryActions("full_control");
  assert.deepEqual(actions, ["resume", "abort"]);
});

test("delegation-policy: filterRecoveryActions allows rollback at supervised", () => {
  const actions = filterRecoveryActions("supervised");
  assert.deepEqual(actions, ["resume", "rollback", "abort"]);
});

test("delegation-policy: filterRecoveryActions allows all at autonomous", () => {
  const actions = filterRecoveryActions("autonomous");
  assert.deepEqual(actions, ["resume", "rollback", "abort", "fork"]);
});

test("delegation-policy: filterRecoveryActions allows all at full_delegation", () => {
  const actions = filterRecoveryActions("full_delegation");
  assert.deepEqual(actions, ["resume", "rollback", "abort", "fork"]);
});

// ── Store tests ───────────────────────────────────────────────────────────────

test("delegation-policy: RecordingDelegationHistoryStore saves and loads", async () => {
  const store = createRecordingDelegationHistoryStore();
  const history = createDelegationHistory({ taskId: "store-test", operationClass: "file_write" });

  await store.save(history);
  const loaded = await store.load("store-test");

  assert.ok(loaded);
  assert.equal(loaded?.resumeCount, 0);
});

test("delegation-policy: RecordingDelegationHistoryStore returns undefined for missing", async () => {
  const store = createRecordingDelegationHistoryStore();
  const result = await store.load("nonexistent");
  assert.equal(result, undefined);
});

test("delegation-policy: FileDelegationHistoryStore persists to disk", async () => {
  const TEST_PATH = join(__dirname, "..", ".test-delegation-store");
  const store = createFileDelegationHistoryStore({ basePath: TEST_PATH });
  const history = createDelegationHistory({ taskId: "file-store-test", operationClass: "file_write" });

  await store.save(history);
  const loaded = await store.load("file-store-test");

  assert.ok(loaded);
  assert.equal(loaded?.taskId, "file-store-test");

  await rm(TEST_PATH, { recursive: true, force: true }).catch(() => {});
});

test("delegation-policy: FileDelegationHistoryStore returns undefined for missing", async () => {
  const TEST_PATH = join(__dirname, "..", ".test-delegation-store-missing");
  const store = createFileDelegationHistoryStore({ basePath: TEST_PATH });
  const result = await store.load("nonexistent");
  assert.equal(result, undefined);
});
