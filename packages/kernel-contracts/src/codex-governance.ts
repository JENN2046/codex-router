import { z } from "zod";
import {
  CapabilityScopeSchema,
  hashKernelObject,
  type CapabilityScope
} from "./index.js";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const NonEmptyArgvSchema = z.array(z.string()).min(1).superRefine((argv, ctx) => {
  if (argv[0]?.trim() === "") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "argv executable must be non-empty",
      path: [0]
    });
  }
});

const SHELL_EXECUTABLES = new Set([
  "bash",
  "cmd",
  "cmd.exe",
  "dash",
  "fish",
  "powershell",
  "powershell.exe",
  "pwsh",
  "pwsh.exe",
  "sh",
  "zsh"
]);

export const GovernanceRiskLevelSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical"
]);

export const ApprovalModeSchema = z.enum([
  "not_required",
  "policy_auto",
  "human_required"
]);

export const AuthorizationDispositionSchema = z.enum([
  "authorized",
  "approval_required",
  "blocked"
]);

export const GovernedFileChangeKindSchema = z.enum([
  "create",
  "update",
  "delete",
  "rename"
]);

const GovernedFileChangeFieldsSchema = z.object({
  path: z.string().min(1),
  kind: GovernedFileChangeKindSchema,
  oldPath: z.string().min(1).optional(),
  unifiedDiff: z.string().min(1),
  beforeHash: Sha256Schema.nullable().optional(),
  afterHash: Sha256Schema.nullable().optional(),
  addedLines: z.number().int().nonnegative(),
  deletedLines: z.number().int().nonnegative()
}).strict();

type GovernedFileChangeSemanticFields = Pick<
  z.infer<typeof GovernedFileChangeFieldsSchema>,
  "kind" | "oldPath" | "beforeHash" | "afterHash"
>;

function refineGovernedFileChangeSemantics(
  change: GovernedFileChangeSemanticFields,
  ctx: z.RefinementCtx
): void {
  if (change.kind === "rename" && change.oldPath === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "rename changes require oldPath",
      path: ["oldPath"]
    });
  }
  if (change.kind !== "rename" && change.oldPath !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "oldPath is only valid for rename changes",
      path: ["oldPath"]
    });
  }
  if (change.kind === "create" && change.beforeHash !== undefined && change.beforeHash !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "create changes cannot declare a beforeHash",
      path: ["beforeHash"]
    });
  }
  if (change.kind === "delete" && change.afterHash !== undefined && change.afterHash !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "delete changes cannot declare an afterHash",
      path: ["afterHash"]
    });
  }
}

export const GovernedFileChangeSchema = GovernedFileChangeFieldsSchema.superRefine(
  refineGovernedFileChangeSemantics
);

const GovernedFileChangeSetFieldsSchema = z.object({
  schemaVersion: z.literal("governed-file-change-set.v1").default(
    "governed-file-change-set.v1"
  ),
  changeSetId: z.string().min(1),
  threadId: z.string().min(1),
  turnId: z.string().min(1),
  itemId: z.string().min(1),
  baseHead: z.string().min(1),
  changes: z.array(GovernedFileChangeSchema).min(1),
  canonicalHash: Sha256Schema,
  proposedAt: z.string().min(1),
  sourceSchemaProfile: z.string().min(1)
}).strict();

export const GovernedFileChangeSetSchema = GovernedFileChangeSetFieldsSchema.superRefine(
  (changeSet, ctx) => {
    if (changeSet.canonicalHash !== hashGovernedFileChangeSetContent(changeSet)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "governed file change set canonical hash mismatch",
        path: ["canonicalHash"]
      });
    }
  }
);

export function hashGovernedFileChangeSetContent(input: {
  baseHead: string;
  changes: Array<{
    path: string;
    kind: z.infer<typeof GovernedFileChangeKindSchema>;
    oldPath?: string | undefined;
    unifiedDiff: string;
    beforeHash?: string | null | undefined;
    afterHash?: string | null | undefined;
    addedLines: number;
    deletedLines: number;
  }>;
}): string {
  return hashKernelObject({
    schemaVersion: "governed-file-change-canonical.v1",
    baseHead: input.baseHead,
    changes: input.changes.map((change) => ({
      path: change.path,
      kind: change.kind,
      ...(change.oldPath === undefined ? {} : { oldPath: change.oldPath }),
      unifiedDiff: change.unifiedDiff,
      ...(change.beforeHash === undefined ? {} : { beforeHash: change.beforeHash }),
      ...(change.afterHash === undefined ? {} : { afterHash: change.afterHash }),
      addedLines: change.addedLines,
      deletedLines: change.deletedLines
    }))
  });
}

export type CapabilityFactFileChange = {
  path: string;
  kind: "create" | "update" | "delete" | "rename";
  oldPath?: string | undefined;
  beforeHash?: string | null | undefined;
  afterHash?: string | null | undefined;
  addedLines: number;
  deletedLines: number;
};

export const CapabilityFactFileChangeSchema: z.ZodType<CapabilityFactFileChange> =
  GovernedFileChangeFieldsSchema.omit({
    unifiedDiff: true
  }).superRefine(refineGovernedFileChangeSemantics);

export const CapabilityFactCommandSchema = z.object({
  argv: NonEmptyArgvSchema,
  cwd: z.string().min(1).optional()
}).strict();

export const CapabilityFactsSchema = z.object({
  schemaVersion: z.literal("capability-facts.v1").default("capability-facts.v1"),
  subjectId: z.string().min(1),
  fileChanges: z.array(CapabilityFactFileChangeSchema).default([]),
  commands: z.array(CapabilityFactCommandSchema).default([]),
  permissionRequests: z.array(z.string().min(1)).default([]),
  repository: z.object({
    branch: z.string().min(1).optional(),
    protectedBranch: z.boolean(),
    worktreeClean: z.boolean(),
    headCommit: z.string().min(1).optional(),
    expectedHead: z.string().min(1).optional()
  }).strict(),
  networkAccess: z.enum(["none", "requested", "required", "unknown"]),
  credentialAccess: z.enum(["none", "requested", "unknown"]),
  externalTargets: z.array(z.string().min(1)).default([]),
  sensitivePaths: z.array(z.string().min(1)).default([]),
  releaseAction: z.boolean(),
  exactTargets: z.boolean(),
  ambiguous: z.boolean(),
  unknowns: z.array(z.string().min(1)).default([]),
  observedAt: z.string().min(1)
}).strict();

export const AuthorizationDecisionSchema = z.object({
  schemaVersion: z.literal("authorization-decision.v1").default(
    "authorization-decision.v1"
  ),
  decisionId: z.string().min(1),
  subjectId: z.string().min(1),
  surface: z.enum(["desktop", "provider", "codex_app_server", "codex_sdk"]),
  factsHash: Sha256Schema,
  semanticRisk: GovernanceRiskLevelSchema,
  factualRisk: GovernanceRiskLevelSchema,
  effectiveRisk: GovernanceRiskLevelSchema,
  requestedCapabilities: z.array(z.lazy(() => CapabilityScopeSchema)).default([]),
  authorizedCapabilities: z.array(z.lazy(() => CapabilityScopeSchema)).default([]),
  approvalMode: ApprovalModeSchema,
  disposition: AuthorizationDispositionSchema,
  approvalRequired: z.boolean(),
  reasons: z.array(z.string().min(1)).default([]),
  createdAt: z.string().min(1)
}).strict().superRefine((decision, ctx) => {
  const riskRank: Record<z.infer<typeof GovernanceRiskLevelSchema>, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3
  };
  const expectedEffectiveRisk = riskRank[decision.semanticRisk] >= riskRank[decision.factualRisk]
    ? decision.semanticRisk
    : decision.factualRisk;
  if (decision.effectiveRisk !== expectedEffectiveRisk) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "effective risk must equal the maximum semantic and factual risk",
      path: ["effectiveRisk"]
    });
  }

  const expectedApprovalRequired = decision.approvalMode !== "not_required";
  if (decision.approvalRequired !== expectedApprovalRequired) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "approvalRequired must agree with approvalMode",
      path: ["approvalRequired"]
    });
  }
  if (
    (decision.disposition === "authorized")
      !== (decision.approvalMode === "not_required" && !decision.approvalRequired)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "authorized disposition is only valid when approval is not required",
      path: ["disposition"]
    });
  }
  if (
    decision.disposition === "approval_required"
    && !decision.approvalRequired
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "approval_required disposition requires approval",
      path: ["disposition"]
    });
  }
  if (decision.disposition === "blocked" && decision.approvalMode !== "human_required") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "blocked decisions must remain human-governed",
      path: ["approvalMode"]
    });
  }
  if (
    (decision.effectiveRisk === "high" || decision.effectiveRisk === "critical")
    && (
      decision.approvalMode !== "human_required"
      || decision.approvalRequired !== true
      || decision.disposition === "authorized"
    )
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "high and critical risk decisions require human approval",
      path: ["approvalMode"]
    });
  }

  for (const [index, scope] of decision.authorizedCapabilities.entries()) {
    if (!decision.requestedCapabilities.some((requested) => sameCapabilityScope(requested, scope))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "authorized capabilities must be a subset of requested capabilities",
        path: ["authorizedCapabilities", index]
      });
    }
  }
});

export const ExactArgvCommandSchema = z.object({
  argv: NonEmptyArgvSchema,
  timeoutMs: z.number().int().positive().max(30 * 60 * 1000).default(5 * 60 * 1000)
}).strict().superRefine((command, ctx) => {
  for (const [index, argument] of command.argv.entries()) {
    if (argument.includes("\0") || argument.includes("\r") || argument.includes("\n")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "exact argv entries cannot contain control separators",
        path: ["argv", index]
      });
    }
  }
  const executable = command.argv[0]?.replace(/\\/g, "/").split("/").at(-1)?.toLowerCase();
  if (executable !== undefined && SHELL_EXECUTABLES.has(executable)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "shell interpreters are not permitted in auto-approval commands",
      path: ["argv", 0]
    });
  }
});

export const AutoApprovalRuleSchema = z.object({
  ruleId: z.string().min(1),
  allowedPaths: z.array(z.string().min(1)).min(1),
  operations: z.array(z.enum(["create", "update"])).min(1),
  maxFiles: z.number().int().positive(),
  maxDiffLines: z.number().int().positive(),
  prepare: z.array(ExactArgvCommandSchema).default([]),
  checks: z.array(ExactArgvCommandSchema).min(1)
}).strict();

export const PreviewPolicySchema = z.object({
  schemaVersion: z.literal("preview-policy.v1").default("preview-policy.v1"),
  autoApprovalRules: z.array(AutoApprovalRuleSchema).default([])
}).strict();

export const PreviewCheckReceiptSchema = z.object({
  phase: z.enum(["prepare", "check"]),
  argvHash: Sha256Schema,
  status: z.enum(["passed", "failed", "timed_out", "spawn_failed"]),
  exitCode: z.number().int().nullable(),
  durationMs: z.number().int().nonnegative()
}).strict();

export const PreviewReceiptSchema = z.object({
  schemaVersion: z.literal("preview-receipt.v1").default("preview-receipt.v1"),
  receiptId: z.string().min(1),
  changeSetHash: Sha256Schema,
  headCommit: z.string().min(1),
  ruleId: z.string().min(1).optional(),
  status: z.enum(["preview_passed", "blocked"]),
  networkIsolation: z.enum(["enforced_none", "unsupported"]),
  filesystemIsolation: z.enum(["clone_only_enforced", "unsupported"]),
  isolationScope: z.enum(["test_only", "live"]),
  isolationEnforcerId: z.string().min(1),
  checks: z.array(PreviewCheckReceiptSchema).default([]),
  cleanupStatus: z.enum(["passed", "failed", "not_created"]),
  reasons: z.array(z.string().min(1)).default([]),
  createdAt: z.string().min(1)
}).strict();

export const RetainPermitSchema = z.object({
  schemaVersion: z.literal("retain-permit.v1").default("retain-permit.v1"),
  permitId: z.string().min(1),
  changeSetHash: Sha256Schema,
  authorizationDecisionHash: Sha256Schema,
  previewReceiptHash: Sha256Schema.optional(),
  approvalMode: z.enum(["policy_auto", "human_required"]),
  headCommit: z.string().min(1),
  targetFiles: z.array(z.string().min(1)).min(1),
  issuedAt: z.string().min(1),
  expiresAt: z.string().min(1),
  nonceHash: Sha256Schema
}).strict();

export const RetainTargetHashSchema = z.object({
  path: z.string().min(1),
  beforeHash: Sha256Schema.nullable(),
  afterHash: Sha256Schema
}).strict();

export const RetainReceiptSchema = z.object({
  schemaVersion: z.literal("retain-receipt.v1").default("retain-receipt.v1"),
  receiptId: z.string().min(1),
  permitId: z.string().min(1),
  changeSetHash: Sha256Schema,
  previewReceiptHash: Sha256Schema.optional(),
  headCommit: z.string().min(1),
  repositoryIdentityHash: Sha256Schema,
  targetHashes: z.array(RetainTargetHashSchema).min(1),
  noOutsideTargetChanges: z.literal(true),
  retainedAt: z.string().min(1)
}).strict();

export const RollbackPermitSchema = z.object({
  schemaVersion: z.literal("rollback-permit.v1").default("rollback-permit.v1"),
  permitId: z.string().min(1),
  receiptId: z.string().min(1),
  receiptHash: Sha256Schema,
  operatorId: z.string().min(1),
  expectedHead: z.string().min(1),
  targetFiles: z.array(z.string().min(1)).min(1),
  issuedAt: z.string().min(1),
  expiresAt: z.string().min(1),
  nonceHash: Sha256Schema
}).strict();

export const FileChangeLifecycleStateSchema = z.enum([
  "proposed",
  "policy_checked",
  "previewing",
  "preview_passed",
  "awaiting_approval",
  "auto_approved",
  "accepted_by_app_server",
  "retained",
  "post_checked",
  "blocked",
  "reconciliation_required",
  "rollback_available"
]);

export type GovernanceRiskLevel = z.infer<typeof GovernanceRiskLevelSchema>;
export type ApprovalMode = z.infer<typeof ApprovalModeSchema>;
export type AuthorizationDisposition = z.infer<typeof AuthorizationDispositionSchema>;
export type GovernedFileChangeKind = z.infer<typeof GovernedFileChangeKindSchema>;
export type GovernedFileChange = z.infer<typeof GovernedFileChangeSchema>;
export type GovernedFileChangeSet = z.infer<typeof GovernedFileChangeSetSchema>;
export type CapabilityFactCommand = z.infer<typeof CapabilityFactCommandSchema>;
export type CapabilityFacts = z.infer<typeof CapabilityFactsSchema>;
export type AuthorizationDecision = z.infer<typeof AuthorizationDecisionSchema>;
export type ExactArgvCommand = z.infer<typeof ExactArgvCommandSchema>;
export type AutoApprovalRule = z.infer<typeof AutoApprovalRuleSchema>;
export type PreviewPolicy = z.infer<typeof PreviewPolicySchema>;
export type PreviewCheckReceipt = z.infer<typeof PreviewCheckReceiptSchema>;
export type PreviewReceipt = z.infer<typeof PreviewReceiptSchema>;
export type RetainPermit = z.infer<typeof RetainPermitSchema>;
export type RetainTargetHash = z.infer<typeof RetainTargetHashSchema>;
export type RetainReceipt = z.infer<typeof RetainReceiptSchema>;
export type RollbackPermit = z.infer<typeof RollbackPermitSchema>;
export type FileChangeLifecycleState = z.infer<typeof FileChangeLifecycleStateSchema>;

function sameCapabilityScope(left: CapabilityScope, right: CapabilityScope): boolean {
  return left.kind === right.kind
    && left.resource === right.resource
    && left.access === right.access
    && stableValue(left.constraints) === stableValue(right.constraints);
}

function stableValue(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableValue).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${stableValue(record[key])}`
  )).join(",")}}`;
}
