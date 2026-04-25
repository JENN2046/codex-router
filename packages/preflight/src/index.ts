import type { ToolAccessLevel } from "../../contracts/src/index.js";
import type {
  MemoryExecutionGuidance,
  MemoryHealthPolicyPackName
} from "../../policy-config/src/index.js";

export interface PreflightContext {
  authAvailable: boolean;
  requiredTools: string[];
  availableTools: string[];
  workspaceClean?: boolean;
  protectedBranch?: boolean;
  requestedToolAccess: ToolAccessLevel;
  memoryOverview?: MemoryOverviewSnapshot;
  requireMemoryOverview?: boolean;
  memoryOverviewPolicy?: MemoryOverviewPolicy;
  memoryOverviewPolicyPack?: MemoryHealthPolicyPackName;
  memoryExecutionGuidance?: MemoryExecutionGuidance;
}

export interface PreflightResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  memory: MemoryPreflightState;
}

export interface MemoryOverviewPolicy {
  overviewUnavailableSeverity?: MemoryIssueSeverity;
  codexMcpUnavailableSeverity?: MemoryIssueSeverity;
  maxRejectedWrites?: number;
  rejectedWritesSeverity?: MemoryIssueSeverity;
  maxShadowReconcileCount?: number;
  shadowReconcileSeverity?: MemoryIssueSeverity;
  recallUnavailableSeverity?: MemoryIssueSeverity;
  nonActiveRecallSeverity?: MemoryIssueSeverity;
}

export interface MemoryOverviewSnapshot {
  adapterStatus?: {
    codexMcp?: string;
    [key: string]: unknown;
  };
  summary?: {
    rejected?: number;
    [key: string]: unknown;
  };
  shadowSync?: {
    reconcileCount?: number;
    [key: string]: unknown;
  };
  recall?: {
    available?: boolean;
    status?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export type MemoryPreflightStatus =
  | "ok"
  | "degraded"
  | "blocked"
  | "unavailable";

export interface MemoryPreflightSignals {
  codexMcpStatus?: string;
  rejectedWrites: number;
  shadowReconcileCount: number;
  recallAvailable?: boolean;
  recallStatus?: string;
}

export interface MemoryPreflightState {
  status: MemoryPreflightStatus;
  policyPack?: MemoryHealthPolicyPackName;
  guidance?: MemoryExecutionGuidance;
  required: boolean;
  available: boolean;
  issues: string[];
  blockingIssues: string[];
  warningIssues: string[];
  signals: MemoryPreflightSignals;
}

export type MemoryIssueSeverity = "ignore" | "warn" | "block";

export function runPreflight(context: PreflightContext): PreflightResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!context.authAvailable) {
    errors.push("auth_unavailable");
  }

  for (const tool of context.requiredTools) {
    if (!context.availableTools.includes(tool)) {
      errors.push(`missing_tool:${tool}`);
    }
  }

  if (context.workspaceClean === false && context.requestedToolAccess !== "read_only") {
    warnings.push("workspace_dirty");
  }

  if (context.protectedBranch && context.requestedToolAccess !== "read_only") {
    warnings.push("protected_branch_active");
  }

  const memory = buildMemoryPreflightState(context);
  errors.push(...memory.blockingIssues);
  warnings.push(...memory.warningIssues);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    memory
  };
}

export function buildMemoryPreflightState(
  context: PreflightContext
): MemoryPreflightState {
  const overview = context.memoryOverview;
  const required = context.requireMemoryOverview ?? false;
  const policy = {
    overviewUnavailableSeverity: context.memoryOverviewPolicy?.overviewUnavailableSeverity
      ?? (required ? "block" : "ignore"),
    codexMcpUnavailableSeverity: context.memoryOverviewPolicy?.codexMcpUnavailableSeverity ?? "block",
    maxRejectedWrites: context.memoryOverviewPolicy?.maxRejectedWrites ?? 0,
    rejectedWritesSeverity: context.memoryOverviewPolicy?.rejectedWritesSeverity ?? "warn",
    maxShadowReconcileCount: context.memoryOverviewPolicy?.maxShadowReconcileCount ?? 0,
    shadowReconcileSeverity: context.memoryOverviewPolicy?.shadowReconcileSeverity ?? "warn",
    recallUnavailableSeverity: context.memoryOverviewPolicy?.recallUnavailableSeverity ?? "warn",
    nonActiveRecallSeverity: context.memoryOverviewPolicy?.nonActiveRecallSeverity ?? "warn"
  };
  const blockingIssues: string[] = [];
  const warningIssues: string[] = [];
  const signals: MemoryPreflightSignals = {
    rejectedWrites: 0,
    shadowReconcileCount: 0
  };

  if (!overview) {
    applyIssueSeverity("memory_overview_unavailable", policy.overviewUnavailableSeverity, blockingIssues, warningIssues);

    return finalizeMemoryPreflightState({
      available: false,
      required,
      ...(context.memoryOverviewPolicyPack !== undefined ? { policyPack: context.memoryOverviewPolicyPack } : {}),
      ...(context.memoryExecutionGuidance !== undefined ? { guidance: context.memoryExecutionGuidance } : {}),
      blockingIssues,
      warningIssues,
      signals
    });
  }

  const codexMcpStatus = normalizeString(overview.adapterStatus?.codexMcp);
  if (codexMcpStatus) {
    signals.codexMcpStatus = codexMcpStatus;
  }

  if (
    codexMcpStatus
    && codexMcpStatus !== "enabled"
  ) {
    applyIssueSeverity(
      `memory_adapter_status:${codexMcpStatus}`,
      policy.codexMcpUnavailableSeverity,
      blockingIssues,
      warningIssues
    );
  }

  const rejected = toPositiveInteger(overview.summary?.rejected);
  signals.rejectedWrites = rejected;
  if (rejected > policy.maxRejectedWrites) {
    applyIssueSeverity(
      `memory_recent_rejections:${rejected}`,
      policy.rejectedWritesSeverity,
      blockingIssues,
      warningIssues
    );
  }

  const reconcileCount = toPositiveInteger(overview.shadowSync?.reconcileCount);
  signals.shadowReconcileCount = reconcileCount;
  if (reconcileCount > policy.maxShadowReconcileCount) {
    applyIssueSeverity(
      `memory_shadow_reconcile_pending:${reconcileCount}`,
      policy.shadowReconcileSeverity,
      blockingIssues,
      warningIssues
    );
  }

  if (typeof overview.recall?.available === "boolean") {
    signals.recallAvailable = overview.recall.available;
  }

  if (overview.recall?.available === false) {
    applyIssueSeverity(
      "memory_recall_unavailable",
      policy.recallUnavailableSeverity,
      blockingIssues,
      warningIssues
    );
    return finalizeMemoryPreflightState({
      available: true,
      required,
      ...(context.memoryOverviewPolicyPack !== undefined ? { policyPack: context.memoryOverviewPolicyPack } : {}),
      ...(context.memoryExecutionGuidance !== undefined ? { guidance: context.memoryExecutionGuidance } : {}),
      blockingIssues,
      warningIssues,
      signals
    });
  }

  const recallStatus = normalizeString(overview.recall?.status);
  if (recallStatus) {
    signals.recallStatus = recallStatus;
  }
  if (recallStatus && recallStatus !== "enabled" && recallStatus !== "active") {
    applyIssueSeverity(
      `memory_recall_status:${recallStatus}`,
      policy.nonActiveRecallSeverity,
      blockingIssues,
      warningIssues
    );
  }

  return finalizeMemoryPreflightState({
    available: true,
    required,
    ...(context.memoryOverviewPolicyPack !== undefined ? { policyPack: context.memoryOverviewPolicyPack } : {}),
    ...(context.memoryExecutionGuidance !== undefined ? { guidance: context.memoryExecutionGuidance } : {}),
    blockingIssues,
    warningIssues,
    signals
  });
}

function finalizeMemoryPreflightState(input: {
  available: boolean;
  required: boolean;
  policyPack?: MemoryHealthPolicyPackName;
  guidance?: MemoryExecutionGuidance;
  blockingIssues: string[];
  warningIssues: string[];
  signals: MemoryPreflightSignals;
}): MemoryPreflightState {
  let status: MemoryPreflightStatus;

  if (input.blockingIssues.length > 0) {
    status = "blocked";
  } else if (input.warningIssues.length > 0) {
    status = "degraded";
  } else if (!input.available) {
    status = "unavailable";
  } else {
    status = "ok";
  }

  return {
    status,
    ...(input.policyPack !== undefined ? { policyPack: input.policyPack } : {}),
    ...(input.guidance !== undefined ? { guidance: input.guidance } : {}),
    required: input.required,
    available: input.available,
    issues: [...input.blockingIssues, ...input.warningIssues],
    blockingIssues: [...input.blockingIssues],
    warningIssues: [...input.warningIssues],
    signals: input.signals
  };
}

function toPositiveInteger(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function applyIssueSeverity(
  issue: string,
  severity: MemoryIssueSeverity,
  blockingIssues: string[],
  warningIssues: string[]
): void {
  if (severity === "ignore") {
    return;
  }

  if (severity === "block") {
    blockingIssues.push(issue);
    return;
  }

  warningIssues.push(issue);
}
