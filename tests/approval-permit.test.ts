import test from "node:test";
import assert from "node:assert/strict";
import {
  createApprovalPermit,
  hashApprovalScope,
  revokeApprovalPermit,
  validateApprovalPermit
} from "../packages/approval-permit/src/index.js";
import {
  ApprovalPermitSchema
} from "../packages/kernel-contracts/src/index.js";

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

test("approval permit rejects malformed expiration timestamps", () => {
  const permit = createApprovalPermit({
    ...baseInput,
    expiresAt: "not-a-date"
  });

  const result = validateApprovalPermit(permit, createContext());

  assert.equal(result.valid, false);
  assert.deepEqual(result.reasons, ["invalid_permit_expires_at"]);
});

test("approval permit rejects malformed validation timestamps", () => {
  const result = validateApprovalPermit(createApprovalPermit(baseInput), {
    ...createContext(),
    now: "not-a-date"
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.reasons, ["invalid_validation_now"]);
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

test("approval permit accepts external capability scopes", () => {
  const permit = createApprovalPermit({
    ...baseInput,
    capabilityScopes: ["external.write:protected_remote"]
  });

  const result = validateApprovalPermit(permit, {
    ...createContext(),
    requestedCapabilityScopes: ["external.write:protected_remote"]
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.reasons, []);
  assert.deepEqual(result.missingCapabilityScopes, []);
  assert.deepEqual(result.matchedCapabilityScopes, ["external.write:protected_remote"]);
  assert.equal(permit.scopes[0]?.kind, "external");
  assert.equal(permit.scopes[0]?.access, "write");
});

test("approval permit maps typed scopes to canonical capability strings", () => {
  const permit = ApprovalPermitSchema.parse({
    schemaVersion: "approval-permit.v1",
    permitId: baseInput.permitId,
    taskId: baseInput.taskId,
    runId: baseInput.runId,
    principalId: baseInput.principalId,
    approverId: baseInput.approverId,
    decisionHash: baseInput.policyDecisionHash,
    policyDecisionHash: baseInput.policyDecisionHash,
    planHash: baseInput.planHash,
    approvedBy: {
      principalId: baseInput.approverId,
      kind: "user",
      createdAt
    },
    scopes: [
      {
        schemaVersion: "capability-scope.v1",
        kind: "file",
        resource: "/repo/docs/**",
        access: "write",
        constraints: {}
      },
      {
        schemaVersion: "capability-scope.v1",
        kind: "tool",
        resource: "pytest",
        access: "execute",
        constraints: {}
      }
    ],
    capabilityScopes: [],
    issuedAt: createdAt,
    createdAt,
    expiresAt,
    reason: "legacy typed permit fixture"
  });

  const result = validateApprovalPermit(permit, createContext());

  assert.equal(result.valid, true);
  assert.deepEqual(result.reasons, []);
  assert.deepEqual(result.missingCapabilityScopes, []);
  assert.deepEqual(result.matchedCapabilityScopes, [
    "fs.write:/repo/docs/phase-1.md",
    "shell.exec:pytest"
  ]);
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

test("approval permit scope hash ignores undefined object fields", () => {
  const input = {
    taskId: "task_001",
    planHash: "plan_001",
    optionalDecisionHash: undefined,
    capabilityScopes: ["shell.exec:pytest", "fs.read:/repo/**"],
    nested: {
      present: true,
      omitted: undefined
    }
  };
  const roundTripped = JSON.parse(JSON.stringify(input));

  assert.equal(hashApprovalScope(input), hashApprovalScope(roundTripped));
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
