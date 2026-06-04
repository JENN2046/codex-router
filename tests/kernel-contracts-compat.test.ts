import test from "node:test";
import assert from "node:assert/strict";
import {
  createPolicyDecisionFromLegacyRoutingDecision,
  createTaskFromLegacyTaskEnvelope
} from "../packages/kernel-contracts/src/index.js";
import {
  parseRoutingDecision,
  parseTaskEnvelope
} from "../packages/contracts/src/index.js";

const now = "2026-06-04T00:00:00.000Z";

test("kernel compatibility maps legacy TaskEnvelope into kernel Task", () => {
  const legacyTask = parseTaskEnvelope({
    taskId: "legacy-task-1",
    source: "cli",
    intent: {
      summary: "Review project",
      requestedAction: "Inspect repository state and summarize findings",
      successCriteria: ["Report branch", "Report validation"],
      outOfScope: ["Remote writes"]
    },
    repoContext: {
      repoRoot: "A:/codex-router",
      branch: "main",
      worktreeClean: true,
      protectedBranch: false
    },
    target: {
      branches: ["main"],
      files: ["package.json"],
      modules: ["contracts"]
    },
    constraints: {
      requiresNetwork: false,
      explicitOwnership: true
    },
    hints: {
      taskClassHint: "read_only",
      riskHints: ["low"],
      tags: ["compat"]
    }
  });

  const task = createTaskFromLegacyTaskEnvelope(legacyTask, { createdAt: now });

  assert.equal(task.schemaVersion, "kernel-task.v1");
  assert.equal(task.taskId, legacyTask.taskId);
  assert.equal(task.source, "cli");
  assert.equal(task.title, legacyTask.intent.summary);
  assert.equal(task.requestedAction, legacyTask.intent.requestedAction);
  assert.deepEqual(task.successCriteria, legacyTask.intent.successCriteria);
  assert.deepEqual(task.outOfScope, legacyTask.intent.outOfScope);
  assert.equal(task.repo.root, "A:/codex-router");
  assert.equal(task.repo.branch, "main");
  assert.deepEqual(task.target.files, ["package.json"]);
  assert.equal(task.hints.taskClass, "read_only");
  assert.deepEqual(task.hints.tags, ["compat"]);
  assert.equal(task.constraints.requiresNetwork, false);
  assert.equal(task.createdAt, now);
});

test("kernel compatibility maps legacy read-only RoutingDecision into PolicyDecision", () => {
  const legacyDecision = parseRoutingDecision({
    decisionId: "decision-readonly",
    taskId: "legacy-task-1",
    policyVersion: "policy.v1",
    classification: {
      taskClass: "read_only",
      riskLevel: "low",
      ambiguityScore: 0.1,
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
      allowed: true,
      maxAgents: 2,
      mode: "read_only"
    },
    hostRoute: "codex-cli"
  });

  const decision = createPolicyDecisionFromLegacyRoutingDecision(legacyDecision, {
    createdAt: now
  });

  assert.equal(decision.schemaVersion, "policy-decision.v1");
  assert.equal(decision.decisionId, "decision-readonly");
  assert.equal(decision.taskId, "legacy-task-1");
  assert.equal(decision.risk.level, "low");
  assert.equal(decision.execution.executor, "codex-cli");
  assert.equal(decision.execution.model, "gpt-5.4-mini");
  assert.equal(decision.execution.sandbox.mode, "read-only");
  assert.equal(decision.capabilities.length, 1);
  assert.equal(decision.capabilities[0]?.kind, "file");
  assert.equal(decision.capabilities[0]?.access, "read");
  assert.equal(decision.approval.required, false);
  assert.equal(decision.parallelism.maxAgents, 2);
  assert.equal(decision.legacy.routingDecisionId, "decision-readonly");
  assert.equal(decision.legacy.toolAccess, "read_only");
});

test("kernel compatibility maps legacy write access into workspace sandbox and scopes", () => {
  const decision = createPolicyDecisionFromLegacyRoutingDecision({
    decisionId: "decision-write",
    taskId: "legacy-task-2",
    policyVersion: "policy.v1",
    classification: {
      taskClass: "engineering",
      riskLevel: "medium",
      ambiguityScore: 0.2,
      clarificationRequired: false,
      riskFactors: ["multi_file_change"]
    },
    execution: {
      selectedModel: "gpt-5.3-codex",
      toolAccess: "engineering_write",
      executionProfile: "engineering",
      reasoningEffort: "medium"
    },
    approval: {
      required: false,
      reasons: []
    },
    parallelism: {
      allowed: false,
      maxAgents: 1,
      mode: "disabled"
    },
    hostRoute: "desktop"
  }, { createdAt: now });

  assert.equal(decision.execution.executor, "codex-desktop");
  assert.equal(decision.execution.sandbox.mode, "workspace-write");
  assert.deepEqual(decision.execution.sandbox.writableRoots, ["workspace"]);
  assert.ok(decision.capabilities.some((scope) => (
    scope.kind === "tool"
    && scope.resource === "shell_command"
    && scope.access === "execute"
  )));
  assert.ok(decision.capabilities.some((scope) => (
    scope.kind === "tool"
    && scope.resource === "apply_patch"
    && scope.access === "execute"
  )));
  assert.equal(decision.legacy.taskClass, "engineering");
});

test("kernel compatibility elevates legacy release decisions to critical policy risk", () => {
  const decision = createPolicyDecisionFromLegacyRoutingDecision({
    decisionId: "decision-release",
    taskId: "legacy-task-3",
    policyVersion: "policy.v1",
    classification: {
      taskClass: "release_external_action",
      riskLevel: "high",
      ambiguityScore: 0.4,
      clarificationRequired: true,
      riskFactors: ["protected_branch", "external_side_effect"]
    },
    execution: {
      selectedModel: "gpt-5.1-codex-max",
      toolAccess: "protected_remote",
      executionProfile: "release-governance",
      reasoningEffort: "high"
    },
    approval: {
      required: true,
      reasons: ["protected branch"]
    },
    parallelism: {
      allowed: false,
      maxAgents: 1,
      mode: "disabled"
    },
    hostRoute: "codex-cli"
  }, { createdAt: now });

  assert.equal(decision.risk.level, "critical");
  assert.equal(decision.risk.clarificationRequired, true);
  assert.equal(decision.approval.required, true);
  assert.deepEqual(decision.approval.reasons, ["protected branch"]);
  assert.equal(decision.capabilities[0]?.kind, "external");
  assert.equal(decision.capabilities[0]?.resource, "protected_remote");
  assert.equal(decision.capabilities[0]?.access, "write");
});

test("kernel compatibility rejects malformed legacy payloads", () => {
  assert.throws(
    () => createTaskFromLegacyTaskEnvelope({
      taskId: "",
      intent: {
        summary: "bad",
        requestedAction: "bad"
      }
    }),
    /String must contain at least 1/
  );

  assert.throws(
    () => createPolicyDecisionFromLegacyRoutingDecision({
      decisionId: "decision-bad",
      taskId: "task-bad",
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
});

