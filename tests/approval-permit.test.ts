import test from "node:test";
import assert from "node:assert/strict";
import {
  createApprovalPermit,
  hashApprovalScope,
  revokeApprovalPermit,
  validateApprovalPermit
} from "../packages/approval-permit/src/index.js";

const createdAt = "2026-06-04T00:00:00.000Z";
const now = "2026-06-04T00:10:00.000Z";
const expiresAt = "2026-06-04T01:00:00.000Z";

const baseInput = {
  permitId: "permit_approval_fixture_001",
  taskId: "task_approval_fixture_001",
  runId: "run_approval_fixture_001",
  principalId: "principal_requester_001",
  approverId: "principal_approver_001",
  policyDecisionHash: "policy_hash_001",
  planHash: "plan_hash_001",
  capabilityScopes: [
    "fs.write:/repo/docs/**",
    "shell.exec:pytest"
  ],
  createdAt,
  expiresAt,
  reason: "approve fixture plan"
};

test("approval permit validates a permit bound to task, run, principal, plan, policy, and scopes", () => {
  const permit = createApprovalPermit(baseInput);

  const result = validateApprovalPermit(permit, {
    taskId: baseInput.taskId,
    runId: baseInput.runId,
    principalId: baseInput.principalId,
    policyDecisionHash: baseInput.policyDecisionHash,
    planHash: baseInput.planHash,
    requestedCapabilityScopes: [
      "fs.write:/repo/docs/phase-1.md",
      "shell.exec:pytest"
    ],
    now
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.reasons, []);
  assert.deepEqual(result.missingCapabilityScopes, []);
  assert.deepEqual(result.matchedCapabilityScopes, [
    "fs.write:/repo/docs/phase-1.md",
    "shell.exec:pytest"
  ]);
  assert.equal(permit.principalId, baseInput.principalId);
  assert.equal(permit.approverId, baseInput.approverId);
  assert.equal(permit.policyDecisionHash, baseInput.policyDecisionHash);
  assert.deepEqual(permit.capabilityScopes, baseInput.capabilityScopes);
});

test("approval permit rejects expired permits", () => {
  const permit = createApprovalPermit({
    ...baseInput,
    expiresAt: "2026-06-04T00:05:00.000Z"
  });

  const result = validateApprovalPermit(permit, createContext());

  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("permit_expired"));
});

test("approval permit rejects revoked permits", () => {
  const permit = revokeApprovalPermit(
    createApprovalPermit(baseInput),
    "2026-06-04T00:06:00.000Z",
    "operator revoked plan approval"
  );

  const result = validateApprovalPermit(permit, createContext());

  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("permit_revoked"));
  assert.equal(permit.revokedReason, "operator revoked plan approval");
});

test("approval permit rejects planHash mismatches", () => {
  const result = validateApprovalPermit(createApprovalPermit(baseInput), {
    ...createContext(),
    planHash: "changed_plan_hash"
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.reasons, ["plan_hash_mismatch"]);
});

test("approval permit rejects policyDecisionHash mismatches", () => {
  const result = validateApprovalPermit(createApprovalPermit(baseInput), {
    ...createContext(),
    policyDecisionHash: "changed_policy_hash"
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.reasons, ["policy_decision_hash_mismatch"]);
});

test("approval permit rejects missing requested capability scopes", () => {
  const result = validateApprovalPermit(createApprovalPermit(baseInput), {
    ...createContext(),
    requestedCapabilityScopes: [
      "fs.write:/repo/docs/phase-1.md",
      "network.egress:api.github.com"
    ]
  });

  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("missing_capability_scope"));
  assert.deepEqual(result.missingCapabilityScopes, ["network.egress:api.github.com"]);
});

test("approval permit accepts when extra permitted capabilities are unused", () => {
  const permit = createApprovalPermit({
    ...baseInput,
    capabilityScopes: [
      ...baseInput.capabilityScopes,
      "network.egress:api.github.com"
    ]
  });

  const result = validateApprovalPermit(permit, {
    ...createContext(),
    requestedCapabilityScopes: ["shell.exec:pytest"]
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.missingCapabilityScopes, []);
  assert.deepEqual(result.matchedCapabilityScopes, ["shell.exec:pytest"]);
});

test("approval permit scope hash is stable across object key order", () => {
  const first = hashApprovalScope({
    taskId: "task_001",
    planHash: "plan_001",
    capabilityScopes: ["shell.exec:pytest", "fs.read:/repo/**"]
  });
  const second = hashApprovalScope({
    capabilityScopes: ["shell.exec:pytest", "fs.read:/repo/**"],
    planHash: "plan_001",
    taskId: "task_001"
  });

  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, second);
});

function createContext() {
  return {
    taskId: baseInput.taskId,
    runId: baseInput.runId,
    principalId: baseInput.principalId,
    policyDecisionHash: baseInput.policyDecisionHash,
    planHash: baseInput.planHash,
    requestedCapabilityScopes: [
      "fs.write:/repo/docs/phase-1.md",
      "shell.exec:pytest"
    ],
    now
  };
}
