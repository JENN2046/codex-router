import { z } from "zod";
import type { GovernanceState, ApprovalHistoryRecord } from "../../state-manager/src/index.js";

// ── Delegation Level ─────────────────────────────────────────────────────────

export const DelegationLevelSchema = z.enum([
  "full_control",      // 0: 完全控制，所有操作需审批
  "supervised",        // 1: 监督模式，高风险需审批
  "trusted",           // 2: 信任模式，仅异常需审批
  "autonomous",        // 3: 自主模式，定期审计
  "full_delegation"    // 4: 完全放权，仅里程碑汇报
]);

export type DelegationLevel = z.infer<typeof DelegationLevelSchema>;

// ── Resume Record ───────────────────────────────────────────────────────────

export const ResumeRecordSchema = z.object({
  resumeId: z.string().min(1),
  taskId: z.string().min(1),
  reason: z.string().min(1),
  actor: z.string().min(1),
  createdAt: z.string().min(1),
  context: z.record(z.unknown()).optional()
});

export type ResumeRecord = z.infer<typeof ResumeRecordSchema>;

// ── Delegation History ──────────────────────────────────────────────────────

export const DelegationHistorySchema = z.object({
  taskId: z.string().min(1),
  operationClass: z.string().min(1),
  resumeCount: z.number().int().min(0),
  approvalCount: z.number().int().min(0),
  rejectionCount: z.number().int().min(0),
  lastResumeAt: z.string().min(1).optional(),
  firstCreatedAt: z.string().min(1)
});

export type DelegationHistory = z.infer<typeof DelegationHistorySchema>;

// ── Risk Weight Adjustment Proposal ─────────────────────────────────────────

export const RiskWeightAdjustmentProposalSchema = z.object({
  proposalId: z.string().min(1),
  taskId: z.string().min(1),
  operationClass: z.string().min(1),
  currentLevel: DelegationLevelSchema,
  proposedLevel: DelegationLevelSchema,
  resumeCount: z.number().int().min(0),
  auditTrailRefs: z.array(z.string()).default([]),
  requiredApprovers: z.array(z.string()).default([]),
  status: z.enum(["draft", "pending_review", "approved", "rejected"]),
  createdAt: z.string().min(1)
});

export type RiskWeightAdjustmentProposal = z.infer<typeof RiskWeightAdjustmentProposalSchema>;

// ── Parse helpers ───────────────────────────────────────────────────────────

export function parseDelegationHistory(input: unknown): DelegationHistory {
  return DelegationHistorySchema.parse(input);
}

export function parseRiskWeightAdjustmentProposal(input: unknown): RiskWeightAdjustmentProposal {
  return RiskWeightAdjustmentProposalSchema.parse(input);
}

// ── Factory: create delegation history ──────────────────────────────────────

export interface CreateDelegationHistoryInput {
  taskId: string;
  operationClass: string;
  now?: () => string;
}

export function createDelegationHistory(input: CreateDelegationHistoryInput): DelegationHistory {
  const now = input.now ?? (() => new Date().toISOString());
  return {
    taskId: input.taskId,
    operationClass: input.operationClass,
    resumeCount: 0,
    approvalCount: 0,
    rejectionCount: 0,
    firstCreatedAt: now()
  };
}

// ── Record resume ───────────────────────────────────────────────────────────

export function recordResume(
  history: DelegationHistory,
  resume: Omit<ResumeRecord, "resumeId">
): { history: DelegationHistory; record: ResumeRecord } {
  const record: ResumeRecord = {
    ...resume,
    resumeId: `${resume.taskId}:resume:${history.resumeCount + 1}`
  };

  const updated: DelegationHistory = {
    ...history,
    resumeCount: history.resumeCount + 1,
    lastResumeAt: record.createdAt
  };

  return { history: updated, record };
}

// ── Record approval/rejection ───────────────────────────────────────────────

export function recordApproval(history: DelegationHistory): DelegationHistory {
  return {
    ...history,
    approvalCount: history.approvalCount + 1
  };
}

export function recordRejection(history: DelegationHistory): DelegationHistory {
  return {
    ...history,
    rejectionCount: history.rejectionCount + 1
  };
}

// ── Calculate delegation level ──────────────────────────────────────────────

export function calculateDelegationLevel(history: DelegationHistory): DelegationLevel {
  const { resumeCount, approvalCount, rejectionCount } = history;

  // Any rejection resets to full_control
  if (rejectionCount > 0) {
    return "full_control";
  }

  // 5+ consecutive resumes without rejection → full_delegation
  if (resumeCount >= 5) {
    return "full_delegation";
  }

  // 3+ resumes → autonomous
  if (resumeCount >= 3) {
    return "autonomous";
  }

  // 2+ resumes → trusted
  if (resumeCount >= 2) {
    return "trusted";
  }

  // 1 resume → supervised
  if (resumeCount >= 1) {
    return "supervised";
  }

  return "full_control";
}

// ── Generate adjustment proposal ────────────────────────────────────────────

export interface GenerateProposalInput {
  taskId: string;
  operationClass: string;
  history: DelegationHistory;
  auditTrailRefs?: string[];
  requiredApprovers?: string[];
  now?: () => string;
}

export function generateAdjustmentProposal(input: GenerateProposalInput): RiskWeightAdjustmentProposal {
  const now = input.now ?? (() => new Date().toISOString());
  const currentLevel = calculateDelegationLevel(input.history);
  const proposedLevel = currentLevel === "full_delegation"
    ? "full_delegation"
    : currentLevel === "full_control"
      ? "supervised"
      : currentLevel === "supervised"
        ? "trusted"
        : currentLevel === "trusted"
          ? "autonomous"
          : "full_delegation";

  return {
    proposalId: `${input.taskId}:proposal:${now()}`,
    taskId: input.taskId,
    operationClass: input.operationClass,
    currentLevel,
    proposedLevel,
    resumeCount: input.history.resumeCount,
    auditTrailRefs: input.auditTrailRefs ?? [],
    requiredApprovers: input.requiredApprovers ?? ["human"],
    status: "pending_review",
    createdAt: now()
  };
}

// ── Check if action requires approval based on delegation level ────────────

export interface CheckApprovalInput {
  level: DelegationLevel;
  riskLevel: GovernanceState["risk"];
  isIrreversible: boolean;
  isHighRiskOperation: boolean;
}

export function requiresApproval(input: CheckApprovalInput): boolean {
  const { level, riskLevel, isIrreversible, isHighRiskOperation } = input;

  // Irreversible actions always require approval
  if (isIrreversible) {
    return true;
  }

  // High risk operations require approval at lower levels
  if (isHighRiskOperation) {
    if (level === "full_control" || level === "supervised") {
      return true;
    }
    // At trusted/autonomous, only critical risk requires approval
    if (riskLevel.finalRiskLevel === "critical") {
      return true;
    }
  }

  // At full_delegation, no approval needed
  if (level === "full_delegation") {
    return false;
  }

  // At autonomous, only high risk requires approval
  if (level === "autonomous") {
    return riskLevel.finalRiskLevel === "high" || riskLevel.finalRiskLevel === "critical";
  }

  // At trusted, medium+ risk requires approval
  if (level === "trusted") {
    return riskLevel.finalRiskLevel !== "low";
  }

  // At supervised, all non-low risk requires approval
  if (level === "supervised") {
    return riskLevel.finalRiskLevel !== "low";
  }

  // At full_control, everything requires approval
  return true;
}

// ── Get required approvers based on level and operation ─────────────────────

export function getRequiredApprovers(
  level: DelegationLevel,
  operationClass: string
): string[] {
  const baseApprovers = ["human"];

  if (level === "full_delegation") {
    return [];
  }

  if (level === "autonomous" || level === "trusted") {
    return ["supervisor"];
  }

  return baseApprovers;
}

// ── Bridge: derive DelegationHistory from ApprovalHistoryRecord[] ─────────────

/**
 * Derives a DelegationHistory from existing ApprovalHistoryRecord entries.
 * This bridges the raw approval log in GovernanceState to the delegation model.
 */
export function deriveDelegationFromApprovals(
  approvals: ApprovalHistoryRecord[],
  taskId: string,
  operationClass: string
): DelegationHistory {
  let resumeCount = 0;
  let approvalCount = 0;
  let rejectionCount = 0;
  let lastResumeAt: string | undefined;
  const firstCreatedAt = approvals[0]?.createdAt ?? new Date().toISOString();

  for (const record of approvals) {
    if (record.action === "resume") {
      resumeCount++;
      lastResumeAt = record.createdAt;
    } else if (record.action === "approve") {
      approvalCount++;
    } else if (record.action === "reject") {
      rejectionCount++;
    }
  }

  return {
    taskId,
    operationClass,
    resumeCount,
    approvalCount,
    rejectionCount,
    ...(lastResumeAt !== undefined ? { lastResumeAt } : {}),
    firstCreatedAt
  };
}

// ── Historical trust mapping ─────────────────────────────────────────────────

/**
 * Maps a delegation level to a historicalTrust coefficient.
 * Higher trust levels reduce the risk penalty from historical uncertainty.
 */
export function delegationLevelToHistoricalTrust(level: DelegationLevel): number {
  switch (level) {
    case "full_delegation": return 0.95;
    case "autonomous":      return 0.85;
    case "trusted":         return 0.70;
    case "supervised":      return 0.50;
    case "full_control":    return 0.30;
  }
}

// ── Proposal lifecycle ───────────────────────────────────────────────────────

/**
 * Approves a weight adjustment proposal by setting its status to "approved".
 */
export function approveProposal(
  proposal: RiskWeightAdjustmentProposal
): RiskWeightAdjustmentProposal {
  return {
    ...proposal,
    status: "approved"
  };
}

/**
 * Rejects a weight adjustment proposal by setting its status to "rejected".
 */
export function rejectProposal(
  proposal: RiskWeightAdjustmentProposal
): RiskWeightAdjustmentProposal {
  return {
    ...proposal,
    status: "rejected"
  };
}

/**
 * Applies an approved proposal, returning the new delegation level
 * that should take effect.
 */
export function applyApprovedProposal(
  proposal: RiskWeightAdjustmentProposal
): DelegationLevel {
  if (proposal.status !== "approved") {
    return proposal.currentLevel;
  }
  return proposal.proposedLevel;
}

// ── Recovery action filtering ────────────────────────────────────────────────

/**
 * Filters available recovery actions based on the current delegation level.
 *
 * - full_control: only resume and abort (conservative, human controls everything)
 * - supervised: resume, rollback, abort
 * - trusted: resume, rollback, abort, fork
 * - autonomous: all actions
 * - full_delegation: all actions
 */
export function filterRecoveryActions(
  level: DelegationLevel,
  allActions: string[] = ["resume", "rollback", "abort", "fork"]
): string[] {
  switch (level) {
    case "full_control":
      return ["resume", "abort"];
    case "supervised":
      return ["resume", "rollback", "abort"];
    case "trusted":
    case "autonomous":
    case "full_delegation":
    default:
      return allActions;
  }
}

// ── Store interface ──────────────────────────────────────────────────────────

export interface DelegationHistoryStore {
  save(history: DelegationHistory): Promise<void>;
  load(taskId: string): Promise<DelegationHistory | undefined>;
}

// ── In-memory store ──────────────────────────────────────────────────────────

export class RecordingDelegationHistoryStore implements DelegationHistoryStore {
  private readonly histories = new Map<string, DelegationHistory>();

  async save(history: DelegationHistory): Promise<void> {
    this.histories.set(history.taskId, history);
  }

  async load(taskId: string): Promise<DelegationHistory | undefined> {
    return this.histories.get(taskId);
  }
}

export function createRecordingDelegationHistoryStore(): RecordingDelegationHistoryStore {
  return new RecordingDelegationHistoryStore();
}

// ── File-based store ─────────────────────────────────────────────────────────

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface FileDelegationHistoryStoreOptions {
  basePath: string;
}

export class FileDelegationHistoryStore implements DelegationHistoryStore {
  private readonly basePath: string;

  constructor(options: FileDelegationHistoryStoreOptions) {
    this.basePath = options.basePath;
  }

  private async ensureBaseDir(): Promise<void> {
    await mkdir(this.basePath, { recursive: true });
  }

  private getFilePath(taskId: string): string {
    const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.basePath, `${safeTaskId}.json`);
  }

  async save(history: DelegationHistory): Promise<void> {
    await this.ensureBaseDir();
    const filePath = this.getFilePath(history.taskId);
    await writeFile(filePath, JSON.stringify(history, null, 2), "utf-8");
  }

  async load(taskId: string): Promise<DelegationHistory | undefined> {
    await this.ensureBaseDir();
    const filePath = this.getFilePath(taskId);
    try {
      const content = await readFile(filePath, "utf-8");
      return parseDelegationHistory(JSON.parse(content));
    } catch {
      return undefined;
    }
  }
}

export function createFileDelegationHistoryStore(
  options: FileDelegationHistoryStoreOptions
): FileDelegationHistoryStore {
  return new FileDelegationHistoryStore(options);
}
