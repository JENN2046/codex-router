import test from "node:test";
import assert from "node:assert/strict";
import {
  createApprovalPermit,
  hashApprovalScope
} from "../packages/approval-permit/src/index.js";
import {
  evaluateExecutionEligibility
} from "../packages/execution-eligibility/src/index.js";
import {
  PolicyDecisionSchema,
  RunSchema,
  TaskSchema,
  type ApprovalPermit,
  type CapabilityGrant,
  type PolicyDecision,
  type Principal,
  type Task
} from "../packages/kernel-contracts/src/index.js";
import { validPolicyDecision } from "../packages/kernel-contracts/test-fixtures/valid-policy-decision.js";
import { validPrincipal } from "../packages/kernel-contracts/test-fixtures/valid-principal.js";
import { validRun } from "../packages/kernel-contracts/test-fixtures/valid-run.js";
import { validTask } from "../packages/kernel-contracts/test-fixtures/valid-task.js";

const now = "2026-06-04T00:10:00.000Z";
const planHash = "plan_hash_execution_001";
const readScope = "fs.read:/repo/README.md";
const writeScope = "fs.write:/repo/docs/phase-1.md";
const destructiveScope = "fs.write:/repo/prod/config.yml";
const externalWriteScope = "external.write:protected_remote";

test("execution eligibility accepts read-only work when capability is granted", () => {
  const input = createInput({
    requestedScopes: [readScope],
    capabilityGrants: ["fs.read:/repo/**"]
  });

  const decision = evaluateExecutionEligibility(input);

  assert.equal(decision.status, "eligible");
  assert.equal(decision.taskId, validTask.taskId);
  assert.equal(decision.runId, validRun.runId);
  assert.equal(decision.policyDecisionHash, hashApprovalScope(input.policyDecision));
  assert.deepEqual(decision.reasons, ["capability_grants_satisfied"]);
  assert.deepEqual(decision.missingCapabilities, []);
});

test("execution eligibility blocks when policy is blocked", () => {
  const decision = evaluateExecutionEligibility(createInput({
    policyDecision: {
      ...createPolicyDecision(),
      status: "blocked"
    },
    requestedScopes: [readScope],
    capabilityGrants: ["fs.read:/repo/**"]
  }));

  assert.equal(decision.status, "blocked");
  assert.ok(decision.reasons.includes("admission_rejected"));
  assert.ok(decision.reasons.includes("policy_decision_blocked"));
});

test("execution eligibility blocks when policy requires clarification", () => {
  const policyDecision = createPolicyDecision({
    risk: {
      level: "low",
      factors: [],
      ambiguityScore: 0.8,
      clarificationRequired: true
    }
  });

  const decision = evaluateExecutionEligibility(createInput({
    policyDecision,
    requestedScopes: [readScope],
    capabilityGrants: ["fs.read:/repo/**"]
  }));

  assert.equal(decision.status, "blocked");
  assert.ok(decision.reasons.includes("admission_needs_clarification"));
  assert.ok(decision.reasons.includes("policy_decision_requires_clarification"));
  assert.deepEqual(decision.missingCapabilities, []);
});

test("execution eligibility waits for approval when capability is missing", () => {
  const decision = evaluateExecutionEligibility(createInput({
    requestedScopes: [writeScope],
    capabilityGrants: []
  }));

  assert.equal(decision.status, "waiting_approval");
  assert.ok(decision.reasons.includes("missing_capability"));
  assert.deepEqual(decision.missingCapabilities, [writeScope]);
  assert.ok(decision.requiredApprovals.includes(`approval:${writeScope}`));
});

test("execution eligibility accepts external capabilities when granted", () => {
  const decision = evaluateExecutionEligibility(createInput({
    requestedScopes: [externalWriteScope],
    capabilityGrants: ["external.write:protected_remote"]
  }));

  assert.equal(decision.status, "eligible");
  assert.deepEqual(decision.reasons, ["capability_grants_satisfied"]);
  assert.deepEqual(decision.missingCapabilities, []);
});

test("execution eligibility blocks explicit deny capability decisions", () => {
  const decision = evaluateExecutionEligibility(createInput({
    requestedScopes: [writeScope],
    capabilityGrants: [
      "fs.write:/repo/docs/**",
      "fs.write:deny"
    ]
  }));

  assert.equal(decision.status, "blocked");
  assert.ok(decision.reasons.includes("capability_deny"));
  assert.deepEqual(decision.missingCapabilities, [writeScope]);
});

test("execution eligibility accepts valid approval permits", () => {
  const policyDecision = createPolicyDecision();
  const permit = createPermit(policyDecision, {
    capabilityScopes: ["fs.write:/repo/docs/**"]
  });

  const decision = evaluateExecutionEligibility(createInput({
    policyDecision,
    requestedScopes: [writeScope],
    capabilityGrants: [],
    approvalPermits: [permit]
  }));

  assert.equal(decision.status, "eligible");
  assert.deepEqual(decision.reasons, ["valid_approval_permit"]);
  assert.deepEqual(decision.acceptedPermits, [permit.permitId]);
  assert.deepEqual(decision.rejectedPermits, []);
});

test("execution eligibility checks policy-required scopes when caller underreports requested scopes", () => {
  const policyDecision = createPolicyDecision({
    capabilities: [{
      schemaVersion: "capability-scope.v1",
      kind: "file",
      resource: "/repo/docs/**",
      access: "write",
      constraints: {}
    }]
  });
  const unrelatedPermit = createPermit(policyDecision, {
    capabilityScopes: ["fs.write:/repo/other/**"]
  });

  const decision = evaluateExecutionEligibility(createInput({
    policyDecision,
    requestedScopes: [],
    capabilityGrants: [],
    approvalPermits: [unrelatedPermit]
  }));

  assert.equal(decision.status, "waiting_approval");
  assert.ok(decision.reasons.includes("missing_capability"));
  assert.deepEqual(decision.missingCapabilities, ["fs.write:/repo/docs/**"]);
  assert.ok(decision.requiredApprovals.includes("approval:fs.write:/repo/docs/**"));
  assert.deepEqual(decision.acceptedPermits, []);
  assert.ok(decision.rejectedPermits[0]?.includes("missing_capability_scope"));
});

test("execution eligibility does not require approval when grants satisfy policy scopes", () => {
  const policyDecision = createPolicyDecision({
    capabilities: [{
      schemaVersion: "capability-scope.v1",
      kind: "file",
      resource: "/repo/docs/**",
      access: "write",
      constraints: {}
    }]
  });

  const decision = evaluateExecutionEligibility(createInput({
    policyDecision,
    requestedScopes: [],
    capabilityGrants: ["fs.write:/repo/docs/**"],
    approvalPermits: []
  }));

  assert.equal(decision.status, "eligible");
  assert.deepEqual(decision.reasons, ["capability_grants_satisfied"]);
  assert.deepEqual(decision.missingCapabilities, []);
  assert.deepEqual(decision.requiredApprovals, []);
});

test("execution eligibility waits for approval when capability clock is invalid", () => {
  const decision = evaluateExecutionEligibility(createInput({
    requestedScopes: [writeScope],
    capabilityGrants: [{
      scope: "fs.write:/repo/docs/**",
      expiresAt: "2026-06-04T01:00:00.000Z"
    }],
    now: "not-a-timestamp"
  }));

  assert.equal(decision.status, "waiting_approval");
  assert.ok(decision.reasons.includes("invalid_capability_check_now:not-a-timestamp"));
  assert.deepEqual(decision.missingCapabilities, [writeScope]);
});

test("execution eligibility waits for approval when permit is expired", () => {
  const policyDecision = createPolicyDecision();
  const permit = createPermit(policyDecision, {
    capabilityScopes: ["fs.write:/repo/docs/**"],
    expiresAt: "2026-06-04T00:05:00.000Z"
  });

  const decision = evaluateExecutionEligibility(createInput({
    policyDecision,
    requestedScopes: [writeScope],
    capabilityGrants: [],
    approvalPermits: [permit]
  }));

  assert.equal(decision.status, "waiting_approval");
  assert.deepEqual(decision.acceptedPermits, []);
  assert.ok(decision.rejectedPermits[0]?.includes("permit_expired"));
});

test("execution eligibility waits for approval when permit plan hash mismatches", () => {
  const policyDecision = createPolicyDecision();
  const permit = createPermit(policyDecision, {
    planHash: "old_plan_hash",
    capabilityScopes: ["fs.write:/repo/docs/**"]
  });

  const decision = evaluateExecutionEligibility(createInput({
    policyDecision,
    requestedScopes: [writeScope],
    capabilityGrants: [],
    approvalPermits: [permit]
  }));

  assert.equal(decision.status, "waiting_approval");
  assert.ok(decision.rejectedPermits[0]?.includes("plan_hash_mismatch"));
});

test("execution eligibility waits for approval for destructive tasks without permit", () => {
  const task = createTask({
    requestedAction: "Modify production config with a destructive rollout step.",
    hints: {
      riskHints: ["destructive", "production"],
      tags: ["release"]
    }
  });
  const decision = evaluateExecutionEligibility(createInput({
    task,
    requestedScopes: [destructiveScope],
    capabilityGrants: ["fs.write:/repo/prod/**"]
  }));

  assert.equal(decision.status, "waiting_approval");
  assert.ok(decision.reasons.includes("approval_required"));
  assert.ok(decision.requiredApprovals.includes("approval:destructive"));
  assert.ok(decision.requiredApprovals.includes("approval:production"));
});

test("execution eligibility covers a complete Phase 1 kernel flow", () => {
  const task: Task = createTask({
    requestedAction: "Update Phase 1 docs after approval."
  });
  const principal: Principal = validPrincipal;
  const run = RunSchema.parse({
    ...validRun,
    taskId: task.taskId
  });
  const policyDecision = createPolicyDecision({
    taskId: task.taskId
  });
  const capabilityGrant: CapabilityGrant = {
    schemaVersion: "capability-grant.v1",
    grantId: "grant_execution_eligibility_flow_001",
    principalId: principal.principalId,
    taskId: task.taskId,
    runId: run.runId,
    scopes: [],
    issuedAt: "2026-06-04T00:00:00.000Z",
    expiresAt: "2026-06-04T01:00:00.000Z",
    reason: "phase_1_flow_fixture"
  };
  const approvalPermit: ApprovalPermit = createApprovalPermit({
    permitId: "permit_execution_eligibility_flow_001",
    taskId: task.taskId,
    runId: run.runId,
    principalId: principal.principalId,
    approverId: "principal_approver_001",
    policyDecisionHash: hashApprovalScope(policyDecision),
    planHash,
    capabilityScopes: ["fs.write:/repo/docs/**"],
    createdAt: "2026-06-04T00:00:00.000Z",
    expiresAt: "2026-06-04T01:00:00.000Z"
  });

  const eligibilityDecision = evaluateExecutionEligibility({
    task,
    run,
    principal,
    policyDecision,
    capabilityGrants: [{
      scope: "fs.write:/repo/docs/**",
      principalId: capabilityGrant.principalId,
      taskId: capabilityGrant.taskId!,
      runId: capabilityGrant.runId!,
      expiresAt: capabilityGrant.expiresAt!
    }],
    approvalPermits: [approvalPermit],
    requestedScopes: [writeScope],
    planHash,
    now
  });

  assert.equal(eligibilityDecision.status, "eligible");
  assert.equal(eligibilityDecision.taskId, task.taskId);
  assert.equal(eligibilityDecision.runId, run.runId);
  assert.deepEqual(eligibilityDecision.acceptedPermits, [approvalPermit.permitId]);
});

function createInput(overrides: Partial<{
  task: Task;
  run: ReturnType<typeof RunSchema.parse>;
  policyDecision: PolicyDecision & { status?: string; blocked?: boolean };
  requestedScopes: string[];
  capabilityGrants: Parameters<typeof evaluateExecutionEligibility>[0]["capabilityGrants"];
  approvalPermits: ApprovalPermit[];
  now: string;
}> = {}) {
  const task = overrides.task ?? createTask();
  const run = overrides.run ?? RunSchema.parse({
    ...validRun,
    taskId: task.taskId
  });
  const policyDecision = overrides.policyDecision ?? createPolicyDecision({
    taskId: task.taskId
  });

  return {
    task,
    run,
    principal: validPrincipal,
    policyDecision,
    capabilityGrants: overrides.capabilityGrants ?? [],
    approvalPermits: overrides.approvalPermits ?? [],
    requestedScopes: overrides.requestedScopes ?? [readScope],
    planHash,
    now: overrides.now ?? now
  };
}

function createTask(overrides: Partial<{
  requestedAction: string;
  hints: {
    riskHints?: string[];
    tags?: string[];
  };
}> = {}): Task {
  const requestedAction = overrides.requestedAction ?? "Read local repository files.";

  return TaskSchema.parse({
    ...validTask,
    repo: {
      root: "/repo"
    },
    requestedAction,
    intent: {
      summary: "Execution eligibility fixture task",
      requestedAction,
      successCriteria: ["eligibility decision is deterministic"],
      outOfScope: []
    },
    hints: {
      taskClass: "read_only",
      riskHints: overrides.hints?.riskHints ?? [],
      tags: overrides.hints?.tags ?? []
    }
  });
}

function createPolicyDecision(
  overrides: Partial<PolicyDecision> = {}
): PolicyDecision {
  return PolicyDecisionSchema.parse({
    ...validPolicyDecision,
    taskId: validTask.taskId,
    capabilities: [],
    approval: {
      required: false,
      reasons: []
    },
    risk: {
      level: "low",
      factors: [],
      ambiguityScore: 0,
      clarificationRequired: false
    },
    ...overrides
  });
}

function createPermit(
  policyDecision: PolicyDecision,
  overrides: Partial<{
    planHash: string;
    capabilityScopes: string[];
    expiresAt: string;
  }> = {}
): ApprovalPermit {
  return createApprovalPermit({
    permitId: "permit_execution_eligibility_001",
    taskId: validTask.taskId,
    runId: validRun.runId,
    principalId: validPrincipal.principalId,
    approverId: "principal_approver_001",
    policyDecisionHash: hashApprovalScope(policyDecision),
    planHash: overrides.planHash ?? planHash,
    capabilityScopes: overrides.capabilityScopes ?? [writeScope],
    createdAt: "2026-06-04T00:00:00.000Z",
    expiresAt: overrides.expiresAt ?? "2026-06-04T01:00:00.000Z"
  });
}
