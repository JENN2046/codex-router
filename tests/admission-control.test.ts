import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateTaskAdmission
} from "../packages/admission-control/src/index.js";
import {
  PolicyDecisionSchema,
  TaskSchema,
  type AgentManifest,
  type PolicyDecision,
  type Task
} from "../packages/kernel-contracts/src/index.js";
import { validAgentManifest } from "../packages/kernel-contracts/test-fixtures/valid-agent-manifest.js";
import { validPrincipal } from "../packages/kernel-contracts/test-fixtures/valid-principal.js";
import { validTask } from "../packages/kernel-contracts/test-fixtures/valid-task.js";

const now = "2026-06-04T12:00:00.000Z";

test("admission-control accepts read-only tasks by default", () => {
  const decision = evaluateTaskAdmission({
    task: createTask({
      requestedAction: "Read repository files and summarize findings.",
      hints: {
        riskHints: ["read_only"],
        tags: ["admission"]
      }
    }),
    principal: validPrincipal,
    now
  });

  assert.equal(decision.status, "accepted");
  assert.equal(decision.taskId, validTask.taskId);
  assert.equal(decision.principalId, validPrincipal.principalId);
  assert.deepEqual(decision.reasons, []);
  assert.deepEqual(decision.riskSignals, []);
  assert.equal(decision.requiredCapabilities[0]?.kind, "file");
  assert.equal(decision.requiredCapabilities[0]?.access, "read");
  assert.equal(decision.createdAt, now);
});

test("admission-control rejects missing principal", () => {
  const decision = evaluateTaskAdmission({
    task: createTask(),
    now
  });

  assert.equal(decision.status, "rejected");
  assert.equal(decision.principalId, "unknown_principal");
  assert.deepEqual(decision.reasons, ["missing_principal"]);
});

test("admission-control rejects tasks missing intent", () => {
  const decision = evaluateTaskAdmission({
    task: TaskSchema.parse(validTask),
    principal: validPrincipal,
    now
  });

  assert.equal(decision.status, "rejected");
  assert.deepEqual(decision.reasons, ["missing_task_intent"]);
});

test("admission-control requires approval for external side effects", () => {
  const decision = evaluateTaskAdmission({
    task: createTask({
      requestedAction: "Call an external remote service after preparing the change.",
      constraints: {
        requiresNetwork: true
      }
    }),
    principal: validPrincipal,
    now
  });

  assert.equal(decision.status, "needs_approval");
  assert.ok(decision.riskSignals.includes("external_side_effect"));
  assert.ok(decision.requiredApprovals.includes("approval:external_side_effect"));
  assert.ok(decision.requiredCapabilities.some((scope) => (
    scope.kind === "external" && scope.access === "write"
  )));
});

test("admission-control requires approval for destructive tasks", () => {
  const decision = evaluateTaskAdmission({
    task: createTask({
      requestedAction: "Delete generated files as a destructive cleanup step.",
      hints: {
        riskHints: ["destructive"],
        tags: ["cleanup"]
      }
    }),
    principal: validPrincipal,
    now
  });

  assert.equal(decision.status, "needs_approval");
  assert.ok(decision.riskSignals.includes("destructive"));
  assert.ok(decision.requiredApprovals.includes("approval:destructive"));
});

test("admission-control rejects blocked policy decisions", () => {
  const decision = evaluateTaskAdmission({
    task: createTask(),
    principal: validPrincipal,
    policyDecision: {
      ...createPolicyDecision(),
      status: "blocked"
    },
    now
  });

  assert.equal(decision.status, "rejected");
  assert.deepEqual(decision.reasons, ["policy_decision_blocked"]);
});

test("admission-control collects required capabilities from policy decisions", () => {
  const policyDecision = createPolicyDecision({
    capabilities: [
      {
        schemaVersion: "capability-scope.v1",
        kind: "file",
        resource: "workspace/packages/admission-control/**",
        access: "write",
        constraints: {}
      }
    ]
  });

  const decision = evaluateTaskAdmission({
    task: createTask({
      target: {
        files: ["packages/admission-control/src/index.ts"],
        modules: ["admission-control"]
      }
    }),
    principal: validPrincipal,
    agent: createAgentWithCapabilities([]),
    policyDecision,
    now
  });

  assert.equal(decision.status, "needs_approval");
  assert.deepEqual(decision.requiredCapabilities, policyDecision.capabilities);
  assert.ok(decision.requiredApprovals.includes(
    "capability:file:write:workspace/packages/admission-control/**"
  ));
});

test("admission-control does not match workspace wildcard outside workspace", () => {
  const policyDecision = createPolicyDecision({
    capabilities: [
      {
        schemaVersion: "capability-scope.v1",
        kind: "file",
        resource: "/tmp/**",
        access: "write",
        constraints: {}
      }
    ]
  });

  const decision = evaluateTaskAdmission({
    task: createTask(),
    principal: validPrincipal,
    agent: createAgentWithCapabilities([
      {
        schemaVersion: "capability-scope.v1",
        kind: "file",
        resource: "workspace/**",
        access: "write",
        constraints: {}
      }
    ]),
    policyDecision,
    now
  });

  assert.equal(decision.status, "needs_approval");
  assert.deepEqual(decision.reasons, ["missing_required_write_capability"]);
  assert.ok(decision.requiredApprovals.includes("capability:file:write:/tmp/**"));
});

test("admission-control handles missing read capabilities from agent manifests", () => {
  const policyDecision = createPolicyDecision({
    capabilities: [
      {
        schemaVersion: "capability-scope.v1",
        kind: "file",
        resource: "/tmp/**",
        access: "read",
        constraints: {}
      }
    ]
  });

  const decision = evaluateTaskAdmission({
    task: createTask(),
    principal: validPrincipal,
    agent: createAgentWithCapabilities([
      {
        schemaVersion: "capability-scope.v1",
        kind: "file",
        resource: "workspace/**",
        access: "read",
        constraints: {}
      }
    ]),
    policyDecision,
    now
  });

  assert.equal(decision.status, "needs_approval");
  assert.deepEqual(decision.reasons, ["missing_required_read_capability"]);
  assert.ok(decision.requiredApprovals.includes("capability:file:read:/tmp/**"));
});

test("admission-control preserves missing capability approvals when risk also requires approval", () => {
  const policyDecision = createPolicyDecision({
    capabilities: [
      {
        schemaVersion: "capability-scope.v1",
        kind: "file",
        resource: "/tmp/**",
        access: "read",
        constraints: {}
      }
    ],
    approval: {
      required: true,
      reasons: ["policy_high_risk_context"]
    }
  });

  const decision = evaluateTaskAdmission({
    task: createTask(),
    principal: validPrincipal,
    agent: createAgentWithCapabilities([
      {
        schemaVersion: "capability-scope.v1",
        kind: "file",
        resource: "workspace/**",
        access: "read",
        constraints: {}
      }
    ]),
    policyDecision,
    now
  });

  assert.equal(decision.status, "needs_approval");
  assert.deepEqual(decision.reasons, [
    "approval_required_by_task_risk",
    "missing_required_read_capability"
  ]);
  assert.ok(decision.requiredApprovals.includes("approval:policy_approval_required"));
  assert.ok(decision.requiredApprovals.includes("capability:file:read:/tmp/**"));
});

test("admission-control uses the fixed now parameter for createdAt", () => {
  const decision = evaluateTaskAdmission({
    task: createTask(),
    principal: validPrincipal,
    now
  });

  assert.equal(decision.createdAt, now);
});

function createTask(overrides: {
  requestedAction?: string;
  constraints?: Record<string, unknown>;
  hints?: {
    riskHints?: string[];
    tags?: string[];
  };
  target?: {
    files?: string[];
    modules?: string[];
  };
} = {}): Task {
  const requestedAction = overrides.requestedAction ?? "Read local repository context.";

  return TaskSchema.parse({
    ...validTask,
    requestedAction,
    intent: {
      summary: "Admission fixture task",
      requestedAction,
      successCriteria: ["Admission decision is deterministic"],
      outOfScope: ["real external side effects"]
    },
    constraints: overrides.constraints ?? {},
    hints: {
      taskClass: "read_only",
      riskHints: overrides.hints?.riskHints ?? [],
      tags: overrides.hints?.tags ?? []
    },
    target: {
      branches: [],
      files: overrides.target?.files ?? [],
      modules: overrides.target?.modules ?? []
    }
  });
}

function createPolicyDecision(overrides: Partial<PolicyDecision> = {}): PolicyDecision {
  return PolicyDecisionSchema.parse({
    decisionId: "decision_admission_fixture_001",
    taskId: validTask.taskId,
    policyVersion: "admission-test-policy",
    risk: {
      level: "low",
      factors: [],
      ambiguityScore: 0,
      clarificationRequired: false
    },
    execution: {
      executor: "codex-cli",
      model: "gpt-5.4-mini",
      profile: "recon-only",
      reasoningEffort: "low",
      sandbox: {
        sandboxId: "sandbox_admission_readonly_001",
        mode: "read-only"
      }
    },
    capabilities: [],
    approval: {
      required: false,
      reasons: []
    },
    parallelism: {
      allowed: false,
      maxAgents: 1,
      mode: "disabled"
    },
    createdAt: now,
    ...overrides
  });
}

function createAgentWithCapabilities(
  capabilities: AgentManifest["capabilities"]
): AgentManifest {
  return {
    ...validAgentManifest,
    capabilities
  };
}
