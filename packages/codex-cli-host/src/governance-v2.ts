import type { TaskEnvelope } from "../../contracts/src/index.js";
import {
  createInitialGovernanceState,
  recordAnomaly,
  type GovernanceState,
  type GovernanceRiskScore,
  type AnomalyRecord,
  type GovernancePhase
} from "../../governance-internal-state-manager/src/index.js";
import {
  createRecordingExecutionObservationStore,
  parseExecutionObservation,
  type ExecutionObservation,
  type ExecutionObservationBus
} from "../../governance-internal-execution-observation/src/index.js";
import {
  routeStrategyV2,
  type StrategyDecisionV2
} from "../../governance-internal-strategy-router/src/index.js";
import {
  createArbitrationPacket,
  shouldLockdown,
  type ArbitrationPacket
} from "../../governance-internal-recovery-control/src/index.js";
import {
  createRecordingCheckpointLedgerStore,
  parseCheckpointLedgerEntry,
  type CheckpointLedgerEntry
} from "../../checkpoint-ledger-v2/src/index.js";
import {
  scoreGovernanceRisk,
  type ScoreGovernanceRiskInput
} from "../../governance-internal-entropy-risk/src/index.js";

export type CodexCliGovernancePhase =
  | "planning"
  | "preflight"
  | "execution"
  | "verification"
  | "recovery"
  | "closed";

export type CodexCliGovernanceRiskLevel =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type CodexCliObservationStatus =
  | "started"
  | "succeeded"
  | "failed"
  | "blocked"
  | "degraded";

export type CodexCliStrategyAction =
  | "continue"
  | "verify"
  | "lockdown"
  | "step_back"
  | "abort";

export type CodexCliVerificationIntensity =
  | "none"
  | "light"
  | "standard"
  | "strict";

export type CodexCliArbitrationTrigger =
  | "first_anomaly"
  | "second_anomaly"
  | "third_anomaly"
  | "manual";

export interface CodexCliGovernancePlanLike {
  command: string;
  args: string[];
  prompt: string;
  sandbox: "read-only" | "workspace-write";
  approvalPolicy: "untrusted" | "on-request" | "never";
  model?: string;
  workdir?: string;
  warnings: string[];
}

export interface CodexCliGovernanceRiskScore {
  entanglement: number;
  entropy: number;
  failureCost: number;
  reversibility: number;
  contextPressure: number;
  historicalTrust: number;
  globalCoherence: number;
  score: number;
  finalRiskLevel: CodexCliGovernanceRiskLevel;
  factors: string[];
}

export interface CodexCliObservationSignals {
  modelUnavailable?: boolean;
  sandboxBlocked?: boolean;
  approvalBlocked?: boolean;
  parseError?: boolean;
  timeout?: boolean;
  processError?: boolean;
  commandUnavailable?: boolean;
  permissionBlocked?: boolean;
  stderrWarning?: boolean;
  writeSandboxRequested?: boolean;
  outputDrift?: boolean;
}

export interface CodexCliExecutionObservation {
  schemaVersion: "codex-cli-execution-observation.v1";
  observationId: string;
  taskId: string;
  host: "codex-cli";
  stage: string;
  status: CodexCliObservationStatus;
  sandbox: "read-only" | "workspace-write";
  approvalPolicy: "untrusted" | "on-request" | "never";
  model?: string;
  signals: CodexCliObservationSignals;
  eventCount: number;
  parseErrorCount: number;
  blockingReasons: string[];
  warnings: string[];
  evidenceRef?: string;
  createdAt: string;
}

export interface CodexCliAnomalyEntry {
  observationId: string;
  status: CodexCliObservationStatus;
  stage: string;
  reasons: string[];
  createdAt: string;
}

export interface CodexCliAnomalyLedger {
  count: number;
  entries: CodexCliAnomalyEntry[];
}

export interface CodexCliApprovalHistory {
  workspaceWriteReleaseApprovalRequired: boolean;
  workspaceWriteReleaseApprovalObserved: boolean;
  confirmationObserved: boolean;
}

export interface CodexCliStrategyDecisionV2 {
  schemaVersion: "codex-cli-strategy-decision.v2";
  decisionId: string;
  taskId: string;
  action: CodexCliStrategyAction;
  riskLevel: CodexCliGovernanceRiskLevel;
  verificationIntensity: CodexCliVerificationIntensity;
  checkpointCadence: "minimal" | "stage" | "observation" | "risk_boundary";
  writeSandboxAllowed: boolean;
  reasons: string[];
  createdAt: string;
}

export interface CodexCliGovernanceState {
  schemaVersion: "codex-cli-governance-state.v2";
  taskId: string;
  branchId: string;
  host: "codex-cli";
  phase: CodexCliGovernancePhase;
  risk: CodexCliGovernanceRiskScore;
  anomalies: CodexCliAnomalyLedger;
  approvals: CodexCliApprovalHistory;
  latestObservation?: CodexCliExecutionObservation;
  strategy: CodexCliStrategyDecisionV2;
  createdAt: string;
  updatedAt: string;
}

export interface CodexCliCheckpointLedgerEntry {
  schemaVersion: "codex-cli-checkpoint-ledger-entry.v2";
  ledgerId: string;
  taskId: string;
  branchId: string;
  stage: string;
  strategyAction: CodexCliStrategyAction;
  governanceStateRef: string;
  observationRef?: string;
  evidenceRefs: string[];
  reversibleActions: string[];
  irreversibleActions: string[];
  createdAt: string;
}

export interface CodexCliArbitrationPacket {
  schemaVersion: "codex-cli-arbitration-packet.v1";
  packetId: string;
  taskId: string;
  trigger: CodexCliArbitrationTrigger;
  currentState: CodexCliGovernanceState;
  rawEvidenceRefs: string[];
  conflictingSignals: string[];
  availableActions: Array<"resume" | "rollback" | "abort" | "fork">;
  recommendation?: string;
  probabilityPredictionAllowed: false;
  createdAt: string;
}

export interface CodexCliGovernanceBundle {
  state: CodexCliGovernanceState;
  observation: CodexCliExecutionObservation;
  strategy: CodexCliStrategyDecisionV2;
  ledgerEntry: CodexCliCheckpointLedgerEntry;
  arbitrationPacket?: CodexCliArbitrationPacket;
}

export interface CodexCliGovernanceRunOptions {
  enabled?: boolean;
  previousState?: CodexCliGovernanceState;
  evidenceRef?: string;
  now?: () => string;
}

export interface CodexCliObservationInput {
  task: TaskEnvelope;
  plan: CodexCliGovernancePlanLike;
  stage: string;
  status: CodexCliObservationStatus;
  eventCount?: number;
  parseErrorCount?: number;
  blockingReasons?: string[];
  warnings?: string[];
  error?: string;
  timedOut?: boolean;
  killed?: boolean;
  evidenceRef?: string;
  now?: () => string;
}

export interface CodexCliGovernanceBundleInput extends CodexCliObservationInput {
  previousState?: CodexCliGovernanceState;
}

export function createCodexCliGovernanceBundle(
  input: CodexCliGovernanceBundleInput
): CodexCliGovernanceBundle {
  const observation = createCodexCliExecutionObservation(input);
  const baseState = input.previousState
    ?? createCodexCliGovernanceState({
      task: input.task,
      plan: input.plan,
      ...(input.now ? { now: input.now } : {})
    });
  const state = reduceCodexCliGovernanceState(baseState, observation, input.plan);
  const strategy = routeCodexCliStrategyV2(state, input.plan);
  const nextState: CodexCliGovernanceState = {
    ...state,
    strategy,
    updatedAt: observation.createdAt
  };
  const ledgerEntry = createCodexCliCheckpointLedgerEntry({
    state: nextState,
    observation,
    plan: input.plan,
    evidenceRefs: observation.evidenceRef ? [observation.evidenceRef] : [],
    now: () => observation.createdAt
  });
  const arbitrationPacket = shouldCreateCodexCliArbitrationPacket(nextState)
    ? createCodexCliArbitrationPacket({
      state: nextState,
      observation,
      evidenceRefs: ledgerEntry.evidenceRefs,
      now: () => observation.createdAt
    })
    : undefined;

  return {
    state: nextState,
    observation,
    strategy,
    ledgerEntry,
    ...(arbitrationPacket ? { arbitrationPacket } : {})
  };
}

export function createCodexCliGovernanceState(input: {
  task: TaskEnvelope;
  plan: CodexCliGovernancePlanLike;
  now?: () => string;
}): CodexCliGovernanceState {
  const now = input.now ?? (() => new Date().toISOString());
  const createdAt = now();
  const risk = scoreCodexCliGovernanceRisk(input.task, input.plan);
  const strategy = routeCodexCliStrategyV2({
    schemaVersion: "codex-cli-governance-state.v2",
    taskId: input.task.taskId,
    branchId: createCodexCliBranchId(input.task),
    host: "codex-cli",
    phase: "planning",
    risk,
    anomalies: {
      count: 0,
      entries: []
    },
    approvals: createCodexCliApprovalHistory(input.plan, false),
    createdAt,
    updatedAt: createdAt,
    strategy: createPlaceholderStrategy(input.task.taskId, risk, createdAt)
  }, input.plan);

  return {
    schemaVersion: "codex-cli-governance-state.v2",
    taskId: input.task.taskId,
    branchId: createCodexCliBranchId(input.task),
    host: "codex-cli",
    phase: "planning",
    risk,
    anomalies: {
      count: 0,
      entries: []
    },
    approvals: createCodexCliApprovalHistory(input.plan, false),
    strategy,
    createdAt,
    updatedAt: createdAt
  };
}

export function createCodexCliExecutionObservation(
  input: CodexCliObservationInput
): CodexCliExecutionObservation {
  const now = input.now ?? (() => new Date().toISOString());
  const createdAt = now();
  const blockingReasons = uniqueStrings(input.blockingReasons ?? []);
  const warnings = uniqueStrings(input.warnings ?? []);
  const parseErrorCount = input.parseErrorCount ?? 0;
  const signals = createCodexCliObservationSignals({
    plan: input.plan,
    blockingReasons,
    warnings,
    parseErrorCount,
    ...(input.error ? { error: input.error } : {}),
    timedOut: input.timedOut ?? false
  });

  return {
    schemaVersion: "codex-cli-execution-observation.v1",
    observationId: `${input.task.taskId}:${input.stage}:${createdAt}`,
    taskId: input.task.taskId,
    host: "codex-cli",
    stage: input.stage,
    status: input.status,
    sandbox: input.plan.sandbox,
    approvalPolicy: input.plan.approvalPolicy,
    ...(input.plan.model ? { model: input.plan.model } : {}),
    signals,
    eventCount: input.eventCount ?? 0,
    parseErrorCount,
    blockingReasons,
    warnings,
    ...(input.evidenceRef ? { evidenceRef: input.evidenceRef } : {}),
    createdAt
  };
}

export function reduceCodexCliGovernanceState(
  state: CodexCliGovernanceState,
  observation: CodexCliExecutionObservation,
  plan: CodexCliGovernancePlanLike
): CodexCliGovernanceState {
  const anomalous = isCodexCliAnomalousObservation(observation);
  const anomalyEntry: CodexCliAnomalyEntry | undefined = anomalous
    ? {
      observationId: observation.observationId,
      status: observation.status,
      stage: observation.stage,
      reasons: observation.blockingReasons.length > 0
        ? [...observation.blockingReasons]
        : [...observation.warnings],
      createdAt: observation.createdAt
    }
    : undefined;
  const anomalies = anomalyEntry
    ? {
      count: state.anomalies.count + 1,
      entries: [...state.anomalies.entries, anomalyEntry]
    }
    : state.anomalies;
  const phase = resolveCodexCliGovernancePhase(observation, anomalies.count);
  const risk = rescoreCodexCliRiskFromObservation(state.risk, observation, anomalies.count);

  return {
    ...state,
    phase,
    risk,
    anomalies,
    approvals: createCodexCliApprovalHistory(plan, state.approvals.confirmationObserved),
    latestObservation: observation,
    updatedAt: observation.createdAt
  };
}

export function routeCodexCliStrategyV2(
  state: CodexCliGovernanceState,
  plan: CodexCliGovernancePlanLike
): CodexCliStrategyDecisionV2 {
  const reasons: string[] = [
    `risk:${state.risk.finalRiskLevel}`,
    `sandbox:${plan.sandbox}`
  ];
  let action: CodexCliStrategyAction = "continue";
  let verificationIntensity: CodexCliVerificationIntensity = "light";
  let checkpointCadence: CodexCliStrategyDecisionV2["checkpointCadence"] = "observation";
  let writeSandboxAllowed = plan.sandbox === "workspace-write";

  if (state.anomalies.count >= 3) {
    action = "step_back";
    verificationIntensity = "strict";
    checkpointCadence = "risk_boundary";
    writeSandboxAllowed = false;
    reasons.push("three_strike_step_back");
  } else if (state.anomalies.count === 2) {
    action = plan.sandbox === "workspace-write" ? "lockdown" : "verify";
    verificationIntensity = "strict";
    checkpointCadence = "risk_boundary";
    writeSandboxAllowed = false;
    reasons.push("second_anomaly_arbitration_preview");
  } else if (state.anomalies.count === 1) {
    action = "verify";
    verificationIntensity = state.risk.finalRiskLevel === "low" ? "standard" : "strict";
    checkpointCadence = "risk_boundary";
    reasons.push("first_anomaly_silent_audit");
  } else if (state.risk.finalRiskLevel === "critical") {
    action = "lockdown";
    verificationIntensity = "strict";
    checkpointCadence = "risk_boundary";
    writeSandboxAllowed = false;
    reasons.push("critical_risk_lockdown");
  } else if (state.risk.finalRiskLevel === "high") {
    action = "verify";
    verificationIntensity = "strict";
    checkpointCadence = "risk_boundary";
    reasons.push("high_risk_requires_strict_verification");
  } else if (state.risk.finalRiskLevel === "medium") {
    verificationIntensity = "standard";
    reasons.push("medium_risk_standard_verification");
  } else {
    verificationIntensity = "light";
    checkpointCadence = "stage";
    reasons.push("low_risk_cli_execution");
  }

  return {
    schemaVersion: "codex-cli-strategy-decision.v2",
    decisionId: `${state.taskId}:codex-cli-strategy-v2:${state.updatedAt}`,
    taskId: state.taskId,
    action,
    riskLevel: state.risk.finalRiskLevel,
    verificationIntensity,
    checkpointCadence,
    writeSandboxAllowed,
    reasons: uniqueStrings(reasons),
    createdAt: state.updatedAt
  };
}

export function getCodexCliGovernancePreRunBlockers(
  plan: CodexCliGovernancePlanLike,
  previousState?: CodexCliGovernanceState
): string[] {
  if (!previousState) {
    return [];
  }

  const blockers: string[] = [];

  if (previousState.strategy.action === "step_back" || previousState.anomalies.count >= 3) {
    blockers.push("codex_cli_governance_step_back_active");
  }

  if (
    plan.sandbox === "workspace-write" &&
    (previousState.strategy.action === "lockdown" || previousState.strategy.writeSandboxAllowed === false)
  ) {
    blockers.push("codex_cli_governance_lockdown_write_sandbox");
  }

  return uniqueStrings(blockers);
}

export function createCodexCliCheckpointLedgerEntry(input: {
  state: CodexCliGovernanceState;
  observation?: CodexCliExecutionObservation;
  plan: CodexCliGovernancePlanLike;
  evidenceRefs?: string[];
  now?: () => string;
}): CodexCliCheckpointLedgerEntry {
  const now = input.now ?? (() => new Date().toISOString());
  const createdAt = now();
  const reversibleActions = input.plan.sandbox === "workspace-write"
    ? input.state.latestObservation?.taskId
      ? [`bounded_workspace_write:${input.state.latestObservation.taskId}`]
      : ["bounded_workspace_write"]
    : [];

  return {
    schemaVersion: "codex-cli-checkpoint-ledger-entry.v2",
    ledgerId: `${input.state.taskId}:codex-cli-ledger:${createdAt}`,
    taskId: input.state.taskId,
    branchId: input.state.branchId,
    stage: input.observation?.stage ?? input.state.phase,
    strategyAction: input.state.strategy.action,
    governanceStateRef: `${input.state.taskId}:${input.state.updatedAt}`,
    ...(input.observation ? { observationRef: input.observation.observationId } : {}),
    evidenceRefs: [...(input.evidenceRefs ?? [])],
    reversibleActions,
    irreversibleActions: [],
    createdAt
  };
}

export function createCodexCliArbitrationPacket(input: {
  state: CodexCliGovernanceState;
  observation?: CodexCliExecutionObservation;
  evidenceRefs?: string[];
  now?: () => string;
}): CodexCliArbitrationPacket {
  const now = input.now ?? (() => new Date().toISOString());
  const createdAt = now();
  const trigger = resolveArbitrationTrigger(input.state);
  const recommendation = input.state.strategy.action === "step_back"
    ? "freeze CLI execution and require human arbitration before continuing"
    : input.state.strategy.action === "lockdown"
      ? "keep read-only verification active and block workspace-write until reviewed"
      : "continue with stricter verification and review raw evidence";

  return {
    schemaVersion: "codex-cli-arbitration-packet.v1",
    packetId: `${input.state.taskId}:codex-cli-arbitration:${createdAt}`,
    taskId: input.state.taskId,
    trigger,
    currentState: input.state,
    rawEvidenceRefs: [...(input.evidenceRefs ?? [])],
    conflictingSignals: collectConflictingSignals(input.observation ?? input.state.latestObservation),
    availableActions: ["resume", "rollback", "abort", "fork"],
    recommendation,
    probabilityPredictionAllowed: false,
    createdAt
  };
}

export function shouldCreateCodexCliArbitrationPacket(
  state: CodexCliGovernanceState
): boolean {
  return state.anomalies.count >= 2 || state.strategy.action === "step_back";
}

function scoreCodexCliGovernanceRisk(
  task: TaskEnvelope,
  plan: CodexCliGovernancePlanLike
): CodexCliGovernanceRiskScore {
  const haystack = `${task.intent.summary} ${task.intent.requestedAction} ${task.hints.riskHints.join(" ")}`.toLowerCase();
  const factors: string[] = [];
  const writeRequested = plan.sandbox === "workspace-write";
  const targetCount = task.target.files.length + task.target.modules.length + task.target.branches.length;
  const releaseLike = task.hints.taskClassHint === "release_external_action" || /\b(release|prod|push|merge)\b/.test(haystack);
  const highRiskLike = task.hints.taskClassHint === "high_risk" || /\b(secret|env|migration|permission|production|delete)\b/.test(haystack);
  const entanglement = clamp01(targetCount / 8);
  const entropy = clamp01((task.intent.successCriteria.length === 0 ? 0.15 : 0) + (task.intent.summary.length < 12 ? 0.2 : 0));
  const failureCost = releaseLike ? 1 : highRiskLike ? 0.75 : writeRequested ? 0.5 : 0.15;
  const reversibility = writeRequested ? 0.45 : 0.9;
  const contextPressure = task.repoContext.repoRoot ? 0.15 : 0.45;
  const historicalTrust = 0.5;
  const globalCoherence = task.target.modules.includes("codex-cli-host") ? 0.85 : 0.6;

  if (writeRequested) {
    factors.push("workspace_write_requested");
  }
  if (releaseLike) {
    factors.push("release_like_task");
  }
  if (highRiskLike) {
    factors.push("high_risk_keywords");
  }
  if (!task.repoContext.repoRoot) {
    factors.push("repo_root_missing");
  }
  if (targetCount > 3) {
    factors.push("multi_target_task");
  }

  const score = clamp01(
    entanglement * 0.15 +
    entropy * 0.15 +
    failureCost * 0.25 +
    (1 - reversibility) * 0.15 +
    contextPressure * 0.1 +
    (1 - historicalTrust) * 0.1 +
    (1 - globalCoherence) * 0.1
  );

  return {
    entanglement,
    entropy,
    failureCost,
    reversibility,
    contextPressure,
    historicalTrust,
    globalCoherence,
    score,
    finalRiskLevel: riskLevelFromScore(score),
    factors
  };
}

function rescoreCodexCliRiskFromObservation(
  risk: CodexCliGovernanceRiskScore,
  observation: CodexCliExecutionObservation,
  anomalyCount: number
): CodexCliGovernanceRiskScore {
  const signalPressure = Object.values(observation.signals).some(Boolean) ? 0.1 : 0;
  const anomalyPressure = Math.min(0.35, anomalyCount * 0.12);
  const score = clamp01(risk.score + signalPressure + anomalyPressure);

  return {
    ...risk,
    score,
    finalRiskLevel: riskLevelFromScore(score),
    factors: uniqueStrings([
      ...risk.factors,
      ...(observation.status === "blocked" ? ["observation_blocked"] : []),
      ...(observation.status === "failed" ? ["observation_failed"] : []),
      ...(observation.parseErrorCount > 0 ? ["jsonl_parse_error"] : []),
      ...(observation.signals.timeout ? ["timeout"] : [])
    ])
  };
}

function createCodexCliObservationSignals(input: {
  plan: CodexCliGovernancePlanLike;
  blockingReasons: string[];
  warnings: string[];
  parseErrorCount: number;
  error?: string;
  timedOut: boolean;
}): CodexCliObservationSignals {
  const reasonText = `${input.blockingReasons.join(" ")} ${input.error ?? ""}`.toLowerCase();

  return {
    ...(reasonText.includes("model_unavailable") || reasonText.includes("model_probe")
      ? { modelUnavailable: true }
      : {}),
    ...(reasonText.includes("write_sandbox") || reasonText.includes("sandbox")
      ? { sandboxBlocked: true }
      : {}),
    ...(reasonText.includes("approval")
      ? { approvalBlocked: true }
      : {}),
    ...(input.parseErrorCount > 0 ? { parseError: true, outputDrift: true } : {}),
    ...(input.timedOut || reasonText.includes("timeout") ? { timeout: true } : {}),
    ...(reasonText.includes("process_error") || input.error ? { processError: true } : {}),
    ...(reasonText.includes("enoent") || reasonText.includes("command_not_found")
      ? { commandUnavailable: true }
      : {}),
    ...(reasonText.includes("eperm") || reasonText.includes("eacces") || reasonText.includes("permission")
      ? { permissionBlocked: true }
      : {}),
    ...(input.warnings.length > 0 ? { stderrWarning: true } : {}),
    ...(input.plan.sandbox === "workspace-write" ? { writeSandboxRequested: true } : {})
  };
}

function isCodexCliAnomalousObservation(
  observation: CodexCliExecutionObservation
): boolean {
  if (observation.status === "failed" || observation.status === "blocked") {
    return true;
  }

  return observation.status === "degraded" && (
    observation.signals.parseError === true ||
    observation.signals.timeout === true ||
    observation.signals.processError === true
  );
}

function resolveCodexCliGovernancePhase(
  observation: CodexCliExecutionObservation,
  anomalyCount: number
): CodexCliGovernancePhase {
  if (anomalyCount >= 3) {
    return "recovery";
  }

  if (observation.status === "blocked") {
    return "preflight";
  }

  if (observation.status === "succeeded") {
    return "closed";
  }

  if (observation.status === "degraded") {
    return "verification";
  }

  return "execution";
}

function createCodexCliApprovalHistory(
  plan: CodexCliGovernancePlanLike,
  confirmationObserved: boolean
): CodexCliApprovalHistory {
  return {
    workspaceWriteReleaseApprovalRequired: plan.sandbox === "workspace-write",
    workspaceWriteReleaseApprovalObserved: plan.sandbox !== "workspace-write",
    confirmationObserved
  };
}

function createPlaceholderStrategy(
  taskId: string,
  risk: CodexCliGovernanceRiskScore,
  createdAt: string
): CodexCliStrategyDecisionV2 {
  return {
    schemaVersion: "codex-cli-strategy-decision.v2",
    decisionId: `${taskId}:codex-cli-strategy-v2:${createdAt}`,
    taskId,
    action: "continue",
    riskLevel: risk.finalRiskLevel,
    verificationIntensity: "light",
    checkpointCadence: "stage",
    writeSandboxAllowed: false,
    reasons: ["initial_placeholder"],
    createdAt
  };
}

function resolveArbitrationTrigger(
  state: CodexCliGovernanceState
): CodexCliArbitrationTrigger {
  if (state.anomalies.count >= 3) {
    return "third_anomaly";
  }

  if (state.anomalies.count === 2) {
    return "second_anomaly";
  }

  if (state.anomalies.count === 1) {
    return "first_anomaly";
  }

  return "manual";
}

function collectConflictingSignals(
  observation?: CodexCliExecutionObservation
): string[] {
  if (!observation) {
    return [];
  }

  const signals: string[] = [];
  for (const [key, value] of Object.entries(observation.signals)) {
    if (value === true) {
      signals.push(key);
    }
  }

  return signals;
}

function createCodexCliBranchId(task: TaskEnvelope): string {
  return task.repoContext.branch
    ? `${task.taskId}:${task.repoContext.branch}`
    : `${task.taskId}:cli-default`;
}

function riskLevelFromScore(score: number): CodexCliGovernanceRiskLevel {
  if (score >= 0.85) {
    return "critical";
  }

  if (score >= 0.65) {
    return "high";
  }

  if (score >= 0.35) {
    return "medium";
  }

  return "low";
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

// ── Bridge: convert CLI governance state to generic governance state ────────

export function bridgeCliStateToGenericState(
  cliState: CodexCliGovernanceState,
  task: TaskEnvelope
): GovernanceState {
  return {
    schemaVersion: "governance-state.v1",
    taskId: cliState.taskId,
    branchId: cliState.branchId,
    phase: cliState.phase as GovernancePhase,
    trustBalance: {
      centralOrder: 0.5,
      distributedVitality: 0.5
    },
    risk: {
      entanglement: cliState.risk.entanglement,
      entropy: cliState.risk.entropy,
      failureCost: cliState.risk.failureCost,
      reversibility: cliState.risk.reversibility,
      contextPressure: cliState.risk.contextPressure,
      historicalTrust: cliState.risk.historicalTrust,
      globalCoherence: cliState.risk.globalCoherence,
      finalRiskLevel: cliState.risk.finalRiskLevel
    },
    anomalies: cliState.anomalies.entries.map((entry): AnomalyRecord => ({
      anomalyId: entry.observationId,
      taskId: cliState.taskId,
      kind: entry.status,
      message: entry.reasons.join("; "),
      strikeNumber: Math.min(
        3,
        cliState.anomalies.entries.filter((e) => e.status === entry.status).length
      ) as 1 | 2 | 3,
      createdAt: entry.createdAt,
      evidenceRefs: []
    })),
    approvals: [],
    taskGraphRef: `task-graph:${cliState.taskId}`,
    ...(cliState.latestObservation !== undefined
      ? { latestCheckpointId: cliState.latestObservation.observationId }
      : {}),
    createdAt: cliState.createdAt,
    updatedAt: cliState.updatedAt
  };
}

export function bridgeRouteStrategyFromCliState(
  cliState: CodexCliGovernanceState,
  task: TaskEnvelope
): StrategyDecisionV2 {
  const genericState = bridgeCliStateToGenericState(cliState, task);
  return routeStrategyV2({
    state: genericState,
    now: () => cliState.updatedAt
  });
}
