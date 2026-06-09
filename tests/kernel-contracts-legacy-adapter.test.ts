import test from "node:test";
import assert from "node:assert/strict";
import {
  createLegacyCompatibilityEvent,
  legacyRoutingDecisionToPolicyDecision,
  legacyTaskAndRoutingToRunSeed,
  legacyTaskEnvelopeToKernelTask
} from "../packages/kernel-contracts/src/index.js";
import type {
  ExecutionProfileName,
  ModelId,
  ReasoningEffort,
  RiskLevel,
  RoutingDecisionInput,
  TaskClass,
  TaskEnvelopeInput,
  ToolAccessLevel
} from "../packages/contracts/src/index.js";

const now = "2026-06-04T00:00:00.000Z";

type LegacyScenario = {
  taskClass: TaskClass;
  riskLevel: RiskLevel;
  model: ModelId;
  toolAccess: ToolAccessLevel;
  profile: ExecutionProfileName;
  reasoningEffort: ReasoningEffort;
  approvalRequired: boolean;
  hostRoute: "desktop" | "codex-cli";
  expectedRisk: "low" | "medium" | "high" | "critical";
};

const scenarios: LegacyScenario[] = [
  {
    taskClass: "read_only",
    riskLevel: "low",
    model: "gpt-5.4-mini",
    toolAccess: "read_only",
    profile: "recon-only",
    reasoningEffort: "low",
    approvalRequired: false,
    hostRoute: "desktop",
    expectedRisk: "low"
  },
  {
    taskClass: "small_edit",
    riskLevel: "medium",
    model: "gpt-5.4-mini",
    toolAccess: "local_write",
    profile: "clarify-then-plan",
    reasoningEffort: "medium",
    approvalRequired: false,
    hostRoute: "codex-cli",
    expectedRisk: "medium"
  },
  {
    taskClass: "engineering",
    riskLevel: "medium",
    model: "gpt-5.3-codex",
    toolAccess: "engineering_write",
    profile: "engineering",
    reasoningEffort: "medium",
    approvalRequired: false,
    hostRoute: "desktop",
    expectedRisk: "medium"
  },
  {
    taskClass: "high_risk",
    riskLevel: "high",
    model: "gpt-5.4",
    toolAccess: "engineering_write",
    profile: "high-risk-change",
    reasoningEffort: "high",
    approvalRequired: true,
    hostRoute: "codex-cli",
    expectedRisk: "high"
  },
  {
    taskClass: "release_external_action",
    riskLevel: "high",
    model: "gpt-5.1-codex-max",
    toolAccess: "protected_remote",
    profile: "release-governance",
    reasoningEffort: "high",
    approvalRequired: true,
    hostRoute: "codex-cli",
    expectedRisk: "critical"
  }
];

test("legacy adapter maps each legacy task class into kernel Task and PolicyDecision", () => {
  for (const scenario of scenarios) {
    const taskEnvelope = createTaskEnvelope(scenario.taskClass);
    const decisionInput = createRoutingDecision(taskEnvelope.taskId, scenario);

    const task = legacyTaskEnvelopeToKernelTask(taskEnvelope, { createdAt: now });
    const decision = legacyRoutingDecisionToPolicyDecision(decisionInput, {
      createdAt: now
    });

    assert.equal(task.taskId, taskEnvelope.taskId);
    assert.equal(task.source, taskEnvelope.source);
    assert.deepEqual(task.intent, taskEnvelope.intent);
    assert.equal(task.workspace?.root, taskEnvelope.repoContext?.repoRoot);
    assert.equal(task.workspace?.branch, taskEnvelope.repoContext?.branch);
    assert.deepEqual(task.constraints, taskEnvelope.constraints);
    assert.deepEqual(task.metadata?.legacyHints, taskEnvelope.hints);
    assert.equal(task.metadata?.legacySource, taskEnvelope.source);
    assert.deepEqual(task.metadata?.legacy?.intent, taskEnvelope.intent);
    assert.deepEqual(task.metadata?.legacy?.repoContext, taskEnvelope.repoContext);

    assert.equal(decision.decisionId, decisionInput.decisionId);
    assert.equal(decision.taskId, taskEnvelope.taskId);
    assert.deepEqual(decision.classification, decisionInput.classification);
    assert.equal(decision.risk.level, scenario.expectedRisk);
    assert.equal(decision.execution.model, scenario.model);
    assert.equal(decision.execution.profile, scenario.profile);
    assert.equal(decision.execution.reasoningEffort, scenario.reasoningEffort);
    assert.equal(decision.approval.required, scenario.approvalRequired);
    assert.deepEqual(decision.approval.reasons, decisionInput.approval.reasons);
    assert.equal(decision.hostRoute, scenario.hostRoute);
    assert.deepEqual(decision.metadata?.legacy?.execution, decisionInput.execution);
    assert.equal(decision.legacy.routingDecisionId, decisionInput.decisionId);
    assert.equal(decision.legacy.taskClass, scenario.taskClass);
    assert.equal(decision.legacy.toolAccess, scenario.toolAccess);
  }
});

test("legacy adapter maps read_only tasks to read-only capability and sandbox", () => {
  const taskEnvelope = createTaskEnvelope("read_only");
  const decision = legacyRoutingDecisionToPolicyDecision(
    createRoutingDecision(taskEnvelope.taskId, scenarios[0]!),
    { createdAt: now }
  );

  assert.equal(decision.execution.sandbox.mode, "read-only");
  assert.equal(decision.execution.sandbox.networkAccess, "none");
  assert.equal(decision.capabilities.length, 1);
  assert.equal(decision.capabilities[0]?.kind, "file");
  assert.equal(decision.capabilities[0]?.access, "read");
});

test("legacy adapter maps write and release tool access into scoped kernel capabilities", () => {
  const smallEdit = legacyRoutingDecisionToPolicyDecision(
    createRoutingDecision("task-small-edit", scenarios[1]!),
    { createdAt: now }
  );
  const engineering = legacyRoutingDecisionToPolicyDecision(
    createRoutingDecision("task-engineering", scenarios[2]!),
    { createdAt: now }
  );
  const release = legacyRoutingDecisionToPolicyDecision(
    createRoutingDecision("task-release", scenarios[4]!),
    { createdAt: now }
  );

  assert.equal(smallEdit.execution.sandbox.mode, "workspace-write");
  assert.ok(smallEdit.capabilities.some((scope) => (
    scope.kind === "file" && scope.access === "write"
  )));
  assert.ok(engineering.capabilities.some((scope) => (
    scope.kind === "file"
    && scope.resource === "workspace/**"
    && scope.access === "read"
  )));
  assert.ok(engineering.capabilities.some((scope) => (
    scope.kind === "file"
    && scope.resource === "workspace/**"
    && scope.access === "write"
  )));
  assert.ok(engineering.capabilities.some((scope) => (
    scope.kind === "tool"
    && scope.resource === "apply_patch"
    && scope.access === "execute"
  )));
  assert.equal(release.capabilities[0]?.kind, "external");
  assert.equal(release.capabilities[0]?.resource, "protected_remote");
  assert.equal(release.capabilities[0]?.access, "write");
});

test("legacy adapter creates run seeds from matching legacy task and routing decision", () => {
  const taskEnvelope = createTaskEnvelope("high_risk");
  const decisionInput = createRoutingDecision(taskEnvelope.taskId, scenarios[3]!);

  const run = legacyTaskAndRoutingToRunSeed(taskEnvelope, decisionInput, {
    createdAt: now,
    runId: "run_legacy_high_risk_001"
  });

  assert.equal(run.runId, "run_legacy_high_risk_001");
  assert.equal(run.taskId, taskEnvelope.taskId);
  assert.equal(run.policyDecisionId, decisionInput.decisionId);
  assert.equal(run.status, "blocked");
  assert.deepEqual(run.metadata?.legacy?.taskEnvelope, {
    schemaVersion: "task-envelope.v1",
    ...taskEnvelope
  });
  assert.equal(
    (run.metadata?.legacy?.routingDecision as { decisionId?: string }).decisionId,
    decisionInput.decisionId
  );
});

test("legacy adapter creates compatibility events with preserved legacy payloads", () => {
  const taskEnvelope = createTaskEnvelope("engineering");
  const decisionInput = createRoutingDecision(taskEnvelope.taskId, scenarios[2]!);

  const event = createLegacyCompatibilityEvent({
    taskEnvelope,
    routingDecision: decisionInput,
    eventId: "event_legacy_compatibility_001",
    createdAt: now,
    payload: { fixture: "legacy_adapter" }
  });

  assert.equal(event.schemaVersion, "kernel-event.v1");
  assert.equal(event.eventId, "event_legacy_compatibility_001");
  assert.equal(event.eventType, "kernel.legacy.compatibility_mapped");
  assert.equal(event.taskId, taskEnvelope.taskId);
  assert.equal(event.payload.fixture, "legacy_adapter");
  assert.equal(
    (event.payload.legacy as { routingDecision?: { decisionId?: string } })
      .routingDecision?.decisionId,
    decisionInput.decisionId
  );
});

test("legacy adapter maps task envelopes when optional fields are omitted", () => {
  const task = legacyTaskEnvelopeToKernelTask({
    taskId: "task_missing_optional_001",
    intent: {
      summary: "Minimal task",
      requestedAction: "Map minimal legacy task"
    }
  }, { createdAt: now });

  assert.equal(task.taskId, "task_missing_optional_001");
  assert.equal(task.source, "desktop-thread");
  assert.equal(task.metadata?.legacySource, "desktop-thread");
  assert.deepEqual(task.intent?.successCriteria, []);
  assert.deepEqual(task.target.files, []);
  assert.deepEqual(task.constraints, {});
  assert.deepEqual(task.metadata?.legacyHints, { riskHints: [], tags: [] });
});

test("legacy adapter rejects malformed legacy inputs and mismatched task ids", () => {
  assert.throws(
    () => legacyTaskEnvelopeToKernelTask({
      taskId: "",
      intent: {
        summary: "Invalid",
        requestedAction: "Invalid"
      }
    }),
    /String must contain at least 1/
  );

  assert.throws(
    () => legacyRoutingDecisionToPolicyDecision({
      decisionId: "decision_invalid_001",
      taskId: "task_invalid_001",
      policyVersion: "policy.v1",
      classification: {
        taskClass: "read_only",
        riskLevel: "low",
        ambiguityScore: 2,
        clarificationRequired: false,
        riskFactors: []
      },
      execution: {
        selectedModel: "gpt-5.4-mini",
        toolAccess: "read_only",
        executionProfile: "recon-only",
        reasoningEffort: "low"
      },
      approval: {
        required: false,
        reasons: []
      },
      parallelism: {
        allowed: false,
        maxAgents: 1,
        mode: "disabled"
      }
    }),
    /Number must be less than or equal to 1/
  );

  assert.throws(
    () => legacyTaskAndRoutingToRunSeed(
      createTaskEnvelope("read_only"),
      createRoutingDecision("different_task_001", scenarios[0]!)
    ),
    /legacy taskId mismatch/
  );
});

function createTaskEnvelope(taskClass: TaskClass): TaskEnvelopeInput {
  return {
    taskId: `task_${taskClass}_001`,
    source: taskClass === "read_only" ? "desktop-thread" : "cli",
    intent: {
      summary: `${taskClass} legacy task`,
      requestedAction: `Map ${taskClass} through the legacy adapter`,
      successCriteria: [`${taskClass} task maps`],
      outOfScope: ["real external side effects"]
    },
    repoContext: {
      repoRoot: "A:/codex-router",
      branch: "codex/agent-os-kernel-phase-0-1",
      worktreeClean: true,
      protectedBranch: taskClass === "release_external_action"
    },
    target: {
      branches: taskClass === "release_external_action" ? ["main"] : [],
      files: ["packages/kernel-contracts/src/legacy-adapter.ts"],
      modules: ["kernel-contracts"]
    },
    constraints: {
      requiresNetwork: taskClass === "release_external_action",
      explicitOwnership: true,
      allowBackgroundAutomation: false
    },
    hints: {
      taskClassHint: taskClass,
      riskHints: [`risk_${taskClass}`],
      tags: ["legacy_adapter", taskClass]
    }
  };
}

function createRoutingDecision(
  taskId: string,
  scenario: LegacyScenario
): RoutingDecisionInput {
  return {
    decisionId: `decision_${scenario.taskClass}_001`,
    taskId,
    policyVersion: "policy.v1",
    classification: {
      taskClass: scenario.taskClass,
      riskLevel: scenario.riskLevel,
      ambiguityScore: scenario.taskClass === "read_only" ? 0 : 0.35,
      clarificationRequired: scenario.taskClass === "high_risk",
      riskFactors: [`factor_${scenario.taskClass}`]
    },
    execution: {
      selectedModel: scenario.model,
      toolAccess: scenario.toolAccess,
      executionProfile: scenario.profile,
      reasoningEffort: scenario.reasoningEffort
    },
    approval: {
      required: scenario.approvalRequired,
      reasons: scenario.approvalRequired ? [`approval_${scenario.taskClass}`] : []
    },
    parallelism: {
      allowed: scenario.taskClass === "read_only",
      maxAgents: scenario.taskClass === "read_only" ? 2 : 1,
      mode: scenario.taskClass === "read_only" ? "read_only" : "disabled"
    },
    hostRoute: scenario.hostRoute
  };
}
