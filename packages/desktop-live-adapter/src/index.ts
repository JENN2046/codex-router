import type {
  CheckpointRef,
  DesktopExecutionPlan,
  DesktopOperation,
  DesktopPrimitive,
  RoutingDecision,
  TaskEnvelope
} from "../../contracts/src/index.js";
import type { AuditEvent, MemoryAdapter } from "../../audit-memory/src/index.js";
import type { AgentStrategyPlan, } from "../../desktop-agent-strategy/src/index.js";
import {
  resumeDesktopDecision,
  runDesktopDecision,
  type DesktopDecisionRunnerInput,
  type DesktopDecisionResumeInput,
  type DesktopDecisionRunnerResult
} from "../../desktop-decision-runner/src/index.js";
import type { CodexCliProcessRunOptions } from "../../codex-cli-host/src/index.js";
import {
  dispatchToHost,
  type HostDispatcherResult
} from "../../host-dispatcher/src/index.js";
import type { MemoryCheckpointFrequency } from "../../policy-config/src/index.js";
import {
  emitTelemetryEvents,
  type TelemetrySink
} from "../../observability/src/index.js";
import {
  createPrimitiveFailureEnvelope,
  normalizePrimitiveHandlerOutput,
  type DesktopPrimitiveHandlerOutput,
  type DesktopPrimitiveResultEnvelope
} from "./result-envelope.js";
import {
  createObservationId,
  parseExecutionObservation,
  type ExecutionObservationBus
} from "../../execution-observation/src/index.js";
import {
  type GovernanceState
} from "../../state-manager/src/index.js";
import type { StrategyDecisionV2 } from "../../strategy-router/src/index.js";
import {
  shouldLockdown,
  type ArbitrationPacket,
  type RecoveryAction
} from "../../recovery-control/src/index.js";
import {
  applyExecutionFailureToGovernanceState
} from "../../governance-failure-reducer/src/index.js";
export {
  createPrimitiveFailureEnvelope,
  createPrimitiveSuccessEnvelope,
  isPrimitiveResultEnvelope,
  normalizePrimitiveHandlerOutput
} from "./result-envelope.js";
export type {
  DesktopPrimitiveHandlerOutput,
  DesktopPrimitiveResultEnvelope,
  DesktopPrimitiveSuccessEnvelope,
  PrimitiveFailureEnvelope,
  PrimitiveSuccessEnvelopeMap,
  PrimitiveSuccessDetailsMap
} from "./result-envelope.js";

export type DesktopLiveExecutionStatus =
  | "not_ready"
  | "completed"
  | "failed";

export interface PrimitiveExecutionContext {
  task: TaskEnvelope;
  decision: RoutingDecision;
  executionPlan: DesktopExecutionPlan;
  agentStrategy: AgentStrategyPlan;
  operation: DesktopOperation;
  stepIndex: number;
}

export interface PrimitiveExecutionResult {
  primitive: DesktopPrimitive;
  status: "completed" | "failed" | "skipped";
  reason: string;
  output?: DesktopPrimitiveResultEnvelope;
  error?: string;
}

export type PrimitiveHandler = (
  context: PrimitiveExecutionContext
) => Promise<DesktopPrimitiveHandlerOutput> | DesktopPrimitiveHandlerOutput;

export interface DesktopPrimitiveInvocation extends PrimitiveExecutionContext {
  primitive: DesktopPrimitive;
  taskId: string;
  reason: string;
}

export type DesktopHostBinding = (
  invocation: DesktopPrimitiveInvocation
) => Promise<DesktopPrimitiveHandlerOutput> | DesktopPrimitiveHandlerOutput;

export type DesktopHostBindings = Partial<Record<DesktopPrimitive, DesktopHostBinding>>;

export interface DesktopHostBridge {
  invokePrimitive(
    invocation: DesktopPrimitiveInvocation
  ): Promise<DesktopPrimitiveHandlerOutput> | DesktopPrimitiveHandlerOutput;
}

export interface RecordingHostBridge extends DesktopHostBridge {
  calls: DesktopPrimitiveInvocation[];
}

export interface DesktopLiveAdapterInput {
  runnerResult: DesktopDecisionRunnerResult;
  handlers: Partial<Record<DesktopPrimitive, PrimitiveHandler>>;
  stopOnFailure?: boolean;
  now?: () => string;
  auditStore?: {
    record(event: AuditEvent): Promise<void>;
  };
  checkpointStore?: {
    record(checkpoint: CheckpointRef): Promise<void>;
  };
  memoryAdapter?: MemoryAdapter;
  telemetryStore?: TelemetrySink;
  observationBus?: ExecutionObservationBus;
  governanceState?: GovernanceState;
  onGovernanceUpdate?: (state: GovernanceState, strategy: StrategyDecisionV2) => Promise<void>;
}

export interface DesktopLiveExecutionResult {
  status: DesktopLiveExecutionStatus;
  taskId: string;
  plan: DesktopExecutionPlan;
  steps: PrimitiveExecutionResult[];
  blockingReasons: string[];
  auditEvents: AuditEvent[];
  governance?: DesktopLiveExecutionGovernance;
}

export interface DesktopLiveExecutionGovernance {
  state: GovernanceState;
  strategyDecision: StrategyDecisionV2;
  arbitrationPacket: ArbitrationPacket;
  availableRecoveryActions: RecoveryAction[];
  recoveryRequired: boolean;
  lockdown: boolean;
}

export interface RunDesktopTaskInput extends DesktopDecisionRunnerInput {
  handlers?: Partial<Record<DesktopPrimitive, PrimitiveHandler>>;
  bridge?: DesktopHostBridge;
  codexCliOptions?: CodexCliProcessRunOptions;
  stopOnFailure?: boolean;
}

export interface ResumeDesktopTaskInput extends DesktopDecisionResumeInput {
  handlers?: Partial<Record<DesktopPrimitive, PrimitiveHandler>>;
  bridge?: DesktopHostBridge;
  codexCliOptions?: CodexCliProcessRunOptions;
  stopOnFailure?: boolean;
}

export interface RunDesktopTaskResult {
  decisionResult: DesktopDecisionRunnerResult;
  executionResult: DesktopLiveExecutionResult;
  hostDispatch?: HostDispatcherResult;
}

export async function runDesktopTask(
  input: RunDesktopTaskInput
): Promise<RunDesktopTaskResult> {
  const decisionRunnerInput: DesktopDecisionRunnerInput = {
    task: input.task,
    policy: input.policy,
    preflight: input.preflight,
    ...(input.availableAgents !== undefined ? { availableAgents: input.availableAgents } : {}),
    ...(input.persistence !== undefined ? { persistence: input.persistence } : {}),
    ...(input.now !== undefined ? { now: input.now } : {})
  };

  const decisionResult = await runDesktopDecision(decisionRunnerInput);
  return executeDesktopTaskFromDecision(input, decisionResult);
}

export async function resumeDesktopTask(
  input: ResumeDesktopTaskInput
): Promise<RunDesktopTaskResult> {
  const decisionRunnerInput: DesktopDecisionResumeInput = {
    task: input.task,
    policy: input.policy,
    preflight: input.preflight,
    ...(input.availableAgents !== undefined ? { availableAgents: input.availableAgents } : {}),
    ...(input.persistence !== undefined ? { persistence: input.persistence } : {}),
    ...(input.resume !== undefined ? { resume: input.resume } : {}),
    ...(input.now !== undefined ? { now: input.now } : {})
  };

  const decisionResult = await resumeDesktopDecision(decisionRunnerInput);
  return executeDesktopTaskFromDecision(input, decisionResult);
}

async function executeDesktopTaskFromDecision(
  input: {
    handlers?: Partial<Record<DesktopPrimitive, PrimitiveHandler>>;
    bridge?: DesktopHostBridge;
    stopOnFailure?: boolean;
    codexCliOptions?: CodexCliProcessRunOptions;
    now?: () => string;
    persistence?: DesktopDecisionRunnerInput["persistence"];
  },
  decisionResult: DesktopDecisionRunnerResult
): Promise<RunDesktopTaskResult> {
  const executionCommonInput: Pick<
    DesktopLiveAdapterInput,
    "runnerResult" | "auditStore" | "checkpointStore" | "memoryAdapter" | "telemetryStore" | "now"
  > = {
    runnerResult: decisionResult,
    ...(input.now !== undefined ? { now: input.now } : {}),
    ...(input.persistence?.auditStore !== undefined ? { auditStore: input.persistence.auditStore } : {}),
    ...(input.persistence?.checkpointStore !== undefined ? { checkpointStore: input.persistence.checkpointStore } : {}),
    ...(input.persistence?.memoryAdapter !== undefined ? { memoryAdapter: input.persistence.memoryAdapter } : {}),
    ...(input.persistence?.telemetryStore !== undefined ? { telemetryStore: input.persistence.telemetryStore } : {})
  };

  const telemetryGate = await gateTelemetry(decisionResult, executionCommonInput);
  if (telemetryGate) {
    return {
      decisionResult,
      executionResult: telemetryGate
    };
  }

  if (decisionResult.status !== "ready") {
    const executionResult = await executeDesktopPlan({
      ...executionCommonInput,
      handlers: {},
      ...(input.stopOnFailure !== undefined ? { stopOnFailure: input.stopOnFailure } : {})
    });

    return {
      decisionResult,
      executionResult
    };
  }

  if (decisionResult.status === "ready" && decisionResult.decision.hostRoute === "codex-cli") {
    const hostDispatch = await dispatchToHost({
      runnerResult: decisionResult,
      ...(input.codexCliOptions !== undefined ? { codexCliOptions: input.codexCliOptions } : {})
    });
    const executionResult = await createHostDispatchExecutionResult({
      runnerResult: decisionResult,
      hostDispatch,
      ...(input.now !== undefined ? { now: input.now } : {}),
      ...(input.persistence?.auditStore !== undefined ? { auditStore: input.persistence.auditStore } : {}),
      ...(input.persistence?.checkpointStore !== undefined ? { checkpointStore: input.persistence.checkpointStore } : {}),
      ...(input.persistence?.memoryAdapter !== undefined ? { memoryAdapter: input.persistence.memoryAdapter } : {})
    });

    return {
      decisionResult,
      executionResult,
      hostDispatch
    };
  }

  const handlers = resolvePrimitiveHandlers(input.handlers, input.bridge);
  const adapterInput: DesktopLiveAdapterInput = {
    runnerResult: decisionResult,
    handlers,
    ...(input.stopOnFailure !== undefined ? { stopOnFailure: input.stopOnFailure } : {}),
    ...(input.now !== undefined ? { now: input.now } : {}),
    ...(input.persistence?.auditStore !== undefined ? { auditStore: input.persistence.auditStore } : {}),
    ...(input.persistence?.checkpointStore !== undefined ? { checkpointStore: input.persistence.checkpointStore } : {}),
    ...(input.persistence?.memoryAdapter !== undefined ? { memoryAdapter: input.persistence.memoryAdapter } : {}),
    ...(input.persistence?.telemetryStore !== undefined ? { telemetryStore: input.persistence.telemetryStore } : {})
  };

  const executionResult = await executeDesktopPlan(adapterInput);

  return {
    decisionResult,
    executionResult
  };
}

async function createHostDispatchExecutionResult(input: {
  runnerResult: DesktopDecisionRunnerResult;
  hostDispatch: HostDispatcherResult;
  now?: () => string;
  auditStore?: {
    record(event: AuditEvent): Promise<void>;
  };
  checkpointStore?: {
    record(checkpoint: CheckpointRef): Promise<void>;
  };
  memoryAdapter?: MemoryAdapter;
}): Promise<DesktopLiveExecutionResult> {
  const now = input.now ?? (() => new Date().toISOString());
  const checkpointFrequency = input.runnerResult.preflight.memory.guidance?.checkpointFrequency ?? "minimal";
  const blockingReasons = collectHostDispatchBlockingReasons(input.hostDispatch);
  const status: DesktopLiveExecutionStatus = blockingReasons.length === 0 ? "completed" : "failed";
  const auditEvents: AuditEvent[] = [{
    type: "runner_dispatched",
    taskId: input.runnerResult.task.taskId,
    timestamp: now(),
    details: {
      hostRoute: input.hostDispatch.hostRoute,
      executionProfile: input.runnerResult.executionPlan.executionProfile,
      primitiveCount: 0,
      dispatchTarget: "host_dispatcher",
      cliStatus: input.hostDispatch.cliRun?.inspection.status ?? null,
      timedOut: input.hostDispatch.cliRun?.timedOut ?? false,
      killed: input.hostDispatch.cliRun?.killed ?? false
    }
  }];

  auditEvents.push({
    type: status === "completed" ? "task_completed" : "task_failed",
    taskId: input.runnerResult.task.taskId,
    timestamp: now(),
    details: {
      hostRoute: input.hostDispatch.hostRoute,
      blockingReasons
    }
  });

  await maybePersistExecutionCheckpoint({
    taskId: input.runnerResult.task.taskId,
    stage: status === "completed" ? "host-dispatch-completed" : "host-dispatch-failed",
    summary: status === "completed"
      ? "host dispatcher completed routed execution"
      : `host dispatcher failed routed execution: ${blockingReasons.join(", ")}`,
    frequency: checkpointFrequency,
    trigger: "final",
    now,
    ...(input.checkpointStore ? { checkpointStore: input.checkpointStore } : {}),
    ...(input.memoryAdapter ? { memoryAdapter: input.memoryAdapter } : {})
  });
  await persistAudit(auditEvents, input.auditStore);

  return {
    status,
    taskId: input.runnerResult.task.taskId,
    plan: input.runnerResult.executionPlan,
    steps: [],
    blockingReasons,
    auditEvents
  };
}

function collectHostDispatchBlockingReasons(
  hostDispatch: HostDispatcherResult
): string[] {
  const reasons = [
    hostDispatch.cliError,
    hostDispatch.cliRun?.error,
    ...(hostDispatch.cliRun?.inspection.blockingReasons ?? [])
  ].filter((reason): reason is string => Boolean(reason));

  if (hostDispatch.hostRoute === "codex-cli" && !hostDispatch.cliRun && !hostDispatch.cliError) {
    reasons.push("host_dispatcher_missing_cli_run");
  }

  if (hostDispatch.cliRun && hostDispatch.cliRun.inspection.status !== "completed") {
    reasons.push(`codex_cli_status:${hostDispatch.cliRun.inspection.status}`);
  }

  return [...new Set(reasons)];
}

function resolvePrimitiveHandlers(
  handlers?: Partial<Record<DesktopPrimitive, PrimitiveHandler>>,
  bridge?: DesktopHostBridge
): Partial<Record<DesktopPrimitive, PrimitiveHandler>> {
  const resolvedHandlers = handlers ?? (
    bridge ? createPrimitiveHandlersFromBridge(bridge) : undefined
  );

  if (!resolvedHandlers) {
    throw new Error("desktop_live_adapter_requires_handlers_or_bridge");
  }

  return resolvedHandlers;
}

const ALL_DESKTOP_PRIMITIVES: DesktopPrimitive[] = [
  "spawn_agent",
  "send_input",
  "wait_agent",
  "close_agent",
  "automation_update",
  "shell_command",
  "apply_patch",
  "read_thread_terminal"
];

export function createPrimitiveHandlersFromBridge(
  bridge: DesktopHostBridge,
  primitives: DesktopPrimitive[] = ALL_DESKTOP_PRIMITIVES
): Partial<Record<DesktopPrimitive, PrimitiveHandler>> {
  const handlers: Partial<Record<DesktopPrimitive, PrimitiveHandler>> = {};

  for (const primitive of primitives) {
    handlers[primitive] = (context) => bridge.invokePrimitive({
      primitive,
      taskId: context.task.taskId,
      reason: context.operation.reason,
      ...context
    });
  }

  return handlers;
}

export function createHostBridgeFromBindings(
  bindings: DesktopHostBindings
): DesktopHostBridge {
  return {
    invokePrimitive(invocation) {
      const binding = bindings[invocation.primitive];
      if (!binding) {
        throw new Error(`missing_bridge_binding:${invocation.primitive}`);
      }

      return binding(invocation);
    }
  };
}

export function createRecordingHostBridge(
  bindings: DesktopHostBindings = {}
): RecordingHostBridge {
  const calls: DesktopPrimitiveInvocation[] = [];
  const bridge = createHostBridgeFromBindings(
    Object.fromEntries(
      ALL_DESKTOP_PRIMITIVES.map((primitive) => [
        primitive,
        (invocation: DesktopPrimitiveInvocation) => {
          calls.push(invocation);
          const binding = bindings[primitive];
          if (binding) {
            return binding(invocation);
          }

          return {
            ok: true,
            primitive,
            taskId: invocation.taskId
          };
        }
      ])
    ) as DesktopHostBindings
  );

  return {
    calls,
    invokePrimitive(invocation) {
      return bridge.invokePrimitive(invocation);
    }
  };
}

function createRecoveryGovernanceIfRequired(input: {
  state: GovernanceState;
  strategyDecision: StrategyDecisionV2;
  arbitrationPacket: ArbitrationPacket;
}): DesktopLiveExecutionGovernance | undefined {
  if (
    input.strategyDecision.actionFamily !== "step_back" &&
    input.strategyDecision.actionFamily !== "abort"
  ) {
    return undefined;
  }

  return {
    state: input.state,
    strategyDecision: input.strategyDecision,
    arbitrationPacket: input.arbitrationPacket,
    availableRecoveryActions: [...input.arbitrationPacket.availableActions],
    recoveryRequired: true,
    lockdown: shouldLockdown(input.arbitrationPacket) ||
      input.strategyDecision.actionFamily === "abort"
  };
}

function createGovernanceBlockingReasons(
  governance: DesktopLiveExecutionGovernance
): string[] {
  return [
    governance.strategyDecision.actionFamily === "abort"
      ? "governance_abort_triggered"
      : "governance_step_back_triggered",
    "arbitration_required"
  ];
}

export async function executeDesktopPlan(
  input: DesktopLiveAdapterInput
): Promise<DesktopLiveExecutionResult> {
  const now = input.now ?? (() => new Date().toISOString());
  const stopOnFailure = input.stopOnFailure ?? true;
  const result = input.runnerResult;
  const auditEvents: AuditEvent[] = [];
  const checkpointFrequency = result.preflight.memory.guidance?.checkpointFrequency ?? "minimal";

  // Initialize governance state from runner result or create new
  let governanceState: GovernanceState | undefined = input.governanceState;
  let strategyDecision: StrategyDecisionV2 | undefined = undefined;
  let anomalyCount = 0;

  if (result.status !== "ready") {
    const blockedEvent: AuditEvent = {
      type: "runner_blocked",
      taskId: result.task.taskId,
      timestamp: now(),
      details: {
        status: result.status,
        blockingReasons: result.blockingReasons
      }
    };
    auditEvents.push(blockedEvent);
    await persistAudit(auditEvents, input.auditStore);

    return {
      status: "not_ready",
      taskId: result.task.taskId,
      plan: result.executionPlan,
      steps: [],
      blockingReasons: result.blockingReasons,
      auditEvents
    };
  }

  const dispatchEvent: AuditEvent = {
    type: "runner_dispatched",
    taskId: result.task.taskId,
    timestamp: now(),
    details: {
      primitiveCount: result.executionPlan.primitives.length,
      executionProfile: result.executionPlan.executionProfile
    }
  };
  auditEvents.push(dispatchEvent);
  await maybePersistExecutionCheckpoint({
    taskId: result.task.taskId,
    stage: "execution-dispatched",
    summary: "desktop live adapter dispatched execution plan",
    frequency: checkpointFrequency,
    trigger: "dispatch",
    now,
    ...(input.checkpointStore ? { checkpointStore: input.checkpointStore } : {}),
    ...(input.memoryAdapter ? { memoryAdapter: input.memoryAdapter } : {})
  });

  const steps: PrimitiveExecutionResult[] = [];
  const persistFinalState = () => persistFinalExecutionState({
    taskId: result.task.taskId,
    steps,
    auditEvents,
    checkpointFrequency,
    now,
    ...(input.auditStore ? { auditStore: input.auditStore } : {}),
    ...(input.checkpointStore ? { checkpointStore: input.checkpointStore } : {}),
    ...(input.memoryAdapter ? { memoryAdapter: input.memoryAdapter } : {})
  });

  for (const [stepIndex, operation] of result.executionPlan.primitives.entries()) {
    const handler = input.handlers[operation.primitive];
    if (!handler) {
      const errorMessage = `missing_handler:${operation.primitive}`;
      const failedStep: PrimitiveExecutionResult = {
        primitive: operation.primitive,
        status: "failed",
        reason: operation.reason,
        output: createPrimitiveFailureEnvelope(operation.primitive, errorMessage),
        error: errorMessage
      };
      steps.push(failedStep);
      auditEvents.push({
        type: "primitive_failed",
        taskId: result.task.taskId,
        timestamp: now(),
        details: {
          primitive: operation.primitive,
          error: failedStep.error,
          stepIndex
        }
      });
      await emitPrimitiveObservation({
        ...(input.observationBus !== undefined ? { observationBus: input.observationBus } : {}),
        taskId: result.task.taskId,
        primitiveId: `${operation.primitive}:${stepIndex}`,
        stage: "execution",
        status: "failed" as const,
        error: errorMessage,
        createdAt: now()
      });

      // Update governance state on failure
      if (governanceState) {
        const failureResult = applyExecutionFailureToGovernanceState({
          state: governanceState,
          task: result.task,
          primitiveId: `${operation.primitive}:${stepIndex}`,
          errorClass: errorMessage,
          stepIndex,
          now
        });
        governanceState = failureResult.state;
        strategyDecision = failureResult.strategyDecision;

        // Notify callback
        if (input.onGovernanceUpdate && strategyDecision) {
          await input.onGovernanceUpdate(governanceState, strategyDecision);
        }

        const governance = createRecoveryGovernanceIfRequired({
          state: governanceState,
          strategyDecision,
          arbitrationPacket: failureResult.arbitrationPacket
        });
        if (governance) {
          await persistFinalState();
          return {
            status: "failed",
            taskId: result.task.taskId,
            plan: result.executionPlan,
            steps,
            blockingReasons: createGovernanceBlockingReasons(governance),
            auditEvents,
            governance
          };
        }
      }

      if (stopOnFailure) {
        await maybePersistExecutionCheckpoint({
          taskId: result.task.taskId,
          stage: `execution-failed-${stepIndex + 1}`,
          summary: `execution failed before ${operation.primitive}: ${errorMessage}`,
          frequency: checkpointFrequency,
          trigger: "final",
          now,
          ...(input.checkpointStore ? { checkpointStore: input.checkpointStore } : {}),
          ...(input.memoryAdapter ? { memoryAdapter: input.memoryAdapter } : {})
        });
        await persistAudit(auditEvents, input.auditStore);
        return {
          status: "failed",
          taskId: result.task.taskId,
          plan: result.executionPlan,
          steps,
          blockingReasons: [errorMessage],
          auditEvents
        };
      }

      continue;
    }

    try {
      const rawOutput = await handler({
        task: result.task,
        decision: result.decision,
        executionPlan: result.executionPlan,
        agentStrategy: result.agentStrategy,
        operation,
        stepIndex
      });
      const output = normalizePrimitiveHandlerOutput(operation.primitive, rawOutput);

      if (!output.ok) {
        const errorMessage = getPrimitiveFailureError(operation.primitive, output);
        const failedStep: PrimitiveExecutionResult = {
          primitive: operation.primitive,
          status: "failed",
          reason: operation.reason,
          output,
          error: errorMessage
        };
        steps.push(failedStep);
        auditEvents.push({
          type: "primitive_failed",
          taskId: result.task.taskId,
          timestamp: now(),
          details: {
            primitive: operation.primitive,
            error: errorMessage,
            stepIndex
          }
        });
        await emitPrimitiveObservation({
          ...(input.observationBus !== undefined ? { observationBus: input.observationBus } : {}),
          taskId: result.task.taskId,
          primitiveId: `${operation.primitive}:${stepIndex}`,
          stage: "execution",
          status: "failed",
          error: errorMessage,
          createdAt: now()
        });

        // Update governance state on handler failure
        if (governanceState) {
          const failureResult = applyExecutionFailureToGovernanceState({
            state: governanceState,
            task: result.task,
            primitiveId: `${operation.primitive}:${stepIndex}`,
            errorClass: errorMessage,
            stepIndex,
            now
          });
          governanceState = failureResult.state;
          strategyDecision = failureResult.strategyDecision;

          // Notify callback
          if (input.onGovernanceUpdate && strategyDecision) {
            await input.onGovernanceUpdate(governanceState, strategyDecision);
          }

          const governance = createRecoveryGovernanceIfRequired({
            state: governanceState,
            strategyDecision,
            arbitrationPacket: failureResult.arbitrationPacket
          });
          if (governance) {
            await persistFinalState();
            return {
              status: "failed",
              taskId: result.task.taskId,
              plan: result.executionPlan,
              steps,
              blockingReasons: createGovernanceBlockingReasons(governance),
              auditEvents,
              governance
            };
          }
        }

        if (stopOnFailure) {
          await maybePersistExecutionCheckpoint({
            taskId: result.task.taskId,
            stage: `execution-failed-${stepIndex + 1}`,
            summary: `execution failed at ${operation.primitive}: ${errorMessage}`,
            frequency: checkpointFrequency,
            trigger: "final",
            now,
            ...(input.checkpointStore ? { checkpointStore: input.checkpointStore } : {}),
            ...(input.memoryAdapter ? { memoryAdapter: input.memoryAdapter } : {})
          });
          await persistAudit(auditEvents, input.auditStore);
          return {
            status: "failed",
            taskId: result.task.taskId,
            plan: result.executionPlan,
            steps,
            blockingReasons: [errorMessage],
            auditEvents
          };
        }

        continue;
      }

      steps.push({
        primitive: operation.primitive,
        status: "completed",
        reason: operation.reason,
        output
      });
      await emitPrimitiveObservation({
        ...(input.observationBus !== undefined ? { observationBus: input.observationBus } : {}),
        taskId: result.task.taskId,
        primitiveId: `${operation.primitive}:${stepIndex}`,
        stage: "execution",
        status: "succeeded" as const,
        createdAt: now()
      });
      await maybePersistExecutionCheckpoint({
        taskId: result.task.taskId,
        stage: `execution-step-${stepIndex + 1}-${operation.primitive}`,
        summary: `completed ${operation.primitive}`,
        frequency: checkpointFrequency,
        trigger: "step",
        now,
        ...(input.checkpointStore ? { checkpointStore: input.checkpointStore } : {}),
        ...(input.memoryAdapter ? { memoryAdapter: input.memoryAdapter } : {})
      });

      auditEvents.push({
        type: "primitive_executed",
        taskId: result.task.taskId,
        timestamp: now(),
        details: {
          primitive: operation.primitive,
          stepIndex
        }
      });
    } catch (error) {
      const errorMessage = normalizeThrownError(error);
      const failedStep: PrimitiveExecutionResult = {
        primitive: operation.primitive,
        status: "failed",
        reason: operation.reason,
        output: createPrimitiveFailureEnvelope(
          operation.primitive,
          errorMessage
        ),
        error: errorMessage
      };
      steps.push(failedStep);
      auditEvents.push({
        type: "primitive_failed",
        taskId: result.task.taskId,
        timestamp: now(),
        details: {
          primitive: operation.primitive,
          error: failedStep.error,
          stepIndex
        }
      });
      await emitPrimitiveObservation({
        ...(input.observationBus !== undefined ? { observationBus: input.observationBus } : {}),
        taskId: result.task.taskId,
        primitiveId: `${operation.primitive}:${stepIndex}`,
        stage: "execution",
        status: "failed" as const,
        error: errorMessage,
        createdAt: now()
      });

      if (governanceState) {
        const failureResult = applyExecutionFailureToGovernanceState({
          state: governanceState,
          task: result.task,
          primitiveId: `${operation.primitive}:${stepIndex}`,
          errorClass: errorMessage,
          stepIndex,
          now
        });
        governanceState = failureResult.state;
        strategyDecision = failureResult.strategyDecision;

        if (input.onGovernanceUpdate && strategyDecision) {
          await input.onGovernanceUpdate(governanceState, strategyDecision);
        }

        const governance = createRecoveryGovernanceIfRequired({
          state: governanceState,
          strategyDecision,
          arbitrationPacket: failureResult.arbitrationPacket
        });
        if (governance) {
          await persistFinalState();
          return {
            status: "failed",
            taskId: result.task.taskId,
            plan: result.executionPlan,
            steps,
            blockingReasons: createGovernanceBlockingReasons(governance),
            auditEvents,
            governance
          };
        }
      }

      if (stopOnFailure) {
        await maybePersistExecutionCheckpoint({
          taskId: result.task.taskId,
          stage: `execution-failed-${stepIndex + 1}`,
          summary: `execution failed at ${operation.primitive}: ${failedStep.error ?? "primitive_execution_failed"}`,
          frequency: checkpointFrequency,
          trigger: "final",
          now,
          ...(input.checkpointStore ? { checkpointStore: input.checkpointStore } : {}),
          ...(input.memoryAdapter ? { memoryAdapter: input.memoryAdapter } : {})
        });
        await persistAudit(auditEvents, input.auditStore);
        return {
          status: "failed",
          taskId: result.task.taskId,
          plan: result.executionPlan,
          steps,
          blockingReasons: [failedStep.error ?? "primitive_execution_failed"],
          auditEvents
        };
      }
    }
  }

  await persistFinalState();

  const finalBlockingReasons = createFailedStepBlockingReasons(steps);

  return {
    status: finalBlockingReasons.length > 0 ? "failed" : "completed",
    taskId: result.task.taskId,
    plan: result.executionPlan,
    steps,
    blockingReasons: finalBlockingReasons,
    auditEvents
  };
}

async function persistFinalExecutionState(input: {
  taskId: string;
  steps: PrimitiveExecutionResult[];
  auditEvents: AuditEvent[];
  checkpointFrequency: MemoryCheckpointFrequency;
  now: () => string;
  auditStore?: { record(event: AuditEvent): Promise<void> };
  checkpointStore?: {
    record(checkpoint: CheckpointRef): Promise<void>;
  };
  memoryAdapter?: MemoryAdapter;
}): Promise<void> {
  await maybePersistExecutionCheckpoint({
    taskId: input.taskId,
    stage: "execution-completed",
    summary: input.steps.some((step) => step.status === "failed")
      ? "desktop live adapter completed with failures"
      : "desktop live adapter completed successfully",
    frequency: input.checkpointFrequency,
    trigger: "final",
    now: input.now,
    ...(input.checkpointStore ? { checkpointStore: input.checkpointStore } : {}),
    ...(input.memoryAdapter ? { memoryAdapter: input.memoryAdapter } : {})
  });
  await persistAudit(input.auditEvents, input.auditStore);
}

function createFailedStepBlockingReasons(
  steps: PrimitiveExecutionResult[]
): string[] {
  const reasons = steps
    .filter((step) => step.status === "failed")
    .map((step) => {
      const stepError = asNonEmptyString(step.error);
      if (stepError) {
        return stepError;
      }

      if (
        step.output?.ok === false &&
        typeof step.output.error === "string" &&
        step.output.error.length > 0
      ) {
        return step.output.error;
      }

      return `primitive_failed:${step.primitive}`;
    });

  return [...new Set(reasons)];
}

function getPrimitiveFailureError(
  primitive: DesktopPrimitive,
  output: DesktopPrimitiveResultEnvelope
): string {
  if (
    output.ok === false &&
    typeof output.error === "string" &&
    output.error.length > 0
  ) {
    return output.error;
  }

  return `primitive_failed:${primitive}`;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function persistAudit(
  events: AuditEvent[],
  auditStore?: { record(event: AuditEvent): Promise<void> }
): Promise<void> {
  if (!auditStore) {
    return;
  }

  for (const event of events) {
    await auditStore.record(event);
  }
}

async function gateTelemetry(
  result: DesktopDecisionRunnerResult,
  input: Pick<DesktopLiveAdapterInput, "telemetryStore" | "auditStore" | "now">
): Promise<DesktopLiveExecutionResult | undefined> {
  const telemetryMandatory = result.preflight.memory.guidance?.telemetryMandatory ?? false;
  const now = input.now ?? (() => new Date().toISOString());

  if (!telemetryMandatory && !input.telemetryStore) {
    return undefined;
  }

  if (!input.telemetryStore) {
    const auditEvents: AuditEvent[] = [{
      type: "execution_blocked",
      taskId: result.task.taskId,
      timestamp: now(),
      details: {
        reason: "telemetry_sink_required",
        policyPack: result.preflight.memory.policyPack ?? null
      }
    }];
    await persistAudit(auditEvents, input.auditStore);

    return {
      status: "not_ready",
      taskId: result.task.taskId,
      plan: result.executionPlan,
      steps: [],
      blockingReasons: ["telemetry_sink_required"],
      auditEvents
    };
  }

  await emitTelemetryEvents(input.telemetryStore, result.observabilityEvents);

  return undefined;
}

async function maybePersistExecutionCheckpoint(input: {
  taskId: string;
  stage: string;
  summary: string;
  frequency: MemoryCheckpointFrequency;
  trigger: "dispatch" | "step" | "final";
  now: () => string;
  checkpointStore?: {
    record(checkpoint: CheckpointRef): Promise<void>;
  };
  memoryAdapter?: MemoryAdapter;
}): Promise<void> {
  if (!shouldRecordCheckpoint(input.frequency, input.trigger)) {
    return;
  }

  const checkpoint: CheckpointRef = {
    checkpointId: `${input.taskId}:${input.stage}:${Date.now()}`,
    taskId: input.taskId,
    stage: input.stage,
    createdAt: input.now(),
    summary: input.summary
  };

  if (input.checkpointStore) {
    await input.checkpointStore.record(checkpoint);
  }

  if (input.memoryAdapter) {
    await input.memoryAdapter.recordCheckpoint(checkpoint);
  }
}

function shouldRecordCheckpoint(
  frequency: MemoryCheckpointFrequency,
  trigger: "dispatch" | "step" | "final"
): boolean {
  switch (frequency) {
    case "minimal":
      return false;
    case "standard":
      return trigger === "final";
    case "stage":
      return trigger === "dispatch" || trigger === "final";
    case "dense":
      return true;
    default:
      return false;
  }
}

async function emitPrimitiveObservation(input: {
  observationBus?: ExecutionObservationBus;
  taskId: string;
  primitiveId: string;
  stage: string;
  status: "succeeded" | "failed" | "blocked";
  error?: string;
  evidenceRef?: string;
  createdAt: string;
}): Promise<void> {
  if (!input.observationBus) {
    return;
  }

  await input.observationBus.emit(parseExecutionObservation({
    observationId: createObservationId({
      taskId: input.taskId,
      primitiveId: input.primitiveId,
      status: input.status,
      createdAt: input.createdAt
    }),
    taskId: input.taskId,
    primitiveId: input.primitiveId,
    stage: input.stage,
    status: input.status,
    signals: {
      ...(input.error !== undefined ? { errorClass: input.error } : {})
    },
    ...(input.evidenceRef !== undefined ? { evidenceRef: input.evidenceRef } : {}),
    createdAt: input.createdAt
  }));
}

// ── Error normalization ────────────────────────────────────────────────────

function normalizeThrownError(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  if (typeof error === "string" && error.length > 0) {
    return error;
  }
  return "unknown_execution_error";
}
