import { randomUUID } from "node:crypto";
import type { AuditEvent, MemoryOverviewProvider } from "../../audit-memory/src/index.js";
import type { CodexCliProcessRunOptions } from "../../codex-cli-host/src/index.js";
import { CodexMemoryAdapter, type CodexMemoryClient, type CodexMemorySearchInput, type CodexMemorySearchResponse, type CodexMemoryTarget, type CodexMemoryWriteInput, type CodexMemoryWriteResponse } from "../../codex-memory-adapter/src/index.js";
import { FileCheckpointIndex } from "../../checkpoint-index/src/index.js";
import type { CheckpointRef, DesktopPrimitive, RoutingDecision, TaskEnvelopeInput } from "../../contracts/src/index.js";
import {
  getTelemetryAlertDeliveryThresholdPreset,
  getTelemetryAlertDeliveryWindowPolicy,
  getTelemetryAlertThresholdPreset,
  type TelemetryAlertDeliveryWindowPolicy as PolicyTelemetryAlertDeliveryWindowPolicy,
  type TelemetryAlertDeliveryWindowPresetName,
  type TelemetryAlertThresholds as PolicyTelemetryAlertThresholds,
  type PolicySnapshot,
  type TelemetryAlertThresholdPresetName,
  resolveTelemetryAlertDeliveryWindowPolicy
} from "../../policy-config/src/index.js";
import {
  createFanoutTelemetryAlertSink,
  createRecordingTelemetryAlertDeliveryMetricsCollector,
  createRecordingTelemetryAlertDeliveryWindowStore,
  createTelemetryDeliveryAlertLogEvents,
  evaluateTelemetryAlertDeliveryAlerts,
  createFanoutTelemetrySink,
  createRecordingTelemetryAlertSink,
  createRecordingTelemetryDeliveryMetricsCollector,
  createRecordingTelemetrySink,
  evaluateTelemetryDeliveryAlerts,
  emitTelemetryAlerts,
  createPersistedTelemetryAlertDeliveryWindowStore,
  type FanoutTelemetryAlertSinkEntry,
  type FanoutTelemetryAlertSinkOptions,
  type LogEvent,
  type RecordingTelemetryAlertSink,
  type RecordingTelemetryAlertDeliveryWindowStore,
  type TelemetryAlertDeliverySuppression,
  type TelemetryAlertDeliveryWindowPolicy,
  type TelemetryAlertDeliveryWindowStore,
  type TelemetryAlertDeliveryMetricsCollector,
  type TelemetryAlertDeliveryMetricsSnapshot,
  type RecordingTelemetrySink,
  type FanoutTelemetrySinkEntry,
  type FanoutTelemetrySinkOptions,
  type TelemetryAlertSink,
  type TelemetryDeliveryAlert,
  type TelemetryDeliveryAlertThresholdScope,
  type TelemetryDeliveryAlertThresholds,
  type TelemetryDeliveryAlertThresholdValues,
  type TelemetryDeliveryMetricsCollector,
  type TelemetryDeliveryMetricsSnapshot,
  type TelemetrySink,
  partitionTelemetryAlertsForDelivery
} from "../../observability/src/index.js";
import {
  createHostBridgeFromBindings,
  createPrimitiveFailureEnvelope,
  createPrimitiveSuccessEnvelope,
  resumeDesktopTask,
  runDesktopTask,
  type DesktopHostBindings,
  type DesktopHostBridge,
  type RunDesktopTaskResult
} from "../../desktop-live-adapter/src/index.js";
import {
  createRecordingExecutionObservationStore,
  type ExecutionObservation,
  type ExecutionObservationBus,
  type ExecutionObservationStore
} from "../../execution-observation/src/index.js";
import type { GovernanceState } from "../../state-manager/src/index.js";
import type { StrategyDecisionV2 } from "../../strategy-router/src/index.js";
export {
  createCodexDesktopTargetHostEmbeddingStarter,
  getCodexDesktopTargetHostEmbeddingStatus,
  type CodexDesktopTargetHostEmbeddingStarter,
  type CodexDesktopTargetHostEmbeddingStatus,
  type CodexDesktopTargetHostEmbeddingStarterOptions
} from "./target-host-embedding-starter.js";
export {
  assertCodexDesktopTargetHostObjectContract,
  createCodexDesktopTargetHostObjectContract,
  getCodexDesktopTargetHostPlaceholderMethods,
  inspectCodexDesktopTargetHostObjectContract,
  CODEX_DESKTOP_TARGET_HOST_OPTIONAL_MEMORY_METHODS,
  CODEX_DESKTOP_TARGET_HOST_REQUIRED_MEMORY_METHODS,
  CODEX_DESKTOP_TARGET_HOST_REQUIRED_RUNTIME_METHODS,
  type CodexDesktopTargetHostContractInspection,
  type CodexDesktopTargetHostOverrides
} from "./target-host-object-contract.js";
export {
  createCodexDesktopTargetHostDirectives,
  createCodexDesktopTargetHostLayerSkeleton,
  type CodexDesktopTargetHostDirectiveBuilders,
  type CodexDesktopTargetHostLayerSkeletonOptions
} from "./target-host-layer-skeleton.js";

export interface ExamplePreflightConfig {
  authAvailable?: boolean;
  availableTools?: string[];
  workspaceClean?: boolean;
  protectedBranch?: boolean;
}

export interface ExampleHostClientOptions {
  policy: PolicySnapshot;
  anchor?: string;
  memoryTarget?: CodexMemoryTarget;
  checkpointStorePath?: string;
  availableAgents?: number;
  bridge?: DesktopHostBridge;
  bridgeBindings?: DesktopHostBindings;
  codexCliOptions?: CodexCliProcessRunOptions;
  memoryClient?: CodexMemoryClient;
  disableTelemetry?: boolean;
  telemetrySink?: TelemetrySink | FanoutTelemetrySinkEntry;
  telemetryFanoutOptions?: Omit<FanoutTelemetrySinkOptions, "metricsCollector">;
  telemetryAlertSink?: TelemetryAlertSink | FanoutTelemetryAlertSinkEntry;
  telemetryAlertFanoutOptions?: Omit<FanoutTelemetryAlertSinkOptions, "metricsCollector">;
  telemetryMetricsCollector?: TelemetryDeliveryMetricsCollector;
  telemetryAlertPreset?: TelemetryAlertThresholdPresetName;
  telemetryAlertThresholds?: TelemetryDeliveryAlertThresholds;
  telemetryAlertDeliveryMetricsCollector?: TelemetryAlertDeliveryMetricsCollector;
  telemetryAlertDeliveryAlertPreset?: TelemetryAlertThresholdPresetName;
  telemetryAlertDeliveryAlertThresholds?: TelemetryDeliveryAlertThresholds;
  telemetryAlertDeliveryWindowPolicy?: TelemetryAlertDeliveryWindowPolicy;
  telemetryAlertDeliveryWindowPreset?: TelemetryAlertDeliveryWindowPresetName;
  telemetryAlertDeliveryWindowStorePath?: string;
  telemetryAlertDeliveryWindowStore?: TelemetryAlertDeliveryWindowStore;
  observationBus?: ExecutionObservationBus;
  observationStore?: ExecutionObservationStore;
  governanceState?: GovernanceState;
  onGovernanceUpdate?: (state: GovernanceState, strategy: StrategyDecisionV2) => Promise<void>;
  preflight?: ExamplePreflightConfig;
  now?: () => string;
}

export interface ExampleResumeOptions {
  required?: boolean;
  stage?: string;
  preferredSource?: "memory" | "checkpoint";
}

interface StoredMemoryEntry {
  memoryId: string;
  input: CodexMemoryWriteInput;
  createdAt: string;
}

interface ExampleCheckpointStore {
  record(checkpoint: CheckpointRef): Promise<void>;
  findLatestForTask(taskId: string): Promise<CheckpointRef | undefined>;
  loadAll(): Promise<CheckpointRef[]>;
}

class InMemoryCodexMemoryClient implements CodexMemoryClient {
  private readonly entries: StoredMemoryEntry[] = [];

  constructor(
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async recordMemory(input: CodexMemoryWriteInput): Promise<CodexMemoryWriteResponse> {
    const memoryId = `memory-${randomUUID()}`;
    this.entries.push({
      memoryId,
      input,
      createdAt: this.now()
    });

    return {
      success: true,
      memoryId,
      filePath: `memory://${memoryId}`
    };
  }

  async searchMemory(input: CodexMemorySearchInput): Promise<CodexMemorySearchResponse> {
    const queryTokens = tokenize(input.query);
    const results = this.entries
      .map((entry) => {
        const haystack = [
          entry.input.title,
          entry.input.content,
          entry.input.evidence,
          entry.input.tags ?? ""
        ].join("\n").toLowerCase();
        const score = queryTokens.reduce((total, token) => (
          haystack.includes(token) ? total + 1 : total
        ), 0);

        return {
          entry,
          score
        };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || right.entry.createdAt.localeCompare(left.entry.createdAt))
      .slice(0, input.limit ?? 5)
      .map(({ entry, score }) => ({
        target: entry.input.target,
        title: entry.input.title,
        memoryId: entry.memoryId,
        score,
        sourceFile: `memory://${entry.memoryId}`,
        matchedTags: (entry.input.tags ?? "").split(",").filter(Boolean),
        snippet: entry.input.content.split("\n")[0] ?? "",
        ...(input.includeContent ? { content: entry.input.content } : {}),
        createdAt: entry.createdAt,
        updatedAt: entry.createdAt
      }));

    return { results };
  }

  async loadAll(): Promise<StoredMemoryEntry[]> {
    return [...this.entries];
  }
}

class InMemoryCheckpointStore {
  private readonly checkpoints: CheckpointRef[] = [];

  async record(checkpoint: CheckpointRef): Promise<void> {
    this.checkpoints.push(checkpoint);
  }

  async findLatestForTask(taskId: string): Promise<CheckpointRef | undefined> {
    return [...this.checkpoints]
      .filter((checkpoint) => checkpoint.taskId === taskId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  }

  async loadAll(): Promise<CheckpointRef[]> {
    return [...this.checkpoints];
  }
}

class InMemoryAuditStore {
  private readonly events: AuditEvent[] = [];

  async record(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }

  async loadAll(): Promise<AuditEvent[]> {
    return [...this.events];
  }
}

export class ExampleDesktopHostClient {
  readonly memoryClient: CodexMemoryClient;
  readonly memoryAdapter: CodexMemoryAdapter;
  readonly checkpointStore: ExampleCheckpointStore;
  readonly auditStore: InMemoryAuditStore;
  readonly telemetryStore: RecordingTelemetrySink | undefined;
  readonly telemetryAlertStore: RecordingTelemetryAlertSink | undefined;
  readonly executionTelemetrySink: TelemetrySink | undefined;
  readonly executionTelemetryAlertSink: TelemetryAlertSink | undefined;
  readonly telemetryMetricsCollector: TelemetryDeliveryMetricsCollector | undefined;
  readonly telemetryAlertThresholds: TelemetryDeliveryAlertThresholds | undefined;
  readonly telemetryAlertDeliveryMetricsCollector: TelemetryAlertDeliveryMetricsCollector | undefined;
  readonly telemetryAlertDeliveryAlertThresholds: TelemetryDeliveryAlertThresholds | undefined;
  readonly telemetryAlertDeliveryWindowPolicy: TelemetryAlertDeliveryWindowPolicy | undefined;
  readonly observationBus: ExecutionObservationBus | undefined;
  readonly observationStore: ExecutionObservationStore | undefined;
  telemetryAlertDeliveryWindowStore: TelemetryAlertDeliveryWindowStore | undefined;
  private readonly telemetryAlertDeliveryWindowPreset: TelemetryAlertDeliveryWindowPresetName | undefined;
  readonly bridge: DesktopHostBridge;

  private readonly now: () => string;

  constructor(private readonly options: ExampleHostClientOptions) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.memoryClient = options.memoryClient ?? new InMemoryCodexMemoryClient(this.now);
    this.memoryAdapter = new CodexMemoryAdapter(this.memoryClient, {
      anchor: options.anchor ?? "codex-router@A:/codex-router",
      target: options.memoryTarget ?? "process",
      tags: ["example-host-client"],
      verifyRecall: true
    });
    this.checkpointStore = options.checkpointStorePath
      ? new FileCheckpointIndex(options.checkpointStorePath)
      : new InMemoryCheckpointStore();
    this.auditStore = new InMemoryAuditStore();
    this.telemetryStore = options.disableTelemetry ? undefined : createRecordingTelemetrySink();
    const resolvedTelemetryAlertThresholds = options.disableTelemetry
      ? undefined
      : normalizeTelemetryAlertThresholds(options.telemetryAlertThresholds
        ?? (options.telemetryAlertPreset
          ? getTelemetryAlertThresholdPreset(options.policy, options.telemetryAlertPreset)
          : undefined));
    this.telemetryAlertThresholds = options.disableTelemetry
      ? undefined
      : resolvedTelemetryAlertThresholds;
    const resolvedTelemetryAlertDeliveryAlertThresholds = options.disableTelemetry
      ? undefined
      : normalizeTelemetryAlertThresholds(options.telemetryAlertDeliveryAlertThresholds
        ?? (options.telemetryAlertDeliveryAlertPreset
          ? getTelemetryAlertDeliveryThresholdPreset(options.policy, options.telemetryAlertDeliveryAlertPreset)
          : undefined));
    this.telemetryMetricsCollector = options.disableTelemetry
      ? undefined
      : options.telemetryMetricsCollector
        ?? (this.telemetryAlertThresholds
          ? createRecordingTelemetryDeliveryMetricsCollector()
          : undefined);
    this.telemetryAlertDeliveryAlertThresholds = options.disableTelemetry
      ? undefined
      : resolvedTelemetryAlertDeliveryAlertThresholds;
    this.telemetryAlertDeliveryMetricsCollector = options.disableTelemetry
      ? undefined
      : options.telemetryAlertDeliveryMetricsCollector
        ?? (this.telemetryAlertDeliveryAlertThresholds
          ? createRecordingTelemetryAlertDeliveryMetricsCollector()
          : undefined);
    this.telemetryAlertDeliveryWindowPolicy = options.disableTelemetry
      ? undefined
      : normalizeTelemetryAlertDeliveryWindowPolicy(options.telemetryAlertDeliveryWindowPolicy);
    this.telemetryAlertDeliveryWindowPreset = options.disableTelemetry
      ? undefined
      : options.telemetryAlertDeliveryWindowPreset;
    this.telemetryAlertDeliveryWindowStore = options.disableTelemetry
      ? undefined
      : options.telemetryAlertDeliveryWindowStore
        ?? (options.telemetryAlertDeliveryWindowStorePath
          ? createPersistedTelemetryAlertDeliveryWindowStore({
            path: options.telemetryAlertDeliveryWindowStorePath,
            ...(options.now !== undefined ? { now: options.now } : {})
          })
          : (this.telemetryAlertDeliveryWindowPolicy || this.telemetryAlertDeliveryWindowPreset
            ? createRecordingTelemetryAlertDeliveryWindowStore()
            : undefined));
    this.observationStore = options.observationStore
      ?? (options.observationBus ? undefined : createRecordingExecutionObservationStore());
    this.observationBus = options.observationBus ?? this.observationStore;
    this.executionTelemetrySink = options.disableTelemetry
      ? undefined
      : options.telemetrySink || this.telemetryMetricsCollector
        ? createFanoutTelemetrySink([this.telemetryStore, options.telemetrySink], {
          ...(options.telemetryFanoutOptions ?? {}),
          ...(this.telemetryMetricsCollector
            ? { metricsCollector: this.telemetryMetricsCollector }
            : {})
        })
        : this.telemetryStore;
    this.telemetryAlertStore = options.disableTelemetry || !this.telemetryAlertThresholds
      ? undefined
      : createRecordingTelemetryAlertSink();
    this.executionTelemetryAlertSink = options.disableTelemetry || !this.telemetryAlertStore
      ? undefined
      : options.telemetryAlertSink
        ? createFanoutTelemetryAlertSink(
          [this.telemetryAlertStore, options.telemetryAlertSink],
          {
            ...(options.telemetryAlertFanoutOptions ?? {}),
            ...(this.telemetryAlertDeliveryMetricsCollector
              ? { metricsCollector: this.telemetryAlertDeliveryMetricsCollector }
              : {})
          }
        )
        : this.telemetryAlertStore;
    this.bridge = options.bridge ?? createExampleHostBridge(options.bridgeBindings);
  }

  async run(task: TaskEnvelopeInput): Promise<RunDesktopTaskResult> {
    const result = await runDesktopTask({
      task,
      policy: this.options.policy,
      preflight: this.buildPreflight(),
      availableAgents: this.options.availableAgents ?? 2,
      persistence: this.buildPersistence(),
      bridge: this.bridge,
      ...(this.observationBus !== undefined ? { observationBus: this.observationBus } : {}),
      ...(this.options.governanceState !== undefined
        ? { governanceState: this.options.governanceState }
        : {}),
      ...(this.options.onGovernanceUpdate !== undefined
        ? { onGovernanceUpdate: this.options.onGovernanceUpdate }
        : {}),
      ...(this.options.codexCliOptions !== undefined
        ? { codexCliOptions: this.options.codexCliOptions }
        : {}),
      now: this.now
    });

    await this.flushTelemetryAlerts(result.decisionResult.decision);
    return result;
  }

  async resume(
    task: TaskEnvelopeInput,
    options: ExampleResumeOptions = {}
  ): Promise<RunDesktopTaskResult> {
    const result = await resumeDesktopTask({
      task,
      policy: this.options.policy,
      preflight: this.buildPreflight(),
      availableAgents: this.options.availableAgents ?? 2,
      persistence: this.buildPersistence(),
      resume: {
        memoryRecall: this.memoryAdapter,
        checkpointStore: this.checkpointStore,
        ...(options.required !== undefined ? { required: options.required } : {}),
        ...(options.stage !== undefined ? { stage: options.stage } : {}),
        ...(options.preferredSource !== undefined ? { preferredSource: options.preferredSource } : {})
      },
      bridge: this.bridge,
      ...(this.observationBus !== undefined ? { observationBus: this.observationBus } : {}),
      ...(this.options.governanceState !== undefined
        ? { governanceState: this.options.governanceState }
        : {}),
      ...(this.options.onGovernanceUpdate !== undefined
        ? { onGovernanceUpdate: this.options.onGovernanceUpdate }
        : {}),
      ...(this.options.codexCliOptions !== undefined
        ? { codexCliOptions: this.options.codexCliOptions }
        : {}),
      now: this.now
    });

    await this.flushTelemetryAlerts(result.decisionResult.decision);
    return result;
  }

  async getState(): Promise<{
    memoryEntries: StoredMemoryEntry[];
    checkpoints: CheckpointRef[];
    auditEvents: AuditEvent[];
    telemetryEvents: LogEvent[];
    telemetryMetrics: TelemetryDeliveryMetricsSnapshot | undefined;
    telemetryAlerts: TelemetryDeliveryAlert[] | undefined;
    telemetryAlertEvents: LogEvent[];
    telemetryAlertDeliveryMetrics: TelemetryAlertDeliveryMetricsSnapshot | undefined;
    telemetryAlertDeliveryAlerts: TelemetryDeliveryAlert[] | undefined;
    telemetryAlertDeliveryAlertEvents: LogEvent[];
    telemetryAlertDeliverySuppressions: TelemetryAlertDeliverySuppression[];
    observations: ExecutionObservation[];
  }> {
    const telemetryMetrics = this.telemetryMetricsCollector
      ? await this.telemetryMetricsCollector.loadSnapshot()
      : undefined;
    const telemetryAlerts = this.telemetryAlertStore
      ? await this.telemetryAlertStore.loadAll()
      : undefined;
    const telemetryAlertDeliveryMetrics = this.telemetryAlertDeliveryMetricsCollector
      ? await this.telemetryAlertDeliveryMetricsCollector.loadSnapshot()
      : undefined;
    const telemetryAlertDeliveryAlerts = telemetryAlertDeliveryMetrics && this.telemetryAlertDeliveryAlertThresholds
      ? evaluateTelemetryAlertDeliveryAlerts(
        telemetryAlertDeliveryMetrics,
        this.telemetryAlertDeliveryAlertThresholds
      )
      : undefined;
    const telemetryAlertDeliverySuppressions = this.telemetryAlertDeliveryWindowStore
      && "loadSuppressions" in this.telemetryAlertDeliveryWindowStore
      && typeof this.telemetryAlertDeliveryWindowStore.loadSuppressions === "function"
      ? await (this.telemetryAlertDeliveryWindowStore as RecordingTelemetryAlertDeliveryWindowStore).loadSuppressions()
      : [];

    return {
      memoryEntries: "loadAll" in this.memoryClient && typeof this.memoryClient.loadAll === "function"
        ? await (this.memoryClient as InMemoryCodexMemoryClient).loadAll()
        : [],
      checkpoints: await this.checkpointStore.loadAll(),
      auditEvents: await this.auditStore.loadAll(),
      telemetryEvents: this.telemetryStore ? await this.telemetryStore.loadAll() : [],
      telemetryMetrics,
      telemetryAlerts,
      telemetryAlertEvents: telemetryAlerts
        ? createTelemetryDeliveryAlertLogEvents(telemetryAlerts, {
          source: "example-host-client"
        })
        : [],
      telemetryAlertDeliveryMetrics,
      telemetryAlertDeliveryAlerts,
      telemetryAlertDeliveryAlertEvents: telemetryAlertDeliveryAlerts
        ? createTelemetryDeliveryAlertLogEvents(telemetryAlertDeliveryAlerts, {
          source: "example-host-client-alert-delivery"
        })
        : [],
      telemetryAlertDeliverySuppressions,
      observations: this.observationStore ? await this.observationStore.loadAll() : []
    };
  }

  private resolveTelemetryAlertDeliveryWindowPolicy(
    decision: RoutingDecision
  ): TelemetryAlertDeliveryWindowPolicy {
    if (this.options.telemetryAlertDeliveryWindowPolicy) {
      return normalizeTelemetryAlertDeliveryWindowPolicy(this.options.telemetryAlertDeliveryWindowPolicy);
    }

    if (this.telemetryAlertDeliveryWindowPreset) {
      return normalizeTelemetryAlertDeliveryWindowPolicy(getTelemetryAlertDeliveryWindowPolicy(
        this.options.policy,
        this.telemetryAlertDeliveryWindowPreset
      ));
    }

    return normalizeTelemetryAlertDeliveryWindowPolicy(resolveTelemetryAlertDeliveryWindowPolicy(
      this.options.policy,
      decision.execution.toolAccess
    ).policy);
  }

  private getTelemetryAlertDeliveryWindowStore(): TelemetryAlertDeliveryWindowStore | undefined {
    if (this.telemetryAlertDeliveryWindowStore) {
      return this.telemetryAlertDeliveryWindowStore;
    }

    if (this.options.disableTelemetry) {
      return undefined;
    }

    this.telemetryAlertDeliveryWindowStore = this.options.telemetryAlertDeliveryWindowStorePath
      ? createPersistedTelemetryAlertDeliveryWindowStore({
        path: this.options.telemetryAlertDeliveryWindowStorePath,
        ...(this.options.now !== undefined ? { now: this.options.now } : {})
      })
      : createRecordingTelemetryAlertDeliveryWindowStore();
    return this.telemetryAlertDeliveryWindowStore;
  }

  private async flushTelemetryAlerts(decision: RoutingDecision): Promise<void> {
    if (!this.executionTelemetryAlertSink || !this.telemetryMetricsCollector || !this.telemetryAlertThresholds) {
      return;
    }

    const snapshot = await this.telemetryMetricsCollector.loadSnapshot();
    const alerts = evaluateTelemetryDeliveryAlerts(snapshot, this.telemetryAlertThresholds);

    if (alerts.length === 0) {
      return;
    }

    const windowStore = this.telemetryAlertDeliveryWindowStore
      ?? this.getTelemetryAlertDeliveryWindowStore();

    const deliverableAlerts = windowStore
      ? (await partitionTelemetryAlertsForDelivery(
        alerts,
        windowStore,
        this.resolveTelemetryAlertDeliveryWindowPolicy(decision),
        this.now()
      )).deliverableAlerts
      : alerts;

    if (deliverableAlerts.length === 0) {
      return;
    }

    await emitTelemetryAlerts(this.executionTelemetryAlertSink, deliverableAlerts);
  }

  private buildPreflight(): ExamplePreflightConfig & {
    authAvailable: boolean;
    availableTools: string[];
  } {
    return {
      authAvailable: this.options.preflight?.authAvailable ?? true,
      availableTools: this.options.preflight?.availableTools ?? [
        "read_thread_terminal",
        "spawn_agent",
        "wait_agent",
        "send_input",
        "shell_command",
        "apply_patch",
        "automation_update",
        "close_agent"
      ],
      ...(this.options.preflight?.workspaceClean !== undefined
        ? { workspaceClean: this.options.preflight.workspaceClean }
        : {}),
      ...(this.options.preflight?.protectedBranch !== undefined
        ? { protectedBranch: this.options.preflight.protectedBranch }
        : {})
    };
  }

  private getMemoryOverviewProvider(): MemoryOverviewProvider | undefined {
    if ("memoryOverview" in this.memoryClient && typeof this.memoryClient.memoryOverview === "function") {
      return this.memoryClient as MemoryOverviewProvider;
    }

    return undefined;
  }

  private buildPersistence(): {
    checkpointStore: ExampleCheckpointStore;
    auditStore: InMemoryAuditStore;
    memoryAdapter: CodexMemoryAdapter;
    telemetryStore?: TelemetrySink;
    memoryOverviewProvider?: MemoryOverviewProvider;
  } {
    const persistence = {
      checkpointStore: this.checkpointStore,
      auditStore: this.auditStore,
      memoryAdapter: this.memoryAdapter,
      ...(this.executionTelemetrySink ? { telemetryStore: this.executionTelemetrySink } : {})
    };
    const memoryOverviewProvider = this.getMemoryOverviewProvider();

    if (!memoryOverviewProvider) {
      return persistence;
    }

    return {
      ...persistence,
      memoryOverviewProvider
    };
  }
}

export function createExampleDesktopHostClient(
  options: ExampleHostClientOptions
): ExampleDesktopHostClient {
  return new ExampleDesktopHostClient(options);
}

function normalizeTelemetryAlertThresholds(
  thresholds: TelemetryDeliveryAlertThresholds | PolicyTelemetryAlertThresholds | undefined
): TelemetryDeliveryAlertThresholds | undefined {
  if (!thresholds) {
    return undefined;
  }

  return {
    ...(thresholds.warn
      ? {
        warn: normalizeTelemetryAlertThresholdScope(thresholds.warn)
      }
      : {}),
    ...(thresholds.error
      ? {
        error: normalizeTelemetryAlertThresholdScope(thresholds.error)
      }
      : {})
  };
}

function normalizeTelemetryAlertThresholdScope(
  scope: TelemetryDeliveryAlertThresholdScope | PolicyTelemetryAlertThresholds["warn"]
): TelemetryDeliveryAlertThresholdScope {
  return {
    ...(scope?.totals
      ? { totals: normalizeTelemetryAlertThresholdValues(scope.totals) }
      : {}),
    ...(scope?.perSink
      ? { perSink: normalizeTelemetryAlertThresholdValues(scope.perSink) }
      : {})
  };
}

function normalizeTelemetryAlertThresholdValues(
  values: {
    failures?: number | undefined;
    timeouts?: number | undefined;
    retries?: number | undefined;
    failureRate?: number | undefined;
    timeoutRate?: number | undefined;
  } | undefined
): TelemetryDeliveryAlertThresholdValues {
  if (!values) {
    return {};
  }

  return {
    ...(values.failures !== undefined ? { failures: values.failures } : {}),
    ...(values.timeouts !== undefined ? { timeouts: values.timeouts } : {}),
    ...(values.retries !== undefined ? { retries: values.retries } : {}),
    ...(values.failureRate !== undefined ? { failureRate: values.failureRate } : {}),
    ...(values.timeoutRate !== undefined ? { timeoutRate: values.timeoutRate } : {})
  };
}

function normalizeTelemetryAlertDeliveryWindowPolicy(
  policy: TelemetryAlertDeliveryWindowPolicy | PolicyTelemetryAlertDeliveryWindowPolicy | undefined
): TelemetryAlertDeliveryWindowPolicy {
  if (!policy) {
    return {};
  }

  return {
    ...(policy.dedupeWindowMs !== undefined
      ? { dedupeWindowMs: policy.dedupeWindowMs }
      : {}),
    ...(policy.cooldownWindowMs !== undefined
      ? { cooldownWindowMs: policy.cooldownWindowMs }
      : {})
  };
}

export function createExampleHostBridge(
  overrides: DesktopHostBindings = {}
): DesktopHostBridge {
  const defaults: DesktopHostBindings = {
    read_thread_terminal(invocation) {
      return createPrimitiveSuccessEnvelope("read_thread_terminal", {
        terminalOutput: `example terminal snapshot for ${invocation.taskId}`,
        summary: "captured terminal context"
      });
    },
    spawn_agent(invocation) {
      return createPrimitiveSuccessEnvelope("spawn_agent", {
        agentId: `agent-${invocation.stepIndex + 1}`,
        nickname: `ExampleAgent${invocation.stepIndex + 1}`,
        summary: `spawned read-only helper for ${invocation.taskId}`
      });
    },
    wait_agent(invocation) {
      return createPrimitiveSuccessEnvelope("wait_agent", {
        agentId: `agent-${invocation.stepIndex}`,
        agentStatus: "completed",
        agentMessage: `example worker completed for ${invocation.taskId}`
      });
    },
    send_input(invocation) {
      return createPrimitiveSuccessEnvelope("send_input", {
        queued: true,
        interrupted: false,
        summary: `continued task ${invocation.taskId} in current thread`
      });
    },
    close_agent(invocation) {
      return createPrimitiveSuccessEnvelope("close_agent", {
        closed: true,
        previousStatus: "completed",
        summary: `closed helper for ${invocation.taskId}`
      });
    },
    automation_update(invocation) {
      return createPrimitiveSuccessEnvelope("automation_update", {
        automationId: `automation-${invocation.taskId}`,
        automationStatus: "ACTIVE",
        summary: `scheduled follow-up for ${invocation.taskId}`
      });
    },
    shell_command(invocation) {
      return createPrimitiveSuccessEnvelope("shell_command", {
        exitCode: 0,
        stdout: `example shell command executed for ${invocation.taskId}`,
        stderr: ""
      });
    },
    apply_patch(invocation) {
      return createPrimitiveSuccessEnvelope("apply_patch", {
        changedFiles: 1,
        summary: `example patch applied for ${invocation.taskId}`
      });
    }
  };

  return createHostBridgeFromBindings({
    ...defaults,
    ...overrides
  });
}

export function createFailingExampleHostBridge(
  primitive: DesktopPrimitive,
  error: string
): DesktopHostBridge {
  return createExampleHostBridge({
    [primitive]: () => createPrimitiveFailureEnvelope(primitive, error)
  });
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}
