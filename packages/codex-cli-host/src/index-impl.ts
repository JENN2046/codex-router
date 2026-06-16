import { spawn as spawnChildProcess, type StdioOptions } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  createFanoutTelemetrySink,
  createLogEvent,
  createRecordingTelemetrySink,
  emitTelemetryEvents,
  type LogEvent,
  type TelemetrySink
} from "../../observability/src/index.js";
import {
  redactSecretLikeFields,
  redactSecretLikeText
} from "../../redaction/src/index.js";
import {
  ModelIdSchema,
  parseRoutingDecision,
  parseTaskEnvelope,
  type ModelId,
  type RoutingDecisionInput,
  type TaskEnvelope,
  type TaskEnvelopeInput
} from "../../contracts/src/index.js";
import {
  createCodexCliGovernanceBundle,
  getCodexCliGovernancePreRunBlockers,
  type CodexCliGovernanceBundle,
  type CodexCliGovernanceRunOptions
} from "./governance-v2.js";

export * from "./governance-v2.js";

export type CodexCliSandboxMode = "read-only" | "workspace-write";
export type CodexCliApprovalPolicy = "untrusted" | "on-request" | "never";
export type CodexCliExecutionStatus = "completed" | "failed";

export const DEFAULT_CODEX_CLI_READ_ONLY_SMOKE_TIMEOUT_MS = 180_000;
export const DEFAULT_CODEX_CLI_WORKSPACE_WRITE_SMOKE_TIMEOUT_MS = 180_000;
export const DEFAULT_CODEX_CLI_MODEL_PROBE_TIMEOUT_MS = 180_000;
export const DEFAULT_CODEX_CLI_WORKSPACE_WRITE_SMOKE_TARGET_FILE =
  "docs/evidence/codex-cli-workspace-write-smoke.txt";
export const DEFAULT_CODEX_CLI_MODEL_PROBE_CACHE_TTL_MS = 300_000;
export const DEFAULT_CODEX_CLI_MODEL_PROBE_MODEL = "gpt-5.4-mini";
export const DEFAULT_CODEX_CLI_TERMINATION_GRACE_MS = 5_000;
export const CODEX_CLI_MODEL_PROBE_OK = "CODEX_CLI_MODEL_PROBE_OK";
export const CODEX_CLI_READONLY_SMOKE_OK = "CODEX_CLI_READONLY_SMOKE_OK";
export const CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION =
  "ALLOW_CODEX_CLI_WORKSPACE_WRITE_SMOKE";

export interface CodexCliExecPlanOptions {
  codexCommand?: string;
  cwd?: string;
  model?: string;
  profile?: string;
  sandbox?: CodexCliSandboxMode;
  approvalPolicy?: CodexCliApprovalPolicy;
  approvalFlagPlacement?: "before-command" | "after-command" | "omit";
  skipGitRepoCheck?: boolean;
  ephemeral?: boolean;
  ignoreUserConfig?: boolean;
  ignoreRules?: boolean;
  configOverrides?: string[];
  extraArgs?: string[];
}

export interface CodexCliDecisionExecPlanOptions
  extends Omit<
    CodexCliExecPlanOptions,
    | "approvalFlagPlacement"
    | "approvalPolicy"
    | "codexCommand"
    | "configOverrides"
    | "cwd"
    | "extraArgs"
    | "ignoreUserConfig"
    | "ignoreRules"
    | "model"
    | "profile"
    | "sandbox"
  > {
  modelSelection?: CodexCliModelSelection;
}

export type CodexCliModelSelectionMode = "auto" | "user_preference";

export interface CodexCliModelSelection {
  mode?: CodexCliModelSelectionMode;
  requestedModel?: ModelId;
  allowDowngrade?: boolean;
}

export interface CodexCliModelResolution {
  mode: CodexCliModelSelectionMode;
  routerModel: ModelId;
  selectedModel: ModelId;
  source: "router" | "user";
  accepted: boolean;
  reasons: string[];
  requestedModel?: ModelId;
}

export type CodexCliModelSpecialization =
  | "codex_realtime"
  | "general_small"
  | "codex_agentic"
  | "general_frontier"
  | "governance_max";

export interface CodexCliModelStrengthProfile {
  capabilityRank: number;
  latencyRank: number;
  specialization: CodexCliModelSpecialization;
  notes: string[];
}

export interface OpenAiModelCatalogModel {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

export interface OpenAiModelCatalog {
  object: string;
  data: OpenAiModelCatalogModel[];
}

export type CodexCliModelCatalogInput =
  | OpenAiModelCatalog
  | OpenAiModelCatalogModel[]
  | string[];

export interface CodexCliModelCatalogDetectionOptions {
  officialModels: CodexCliModelCatalogInput;
  knownModels?: ModelId[];
  relevantModelId?: (modelId: string) => boolean;
}

export interface CodexCliModelCatalogDetection {
  schemaVersion: "codex-cli-model-catalog-detection.v1";
  status: "current" | "drift_detected";
  knownModels: ModelId[];
  availableKnownModels: ModelId[];
  missingKnownModels: ModelId[];
  untrackedOfficialModels: string[];
  ignoredOfficialModelCount: number;
  warnings: string[];
}

export interface CodexCliFetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type CodexCliFetch = (
  url: string,
  init: {
    method: "GET";
    headers: Record<string, string>;
  }
) => Promise<CodexCliFetchResponse>;

export interface FetchOpenAiModelCatalogOptions {
  apiKey?: string;
  baseUrl?: string;
  fetch?: CodexCliFetch;
}

export interface CodexCliModelCatalogStartupCheckOptions
  extends FetchOpenAiModelCatalogOptions {
  checkedAt?: string;
  knownModels?: ModelId[];
  relevantModelId?: (modelId: string) => boolean;
}

export interface CodexCliModelCatalogStartupCheck {
  schemaVersion: "codex-cli-model-catalog-startup-check.v1";
  checkedAt: string;
  status: "ready" | "drift_detected";
  catalog: OpenAiModelCatalog;
  detection: CodexCliModelCatalogDetection;
  warnings: string[];
}

export type CodexCliModelCheckMode = "strict" | "warn";
export type CodexCliModelCheckEvidenceStatus =
  | "passed"
  | "failed"
  | "unavailable";

export interface CodexCliModelCheckEvidenceOptions
  extends CodexCliModelCatalogStartupCheckOptions {
  generatedAt?: string;
  host?: string;
  strict?: boolean;
}

export interface CodexCliModelCheckEvidence {
  schemaVersion: "codex-cli-model-check-evidence.v1";
  generatedAt: string;
  host: string;
  mode: CodexCliModelCheckMode;
  status: CodexCliModelCheckEvidenceStatus;
  api: {
    baseUrl: string;
    endpoint: "/models";
    apiKeyConfigured: boolean;
  };
  summary: {
    officialModelCount: number;
    knownModelCount: number;
    availableKnownModelCount: number;
    missingKnownModelCount: number;
    untrackedOfficialModelCount: number;
    ignoredOfficialModelCount: number;
  };
  detection?: CodexCliModelCatalogDetection;
  warnings: string[];
  blockingReasons: string[];
}

export interface CodexCliModelCheckEvidenceWriteResult {
  path: string;
  bytes: number;
}

export interface CodexCliModelCheckPersistOptions
  extends CodexCliModelCheckEvidenceOptions {
  evidencePath: string;
}

export interface CodexCliModelCheckPersistResult {
  evidence: CodexCliModelCheckEvidence;
  write: CodexCliModelCheckEvidenceWriteResult;
}

export interface CodexCliModelCliProbeEvidenceOptions {
  generatedAt?: string;
  host?: string;
  model?: string;
  codexCommand?: string;
  cwd?: string;
  strict?: boolean;
  timeoutMs?: number;
  terminationGraceMs?: number;
  env?: NodeJS.ProcessEnv;
  oneShotEnv?: NodeJS.ProcessEnv;
  spawn?: CodexCliProcessSpawner;
}

export interface CodexCliModelCliProbeEvidence {
  schemaVersion: "codex-cli-model-cli-probe-evidence.v1";
  generatedAt: string;
  host: string;
  source: "cli";
  mode: CodexCliModelCheckMode;
  status: CodexCliModelCheckEvidenceStatus;
  model: string;
  cli: {
    command: string;
    sandbox: CodexCliSandboxMode;
    approvalPolicy: CodexCliApprovalPolicy;
    usesJson: boolean;
    skipGitRepoCheck: boolean;
    ephemeral: boolean;
    workdir?: string;
  };
  run?: {
    exitCode: number;
    eventCount: number;
    parseErrorCount: number;
    timedOut: boolean;
    killed: boolean;
    stdinClosed?: boolean;
    stdinDestroyed?: boolean;
    closeReceived?: boolean;
    forcedSettled?: boolean;
    stdioDestroyed?: boolean;
    unrefCalled?: boolean;
    terminationGraceMs?: number;
    terminationEscalated?: boolean;
    warnings: string[];
    blockingReasons: string[];
    error?: string;
  };
  warnings: string[];
  blockingReasons: string[];
}

export interface CodexCliModelCliProbePersistOptions
  extends CodexCliModelCliProbeEvidenceOptions {
  evidencePath: string;
}

export interface CodexCliModelCliProbePersistResult {
  evidence: CodexCliModelCliProbeEvidence;
  write: CodexCliModelCheckEvidenceWriteResult;
}

interface CodexCliModelProbeCacheEntry {
  evidence: CodexCliModelCliProbeEvidence;
  expiresAtMs: number;
}

export type CodexCliModelAvailabilityStatus =
  | "available"
  | "missing"
  | "not_checked";

export interface CodexCliModelAvailabilityOptions {
  model?: string;
  officialModels?: CodexCliModelCatalogInput;
  requireCatalog?: boolean;
  knownModels?: ModelId[];
  relevantModelId?: (modelId: string) => boolean;
}

export interface CodexCliModelAvailabilityCheck {
  schemaVersion: "codex-cli-model-availability-check.v1";
  status: CodexCliModelAvailabilityStatus;
  checked: boolean;
  available: boolean;
  blockingReasons: string[];
  warnings: string[];
  model?: string;
  detection?: CodexCliModelCatalogDetection;
}

export interface CodexCliExecPlan {
  command: string;
  args: string[];
  prompt: string;
  task: TaskEnvelope;
  sandbox: CodexCliSandboxMode;
  approvalPolicy: CodexCliApprovalPolicy;
  model?: string;
  modelResolution?: CodexCliModelResolution;
  workdir?: string;
  warnings: string[];
}

export interface CodexCliWorkspaceWriteRunPreflight {
  beforeCommit?: string;
  rollbackCommand?: string;
  targetAllowlist?: string[];
}

export interface CodexCliJsonlEvent {
  line: number;
  raw: string;
  event: Record<string, unknown>;
}

export interface CodexCliJsonlParseError {
  line: number;
  raw: string;
  error: string;
}

export interface CodexCliJsonlParseResult {
  events: CodexCliJsonlEvent[];
  parseErrors: CodexCliJsonlParseError[];
}

export interface CodexCliCommandOutput {
  exitCode: number;
  stdout: string;
  stderr?: string;
}

export interface CodexCliCommandInspection {
  status: CodexCliExecutionStatus;
  events: CodexCliJsonlEvent[];
  parseErrors: CodexCliJsonlParseError[];
  warnings: string[];
  blockingReasons: string[];
}

export interface CodexCliSemanticInspectionOptions {
  sandbox?: CodexCliSandboxMode;
  targetFiles?: string[];
  strictUnknownEvents?: boolean;
}

export interface CodexCliGovernanceEvidenceSummary {
  schemaVersion: "codex-cli-governance-evidence-summary.v1";
  action: string;
  riskLevel: string;
  anomalyCount: number;
  observationStatus: string;
  observationSignals: string[];
  ledgerId: string;
  arbitrationPacketId?: string;
  probabilityPredictionAllowed?: false;
}

export interface CodexCliProcessRunOptions {
  allowWriteSandbox?: boolean;
  allowSkipGitRepoCheck?: boolean;
  workspaceWritePreflight?: CodexCliWorkspaceWriteRunPreflight;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  oneShotEnv?: NodeJS.ProcessEnv;
  spawn?: CodexCliProcessSpawner;
  telemetryStore?: TelemetrySink;
  modelProbe?: CodexCliModelCliProbeEvidence;
  requireModelProbe?: boolean;
  autoProbeModelWithCli?: boolean;
  modelProbeStrict?: boolean;
  modelProbeTimeoutMs?: number;
  modelProbeCacheTtlMs?: number;
  disableModelProbeCache?: boolean;
  modelCatalog?: CodexCliModelCatalogInput;
  requireModelCatalog?: boolean;
  modelCatalogKnownModels?: ModelId[];
  modelCatalogRelevance?: (modelId: string) => boolean;
  skipExecutionModelProbe?: boolean;
  terminationGraceMs?: number;
  governance?: CodexCliGovernanceRunOptions;
}

export interface CodexCliProcessLifecycle {
  stdin: {
    mode: "pipe";
    closed: boolean;
    destroyed: boolean;
    error?: string;
  };
  termination: {
    closeReceived: boolean;
    forcedSettled: boolean;
    stdioDestroyed: boolean;
    unrefCalled: boolean;
    timedOut: boolean;
    killRequested: boolean;
    killed: boolean;
    killSignal?: NodeJS.Signals;
    escalated: boolean;
    escalationSignal?: NodeJS.Signals;
    escalationKilled?: boolean;
    graceMs?: number;
    closeCode?: number | null;
    closeSignal?: NodeJS.Signals | null;
  };
}

export interface CodexCliProcessRunResult {
  plan: CodexCliExecPlan;
  output: CodexCliCommandOutput;
  inspection: CodexCliCommandInspection;
  timedOut: boolean;
  killed: boolean;
  lifecycle: CodexCliProcessLifecycle;
  modelAvailability?: CodexCliModelAvailabilityCheck;
  modelProbe?: CodexCliModelCliProbeEvidence;
  governance?: CodexCliGovernanceBundle;
  error?: string;
}

export interface CodexCliEnvironmentPreflightOptions {
  generatedAt?: string;
  codexCommand?: string;
  cwd?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  oneShotEnv?: NodeJS.ProcessEnv;
  spawn?: CodexCliProcessSpawner;
  allowRealCodexCli?: boolean;
}

export interface CodexCliEnvironmentPreflightResult {
  schemaVersion: "codex-cli-environment-preflight.v1";
  generatedAt: string;
  status: "ready" | "blocked";
  checks: {
    injectedSpawner: boolean;
    realCliAllowed: boolean;
    versionProbe: "passed" | "failed" | "skipped";
    noTaskEnvelope: true;
    noPromptSent: true;
    noWorkspaceWrite: true;
    noRealCliFallback: true;
  };
  cli: {
    commandResolved: boolean;
    version?: string;
    exitCode?: number;
    timedOut: boolean;
    killed: boolean;
    closeReceived: boolean;
    warningCount: number;
  };
  warnings: string[];
  blockingReasons: string[];
}

export interface CodexCliSpawnOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdio?: StdioOptions;
  windowsHide?: boolean;
}

export type CodexCliProcessSpawner = (
  command: string,
  args: string[],
  options: CodexCliSpawnOptions
) => CodexCliChildProcess;

export interface CodexCliChildProcess {
  stdin?: CodexCliProcessWritableStream | null;
  stdout?: CodexCliProcessStream | null;
  stderr?: CodexCliProcessStream | null;
  on(event: "close", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  kill(signal?: NodeJS.Signals | number): boolean;
  unref?(): void;
}

export interface CodexCliProcessWritableStream {
  end(): void;
  destroy?(error?: Error): void;
}

export interface CodexCliProcessStream {
  setEncoding(encoding: BufferEncoding): void;
  on(event: "data", listener: (chunk: string | Buffer) => void): this;
  destroy?(error?: Error): void;
}

const codexCliModelProbeCache = new Map<string, CodexCliModelProbeCacheEntry>();

export interface CodexCliReadOnlySmokeTaskOptions {
  taskId?: string;
  repoRoot?: string;
  branch?: string;
  files?: string[];
  modules?: string[];
  tags?: string[];
}

export interface CodexCliWorkspaceWriteSmokeTaskOptions {
  taskId?: string;
  repoRoot?: string;
  branch?: string;
  worktreeClean?: boolean;
  file?: string;
  modules?: string[];
  tags?: string[];
}

export interface CodexCliReadOnlySmokePlanOptions
  extends Omit<CodexCliExecPlanOptions, "sandbox" | "approvalPolicy" | "extraArgs"> {}

export interface CodexCliWorkspaceWriteSmokePlanOptions
  extends Omit<CodexCliExecPlanOptions, "sandbox" | "extraArgs"> {}

export interface CodexCliReadOnlySmokeRunOptions {
  task?: TaskEnvelopeInput;
  taskOptions?: CodexCliReadOnlySmokeTaskOptions;
  planOptions?: CodexCliReadOnlySmokePlanOptions;
  allowSkipGitRepoCheck?: boolean;
  timeoutMs?: number;
  modelProbeTimeoutMs?: number;
  terminationGraceMs?: number;
  env?: NodeJS.ProcessEnv;
  oneShotEnv?: NodeJS.ProcessEnv;
  spawn?: CodexCliProcessSpawner;
  telemetryStore?: TelemetrySink;
  governance?: CodexCliGovernanceRunOptions;
}

export interface CodexCliReadOnlySmokeResult {
  status: "passed" | "failed";
  task: TaskEnvelope;
  plan: CodexCliExecPlan;
  validationBlockers: string[];
  run?: CodexCliProcessRunResult;
  governance?: CodexCliGovernanceBundle;
  error?: string;
}

export interface CodexCliReadOnlySmokeEvidenceOptions {
  generatedAt?: string;
  host?: string;
  repoRoot?: string;
  notes?: string[];
}

export interface CodexCliReadOnlySmokeEvidence {
  schemaVersion: "codex-cli-readonly-smoke-evidence.v1";
  generatedAt: string;
  host: string;
  repoRoot?: string;
  status: "passed" | "failed";
  taskId: string;
  plan: {
    command: string;
    sandbox: CodexCliSandboxMode;
    approvalPolicy: CodexCliApprovalPolicy;
    workdir?: string;
    usesJson: boolean;
    skipGitRepoCheck: boolean;
    ephemeral: boolean;
    warnings: string[];
  };
  run: {
    exitCode?: number;
    executionStatus?: CodexCliExecutionStatus;
    eventCount: number;
    parseErrorCount: number;
    warnings: string[];
    blockingReasons: string[];
    timedOut?: boolean;
    killed?: boolean;
    stdinClosed?: boolean;
    stdinDestroyed?: boolean;
    closeReceived?: boolean;
    forcedSettled?: boolean;
    stdioDestroyed?: boolean;
    unrefCalled?: boolean;
    terminationGraceMs?: number;
    terminationEscalated?: boolean;
    error?: string;
  };
  summary: {
    passed: boolean;
    blockingReasons: string[];
    warnings: string[];
    error?: string;
  };
  governance?: CodexCliGovernanceEvidenceSummary;
  notes: string[];
}

export interface CodexCliReadOnlySmokeEvidenceWriteResult {
  path: string;
  bytes: number;
}

export interface CodexCliReadOnlySmokePersistOptions extends CodexCliReadOnlySmokeRunOptions {
  evidencePath: string;
  evidenceOptions?: CodexCliReadOnlySmokeEvidenceOptions;
}

export interface CodexCliReadOnlySmokePersistResult {
  result: CodexCliReadOnlySmokeResult;
  evidence: CodexCliReadOnlySmokeEvidence;
  write: CodexCliReadOnlySmokeEvidenceWriteResult;
}

export interface CodexCliOperatorAcceptanceRunOptions {
  task: TaskEnvelopeInput;
  planOptions?: CodexCliExecPlanOptions;
  allowSkipGitRepoCheck?: boolean;
  workspaceWritePreflight?: CodexCliWorkspaceWriteRunPreflight;
  timeoutMs?: number;
  terminationGraceMs?: number;
  modelProbeTimeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  oneShotEnv?: NodeJS.ProcessEnv;
  spawn?: CodexCliProcessSpawner;
  telemetryStore?: TelemetrySink;
  allowWriteSandbox?: boolean;
  governance?: CodexCliGovernanceRunOptions;
}

export interface CodexCliOperatorAcceptanceResult {
  status: "passed" | "failed";
  task: TaskEnvelope;
  plan: CodexCliExecPlan;
  validationBlockers: string[];
  telemetryEvents: LogEvent[];
  run?: CodexCliProcessRunResult;
  governance?: CodexCliGovernanceBundle;
  error?: string;
}

export interface CodexCliOperatorAcceptanceEvidenceOptions {
  generatedAt?: string;
  host?: string;
  repoRoot?: string;
  notes?: string[];
}

export interface CodexCliOperatorAcceptanceEvidence {
  schemaVersion: "codex-cli-operator-acceptance-evidence.v1";
  generatedAt: string;
  host: string;
  repoRoot?: string;
  status: "passed" | "failed";
  taskId: string;
  task: {
    source: string;
    summary: string;
    requestedAction: string;
    targetFiles: string[];
    modules: string[];
  };
  plan: {
    command: string;
    sandbox: CodexCliSandboxMode;
    approvalPolicy: CodexCliApprovalPolicy;
    model?: string;
    workdir?: string;
    usesJson: boolean;
    skipGitRepoCheck: boolean;
    ephemeral: boolean;
    warnings: string[];
  };
  run: {
    exitCode?: number;
    executionStatus?: CodexCliExecutionStatus;
    eventCount: number;
    parseErrorCount: number;
    warnings: string[];
    blockingReasons: string[];
    timedOut?: boolean;
    killed?: boolean;
    stdinClosed?: boolean;
    stdinDestroyed?: boolean;
    closeReceived?: boolean;
    forcedSettled?: boolean;
    stdioDestroyed?: boolean;
    unrefCalled?: boolean;
    terminationGraceMs?: number;
    terminationEscalated?: boolean;
    error?: string;
  };
  telemetry: Array<{
    level: LogEvent["level"];
    message: string;
    context?: Record<string, unknown>;
  }>;
  summary: {
    passed: boolean;
    validationBlockers: string[];
    blockingReasons: string[];
    telemetryMessages: string[];
    error?: string;
  };
  governance?: CodexCliGovernanceEvidenceSummary;
  notes: string[];
}

export interface CodexCliOperatorAcceptanceEvidenceWriteResult {
  path: string;
  bytes: number;
}

export interface CodexCliOperatorAcceptancePersistOptions
  extends CodexCliOperatorAcceptanceRunOptions {
  evidencePath: string;
  evidenceOptions?: CodexCliOperatorAcceptanceEvidenceOptions;
}

export interface CodexCliOperatorAcceptancePersistResult {
  result: CodexCliOperatorAcceptanceResult;
  evidence: CodexCliOperatorAcceptanceEvidence;
  write: CodexCliOperatorAcceptanceEvidenceWriteResult;
}

export interface CodexCliWorkspaceWriteSmokePreflightOptions {
  task?: TaskEnvelopeInput;
  taskOptions?: CodexCliWorkspaceWriteSmokeTaskOptions;
  planOptions?: CodexCliWorkspaceWriteSmokePlanOptions;
  allowWriteSandbox?: boolean;
  confirmation?: string;
  beforeCommit?: string;
  targetAllowlist?: string[];
}

export interface CodexCliWorkspaceWriteSmokePreflightGuards {
  repoRootKnown: boolean;
  worktreeClean: boolean;
  beforeCommitRecorded: boolean;
  rollbackCommandRecorded: boolean;
  targetFilesAllowed: boolean;
  targetAllowlist: string[];
}

export interface CodexCliWorkspaceWriteSmokeRunOptions
  extends CodexCliWorkspaceWriteSmokePreflightOptions {
  timeoutMs?: number;
  modelProbeTimeoutMs?: number;
  terminationGraceMs?: number;
  env?: NodeJS.ProcessEnv;
  oneShotEnv?: NodeJS.ProcessEnv;
  spawn?: CodexCliProcessSpawner;
  telemetryStore?: TelemetrySink;
  governance?: CodexCliGovernanceRunOptions;
}

export interface CodexCliWorkspaceWriteSmokePreflight {
  status: "ready" | "blocked";
  task: TaskEnvelope;
  plan: CodexCliExecPlan;
  blockingReasons: string[];
  requiredConfirmation: typeof CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION;
  guards: CodexCliWorkspaceWriteSmokePreflightGuards;
  beforeCommit?: string;
  rollbackCommand?: string;
}

export interface CodexCliWorkspaceWriteSmokeResult {
  status: "blocked" | "passed" | "failed";
  preflight: CodexCliWorkspaceWriteSmokePreflight;
  task: TaskEnvelope;
  plan: CodexCliExecPlan;
  validationBlockers: string[];
  run?: CodexCliProcessRunResult;
  governance?: CodexCliGovernanceBundle;
  error?: string;
}

export interface CodexCliWorkspaceWriteSmokeEvidenceOptions {
  generatedAt?: string;
  host?: string;
  repoRoot?: string;
  notes?: string[];
}

export interface CodexCliWorkspaceWriteSmokeEvidence {
  schemaVersion: "codex-cli-workspace-write-smoke-evidence.v1";
  generatedAt: string;
  host: string;
  repoRoot?: string;
  status: "blocked" | "passed" | "failed";
  taskId: string;
  requiredConfirmation: typeof CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION;
  preflight: {
    status: "ready" | "blocked";
    blockingReasons: string[];
    guards: CodexCliWorkspaceWriteSmokePreflightGuards;
  };
  approvalPacket: {
    status: "ready" | "blocked";
    risk: "medium";
    blockers: string[];
    targetFiles: string[];
    commandPreview: string;
  };
  plan: {
    command: string;
    sandbox: CodexCliSandboxMode;
    approvalPolicy: CodexCliApprovalPolicy;
    workdir?: string;
    usesJson: boolean;
    skipGitRepoCheck: boolean;
    ephemeral: boolean;
    warnings: string[];
  };
  run: {
    exitCode?: number;
    executionStatus?: CodexCliExecutionStatus;
    eventCount: number;
    parseErrorCount: number;
    warnings: string[];
    blockingReasons: string[];
    timedOut?: boolean;
    killed?: boolean;
    stdinClosed?: boolean;
    stdinDestroyed?: boolean;
    closeReceived?: boolean;
    forcedSettled?: boolean;
    stdioDestroyed?: boolean;
    unrefCalled?: boolean;
    terminationGraceMs?: number;
    terminationEscalated?: boolean;
    error?: string;
  };
  summary: {
    passed: boolean;
    blockingReasons: string[];
    warnings: string[];
    error?: string;
  };
  governance?: CodexCliGovernanceEvidenceSummary;
  notes: string[];
}

export interface CodexCliWorkspaceWriteSmokeEvidenceWriteResult {
  path: string;
  bytes: number;
}

export interface CodexCliWorkspaceWriteSmokePersistOptions
  extends CodexCliWorkspaceWriteSmokeRunOptions {
  evidencePath: string;
  evidenceOptions?: CodexCliWorkspaceWriteSmokeEvidenceOptions;
}

export interface CodexCliWorkspaceWriteSmokePersistResult {
  result: CodexCliWorkspaceWriteSmokeResult;
  evidence: CodexCliWorkspaceWriteSmokeEvidence;
  write: CodexCliWorkspaceWriteSmokeEvidenceWriteResult;
}

export interface CodexCliWorkspaceWriteSmokePreflightEvidenceOptions {
  generatedAt?: string;
  host?: string;
  repoRoot?: string;
  notes?: string[];
}

export interface CodexCliWorkspaceWriteSmokePreflightEvidence {
  schemaVersion: "codex-cli-workspace-write-smoke-preflight.v1";
  generatedAt: string;
  host: string;
  repoRoot?: string;
  status: "ready" | "blocked";
  taskId: string;
  requiredConfirmation: typeof CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION;
  plan: {
    command: string;
    sandbox: CodexCliSandboxMode;
    approvalPolicy: CodexCliApprovalPolicy;
    workdir?: string;
    targetFiles: string[];
    targetAllowlist: string[];
    modules: string[];
    usesJson: boolean;
    skipGitRepoCheck: boolean;
    ephemeral: boolean;
    warnings: string[];
  };
  summary: {
    readyToRun: boolean;
    blockingReasons: string[];
    warnings: string[];
  };
  guards: CodexCliWorkspaceWriteSmokePreflightGuards;
  notes: string[];
}

export interface CodexCliWorkspaceWriteSmokePreflightEvidenceWriteResult {
  path: string;
  bytes: number;
}

export interface CodexCliWorkspaceWriteSmokeApprovalPacketOptions {
  generatedAt?: string;
  host?: string;
  repoState?: {
    isGitRepository: boolean;
    branch?: string;
    worktree?: string;
  };
  notes?: string[];
}

export interface CodexCliWorkspaceWriteSmokeApprovalPacket {
  schemaVersion: "codex-cli-workspace-write-smoke-approval-packet.v1";
  generatedAt: string;
  host: string;
  status: "ready" | "blocked";
  risk: "medium";
  taskId: string;
  workspace: string;
  repoState: {
    isGitRepository: boolean;
    branch?: string;
    worktree?: string;
  };
  proposedAction: {
    sandbox: CodexCliSandboxMode;
    approvalPolicy: CodexCliApprovalPolicy;
    commandPreview: string;
    targetFiles: string[];
    modules: string[];
  };
  requiredGates: {
    allowWriteSandbox: true;
    confirmation: typeof CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION;
  };
  blockers: string[];
  rollback: {
    strategy: string;
    affectedFiles: string[];
    beforeCommit?: string;
    command?: string;
  };
  safetyNotes: string[];
  notes: string[];
}

export interface CodexCliWorkspaceWriteSmokeApprovalPacketWriteResult {
  path: string;
  bytes: number;
}

const DANGEROUS_CODEX_CLI_ARGS = new Set([
  "--dangerously-bypass-approvals-and-sandbox",
  "--dangerously-bypass-hook-trust",
  "--yolo",
  "--full-auto"
]);

const CODEX_CLI_MODEL_STRENGTH_PROFILES = {
  "gpt-5.3-codex-spark": {
    capabilityRank: 10,
    latencyRank: 50,
    specialization: "codex_realtime",
    notes: [
      "latency-optimized Codex model",
      "not treated as a general capability upgrade over gpt-5.4-mini"
    ]
  },
  "gpt-5.4-mini": {
    capabilityRank: 20,
    latencyRank: 40,
    specialization: "general_small",
    notes: [
      "newer GPT-5.4 small model",
      "treated as a general capability upgrade over gpt-5.3-codex-spark"
    ]
  },
  "gpt-5.3-codex": {
    capabilityRank: 30,
    latencyRank: 20,
    specialization: "codex_agentic",
    notes: [
      "agentic coding model for heavier Codex work"
    ]
  },
  "gpt-5.4": {
    capabilityRank: 40,
    latencyRank: 30,
    specialization: "general_frontier",
    notes: [
      "frontier GPT-5.4 model for broad professional work"
    ]
  },
  "gpt-5.1-codex-max": {
    capabilityRank: 50,
    latencyRank: 10,
    specialization: "governance_max",
    notes: [
      "project governance ceiling for highest-risk Codex work"
    ]
  }
} satisfies Record<ModelId, CodexCliModelStrengthProfile>;

export function createCodexCliExecPlan(
  taskInput: TaskEnvelopeInput,
  options: CodexCliExecPlanOptions = {}
): CodexCliExecPlan {
  assertNoDangerousCodexCliArgs(options.extraArgs ?? []);

  const task = parseTaskEnvelope(taskInput);
  const command = options.codexCommand ?? "codex";
  const workdir = options.cwd ?? task.repoContext.repoRoot;
  const sandbox = options.sandbox ?? resolveCodexCliSandbox(task);
  const approvalPolicy = options.approvalPolicy ?? "on-request";
  const approvalFlagPlacement = options.approvalFlagPlacement ?? "before-command";
  const prompt = buildCodexCliTaskPrompt(task);
  const args = [];

  if (approvalFlagPlacement === "before-command") {
    args.push("-a", approvalPolicy);
  }

  args.push("exec", "--json", "--sandbox", sandbox);

  if (approvalFlagPlacement === "after-command") {
    args.push("--ask-for-approval", approvalPolicy);
  }

  for (const override of options.configOverrides ?? []) {
    args.push("-c", override);
  }

  if (options.model) {
    args.push("--model", options.model);
  }

  if (options.profile) {
    args.push("--profile", options.profile);
  }

  if (workdir) {
    args.push("--cd", workdir);
  }

  if (options.skipGitRepoCheck) {
    args.push("--skip-git-repo-check");
  }

  if (options.ephemeral) {
    args.push("--ephemeral");
  }

  if (options.ignoreUserConfig) {
    args.push("--ignore-user-config");
  }

  if (options.ignoreRules) {
    args.push("--ignore-rules");
  }

  args.push(...(options.extraArgs ?? []), prompt);
  assertNoDuplicateCodexCliSecurityArgs(args);
  assertNoCodexCliWorkspaceExpansionArgs(args);
  assertNoCodexCliProviderOverrideArgs(args);
  assertNoCodexCliOutputWriteArgs(args);
  assertNoCodexCliOutputSchemaArgs(args);
  assertNoCodexCliImageAttachmentArgs(args);
  assertNoCodexCliExecSubcommandArgs(args, prompt);
  assertNoGovernedCodexCliConfigOverrides(args);

  return {
    command,
    args,
    prompt,
    task,
    sandbox,
    approvalPolicy,
    ...(options.model !== undefined ? { model: options.model } : {}),
    ...(workdir !== undefined ? { workdir } : {}),
    warnings: createCodexCliExecPlanWarnings(task, options)
  };
}

export function createCodexCliExecPlanFromRoutingDecision(
  taskInput: TaskEnvelopeInput,
  decisionInput: RoutingDecisionInput,
  options: CodexCliDecisionExecPlanOptions = {}
): CodexCliExecPlan {
  const task = parseTaskEnvelope(taskInput);
  const decision = parseRoutingDecision(decisionInput);

  if (task.taskId !== decision.taskId) {
    throw new Error(`codex_cli_decision_task_id_mismatch:${task.taskId}:${decision.taskId}`);
  }

  assertNoCodexCliDecisionPolicyOverrides(options);
  const { modelSelection, ...planOptions } = options;
  const modelResolution = resolveCodexCliModelForRoutingDecision(
    decision,
    modelSelection
  );
  const plan = createCodexCliExecPlan(task, {
    ...planOptions,
    ignoreUserConfig: true,
    model: modelResolution.selectedModel,
    sandbox: resolveCodexCliSandboxForRoutingDecision(decision)
  });

  return {
    ...plan,
    modelResolution,
    warnings: [
      ...plan.warnings,
      ...modelResolution.reasons
        .filter((reason) => reason.startsWith("requested_model_rejected"))
        .map((reason) => `codex_cli_model_selection:${reason}`)
    ]
  };
}

export function resolveCodexCliModelForRoutingDecision(
  decisionInput: RoutingDecisionInput,
  selection: CodexCliModelSelection = {}
): CodexCliModelResolution {
  const decision = parseRoutingDecision(decisionInput);
  const mode = selection.mode ?? "auto";
  const routerModel = decision.execution.selectedModel;

  if (mode === "auto") {
    return {
      mode,
      routerModel,
      selectedModel: routerModel,
      source: "router",
      accepted: true,
      reasons: ["model_selection_auto"]
    };
  }

  if (selection.requestedModel === undefined) {
    return {
      mode,
      routerModel,
      selectedModel: routerModel,
      source: "router",
      accepted: true,
      reasons: ["user_preference_enabled_without_requested_model"]
    };
  }

  const requestedModel = ModelIdSchema.parse(selection.requestedModel);
  if (isModelAtLeastAsStrong(requestedModel, routerModel)) {
    return {
      mode,
      routerModel,
      requestedModel,
      selectedModel: requestedModel,
      source: "user",
      accepted: true,
      reasons: ["requested_model_accepted_not_weaker_than_router_model"]
    };
  }

  if (canAcceptModelDowngrade(decision, selection)) {
    return {
      mode,
      routerModel,
      requestedModel,
      selectedModel: requestedModel,
      source: "user",
      accepted: true,
      reasons: ["requested_model_accepted_explicit_low_risk_downgrade"]
    };
  }

  return {
    mode,
    routerModel,
    requestedModel,
    selectedModel: routerModel,
    source: "router",
    accepted: false,
    reasons: ["requested_model_rejected_weaker_than_router_model"]
  };
}

export function getCodexCliModelStrengthProfile(
  modelInput: ModelId
): CodexCliModelStrengthProfile {
  const model = ModelIdSchema.parse(modelInput);
  return CODEX_CLI_MODEL_STRENGTH_PROFILES[model];
}

export function compareCodexCliModelStrength(
  leftInput: ModelId,
  rightInput: ModelId
): number {
  return getModelStrength(leftInput) - getModelStrength(rightInput);
}

export function getKnownCodexCliModelIds(): ModelId[] {
  return [...ModelIdSchema.options];
}

export function parseOpenAiModelCatalogResponse(
  payload: unknown
): OpenAiModelCatalog {
  if (!isRecord(payload)) {
    throw new Error("openai_model_catalog_response_not_object");
  }

  if (!Array.isArray(payload.data)) {
    throw new Error("openai_model_catalog_response_data_not_array");
  }

  return {
    object: typeof payload.object === "string" ? payload.object : "list",
    data: payload.data.map((entry, index) => {
      if (!isRecord(entry)) {
        throw new Error(`openai_model_catalog_model_not_object:${index}`);
      }

      if (typeof entry.id !== "string" || entry.id.trim() === "") {
        throw new Error(`openai_model_catalog_model_id_missing:${index}`);
      }

      return {
        id: entry.id,
        ...(typeof entry.object === "string" ? { object: entry.object } : {}),
        ...(typeof entry.created === "number" ? { created: entry.created } : {}),
        ...(typeof entry.owned_by === "string" ? { owned_by: entry.owned_by } : {})
      };
    })
  };
}

export async function fetchOpenAiModelCatalog(
  options: FetchOpenAiModelCatalogOptions = {}
): Promise<OpenAiModelCatalog> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("openai_api_key_missing");
  }

  const fetchFn = options.fetch ?? globalThis.fetch as unknown as CodexCliFetch | undefined;
  if (!fetchFn) {
    throw new Error("fetch_unavailable");
  }

  const baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
  const response = await fetchFn(`${baseUrl.replace(/\/+$/, "")}/models`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`openai_model_catalog_fetch_failed:${response.status}`);
  }

  return parseOpenAiModelCatalogResponse(JSON.parse(body));
}

export async function checkCodexCliModelCatalogAtStartup(
  options: CodexCliModelCatalogStartupCheckOptions = {}
): Promise<CodexCliModelCatalogStartupCheck> {
  const catalog = await fetchOpenAiModelCatalog(options);
  const detection = detectCodexCliModelCatalogDrift({
    officialModels: catalog,
    ...(options.knownModels ? { knownModels: options.knownModels } : {}),
    ...(options.relevantModelId ? { relevantModelId: options.relevantModelId } : {})
  });

  return {
    schemaVersion: "codex-cli-model-catalog-startup-check.v1",
    checkedAt: options.checkedAt ?? new Date().toISOString(),
    status: detection.status === "current" ? "ready" : "drift_detected",
    catalog,
    detection,
    warnings: detection.status === "current"
      ? []
      : ["codex_cli_model_catalog_drift_detected", ...detection.warnings]
  };
}

export async function createCodexCliModelCheckEvidence(
  options: CodexCliModelCheckEvidenceOptions = {}
): Promise<CodexCliModelCheckEvidence> {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const strict = options.strict ?? true;
  const mode: CodexCliModelCheckMode = strict ? "strict" : "warn";
  const baseUrl = sanitizeOpenAiBaseUrlForEvidence(options.baseUrl);
  const apiKeyConfigured = options.apiKey !== undefined
    ? options.apiKey.length > 0
    : Boolean(process.env.OPENAI_API_KEY);
  const knownModelCount = (options.knownModels ?? getKnownCodexCliModelIds()).length;

  try {
    const startupCheck = await checkCodexCliModelCatalogAtStartup({
      ...options,
      checkedAt: generatedAt
    });
    const blockingReasons = strict && startupCheck.status !== "ready"
      ? ["codex_cli_model_catalog_drift_detected"]
      : [];

    return {
      schemaVersion: "codex-cli-model-check-evidence.v1",
      generatedAt,
      host: options.host ?? "Codex CLI model catalog",
      mode,
      status: blockingReasons.length > 0 ? "failed" : "passed",
      api: {
        baseUrl,
        endpoint: "/models",
        apiKeyConfigured
      },
      summary: {
        officialModelCount: startupCheck.catalog.data.length,
        knownModelCount: startupCheck.detection.knownModels.length,
        availableKnownModelCount: startupCheck.detection.availableKnownModels.length,
        missingKnownModelCount: startupCheck.detection.missingKnownModels.length,
        untrackedOfficialModelCount: startupCheck.detection.untrackedOfficialModels.length,
        ignoredOfficialModelCount: startupCheck.detection.ignoredOfficialModelCount
      },
      detection: startupCheck.detection,
      warnings: startupCheck.warnings,
      blockingReasons
    };
  } catch (error) {
    const reason = sanitizeCodexCliModelCatalogCheckError(error);
    const blockingReasons = strict ? [reason] : [];

    return {
      schemaVersion: "codex-cli-model-check-evidence.v1",
      generatedAt,
      host: options.host ?? "Codex CLI model catalog",
      mode,
      status: strict ? "failed" : "unavailable",
      api: {
        baseUrl,
        endpoint: "/models",
        apiKeyConfigured
      },
      summary: {
        officialModelCount: 0,
        knownModelCount,
        availableKnownModelCount: 0,
        missingKnownModelCount: 0,
        untrackedOfficialModelCount: 0,
        ignoredOfficialModelCount: 0
      },
      warnings: [reason],
      blockingReasons
    };
  }
}

export async function writeCodexCliModelCheckEvidenceFile(
  evidence: CodexCliModelCheckEvidence,
  path: string
): Promise<CodexCliModelCheckEvidenceWriteResult> {
  const content = `${JSON.stringify(evidence, null, 2)}\n`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");

  return {
    path,
    bytes: Buffer.byteLength(content, "utf8")
  };
}

export async function runAndWriteCodexCliModelCheckEvidence(
  options: CodexCliModelCheckPersistOptions
): Promise<CodexCliModelCheckPersistResult> {
  const evidence = await createCodexCliModelCheckEvidence(options);
  const write = await writeCodexCliModelCheckEvidenceFile(evidence, options.evidencePath);

  return {
    evidence,
    write
  };
}

export async function createCodexCliModelCliProbeEvidence(
  options: CodexCliModelCliProbeEvidenceOptions = {}
): Promise<CodexCliModelCliProbeEvidence> {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const strict = options.strict ?? true;
  const mode: CodexCliModelCheckMode = strict ? "strict" : "warn";
  const model = (options.model ?? DEFAULT_CODEX_CLI_MODEL_PROBE_MODEL).trim();
  const command = options.codexCommand ?? resolveCodexCliRuntimeCommand();
  const workdir = options.cwd ?? process.cwd();

  if (!model) {
    const blockingReasons = strict ? ["codex_cli_model_probe_model_missing"] : [];
    return {
      schemaVersion: "codex-cli-model-cli-probe-evidence.v1",
      generatedAt,
      host: options.host ?? "Codex CLI model probe",
      source: "cli",
      mode,
      status: strict ? "failed" : "unavailable",
      model: "",
      cli: {
        command,
        sandbox: "read-only",
        approvalPolicy: "never",
        usesJson: true,
        skipGitRepoCheck: false,
        ephemeral: true,
        workdir
      },
      warnings: ["codex_cli_model_probe_model_missing"],
      blockingReasons
    };
  }

  const task = parseTaskEnvelope(createCodexCliModelProbeTask({
    model,
    repoRoot: workdir
  }));
  const plan = createCodexCliModelProbeExecPlan(task, {
    codexCommand: command,
    cwd: workdir,
    model
  });

  try {
    const run = await runCodexCliExecPlan(plan, {
      timeoutMs: options.timeoutMs ?? DEFAULT_CODEX_CLI_MODEL_PROBE_TIMEOUT_MS,
      ...(options.terminationGraceMs !== undefined
        ? { terminationGraceMs: options.terminationGraceMs }
        : {}),
      skipExecutionModelProbe: true,
      ...(options.env !== undefined ? { env: options.env } : {}),
      ...(options.oneShotEnv !== undefined ? { oneShotEnv: options.oneShotEnv } : {}),
      ...(options.spawn ? { spawn: options.spawn } : {})
    });
    const probeInspection = inspectCodexCliModelProbeRun(run);
    const blockingReasons = probeInspection.blockingReasons;
    const status = blockingReasons.length === 0
      ? "passed"
      : strict ? "failed" : "unavailable";
    const warnings = blockingReasons.length === 0
      ? [...run.inspection.warnings, ...probeInspection.warnings]
      : uniqueStrings([
          ...run.inspection.warnings,
          ...probeInspection.warnings,
          ...blockingReasons
        ]);

    return {
      schemaVersion: "codex-cli-model-cli-probe-evidence.v1",
      generatedAt,
      host: options.host ?? "Codex CLI model probe",
      source: "cli",
      mode,
      status,
      model,
      cli: createCodexCliModelProbePlanSummary(plan),
      run: {
        exitCode: run.output.exitCode,
        eventCount: run.inspection.events.length,
        parseErrorCount: run.inspection.parseErrors.length,
        timedOut: run.timedOut,
        killed: run.killed,
        ...createCodexCliProcessLifecycleEvidence(run),
        warnings: run.inspection.warnings,
        blockingReasons: run.inspection.blockingReasons,
        ...(run.error ? { error: run.error } : {})
      },
      warnings,
      blockingReasons: strict ? blockingReasons : []
    };
  } catch (error) {
    const reason = sanitizeCodexCliModelProbeError(error);
    const blockingReasons = strict ? [reason] : [];

    return {
      schemaVersion: "codex-cli-model-cli-probe-evidence.v1",
      generatedAt,
      host: options.host ?? "Codex CLI model probe",
      source: "cli",
      mode,
      status: strict ? "failed" : "unavailable",
      model,
      cli: createCodexCliModelProbePlanSummary(plan),
      warnings: [reason],
      blockingReasons
    };
  }
}

export async function writeCodexCliModelCliProbeEvidenceFile(
  evidence: CodexCliModelCliProbeEvidence,
  path: string
): Promise<CodexCliModelCheckEvidenceWriteResult> {
  const content = `${JSON.stringify(evidence, null, 2)}\n`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");

  return {
    path,
    bytes: Buffer.byteLength(content, "utf8")
  };
}

export async function runAndWriteCodexCliModelCliProbeEvidence(
  options: CodexCliModelCliProbePersistOptions
): Promise<CodexCliModelCliProbePersistResult> {
  const evidence = await createCodexCliModelCliProbeEvidence(options);
  const write = await writeCodexCliModelCliProbeEvidenceFile(evidence, options.evidencePath);

  return {
    evidence,
    write
  };
}

export function clearCodexCliModelProbeCache(): void {
  codexCliModelProbeCache.clear();
}

export function detectCodexCliModelCatalogDrift(
  options: CodexCliModelCatalogDetectionOptions
): CodexCliModelCatalogDetection {
  const knownModels = options.knownModels ?? getKnownCodexCliModelIds();
  const relevantModelId = options.relevantModelId ?? isDefaultRelevantCodexCliModelId;
  const officialModelIds = extractOpenAiModelIds(options.officialModels);
  const officialModelSet = new Set(officialModelIds);
  const relevantOfficialModels = officialModelIds.filter(relevantModelId);
  const relevantOfficialSet = new Set(relevantOfficialModels);
  const availableKnownModels = knownModels.filter((model) => officialModelSet.has(model));
  const missingKnownModels = knownModels.filter((model) => !officialModelSet.has(model));
  const untrackedOfficialModels = relevantOfficialModels.filter((model) => (
    !knownModels.includes(model as ModelId)
  ));
  const ignoredOfficialModelCount = officialModelIds.length - relevantOfficialModels.length;
  const driftDetected = missingKnownModels.length > 0 || untrackedOfficialModels.length > 0;

  return {
    schemaVersion: "codex-cli-model-catalog-detection.v1",
    status: driftDetected ? "drift_detected" : "current",
    knownModels: [...knownModels],
    availableKnownModels,
    missingKnownModels,
    untrackedOfficialModels,
    ignoredOfficialModelCount,
    warnings: [
      ...(missingKnownModels.length > 0
        ? ["known_models_missing_from_official_catalog"]
        : []),
      ...(untrackedOfficialModels.length > 0
        ? ["official_models_untracked_by_local_policy"]
        : []),
      ...(relevantOfficialSet.size === 0
        ? ["no_relevant_official_models_detected"]
        : [])
    ]
  };
}

export function checkCodexCliModelAvailability(
  options: CodexCliModelAvailabilityOptions
): CodexCliModelAvailabilityCheck {
  const model = options.model?.trim();

  if (!model) {
    return {
      schemaVersion: "codex-cli-model-availability-check.v1",
      status: "not_checked",
      checked: false,
      available: false,
      blockingReasons: [],
      warnings: ["codex_cli_model_not_specified"]
    };
  }

  if (options.officialModels === undefined) {
    return {
      schemaVersion: "codex-cli-model-availability-check.v1",
      status: "not_checked",
      checked: false,
      available: false,
      model,
      blockingReasons: options.requireCatalog
        ? ["codex_cli_model_catalog_required"]
        : [],
      warnings: ["codex_cli_model_catalog_not_provided"]
    };
  }

  const officialModelIds = extractOpenAiModelIds(options.officialModels);
  const detection = detectCodexCliModelCatalogDrift({
    officialModels: options.officialModels,
    ...(options.knownModels ? { knownModels: options.knownModels } : {}),
    ...(options.relevantModelId ? { relevantModelId: options.relevantModelId } : {})
  });
  const available = officialModelIds.includes(model);

  return {
    schemaVersion: "codex-cli-model-availability-check.v1",
    status: available ? "available" : "missing",
    checked: true,
    available,
    model,
    detection,
    blockingReasons: available ? [] : [`codex_cli_model_unavailable:${model}`],
    warnings: [
      ...(detection.status === "current"
        ? []
        : ["codex_cli_model_catalog_drift_detected", ...detection.warnings])
    ]
  };
}

export function checkCodexCliExecPlanModelAvailability(
  plan: CodexCliExecPlan,
  options: Pick<
    CodexCliProcessRunOptions,
    | "modelCatalog"
    | "requireModelCatalog"
    | "modelCatalogKnownModels"
    | "modelCatalogRelevance"
  > = {}
): CodexCliModelAvailabilityCheck {
  const model = plan.model ?? getCodexCliArgValue(plan.args, "--model");
  return checkCodexCliModelAvailability({
    ...(model !== undefined ? { model } : {}),
    ...(options.modelCatalog ? { officialModels: options.modelCatalog } : {}),
    ...(options.requireModelCatalog !== undefined
      ? { requireCatalog: options.requireModelCatalog }
      : {}),
    ...(options.modelCatalogKnownModels
      ? { knownModels: options.modelCatalogKnownModels }
      : {}),
    ...(options.modelCatalogRelevance
      ? { relevantModelId: options.modelCatalogRelevance }
      : {})
  });
}

export async function checkCodexCliEnvironmentPreflight(
  options: CodexCliEnvironmentPreflightOptions = {}
): Promise<CodexCliEnvironmentPreflightResult> {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const command = options.codexCommand ?? resolveCodexCliRuntimeCommand();
  const realCliAllowed = options.allowRealCodexCli === true;
  const spawn = options.spawn ?? (realCliAllowed ? defaultCodexCliProcessSpawner : undefined);

  if (!spawn) {
    return {
      schemaVersion: "codex-cli-environment-preflight.v1",
      generatedAt,
      status: "blocked",
      checks: {
        injectedSpawner: false,
        realCliAllowed,
        versionProbe: "skipped",
        noTaskEnvelope: true,
        noPromptSent: true,
        noWorkspaceWrite: true,
        noRealCliFallback: true
      },
      cli: {
        commandResolved: Boolean(command.trim()),
        timedOut: false,
        killed: false,
        closeReceived: false,
        warningCount: 0
      },
      warnings: [],
      blockingReasons: ["codex_cli_environment_preflight_requires_injected_spawn"]
    };
  }

  let stdout = "";
  let stderr = "";
  let timedOut = false;
  let killed = false;
  let closeReceived = false;
  let exitCode: number | undefined;
  let timeout: NodeJS.Timeout | undefined;

  const createResult = (
    versionProbe: "passed" | "failed",
    extraBlockers: string[] = []
  ): CodexCliEnvironmentPreflightResult => {
    const warnings = extractCodexCliWarnings(stderr);
    const version = sanitizeCodexCliVersionProbe(stdout);
    const blockingReasons = [
      ...(versionProbe === "passed" ? [] : ["codex_cli_environment_preflight_version_probe_failed"]),
      ...(timedOut ? ["codex_cli_environment_preflight_timeout"] : []),
      ...extraBlockers
    ];

    return {
      schemaVersion: "codex-cli-environment-preflight.v1",
      generatedAt,
      status: blockingReasons.length === 0 ? "ready" : "blocked",
      checks: {
        injectedSpawner: options.spawn !== undefined,
        realCliAllowed,
        versionProbe,
        noTaskEnvelope: true,
        noPromptSent: true,
        noWorkspaceWrite: true,
        noRealCliFallback: true
      },
      cli: {
        commandResolved: Boolean(command.trim()),
        ...(version ? { version } : {}),
        ...(exitCode !== undefined ? { exitCode } : {}),
        timedOut,
        killed,
        closeReceived,
        warningCount: warnings.length
      },
      warnings,
      blockingReasons
    };
  };

  let child: CodexCliChildProcess;
  try {
    const spawnEnv = resolveCodexCliSpawnEnv(command, {
      ...(options.env !== undefined ? { baseEnv: options.env } : {}),
      ...(options.oneShotEnv !== undefined ? { oneShotEnv: options.oneShotEnv } : {})
    });
    child = spawn(command, ["--version"], {
      ...(options.cwd ? { cwd: options.cwd } : {}),
      ...(spawnEnv ? { env: spawnEnv } : {}),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
  } catch {
    return createResult("failed", ["codex_cli_environment_preflight_spawn_failed"]);
  }

  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  return await new Promise<CodexCliEnvironmentPreflightResult>((resolve) => {
    let settled = false;
    const settle = (versionProbe: "passed" | "failed", extraBlockers: string[] = []) => {
      if (settled) {
        return;
      }

      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }

      resolve(createResult(versionProbe, extraBlockers));
    };

    if (options.timeoutMs !== undefined && options.timeoutMs > 0) {
      timeout = setTimeout(() => {
        timedOut = true;
        killed = child.kill("SIGTERM");
        settle("failed");
      }, options.timeoutMs);
    }

    child.on("error", () => {
      exitCode = 1;
      settle("failed", ["codex_cli_environment_preflight_process_error"]);
    });

    child.on("close", (code) => {
      closeReceived = true;
      exitCode = code ?? 1;
      const version = sanitizeCodexCliVersionProbe(stdout);
      settle(exitCode === 0 && version ? "passed" : "failed");
    });
  });
}

export function resolveCodexCliSandboxForRoutingDecision(
  decisionInput: RoutingDecisionInput
): CodexCliSandboxMode {
  const decision = parseRoutingDecision(decisionInput);
  return decision.execution.toolAccess === "read_only"
    ? "read-only"
    : "workspace-write";
}

export function buildCodexCliTaskPrompt(task: TaskEnvelope): string {
  return [
    "You are running as a Codex CLI host adapter for codex-router.",
    "Follow the task envelope exactly and preserve codex-router safety posture.",
    "",
    "Task envelope:",
    JSON.stringify(task, null, 2)
  ].join("\n");
}

export function resolveCodexCliSandbox(task: TaskEnvelope): CodexCliSandboxMode {
  switch (task.hints.taskClassHint) {
    case "read_only":
      return "read-only";
    case "small_edit":
    case "engineering":
    case "high_risk":
    case "release_external_action":
    default:
      return "workspace-write";
  }
}

export function parseCodexCliJsonl(output: string): CodexCliJsonlParseResult {
  const events: CodexCliJsonlEvent[] = [];
  const parseErrors: CodexCliJsonlParseError[] = [];

  output.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    try {
      const event = JSON.parse(trimmed) as unknown;
      if (!isRecord(event)) {
        parseErrors.push({
          line: index + 1,
          raw: line,
          error: "codex_cli_jsonl_event_not_object"
        });
        return;
      }

      events.push({
        line: index + 1,
        raw: line,
        event
      });
    } catch (error) {
      parseErrors.push({
        line: index + 1,
        raw: line,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return {
    events,
    parseErrors
  };
}

export function inspectCodexCliCommandOutput(
  output: CodexCliCommandOutput,
  options: CodexCliSemanticInspectionOptions = {}
): CodexCliCommandInspection {
  const parsed = parseCodexCliJsonl(output.stdout);
  const warnings = extractCodexCliWarnings(output.stderr ?? "");
  const blockingReasons = [
    ...(output.exitCode === 0 ? [] : [`codex_cli_exit_code:${output.exitCode}`]),
    ...(parsed.parseErrors.length === 0 ? [] : ["codex_cli_jsonl_parse_error"]),
    ...inspectCodexCliJsonlSemantics(parsed.events, options)
  ];

  return {
    status: blockingReasons.length === 0 ? "completed" : "failed",
    events: parsed.events.map(sanitizeCodexCliJsonlEventForResult),
    parseErrors: parsed.parseErrors.map(sanitizeCodexCliJsonlParseErrorForResult),
    warnings,
    blockingReasons
  };
}

function inspectCodexCliJsonlSemantics(
  events: CodexCliJsonlEvent[],
  options: CodexCliSemanticInspectionOptions
): string[] {
  const blockingReasons: string[] = [];
  const targetFiles = normalizeCodexCliExplicitTargetAllowlist(options.targetFiles)
    .map(normalizeCodexCliInspectionPath);

  for (const event of events) {
    const semanticType = getCodexCliJsonlSemanticEventType(event.event);
    if (semanticType === undefined) {
      if (options.strictUnknownEvents === true) {
        blockingReasons.push("codex_cli_jsonl_event_type_missing");
      }
      continue;
    }

    if (
      options.strictUnknownEvents === true
      && !isKnownCodexCliJsonlEvent(event.event, semanticType)
    ) {
      blockingReasons.push(
        `codex_cli_jsonl_unknown_event_type:${redactCodexCliSensitiveEvidenceText(semanticType)}`
      );
      continue;
    }

    if (codexCliJsonlEventHasSecretLikeContent(event.event)) {
      blockingReasons.push("codex_cli_jsonl_secret_like_content");
    }

    if (isCodexCliFileChangeLikeEventType(semanticType)) {
      if (options.sandbox === "read-only") {
        blockingReasons.push(
          `codex_cli_readonly_jsonl_file_change_not_allowed:${semanticType}`
        );
      } else if (options.sandbox === "workspace-write") {
        const changedFiles = extractCodexCliJsonlEventFilePaths(event.event);
        if (changedFiles.length === 0) {
          blockingReasons.push(
            `codex_cli_workspace_write_jsonl_file_change_without_path:${semanticType}`
          );
        }

        for (const file of changedFiles) {
          if (!targetFiles.includes(file)) {
            blockingReasons.push(
              `codex_cli_workspace_write_jsonl_file_change_not_permitted:${redactCodexCliSensitiveEvidenceText(file)}`
            );
          }
        }
      }
    }

    if (isCodexCliCommandExecutionLikeEventType(semanticType)) {
      const commandText = extractCodexCliJsonlCommandText(event.event);
      if (commandText === undefined) {
        if (options.sandbox === "read-only") {
          blockingReasons.push(
            `codex_cli_readonly_jsonl_command_safety_unknown:${semanticType}`
          );
        }
        continue;
      }

      if (isCodexCliRemoteWriteCommand(commandText)) {
        blockingReasons.push("codex_cli_jsonl_remote_write_command_not_allowed");
      }

      if (
        options.sandbox === "read-only"
        && isCodexCliWriteCommand(commandText)
      ) {
        blockingReasons.push("codex_cli_readonly_jsonl_write_command_not_allowed");
      }
    }

    if (
      options.sandbox === "read-only"
      && isCodexCliWriteToolLikeEventType(semanticType)
    ) {
      blockingReasons.push(
        `codex_cli_readonly_jsonl_write_tool_not_allowed:${semanticType}`
      );
    }
  }

  return uniqueStrings(blockingReasons);
}

function getCodexCliJsonlSemanticEventType(
  payload: Record<string, unknown>
): string | undefined {
  const item = isRecord(payload.item) ? payload.item : undefined;
  return typeof item?.type === "string"
    ? item.type
    : typeof payload.type === "string"
      ? payload.type
      : undefined;
}

function isKnownCodexCliJsonlEvent(
  payload: Record<string, unknown>,
  semanticType: string
): boolean {
  const item = isRecord(payload.item) ? payload.item : undefined;
  const topLevelType = typeof payload.type === "string" ? payload.type : undefined;
  const itemType = typeof item?.type === "string" ? item.type : undefined;
  const normalizedTopLevelType = topLevelType?.toLowerCase();
  const normalizedSemanticType = semanticType.toLowerCase();
  const topLevelEventKnown = normalizedTopLevelType === "agent_message"
    || normalizedTopLevelType === "session.started"
    || normalizedTopLevelType === "session.updated"
    || normalizedTopLevelType === "session.completed"
    || normalizedTopLevelType === "thread.started"
    || normalizedTopLevelType === "thread.updated"
    || normalizedTopLevelType === "thread.completed"
    || normalizedTopLevelType === "turn.started"
    || normalizedTopLevelType === "turn.completed"
    || normalizedTopLevelType === "task.started"
    || normalizedTopLevelType === "task.completed"
    || normalizedTopLevelType === "item.started"
    || normalizedTopLevelType === "item.completed"
    || normalizedTopLevelType === "item.updated"
    || normalizedTopLevelType === "plan_update"
    || normalizedTopLevelType === "token_count"
    || normalizedTopLevelType === "warning"
    || normalizedTopLevelType === "error";
  const semanticEventKnown = normalizedSemanticType === "agent_message"
    || normalizedSemanticType === "reasoning"
    || normalizedSemanticType === "message"
    || normalizedSemanticType === "plan_update"
    || normalizedSemanticType === "token_count"
    || isCodexCliCommandExecutionLikeEventType(semanticType)
    || isCodexCliProbeToolLikeEventType(semanticType)
    || isCodexCliFileChangeLikeEventType(semanticType);

  return itemType !== undefined && normalizedTopLevelType?.startsWith("item.")
    ? semanticEventKnown
    : topLevelEventKnown || semanticEventKnown;
}

function codexCliJsonlEventHasSecretLikeContent(
  payload: Record<string, unknown>
): boolean {
  return codexCliJsonlValueHasSecretLikeContent(payload);
}

function codexCliJsonlValueHasSecretLikeContent(value: unknown): boolean {
  if (typeof value === "string") {
    return redactCodexCliSensitiveEvidenceText(value) !== value;
  }

  if (Array.isArray(value)) {
    return value.some(codexCliJsonlValueHasSecretLikeContent);
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.entries(value).some(([key, entryValue]) => {
    if (
      !isCodexCliJsonlSafeTokenMetricKey(key)
      && isCodexCliJsonlSecretLikeFieldKey(key)
    ) {
      return true;
    }

    return codexCliJsonlValueHasSecretLikeContent(entryValue);
  });
}

function isCodexCliJsonlSafeTokenMetricKey(key: string): boolean {
  return /^(?:input|output|total|cached|reasoning|prompt|completion)_tokens$/i.test(key)
    || /^tokens_(?:input|output|total|cached|reasoning|prompt|completion)$/i.test(key);
}

function isCodexCliJsonlSecretLikeFieldKey(key: string): boolean {
  const normalizedKeyParts = normalizeCodexCliJsonlFieldKeyParts(key);

  return normalizedKeyParts.includes("authorization")
    || normalizedKeyParts.includes("credential")
    || normalizedKeyParts.includes("password")
    || normalizedKeyParts.includes("secret")
    || normalizedKeyParts.includes("token")
    || hasAdjacentCodexCliJsonlFieldKeyParts(normalizedKeyParts, "api", "key")
    || /\bauth\.json\b/i.test(key);
}

function normalizeCodexCliJsonlFieldKeyParts(key: string): string[] {
  return key
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .map((part) => part.toLowerCase())
    .filter(Boolean)
    .flatMap((part) => part.endsWith("s") ? [part, part.slice(0, -1)] : [part]);
}

function hasAdjacentCodexCliJsonlFieldKeyParts(
  parts: string[],
  first: string,
  second: string
): boolean {
  return parts.some((part, index) => (
    part === first && parts[index + 1] === second
  ));
}

function isCodexCliFileChangeLikeEventType(type: string): boolean {
  const normalized = type.toLowerCase().replace(/[-.]/g, "_");
  return normalized === "file_change"
    || normalized === "file_changed"
    || normalized === "file_update"
    || normalized === "file_write"
    || normalized === "patch"
    || normalized === "apply_patch"
    || normalized === "diff"
    || normalized.includes("file_change")
    || normalized.includes("file_write")
    || normalized.includes("apply_patch");
}

function isCodexCliCommandExecutionLikeEventType(type: string): boolean {
  const normalized = type.toLowerCase().replace(/[-.]/g, "_");
  return normalized === "command_execution"
    || normalized === "shell_command"
    || normalized === "exec_command"
    || normalized.includes("command_execution")
    || normalized.includes("shell_command");
}

function isCodexCliWriteToolLikeEventType(type: string): boolean {
  const normalized = type.toLowerCase().replace(/[-.]/g, "_");
  return normalized === "mcp_tool_call"
    || normalized === "tool_call"
    || normalized === "function_call"
    || normalized.includes("apply_patch")
    || normalized.includes("write")
    || normalized.includes("edit")
    || normalized.includes("delete")
    || normalized.includes("remove");
}

function extractCodexCliJsonlCommandText(
  payload: Record<string, unknown>
): string | undefined {
  const item = isRecord(payload.item) ? payload.item : undefined;
  const command = firstString([
    payload.command,
    payload.cmd,
    item?.command,
    item?.cmd,
    joinStringArray(payload.argv),
    joinStringArray(payload.args),
    joinStringArray(item?.argv),
    joinStringArray(item?.args)
  ]);

  return command?.trim() || undefined;
}

function extractCodexCliJsonlEventFilePaths(
  payload: Record<string, unknown>
): string[] {
  const paths: string[] = [];
  collectCodexCliJsonlEventFilePaths(payload, paths);
  return uniqueStrings(
    paths
      .map((path) => normalizeCodexCliOptionalText(normalizeCodexCliInspectionPath(path)))
      .filter((path): path is string => path !== undefined)
  );
}

function normalizeCodexCliInspectionPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function collectCodexCliJsonlEventFilePaths(value: unknown, paths: string[]): void {
  if (typeof value === "string") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectCodexCliJsonlEventFilePaths(item, paths));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, entryValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (
      typeof entryValue === "string"
      && (normalizedKey === "path"
        || normalizedKey === "file"
        || normalizedKey === "file_path"
        || normalizedKey === "filepath"
        || normalizedKey === "target_file")
    ) {
      paths.push(entryValue);
      continue;
    }

    if (
      Array.isArray(entryValue)
      && entryValue.every((item): item is string => typeof item === "string")
      && (normalizedKey === "paths"
        || normalizedKey === "files"
        || normalizedKey === "file_paths"
        || normalizedKey === "changed_files")
    ) {
      paths.push(...entryValue);
      continue;
    }

    collectCodexCliJsonlEventFilePaths(entryValue, paths);
  }
}

function isCodexCliWriteCommand(command: string): boolean {
  const normalized = normalizeCodexCliCommandForInspection(command);
  return /\b(rm|del|erase|rmdir|mv|move|cp|copy|touch|mkdir)\b/.test(normalized)
    || /\b(git\s+(?:checkout|restore|reset|clean|add|commit|merge|rebase|tag|push))\b/.test(normalized)
    || /\b(npm|pnpm|yarn)\s+(?:publish|version|install|update|audit\s+fix)\b/.test(normalized)
    || /\bapply_patch\b/.test(normalized)
    || />>|>\s*[^&]/.test(normalized);
}

function isCodexCliRemoteWriteCommand(command: string): boolean {
  const normalized = normalizeCodexCliCommandForInspection(command);
  return /\bgit\s+(?:push|merge|tag)\b/.test(normalized)
    || /\bgh\s+(?:pr\s+merge|release\s+(?:create|upload|delete)|repo\s+(?:edit|delete))\b/.test(normalized)
    || /\b(npm|pnpm|yarn)\s+publish\b/.test(normalized);
}

function normalizeCodexCliCommandForInspection(command: string): string {
  return command.trim().replace(/\s+/g, " ").toLowerCase();
}

function firstString(values: Array<unknown>): string | undefined {
  return values.find((value): value is string => (
    typeof value === "string" && value.trim().length > 0
  ));
}

function joinStringArray(value: unknown): string | undefined {
  return Array.isArray(value) && value.every((item): item is string => typeof item === "string")
    ? value.join(" ")
    : undefined;
}

function sanitizeCodexCliCommandOutputForResult(
  output: CodexCliCommandOutput
): CodexCliCommandOutput {
  return {
    exitCode: output.exitCode,
    stdout: redactCodexCliSensitiveEvidenceText(output.stdout),
    ...(output.stderr !== undefined
      ? { stderr: redactCodexCliSensitiveEvidenceText(output.stderr) }
      : {})
  };
}

function sanitizeCodexCliJsonlEventForResult(
  event: CodexCliJsonlEvent
): CodexCliJsonlEvent {
  const redactedEvent = redactCodexCliSensitiveEvidenceValue(event.event);

  return {
    line: event.line,
    raw: redactCodexCliSensitiveEvidenceText(event.raw),
    event: isRecord(redactedEvent) ? redactedEvent : {}
  };
}

function sanitizeCodexCliJsonlParseErrorForResult(
  parseError: CodexCliJsonlParseError
): CodexCliJsonlParseError {
  return {
    line: parseError.line,
    raw: redactCodexCliSensitiveEvidenceText(parseError.raw),
    error: redactCodexCliSensitiveEvidenceText(parseError.error)
  };
}

function redactCodexCliSensitiveEvidenceText(value: string): string {
  return redactCodexCliAuthJsonPaths(redactSecretLikeText(value, [
    "CODEX_API_KEY",
    "OPENAI_API_KEY",
    "CODEX_ACCESS_TOKEN"
  ]));
}

function redactCodexCliSensitiveEvidenceValue(value: unknown): unknown {
  return redactCodexCliAuthJsonPathsInValue(redactSecretLikeFields(value, {
    additionalSecretKeys: [
      "CODEX_API_KEY",
      "OPENAI_API_KEY",
      "CODEX_ACCESS_TOKEN"
    ],
    redactArgvSecrets: true,
    redactStrings: true
  }));
}

function redactCodexCliAuthJsonPathsInValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactCodexCliAuthJsonPaths(value);
  }

  if (Array.isArray(value)) {
    return value.map(redactCodexCliAuthJsonPathsInValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    output[key] = redactCodexCliAuthJsonPathsInValue(entryValue);
  }

  return output;
}

function redactCodexCliAuthJsonPaths(value: string): string {
  return value.replace(
    /(?:~|[A-Za-z]:)?(?:[\\/][^\s"'<>|]+)+[\\/]auth\.json\b|\bauth\.json\b/gi,
    "<REDACTED_AUTH_JSON_PATH>"
  );
}

function normalizeCodexCliSafeError(error: unknown): string {
  return redactCodexCliSensitiveEvidenceText(
    error instanceof Error ? error.message : String(error)
  );
}

export function validateCodexCliExecPlanForRun(
  plan: CodexCliExecPlan,
  options: Pick<
    CodexCliProcessRunOptions,
    | "allowWriteSandbox"
    | "allowSkipGitRepoCheck"
    | "workspaceWritePreflight"
    | "modelProbe"
    | "requireModelProbe"
    | "autoProbeModelWithCli"
    | "modelCatalog"
    | "requireModelCatalog"
    | "modelCatalogKnownModels"
    | "modelCatalogRelevance"
  > = {}
): string[] {
  const blockingReasons: string[] = [];

  if (!plan.command.trim()) {
    blockingReasons.push("codex_cli_command_missing");
  }

  if (!plan.args.includes("exec")) {
    blockingReasons.push("codex_cli_plan_must_use_exec");
  }

  if (!plan.args.includes("--json")) {
    blockingReasons.push("codex_cli_plan_must_use_json");
  }

  const sandboxArg = getCodexCliArgValue(plan.args, "--sandbox");
  if (!sandboxArg) {
    blockingReasons.push("codex_cli_plan_must_set_sandbox");
  } else if (!["read-only", "workspace-write"].includes(sandboxArg)) {
    blockingReasons.push(`codex_cli_unsupported_sandbox_arg:${sandboxArg}`);
  } else if (sandboxArg !== plan.sandbox) {
    blockingReasons.push(`codex_cli_sandbox_arg_mismatch:${sandboxArg}:${plan.sandbox}`);
  }

  const isWorkspaceWritePlan = plan.sandbox === "workspace-write"
    || sandboxArg === "workspace-write";

  if (plan.sandbox === "workspace-write" && options.allowWriteSandbox !== true) {
    blockingReasons.push("codex_cli_write_sandbox_requires_explicit_allowance");
  }

  if (!["read-only", "workspace-write"].includes(plan.sandbox)) {
    blockingReasons.push(`codex_cli_unsupported_sandbox:${plan.sandbox}`);
  }

  const skipGitRepoCheckArg = findCodexCliArgMatch(plan.args, ["--skip-git-repo-check"]);
  if (
    skipGitRepoCheckArg !== undefined
    && (plan.sandbox === "workspace-write" || sandboxArg === "workspace-write")
  ) {
    blockingReasons.push(
      `codex_cli_skip_git_repo_check_not_allowed_for_workspace_write:${skipGitRepoCheckArg}`
    );
  } else if (
    skipGitRepoCheckArg !== undefined
    && options.allowSkipGitRepoCheck !== true
  ) {
    blockingReasons.push(
      `codex_cli_skip_git_repo_check_requires_explicit_allowance:${skipGitRepoCheckArg}`
    );
  }

  if (isWorkspaceWritePlan) {
    const beforeCommit = normalizeCodexCliOptionalText(
      options.workspaceWritePreflight?.beforeCommit
    );
    const rollbackCommand = normalizeCodexCliOptionalText(
      options.workspaceWritePreflight?.rollbackCommand
    );
    const targetAllowlist = normalizeCodexCliExplicitTargetAllowlist(
      options.workspaceWritePreflight?.targetAllowlist
    );
    const repoRootKnown = normalizeCodexCliOptionalText(plan.task.repoContext.repoRoot)
      !== undefined
      || normalizeCodexCliOptionalText(plan.workdir) !== undefined;
    const targetFilesAllowed = plan.task.target.files.length > 0
      && targetAllowlist.length > 0
      && plan.task.target.files.every((file) => targetAllowlist.includes(file));

    if (!repoRootKnown) {
      blockingReasons.push("codex_cli_workspace_write_smoke_requires_repo_root");
    }
    if (plan.task.repoContext.worktreeClean !== true) {
      blockingReasons.push("codex_cli_workspace_write_smoke_requires_clean_worktree");
    }
    if (beforeCommit === undefined) {
      blockingReasons.push("codex_cli_workspace_write_smoke_requires_before_commit");
    }
    if (rollbackCommand === undefined) {
      blockingReasons.push("codex_cli_workspace_write_smoke_requires_rollback_command");
    }
    if (!targetFilesAllowed) {
      blockingReasons.push("codex_cli_workspace_write_smoke_target_not_allowlisted");
    }
  }

  const approvalArg = getCodexCliArgValue(plan.args, "--ask-for-approval")
    ?? getCodexCliArgValue(plan.args, "-a");
  const approvalArgOmittedForReadOnlyNever =
    approvalArg === undefined
    && plan.sandbox === "read-only"
    && plan.approvalPolicy === "never";
  if (!approvalArg) {
    if (!approvalArgOmittedForReadOnlyNever) {
      blockingReasons.push("codex_cli_plan_must_set_approval_policy");
    }
  } else if (!["untrusted", "on-request", "never"].includes(approvalArg)) {
    blockingReasons.push(`codex_cli_unsupported_approval_policy_arg:${approvalArg}`);
  } else if (approvalArg !== plan.approvalPolicy) {
    blockingReasons.push(`codex_cli_approval_policy_arg_mismatch:${approvalArg}:${plan.approvalPolicy}`);
  }

  if (!["untrusted", "on-request", "never"].includes(plan.approvalPolicy)) {
    blockingReasons.push(`codex_cli_unsupported_approval_policy:${plan.approvalPolicy}`);
  }

  const workdirArg = getCodexCliArgValue(plan.args, "--cd")
    ?? getCodexCliArgValue(plan.args, "--cwd")
    ?? getCodexCliArgValue(plan.args, "-C");
  if (workdirArg !== undefined && workdirArg !== plan.workdir) {
    blockingReasons.push(`codex_cli_workdir_arg_mismatch:${workdirArg}:${plan.workdir ?? "undefined"}`);
  }

  try {
    assertNoDangerousCodexCliArgs(plan.args);
  } catch (error) {
    blockingReasons.push(error instanceof Error ? error.message : String(error));
  }

  try {
    assertNoCodexCliWorkspaceExpansionArgs(plan.args);
  } catch (error) {
    blockingReasons.push(error instanceof Error ? error.message : String(error));
  }

  try {
    assertNoCodexCliProviderOverrideArgs(plan.args);
  } catch (error) {
    blockingReasons.push(error instanceof Error ? error.message : String(error));
  }

  try {
    assertNoCodexCliOutputWriteArgs(plan.args);
  } catch (error) {
    blockingReasons.push(error instanceof Error ? error.message : String(error));
  }

  try {
    assertNoCodexCliOutputSchemaArgs(plan.args);
  } catch (error) {
    blockingReasons.push(error instanceof Error ? error.message : String(error));
  }

  try {
    assertNoCodexCliImageAttachmentArgs(plan.args);
  } catch (error) {
    blockingReasons.push(error instanceof Error ? error.message : String(error));
  }

  try {
    assertNoCodexCliExecSubcommandArgs(plan.args, plan.prompt);
  } catch (error) {
    blockingReasons.push(error instanceof Error ? error.message : String(error));
  }

  try {
    assertNoCodexCliPolicyBypassArgs(plan.args);
  } catch (error) {
    blockingReasons.push(error instanceof Error ? error.message : String(error));
  }

  try {
    assertNoDuplicateCodexCliSecurityArgs(plan.args);
  } catch (error) {
    blockingReasons.push(error instanceof Error ? error.message : String(error));
  }

  try {
    assertNoGovernedCodexCliConfigOverrides(plan.args);
  } catch (error) {
    blockingReasons.push(error instanceof Error ? error.message : String(error));
  }

  const modelAvailability = checkCodexCliExecPlanModelAvailability(plan, options);
  blockingReasons.push(...modelAvailability.blockingReasons);

  if (
    options.requireModelProbe === true &&
    options.modelProbe === undefined &&
    options.autoProbeModelWithCli !== true
  ) {
    blockingReasons.push("codex_cli_model_probe_required");
  }

  return blockingReasons;
}

export async function runCodexCliExecPlan(
  plan: CodexCliExecPlan,
  options: CodexCliProcessRunOptions = {}
): Promise<CodexCliProcessRunResult> {
  const resolvedOptions = resolveCodexCliProcessRunOptions(plan, options);
  const modelAvailability = checkCodexCliExecPlanModelAvailability(plan, resolvedOptions);
  const modelProbe = await resolveCodexCliModelProbeForRun(plan, resolvedOptions);
  const governanceBlockers = resolvedOptions.governance?.enabled === false
    ? []
    : getCodexCliGovernancePreRunBlockers(plan, resolvedOptions.governance?.previousState);
  const validationBlockers = [
    ...validateCodexCliExecPlanForRun(plan, resolvedOptions),
    ...governanceBlockers
  ];
  const modelProbeBlockers = getCodexCliModelProbeBlockingReasons(modelProbe, resolvedOptions);

  if (validationBlockers.length > 0 || modelProbeBlockers.length > 0) {
    throw new Error(`codex_cli_plan_not_runnable:${[
      ...validationBlockers,
      ...modelProbeBlockers
    ].join(",")}`);
  }

  const spawn = resolvedOptions.spawn ?? defaultCodexCliProcessSpawner;
  let stdout = "";
  let stderr = "";
  let timedOut = false;
  let killed = false;
  let stdinClosed = false;
  let stdinDestroyed = false;
  let stdinError: string | undefined;
  let closeReceived = false;
  let forcedSettled = false;
  let stdioDestroyed = false;
  let unrefCalled = false;
  let killRequested = false;
  let killSignal: NodeJS.Signals | undefined;
  let escalated = false;
  let escalationSignal: NodeJS.Signals | undefined;
  let escalationKilled: boolean | undefined;
  let closeCode: number | null | undefined;
  let closeSignal: NodeJS.Signals | null | undefined;
  const terminationGraceMs = resolvedOptions.terminationGraceMs
    ?? DEFAULT_CODEX_CLI_TERMINATION_GRACE_MS;

  const createResult = (
    output: CodexCliCommandOutput,
    error?: string
  ): CodexCliProcessRunResult => {
    const safeOutput = sanitizeCodexCliCommandOutputForResult(output);
    const safeError = error !== undefined
      ? redactCodexCliSensitiveEvidenceText(error)
      : undefined;
    const inspection = inspectCodexCliCommandOutput(output, {
      sandbox: plan.sandbox,
      targetFiles: plan.task.target.files,
      strictUnknownEvents: true
    });
    const blockingReasons = [
      ...inspection.blockingReasons,
      ...(timedOut ? ["codex_cli_process_timeout"] : []),
      ...(safeError ? [`codex_cli_process_error:${safeError}`] : [])
    ];
    const inspectionWithRuntime: CodexCliCommandInspection = {
      ...inspection,
      blockingReasons,
      status: inspection.blockingReasons.length === 0 && !timedOut && !error
        ? "completed"
        : "failed"
    };
    const governance = resolvedOptions.governance?.enabled === false
      ? undefined
      : createCodexCliGovernanceBundle({
        task: plan.task,
        plan,
        stage: inspectionWithRuntime.status === "completed"
          ? "execution-completed"
          : "execution-failed",
        status: inspectionWithRuntime.status === "completed"
          ? "succeeded"
          : timedOut || error || inspectionWithRuntime.parseErrors.length > 0
            ? "failed"
            : "degraded",
        eventCount: inspectionWithRuntime.events.length,
        parseErrorCount: inspectionWithRuntime.parseErrors.length,
        blockingReasons: inspectionWithRuntime.blockingReasons,
        warnings: inspectionWithRuntime.warnings,
        ...(safeError ? { error: safeError } : {}),
        timedOut,
        killed,
        ...(resolvedOptions.governance?.evidenceRef
          ? { evidenceRef: resolvedOptions.governance.evidenceRef }
          : {}),
        ...(resolvedOptions.governance?.previousState
          ? { previousState: resolvedOptions.governance.previousState }
          : {}),
        ...(resolvedOptions.governance?.now ? { now: resolvedOptions.governance.now } : {})
      });
    return {
      plan,
      output: safeOutput,
      inspection: inspectionWithRuntime,
      timedOut,
      killed,
      lifecycle: {
        stdin: {
          mode: "pipe",
          closed: stdinClosed,
          destroyed: stdinDestroyed,
          ...(stdinError ? { error: redactCodexCliSensitiveEvidenceText(stdinError) } : {})
        },
        termination: {
          closeReceived,
          forcedSettled,
          stdioDestroyed,
          unrefCalled,
          timedOut,
          killRequested,
          killed,
          ...(killSignal ? { killSignal } : {}),
          escalated,
          ...(escalationSignal ? { escalationSignal } : {}),
          ...(escalationKilled !== undefined ? { escalationKilled } : {}),
          ...(terminationGraceMs > 0 ? { graceMs: terminationGraceMs } : {}),
          ...(closeCode !== undefined ? { closeCode } : {}),
          ...(closeSignal !== undefined ? { closeSignal } : {})
        }
      },
      modelAvailability,
      ...(modelProbe ? { modelProbe } : {}),
      ...(governance ? { governance } : {}),
      ...(safeError ? { error: safeError } : {})
    };
  };

  const spawnEnv = resolveCodexCliSpawnEnv(plan.command, {
    ...(resolvedOptions.env !== undefined ? { baseEnv: resolvedOptions.env } : {}),
    ...(resolvedOptions.oneShotEnv !== undefined ? { oneShotEnv: resolvedOptions.oneShotEnv } : {})
  });
  let child: CodexCliChildProcess;
  try {
    child = spawn(plan.command, plan.args, {
      ...(plan.workdir ? { cwd: plan.workdir } : {}),
      ...(spawnEnv ? { env: spawnEnv } : {}),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
  } catch (error) {
    return createResult({
      exitCode: 1,
      stdout,
      stderr: [
        stderr,
        normalizeCodexCliSpawnError(error)
      ].filter(Boolean).join("\n")
    }, normalizeCodexCliSpawnError(error));
  }

  try {
    child.stdin?.end();
    stdinClosed = true;
    if (child.stdin?.destroy !== undefined) {
      child.stdin.destroy();
      stdinDestroyed = true;
    }
  } catch (error) {
    stdinError = redactCodexCliSensitiveEvidenceText(normalizeCodexCliSpawnError(error));
  }

  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  return await new Promise<CodexCliProcessRunResult>((resolve) => {
    let settled = false;
    let terminationGraceTimeout: NodeJS.Timeout | undefined;
    const settle = (output: CodexCliCommandOutput, error?: string) => {
      if (settled) {
        return;
      }

      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      if (terminationGraceTimeout) {
        clearTimeout(terminationGraceTimeout);
      }

      resolve(createResult(output, error));
    };
    const forceSettleAfterTimeout = () => {
      if (settled) {
        return;
      }

      forcedSettled = true;
      escalated = true;
      escalationSignal = "SIGKILL";
      escalationKilled = child.kill(escalationSignal);
      const cleanup = releaseCodexCliChildHandles(child);
      stdioDestroyed = cleanup.stdioDestroyed;
      unrefCalled = cleanup.unrefCalled;
      settle({
        exitCode: 1,
        stdout,
        stderr: [
          stderr,
          "codex_cli_process_forced_settle_after_timeout"
        ].filter(Boolean).join("\n")
      });
    };

    const timeout = resolvedOptions.timeoutMs && resolvedOptions.timeoutMs > 0
      ? setTimeout(() => {
        timedOut = true;
        killRequested = true;
        killSignal = "SIGTERM";
        killed = child.kill(killSignal);

        if (terminationGraceMs <= 0) {
          forceSettleAfterTimeout();
          return;
        }

        terminationGraceTimeout = setTimeout(() => {
          forceSettleAfterTimeout();
        }, terminationGraceMs);
      }, resolvedOptions.timeoutMs)
      : undefined;

    child.on("error", (error) => {
      settle({
        exitCode: 1,
        stdout,
        stderr
      }, error.message);
    });

    child.on("close", (code, signal) => {
      closeReceived = true;
      closeCode = code;
      closeSignal = signal;
      settle({
        exitCode: code ?? 1,
        stdout,
        stderr: [
          stderr,
          ...(signal ? [`codex_cli_process_signal:${signal}`] : [])
        ].filter(Boolean).join("\n")
      });
    });
  });
}

export function createCodexCliReadOnlySmokeTask(
  options: CodexCliReadOnlySmokeTaskOptions = {}
): TaskEnvelopeInput {
  const repoRoot = options.repoRoot ?? "A:/codex-router";
  const files = options.files ?? ["README.md"];
  const modules = options.modules ?? ["codex-cli-host"];
  const tags = options.tags ?? ["codex-cli-host-smoke", "read-only"];

  return {
    taskId: options.taskId ?? "codex-cli-readonly-smoke",
    source: "cli",
    intent: {
      summary: "inspect Codex CLI host readiness",
      requestedAction: "inspect the current workspace and report readiness without editing files",
      successCriteria: [
        "codex exec emits JSONL output",
        "runner captures stdout, stderr, and exit code",
        "no file edits or external writes are requested"
      ],
      outOfScope: [
        "file edits",
        "workspace-write sandbox",
        "external writes",
        "release actions"
      ]
    },
    repoContext: {
      repoRoot,
      ...(options.branch !== undefined ? { branch: options.branch } : {}),
      worktreeClean: true
    },
    target: {
      branches: [],
      files,
      modules
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags
    }
  };
}

export function createCodexCliWorkspaceWriteSmokeTask(
  options: CodexCliWorkspaceWriteSmokeTaskOptions = {}
): TaskEnvelopeInput {
  const repoRoot = options.repoRoot ?? "A:/codex-router";
  const file = options.file ?? DEFAULT_CODEX_CLI_WORKSPACE_WRITE_SMOKE_TARGET_FILE;
  const modules = options.modules ?? ["codex-cli-host"];
  const tags = options.tags ?? ["codex-cli-host-smoke", "workspace-write"];

  return {
    taskId: options.taskId ?? "codex-cli-workspace-write-smoke",
    source: "cli",
    intent: {
      summary: "verify guarded Codex CLI workspace-write execution",
      requestedAction: [
        "create or update only the targeted local workspace-write smoke file",
        "record that the workspace-write sandbox can perform a bounded local edit"
      ].join("; "),
      successCriteria: [
        "codex exec emits JSONL output",
        "runner captures stdout, stderr, and exit code",
        "only the targeted local smoke file is edited",
        "no external writes, release actions, or secret changes are requested"
      ],
      outOfScope: [
        "external writes",
        "release actions",
        "secret or env file changes",
        "branch movement",
        "files outside the targeted smoke file"
      ]
    },
    repoContext: {
      repoRoot,
      ...(options.branch !== undefined ? { branch: options.branch } : {}),
      worktreeClean: options.worktreeClean ?? false
    },
    target: {
      branches: [],
      files: [file],
      modules
    },
    constraints: {
      explicitOwnership: true
    },
    hints: {
      taskClassHint: "small_edit",
      riskHints: ["workspace-write"],
      tags
    }
  };
}

function createCodexCliModelProbeTask(
  options: {
    model: string;
    repoRoot: string;
  }
): TaskEnvelopeInput {
  return {
    taskId: `codex-cli-model-probe-${toSafeCodexCliEvidencePart(options.model, "model")}`,
    source: "cli",
    intent: {
      summary: "probe Codex CLI model availability",
      requestedAction: [
        `The host runner is probing model ${options.model}.`,
        `Reply exactly ${CODEX_CLI_MODEL_PROBE_OK}.`,
        "Do not inspect, create, update, delete, or run shell commands."
      ].join(" "),
      successCriteria: [
        `final agent message is exactly ${CODEX_CLI_MODEL_PROBE_OK}`,
        "no shell commands, tool calls, file edits, or external writes are attempted"
      ],
      outOfScope: [
        "file edits",
        "workspace-write sandbox",
        "external writes",
        "release actions",
        "shell commands",
        "nested Codex CLI execution"
      ]
    },
    repoContext: {
      repoRoot: options.repoRoot,
      worktreeClean: true
    },
    target: {
      branches: [],
      files: [],
      modules: ["codex-cli-host"]
    },
    constraints: {},
    hints: {
      taskClassHint: "read_only",
      riskHints: [],
      tags: ["codex-cli-model-probe", options.model]
    }
  };
}

export function createCodexCliWorkspaceWriteSmokePreflight(
  options: CodexCliWorkspaceWriteSmokePreflightOptions = {}
): CodexCliWorkspaceWriteSmokePreflight {
  const task = parseTaskEnvelope(
    options.task ?? createCodexCliWorkspaceWriteSmokeTask(options.taskOptions)
  );
  const smokeCwd = options.planOptions?.cwd ?? task.repoContext.repoRoot;
  const beforeCommit = normalizeCodexCliOptionalText(options.beforeCommit);
  const targetAllowlist = normalizeCodexCliTargetAllowlist(options.targetAllowlist);
  const planOptions: CodexCliExecPlanOptions = {
    ...(options.planOptions ?? {}),
    ...(options.planOptions?.codexCommand !== undefined
      ? {}
      : { codexCommand: resolveCodexCliRuntimeCommand() }),
    skipGitRepoCheck: options.planOptions?.skipGitRepoCheck ?? false,
    ephemeral: options.planOptions?.ephemeral ?? true,
    sandbox: "workspace-write"
  };

  if (smokeCwd !== undefined) {
    planOptions.cwd = smokeCwd;
  }

  const plan = createCodexCliExecPlan(task, planOptions);
  const repoRootKnown = normalizeCodexCliOptionalText(task.repoContext.repoRoot)
    !== undefined
    || normalizeCodexCliOptionalText(plan.workdir) !== undefined;
  const worktreeClean = task.repoContext.worktreeClean === true;
  const targetFilesAllowed = task.target.files.length > 0
    && task.target.files.every((file) => targetAllowlist.includes(file));
  const rollbackCommand = beforeCommit !== undefined && targetFilesAllowed
    ? createCodexCliGitRestoreRollbackCommand(beforeCommit, task.target.files)
    : undefined;
  const guards: CodexCliWorkspaceWriteSmokePreflightGuards = {
    repoRootKnown,
    worktreeClean,
    beforeCommitRecorded: beforeCommit !== undefined,
    rollbackCommandRecorded: rollbackCommand !== undefined,
    targetFilesAllowed,
    targetAllowlist
  };
  const blockingReasons = uniqueStrings([
    ...validateCodexCliExecPlanForRun(
      plan,
      {
        ...(options.allowWriteSandbox === undefined
          ? {}
          : { allowWriteSandbox: options.allowWriteSandbox }),
        workspaceWritePreflight: {
          ...(beforeCommit !== undefined ? { beforeCommit } : {}),
          ...(rollbackCommand !== undefined ? { rollbackCommand } : {}),
          targetAllowlist
        }
      }
    ),
    ...(repoRootKnown
      ? []
      : ["codex_cli_workspace_write_smoke_requires_repo_root"]),
    ...(worktreeClean
      ? []
      : ["codex_cli_workspace_write_smoke_requires_clean_worktree"]),
    ...(beforeCommit !== undefined
      ? []
      : ["codex_cli_workspace_write_smoke_requires_before_commit"]),
    ...(rollbackCommand !== undefined
      ? []
      : ["codex_cli_workspace_write_smoke_requires_rollback_command"]),
    ...(targetFilesAllowed
      ? []
      : ["codex_cli_workspace_write_smoke_target_not_allowlisted"]),
    ...(options.confirmation === CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION
      ? []
      : ["codex_cli_workspace_write_smoke_requires_confirmation"])
  ]);

  return {
    status: blockingReasons.length === 0 ? "ready" : "blocked",
    task,
    plan,
    blockingReasons,
    requiredConfirmation: CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION,
    guards,
    ...(beforeCommit !== undefined ? { beforeCommit } : {}),
    ...(rollbackCommand !== undefined ? { rollbackCommand } : {})
  };
}

export function createCodexCliWorkspaceWriteSmokePreflightEvidence(
  preflight: CodexCliWorkspaceWriteSmokePreflight,
  options: CodexCliWorkspaceWriteSmokePreflightEvidenceOptions = {}
): CodexCliWorkspaceWriteSmokePreflightEvidence {
  const repoRoot = options.repoRoot ?? preflight.task.repoContext.repoRoot;

  return {
    schemaVersion: "codex-cli-workspace-write-smoke-preflight.v1",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    host: options.host ?? "Codex CLI",
    ...(repoRoot !== undefined ? { repoRoot } : {}),
    status: preflight.status,
    taskId: preflight.task.taskId,
    requiredConfirmation: preflight.requiredConfirmation,
    plan: {
      command: preflight.plan.command,
      sandbox: preflight.plan.sandbox,
      approvalPolicy: preflight.plan.approvalPolicy,
      ...(preflight.plan.workdir !== undefined ? { workdir: preflight.plan.workdir } : {}),
      targetFiles: [...preflight.task.target.files],
      targetAllowlist: [...preflight.guards.targetAllowlist],
      modules: [...preflight.task.target.modules],
      usesJson: preflight.plan.args.includes("--json"),
      skipGitRepoCheck: preflight.plan.args.includes("--skip-git-repo-check"),
      ephemeral: preflight.plan.args.includes("--ephemeral"),
      warnings: [...preflight.plan.warnings]
    },
    summary: {
      readyToRun: preflight.status === "ready",
      blockingReasons: [...preflight.blockingReasons],
      warnings: [...preflight.plan.warnings]
    },
    guards: {
      ...preflight.guards,
      targetAllowlist: [...preflight.guards.targetAllowlist]
    },
    notes: [...(options.notes ?? [])]
  };
}

export async function writeCodexCliWorkspaceWriteSmokePreflightEvidenceFile(
  evidence: CodexCliWorkspaceWriteSmokePreflightEvidence,
  path: string
): Promise<CodexCliWorkspaceWriteSmokePreflightEvidenceWriteResult> {
  const content = `${JSON.stringify(evidence, null, 2)}\n`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");

  return {
    path,
    bytes: Buffer.byteLength(content, "utf8")
  };
}

export function createCodexCliWorkspaceWriteSmokeApprovalPacket(
  preflight: CodexCliWorkspaceWriteSmokePreflight,
  options: CodexCliWorkspaceWriteSmokeApprovalPacketOptions = {}
): CodexCliWorkspaceWriteSmokeApprovalPacket {
  const workspace = preflight.plan.workdir ?? preflight.task.repoContext.repoRoot ?? "";
  const targetFiles = [...preflight.task.target.files];

  return {
    schemaVersion: "codex-cli-workspace-write-smoke-approval-packet.v1",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    host: options.host ?? "Codex CLI",
    status: preflight.status,
    risk: "medium",
    taskId: preflight.task.taskId,
    workspace,
    repoState: options.repoState ?? {
      isGitRepository: false,
      worktree: "not_checked"
    },
    proposedAction: {
      sandbox: preflight.plan.sandbox,
      approvalPolicy: preflight.plan.approvalPolicy,
      commandPreview: createCodexCliSanitizedCommandPreview(preflight.plan),
      targetFiles,
      modules: [...preflight.task.target.modules]
    },
    requiredGates: {
      allowWriteSandbox: true,
      confirmation: CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION
    },
    blockers: [...preflight.blockingReasons],
    rollback: {
      strategy: [
        "Remove or restore the targeted smoke evidence file only.",
        "No branch movement, release action, external write, or secret change is part of this smoke."
      ].join(" "),
      affectedFiles: targetFiles,
      ...(preflight.beforeCommit !== undefined
        ? { beforeCommit: preflight.beforeCommit }
        : {}),
      ...(preflight.rollbackCommand !== undefined
        ? { command: preflight.rollbackCommand }
        : {})
    },
    safetyNotes: [
      "Approval packet does not execute Codex CLI.",
      "Raw task prompt and full argv are omitted from this artifact.",
      "Live workspace-write execution still requires explicit operator approval."
    ],
    notes: [...(options.notes ?? [])]
  };
}

export async function writeCodexCliWorkspaceWriteSmokeApprovalPacketFile(
  packet: CodexCliWorkspaceWriteSmokeApprovalPacket,
  path: string
): Promise<CodexCliWorkspaceWriteSmokeApprovalPacketWriteResult> {
  const content = `${JSON.stringify(packet, null, 2)}\n`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");

  return {
    path,
    bytes: Buffer.byteLength(content, "utf8")
  };
}

export async function runCodexCliReadOnlySmoke(
  options: CodexCliReadOnlySmokeRunOptions = {}
): Promise<CodexCliReadOnlySmokeResult> {
  const task = parseTaskEnvelope(
    options.task ?? createCodexCliReadOnlySmokeTask(options.taskOptions)
  );
  const smokeCwd = options.planOptions?.cwd ?? task.repoContext.repoRoot;
  const planOptions: CodexCliExecPlanOptions = {
    ...(options.planOptions ?? {}),
    ...(options.planOptions?.codexCommand !== undefined
      ? {}
      : { codexCommand: resolveCodexCliRuntimeCommand() }),
    skipGitRepoCheck: options.planOptions?.skipGitRepoCheck ?? true,
    ephemeral: options.planOptions?.ephemeral ?? true,
    sandbox: "read-only",
    approvalPolicy: "never"
  };
  if (smokeCwd !== undefined) {
    planOptions.cwd = smokeCwd;
  }
  const plan = createCodexCliReadOnlySmokeExecPlan(task, planOptions);
  const validationBlockers = validateCodexCliExecPlanForRun(plan, {
    allowSkipGitRepoCheck: options.allowSkipGitRepoCheck ?? true
  });

  if (validationBlockers.length > 0) {
    const governance = options.governance?.enabled === false
      ? undefined
      : createCodexCliGovernanceBundle({
        task,
        plan,
        stage: "read-only-smoke-preflight",
        status: "blocked",
        blockingReasons: validationBlockers,
        ...(options.governance?.evidenceRef ? { evidenceRef: options.governance.evidenceRef } : {}),
        ...(options.governance?.previousState ? { previousState: options.governance.previousState } : {}),
        ...(options.governance?.now ? { now: options.governance.now } : {})
      });

    return {
      status: "failed",
      task,
      plan,
      validationBlockers,
      ...(governance ? { governance } : {})
    };
  }

  try {
    const timeoutMs = options.timeoutMs
      ?? DEFAULT_CODEX_CLI_READ_ONLY_SMOKE_TIMEOUT_MS;
    const run = await runCodexCliExecPlan(plan, {
      timeoutMs,
      ...(options.modelProbeTimeoutMs !== undefined
        ? { modelProbeTimeoutMs: options.modelProbeTimeoutMs }
        : {}),
      ...(options.terminationGraceMs !== undefined
        ? { terminationGraceMs: options.terminationGraceMs }
        : {}),
      allowSkipGitRepoCheck: options.allowSkipGitRepoCheck ?? true,
      ...(options.env !== undefined ? { env: options.env } : {}),
      ...(options.oneShotEnv !== undefined ? { oneShotEnv: options.oneShotEnv } : {}),
      ...(options.spawn !== undefined ? { spawn: options.spawn } : {}),
      ...(options.telemetryStore !== undefined
        ? { telemetryStore: options.telemetryStore }
        : {}),
      ...(options.governance !== undefined ? { governance: options.governance } : {})
    });

    const smokeInspection = inspectCodexCliReadOnlySmokeRun(run);
    const runWithSmokeInspection: CodexCliProcessRunResult = {
      ...run,
      inspection: {
        ...run.inspection,
        status: smokeInspection.blockingReasons.length === 0 ? "completed" : "failed",
        blockingReasons: smokeInspection.blockingReasons
      }
    };
    const previousGovernanceState = run.governance?.state
      ?? options.governance?.previousState;
    const semanticGovernance = smokeInspection.blockingReasons.length === 0
      ? run.governance
      : options.governance?.enabled === false
        ? undefined
        : createCodexCliGovernanceBundle({
          task,
          plan,
          stage: "read-only-smoke-semantic-validation",
          status: "failed",
          eventCount: run.inspection.events.length,
          parseErrorCount: run.inspection.parseErrors.length,
          blockingReasons: smokeInspection.blockingReasons,
          warnings: run.inspection.warnings,
          ...(run.error ? { error: run.error } : {}),
          timedOut: run.timedOut,
          killed: run.killed,
          ...(options.governance?.evidenceRef
            ? { evidenceRef: options.governance.evidenceRef }
            : {}),
          ...(previousGovernanceState
            ? { previousState: previousGovernanceState }
            : {}),
          ...(options.governance?.now ? { now: options.governance.now } : {})
        });

    return {
      status: smokeInspection.blockingReasons.length === 0 ? "passed" : "failed",
      task,
      plan,
      validationBlockers,
      run: runWithSmokeInspection,
      ...(semanticGovernance ? { governance: semanticGovernance } : {})
    };
  } catch (error) {
    const safeError = normalizeCodexCliSafeError(error);
    const governance = options.governance?.enabled === false
      ? undefined
      : createCodexCliGovernanceBundle({
        task,
        plan,
        stage: "read-only-smoke-error",
        status: "failed",
        blockingReasons: [safeError],
        error: safeError,
        ...(options.governance?.evidenceRef ? { evidenceRef: options.governance.evidenceRef } : {}),
        ...(options.governance?.previousState ? { previousState: options.governance.previousState } : {}),
        ...(options.governance?.now ? { now: options.governance.now } : {})
      });

    return {
      status: "failed",
      task,
      plan,
      validationBlockers,
      ...(governance ? { governance } : {}),
      error: safeError
    };
  }
}

export async function runCodexCliWorkspaceWriteSmoke(
  options: CodexCliWorkspaceWriteSmokeRunOptions = {}
): Promise<CodexCliWorkspaceWriteSmokeResult> {
  const preflight = createCodexCliWorkspaceWriteSmokePreflight(options);

  if (preflight.status === "blocked") {
    const governance = options.governance?.enabled === false
      ? undefined
      : createCodexCliGovernanceBundle({
        task: preflight.task,
        plan: preflight.plan,
        stage: "workspace-write-smoke-preflight",
        status: "blocked",
        blockingReasons: preflight.blockingReasons,
        ...(options.governance?.evidenceRef ? { evidenceRef: options.governance.evidenceRef } : {}),
        ...(options.governance?.previousState ? { previousState: options.governance.previousState } : {}),
        ...(options.governance?.now ? { now: options.governance.now } : {})
      });

    return {
      status: "blocked",
      preflight,
      task: preflight.task,
      plan: preflight.plan,
      validationBlockers: preflight.blockingReasons,
      ...(governance ? { governance } : {})
    };
  }

  try {
    const timeoutMs = options.timeoutMs
      ?? DEFAULT_CODEX_CLI_WORKSPACE_WRITE_SMOKE_TIMEOUT_MS;
    const run = await runCodexCliExecPlan(preflight.plan, {
      allowWriteSandbox: true,
      workspaceWritePreflight: {
        ...(preflight.beforeCommit !== undefined
          ? { beforeCommit: preflight.beforeCommit }
          : {}),
        ...(preflight.rollbackCommand !== undefined
          ? { rollbackCommand: preflight.rollbackCommand }
          : {}),
        targetAllowlist: [...preflight.guards.targetAllowlist]
      },
      timeoutMs,
      ...(options.modelProbeTimeoutMs !== undefined
        ? { modelProbeTimeoutMs: options.modelProbeTimeoutMs }
        : {}),
      ...(options.terminationGraceMs !== undefined
        ? { terminationGraceMs: options.terminationGraceMs }
        : {}),
      ...(options.env !== undefined ? { env: options.env } : {}),
      ...(options.oneShotEnv !== undefined ? { oneShotEnv: options.oneShotEnv } : {}),
      ...(options.spawn !== undefined ? { spawn: options.spawn } : {}),
      ...(options.telemetryStore !== undefined
        ? { telemetryStore: options.telemetryStore }
        : {}),
      ...(options.governance !== undefined ? { governance: options.governance } : {})
    });

    return {
      status: run.inspection.status === "completed" ? "passed" : "failed",
      preflight,
      task: preflight.task,
      plan: preflight.plan,
      validationBlockers: preflight.blockingReasons,
      run,
      ...(run.governance ? { governance: run.governance } : {})
    };
  } catch (error) {
    const safeError = normalizeCodexCliSafeError(error);
    const governance = options.governance?.enabled === false
      ? undefined
      : createCodexCliGovernanceBundle({
        task: preflight.task,
        plan: preflight.plan,
        stage: "workspace-write-smoke-error",
        status: "failed",
        blockingReasons: [safeError],
        error: safeError,
        ...(options.governance?.evidenceRef ? { evidenceRef: options.governance.evidenceRef } : {}),
        ...(options.governance?.previousState ? { previousState: options.governance.previousState } : {}),
        ...(options.governance?.now ? { now: options.governance.now } : {})
      });

    return {
      status: "failed",
      preflight,
      task: preflight.task,
      plan: preflight.plan,
      validationBlockers: preflight.blockingReasons,
      ...(governance ? { governance } : {}),
      error: safeError
    };
  }
}

export async function runCodexCliOperatorAcceptance(
  options: CodexCliOperatorAcceptanceRunOptions
): Promise<CodexCliOperatorAcceptanceResult> {
  const task = parseTaskEnvelope(options.task);
  const planCwd = options.planOptions?.cwd ?? task.repoContext.repoRoot;
  const planOptions: CodexCliExecPlanOptions = {
    ...(options.planOptions ?? {}),
    ...(options.planOptions?.codexCommand !== undefined
      ? {}
      : { codexCommand: resolveCodexCliRuntimeCommand() })
  };

  if (planCwd !== undefined) {
    planOptions.cwd = planCwd;
  }

  const plan = createCodexCliExecPlan(task, planOptions);
  const validationBlockers = validateCodexCliExecPlanForRun(
    plan,
    {
      ...(options.allowWriteSandbox !== undefined
        ? { allowWriteSandbox: options.allowWriteSandbox }
        : {}),
      ...(options.allowSkipGitRepoCheck !== undefined
        ? { allowSkipGitRepoCheck: options.allowSkipGitRepoCheck }
        : {}),
      ...(options.workspaceWritePreflight !== undefined
        ? { workspaceWritePreflight: options.workspaceWritePreflight }
        : {})
    }
  );
  const recordingTelemetry = createRecordingTelemetrySink();
  const telemetryStore = createFanoutTelemetrySink(
    [recordingTelemetry, options.telemetryStore],
    { failurePolicy: "best_effort" }
  );

  if (validationBlockers.length > 0) {
    const governance = options.governance?.enabled === false
      ? undefined
      : createCodexCliGovernanceBundle({
        task,
        plan,
        stage: "operator-acceptance-preflight",
        status: "blocked",
        blockingReasons: validationBlockers,
        ...(options.governance?.evidenceRef ? { evidenceRef: options.governance.evidenceRef } : {}),
        ...(options.governance?.previousState ? { previousState: options.governance.previousState } : {}),
        ...(options.governance?.now ? { now: options.governance.now } : {})
      });

    return {
      status: "failed",
      task,
      plan,
      validationBlockers,
      telemetryEvents: await recordingTelemetry.loadAll(),
      ...(governance ? { governance } : {})
    };
  }

  try {
    const run = await runCodexCliExecPlan(plan, {
      ...(plan.sandbox === "workspace-write" ? { allowWriteSandbox: options.allowWriteSandbox } : {}),
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      ...(options.terminationGraceMs !== undefined
        ? { terminationGraceMs: options.terminationGraceMs }
        : {}),
      ...(options.modelProbeTimeoutMs !== undefined ? { modelProbeTimeoutMs: options.modelProbeTimeoutMs } : {}),
      ...(options.allowSkipGitRepoCheck !== undefined
        ? { allowSkipGitRepoCheck: options.allowSkipGitRepoCheck }
        : {}),
      ...(options.workspaceWritePreflight !== undefined
        ? { workspaceWritePreflight: options.workspaceWritePreflight }
        : {}),
      ...(options.env !== undefined ? { env: options.env } : {}),
      ...(options.oneShotEnv !== undefined ? { oneShotEnv: options.oneShotEnv } : {}),
      ...(options.spawn !== undefined ? { spawn: options.spawn } : {}),
      telemetryStore,
      ...(options.governance !== undefined ? { governance: options.governance } : {})
    });

    return {
      status: run.inspection.status === "completed" ? "passed" : "failed",
      task,
      plan,
      validationBlockers,
      telemetryEvents: await recordingTelemetry.loadAll(),
      run,
      ...(run.governance ? { governance: run.governance } : {})
    };
  } catch (error) {
    const safeError = normalizeCodexCliSafeError(error);
    const governance = options.governance?.enabled === false
      ? undefined
      : createCodexCliGovernanceBundle({
        task,
        plan,
        stage: "operator-acceptance-error",
        status: "failed",
        blockingReasons: [safeError],
        error: safeError,
        ...(options.governance?.evidenceRef ? { evidenceRef: options.governance.evidenceRef } : {}),
        ...(options.governance?.previousState ? { previousState: options.governance.previousState } : {}),
        ...(options.governance?.now ? { now: options.governance.now } : {})
      });

    return {
      status: "failed",
      task,
      plan,
      validationBlockers,
      telemetryEvents: await recordingTelemetry.loadAll(),
      ...(governance ? { governance } : {}),
      error: safeError
    };
  }
}

export function createCodexCliOperatorAcceptanceEvidence(
  result: CodexCliOperatorAcceptanceResult,
  options: CodexCliOperatorAcceptanceEvidenceOptions = {}
): CodexCliOperatorAcceptanceEvidence {
  const inspection = result.run?.inspection;
  const error = result.error ?? result.run?.error;
  const safeError = error !== undefined
    ? redactCodexCliSensitiveEvidenceText(error)
    : undefined;
  const repoRoot = options.repoRoot ?? result.task.repoContext.repoRoot;
  const blockingReasons = uniqueStrings([
    ...result.validationBlockers,
    ...(inspection?.blockingReasons ?? []),
    ...(safeError !== undefined ? [`codex_cli_process_error:${safeError}`] : [])
  ]);

  return {
    schemaVersion: "codex-cli-operator-acceptance-evidence.v1",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    host: options.host ?? "Codex CLI operator acceptance",
    ...(repoRoot !== undefined ? { repoRoot } : {}),
    status: result.status,
    taskId: result.task.taskId,
    task: {
      source: result.task.source,
      summary: result.task.intent.summary,
      requestedAction: result.task.intent.requestedAction,
      targetFiles: [...result.task.target.files],
      modules: [...result.task.target.modules]
    },
    plan: {
      command: result.plan.command,
      sandbox: result.plan.sandbox,
      approvalPolicy: result.plan.approvalPolicy,
      ...(result.plan.model !== undefined ? { model: result.plan.model } : {}),
      ...(result.plan.workdir !== undefined ? { workdir: result.plan.workdir } : {}),
      usesJson: result.plan.args.includes("--json"),
      skipGitRepoCheck: result.plan.args.includes("--skip-git-repo-check"),
      ephemeral: result.plan.args.includes("--ephemeral"),
      warnings: [...result.plan.warnings]
    },
    run: {
      ...(result.run?.output.exitCode !== undefined ? { exitCode: result.run.output.exitCode } : {}),
      ...(inspection?.status !== undefined ? { executionStatus: inspection.status } : {}),
      eventCount: inspection?.events.length ?? 0,
      parseErrorCount: inspection?.parseErrors.length ?? 0,
      warnings: inspection?.warnings ?? [],
      blockingReasons,
      ...(result.run?.timedOut !== undefined ? { timedOut: result.run.timedOut } : {}),
      ...(result.run?.killed !== undefined ? { killed: result.run.killed } : {}),
      ...createCodexCliProcessLifecycleEvidence(result.run),
      ...(error !== undefined ? { error } : {})
    },
    telemetry: result.telemetryEvents.map((event) => ({
      level: event.level,
      message: event.message,
      ...(event.context ? { context: event.context } : {})
    })),
    summary: {
      passed: result.status === "passed",
      validationBlockers: [...result.validationBlockers],
      blockingReasons,
      telemetryMessages: result.telemetryEvents.map((event) => event.message),
      ...(error !== undefined ? { error } : {})
    },
    ...(result.governance
      ? { governance: createCodexCliGovernanceEvidenceSummary(result.governance) }
      : {}),
    notes: [...(options.notes ?? [])]
  };
}

export async function writeCodexCliOperatorAcceptanceEvidenceFile(
  evidence: CodexCliOperatorAcceptanceEvidence,
  path: string
): Promise<CodexCliOperatorAcceptanceEvidenceWriteResult> {
  const content = `${JSON.stringify(evidence, null, 2)}\n`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");

  return {
    path,
    bytes: Buffer.byteLength(content, "utf8")
  };
}

export async function runAndWriteCodexCliOperatorAcceptanceEvidence(
  options: CodexCliOperatorAcceptancePersistOptions
): Promise<CodexCliOperatorAcceptancePersistResult> {
  const result = await runCodexCliOperatorAcceptance(options);
  const evidence = createCodexCliOperatorAcceptanceEvidence(
    result,
    options.evidenceOptions ?? {}
  );
  const write = await writeCodexCliOperatorAcceptanceEvidenceFile(
    evidence,
    options.evidencePath
  );

  return {
    result,
    evidence,
    write
  };
}

export function createCodexCliGovernanceEvidenceSummary(
  governance: CodexCliGovernanceBundle
): CodexCliGovernanceEvidenceSummary {
  return {
    schemaVersion: "codex-cli-governance-evidence-summary.v1",
    action: governance.strategy.action,
    riskLevel: governance.strategy.riskLevel,
    anomalyCount: governance.state.anomalies.count,
    observationStatus: governance.observation.status,
    observationSignals: Object.entries(governance.observation.signals)
      .filter(([, value]) => value === true)
      .map(([key]) => key)
      .sort(),
    ledgerId: governance.ledgerEntry.ledgerId,
    ...(governance.arbitrationPacket
      ? {
          arbitrationPacketId: governance.arbitrationPacket.packetId,
          probabilityPredictionAllowed: governance.arbitrationPacket.probabilityPredictionAllowed
        }
      : {})
  };
}

export function createCodexCliWorkspaceWriteSmokeEvidence(
  result: CodexCliWorkspaceWriteSmokeResult,
  options: CodexCliWorkspaceWriteSmokeEvidenceOptions = {}
): CodexCliWorkspaceWriteSmokeEvidence {
  const inspection = result.run?.inspection;
  const repoRoot = options.repoRoot ?? result.task.repoContext.repoRoot;
  const error = result.error ?? result.run?.error;
  const safeError = error !== undefined
    ? redactCodexCliSensitiveEvidenceText(error)
    : undefined;
  const blockingReasons = uniqueStrings([
    ...result.validationBlockers,
    ...(result.preflight.blockingReasons ?? []),
    ...(inspection?.blockingReasons ?? []),
    ...(safeError !== undefined ? [`codex_cli_process_error:${safeError}`] : [])
  ]);
  const warnings = uniqueStrings([
    ...result.plan.warnings,
    ...(inspection?.warnings ?? [])
  ]);

  return {
    schemaVersion: "codex-cli-workspace-write-smoke-evidence.v1",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    host: options.host ?? "Codex CLI",
    ...(repoRoot !== undefined ? { repoRoot } : {}),
    status: result.status,
    taskId: result.task.taskId,
    requiredConfirmation: CODEX_CLI_WORKSPACE_WRITE_SMOKE_CONFIRMATION,
    preflight: {
      status: result.preflight.status,
      blockingReasons: [...result.preflight.blockingReasons],
      guards: {
        ...result.preflight.guards,
        targetAllowlist: [...result.preflight.guards.targetAllowlist]
      }
    },
    approvalPacket: {
      status: result.preflight.status,
      risk: "medium",
      blockers: [...result.preflight.blockingReasons],
      targetFiles: [...result.task.target.files],
      commandPreview: createCodexCliSanitizedCommandPreview(result.plan)
    },
    plan: {
      command: result.plan.command,
      sandbox: result.plan.sandbox,
      approvalPolicy: result.plan.approvalPolicy,
      ...(result.plan.workdir !== undefined ? { workdir: result.plan.workdir } : {}),
      usesJson: result.plan.args.includes("--json"),
      skipGitRepoCheck: result.plan.args.includes("--skip-git-repo-check"),
      ephemeral: result.plan.args.includes("--ephemeral"),
      warnings: [...result.plan.warnings]
    },
    run: {
      ...(result.run !== undefined ? { exitCode: result.run.output.exitCode } : {}),
      ...(inspection !== undefined ? { executionStatus: inspection.status } : {}),
      eventCount: inspection?.events.length ?? 0,
      parseErrorCount: inspection?.parseErrors.length ?? 0,
      warnings: [...(inspection?.warnings ?? [])],
      blockingReasons,
      ...(result.run !== undefined ? { timedOut: result.run.timedOut } : {}),
      ...(result.run !== undefined ? { killed: result.run.killed } : {}),
      ...createCodexCliProcessLifecycleEvidence(result.run),
      ...(error !== undefined ? { error } : {})
    },
    summary: {
      passed: result.status === "passed",
      blockingReasons,
      warnings,
      ...(error !== undefined ? { error } : {})
    },
    ...(result.governance
      ? { governance: createCodexCliGovernanceEvidenceSummary(result.governance) }
      : {}),
    notes: [...(options.notes ?? [])]
  };
}

export async function writeCodexCliWorkspaceWriteSmokeEvidenceFile(
  evidence: CodexCliWorkspaceWriteSmokeEvidence,
  path: string
): Promise<CodexCliWorkspaceWriteSmokeEvidenceWriteResult> {
  const content = `${JSON.stringify(evidence, null, 2)}\n`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");

  return {
    path,
    bytes: Buffer.byteLength(content, "utf8")
  };
}

export async function runAndWriteCodexCliWorkspaceWriteSmokeEvidence(
  options: CodexCliWorkspaceWriteSmokePersistOptions
): Promise<CodexCliWorkspaceWriteSmokePersistResult> {
  const result = await runCodexCliWorkspaceWriteSmoke({
    ...(options.task !== undefined ? { task: options.task } : {}),
    ...(options.taskOptions !== undefined ? { taskOptions: options.taskOptions } : {}),
    ...(options.planOptions !== undefined ? { planOptions: options.planOptions } : {}),
    ...(options.allowWriteSandbox !== undefined ? { allowWriteSandbox: options.allowWriteSandbox } : {}),
    ...(options.confirmation !== undefined ? { confirmation: options.confirmation } : {}),
    ...(options.beforeCommit !== undefined ? { beforeCommit: options.beforeCommit } : {}),
    ...(options.targetAllowlist !== undefined ? { targetAllowlist: options.targetAllowlist } : {}),
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    ...(options.modelProbeTimeoutMs !== undefined
      ? { modelProbeTimeoutMs: options.modelProbeTimeoutMs }
      : {}),
    ...(options.terminationGraceMs !== undefined
      ? { terminationGraceMs: options.terminationGraceMs }
      : {}),
    ...(options.env !== undefined ? { env: options.env } : {}),
    ...(options.oneShotEnv !== undefined ? { oneShotEnv: options.oneShotEnv } : {}),
    ...(options.spawn !== undefined ? { spawn: options.spawn } : {}),
    ...(options.telemetryStore !== undefined
      ? { telemetryStore: options.telemetryStore }
      : {}),
    ...(options.governance !== undefined ? { governance: options.governance } : {})
  });
  const evidence = createCodexCliWorkspaceWriteSmokeEvidence(
    result,
    options.evidenceOptions ?? {}
  );
  const write = await writeCodexCliWorkspaceWriteSmokeEvidenceFile(
    evidence,
    options.evidencePath
  );

  return {
    result,
    evidence,
    write
  };
}

export function createCodexCliReadOnlySmokeEvidence(
  result: CodexCliReadOnlySmokeResult,
  options: CodexCliReadOnlySmokeEvidenceOptions = {}
): CodexCliReadOnlySmokeEvidence {
  const inspection = result.run?.inspection;
  const repoRoot = options.repoRoot ?? result.task.repoContext.repoRoot;
  const error = result.error ?? result.run?.error;
  const safeError = error !== undefined
    ? redactCodexCliSensitiveEvidenceText(error)
    : undefined;
  const blockingReasons = uniqueStrings([
    ...result.validationBlockers,
    ...(inspection?.blockingReasons ?? []),
    ...(safeError !== undefined ? [`codex_cli_process_error:${safeError}`] : [])
  ]);
  const warnings = uniqueStrings([
    ...result.plan.warnings,
    ...(inspection?.warnings ?? [])
  ]);

  return {
    schemaVersion: "codex-cli-readonly-smoke-evidence.v1",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    host: options.host ?? "Codex CLI",
    ...(repoRoot !== undefined ? { repoRoot } : {}),
    status: result.status,
    taskId: result.task.taskId,
    plan: {
      command: result.plan.command,
      sandbox: result.plan.sandbox,
      approvalPolicy: result.plan.approvalPolicy,
      ...(result.plan.workdir !== undefined ? { workdir: result.plan.workdir } : {}),
      usesJson: result.plan.args.includes("--json"),
      skipGitRepoCheck: result.plan.args.includes("--skip-git-repo-check"),
      ephemeral: result.plan.args.includes("--ephemeral"),
      warnings: [...result.plan.warnings]
    },
    run: {
      ...(result.run !== undefined ? { exitCode: result.run.output.exitCode } : {}),
      ...(inspection !== undefined ? { executionStatus: inspection.status } : {}),
      eventCount: inspection?.events.length ?? 0,
      parseErrorCount: inspection?.parseErrors.length ?? 0,
      warnings: [...(inspection?.warnings ?? [])],
      blockingReasons,
      ...(result.run !== undefined ? { timedOut: result.run.timedOut } : {}),
      ...(result.run !== undefined ? { killed: result.run.killed } : {}),
      ...createCodexCliProcessLifecycleEvidence(result.run),
      ...(error !== undefined ? { error } : {})
    },
    summary: {
      passed: result.status === "passed",
      blockingReasons,
      warnings,
      ...(error !== undefined ? { error } : {})
    },
    ...(result.governance
      ? { governance: createCodexCliGovernanceEvidenceSummary(result.governance) }
      : {}),
    notes: [...(options.notes ?? [])]
  };
}

export async function writeCodexCliReadOnlySmokeEvidenceFile(
  evidence: CodexCliReadOnlySmokeEvidence,
  path: string
): Promise<CodexCliReadOnlySmokeEvidenceWriteResult> {
  const content = `${JSON.stringify(evidence, null, 2)}\n`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");

  return {
    path,
    bytes: Buffer.byteLength(content, "utf8")
  };
}

export async function runAndWriteCodexCliReadOnlySmokeEvidence(
  options: CodexCliReadOnlySmokePersistOptions
): Promise<CodexCliReadOnlySmokePersistResult> {
  const result = await runCodexCliReadOnlySmoke({
    ...(options.task !== undefined ? { task: options.task } : {}),
    ...(options.taskOptions !== undefined ? { taskOptions: options.taskOptions } : {}),
    ...(options.planOptions !== undefined ? { planOptions: options.planOptions } : {}),
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    ...(options.modelProbeTimeoutMs !== undefined
      ? { modelProbeTimeoutMs: options.modelProbeTimeoutMs }
      : {}),
    ...(options.terminationGraceMs !== undefined
      ? { terminationGraceMs: options.terminationGraceMs }
      : {}),
    ...(options.env !== undefined ? { env: options.env } : {}),
    ...(options.oneShotEnv !== undefined ? { oneShotEnv: options.oneShotEnv } : {}),
    ...(options.spawn !== undefined ? { spawn: options.spawn } : {}),
    ...(options.telemetryStore !== undefined
      ? { telemetryStore: options.telemetryStore }
      : {}),
    ...(options.governance !== undefined ? { governance: options.governance } : {})
  });
  const evidence = createCodexCliReadOnlySmokeEvidence(
    result,
    options.evidenceOptions ?? {}
  );
  const write = await writeCodexCliReadOnlySmokeEvidenceFile(
    evidence,
    options.evidencePath
  );

  return {
    result,
    evidence,
    write
  };
}

export function extractCodexCliWarnings(stderr: string): string[] {
  return stderr
    .split(/\r?\n/)
    .map(sanitizeCodexCliWarning)
    .filter((line): line is string => line !== undefined);
}

function sanitizeCodexCliWarning(line: string): string | undefined {
  const normalized = line.trim().replace(/\s+/g, " ");

  if (!normalized.startsWith("WARNING:")) {
    return undefined;
  }

  if (containsSensitiveEvidenceToken(normalized)) {
    return "WARNING: <REDACTED_SENSITIVE_EVIDENCE>";
  }

  const sanitized = normalized
    .replace(/[^A-Za-z0-9 ._+\-/@():;,[\]]/g, "")
    .slice(0, 240)
    .trim();

  return sanitized || undefined;
}

function releaseCodexCliChildHandles(child: CodexCliChildProcess): {
  stdioDestroyed: boolean;
  unrefCalled: boolean;
} {
  let stdioDestroyed = false;

  for (const stream of [child.stdin, child.stdout, child.stderr]) {
    if (stream?.destroy === undefined) {
      continue;
    }

    try {
      stream.destroy();
      stdioDestroyed = true;
    } catch {
      // Best-effort cleanup after timeout; the timeout result remains authoritative.
    }
  }

  if (child.unref === undefined) {
    return {
      stdioDestroyed,
      unrefCalled: false
    };
  }

  try {
    child.unref();
    return {
      stdioDestroyed,
      unrefCalled: true
    };
  } catch {
    return {
      stdioDestroyed,
      unrefCalled: false
    };
  }
}

function createCodexCliProcessLifecycleEvidence(
  run: CodexCliProcessRunResult | undefined
): {
  stdinClosed?: boolean;
  stdinDestroyed?: boolean;
  closeReceived?: boolean;
  forcedSettled?: boolean;
  stdioDestroyed?: boolean;
  unrefCalled?: boolean;
  terminationGraceMs?: number;
  terminationEscalated?: boolean;
} {
  if (run === undefined) {
    return {};
  }

  return {
    stdinClosed: run.lifecycle.stdin.closed,
    stdinDestroyed: run.lifecycle.stdin.destroyed,
    closeReceived: run.lifecycle.termination.closeReceived,
    forcedSettled: run.lifecycle.termination.forcedSettled,
    stdioDestroyed: run.lifecycle.termination.stdioDestroyed,
    unrefCalled: run.lifecycle.termination.unrefCalled,
    ...(run.lifecycle.termination.graceMs !== undefined
      ? { terminationGraceMs: run.lifecycle.termination.graceMs }
      : {}),
    terminationEscalated: run.lifecycle.termination.escalated
  };
}

function createCodexCliReadOnlySmokeExecPlan(
  task: TaskEnvelope,
  options: CodexCliExecPlanOptions
): CodexCliExecPlan {
  const basePlan = createCodexCliExecPlan(task, {
    ...options,
    sandbox: "read-only",
    approvalPolicy: options.approvalPolicy ?? "never",
    approvalFlagPlacement: options.approvalFlagPlacement ?? "omit",
    skipGitRepoCheck: options.skipGitRepoCheck ?? true,
    ignoreUserConfig: options.ignoreUserConfig ?? true
  });
  const prompt = createCodexCliReadOnlySmokePrompt();
  const args = [...basePlan.args];
  const promptIndex = args.lastIndexOf(basePlan.prompt);

  if (promptIndex < 0) {
    throw new Error("codex_cli_readonly_smoke_prompt_arg_missing");
  }

  args[promptIndex] = prompt;

  return {
    ...basePlan,
    args,
    prompt,
    sandbox: "read-only",
    approvalPolicy: options.approvalPolicy ?? "never",
    warnings: []
  };
}

function createCodexCliReadOnlySmokePrompt(): string {
  return [
    `Reply exactly ${CODEX_CLI_READONLY_SMOKE_OK}.`,
    "Do not run shell commands, inspect files, call tools, edit files, or perform any other action."
  ].join(" ");
}

function createCodexCliModelProbeExecPlan(
  task: TaskEnvelope,
  options: {
    codexCommand: string;
    cwd: string;
    model: string;
  }
): CodexCliExecPlan {
  const basePlan = createCodexCliExecPlan(task, {
    codexCommand: options.codexCommand,
    cwd: options.cwd,
    model: options.model,
    sandbox: "read-only",
    approvalPolicy: "never",
    approvalFlagPlacement: "omit",
    skipGitRepoCheck: false,
    ephemeral: true,
    ignoreUserConfig: true
  });
  const prompt = createCodexCliModelProbePrompt();
  const args = basePlan.args.map((arg) => (
    arg === basePlan.prompt ? prompt : arg
  ));

  return {
    ...basePlan,
    args,
    prompt,
    warnings: []
  };
}

function createCodexCliModelProbePrompt(): string {
  return [
    `Reply exactly ${CODEX_CLI_MODEL_PROBE_OK}.`,
    "Do not run shell commands, inspect files, call tools, or perform any other action."
  ].join(" ");
}

function inspectCodexCliReadOnlySmokeRun(run: CodexCliProcessRunResult): {
  blockingReasons: string[];
} {
  const blockingReasons = run.inspection.status === "completed"
    ? []
    : [...run.inspection.blockingReasons];
  const agentMessages = extractCodexCliAgentMessages(run.inspection.events);
  const exactResponse = agentMessages.some((message) => (
    message.trim() === CODEX_CLI_READONLY_SMOKE_OK
  ));
  const unexpectedToolUses = extractCodexCliUnexpectedProbeToolUses(
    run.inspection.events
  );

  if (!exactResponse) {
    blockingReasons.push("codex_cli_readonly_smoke_unexpected_response");
  }

  blockingReasons.push(
    ...unexpectedToolUses.map((kind) => (
      `codex_cli_readonly_smoke_unexpected_tool_use:${kind}`
    ))
  );

  return {
    blockingReasons: uniqueStrings(blockingReasons)
  };
}

function inspectCodexCliModelProbeRun(run: CodexCliProcessRunResult): {
  blockingReasons: string[];
  warnings: string[];
} {
  const blockingReasons = run.inspection.status === "completed"
    ? []
    : ["codex_cli_model_probe_failed", ...run.inspection.blockingReasons];
  const agentMessages = extractCodexCliAgentMessages(run.inspection.events);
  const exactResponse = agentMessages.some((message) => (
    message.trim() === CODEX_CLI_MODEL_PROBE_OK
  ));
  const unexpectedToolUses = extractCodexCliUnexpectedProbeToolUses(
    run.inspection.events
  );

  if (!exactResponse) {
    blockingReasons.push("codex_cli_model_probe_unexpected_response");
  }

  blockingReasons.push(
    ...unexpectedToolUses.map((kind) => (
      `codex_cli_model_probe_unexpected_tool_use:${kind}`
    ))
  );

  return {
    blockingReasons: uniqueStrings(blockingReasons),
    warnings: []
  };
}

function extractCodexCliAgentMessages(events: CodexCliJsonlEvent[]): string[] {
  const messages: string[] = [];

  for (const event of events) {
    const payload = event.event;
    if (payload.type === "agent_message") {
      const message = typeof payload.message === "string"
        ? payload.message
        : typeof payload.text === "string"
          ? payload.text
          : undefined;
      if (message !== undefined) {
        messages.push(message);
      }
      continue;
    }

    const item = isRecord(payload.item) ? payload.item : undefined;
    if (item?.type !== "agent_message") {
      continue;
    }

    const text = typeof item.text === "string"
      ? item.text
      : typeof item.message === "string"
        ? item.message
        : undefined;
    if (text !== undefined) {
      messages.push(text);
    }
  }

  return messages;
}

function extractCodexCliUnexpectedProbeToolUses(
  events: CodexCliJsonlEvent[]
): string[] {
  const kinds: string[] = [];

  for (const event of events) {
    const payload = event.event;
    const item = isRecord(payload.item) ? payload.item : undefined;
    const typeCandidates = [
      typeof payload.type === "string" ? payload.type : undefined,
      typeof item?.type === "string" ? item.type : undefined
    ].filter((value): value is string => value !== undefined);

    for (const type of typeCandidates) {
      if (isCodexCliProbeToolLikeEventType(type)) {
        kinds.push(type);
      }
    }
  }

  return uniqueStrings(kinds);
}

function isCodexCliProbeToolLikeEventType(type: string): boolean {
  const normalized = type.toLowerCase();
  return normalized === "command_execution"
    || normalized === "tool_call"
    || normalized === "mcp_tool_call"
    || normalized === "function_call"
    || normalized.endsWith("_tool_call")
    || normalized.includes("command_execution");
}

function defaultCodexCliProcessSpawner(
  command: string,
  args: string[],
  options: CodexCliSpawnOptions
): CodexCliChildProcess {
  try {
    return spawnChildProcess(command, args, {
      ...options,
      shell: false
    });
  } catch (error) {
    if (isCodexCliCommandSpawnBlockedForShellFallback(command, error)) {
      return spawnChildProcess(quoteWindowsCommandForShell(command), args, {
        ...options,
        shell: true
      });
    }

    throw error;
  }
}

function normalizeCodexCliSpawnError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function sanitizeCodexCliVersionProbe(stdout: string): string | undefined {
  const line = stdout
    .split(/\r?\n/)
    .map((entry) => entry.trim().replace(/\s+/g, " "))
    .find(Boolean);

  if (!line || containsSensitiveEvidenceToken(line)) {
    return undefined;
  }

  const sanitized = line
    .replace(/[^A-Za-z0-9 ._+\-/@()]/g, "")
    .slice(0, 120)
    .trim();

  return sanitized || undefined;
}

function containsSensitiveEvidenceToken(value: string): boolean {
  return /\b(OPENAI_API_KEY|CODEX_API_KEY|CODEX_ACCESS_TOKEN|Bearer|secret|password)\b|sk-|\bauth\.json\b/i.test(value);
}

function isCodexCliCommandSpawnBlockedForShellFallback(
  command: string,
  error: unknown
): boolean {
  if (process.platform !== "win32") {
    return false;
  }

  if (!command.toLowerCase().endsWith(".exe")) {
    return false;
  }

  const normalized = normalizeCodexCliSpawnError(error);
  return normalized.includes("spawn EPERM") || normalized.includes("EPERM");
}

function quoteWindowsCommandForShell(command: string): string {
  if (!command.includes(" ") && !command.includes("\"")) {
    return command;
  }

  return `"${command.replace(/"/g, "\\\"")}"`;
}

function resolveCodexCliRuntimeCommand(): string {
  if (process.platform !== "win32") {
    return "codex";
  }

  return resolveWindowsCodexExecutableFromGlobalNpmRoot()
    ?? resolveWindowsCodexExecutableFromPath()
    ?? "codex";
}

function resolveWindowsCodexExecutableFromGlobalNpmRoot(): string | undefined {
  const npmRoot = process.env.APPDATA
    ? join(process.env.APPDATA, "npm")
    : undefined;

  if (!npmRoot) {
    return undefined;
  }

  const candidates = createWindowsCodexExecutableCandidates(npmRoot);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function resolveWindowsCodexExecutableFromPath(): string | undefined {
  const pathEntries = (process.env.PATH ?? "")
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of pathEntries) {
    if (
      !existsSync(join(entry, "codex.ps1")) &&
      !existsSync(join(entry, "codex.cmd")) &&
      !existsSync(join(entry, "codex"))
    ) {
      continue;
    }

    const candidates = createWindowsCodexExecutableCandidates(entry);

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
}

function createWindowsCodexExecutableCandidates(npmRoot: string): string[] {
  const platformTriples: Array<[string, string]> = process.arch === "arm64"
    ? [
        ["codex-win32-arm64", "aarch64-pc-windows-msvc"],
        ["codex-win32-x64", "x86_64-pc-windows-msvc"]
      ]
    : [
        ["codex-win32-x64", "x86_64-pc-windows-msvc"],
        ["codex-win32-arm64", "aarch64-pc-windows-msvc"]
      ];

  return platformTriples.flatMap(([packageName, targetTriple]) => {
    const vendorRoot = join(
      npmRoot,
      "node_modules",
      "@openai",
      "codex",
      "node_modules",
      "@openai",
      packageName,
      "vendor",
      targetTriple
    );

    return [
      join(vendorRoot, "bin", "codex.exe"),
      join(vendorRoot, "codex", "codex.exe")
    ];
  }).concat([
    join(npmRoot, "codex.cmd"),
    join(npmRoot, "codex")
  ]);
}

const CODEX_CLI_CHILD_ENV_ALLOWLIST = new Set([
  "PATH",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "TMPDIR",
  "TEMP",
  "TMP",
  "SHELL",
  "COMSPEC",
  "CODEX_HOME",
  "CODEX_SQLITE_HOME",
  "CODEX_CA_CERTIFICATE",
  "SSL_CERT_FILE",
  "RUST_LOG",
  "SYSTEMROOT",
  "WINDIR",
  "PATHEXT"
]);

const CODEX_CLI_CHILD_ENV_SECRET_KEYS = new Set([
  "OPENAI_API_KEY",
  "CODEX_API_KEY",
  "CODEX_ACCESS_TOKEN"
]);

const CODEX_CLI_ONE_SHOT_ENV_ALLOWLIST = new Set([
  "CODEX_API_KEY"
]);

function resolveCodexCliSpawnEnv(
  command: string,
  options: {
    baseEnv?: NodeJS.ProcessEnv;
    oneShotEnv?: NodeJS.ProcessEnv;
  } = {}
): NodeJS.ProcessEnv {
  const baseEnv = options.baseEnv ?? process.env;
  const childEnv = buildCodexCliChildEnv(baseEnv);
  const helperPath = resolveWindowsCodexHelperPathForCommand(command);

  if (helperPath) {
    prependCodexCliWindowsHelperPath(childEnv, baseEnv, helperPath);
  }

  applyCodexCliOneShotEnv(childEnv, options.oneShotEnv);
  return childEnv;
}

function buildCodexCliChildEnv(baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const childEnv: NodeJS.ProcessEnv = {};

  for (const [key, value] of Object.entries(baseEnv)) {
    const normalizedKey = key.toUpperCase();
    if (
      value !== undefined
      && CODEX_CLI_CHILD_ENV_ALLOWLIST.has(normalizedKey)
      && !CODEX_CLI_CHILD_ENV_SECRET_KEYS.has(normalizedKey)
    ) {
      childEnv[key] = value;
    }
  }

  return childEnv;
}

function applyCodexCliOneShotEnv(
  childEnv: NodeJS.ProcessEnv,
  oneShotEnv: NodeJS.ProcessEnv | undefined
): void {
  if (!oneShotEnv) {
    return;
  }

  for (const [key, value] of Object.entries(oneShotEnv)) {
    const normalizedKey = key.toUpperCase();
    if (
      value !== undefined
      && CODEX_CLI_ONE_SHOT_ENV_ALLOWLIST.has(normalizedKey)
    ) {
      childEnv[key] = value;
    }
  }
}

function prependCodexCliWindowsHelperPath(
  childEnv: NodeJS.ProcessEnv,
  baseEnv: NodeJS.ProcessEnv,
  helperPath: string
): void {
  const pathKey = getWindowsPathEnvKey(childEnv)
    ?? getWindowsPathEnvKey(baseEnv)
    ?? "PATH";
  const currentPath = childEnv[pathKey] ?? baseEnv[pathKey] ?? "";
  const pathEntries = currentPath
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (pathEntries.some((entry) => entry.toLowerCase() === helperPath.toLowerCase())) {
    childEnv[pathKey] = currentPath;
    return;
  }

  childEnv[pathKey] = currentPath ? `${helperPath};${currentPath}` : helperPath;
}

function resolveWindowsCodexHelperPathForCommand(command: string): string | undefined {
  if (process.platform !== "win32") {
    return undefined;
  }

  const match = command.match(/^(.*)[/\\]bin[/\\]codex\.exe$/i);

  if (!match?.[1]) {
    return undefined;
  }

  return join(match[1], "codex-path");
}

function getWindowsPathEnvKey(env: NodeJS.ProcessEnv): string | undefined {
  return Object.keys(env).find((key) => key.toLowerCase() === "path");
}

function createCodexCliExecPlanWarnings(
  task: TaskEnvelope,
  options: CodexCliExecPlanOptions
): string[] {
  const warnings: string[] = [];

  if (!task.repoContext.repoRoot && !options.cwd) {
    warnings.push("codex_cli_workdir_not_set");
  }

  if (task.hints.taskClassHint === "release_external_action") {
    warnings.push("codex_cli_release_posture_requires_external_approval_gate");
  }

  return warnings;
}

function assertNoDangerousCodexCliArgs(args: string[]): void {
  const dangerousArg = args.find((arg) => (
    DANGEROUS_CODEX_CLI_ARGS.has(readCodexCliFlagName(arg))
    || arg.includes("danger-full-access")
  ));

  if (dangerousArg) {
    throw new Error(`codex_cli_dangerous_arg_not_allowed:${dangerousArg}`);
  }
}

function readCodexCliFlagName(arg: string): string {
  return arg.split("=", 1)[0] ?? arg;
}

const CODEX_CLI_SECURITY_ARG_GROUPS = [
  {
    name: "approval",
    flags: ["-a", "--ask-for-approval"]
  },
  {
    name: "workdir",
    flags: ["-C", "--cd", "--cwd"]
  },
  {
    name: "model",
    flags: ["-m", "--model"]
  },
  {
    name: "profile",
    flags: ["-p", "--profile"]
  },
  {
    name: "sandbox",
    flags: ["-s", "--sandbox"]
  }
] as const;

const CODEX_CLI_GOVERNED_CONFIG_KEYS = [
  "approval",
  "approval_policy",
  "ask_for_approval",
  "model",
  "model_provider",
  "profile",
  "sandbox",
  "sandbox_mode",
  "sandbox_permissions",
  "sandbox_workspace_write"
] as const;

const CODEX_CLI_EXEC_SUBCOMMANDS = [
  "help",
  "resume",
  "review"
] as const;

function assertNoCodexCliWorkspaceExpansionArgs(args: string[]): void {
  const expansionArg = args.find((arg) => (
    arg === "--add-dir" || arg.startsWith("--add-dir=")
  ));

  if (expansionArg !== undefined) {
    throw new Error(
      `codex_cli_workspace_expansion_arg_not_allowed:${expansionArg}`
    );
  }
}

function assertNoCodexCliPolicyBypassArgs(args: string[]): void {
  const bypassArg = args.find((arg) => arg === "--ignore-rules");

  if (bypassArg !== undefined) {
    throw new Error(
      `codex_cli_policy_bypass_arg_not_allowed:${bypassArg}`
    );
  }
}

function assertNoCodexCliProviderOverrideArgs(args: string[]): void {
  const ossArg = args.find((arg) => (
    arg === "--oss" || arg.startsWith("--oss=")
  ));
  const localProviderArg = findCodexCliArgMatch(args, ["--local-provider"]);
  const providerArg = ossArg ?? localProviderArg;

  if (providerArg !== undefined) {
    throw new Error(
      `codex_cli_provider_override_arg_not_allowed:${providerArg}`
    );
  }
}

function assertNoCodexCliOutputWriteArgs(args: string[]): void {
  const outputArg = findCodexCliArgMatch(args, ["-o", "--output-last-message"]);

  if (outputArg !== undefined) {
    throw new Error(
      `codex_cli_output_write_arg_not_allowed:${outputArg}`
    );
  }
}

function assertNoCodexCliOutputSchemaArgs(args: string[]): void {
  const outputSchemaArg = findCodexCliArgMatch(args, ["--output-schema"]);

  if (outputSchemaArg !== undefined) {
    throw new Error(
      `codex_cli_output_schema_arg_not_allowed:${outputSchemaArg}`
    );
  }
}

function assertNoCodexCliImageAttachmentArgs(args: string[]): void {
  const imageArg = findCodexCliArgMatch(args, ["-i", "--image", "--images"]);

  if (imageArg !== undefined) {
    throw new Error(
      `codex_cli_image_attachment_arg_not_allowed:${imageArg}`
    );
  }
}

function assertNoCodexCliExecSubcommandArgs(args: string[], prompt: string): void {
  const subcommandArg = args.find((arg) => (
    arg !== prompt &&
    CODEX_CLI_EXEC_SUBCOMMANDS.some((subcommand) => arg === subcommand)
  ));

  if (subcommandArg !== undefined) {
    throw new Error(
      `codex_cli_exec_subcommand_arg_not_allowed:${subcommandArg}`
    );
  }
}

function assertNoDuplicateCodexCliSecurityArgs(args: string[]): void {
  for (const group of CODEX_CLI_SECURITY_ARG_GROUPS) {
    const matches = args
      .map((arg) => matchCodexCliSecurityArg(arg, group.flags))
      .filter((flag): flag is string => flag !== undefined);

    if (matches.length > 1) {
      throw new Error(
        `codex_cli_duplicate_security_arg:${group.name}:${matches.join(",")}`
      );
    }
  }
}

function matchCodexCliSecurityArg(
  arg: string,
  flags: readonly string[]
): string | undefined {
  return flags.find((flag) => (
    arg === flag || (
      flag.startsWith("--") && arg.startsWith(`${flag}=`)
    ) || (
      flag.startsWith("-") &&
      !flag.startsWith("--") &&
      arg.startsWith(flag) &&
      arg.length > flag.length
    )
  ));
}

function findCodexCliArgMatch(
  args: string[],
  flags: readonly string[]
): string | undefined {
  return args.find((arg) => matchCodexCliSecurityArg(arg, flags) !== undefined);
}

function assertNoGovernedCodexCliConfigOverrides(args: string[]): void {
  for (const override of extractCodexCliConfigOverrides(args)) {
    const key = extractCodexCliConfigKey(override);

    if (key !== undefined && isGovernedCodexCliConfigKey(key)) {
      throw new Error(`codex_cli_governed_config_override_not_allowed:${key}`);
    }
  }
}

function extractCodexCliConfigOverrides(args: string[]): string[] {
  const overrides: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const parsed = getCodexCliArgValueAt(args, index, ["-c", "--config"]);
    if (parsed !== undefined) {
      overrides.push(parsed.value);
      index += parsed.consumedNext ? 1 : 0;
    }
  }

  return overrides;
}

function extractCodexCliConfigKey(override: string): string | undefined {
  const separatorIndex = override.indexOf("=");
  const key = (
    separatorIndex === -1
      ? override
      : override.slice(0, separatorIndex)
  ).trim();

  return key.length > 0 ? key : undefined;
}

function isGovernedCodexCliConfigKey(key: string): boolean {
  const normalized = key.toLowerCase();

  return CODEX_CLI_GOVERNED_CONFIG_KEYS.some((governedKey) => (
    normalized === governedKey || normalized.startsWith(`${governedKey}.`)
  ));
}

function assertNoCodexCliDecisionPolicyOverrides(
  options: CodexCliDecisionExecPlanOptions
): void {
  const rawOptions = options as CodexCliExecPlanOptions;
  const disallowedOptions: Array<keyof CodexCliExecPlanOptions> = [
    "approvalFlagPlacement",
    "approvalPolicy",
    "codexCommand",
    "configOverrides",
    "cwd",
    "extraArgs",
    "ignoreUserConfig",
    "ignoreRules",
    "profile"
  ];

  if (rawOptions.model !== undefined) {
    throw new Error("codex_cli_decision_plan_disallows_policy_override:model");
  }

  if (rawOptions.sandbox !== undefined) {
    throw new Error("codex_cli_decision_plan_disallows_policy_override:sandbox");
  }

  for (const option of disallowedOptions) {
    if (rawOptions[option] !== undefined) {
      throw new Error(
        `codex_cli_decision_plan_disallows_policy_override:${option}`
      );
    }
  }
}

function isModelAtLeastAsStrong(
  requestedModel: ModelId,
  routerModel: ModelId
): boolean {
  return getModelStrength(requestedModel) >= getModelStrength(routerModel);
}

function getModelStrength(model: ModelId): number {
  return getCodexCliModelStrengthProfile(model).capabilityRank;
}

function extractOpenAiModelIds(
  models: OpenAiModelCatalog | OpenAiModelCatalogModel[] | string[]
): string[] {
  const rawModelIds = Array.isArray(models)
    ? models.map((model) => typeof model === "string" ? model : model.id)
    : models.data.map((model) => model.id);

  return [...new Set(
    rawModelIds
      .map((modelId) => modelId.trim())
      .filter(Boolean)
  )].sort();
}

function isDefaultRelevantCodexCliModelId(modelId: string): boolean {
  const normalized = modelId.toLowerCase();
  return normalized.includes("codex") || normalized.startsWith("gpt-5");
}

function sanitizeOpenAiBaseUrlForEvidence(baseUrl?: string): string {
  const value = baseUrl ?? "https://api.openai.com/v1";

  try {
    const parsed = new URL(value);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return "<custom-openai-base-url>";
  }
}

function sanitizeCodexCliModelCatalogCheckError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message === "openai_api_key_missing") {
    return message;
  }

  if (message === "fetch_unavailable") {
    return message;
  }

  if (/^openai_model_catalog_fetch_failed:\d+$/.test(message)) {
    return message;
  }

  if (/^openai_model_catalog_response_(not_object|data_not_array)$/.test(message)) {
    return message;
  }

  if (/^openai_model_catalog_model_(not_object|id_missing):\d+$/.test(message)) {
    return message;
  }

  if (error instanceof SyntaxError) {
    return "openai_model_catalog_response_json_invalid";
  }

  return "openai_model_catalog_check_error";
}

function sanitizeCodexCliModelProbeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.startsWith("codex_cli_plan_not_runnable:")) {
    return message;
  }

  if (message.includes("ENOENT")) {
    return "codex_cli_command_not_found";
  }

  if (message.includes("EACCES") || message.includes("EPERM")) {
    return "codex_cli_command_not_executable";
  }

  return "codex_cli_model_probe_error";
}

function createCodexCliModelProbeCacheKey(input: {
  command: string;
  cwd: string;
  model: string;
}): string {
  return [
    input.command.trim(),
    input.cwd.trim(),
    input.model.trim()
  ].join("\n");
}

function readCodexCliModelProbeCache(
  key: string,
  ttlMs: number
): CodexCliModelCliProbeEvidence | undefined {
  const entry = codexCliModelProbeCache.get(key);
  if (!entry) {
    return undefined;
  }

  if (ttlMs <= 0 || entry.expiresAtMs <= Date.now()) {
    codexCliModelProbeCache.delete(key);
    return undefined;
  }

  return entry.evidence;
}

function writeCodexCliModelProbeCache(
  key: string,
  evidence: CodexCliModelCliProbeEvidence,
  ttlMs: number
): void {
  if (ttlMs <= 0 || evidence.status !== "passed") {
    return;
  }

  codexCliModelProbeCache.set(key, {
    evidence,
    expiresAtMs: Date.now() + ttlMs
  });
}

async function emitCodexCliModelProbeCacheTelemetry(input: {
  telemetryStore: TelemetrySink | undefined;
  status: "hit" | "miss";
  command: string;
  cwd: string;
  model: string;
  ttlMs: number;
}): Promise<void> {
  if (!input.telemetryStore) {
    return;
  }

  try {
    await emitTelemetryEvents(input.telemetryStore, [
      createLogEvent("info", `codex cli model probe cache ${input.status}`, {
        source: "codex-cli-host",
        command: input.command,
        cwd: input.cwd,
        model: input.model,
        ttlMs: input.ttlMs
      })
    ]);
  } catch {
    // Best-effort observability only; probe execution should not fail on telemetry.
  }
}

async function emitCodexCliModelProbeResultTelemetry(input: {
  telemetryStore: TelemetrySink | undefined;
  evidence: CodexCliModelCliProbeEvidence;
}): Promise<void> {
  if (!input.telemetryStore) {
    return;
  }

  try {
    await emitTelemetryEvents(input.telemetryStore, [
      createLogEvent("info", "codex cli model probe result", {
        source: "codex-cli-host",
        model: input.evidence.model,
        status: input.evidence.status,
        blockingReasons: input.evidence.blockingReasons,
        run: input.evidence.run === undefined
          ? undefined
          : {
              exitCode: input.evidence.run.exitCode,
              timedOut: input.evidence.run.timedOut,
              killed: input.evidence.run.killed,
              stdinClosed: input.evidence.run.stdinClosed,
              stdinDestroyed: input.evidence.run.stdinDestroyed,
              closeReceived: input.evidence.run.closeReceived,
              forcedSettled: input.evidence.run.forcedSettled,
              stdioDestroyed: input.evidence.run.stdioDestroyed,
              unrefCalled: input.evidence.run.unrefCalled,
              terminationGraceMs: input.evidence.run.terminationGraceMs,
              terminationEscalated: input.evidence.run.terminationEscalated
            }
      })
    ]);
  } catch {
    // Best-effort observability only; probe execution should not fail on telemetry.
  }
}

async function resolveCodexCliModelProbeForRun(
  plan: CodexCliExecPlan,
  options: CodexCliProcessRunOptions
): Promise<CodexCliModelCliProbeEvidence | undefined> {
  if (options.skipExecutionModelProbe === true) {
    return undefined;
  }

  if (options.modelProbe !== undefined) {
    return options.modelProbe;
  }

  if (options.autoProbeModelWithCli !== true) {
    return undefined;
  }

  const model = plan.model ?? getCodexCliArgValue(plan.args, "--model");
  if (!model) {
    return undefined;
  }

  const cwd = plan.workdir ?? process.cwd();
  const cacheTtlMs = options.modelProbeCacheTtlMs ?? DEFAULT_CODEX_CLI_MODEL_PROBE_CACHE_TTL_MS;
  const cacheKey = createCodexCliModelProbeCacheKey({
    command: plan.command,
    cwd,
    model
  });

  if (options.disableModelProbeCache !== true) {
    const cached = readCodexCliModelProbeCache(cacheKey, cacheTtlMs);
    if (cached) {
      await emitCodexCliModelProbeCacheTelemetry({
        telemetryStore: options.telemetryStore,
        status: "hit",
        command: plan.command,
        cwd,
        model,
        ttlMs: cacheTtlMs
      });
      return cached;
    }
  }

  await emitCodexCliModelProbeCacheTelemetry({
    telemetryStore: options.telemetryStore,
    status: "miss",
    command: plan.command,
    cwd,
    model,
    ttlMs: cacheTtlMs
  });

  const evidence = await createCodexCliModelCliProbeEvidence({
    model,
    codexCommand: plan.command,
    cwd,
    strict: options.modelProbeStrict ?? options.requireModelProbe ?? true,
    ...(options.modelProbeTimeoutMs !== undefined
      ? { timeoutMs: options.modelProbeTimeoutMs }
      : {}),
    ...(options.terminationGraceMs !== undefined
      ? { terminationGraceMs: options.terminationGraceMs }
      : {}),
    ...(options.env !== undefined ? { env: options.env } : {}),
    ...(options.oneShotEnv !== undefined ? { oneShotEnv: options.oneShotEnv } : {}),
    ...(options.spawn ? { spawn: options.spawn } : {})
  });
  await emitCodexCliModelProbeResultTelemetry({
    telemetryStore: options.telemetryStore,
    evidence
  });

  if (options.disableModelProbeCache !== true) {
    writeCodexCliModelProbeCache(cacheKey, evidence, cacheTtlMs);
  }

  return evidence;
}

function resolveCodexCliProcessRunOptions(
  plan: CodexCliExecPlan,
  options: CodexCliProcessRunOptions
): CodexCliProcessRunOptions {
  if (options.skipExecutionModelProbe === true) {
    return options;
  }

  const model = plan.model ?? getCodexCliArgValue(plan.args, "--model");
  if (!model) {
    return options;
  }

  return {
    ...options,
    autoProbeModelWithCli: options.autoProbeModelWithCli ?? true,
    requireModelProbe: options.requireModelProbe ?? true
  };
}

function getCodexCliModelProbeBlockingReasons(
  evidence: CodexCliModelCliProbeEvidence | undefined,
  options: Pick<
    CodexCliProcessRunOptions,
    "requireModelProbe" | "modelProbeStrict"
  >
): string[] {
  if (!evidence) {
    return [];
  }

  if (evidence.status === "passed") {
    return [];
  }

  if (options.requireModelProbe !== true && options.modelProbeStrict !== true) {
    return [];
  }

  return evidence.blockingReasons.length > 0
    ? [...evidence.blockingReasons]
    : [`codex_cli_model_probe_unavailable:${evidence.model}`];
}

function createCodexCliModelProbePlanSummary(
  plan: CodexCliExecPlan
): CodexCliModelCliProbeEvidence["cli"] {
  return {
    command: plan.command,
    sandbox: plan.sandbox,
    approvalPolicy: plan.approvalPolicy,
    usesJson: plan.args.includes("--json"),
    skipGitRepoCheck: plan.args.includes("--skip-git-repo-check"),
    ephemeral: plan.args.includes("--ephemeral"),
    ...(plan.workdir ? { workdir: plan.workdir } : {})
  };
}

function canAcceptModelDowngrade(
  decision: ReturnType<typeof parseRoutingDecision>,
  selection: CodexCliModelSelection
): boolean {
  return selection.allowDowngrade === true
    && decision.execution.toolAccess === "read_only"
    && decision.classification.riskLevel === "low"
    && !decision.approval.required;
}

function getCodexCliArgValue(args: string[], flag: string): string | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const parsed = getCodexCliArgValueAt(args, index, [flag]);
    if (parsed !== undefined) {
      return parsed.value;
    }
  }

  return undefined;
}

function getCodexCliArgValueAt(
  args: string[],
  index: number,
  flags: readonly string[]
): { value: string; consumedNext: boolean } | undefined {
  const arg = args[index];
  if (arg === undefined) {
    return undefined;
  }

  for (const flag of flags) {
    if (arg === flag) {
      const value = args[index + 1];
      return value === undefined
        ? undefined
        : { value, consumedNext: true };
    }

    if (flag.startsWith("--") && arg.startsWith(`${flag}=`)) {
      return { value: arg.slice(flag.length + 1), consumedNext: false };
    }

    if (
      flag.startsWith("-") &&
      !flag.startsWith("--") &&
      arg.startsWith(flag) &&
      arg.length > flag.length
    ) {
      const compactValue = arg.slice(flag.length);
      return {
        value: compactValue.startsWith("=")
          ? compactValue.slice(1)
          : compactValue,
        consumedNext: false
      };
    }
  }

  return undefined;
}

function createCodexCliSanitizedCommandPreview(plan: CodexCliExecPlan): string {
  const args = plan.args.map((arg) => (
    arg === plan.prompt ? "<task-envelope-prompt omitted>" : arg
  ));

  return [plan.command, ...args].map(quoteCommandPart).join(" ");
}

function quoteCommandPart(part: string): string {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(part)) {
    return part;
  }

  return `"${part.replace(/"/g, "\\\"")}"`;
}

function normalizeCodexCliOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeCodexCliTargetAllowlist(values: string[] | undefined): string[] {
  return uniqueStrings(
    (values === undefined || values.length === 0
      ? [DEFAULT_CODEX_CLI_WORKSPACE_WRITE_SMOKE_TARGET_FILE]
      : values
    )
      .map((value) => normalizeCodexCliOptionalText(value))
      .filter((value): value is string => value !== undefined)
  );
}

function normalizeCodexCliExplicitTargetAllowlist(values: string[] | undefined): string[] {
  return uniqueStrings(
    (values ?? [])
      .map((value) => normalizeCodexCliOptionalText(value))
      .filter((value): value is string => value !== undefined)
  );
}

function createCodexCliGitRestoreRollbackCommand(
  beforeCommit: string,
  affectedFiles: string[]
): string {
  return [
    "git",
    "restore",
    "--source",
    beforeCommit,
    "--",
    ...affectedFiles
  ].map(quoteCommandPart).join(" ");
}

function toSafeCodexCliEvidencePart(value: string, fallback: string): string {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return safe || fallback;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
