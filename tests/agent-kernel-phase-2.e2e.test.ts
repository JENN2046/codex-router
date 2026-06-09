import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateTaskAdmission } from "../packages/admission-control/src/index.js";
import { FileSystemArtifactStore } from "../packages/artifact-store/src/index.js";
import {
  evaluateExecutionEligibility
} from "../packages/execution-eligibility/src/index.js";
import { InMemoryKernelStore } from "../packages/kernel-store/src/index.js";
import { createApprovalPermit, hashApprovalScope } from "../packages/approval-permit/src/index.js";
import {
  InMemoryScheduler
} from "../packages/scheduler/src/index.js";
import { RunManager } from "../packages/run-manager/src/index.js";
import {
  InMemoryToolRegistry,
  builtinReadFileToolManifest
} from "../packages/tool-registry/src/index.js";
import {
  planToolInvocation
} from "../packages/tool-invocation-planner/src/index.js";
import {
  CapabilityGrantSchema,
  PolicyDecisionSchema,
  PrincipalSchema,
  RunSchema,
  TaskSchema,
  type CapabilityGrant,
  type PolicyDecision,
  type Principal,
  type Run,
  type Task
} from "../packages/kernel-contracts/src/index.js";
import { validPolicyDecision } from "../packages/kernel-contracts/test-fixtures/valid-policy-decision.js";
import { validPrincipal } from "../packages/kernel-contracts/test-fixtures/valid-principal.js";
import { validRun } from "../packages/kernel-contracts/test-fixtures/valid-run.js";
import { validTask } from "../packages/kernel-contracts/test-fixtures/valid-task.js";

const timestamps = [
  "2026-06-04T00:00:00.000Z",
  "2026-06-04T00:00:01.000Z",
  "2026-06-04T00:00:02.000Z",
  "2026-06-04T00:00:03.000Z",
  "2026-06-04T00:00:04.000Z",
  "2026-06-04T00:00:05.000Z",
  "2026-06-04T00:00:06.000Z",
  "2026-06-04T00:00:07.000Z",
  "2026-06-04T00:00:08.000Z",
  "2026-06-04T00:00:09.000Z",
  "2026-06-04T00:00:10.000Z",
  "2026-06-04T00:00:11.000Z",
  "2026-06-04T00:00:12.000Z",
  "2026-06-04T00:00:13.000Z",
  "2026-06-04T00:00:14.000Z"
];

test("Agent OS Kernel Phase 2 local e2e flow completes without external side effects", async () => {
  const artifactDir = await mkdtemp(join(tmpdir(), "codex-router-agent-kernel-e2e-"));
  const clock = createFakeClock(timestamps);

  try {
    const principal = createPrincipal();
    const task = createTask(principal);
    const policyDecision = createPolicyDecision(task);
    const runSeed = createRunSeed(task, policyDecision);
    const readScope = "fs.read:/repo/**";
    const capabilityGrant = createCapabilityGrant(principal, task, runSeed, readScope);
    const planHash = "plan_hash_agent_kernel_phase_2_e2e_001";

    const admission = evaluateTaskAdmission({
      task,
      principal,
      policyDecision,
      now: clock.peek()
    });

    assert.equal(admission.status, "accepted", `admission failed: ${admission.reasons.join(",")}`);

    const eligibility = evaluateExecutionEligibility({
      task,
      run: runSeed,
      principal,
      policyDecision,
      capabilityGrants: [{
        scopes: [readScope],
        principalId: capabilityGrant.principalId,
        taskId: task.taskId,
        runId: runSeed.runId,
        expiresAt: "2026-06-04T01:00:00.000Z"
      }],
      approvalPermits: [],
      requestedScopes: [readScope],
      planHash,
      now: clock.peek()
    });

    assert.equal(
      eligibility.status,
      "eligible",
      `execution eligibility failed: ${eligibility.reasons.join(",")}`
    );

    const store = new InMemoryKernelStore();
    const runManager = new RunManager({
      store,
      now: clock.next
    });
    const scheduler = new InMemoryScheduler({
      clock: {
        now: clock.next
      },
      defaultLeaseDurationMs: 60_000,
      defaultMaxAttempts: 1
    });
    const artifactStore = new FileSystemArtifactStore({
      baseDir: artifactDir,
      now: clock.next
    });

    const createdRun = runManager.createRunFromTask(task, principal, {
      runId: runSeed.runId,
      policyDecisionId: policyDecision.decisionId
    });
    assert.equal(createdRun.status, "queued");

    const queued = scheduler.enqueueRun(createdRun.runId, {
      leaseDurationMs: 60_000,
      maxAttempts: 1
    });
    assert.equal(queued.status, "queued");

    const lease = scheduler.acquireLease("worker_agent_kernel_e2e_001");
    assert.ok(lease, "scheduler did not acquire a lease for the queued run");
    assert.equal(lease.runId, createdRun.runId);
    assert.equal(lease.status, "active");

    const runningRun = runManager.startRun(createdRun.runId);
    assert.equal(runningRun.status, "running");

    const step = runManager.createStep(createdRun.runId, {
      stepId: "step_agent_kernel_phase_2_e2e_001",
      kind: "tool",
      input: {
        toolId: "builtin.read_file"
      }
    });
    assert.equal(step.status, "pending");

    const registry = new InMemoryToolRegistry();
    const toolManifest = registry.registerTool(builtinReadFileToolManifest);
    assert.equal(registry.getTool("builtin.read_file")?.toolId, "builtin.read_file");

    const invocationPlan = planToolInvocation({
      run: runningRun,
      step,
      toolManifest,
      proposedInput: {
        path: "/repo/README.md",
        token: "fixture-token-value"
      },
      principal,
      capabilityGrants: [{
        scopes: [readScope],
        principalId: capabilityGrant.principalId,
        taskId: task.taskId,
        runId: runningRun.runId,
        expiresAt: "2026-06-04T01:00:00.000Z"
      }],
      approvalPermits: [
        createApprovalPermit({
          permitId: "permit_agent_kernel_phase_2_e2e_unused_001",
          taskId: task.taskId,
          runId: runningRun.runId,
          principalId: principal.principalId,
          approverId: "principal_approver_agent_kernel_e2e_001",
          policyDecisionHash: hashApprovalScope(policyDecision),
          planHash,
          capabilityScopes: [readScope],
          createdAt: "2026-06-04T00:00:00.000Z",
          expiresAt: "2026-06-04T01:00:00.000Z"
        })
      ],
      policyDecision,
      planHash,
      now: clock.peek()
    });

    assert.equal(
      invocationPlan.status,
      "planned",
      `tool invocation planning failed: ${invocationPlan.reasons.join(",")}`
    );
    assert.equal(JSON.stringify(invocationPlan).includes("fixture-token-value"), false);

    const runningStep = runManager.startStep(step.stepId);
    assert.equal(runningStep.status, "running");

    const completedStep = runManager.completeStep(step.stepId, {
      invocationId: invocationPlan.invocationId,
      simulated: true
    });
    assert.equal(completedStep.status, "succeeded");

    const artifact = await artifactStore.putArtifact({
      artifactId: "artifact_agent_kernel_phase_2_e2e_001",
      taskId: task.taskId,
      runId: runningRun.runId,
      type: "report",
      payload: {
        invocationId: invocationPlan.invocationId,
        result: "simulated read_file output",
        path: "/repo/README.md"
      },
      alreadyRedacted: true,
      provenance: {
        principalId: principal.principalId,
        toolId: toolManifest.toolId,
        invocationId: invocationPlan.invocationId,
        stepId: step.stepId,
        source: "agent-kernel-phase-2-e2e"
      }
    });
    assert.equal(artifact.runId, runningRun.runId);
    assert.match(artifact.sha256, /^[a-f0-9]{64}$/);

    const completedRun = runManager.completeRun(runningRun.runId, {
      artifactId: artifact.artifactId,
      leaseId: lease.leaseId
    });
    assert.equal(completedRun.status, "succeeded");

    const releasedLease = scheduler.releaseLease(lease.leaseId, {
      runStatus: completedRun.status
    });
    assert.equal(releasedLease.status, "released");

    const events = store.listEvents({ runId: runningRun.runId });
    assert.deepEqual(
      events.map((event) => event.eventType),
      [
        "kernel.run.created",
        "kernel.run.started",
        "kernel.step.created",
        "kernel.step.started",
        "kernel.step.completed",
        "kernel.run.completed"
      ],
      `unexpected event order: ${events.map((event) => event.eventType).join(",")}`
    );
    assert.ok(
      events.every((event, index) => (
        index === 0 || event.createdAt >= events[index - 1]!.createdAt
      )),
      `event timestamps are not monotonic: ${events.map((event) => event.createdAt).join(",")}`
    );

    const artifactVerification = await artifactStore.verifyArtifact(artifact.artifactId);
    assert.equal(
      artifactVerification.ok,
      true,
      `artifact verification failed: ${artifactVerification.reason ?? "unknown"}`
    );
  } finally {
    await rm(artifactDir, { recursive: true, force: true });
  }
});

function createPrincipal(): Principal {
  return PrincipalSchema.parse({
    ...validPrincipal,
    principalId: "principal_agent_kernel_phase_2_e2e_001",
    kind: "user",
    createdAt: "2026-06-04T00:00:00.000Z"
  });
}

function createTask(principal: Principal): Task {
  return TaskSchema.parse({
    ...validTask,
    taskId: "task_agent_kernel_phase_2_e2e_001",
    title: "Read local README through governed kernel flow",
    requestedAction: "Read /repo/README.md through local simulated tool planning.",
    intent: {
      summary: "Exercise the Phase 2 local kernel flow.",
      requestedAction: "Read /repo/README.md through local simulated tool planning.",
      successCriteria: ["local flow completes", "artifact hash verifies"],
      outOfScope: ["network", "shell execution", "real tool execution"]
    },
    createdBy: principal,
    repo: {
      root: "/repo",
      branch: "codex/agent-os-kernel-phase-0-1",
      worktreeClean: true,
      protectedBranch: false
    },
    target: {
      branches: [],
      files: ["/repo/README.md"],
      modules: []
    },
    hints: {
      taskClass: "read_only",
      riskHints: [],
      tags: ["phase-2-e2e"]
    },
    constraints: {
      localOnly: true,
      simulatedToolOnly: true,
      tempArtifactDirOnly: true
    },
    createdAt: "2026-06-04T00:00:00.000Z"
  });
}

function createPolicyDecision(task: Task): PolicyDecision {
  return PolicyDecisionSchema.parse({
    ...validPolicyDecision,
    decisionId: "policy_agent_kernel_phase_2_e2e_001",
    taskId: task.taskId,
    policyVersion: "agent-kernel-phase-2-e2e",
    risk: {
      level: "low",
      factors: [],
      ambiguityScore: 0,
      clarificationRequired: false
    },
    execution: {
      ...validPolicyDecision.execution,
      sandbox: {
        schemaVersion: "sandbox-profile.v1",
        sandboxId: "sandbox_agent_kernel_phase_2_e2e_readonly",
        mode: "read-only",
        networkAccess: "none",
        writableRoots: [],
        envPolicy: {
          inheritProcessEnv: false,
          allowlist: []
        }
      }
    },
    capabilities: [],
    approval: {
      required: false,
      reasons: []
    },
    createdAt: "2026-06-04T00:00:00.000Z"
  });
}

function createRunSeed(task: Task, policyDecision: PolicyDecision): Run {
  return RunSchema.parse({
    ...validRun,
    runId: "run_agent_kernel_phase_2_e2e_001",
    taskId: task.taskId,
    status: "queued",
    policyDecisionId: policyDecision.decisionId,
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z"
  });
}

function createCapabilityGrant(
  principal: Principal,
  task: Task,
  run: Run,
  readScope: string
): CapabilityGrant {
  return CapabilityGrantSchema.parse({
    schemaVersion: "capability-grant.v1",
    grantId: "grant_agent_kernel_phase_2_e2e_001",
    principalId: principal.principalId,
    taskId: task.taskId,
    runId: run.runId,
    scopes: [{
      schemaVersion: "capability-scope.v1",
      kind: "file",
      resource: "/repo/README.md",
      access: "read",
      constraints: {
        capabilityScope: readScope
      }
    }],
    issuedAt: "2026-06-04T00:00:00.000Z",
    expiresAt: "2026-06-04T01:00:00.000Z",
    reason: "agent_kernel_phase_2_e2e_fixture"
  });
}

function createFakeClock(values: string[]): {
  next: () => string;
  peek: () => string;
} {
  let index = 0;

  return {
    next: () => {
      const value = values[index] ?? values[values.length - 1];
      index += 1;
      return value!;
    },
    peek: () => values[index] ?? values[values.length - 1]!
  };
}
