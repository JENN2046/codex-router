import { createHash } from "node:crypto";
import { z } from "zod";
import { redactText } from "../../redaction/src/index.js";
import {
  WorkspaceWriteProviderExecutionPermitSchema,
  type WorkspaceWriteProviderExecutionPermit
} from "../../provider-core/src/index.js";

export const WorkspaceWriteDiffFileSummarySchema = z.object({
  path: z.string().min(1),
  addedLines: z.number().int().nonnegative(),
  removedLines: z.number().int().nonnegative(),
  changedLines: z.number().int().nonnegative()
});

export const WorkspaceWriteDiffInspectionSchema = z.object({
  patchHash: z.string().regex(/^[a-f0-9]{64}$/),
  changedFiles: z.array(WorkspaceWriteDiffFileSummarySchema),
  changedFileCount: z.number().int().nonnegative(),
  diffLineCount: z.number().int().nonnegative(),
  secretMarkerCount: z.number().int().nonnegative()
});

export const WorkspaceWritePatchGuardResultSchema = z.object({
  ok: z.boolean(),
  status: z.enum(["passed", "blocked"]),
  reasons: z.array(z.string()),
  summary: z.object({
    patchHash: z.string().regex(/^[a-f0-9]{64}$/),
    changedFileCount: z.number().int().nonnegative(),
    diffLineCount: z.number().int().nonnegative(),
    secretMarkerCount: z.number().int().nonnegative(),
    maxChangedFiles: z.number().int().positive(),
    maxDiffLines: z.number().int().positive(),
    targetFiles: z.array(z.string()),
    changedFiles: z.array(WorkspaceWriteDiffFileSummarySchema)
  })
});

export const WorkspaceWriteRollbackPlanEvidenceSchema = z.object({
  schemaVersion: z.literal("workspace-write-rollback-plan-evidence.v1").default(
    "workspace-write-rollback-plan-evidence.v1"
  ),
  generatedAt: z.string().min(1),
  status: z.enum(["ready", "blocked"]),
  permit: z.object({
    permitId: z.string().min(1),
    providerId: z.string().min(1),
    taskId: z.string().min(1),
    runId: z.string().min(1).optional(),
    planId: z.string().min(1).optional(),
    status: z.enum(["candidate", "approved", "blocked"]),
    sideEffectClass: z.literal("workspace_write"),
    sandboxMode: z.literal("workspace-write")
  }),
  beforeCommit: z.string().min(1).optional(),
  patchHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  changedFiles: z.array(WorkspaceWriteDiffFileSummarySchema),
  rollback: z.object({
    required: z.boolean(),
    available: z.boolean(),
    command: z.string().min(1).optional(),
    affectedFiles: z.array(z.string()),
    strategy: z.string().min(1)
  }),
  checks: z.object({
    permitApproved: z.boolean(),
    guardPassed: z.boolean(),
    beforeCommitRecorded: z.boolean(),
    patchHashRecorded: z.boolean(),
    changedFilesRecorded: z.boolean(),
    rollbackCommandRecorded: z.boolean(),
    noRawPatch: z.literal(true)
  }),
  blockingReasons: z.array(z.string())
});

export type WorkspaceWriteDiffFileSummary = z.infer<typeof WorkspaceWriteDiffFileSummarySchema>;
export type WorkspaceWriteDiffInspection = z.infer<typeof WorkspaceWriteDiffInspectionSchema>;
export type WorkspaceWritePatchGuardResult = z.infer<typeof WorkspaceWritePatchGuardResultSchema>;
export type WorkspaceWriteRollbackPlanEvidence = z.infer<
  typeof WorkspaceWriteRollbackPlanEvidenceSchema
>;

export type WorkspaceWritePatchGuardInput = {
  permit: WorkspaceWriteProviderExecutionPermit;
  unifiedDiff: string;
};

export type WorkspaceWriteRollbackPlanEvidenceInput = {
  permit: WorkspaceWriteProviderExecutionPermit;
  guardResult: WorkspaceWritePatchGuardResult;
  beforeCommit?: string;
  generatedAt: string;
};

export function inspectWorkspaceWriteUnifiedDiff(unifiedDiff: string): WorkspaceWriteDiffInspection {
  const patchHash = createHash("sha256").update(unifiedDiff).digest("hex");
  const files = new Map<string, WorkspaceWriteDiffFileSummary>();
  let currentPath: string | undefined;
  let secretMarkerCount = 0;

  for (const line of unifiedDiff.replace(/\r\n/g, "\n").split("\n")) {
    const diffPath = readDiffGitPath(line) ?? readDiffHeaderPath(line);
    if (diffPath !== undefined) {
      currentPath = diffPath;
      ensureDiffFile(files, currentPath);
      continue;
    }

    if (currentPath === undefined) {
      if (lineHasSecretLikeContent(line)) {
        secretMarkerCount += 1;
      }
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      const summary = ensureDiffFile(files, currentPath);
      summary.addedLines += 1;
      summary.changedLines += 1;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      const summary = ensureDiffFile(files, currentPath);
      summary.removedLines += 1;
      summary.changedLines += 1;
    }

    if (lineHasSecretLikeContent(line)) {
      secretMarkerCount += 1;
    }
  }

  const changedFiles = [...files.values()]
    .filter((file) => file.changedLines > 0)
    .sort((left, right) => left.path.localeCompare(right.path));
  const diffLineCount = changedFiles.reduce((sum, file) => sum + file.changedLines, 0);

  return WorkspaceWriteDiffInspectionSchema.parse({
    patchHash,
    changedFiles,
    changedFileCount: changedFiles.length,
    diffLineCount,
    secretMarkerCount
  });
}

export function evaluateWorkspaceWritePatchGuard(
  input: WorkspaceWritePatchGuardInput
): WorkspaceWritePatchGuardResult {
  const permit = WorkspaceWriteProviderExecutionPermitSchema.parse(input.permit);
  const inspection = inspectWorkspaceWriteUnifiedDiff(input.unifiedDiff);
  const reasons: string[] = [];
  const permittedTargets = new Set(permit.targetFiles);

  if (permit.status !== "approved") {
    reasons.push(`workspace_write_patch_guard_permit_not_approved:${permit.status}`);
  }

  if (inspection.changedFileCount === 0) {
    reasons.push("workspace_write_patch_guard_changed_files_required");
  }

  if (inspection.changedFileCount > permit.maxChangedFiles) {
    reasons.push("workspace_write_patch_guard_changed_files_exceed_max");
  }

  if (inspection.diffLineCount > permit.maxDiffLines) {
    reasons.push("workspace_write_patch_guard_diff_lines_exceed_max");
  }

  for (const file of inspection.changedFiles) {
    if (!isSafeWorkspaceRelativeFilePath(file.path)) {
      reasons.push("workspace_write_patch_guard_changed_file_out_of_bounds");
    }

    if (!permittedTargets.has(file.path)) {
      reasons.push(`workspace_write_patch_guard_changed_file_not_permitted:${file.path}`);
    }
  }

  if (inspection.secretMarkerCount > 0) {
    reasons.push("workspace_write_patch_guard_secret_like_content");
  }

  const uniqueReasons = uniqueStrings(reasons);

  return WorkspaceWritePatchGuardResultSchema.parse({
    ok: uniqueReasons.length === 0,
    status: uniqueReasons.length === 0 ? "passed" : "blocked",
    reasons: uniqueReasons,
    summary: {
      patchHash: inspection.patchHash,
      changedFileCount: inspection.changedFileCount,
      diffLineCount: inspection.diffLineCount,
      secretMarkerCount: inspection.secretMarkerCount,
      maxChangedFiles: permit.maxChangedFiles,
      maxDiffLines: permit.maxDiffLines,
      targetFiles: [...permit.targetFiles],
      changedFiles: inspection.changedFiles
    }
  });
}

export function createWorkspaceWriteRollbackPlanEvidence(
  input: WorkspaceWriteRollbackPlanEvidenceInput
): WorkspaceWriteRollbackPlanEvidence {
  const permit = WorkspaceWriteProviderExecutionPermitSchema.parse(input.permit);
  const guardResult = WorkspaceWritePatchGuardResultSchema.parse(input.guardResult);
  const beforeCommit = normalizeOptionalString(input.beforeCommit);
  const changedFiles = guardResult.summary.changedFiles;
  const affectedFiles = changedFiles.map((file) => file.path);
  const reasons = [
    ...(permit.status === "approved"
      ? []
      : [`workspace_write_rollback_plan_permit_not_approved:${permit.status}`]),
    ...(guardResult.ok
      ? []
      : ["workspace_write_rollback_plan_guard_not_passed", ...guardResult.reasons]),
    ...(beforeCommit !== undefined
      ? []
      : ["workspace_write_rollback_plan_before_commit_required"]),
    ...(guardResult.summary.patchHash.length > 0
      ? []
      : ["workspace_write_rollback_plan_patch_hash_required"]),
    ...(changedFiles.length > 0
      ? []
      : ["workspace_write_rollback_plan_changed_files_required"]),
    ...(permit.rollbackRequired
      ? []
      : ["workspace_write_rollback_plan_rollback_required"])
  ];
  const uniqueReasons = uniqueStrings(reasons);
  const command = beforeCommit === undefined || affectedFiles.length === 0
    ? undefined
    : createGitRestoreRollbackCommand(beforeCommit, affectedFiles);

  return WorkspaceWriteRollbackPlanEvidenceSchema.parse({
    schemaVersion: "workspace-write-rollback-plan-evidence.v1",
    generatedAt: input.generatedAt,
    status: uniqueReasons.length === 0 ? "ready" : "blocked",
    permit: {
      permitId: permit.permitId,
      providerId: permit.providerId,
      taskId: permit.taskId,
      ...(permit.runId !== undefined ? { runId: permit.runId } : {}),
      ...(permit.planId !== undefined ? { planId: permit.planId } : {}),
      status: permit.status,
      sideEffectClass: permit.sideEffectClass,
      sandboxMode: permit.sandboxMode
    },
    ...(beforeCommit !== undefined ? { beforeCommit } : {}),
    patchHash: guardResult.summary.patchHash,
    changedFiles,
    rollback: {
      required: permit.rollbackRequired,
      available: uniqueReasons.length === 0,
      ...(command !== undefined ? { command } : {}),
      affectedFiles,
      strategy: "Restore affected files from the recorded beforeCommit without moving branches or touching remote state."
    },
    checks: {
      permitApproved: permit.status === "approved",
      guardPassed: guardResult.ok,
      beforeCommitRecorded: beforeCommit !== undefined,
      patchHashRecorded: guardResult.summary.patchHash.length > 0,
      changedFilesRecorded: changedFiles.length > 0,
      rollbackCommandRecorded: command !== undefined,
      noRawPatch: true
    },
    blockingReasons: uniqueReasons
  });
}

function ensureDiffFile(
  files: Map<string, WorkspaceWriteDiffFileSummary>,
  path: string
): WorkspaceWriteDiffFileSummary {
  const existing = files.get(path);
  if (existing !== undefined) {
    return existing;
  }

  const summary: WorkspaceWriteDiffFileSummary = {
    path,
    addedLines: 0,
    removedLines: 0,
    changedLines: 0
  };
  files.set(path, summary);
  return summary;
}

function readDiffGitPath(line: string): string | undefined {
  const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
  return match?.[2] === undefined ? undefined : normalizeDiffPath(match[2]);
}

function readDiffHeaderPath(line: string): string | undefined {
  const match = /^\+\+\+ (.+)$/.exec(line);
  const rawPath = match?.[1];
  if (rawPath === undefined || rawPath === "/dev/null") {
    return undefined;
  }

  return normalizeDiffPath(rawPath);
}

function normalizeDiffPath(path: string): string | undefined {
  const unquoted = path.replace(/^"|"$/g, "");
  const withoutPrefix = unquoted.startsWith("a/") || unquoted.startsWith("b/")
    ? unquoted.slice(2)
    : unquoted;
  return withoutPrefix.length === 0 ? undefined : withoutPrefix.replace(/\\/g, "/");
}

function lineHasSecretLikeContent(line: string): boolean {
  return redactText(line) !== line;
}

function createGitRestoreRollbackCommand(beforeCommit: string, affectedFiles: string[]): string {
  return [
    "git",
    "restore",
    "--source",
    beforeCommit,
    "--",
    ...affectedFiles
  ].map(quoteCommandToken).join(" ");
}

function quoteCommandToken(token: string): string {
  if (/^[A-Za-z0-9_./:@-]+$/.test(token)) {
    return token;
  }

  return `"${token.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function isSafeWorkspaceRelativeFilePath(path: string): boolean {
  const slashPath = path.replace(/\\/g, "/");

  if (
    slashPath.length === 0
    || slashPath.startsWith("/")
    || /^[a-zA-Z]:/.test(slashPath)
    || slashPath.endsWith("/")
  ) {
    return false;
  }

  const parts = slashPath.split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
