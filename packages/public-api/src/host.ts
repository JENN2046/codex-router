import {
  DesktopHostClient as InternalDesktopHostClient,
  type DesktopHostClientOptions as InternalDesktopHostClientOptions,
  type DesktopHostCreateOperatorActionReceiptInput as InternalDesktopHostCreateOperatorActionReceiptInput,
  type DesktopHostOperatorActionHostExecutorAuthorizationReviewInput as InternalDesktopHostOperatorActionHostExecutorAuthorizationReviewInput,
  type DesktopHostOperatorActionHostExecutorDispatchInput as InternalDesktopHostOperatorActionHostExecutorDispatchInput,
  type DesktopHostOperatorActionReceiptInput as InternalDesktopHostOperatorActionReceiptInput,
  type DesktopHostResumeOptions as InternalDesktopHostResumeOptions
} from "../../desktop-host-client/src/index.js";
import {
  assertCodexDesktopLiveHostObject as assertInternalCodexDesktopLiveHostObject,
  createCodexDesktopLiveHostBundle as createInternalCodexDesktopLiveHostBundle,
  createCodexDesktopLiveHostBundleFromHostObject as createInternalCodexDesktopLiveHostBundleFromHostObject,
  createCodexDesktopLiveHostBundleFromTools as createInternalCodexDesktopLiveHostBundleFromTools,
  createCodexDesktopLiveHostEmbeddingStarter as createInternalCodexDesktopLiveHostEmbeddingStarter,
  createCodexDesktopLiveHostStarter as createInternalCodexDesktopLiveHostStarter,
  getCodexDesktopLiveHostEmbeddingStatus as getInternalCodexDesktopLiveHostEmbeddingStatus,
  getMissingCodexDesktopLiveHostMethods as getInternalMissingCodexDesktopLiveHostMethods,
  inspectCodexDesktopLiveHostObject as inspectInternalCodexDesktopLiveHostObject,
  resolveLiveHostPreflight as resolveInternalLiveHostPreflight,
  resolveLiveHostPreflightFromHost as resolveInternalLiveHostPreflightFromHost
} from "../../codex-desktop-live-host/src/index.js";

export type DesktopHostUnknownRecord = Record<string, unknown>;

export type DesktopHostPrimitive =
  | "spawn_agent"
  | "send_input"
  | "wait_agent"
  | "close_agent"
  | "automation_update"
  | "shell_command"
  | "apply_patch"
  | "read_thread_terminal";

export type DesktopHostAgentRole = "analyst" | "architect" | "worker" | "reviewer";
export type DesktopHostAgentMode = "read_only" | "write";
export type DesktopHostRiskLevel = "low" | "medium" | "high";
export type DesktopHostModelId =
  | "gpt-5.4-mini"
  | "gpt-5.4"
  | "gpt-5.3-codex-spark"
  | "gpt-5.3-codex"
  | "gpt-5.1-codex-max";
export type DesktopHostToolAccessLevel =
  | "read_only"
  | "local_write"
  | "engineering_write"
  | "protected_remote";
export type DesktopHostExecutionProfileName =
  | "recon-only"
  | "clarify-then-plan"
  | "engineering"
  | "high-risk-change"
  | "release-governance";
export type DesktopHostReasoningEffort = "low" | "medium" | "high";
export type DesktopHostParallelismMode = "disabled" | "read_only" | "owned_write";
export type DesktopHostRoute = "desktop" | "codex-cli";
export type DesktopHostRolloutMode =
  | "desktop-first"
  | "shadow"
  | "enforced-local"
  | "protected-remote";
export type DesktopHostMemoryHealthSeverity = "ignore" | "warn" | "block";
export type DesktopHostMemoryHealthPolicyPackName =
  | "read_only"
  | "local_write"
  | "engineering"
  | "release";
export type DesktopHostMemoryCheckpointFrequency =
  | "minimal"
  | "standard"
  | "stage"
  | "dense";
export type DesktopHostTelemetryAlertThresholdPresetName =
  | "read_only"
  | "local_write"
  | "engineering"
  | "release";
export type DesktopHostTelemetryAlertDeliveryWindowPresetName =
  DesktopHostTelemetryAlertThresholdPresetName;

export interface DesktopHostMemoryHealthPolicy {
  overviewUnavailableSeverity: DesktopHostMemoryHealthSeverity;
  codexMcpUnavailableSeverity: DesktopHostMemoryHealthSeverity;
  maxRejectedWrites: number;
  rejectedWritesSeverity: DesktopHostMemoryHealthSeverity;
  maxShadowReconcileCount: number;
  shadowReconcileSeverity: DesktopHostMemoryHealthSeverity;
  recallUnavailableSeverity: DesktopHostMemoryHealthSeverity;
  nonActiveRecallSeverity: DesktopHostMemoryHealthSeverity;
}

export interface DesktopHostMemoryExecutionGuidance {
  memoryRequired: boolean;
  resumeExpected: boolean;
  telemetryMandatory: boolean;
  checkpointFrequency: DesktopHostMemoryCheckpointFrequency;
}

export interface DesktopHostMemoryHealthPolicyPack {
  health: DesktopHostMemoryHealthPolicy;
  guidance: DesktopHostMemoryExecutionGuidance;
}

export interface DesktopHostTelemetryAlertMetricThresholdValues {
  failures?: number;
  timeouts?: number;
  retries?: number;
  failureRate?: number;
  timeoutRate?: number;
}

export interface DesktopHostTelemetryAlertThresholdScope {
  totals?: DesktopHostTelemetryAlertMetricThresholdValues;
  perSink?: DesktopHostTelemetryAlertMetricThresholdValues;
}

export interface DesktopHostTelemetryAlertThresholds {
  warn?: DesktopHostTelemetryAlertThresholdScope;
  error?: DesktopHostTelemetryAlertThresholdScope;
}

export interface DesktopHostTelemetryAlertDeliveryWindowPolicy {
  dedupeWindowMs?: number;
  cooldownWindowMs?: number;
}

export interface DesktopHostPolicySnapshot extends DesktopHostUnknownRecord {
  policyVersion: string;
  rolloutMode: DesktopHostRolloutMode;
  models: Record<DesktopHostTaskClass, DesktopHostModelId>;
  toolPolicies: Record<DesktopHostTaskClass, DesktopHostToolAccessLevel>;
  executionProfiles: Record<DesktopHostTaskClass, DesktopHostExecutionProfileName>;
  hostRoutes: Record<DesktopHostTaskClass, DesktopHostRoute>;
  approvalRules: {
    protectedBranches: string[];
    protectedKeywords: string[];
    protectedToolAccess: DesktopHostToolAccessLevel[];
  };
  escalationRules: {
    failureThreshold: number;
    contextPressureThreshold: number;
    highRiskSticky: boolean;
  };
  memoryHealth: {
    defaultPack: DesktopHostMemoryHealthPolicyPackName;
    packByToolAccess: Record<
      DesktopHostToolAccessLevel,
      DesktopHostMemoryHealthPolicyPackName
    >;
    packs: Record<
      DesktopHostMemoryHealthPolicyPackName,
      DesktopHostMemoryHealthPolicyPack
    >;
  };
  telemetryAlerts: {
    defaultPreset: DesktopHostTelemetryAlertThresholdPresetName;
    presetByToolAccess: Record<
      DesktopHostToolAccessLevel,
      DesktopHostTelemetryAlertThresholdPresetName
    >;
    presets: Record<
      DesktopHostTelemetryAlertThresholdPresetName,
      DesktopHostTelemetryAlertThresholds
    >;
  };
  telemetryAlertDeliveryAlerts: {
    defaultPreset: DesktopHostTelemetryAlertThresholdPresetName;
    presetByToolAccess: Record<
      DesktopHostToolAccessLevel,
      DesktopHostTelemetryAlertThresholdPresetName
    >;
    presets: Record<
      DesktopHostTelemetryAlertThresholdPresetName,
      DesktopHostTelemetryAlertThresholds
    >;
  };
  telemetryAlertDeliveryWindow: {
    defaultPreset: DesktopHostTelemetryAlertDeliveryWindowPresetName;
    presetByToolAccess: Record<
      DesktopHostToolAccessLevel,
      DesktopHostTelemetryAlertDeliveryWindowPresetName
    >;
    presets: Record<
      DesktopHostTelemetryAlertDeliveryWindowPresetName,
      DesktopHostTelemetryAlertDeliveryWindowPolicy
    >;
  };
}

export interface DesktopHostOperation {
  primitive: DesktopHostPrimitive;
  reason: string;
}

export interface DesktopHostExecutionPlan {
  executionProfile: DesktopHostExecutionProfileName;
  primitives: DesktopHostOperation[];
  notes: string[];
}

export interface DesktopHostAgentAssignment {
  role: DesktopHostAgentRole;
  mode: DesktopHostAgentMode;
  ownership?: string[];
}

export interface DesktopHostAgentStrategyPlan {
  parallel: boolean;
  maxAgents: number;
  assignments: DesktopHostAgentAssignment[];
  reasons: string[];
}

export interface DesktopHostRoutingDecision extends DesktopHostUnknownRecord {
  schemaVersion?: "routing-decision.v1";
  decisionId: string;
  taskId: string;
  policyVersion: string;
  classification: {
    taskClass: DesktopHostTaskClass;
    riskLevel: DesktopHostRiskLevel;
    ambiguityScore: number;
    clarificationRequired: boolean;
    riskFactors: string[];
  };
  execution: {
    selectedModel: string;
    toolAccess: DesktopHostToolAccessLevel;
    executionProfile: DesktopHostExecutionProfileName;
    reasoningEffort: DesktopHostReasoningEffort;
  };
  approval: {
    required: boolean;
    reasons: string[];
  };
  parallelism: {
    allowed: boolean;
    maxAgents: number;
    mode: DesktopHostParallelismMode;
  };
  hostRoute: DesktopHostRoute;
  providerGrant?: DesktopHostUnknownRecord;
}

export interface DesktopPrimitiveInvocation extends DesktopHostUnknownRecord {
  task: DesktopHostTaskEnvelopeInput;
  decision: DesktopHostRoutingDecision;
  executionPlan: DesktopHostExecutionPlan;
  agentStrategy: DesktopHostAgentStrategyPlan;
  operation: DesktopHostOperation;
  stepIndex: number;
  primitive: DesktopHostPrimitive;
  taskId: string;
  reason: string;
}

export type DesktopHostBinding = (
  invocation: DesktopPrimitiveInvocation
) => Promise<unknown> | unknown;

export type DesktopHostBindings = Partial<Record<DesktopHostPrimitive, DesktopHostBinding>>;

export interface DesktopHostBridge {
  invokePrimitive(
    invocation: DesktopPrimitiveInvocation
  ): Promise<unknown> | unknown;
}

export interface DesktopHostPreflightContext extends DesktopHostUnknownRecord {
  authAvailable: boolean;
  availableTools: string[];
  workspaceClean?: boolean;
  protectedBranch?: boolean;
  memoryOverview?: DesktopHostUnknownRecord;
  requireMemoryOverview?: boolean;
  memoryOverviewPolicy?: DesktopHostUnknownRecord;
  memoryOverviewPolicyPack?: string;
  memoryExecutionGuidance?: unknown;
}

export interface DesktopHostCheckpointRef {
  checkpointId: string;
  taskId: string;
  stage: string;
  createdAt: string;
  summary: string;
}

export interface DesktopHostAuditEvent {
  type: string;
  taskId: string;
  timestamp: string;
  details: DesktopHostUnknownRecord;
}

export interface DesktopHostLogEvent {
  level: "info" | "warn" | "error";
  message: string;
  correlationId: string;
  context?: DesktopHostUnknownRecord;
}

export interface DesktopHostCheckpointStore {
  record(checkpoint: DesktopHostCheckpointRef): Promise<void> | void;
}

export interface DesktopHostCheckpointLookup {
  findLatestForTask(
    taskId: string
  ): Promise<DesktopHostCheckpointRef | undefined> | DesktopHostCheckpointRef | undefined;
}

export interface DesktopHostAuditStore {
  record(event: DesktopHostAuditEvent): Promise<void> | void;
}

export interface DesktopHostMemoryRecallInput {
  taskId: string;
  stage?: string;
  limit?: number;
  includeContent?: boolean;
}

export interface DesktopHostMemoryAdapter {
  recordCheckpoint(checkpoint: DesktopHostCheckpointRef): Promise<void> | void;
  recallLatestCheckpointRef?(
    input: DesktopHostMemoryRecallInput
  ): Promise<DesktopHostCheckpointRef | undefined> | DesktopHostCheckpointRef | undefined;
}

export interface DesktopHostCheckpointRecallAdapter {
  recallLatestCheckpointRef(
    input: DesktopHostMemoryRecallInput
  ): Promise<DesktopHostCheckpointRef | undefined> | DesktopHostCheckpointRef | undefined;
}

export interface DesktopHostMemoryOverviewProvider {
  memoryOverview(
    input?: CodexMemoryOverviewInput
  ): Promise<DesktopHostUnknownRecord> | DesktopHostUnknownRecord;
}

export interface DesktopHostTelemetrySink {
  record(event: DesktopHostLogEvent): Promise<void> | void;
}

export type DesktopHostControlledWorkspaceWriteProviderDispatchInput = unknown;
export type DesktopHostControlledWorkspaceWriteProviderDispatchResult = unknown;
export type DesktopHostControlledWorkspaceWriteProviderDispatcher = (
  input: DesktopHostControlledWorkspaceWriteProviderDispatchInput
) =>
  | Promise<DesktopHostControlledWorkspaceWriteProviderDispatchResult>
  | DesktopHostControlledWorkspaceWriteProviderDispatchResult;

export interface DesktopHostClientPersistence {
  checkpointStore?: DesktopHostCheckpointStore & Partial<DesktopHostCheckpointLookup>;
  auditStore?: DesktopHostAuditStore;
  memoryAdapter?: DesktopHostMemoryAdapter;
  memoryRecall?: DesktopHostCheckpointRecallAdapter;
  memoryOverviewProvider?: DesktopHostMemoryOverviewProvider;
  telemetryStore?: DesktopHostTelemetrySink;
}

export interface DesktopHostClientOptions {
  policy: DesktopHostPolicySnapshot;
  preflight: DesktopHostPreflightContext;
  bridge?: DesktopHostBridge;
  bridgeBindings?: DesktopHostBindings;
  persistence?: DesktopHostClientPersistence;
  codexCliOptions?: unknown;
  availableAgents?: number;
  stopOnFailure?: boolean;
  observationBus?: unknown;
  operatorActionReceiptStore?: unknown;
  governanceState?: unknown;
  onGovernanceUpdate?: (state: unknown, strategy: unknown) => Promise<void> | void;
  controlledWorkspaceWriteProviderDispatcher?: DesktopHostControlledWorkspaceWriteProviderDispatcher;
  now?: () => string;
}

export type DesktopHostTaskClass =
  | "read_only"
  | "small_edit"
  | "engineering"
  | "high_risk"
  | "release_external_action";

export type DesktopHostTaskEnvelopeSource =
  | "desktop-thread"
  | "desktop-automation"
  | "cli"
  | "api";

export interface DesktopHostTaskIntent {
  summary: string;
  requestedAction: string;
  successCriteria?: string[];
  outOfScope?: string[];
}

export interface DesktopHostTaskRepoContext {
  repoRoot?: string;
  branch?: string;
  worktreeClean?: boolean;
  protectedBranch?: boolean;
}

export interface DesktopHostTaskTarget {
  branches?: string[];
  files?: string[];
  modules?: string[];
}

export interface DesktopHostTaskConstraints {
  requiresNetwork?: boolean;
  explicitOwnership?: boolean;
  allowBackgroundAutomation?: boolean;
}

export interface DesktopHostTaskHintProvenance {
  field: "taskClassHint" | "riskHints" | "tags";
  value: string;
  source?:
    | "user"
    | "agent"
    | "system"
    | "policy"
    | "operator"
    | "memory"
    | "legacy"
    | "unknown";
  reason?: string;
  createdAt?: string;
}

export interface DesktopHostTaskHints {
  taskClassHint?: DesktopHostTaskClass;
  riskHints?: string[];
  tags?: string[];
  provenance?: DesktopHostTaskHintProvenance[];
}

export interface DesktopHostTaskEnvelopeInput {
  schemaVersion?: "task-envelope.v1";
  taskId: string;
  source?: DesktopHostTaskEnvelopeSource;
  intent: DesktopHostTaskIntent;
  repoContext?: DesktopHostTaskRepoContext;
  target?: DesktopHostTaskTarget;
  constraints?: DesktopHostTaskConstraints;
  hints?: DesktopHostTaskHints;
}

export interface DesktopHostResumeOptions {
  required?: boolean;
  stage?: string;
  preferredSource?: "memory" | "checkpoint";
  memoryRecall?: DesktopHostCheckpointRecallAdapter;
  checkpointStore?: DesktopHostCheckpointLookup;
}

export type DesktopHostOperatorActionReceiptDecision =
  | "acknowledged"
  | "rejected"
  | "deferred"
  | "consumed";

export interface DesktopHostOperatorActionReceiptInput {
  envelope?: unknown;
  receipt: unknown;
  actionIssuedAt?: string | (() => string);
  now?: string | (() => string);
  maxActionAgeMs?: number;
}

export interface DesktopHostCreateOperatorActionReceiptInput {
  envelope?: unknown;
  decision: DesktopHostOperatorActionReceiptDecision;
  operatorIdHash: string;
  actionIssuedAt?: string | (() => string);
  createdAt?: string | (() => string);
  evidenceRefs?: string[];
}

export interface DesktopHostOperatorActionHostExecutorAuthorizationReviewInput {
  executionGate: unknown;
  authorizationPacket?: unknown;
  hostExecutorDescriptor?: unknown;
}

export type DesktopHostOperatorActionHostExecutorDispatchMode =
  | "dry_run"
  | "execute_injected";

export interface DesktopHostOperatorActionHostExecutorDispatchExecutor {
  dispatch(invocation: unknown): Promise<unknown> | unknown;
}

export interface DesktopHostOperatorActionHostExecutorDispatchAuditSink {
  record(event: unknown): Promise<void> | void;
}

export interface DesktopHostOperatorActionHostExecutorDispatchInput
  extends DesktopHostOperatorActionHostExecutorAuthorizationReviewInput {
  authorization: unknown;
  dispatchMode: DesktopHostOperatorActionHostExecutorDispatchMode;
  executor?: DesktopHostOperatorActionHostExecutorDispatchExecutor;
  auditSink?: DesktopHostOperatorActionHostExecutorDispatchAuditSink;
}

export interface DesktopHostRunResult extends DesktopHostUnknownRecord {
  decisionResult: unknown;
  executionResult: unknown;
  operatorActionEnvelope?: unknown;
  operatorActionSummary: unknown;
  hostDispatch?: unknown;
}

export interface DesktopHostOperatorActionReceiptCreation {
  schemaVersion: "desktop-operator-action-receipt-creation.v1";
  status: "created" | "blocked";
  reasons: string[];
  taskId?: string;
  actionRef?: string;
  envelopeHash?: string;
  receipt?: unknown;
}

export type DesktopHostOperatorActionReceiptConsumptionStatus =
  | "passed"
  | "blocked"
  | "not_consumed";

export interface DesktopHostOperatorActionReceiptConsumption {
  schemaVersion: "desktop-operator-action-receipt-consumption.v1";
  status: DesktopHostOperatorActionReceiptConsumptionStatus;
  durable: boolean;
  reasons: string[];
  validation: unknown;
  taskId?: string;
  actionRef?: string;
  envelopeHash?: string;
  receipt?: unknown;
}

export type DesktopHostOperatorActionLifecycleStatus =
  | "idle"
  | "action_available"
  | "receipt_created"
  | "receipt_consumed"
  | "receipt_not_consumed"
  | "receipt_blocked";

export interface DesktopHostOperatorActionLifecycleState {
  schemaVersion: "desktop-operator-action-lifecycle.v1";
  status: DesktopHostOperatorActionLifecycleStatus;
  operatorActionPresent: boolean;
  actionIssuedAt?: string;
  envelope?: unknown;
  lastReceiptCreation?: DesktopHostOperatorActionReceiptCreation;
  lastReceiptConsumption?: DesktopHostOperatorActionReceiptConsumption;
}

export type DesktopHostOperatorActionHostExecutorAuthorizationResult = unknown;
export type DesktopHostOperatorActionHostExecutorDispatchResult = unknown;

export class DesktopHostClient {
  private inner: InternalDesktopHostClient;
  bridge: DesktopHostBridge;

  constructor(options: DesktopHostClientOptions) {
    this.inner = new InternalDesktopHostClient(
      options as unknown as InternalDesktopHostClientOptions
    );
    this.bridge = this.inner.bridge as unknown as DesktopHostBridge;
  }

  async run(task: DesktopHostTaskEnvelopeInput): Promise<DesktopHostRunResult> {
    return this.inner.run(task as never) as Promise<DesktopHostRunResult>;
  }

  async resume(
    task: DesktopHostTaskEnvelopeInput,
    options: DesktopHostResumeOptions = {}
  ): Promise<DesktopHostRunResult> {
    return this.inner.resume(
      task as never,
      options as unknown as InternalDesktopHostResumeOptions
    ) as Promise<DesktopHostRunResult>;
  }

  createOperatorActionReceipt(
    input: DesktopHostCreateOperatorActionReceiptInput
  ): DesktopHostOperatorActionReceiptCreation {
    return this.inner.createOperatorActionReceipt(
      input as unknown as InternalDesktopHostCreateOperatorActionReceiptInput
    ) as DesktopHostOperatorActionReceiptCreation;
  }

  async consumeOperatorActionReceipt(
    input: DesktopHostOperatorActionReceiptInput
  ): Promise<DesktopHostOperatorActionReceiptConsumption> {
    return this.inner.consumeOperatorActionReceipt(
      input as unknown as InternalDesktopHostOperatorActionReceiptInput
    ) as Promise<DesktopHostOperatorActionReceiptConsumption>;
  }

  getOperatorActionLifecycle(): DesktopHostOperatorActionLifecycleState {
    return this.inner.getOperatorActionLifecycle() as DesktopHostOperatorActionLifecycleState;
  }

  reviewCurrentOperatorActionHostExecutorAuthorization(
    input: DesktopHostOperatorActionHostExecutorAuthorizationReviewInput
  ): DesktopHostOperatorActionHostExecutorAuthorizationResult {
    return this.inner.reviewCurrentOperatorActionHostExecutorAuthorization(
      input as unknown as InternalDesktopHostOperatorActionHostExecutorAuthorizationReviewInput
    );
  }

  async dispatchCurrentOperatorActionHostExecutor(
    input: DesktopHostOperatorActionHostExecutorDispatchInput
  ): Promise<DesktopHostOperatorActionHostExecutorDispatchResult> {
    return this.inner.dispatchCurrentOperatorActionHostExecutor(
      input as unknown as InternalDesktopHostOperatorActionHostExecutorDispatchInput
    );
  }

  async dispatchControlledWorkspaceWriteProviderPlan(
    input: DesktopHostControlledWorkspaceWriteProviderDispatchInput
  ): Promise<DesktopHostControlledWorkspaceWriteProviderDispatchResult> {
    return this.inner.dispatchControlledWorkspaceWriteProviderPlan(input as never);
  }
}

export function createDesktopHostClient(options: DesktopHostClientOptions): DesktopHostClient {
  return new DesktopHostClient(options);
}

export type CodexMemoryTarget = "process" | "knowledge";
export type CodexMemorySearchTarget = "process" | "knowledge" | "both";

export interface CodexMemoryWriteInput {
  target: CodexMemoryTarget;
  title: string;
  content: string;
  evidence: string;
  reusable: boolean;
  sensitivity: string;
  tags?: string;
  validated: boolean;
}

export interface CodexMemoryWriteResponse {
  success: boolean;
  memoryId?: string | null;
  filePath?: string | null;
  reason?: string | null;
}

export interface CodexMemorySearchInput {
  query: string;
  target?: CodexMemorySearchTarget;
  includeContent?: boolean;
  limit?: number;
}

export interface CodexMemorySearchResult {
  target?: string;
  title: string;
  memoryId?: string;
  score?: number;
  sourceFile?: string;
  matchedTags?: string[];
  snippet?: string;
  content?: string;
  text?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CodexMemorySearchResponse {
  results: CodexMemorySearchResult[];
}

export interface CodexMemoryOverviewInput {
  auditWindow?: number;
  limit?: number;
}

export interface CodexMemoryHostClient {
  recordMemory(input: CodexMemoryWriteInput): Promise<CodexMemoryWriteResponse>;
  searchMemory(input: CodexMemorySearchInput): Promise<CodexMemorySearchResponse>;
  memoryOverview(input?: CodexMemoryOverviewInput): Promise<DesktopHostUnknownRecord>;
}

export interface CodexMemoryHostOperations {
  record_memory(input: CodexMemoryWriteInput): Promise<unknown> | unknown;
  search_memory(input: CodexMemorySearchInput): Promise<unknown> | unknown;
  memory_overview?(input?: CodexMemoryOverviewInput): Promise<unknown> | unknown;
}

export interface CodexMemoryAdapterOptions {
  anchor: string;
  target?: CodexMemoryTarget;
  sensitivity?: string;
  reusable?: boolean;
  validated?: boolean;
  tags?: string[];
  verifyRecall?: boolean;
  requireRecallHit?: boolean;
  recallLimit?: number;
}

export interface CodexMemoryAdapter {
  recordCheckpoint(checkpoint: DesktopHostCheckpointRef): Promise<void> | void;
  recordCheckpointDetailed?(checkpoint: DesktopHostCheckpointRef): Promise<unknown>;
  recallLatestCheckpointRef(
    input: DesktopHostMemoryRecallInput
  ): Promise<DesktopHostCheckpointRef | undefined> | DesktopHostCheckpointRef | undefined;
  recallLatestCheckpoint?(
    input: DesktopHostMemoryRecallInput
  ): Promise<CodexMemorySearchResult | undefined>;
}

export interface CodexDesktopLiveHostMemoryTools {
  recordMemoryTool(input: CodexMemoryWriteInput): Promise<unknown> | unknown;
  searchMemoryTool(input: CodexMemorySearchInput): Promise<unknown> | unknown;
  memoryOverviewTool?(input?: CodexMemoryOverviewInput): Promise<unknown> | unknown;
}

export interface CodexDesktopLiveHostOptions {
  policy: DesktopHostPolicySnapshot;
  runtime: CodexDesktopRuntime;
  memory: {
    adapter: CodexMemoryAdapterOptions;
    operations?: CodexMemoryHostOperations;
    tools?: CodexDesktopLiveHostMemoryTools;
  };
  preflight?: Partial<DesktopHostPreflightContext>;
  directives?: CodexDesktopDirectiveResolvers;
  binding?: CodexDesktopBindingOptions;
  persistence?: Omit<
    DesktopHostClientPersistence,
    "memoryAdapter" | "memoryRecall" | "memoryOverviewProvider"
  >;
  codexCliOptions?: unknown;
  telemetryStore?: DesktopHostTelemetrySink;
  availableAgents?: number;
  stopOnFailure?: boolean;
  now?: () => string;
}

export interface CodexDesktopLiveHostFromToolsOptions
  extends Omit<CodexDesktopLiveHostOptions, "runtime"> {
  runtimeTools: CodexDesktopToolRuntimeOperations;
}

export interface CodexDesktopLiveHostObject extends CodexDesktopToolRuntimeOperations {
  record_memory(input: CodexMemoryWriteInput): Promise<unknown> | unknown;
  search_memory(input: CodexMemorySearchInput): Promise<unknown> | unknown;
  memory_overview?(input?: CodexMemoryOverviewInput): Promise<unknown> | unknown;
}

export interface CodexDesktopLiveHostFromHostObjectOptions
  extends Omit<CodexDesktopLiveHostOptions, "runtime" | "memory"> {
  host: CodexDesktopLiveHostObject;
  memory: {
    adapter: CodexMemoryAdapterOptions;
  };
}

export interface CodexDesktopLiveHostStarterOptions
  extends Omit<CodexDesktopLiveHostFromHostObjectOptions, "memory"> {
  anchor: string;
  memoryAdapter?: Omit<CodexMemoryAdapterOptions, "anchor">;
}

export interface CodexDesktopLiveHostBundle {
  hostClient: DesktopHostClient;
  bridge: DesktopHostBridge;
  session: CodexDesktopBindingSession;
  memoryClient: CodexMemoryHostClient;
  memoryAdapter: CodexMemoryAdapter;
  memoryOperations: CodexMemoryHostOperations;
}

export interface CodexDesktopLiveHostInspection {
  ready: boolean;
  availableRuntimeMethods: string[];
  availableMemoryMethods: string[];
  availableTools: string[];
  missingMethods: string[];
  supportsMemoryOverview: boolean;
}

export type CodexDesktopLiveHostMutableHost = Partial<CodexDesktopLiveHostObject>;

export interface CodexDesktopLiveHostEmbeddingStarterOptions
  extends Omit<CodexDesktopLiveHostStarterOptions, "host"> {
  host?: CodexDesktopLiveHostMutableHost;
}

export interface CodexDesktopLiveHostEmbeddingStarter {
  host: CodexDesktopLiveHostMutableHost;
  inspect(): CodexDesktopLiveHostInspection;
  getStatus(): CodexDesktopLiveHostEmbeddingStatus;
  assertReady(): void;
  createBundle(): CodexDesktopLiveHostBundle;
}

export interface CodexDesktopLiveHostEmbeddingStatus {
  ready: boolean;
  wiredRuntimeMethods: string[];
  wiredMemoryMethods: string[];
  pendingRequiredMethods: string[];
  pendingOptionalMethods: string[];
  nextAction: "wire_required_methods" | "create_bundle";
}

export type CodexDesktopAgentType = "default" | "explorer" | "worker";

export interface CodexDesktopSpawnAgentInput {
  message: string;
  agent_type?: CodexDesktopAgentType;
  fork_context?: boolean;
  model?: string;
  reasoning_effort?: "low" | "medium" | "high";
}

export interface CodexDesktopSendInputInput {
  target: string;
  message: string;
  interrupt?: boolean;
}

export interface CodexDesktopWaitAgentInput {
  targets: string[];
  timeout_ms?: number;
}

export interface CodexDesktopCloseAgentInput {
  target: string;
}

export interface CodexDesktopStructuredShellCommand {
  executable: string;
  args?: string[];
  shell?: boolean;
}

export interface CodexDesktopShellCommandInput {
  command?: string;
  structured_command?: CodexDesktopStructuredShellCommand;
  justification?: string;
  timeout_ms?: number;
  workdir?: string;
  login?: boolean;
}

export type CodexDesktopAutomationUpdateInput = DesktopHostUnknownRecord;

export interface CodexDesktopToolRuntimeOperations {
  read_thread_terminal(): Promise<unknown> | unknown;
  spawn_agent(input: CodexDesktopSpawnAgentInput): Promise<unknown> | unknown;
  wait_agent(input: CodexDesktopWaitAgentInput): Promise<unknown> | unknown;
  send_input(input: CodexDesktopSendInputInput): Promise<unknown> | unknown;
  close_agent(input: CodexDesktopCloseAgentInput): Promise<unknown> | unknown;
  shell_command(input: CodexDesktopShellCommandInput): Promise<unknown> | unknown;
  apply_patch(patch: string): Promise<unknown> | unknown;
  automation_update(input: CodexDesktopAutomationUpdateInput): Promise<unknown> | unknown;
}

export interface CodexDesktopSpawnAgentRequest {
  message: string;
  agentType?: CodexDesktopAgentType;
  forkContext?: boolean;
  model?: string;
  reasoningEffort?: "low" | "medium" | "high";
}

export interface CodexDesktopSendInputRequest {
  target: string;
  message: string;
  interrupt?: boolean;
}

export interface CodexDesktopWaitAgentRequest {
  targets: string[];
  timeoutMs?: number;
}

export interface CodexDesktopCloseAgentRequest {
  target: string;
}

export interface CodexDesktopShellCommandRequest {
  command?: string;
  structuredCommand?: CodexDesktopStructuredShellCommand;
  justification?: string;
  timeoutMs?: number;
  workdir?: string;
  login?: boolean;
}

export type CodexDesktopAutomationUpdateRequest = DesktopHostUnknownRecord;

export interface CodexDesktopRuntime {
  readThreadTerminal(): Promise<unknown> | unknown;
  spawnAgent(input: CodexDesktopSpawnAgentRequest): Promise<unknown> | unknown;
  sendInput(input: CodexDesktopSendInputRequest): Promise<unknown> | unknown;
  waitAgent(input: CodexDesktopWaitAgentRequest): Promise<unknown> | unknown;
  closeAgent(input: CodexDesktopCloseAgentRequest): Promise<unknown> | unknown;
  automationUpdate(input: CodexDesktopAutomationUpdateRequest): Promise<unknown> | unknown;
  shellCommand(input: CodexDesktopShellCommandRequest): Promise<unknown> | unknown;
  applyPatch(patch: string): Promise<unknown> | unknown;
}

export interface CodexDesktopTrackedAgent {
  agentId: string;
  role?: DesktopHostAgentRole;
  mode?: "read_only" | "write";
  ownership?: string[];
}

export interface CodexDesktopTaskSession {
  activeAgents: CodexDesktopTrackedAgent[];
}

export interface CodexDesktopBindingSession {
  read(taskId: string): CodexDesktopTaskSession;
  write(taskId: string, session: CodexDesktopTaskSession): void;
  clear(taskId: string): void;
}

export interface CodexDesktopDirectiveResolvers {
  spawnAgent?: (
    invocation: DesktopPrimitiveInvocation
  ) => { requests: CodexDesktopSpawnAgentRequest[] } | undefined;
  sendInput?: (
    invocation: DesktopPrimitiveInvocation,
    session: CodexDesktopTaskSession
  ) => { requests: CodexDesktopSendInputRequest[] } | undefined;
  waitAgent?: (
    invocation: DesktopPrimitiveInvocation,
    session: CodexDesktopTaskSession
  ) => { targets: string[]; timeoutMs?: number } | undefined;
  closeAgent?: (
    invocation: DesktopPrimitiveInvocation,
    session: CodexDesktopTaskSession
  ) => { targets: string[] } | undefined;
  automationUpdate?: (
    invocation: DesktopPrimitiveInvocation
  ) => CodexDesktopAutomationUpdateRequest | undefined;
  shellCommand?: (
    invocation: DesktopPrimitiveInvocation
  ) => CodexDesktopShellCommandRequest | undefined;
  applyPatch?: (invocation: DesktopPrimitiveInvocation) => string | undefined;
}

export interface CodexDesktopBindingOptions {
  session?: CodexDesktopBindingSession;
  sendInputWithoutAgentMode?: "fail" | "noop";
  shellPolicy?: {
    governedMode?: boolean;
    allowRawCommand?: boolean;
    allowShell?: boolean;
    allowedExecutables?: string[];
  };
}

function wrapDesktopHostClient(inner: InternalDesktopHostClient): DesktopHostClient {
  const client = Object.create(DesktopHostClient.prototype) as DesktopHostClient;
  const mutableClient = client as unknown as {
    inner: InternalDesktopHostClient;
    bridge: DesktopHostBridge;
  };

  mutableClient.inner = inner;
  mutableClient.bridge = inner.bridge as unknown as DesktopHostBridge;
  return client;
}

function wrapHostBundle(bundle: unknown): CodexDesktopLiveHostBundle {
  const record = bundle as CodexDesktopLiveHostBundle & { hostClient?: unknown };
  return {
    ...record,
    hostClient: record.hostClient instanceof InternalDesktopHostClient
      ? wrapDesktopHostClient(record.hostClient)
      : record.hostClient as DesktopHostClient
  };
}

export function createCodexDesktopLiveHostBundle(
  options: CodexDesktopLiveHostOptions
): CodexDesktopLiveHostBundle {
  return wrapHostBundle(createInternalCodexDesktopLiveHostBundle(options as never));
}

export function createCodexDesktopLiveHostBundleFromTools(
  options: CodexDesktopLiveHostFromToolsOptions
): CodexDesktopLiveHostBundle {
  return wrapHostBundle(createInternalCodexDesktopLiveHostBundleFromTools(options as never));
}

export function createCodexDesktopLiveHostBundleFromHostObject(
  options: CodexDesktopLiveHostFromHostObjectOptions
): CodexDesktopLiveHostBundle {
  return wrapHostBundle(createInternalCodexDesktopLiveHostBundleFromHostObject(options as never));
}

export function createCodexDesktopLiveHostStarter(
  options: CodexDesktopLiveHostStarterOptions
): CodexDesktopLiveHostBundle {
  return wrapHostBundle(createInternalCodexDesktopLiveHostStarter(options as never));
}

export function createCodexDesktopLiveHostEmbeddingStarter(
  options: CodexDesktopLiveHostEmbeddingStarterOptions
): CodexDesktopLiveHostEmbeddingStarter {
  const starter = createInternalCodexDesktopLiveHostEmbeddingStarter(
    options as never
  ) as {
    host: CodexDesktopLiveHostMutableHost;
    inspect(): CodexDesktopLiveHostInspection;
    getStatus(): CodexDesktopLiveHostEmbeddingStatus;
    assertReady(): void;
    createBundle(): unknown;
  };

  return {
    host: starter.host,
    inspect: () => starter.inspect(),
    getStatus: () => starter.getStatus(),
    assertReady: () => starter.assertReady(),
    createBundle: () => wrapHostBundle(starter.createBundle())
  };
}

export function resolveLiveHostPreflight(
  input: Partial<DesktopHostPreflightContext> = {}
): DesktopHostPreflightContext {
  return resolveInternalLiveHostPreflight(input as never) as DesktopHostPreflightContext;
}

export function inspectCodexDesktopLiveHostObject(
  host: Partial<CodexDesktopLiveHostObject>
): CodexDesktopLiveHostInspection {
  return inspectInternalCodexDesktopLiveHostObject(
    host as never
  ) as CodexDesktopLiveHostInspection;
}

export function getCodexDesktopLiveHostEmbeddingStatus(
  host: Partial<CodexDesktopLiveHostObject>
): CodexDesktopLiveHostEmbeddingStatus {
  return getInternalCodexDesktopLiveHostEmbeddingStatus(
    host as never
  ) as CodexDesktopLiveHostEmbeddingStatus;
}

export function resolveLiveHostPreflightFromHost(
  host: Partial<CodexDesktopLiveHostObject>,
  input: Partial<DesktopHostPreflightContext> = {}
): DesktopHostPreflightContext {
  return resolveInternalLiveHostPreflightFromHost(
    host as never,
    input as never
  ) as DesktopHostPreflightContext;
}

export function getMissingCodexDesktopLiveHostMethods(
  host: Partial<CodexDesktopLiveHostObject>
): string[] {
  return getInternalMissingCodexDesktopLiveHostMethods(host as never);
}

export function assertCodexDesktopLiveHostObject(
  host: Partial<CodexDesktopLiveHostObject>
): asserts host is CodexDesktopLiveHostObject {
  assertInternalCodexDesktopLiveHostObject(host as never);
}
