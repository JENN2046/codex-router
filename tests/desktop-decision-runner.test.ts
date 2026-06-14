import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadPolicyFromFile, resolveMemoryHealthPolicyPack } from "../packages/policy-config/src/index.js";
import { parseTaskEnvelope } from "../packages/contracts/src/index.js";
import {
  resumeDesktopDecision,
  runDesktopDecision
} from "../packages/desktop-decision-runner/src/index.js";

const policyPath = fileURLToPath(new URL("../routing-policy.yaml", import.meta.url));

test("desktop decision runner blocks on preflight failures", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const result = await runDesktopDecision({
    task: parseTaskEnvelope({
      taskId: "runner-preflight",
      source: "desktop-thread",
      intent: {
        summary: "implement package",
        requestedAction: "add multi-file TypeScript changes",
        successCriteria: [],
        outOfScope: []
      },
      repoContext: { repoRoot: "A:/codex-router" },
      target: { branches: [], files: ["packages/contracts/src/index.ts"], modules: [] },
      constraints: {},
      hints: { riskHints: [], tags: [] }
    }),
    policy,
    preflight: {
      authAvailable: false,
      availableTools: ["shell_command", "apply_patch", "read_thread_terminal", "send_input"]
    }
  });

  assert.equal(result.status, "blocked_preflight");
  assert.ok(result.blockingReasons.includes("auth_unavailable"));
  assert.equal(hasPrimitive(result.executionPlan, "shell_command"), false);
  assert.equal(hasPrimitive(result.executionPlan, "apply_patch"), false);
  assert.equal(result.auditEvents.at(-1)?.type, "runner_blocked");
  assert.equal(result.observabilityEvents[0]?.level, "error");
});

test("desktop decision runner blocks on approval after preflight passes", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const result = await runDesktopDecision({
    task: parseTaskEnvelope({
      taskId: "runner-approval",
      source: "desktop-thread",
      intent: {
        summary: "prepare release",
        requestedAction: "merge to prod/stable and push production config",
        successCriteria: [],
        outOfScope: []
      },
      repoContext: { repoRoot: "A:/codex-router", branch: "main" },
      target: { branches: ["prod/stable"], files: [], modules: [] },
      constraints: {},
      hints: { riskHints: [], tags: [] }
    }),
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal", "send_input", "shell_command", "apply_patch"],
      memoryOverview: {
        adapterStatus: {
          codexMcp: "enabled"
        },
        summary: {
          rejected: 0
        },
        shadowSync: {
          reconcileCount: 0
        },
        recall: {
          available: true,
          status: "active"
        }
      }
    }
  });

  assert.equal(result.status, "blocked_approval");
  assert.equal(result.approval.status, "pending");
  assert.equal(hasPrimitive(result.executionPlan, "shell_command"), false);
  assert.equal(hasPrimitive(result.executionPlan, "apply_patch"), false);
  assert.ok(result.blockingReasons.some((reason) => reason.includes("protected_branch")));
});

test("desktop decision runner returns ready execution package for safe read-only work", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const recordedCheckpoints: string[] = [];
  const recordedEvents: string[] = [];

  const result = await runDesktopDecision({
    task: parseTaskEnvelope({
      taskId: "runner-ready",
      source: "desktop-thread",
      intent: {
        summary: "review current config",
        requestedAction: "inspect and summarize the current config state",
        successCriteria: [],
        outOfScope: []
      },
      repoContext: { repoRoot: "A:/codex-router" },
      target: { branches: [], files: ["routing-policy.yaml"], modules: [] },
      constraints: {},
      hints: { riskHints: [], tags: [] }
    }),
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal", "spawn_agent", "wait_agent"],
      memoryOverviewPolicyPack: "local_write",
      memoryOverviewPolicy: {
        overviewUnavailableSeverity: "ignore",
        codexMcpUnavailableSeverity: "block",
        maxRejectedWrites: 0,
        rejectedWritesSeverity: "warn",
        maxShadowReconcileCount: 0,
        shadowReconcileSeverity: "warn",
        recallUnavailableSeverity: "warn",
        nonActiveRecallSeverity: "warn"
      }
    },
    availableAgents: 3,
    persistence: {
      checkpointStore: {
        async record(checkpoint) {
          recordedCheckpoints.push(checkpoint.stage);
        }
      },
      auditStore: {
        async record(event) {
          recordedEvents.push(event.type);
        }
      }
    },
    now: () => "2026-04-23T12:00:00.000Z"
  });

  assert.equal(result.status, "ready");
  assert.equal(result.executionPlan.primitives[1]?.primitive, "spawn_agent");
  assert.equal(result.agentStrategy.parallel, true);
  assert.equal(result.agentStrategy.maxAgents, 3);
  assert.deepEqual(recordedCheckpoints, ["ready-for-desktop-execution"]);
  assert.ok(recordedEvents.includes("runner_ready"));
  assert.equal(result.preflight.memory.status, "unavailable");
  assert.equal(result.preflight.memory.guidance?.checkpointFrequency, "standard");
  assert.equal(result.observabilityEvents[1]?.message, "memory preflight unavailable");
});

test("desktop decision runner respects neutral read-only hints without desktop write tools", async () => {
  const policy = await loadPolicyFromFile(policyPath);

  const result = await runDesktopDecision({
    task: parseTaskEnvelope({
      taskId: "runner-neutral-read-only-hint",
      source: "desktop-thread",
      intent: {
        summary: "Status update",
        requestedAction: "Show current state",
        successCriteria: [],
        outOfScope: []
      },
      repoContext: {},
      target: { branches: [], files: [], modules: [] },
      constraints: {},
      hints: {
        taskClassHint: "read_only",
        riskHints: [],
        tags: [],
        provenance: [{
          field: "taskClassHint",
          value: "read_only",
          source: "system"
        }]
      }
    }),
    policy,
    preflight: {
      authAvailable: true,
      availableTools: []
    }
  });

  assert.equal(result.decision.classification.taskClass, "read_only");
  assert.equal(result.decision.hostRoute, "codex-cli");
  assert.equal(result.decision.execution.toolAccess, "read_only");
  assert.equal(result.status, "ready");
  assert.equal(result.preflight.ok, true);
  assert.equal(result.preflight.errors.some((error) => error.startsWith("missing_tool:")), false);
  assert.equal(result.preflight.errors.includes("missing_tool:shell_command"), false);
  assert.equal(result.preflight.errors.includes("missing_tool:apply_patch"), false);
  assert.equal(hasPrimitive(result.executionPlan, "shell_command"), false);
  assert.equal(hasPrimitive(result.executionPlan, "apply_patch"), false);
});

test("desktop decision runner does not require desktop write tools for codex-cli small edits", async () => {
  const policy = await loadPolicyFromFile(policyPath);

  const result = await runDesktopDecision({
    task: parseTaskEnvelope({
      taskId: "runner-codex-cli-small-edit",
      source: "desktop-thread",
      intent: {
        summary: "apply a small fix",
        requestedAction: "make a small fix in a single file",
        successCriteria: [],
        outOfScope: []
      },
      repoContext: { repoRoot: "A:/codex-router" },
      target: { branches: [], files: ["README.md"], modules: [] },
      constraints: {},
      hints: { riskHints: [], tags: [] }
    }),
    policy,
    preflight: {
      authAvailable: true,
      availableTools: []
    }
  });

  assert.equal(result.decision.classification.taskClass, "small_edit");
  assert.equal(result.decision.hostRoute, "codex-cli");
  assert.equal(result.decision.execution.toolAccess, "local_write");
  assert.equal(result.status, "ready");
  assert.equal(result.preflight.ok, true);
  assert.equal(result.preflight.errors.some((error) => error.startsWith("missing_tool:")), false);
  assert.equal(result.preflight.errors.includes("missing_tool:shell_command"), false);
  assert.equal(result.preflight.errors.includes("missing_tool:apply_patch"), false);
  assert.equal(hasPrimitive(result.executionPlan, "shell_command"), false);
  assert.equal(hasPrimitive(result.executionPlan, "apply_patch"), false);
  assert.ok(result.executionPlan.notes.includes("plan_mode:candidate"));
});

test("desktop decision runner folds memory overview warnings into preflight", async () => {
  const policy = await loadPolicyFromFile(policyPath);

  const result = await runDesktopDecision({
    task: parseTaskEnvelope({
      taskId: "runner-memory-overview",
      source: "desktop-thread",
      intent: {
        summary: "review current config",
        requestedAction: "inspect and summarize the current config state",
        successCriteria: [],
        outOfScope: []
      },
      repoContext: { repoRoot: "A:/codex-router" },
      target: { branches: [], files: ["routing-policy.yaml"], modules: [] },
      constraints: {},
      hints: { riskHints: [], tags: [] }
    }),
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal", "spawn_agent", "wait_agent"],
      memoryOverviewPolicyPack: "engineering",
      memoryOverviewPolicy: {
        overviewUnavailableSeverity: "ignore",
        codexMcpUnavailableSeverity: "block",
        maxRejectedWrites: 0,
        rejectedWritesSeverity: "warn",
        maxShadowReconcileCount: 0,
        shadowReconcileSeverity: "warn",
        recallUnavailableSeverity: "warn",
        nonActiveRecallSeverity: "warn"
      }
    },
    persistence: {
      memoryOverviewProvider: {
        async memoryOverview() {
          return {
            adapterStatus: {
              codexMcp: "enabled"
            },
            summary: {
              rejected: 1
            },
            shadowSync: {
              reconcileCount: 2
            },
            recall: {
              available: true,
              status: "active"
            }
          };
        }
      }
    }
  });

  assert.equal(result.status, "ready");
  assert.equal(result.preflight.memory.status, "degraded");
  assert.equal(result.preflight.memory.policyPack, "engineering");
  assert.equal(result.preflight.memory.guidance?.telemetryMandatory, true);
  assert.ok(result.preflight.warnings.includes("memory_recent_rejections:1"));
  assert.ok(result.preflight.warnings.includes("memory_shadow_reconcile_pending:2"));
  assert.equal(result.observabilityEvents[0]?.level, "warn");
  assert.equal(result.observabilityEvents[1]?.level, "warn");
});

test("desktop decision runner uses release policy pack for protected remote tasks", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const result = await runDesktopDecision({
    task: parseTaskEnvelope({
      taskId: "runner-memory-release",
      source: "desktop-thread",
      intent: {
        summary: "prepare release merge",
        requestedAction: "merge to prod/stable and push production migration with secret changes",
        successCriteria: [],
        outOfScope: []
      },
      repoContext: { repoRoot: "A:/codex-router", branch: "main" },
      target: { branches: ["prod/stable"], files: ["routing-policy.yaml"], modules: [] },
      constraints: {},
      hints: { riskHints: [], tags: [] }
    }),
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal", "send_input", "shell_command", "apply_patch"]
    }
  });

  const releasePack = resolveMemoryHealthPolicyPack(policy, "protected_remote");

  assert.equal(releasePack.packName, "release");
  assert.equal(result.preflight.memory.policyPack, "release");
  assert.equal(result.preflight.memory.guidance?.memoryRequired, true);
  assert.equal(result.preflight.memory.guidance?.checkpointFrequency, "dense");
});

test("desktop decision runner degrades instead of blocking when engineering memory adapter is disabled", async () => {
  const policy = await loadPolicyFromFile(policyPath);

  const result = await runDesktopDecision({
    task: parseTaskEnvelope({
      taskId: "runner-memory-engineering-adapter-disabled",
      source: "desktop-thread",
      intent: {
        summary: "implement package",
        requestedAction: "add multi-file TypeScript changes",
        successCriteria: [],
        outOfScope: []
      },
      repoContext: { repoRoot: "A:/codex-router" },
      target: { branches: [], files: ["packages/contracts/src/index.ts"], modules: [] },
      constraints: {},
      hints: { riskHints: [], tags: [] }
    }),
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["shell_command", "apply_patch", "read_thread_terminal", "send_input"],
      memoryOverview: {
        adapterStatus: {
          codexMcp: "disabled"
        },
        summary: {
          rejected: 0
        },
        shadowSync: {
          reconcileCount: 0
        },
        recall: {
          available: true,
          status: "active"
        }
      }
    }
  });

  assert.equal(result.status, "ready");
  assert.equal(hasPrimitive(result.executionPlan, "shell_command"), true);
  assert.equal(hasPrimitive(result.executionPlan, "apply_patch"), true);
  assert.equal(result.preflight.memory.policyPack, "engineering");
  assert.equal(result.preflight.memory.status, "degraded");
  assert.ok(result.preflight.warnings.includes("memory_adapter_status:disabled"));
  assert.equal(result.preflight.memory.guidance?.telemetryMandatory, true);
});

test("resumeDesktopDecision restores from memory recall before running a fresh decision", async () => {
  const policy = await loadPolicyFromFile(policyPath);
  const recordedEvents: string[] = [];

  const result = await resumeDesktopDecision({
    task: parseTaskEnvelope({
      taskId: "runner-resume-memory",
      source: "desktop-thread",
      intent: {
        summary: "review current config",
        requestedAction: "inspect and summarize the current config state",
        successCriteria: [],
        outOfScope: []
      },
      repoContext: { repoRoot: "A:/codex-router" },
      target: { branches: [], files: ["routing-policy.yaml"], modules: [] },
      constraints: {},
      hints: { riskHints: [], tags: [] }
    }),
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal", "spawn_agent", "wait_agent"]
    },
    availableAgents: 2,
    resume: {
      memoryRecall: {
        async recallLatestCheckpointRef() {
          return {
            checkpointId: "memory-cp-1",
            taskId: "runner-resume-memory",
            stage: "approval-pending",
            createdAt: "2026-04-23T11:00:00.000Z",
            summary: "waiting for approval"
          };
        }
      },
      required: true
    },
    persistence: {
      auditStore: {
        async record(event) {
          recordedEvents.push(event.type);
        }
      }
    },
    now: () => "2026-04-23T12:00:00.000Z"
  });

  assert.equal(result.status, "ready");
  assert.equal(result.resumedFrom?.checkpointId, "memory-cp-1");
  assert.equal(result.resumeSource, "memory");
  assert.equal(result.auditEvents[0]?.type, "task_resumed");
  assert.ok(recordedEvents.includes("task_resumed"));
});

test("resumeDesktopDecision falls back to checkpoint store when memory recall misses", async () => {
  const policy = await loadPolicyFromFile(policyPath);

  const result = await resumeDesktopDecision({
    task: parseTaskEnvelope({
      taskId: "runner-resume-checkpoint",
      source: "desktop-thread",
      intent: {
        summary: "review current config",
        requestedAction: "inspect and summarize the current config state",
        successCriteria: [],
        outOfScope: []
      },
      repoContext: { repoRoot: "A:/codex-router" },
      target: { branches: [], files: ["routing-policy.yaml"], modules: [] },
      constraints: {},
      hints: { riskHints: [], tags: [] }
    }),
    policy,
    preflight: {
      authAvailable: true,
      availableTools: ["read_thread_terminal", "spawn_agent", "wait_agent"]
    },
    availableAgents: 2,
    resume: {
      memoryRecall: {
        async recallLatestCheckpointRef() {
          return undefined;
        }
      },
      checkpointStore: {
        async findLatestForTask(taskId) {
          assert.equal(taskId, "runner-resume-checkpoint");
          return {
            checkpointId: "file-cp-1",
            taskId,
            stage: "preflight-blocked",
            createdAt: "2026-04-23T11:30:00.000Z",
            summary: "missing auth before"
          };
        }
      }
    }
  });

  assert.equal(result.resumedFrom?.checkpointId, "file-cp-1");
  assert.equal(result.resumeSource, "checkpoint");
  assert.equal(result.auditEvents[0]?.type, "task_resumed");
});

function hasPrimitive(
  plan: { primitives: Array<{ primitive: string }> },
  primitive: string
): boolean {
  return plan.primitives.some((operation) => operation.primitive === primitive);
}
