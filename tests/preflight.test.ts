import test from "node:test";
import assert from "node:assert/strict";
import { runPreflight } from "../packages/preflight/src/index.js";

test("preflight catches missing auth and tools", () => {
  const result = runPreflight({
    authAvailable: false,
    requiredTools: ["shell_command", "apply_patch"],
    availableTools: ["shell_command"],
    requestedToolAccess: "engineering_write"
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("auth_unavailable"));
  assert.ok(result.errors.includes("missing_tool:apply_patch"));
});

test("preflight warns on risky workspace state", () => {
  const result = runPreflight({
    authAvailable: true,
    requiredTools: [],
    availableTools: [],
    workspaceClean: false,
    protectedBranch: true,
    requestedToolAccess: "engineering_write"
  });

  assert.equal(result.ok, true);
  assert.ok(result.warnings.includes("workspace_dirty"));
  assert.ok(result.warnings.includes("protected_branch_active"));
});

test("preflight can require memory overview and surface memory health warnings", () => {
  const result = runPreflight({
    authAvailable: true,
    requiredTools: [],
    availableTools: [],
    requestedToolAccess: "read_only",
    memoryOverviewPolicyPack: "engineering",
    memoryExecutionGuidance: {
      memoryRequired: false,
      resumeExpected: true,
      telemetryMandatory: true,
      checkpointFrequency: "stage"
    },
    memoryOverview: {
      adapterStatus: {
        codexMcp: "enabled"
      },
      summary: {
        rejected: 2
      },
      shadowSync: {
        reconcileCount: 3
      },
      recall: {
        available: true,
        status: "active"
      }
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.memory.status, "degraded");
  assert.equal(result.memory.available, true);
  assert.equal(result.memory.policyPack, "engineering");
  assert.equal(result.memory.guidance?.resumeExpected, true);
  assert.equal(result.memory.guidance?.checkpointFrequency, "stage");
  assert.ok(result.warnings.includes("memory_recent_rejections:2"));
  assert.ok(result.warnings.includes("memory_shadow_reconcile_pending:3"));
});

test("preflight blocks when memory overview is required but unavailable", () => {
  const result = runPreflight({
    authAvailable: true,
    requiredTools: [],
    availableTools: [],
    requestedToolAccess: "read_only",
    memoryOverviewPolicyPack: "release",
    memoryExecutionGuidance: {
      memoryRequired: true,
      resumeExpected: true,
      telemetryMandatory: true,
      checkpointFrequency: "dense"
    },
    memoryOverviewPolicy: {
      overviewUnavailableSeverity: "block"
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.memory.status, "blocked");
  assert.equal(result.memory.available, false);
  assert.equal(result.memory.policyPack, "release");
  assert.equal(result.memory.guidance?.memoryRequired, true);
  assert.ok(result.errors.includes("memory_overview_unavailable"));
});

test("preflight can block on release policy pack thresholds", () => {
  const result = runPreflight({
    authAvailable: true,
    requiredTools: [],
    availableTools: [],
    requestedToolAccess: "read_only",
    memoryOverviewPolicyPack: "release",
    memoryOverviewPolicy: {
      codexMcpUnavailableSeverity: "block",
      maxRejectedWrites: 0,
      rejectedWritesSeverity: "block",
      maxShadowReconcileCount: 0,
      shadowReconcileSeverity: "block",
      recallUnavailableSeverity: "block",
      nonActiveRecallSeverity: "block"
    },
    memoryOverview: {
      adapterStatus: {
        codexMcp: "enabled"
      },
      summary: {
        rejected: 1
      },
      shadowSync: {
        reconcileCount: 1
      },
      recall: {
        available: false
      }
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.memory.status, "blocked");
  assert.deepEqual(result.memory.blockingIssues, [
    "memory_recent_rejections:1",
    "memory_shadow_reconcile_pending:1",
    "memory_recall_unavailable"
  ]);
});
