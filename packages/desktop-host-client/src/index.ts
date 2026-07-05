import type {
  AuditStore,
  CheckpointLookup,
  CheckpointStore,
  DesktopDecisionRunnerInput,
  ResumeSource
} from "../../desktop-decision-runner/src/index.js";
import type {
  CheckpointRecallAdapter,
  MemoryAdapter,
  MemoryOverviewProvider
} from "../../audit-memory/src/index.js";
import type { CodexCliProcessRunOptions } from "../../codex-cli-host/src/index.js";
import type { ExecutionObservationBus } from "../../execution-observation/src/index.js";
import type { GovernanceState } from "../../state-manager/src/index.js";
import type { StrategyDecisionV2 } from "../../strategy-router/src/index.js";
import type { TaskEnvelopeInput } from "../../contracts/src/index.js";
import type { TelemetrySink } from "../../observability/src/index.js";
import type { PolicySnapshot } from "../../policy-config/src/index.js";
import type { PreflightContext } from "../../preflight/src/index.js";
import {
  consumeDesktopOperatorActionReceipt,
  createDesktopOperatorActionLifecycleState,
  createDesktopOperatorActionReceipt,
  createHostBridgeFromBindings,
  resumeDesktopTask,
  runDesktopTask,
  type DesktopOperatorActionReceiptCreation,
  type DesktopOperatorActionReceiptConsumption,
  type DesktopOperatorActionLifecycleState,
  type DesktopHostBindings,
  type DesktopHostBridge,
  type ConsumeDesktopOperatorActionReceiptInput,
  type CreateDesktopOperatorActionReceiptInput,
  type RunDesktopTaskResult
} from "../../desktop-live-adapter/src/index.js";
import type {
  GovernanceOperatorActionEnvelope,
  GovernanceOperatorActionEnvelopeInput,
  GovernanceOperatorActionReceiptDecision,
  GovernanceOperatorActionReceiptStore
} from "../../recovery-control/src/index.js";

export interface DesktopHostClientPersistence {
  checkpointStore?: CheckpointStore & Partial<CheckpointLookup>;
  auditStore?: AuditStore;
  memoryAdapter?: MemoryAdapter;
  memoryRecall?: CheckpointRecallAdapter;
  memoryOverviewProvider?: MemoryOverviewProvider;
  telemetryStore?: TelemetrySink;
}

export interface DesktopHostClientOptions {
  policy: PolicySnapshot;
  preflight: Omit<PreflightContext, "requiredTools" | "requestedToolAccess">;
  bridge?: DesktopHostBridge;
  bridgeBindings?: DesktopHostBindings;
  persistence?: DesktopHostClientPersistence;
  codexCliOptions?: CodexCliProcessRunOptions;
  availableAgents?: number;
  stopOnFailure?: boolean;
  observationBus?: ExecutionObservationBus;
  operatorActionReceiptStore?: GovernanceOperatorActionReceiptStore;
  governanceState?: GovernanceState;
  onGovernanceUpdate?: (state: GovernanceState, strategy: StrategyDecisionV2) => Promise<void>;
  now?: () => string;
}

export interface DesktopHostResumeOptions {
  required?: boolean;
  stage?: string;
  preferredSource?: ResumeSource;
  memoryRecall?: CheckpointRecallAdapter;
  checkpointStore?: CheckpointLookup;
}

export interface DesktopHostOperatorActionReceiptInput {
  envelope?: GovernanceOperatorActionEnvelopeInput;
  receipt: unknown;
  actionIssuedAt?: string | (() => string);
  now?: string | (() => string);
  maxActionAgeMs?: number;
}

export interface DesktopHostCreateOperatorActionReceiptInput {
  envelope?: GovernanceOperatorActionEnvelopeInput;
  decision: GovernanceOperatorActionReceiptDecision;
  operatorIdHash: string;
  actionIssuedAt?: string | (() => string);
  createdAt?: string | (() => string);
  evidenceRefs?: string[];
}

export class DesktopHostClient {
  readonly bridge: DesktopHostBridge;
  private currentGovernanceState: GovernanceState | undefined;
  private currentOperatorActionEnvelope: GovernanceOperatorActionEnvelope | undefined;
  private currentOperatorActionIssuedAt: string | undefined;
  private currentOperatorActionReceiptCreation: DesktopOperatorActionReceiptCreation | undefined;
  private currentOperatorActionReceiptConsumption: DesktopOperatorActionReceiptConsumption | undefined;

  constructor(private readonly options: DesktopHostClientOptions) {
    this.bridge = resolveHostBridge(options);
    this.currentGovernanceState = options.governanceState;
  }

  async run(task: TaskEnvelopeInput): Promise<RunDesktopTaskResult> {
    const result = await runDesktopTask({
      task,
      policy: this.options.policy,
      preflight: this.options.preflight,
      bridge: this.bridge,
      ...(this.options.availableAgents !== undefined
        ? { availableAgents: this.options.availableAgents }
        : {}),
      ...(this.options.stopOnFailure !== undefined
        ? { stopOnFailure: this.options.stopOnFailure }
        : {}),
      ...(this.options.persistence !== undefined
        ? { persistence: buildRunnerPersistence(this.options.persistence) }
        : {}),
      ...(this.options.codexCliOptions !== undefined
        ? { codexCliOptions: this.options.codexCliOptions }
        : {}),
      ...(this.options.observationBus !== undefined
        ? { observationBus: this.options.observationBus }
        : {}),
      ...this.buildGovernanceForwarding(),
      ...(this.options.now !== undefined ? { now: this.options.now } : {})
    });

    this.captureOperatorAction(result);
    return result;
  }

  async resume(
    task: TaskEnvelopeInput,
    options: DesktopHostResumeOptions = {}
  ): Promise<RunDesktopTaskResult> {
    const memoryRecall = options.memoryRecall ?? resolveMemoryRecallAdapter(this.options.persistence);
    const checkpointStore = options.checkpointStore ?? resolveCheckpointLookup(this.options.persistence);
    const resume = {
      ...(memoryRecall !== undefined ? { memoryRecall } : {}),
      ...(checkpointStore !== undefined ? { checkpointStore } : {}),
      ...(options.required !== undefined ? { required: options.required } : {}),
      ...(options.stage !== undefined ? { stage: options.stage } : {}),
      ...(options.preferredSource !== undefined
        ? { preferredSource: options.preferredSource }
        : {})
    };

    const result = await resumeDesktopTask({
      task,
      policy: this.options.policy,
      preflight: this.options.preflight,
      bridge: this.bridge,
      ...(this.options.availableAgents !== undefined
        ? { availableAgents: this.options.availableAgents }
        : {}),
      ...(this.options.stopOnFailure !== undefined
        ? { stopOnFailure: this.options.stopOnFailure }
        : {}),
      ...(this.options.persistence !== undefined
        ? { persistence: buildRunnerPersistence(this.options.persistence) }
        : {}),
      ...(this.options.codexCliOptions !== undefined
        ? { codexCliOptions: this.options.codexCliOptions }
        : {}),
      ...(this.options.observationBus !== undefined
        ? { observationBus: this.options.observationBus }
        : {}),
      ...this.buildGovernanceForwarding(),
      ...(hasResumeConfig(resume) ? { resume } : {}),
      ...(this.options.now !== undefined ? { now: this.options.now } : {})
    });

    this.captureOperatorAction(result);
    return result;
  }

  createOperatorActionReceipt(
    input: DesktopHostCreateOperatorActionReceiptInput
  ): DesktopOperatorActionReceiptCreation {
    const envelope = input.envelope ?? this.currentOperatorActionEnvelope;
    if (envelope === undefined) {
      return createMissingOperatorActionEnvelopeReceiptCreation();
    }

    const actionIssuedAt =
      input.actionIssuedAt ?? (
        input.envelope === undefined ? this.currentOperatorActionIssuedAt : undefined
      );
    if (actionIssuedAt === undefined) {
      return createMissingOperatorActionIssuedAtReceiptCreation();
    }

    const createInput: CreateDesktopOperatorActionReceiptInput = {
      envelope,
      decision: input.decision,
      operatorIdHash: input.operatorIdHash,
      actionIssuedAt,
      createdAt: input.createdAt ?? this.resolveNow,
      ...(input.evidenceRefs !== undefined ? { evidenceRefs: input.evidenceRefs } : {})
    };

    const creation = createDesktopOperatorActionReceipt(createInput);
    if (input.envelope === undefined) {
      this.currentOperatorActionReceiptCreation = creation;
      this.currentOperatorActionReceiptConsumption = undefined;
    }

    return creation;
  }

  async consumeOperatorActionReceipt(
    input: DesktopHostOperatorActionReceiptInput
  ): Promise<DesktopOperatorActionReceiptConsumption> {
    const envelope = input.envelope ?? this.currentOperatorActionEnvelope;
    if (envelope === undefined) {
      return createMissingOperatorActionEnvelopeConsumption();
    }

    const consumeInput: ConsumeDesktopOperatorActionReceiptInput = {
      ...(this.options.operatorActionReceiptStore !== undefined
        ? { store: this.options.operatorActionReceiptStore }
        : {}),
      envelope,
      receipt: input.receipt,
      ...(input.actionIssuedAt !== undefined
        ? { actionIssuedAt: input.actionIssuedAt }
        : input.envelope === undefined && this.currentOperatorActionIssuedAt !== undefined
          ? { actionIssuedAt: this.currentOperatorActionIssuedAt }
          : {}),
      now: input.now ?? this.options.now ?? (() => new Date().toISOString()),
      ...(input.maxActionAgeMs !== undefined ? { maxActionAgeMs: input.maxActionAgeMs } : {})
    };

    const consumption = await consumeDesktopOperatorActionReceipt(consumeInput);
    if (input.envelope === undefined) {
      this.currentOperatorActionReceiptConsumption = consumption;
    }

    return consumption;
  }

  getOperatorActionLifecycle(): DesktopOperatorActionLifecycleState {
    return createDesktopOperatorActionLifecycleState({
      ...(this.currentOperatorActionEnvelope !== undefined
        ? { envelope: this.currentOperatorActionEnvelope }
        : {}),
      ...(this.currentOperatorActionIssuedAt !== undefined
        ? { actionIssuedAt: this.currentOperatorActionIssuedAt }
        : {}),
      ...(this.currentOperatorActionReceiptCreation !== undefined
        ? { lastReceiptCreation: this.currentOperatorActionReceiptCreation }
        : {}),
      ...(this.currentOperatorActionReceiptConsumption !== undefined
        ? { lastReceiptConsumption: this.currentOperatorActionReceiptConsumption }
        : {})
    });
  }

  private captureOperatorAction(result: RunDesktopTaskResult): void {
    this.currentOperatorActionEnvelope = result.operatorActionEnvelope;
    this.currentOperatorActionIssuedAt =
      result.operatorActionEnvelope === undefined ? undefined : this.resolveNow();
    this.currentOperatorActionReceiptCreation = undefined;
    this.currentOperatorActionReceiptConsumption = undefined;
  }

  private resolveNow = (): string => (
    this.options.now === undefined
      ? new Date().toISOString()
      : this.options.now()
  );

  private buildGovernanceForwarding(): {
    governanceState?: GovernanceState;
    onGovernanceUpdate?: (state: GovernanceState, strategy: StrategyDecisionV2) => Promise<void>;
  } {
    if (
      this.currentGovernanceState === undefined &&
      this.options.onGovernanceUpdate === undefined
    ) {
      return {};
    }

    return {
      ...(this.currentGovernanceState !== undefined
        ? { governanceState: this.currentGovernanceState }
        : {}),
      onGovernanceUpdate: async (state, strategy) => {
        this.currentGovernanceState = state;
        if (this.options.onGovernanceUpdate !== undefined) {
          await this.options.onGovernanceUpdate(state, strategy);
        }
      }
    };
  }
}

function createMissingOperatorActionEnvelopeReceiptCreation(): DesktopOperatorActionReceiptCreation {
  return {
    schemaVersion: "desktop-operator-action-receipt-creation.v1",
    status: "blocked",
    reasons: ["operator_action_receipt_envelope_missing"]
  };
}

function createMissingOperatorActionIssuedAtReceiptCreation(): DesktopOperatorActionReceiptCreation {
  return {
    schemaVersion: "desktop-operator-action-receipt-creation.v1",
    status: "blocked",
    reasons: ["operator_action_receipt_action_issued_at_required"]
  };
}

function createMissingOperatorActionEnvelopeConsumption(): DesktopOperatorActionReceiptConsumption {
  return {
    schemaVersion: "desktop-operator-action-receipt-consumption.v1",
    status: "blocked",
    durable: false,
    reasons: ["operator_action_receipt_envelope_missing"],
    validation: {
      schemaVersion: "governance-operator-action-receipt-validation.v1",
      status: "blocked",
      reasons: ["operator_action_receipt_envelope_missing"]
    }
  };
}

export function createDesktopHostClient(
  options: DesktopHostClientOptions
): DesktopHostClient {
  return new DesktopHostClient(options);
}

function resolveHostBridge(options: DesktopHostClientOptions): DesktopHostBridge {
  if (options.bridge) {
    return options.bridge;
  }

  if (options.bridgeBindings) {
    return createHostBridgeFromBindings(options.bridgeBindings);
  }

  throw new Error("desktop_host_client_requires_bridge_or_bindings");
}

function buildRunnerPersistence(
  persistence: DesktopHostClientPersistence
): {
  checkpointStore?: CheckpointStore;
  auditStore?: AuditStore;
  memoryAdapter?: MemoryAdapter;
  memoryOverviewProvider?: MemoryOverviewProvider;
  telemetryStore?: TelemetrySink;
} {
  return {
    ...(persistence.checkpointStore !== undefined
      ? { checkpointStore: persistence.checkpointStore }
      : {}),
    ...(persistence.auditStore !== undefined
      ? { auditStore: persistence.auditStore }
      : {}),
    ...(persistence.memoryAdapter !== undefined
      ? { memoryAdapter: persistence.memoryAdapter }
      : {}),
    ...(persistence.memoryOverviewProvider !== undefined
      ? { memoryOverviewProvider: persistence.memoryOverviewProvider }
      : {}),
    ...(persistence.telemetryStore !== undefined
      ? { telemetryStore: persistence.telemetryStore }
      : {})
  };
}

function resolveCheckpointLookup(
  persistence: DesktopHostClientPersistence | undefined
): CheckpointLookup | undefined {
  const checkpointStore = persistence?.checkpointStore;
  if (!checkpointStore || !hasCheckpointLookup(checkpointStore)) {
    return undefined;
  }

  return checkpointStore;
}

function resolveMemoryRecallAdapter(
  persistence: DesktopHostClientPersistence | undefined
): CheckpointRecallAdapter | undefined {
  if (persistence?.memoryRecall) {
    return persistence.memoryRecall;
  }

  const memoryAdapter = persistence?.memoryAdapter;
  if (!memoryAdapter || !("recallLatestCheckpointRef" in memoryAdapter)) {
    return undefined;
  }

  return typeof memoryAdapter.recallLatestCheckpointRef === "function"
    ? memoryAdapter as CheckpointRecallAdapter
    : undefined;
}

function hasResumeConfig(
  resume: {
    memoryRecall?: CheckpointRecallAdapter;
    checkpointStore?: CheckpointLookup;
    required?: boolean;
    stage?: string;
    preferredSource?: ResumeSource;
  }
): boolean {
  return (
    resume.memoryRecall !== undefined
    || resume.checkpointStore !== undefined
    || resume.required !== undefined
    || resume.stage !== undefined
    || resume.preferredSource !== undefined
  );
}

function hasCheckpointLookup(
  checkpointStore: CheckpointStore & Partial<CheckpointLookup>
): checkpointStore is CheckpointStore & CheckpointLookup {
  return typeof checkpointStore.findLatestForTask === "function";
}
