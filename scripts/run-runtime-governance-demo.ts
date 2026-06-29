#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { parseTaskEnvelope, type TaskEnvelopeInput } from "../packages/contracts/src/index.js";
import {
  createFailingExampleHostBridge,
  createExampleDesktopHostClient
} from "../packages/host-client-example/src/index.js";
import {
  createExecutionObservationRef,
  createRecordingExecutionObservationStore,
  resolveExecutionObservationRef
} from "../packages/execution-observation/src/index.js";
import {
  runDesktopTask
} from "../packages/desktop-live-adapter/src/index.js";
import { loadPolicyFromFile } from "../packages/policy-config/src/index.js";
import { createRecordingTelemetrySink } from "../packages/observability/src/index.js";
import type { GovernanceState } from "../packages/state-manager/src/index.js";

export interface RuntimeGovernanceDemoScenario {
  name: string;
  decisionStatus: string;
  executionStatus: string;
  hostRoute: string;
  usedHostDispatch: boolean;
  blockingReasons: string[];
  observationCount: number;
  evidenceRefResolved?: boolean;
  recoveryRequired?: boolean;
  lockdown?: boolean;
}

export interface RuntimeGovernanceDemoResult {
  schemaVersion: "runtime-governance-demo.v1";
  scenarios: RuntimeGovernanceDemoScenario[];
  summary: {
    allScenariosPassed: boolean;
    realHostExecution: false;
    wroteEvidence: false;
  };
}

export async function runRuntimeGovernanceDemo(
  policyPath = "routing-policy.yaml"
): Promise<RuntimeGovernanceDemoResult> {
  const policy = await loadPolicyFromFile(policyPath);

  const successClient = createExampleDesktopHostClient({
    policy,
    now: fixedNow
  });
  const success = await successClient.run(createEngineeringTask(
    "runtime-demo-success"
  ));
  const successState = await successClient.getState();

  const failureClient = createExampleDesktopHostClient({
    policy,
    bridge: createFailingExampleHostBridge("send_input", "demo_agent_failure"),
    now: fixedNow
  });
  const failure = await failureClient.run(createEngineeringTask(
    "runtime-demo-failure"
  ));
  const failureState = await failureClient.getState();
  const failedObservation = failureState.observations.find((observation) =>
    observation.taskId === "runtime-demo-failure" &&
    observation.status === "failed"
  );
  const failureRef = failedObservation
    ? createExecutionObservationRef(failedObservation.observationId)
    : undefined;
  const resolvedFailureObservation = failureRef && failureClient.observationStore
    ? await resolveExecutionObservationRef(
        failureClient.observationStore,
        "runtime-demo-failure",
        failureRef
      )
    : undefined;

  const recoveryObservationStore = createRecordingExecutionObservationStore();
  const recovery = await runDesktopTask({
    task: createDesktopRecoveryTask("runtime-demo-recovery"),
    policy,
    preflight: {
      authAvailable: true,
      availableTools: [
        "read_thread_terminal",
        "send_input",
        "shell_command",
        "apply_patch"
      ]
    },
    availableAgents: 3,
    bridge: createFailingExampleHostBridge("send_input", "demo_recovery_failure"),
    persistence: {
      telemetryStore: createRecordingTelemetrySink()
    },
    governanceState: createHighRiskStateWithTwoExecutionFailures(
      "runtime-demo-recovery"
    ),
    observationBus: recoveryObservationStore,
    stopOnFailure: false,
    now: fixedNow
  });
  const recoveryObservationRef =
    recovery.executionResult.governance?.arbitrationPacket.rawEvidenceRefs[0];
  const resolvedRecoveryObservation = recoveryObservationRef
    ? await resolveExecutionObservationRef(
        recoveryObservationStore,
        "runtime-demo-recovery",
        recoveryObservationRef
      )
    : undefined;
  const recoveryObservations = await recoveryObservationStore.loadAll();

  const scenarios: RuntimeGovernanceDemoScenario[] = [
    {
      name: "successful_example_execution",
      decisionStatus: success.decisionResult.status,
      executionStatus: success.executionResult.status,
      hostRoute: success.decisionResult.decision.hostRoute,
      usedHostDispatch: success.hostDispatch !== undefined,
      blockingReasons: success.executionResult.blockingReasons,
      observationCount: successState.observations.length
    },
    {
      name: "failure_evidence_ref_resolution",
      decisionStatus: failure.decisionResult.status,
      executionStatus: failure.executionResult.status,
      hostRoute: failure.decisionResult.decision.hostRoute,
      usedHostDispatch: failure.hostDispatch !== undefined,
      blockingReasons: failure.executionResult.blockingReasons,
      observationCount: failureState.observations.length,
      evidenceRefResolved:
        resolvedFailureObservation?.observationId === failedObservation?.observationId
    },
    {
      name: "third_failure_recovery_packet",
      decisionStatus: recovery.decisionResult.status,
      executionStatus: recovery.executionResult.status,
      hostRoute: recovery.decisionResult.decision.hostRoute,
      usedHostDispatch: recovery.hostDispatch !== undefined,
      blockingReasons: recovery.executionResult.blockingReasons,
      observationCount: recoveryObservations.length,
      evidenceRefResolved:
        resolvedRecoveryObservation?.observationId !== undefined,
      recoveryRequired: recovery.executionResult.governance?.recoveryRequired ?? false,
      lockdown: recovery.executionResult.governance?.lockdown ?? false
    }
  ];

  const allScenariosPassed =
    success.decisionResult.status === "ready" &&
    success.executionResult.status === "completed" &&
    successState.observations.length > 0 &&
    failure.executionResult.status === "failed" &&
    resolvedFailureObservation?.observationId === failedObservation?.observationId &&
    recovery.decisionResult.decision.hostRoute === "desktop" &&
    recovery.hostDispatch === undefined &&
    recovery.executionResult.governance?.recoveryRequired === true &&
    recovery.executionResult.governance.lockdown === true &&
    resolvedRecoveryObservation !== undefined;

  return {
    schemaVersion: "runtime-governance-demo.v1",
    scenarios,
    summary: {
      allScenariosPassed,
      realHostExecution: false,
      wroteEvidence: false
    }
  };
}

function createEngineeringTask(taskId: string): TaskEnvelopeInput {
  return {
    taskId,
    source: "desktop-thread",
    intent: {
      summary: "implement host client integration",
      requestedAction: "add multi-file TypeScript host client integration changes",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router" },
    target: {
      branches: [],
      files: ["packages/host-client-example/src/index.ts"],
      modules: []
    },
    constraints: {},
    hints: { riskHints: [], tags: [] }
  };
}

function createDesktopRecoveryTask(taskId: string): TaskEnvelopeInput {
  return parseTaskEnvelope({
    taskId,
    source: "desktop-thread",
    intent: {
      summary: "implement deterministic runtime governance recovery exercise",
      requestedAction: "implement a local desktop bridge recovery exercise with injected failing primitives",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: { repoRoot: "A:/codex-router", worktreeClean: true },
    target: {
      branches: [],
      files: ["packages/host-client-example/src/index.ts"],
      modules: ["host-client-example"]
    },
    constraints: {},
    hints: {
      taskClassHint: "engineering",
      riskHints: [],
      tags: ["runtime-governance-demo"],
      provenance: [{
        field: "taskClassHint",
        value: "engineering",
        source: "operator",
        reason: "demo must exercise the injected desktop bridge, not the read_only codex-cli route",
        createdAt: fixedNow()
      }]
    }
  });
}

function createHighRiskStateWithTwoExecutionFailures(taskId: string): GovernanceState {
  return {
    schemaVersion: "governance-state.v1",
    taskId,
    branchId: "main",
    phase: "execution",
    trustBalance: { centralOrder: 0.5, distributedVitality: 0.5 },
    risk: {
      entanglement: 0.6,
      entropy: 0.7,
      failureCost: 0.8,
      reversibility: 0.3,
      contextPressure: 0.5,
      historicalTrust: 0.4,
      globalCoherence: 0.6,
      finalRiskLevel: "high"
    },
    anomalies: [
      {
        anomalyId: `anomaly:${taskId}:pre1`,
        taskId,
        kind: "execution_failure",
        message: "previous failure one",
        strikeNumber: 1,
        createdAt: "2026-04-28T10:00:00.000Z",
        evidenceRefs: []
      },
      {
        anomalyId: `anomaly:${taskId}:pre2`,
        taskId,
        kind: "execution_failure",
        message: "previous failure two",
        strikeNumber: 2,
        createdAt: "2026-04-28T11:00:00.000Z",
        evidenceRefs: []
      }
    ],
    approvals: [],
    taskGraphRef: `task-graph:${taskId}`,
    createdAt: "2026-04-28T09:00:00.000Z",
    updatedAt: "2026-04-28T11:00:00.000Z"
  };
}

function fixedNow(): string {
  return "2026-04-28T12:00:00.000Z";
}

async function main(): Promise<void> {
  const result = await runRuntimeGovernanceDemo();
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.summary.allScenariosPassed ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Runtime governance demo failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
