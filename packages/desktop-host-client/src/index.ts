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
  createHostBridgeFromBindings,
  resumeDesktopTask,
  runDesktopTask,
  type DesktopHostBindings,
  type DesktopHostBridge,
  type RunDesktopTaskResult
} from "../../desktop-live-adapter/src/index.js";

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

export class DesktopHostClient {
  readonly bridge: DesktopHostBridge;

  constructor(private readonly options: DesktopHostClientOptions) {
    this.bridge = resolveHostBridge(options);
  }

  async run(task: TaskEnvelopeInput): Promise<RunDesktopTaskResult> {
    return runDesktopTask({
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
      ...(this.options.governanceState !== undefined
        ? { governanceState: this.options.governanceState }
        : {}),
      ...(this.options.onGovernanceUpdate !== undefined
        ? { onGovernanceUpdate: this.options.onGovernanceUpdate }
        : {}),
      ...(this.options.now !== undefined ? { now: this.options.now } : {})
    });
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

    return resumeDesktopTask({
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
      ...(this.options.governanceState !== undefined
        ? { governanceState: this.options.governanceState }
        : {}),
      ...(this.options.onGovernanceUpdate !== undefined
        ? { onGovernanceUpdate: this.options.onGovernanceUpdate }
        : {}),
      ...(hasResumeConfig(resume) ? { resume } : {}),
      ...(this.options.now !== undefined ? { now: this.options.now } : {})
    });
  }
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
