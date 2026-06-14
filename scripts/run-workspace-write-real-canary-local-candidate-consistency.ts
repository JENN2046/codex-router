#!/usr/bin/env node

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import {
  DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
  PR_12B_REAL_CANARY_ALLOWED_ACTION,
  PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
  PR_12B_REAL_CANARY_WORKSPACE
} from "../packages/workspace-write-guard/src/index.js";
import {
  WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_AUDIT_COMMANDS,
  formatWorkspaceWriteRealCanaryFinalLocalAuditResult,
  type WorkspaceWriteRealCanaryFinalLocalAuditResult
} from "./run-workspace-write-real-canary-final-local-audit.js";

const execFileAsync = promisify(execFile);

const REQUIRED_RANGE_FILES = [
  "packages/workspace-write-guard/src/index.ts",
  "tests/workspace-write-guard.test.ts",
  "scripts/run-workspace-write-real-canary-authorization-acceptance.ts",
  "scripts/run-workspace-write-real-canary-pre-execution-acceptance.ts",
  "scripts/run-workspace-write-real-canary-sensitive-scan.ts",
  "tests/workspace-write-real-canary-authorization-acceptance.test.ts",
  "tests/workspace-write-real-canary-pre-execution-acceptance.test.ts",
  "tests/workspace-write-real-canary-sensitive-scan.test.ts",
  "docs/evidence/workspace-write-real-canary-authorization-acceptance.json",
  "docs/evidence/workspace-write-real-canary-pre-execution-acceptance.json",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_AUTHORIZATION_LOCAL_CLOSEOUT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_AUTHORIZATION_PACKET_COMPATIBILITY.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_PRE_EXECUTION_LOCAL_CLOSEOUT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_PRE_EXECUTION_BOUNDARY_AUDIT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_CANDIDATE_REVIEW_RECEIPT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_AUDIT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_LOCAL_AUDIT_INDEX.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_RC_RECEIPT.md",
  "package.json"
] as const;

const ALLOWED_RANGE_FILES = new Set<string>([
  ...REQUIRED_RANGE_FILES,
  "scripts/run-workspace-write-real-canary-local-candidate-consistency.ts",
  "scripts/run-workspace-write-real-canary-final-local-audit.ts",
  "tests/workspace-write-real-canary-local-candidate-consistency.test.ts",
  "tests/workspace-write-real-canary-final-local-audit.test.ts"
]);

const REQUIRED_DOC_FILES = [
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_AUTHORIZATION_LOCAL_CLOSEOUT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_AUTHORIZATION_PACKET_COMPATIBILITY.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_PRE_EXECUTION_LOCAL_CLOSEOUT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_PRE_EXECUTION_BOUNDARY_AUDIT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_CANDIDATE_REVIEW_RECEIPT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_AUDIT.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_LOCAL_AUDIT_INDEX.md",
  "docs/governance/PR_12B_WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_RC_RECEIPT.md"
] as const;

const FORBIDDEN_MARKERS = [
  PR_12B_REAL_CANARY_AUTHORIZATION_PHRASE,
  PR_12B_REAL_CANARY_WORKSPACE,
  PR_12B_REAL_CANARY_ALLOWED_ACTION,
  "requestedAction",
  "prompt",
  "args",
  "stdout",
  "stderr",
  "raw command",
  "raw task envelope",
  "raw env",
  "raw token",
  "raw patch",
  "OPENAI_API_KEY",
  "sk-",
  "Bearer",
  "APPROVE_WORKSPACE_WRITE",
  "canary=ready"
] as const;

export interface WorkspaceWriteRealCanaryLocalCandidateConsistencyInput {
  gitStatusShort: string;
  branch: string;
  ahead: number;
  behind: number;
  changedFiles: string[];
  packageJsonText: string;
  authorizationEvidenceText: string;
  preExecutionEvidenceText: string;
  governanceDocs: Record<string, string>;
  canaryFileExists: boolean;
}

export interface WorkspaceWriteRealCanaryLocalCandidateConsistencyResult {
  status: "passed" | "blocked";
  checks: {
    worktreeClean: boolean;
    branchMain: boolean;
    localAheadOnly: boolean;
    requiredRangeFilesPresent: boolean;
    changedFilesWithinPr12bScope: boolean;
    packageScriptsPresent: boolean;
    evidenceParseable: boolean;
    evidenceLocalOnly: boolean;
    evidenceNoExecution: boolean;
    evidenceSanitized: boolean;
    governanceDocsNonAuthorizing: boolean;
    finalAuditJsonContractValid: boolean;
    canaryFileAbsent: boolean;
  };
  summary: {
    branch: string;
    ahead: number;
    behind: number;
    changedFileCount: number;
    unexpectedChangedFileCount: number;
    canaryTargetFile: string;
    providerExecuteCalls: number;
    realCodexCliCalls: number;
    workspaceWriteExecuteCalls: number;
    canaryFileWrites: number;
  };
  reasons: string[];
}

export type WorkspaceWriteRealCanaryLocalCandidateConsistencyOutputFormat =
  | "text"
  | "json";

export async function collectWorkspaceWriteRealCanaryLocalCandidateConsistencyInput(
  cwd = process.cwd()
): Promise<WorkspaceWriteRealCanaryLocalCandidateConsistencyInput> {
  const [gitStatusShort, branch, aheadBehindRaw, changedFilesRaw] = await Promise.all([
    git(["status", "--short"], cwd),
    git(["branch", "--show-current"], cwd),
    git(["rev-list", "--left-right", "--count", "HEAD...origin/main"], cwd),
    git(["diff", "--name-only", "origin/main..HEAD"], cwd)
  ]);
  const [aheadRaw, behindRaw] = aheadBehindRaw.trim().split(/\s+/);
  const ahead = Number.parseInt(aheadRaw ?? "0", 10);
  const behind = Number.parseInt(behindRaw ?? "0", 10);

  return {
    gitStatusShort,
    branch: branch.trim(),
    ahead,
    behind,
    changedFiles: normalizeLines(changedFilesRaw),
    packageJsonText: await readFile(join(cwd, "package.json"), "utf8"),
    authorizationEvidenceText: await readFile(
      join(cwd, "docs/evidence/workspace-write-real-canary-authorization-acceptance.json"),
      "utf8"
    ),
    preExecutionEvidenceText: await readFile(
      join(cwd, "docs/evidence/workspace-write-real-canary-pre-execution-acceptance.json"),
      "utf8"
    ),
    governanceDocs: await readGovernanceDocs(cwd),
    canaryFileExists: existsSync(join(cwd, DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE))
  };
}

export function reviewWorkspaceWriteRealCanaryLocalCandidateConsistency(
  input: WorkspaceWriteRealCanaryLocalCandidateConsistencyInput
): WorkspaceWriteRealCanaryLocalCandidateConsistencyResult {
  const reasons: string[] = [];
  const packageJson = parseObject(input.packageJsonText);
  const authorizationEvidence = parseObject(input.authorizationEvidenceText);
  const preExecutionEvidence = parseObject(input.preExecutionEvidenceText);

  const checks = {
    worktreeClean: input.gitStatusShort.trim() === "",
    branchMain: input.branch === "main",
    localAheadOnly: input.ahead > 0 && input.behind === 0,
    requiredRangeFilesPresent: REQUIRED_RANGE_FILES.every((file) =>
      input.changedFiles.includes(file)
    ),
    changedFilesWithinPr12bScope: input.changedFiles.every((file) =>
      ALLOWED_RANGE_FILES.has(file)
    ),
    packageScriptsPresent: hasPackageScript(
      packageJson,
      "acceptance:workspace-write-real-canary-auth"
    ) && hasPackageScript(
      packageJson,
      "acceptance:workspace-write-real-canary-pre-execution"
    ) && hasPackageScript(
      packageJson,
      "audit:workspace-write-real-canary-sensitive-scan"
    ),
    evidenceParseable: authorizationEvidence !== undefined && preExecutionEvidence !== undefined,
    evidenceLocalOnly: getString(authorizationEvidence, ["mode"])
      === "workspace-write-real-canary-authorization-local-only"
      && getString(preExecutionEvidence, ["mode"])
      === "workspace-write-real-canary-pre-execution-local-only",
    evidenceNoExecution: evidenceHasNoExecution(authorizationEvidence)
      && evidenceHasNoExecution(preExecutionEvidence),
    evidenceSanitized: !containsForbiddenMarker(input.authorizationEvidenceText)
      && !containsForbiddenMarker(input.preExecutionEvidenceText),
    governanceDocsNonAuthorizing: governanceDocsAreNonAuthorizing(input.governanceDocs),
    finalAuditJsonContractValid: finalAuditJsonContractIsValid(),
    canaryFileAbsent: !input.canaryFileExists
  };

  addReasonIfFalse(reasons, checks.worktreeClean, "workspace_write_real_canary_candidate_worktree_dirty");
  addReasonIfFalse(reasons, checks.branchMain, "workspace_write_real_canary_candidate_branch_not_main");
  addReasonIfFalse(reasons, checks.localAheadOnly, "workspace_write_real_canary_candidate_not_local_ahead_only");
  addReasonIfFalse(
    reasons,
    checks.requiredRangeFilesPresent,
    "workspace_write_real_canary_candidate_required_files_missing"
  );
  addReasonIfFalse(
    reasons,
    checks.changedFilesWithinPr12bScope,
    "workspace_write_real_canary_candidate_unexpected_files"
  );
  addReasonIfFalse(
    reasons,
    checks.packageScriptsPresent,
    "workspace_write_real_canary_candidate_acceptance_scripts_missing"
  );
  addReasonIfFalse(reasons, checks.evidenceParseable, "workspace_write_real_canary_candidate_evidence_invalid");
  addReasonIfFalse(
    reasons,
    checks.evidenceLocalOnly,
    "workspace_write_real_canary_candidate_evidence_not_local_only"
  );
  addReasonIfFalse(
    reasons,
    checks.evidenceNoExecution,
    "workspace_write_real_canary_candidate_execution_counter_nonzero"
  );
  addReasonIfFalse(
    reasons,
    checks.evidenceSanitized,
    "workspace_write_real_canary_candidate_evidence_leak_marker"
  );
  addReasonIfFalse(
    reasons,
    checks.governanceDocsNonAuthorizing,
    "workspace_write_real_canary_candidate_docs_authorize_execution"
  );
  addReasonIfFalse(
    reasons,
    checks.finalAuditJsonContractValid,
    "workspace_write_real_canary_candidate_final_audit_json_contract_invalid"
  );
  addReasonIfFalse(
    reasons,
    checks.canaryFileAbsent,
    "workspace_write_real_canary_candidate_canary_file_exists"
  );

  const executionCounters = mergeExecutionCounters(authorizationEvidence, preExecutionEvidence);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      branch: input.branch,
      ahead: input.ahead,
      behind: input.behind,
      changedFileCount: input.changedFiles.length,
      unexpectedChangedFileCount: input.changedFiles.filter((file) =>
        !ALLOWED_RANGE_FILES.has(file)
      ).length,
      canaryTargetFile: DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
      ...executionCounters
    },
    reasons
  };
}

export function formatWorkspaceWriteRealCanaryLocalCandidateConsistencyReview(
  review: WorkspaceWriteRealCanaryLocalCandidateConsistencyResult,
  format: WorkspaceWriteRealCanaryLocalCandidateConsistencyOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Workspace-write real canary local candidate consistency",
    `status: ${review.status}`,
    `branch: ${review.summary.branch}`,
    `ahead / behind: ${review.summary.ahead} / ${review.summary.behind}`,
    `changed files: ${review.summary.changedFileCount}`,
    `unexpected changed files: ${review.summary.unexpectedChangedFileCount}`,
    `provider execute calls: ${review.summary.providerExecuteCalls}`,
    `real Codex CLI calls: ${review.summary.realCodexCliCalls}`,
    `workspace-write execute calls: ${review.summary.workspaceWriteExecuteCalls}`,
    `canary file writes: ${review.summary.canaryFileWrites}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function readGovernanceDocs(cwd: string): Promise<Record<string, string>> {
  const entries = await Promise.all(
    REQUIRED_DOC_FILES.map(async (file) => [file, await readFile(join(cwd, file), "utf8")] as const)
  );

  return Object.fromEntries(entries);
}

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });

  return stdout;
}

function normalizeLines(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function parseObject(value: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function hasPackageScript(
  packageJson: Record<string, unknown> | undefined,
  scriptName: string
): boolean {
  const scripts = packageJson?.scripts;
  return isRecord(scripts) && typeof scripts[scriptName] === "string";
}

function evidenceHasNoExecution(evidence: Record<string, unknown> | undefined): boolean {
  return getBoolean(evidence, ["checks", "noProviderExecute"]) === true
    && getBoolean(evidence, ["checks", "noRealCodexCli"]) === true
    && getBoolean(evidence, ["checks", "noWorkspaceWriteExecute"]) === true
    && getBoolean(evidence, ["checks", "noCanaryFileWrite"]) === true
    && getNumber(evidence, ["counters", "providerExecuteCalls"]) === 0
    && getNumber(evidence, ["counters", "realCodexCliCalls"]) === 0
    && getNumber(evidence, ["counters", "workspaceWriteExecuteCalls"]) === 0
    && getNumber(evidence, ["counters", "canaryFileWrites"]) === 0;
}

function mergeExecutionCounters(
  authorizationEvidence: Record<string, unknown> | undefined,
  preExecutionEvidence: Record<string, unknown> | undefined
) {
  return {
    providerExecuteCalls: Math.max(
      getNumber(authorizationEvidence, ["counters", "providerExecuteCalls"]) ?? -1,
      getNumber(preExecutionEvidence, ["counters", "providerExecuteCalls"]) ?? -1
    ),
    realCodexCliCalls: Math.max(
      getNumber(authorizationEvidence, ["counters", "realCodexCliCalls"]) ?? -1,
      getNumber(preExecutionEvidence, ["counters", "realCodexCliCalls"]) ?? -1
    ),
    workspaceWriteExecuteCalls: Math.max(
      getNumber(authorizationEvidence, ["counters", "workspaceWriteExecuteCalls"]) ?? -1,
      getNumber(preExecutionEvidence, ["counters", "workspaceWriteExecuteCalls"]) ?? -1
    ),
    canaryFileWrites: Math.max(
      getNumber(authorizationEvidence, ["counters", "canaryFileWrites"]) ?? -1,
      getNumber(preExecutionEvidence, ["counters", "canaryFileWrites"]) ?? -1
    )
  };
}

function containsForbiddenMarker(value: string): boolean {
  return FORBIDDEN_MARKERS.some((marker) => value.includes(marker));
}

function governanceDocsAreNonAuthorizing(governanceDocs: Record<string, string>): boolean {
  return REQUIRED_DOC_FILES.every((file) => {
    const text = governanceDocs[file];

    return text !== undefined
      && hasNonAuthorizationStatement(text)
      && deniesRealCodexCli(text)
      && deniesWorkspaceWriteExecute(text)
      && deniesCanaryFileWrite(text);
  });
}

function finalAuditJsonContractIsValid(): boolean {
  const result: WorkspaceWriteRealCanaryFinalLocalAuditResult = {
    status: "passed",
    checks: {
      allCommandsPassed: true,
      canaryFileAbsent: true,
      noWorkspaceWriteExecute: true,
      noRealCodexCli: true,
      noProviderExecute: true
    },
    commands: WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_AUDIT_COMMANDS.map((command) => ({
      id: command.id,
      status: "passed" as const,
      exitCode: 0
    })),
    summary: {
      commandCount: WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_AUDIT_COMMANDS.length,
      failedCommandCount: 0,
      canaryTargetFile: DEFAULT_WORKSPACE_WRITE_CANARY_TARGET_FILE,
      workspaceWriteExecuteCalls: 0,
      realCodexCliCalls: 0,
      providerExecuteCalls: 0
    },
    reasons: []
  };
  const output = formatWorkspaceWriteRealCanaryFinalLocalAuditResult(result, "json");
  const parsed = parseObject(output);
  const commands = Array.isArray(parsed?.commands) ? parsed.commands : [];

  return parsed !== undefined
    && getString(parsed, ["status"]) === "passed"
    && getBoolean(parsed, ["checks", "canaryFileAbsent"]) === true
    && getBoolean(parsed, ["checks", "noWorkspaceWriteExecute"]) === true
    && getBoolean(parsed, ["checks", "noRealCodexCli"]) === true
    && getBoolean(parsed, ["checks", "noProviderExecute"]) === true
    && getNumber(parsed, ["summary", "commandCount"]) === WORKSPACE_WRITE_REAL_CANARY_FINAL_LOCAL_AUDIT_COMMANDS.length
    && getNumber(parsed, ["summary", "failedCommandCount"]) === 0
    && getNumber(parsed, ["summary", "workspaceWriteExecuteCalls"]) === 0
    && getNumber(parsed, ["summary", "realCodexCliCalls"]) === 0
    && getNumber(parsed, ["summary", "providerExecuteCalls"]) === 0
    && commands.every(commandResultHasOnlySanitizedFields)
    && !containsForbiddenMarker(output);
}

function commandResultHasOnlySanitizedFields(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const keys = Object.keys(value).sort();

  return keys.length === 3
    && keys[0] === "exitCode"
    && keys[1] === "id"
    && keys[2] === "status";
}

function hasNonAuthorizationStatement(text: string): boolean {
  return /does not authorize|does not implement, enable, or execute|does not cross into execution|changes no runtime behavior|pre-execution governance only/i.test(text);
}

function deniesRealCodexCli(text: string): boolean {
  return /real Codex CLI (?:call|invocation):? no/i.test(text)
    || /does not authorize:[\s\S]*real Codex CLI invocation/i.test(text);
}

function deniesWorkspaceWriteExecute(text: string): boolean {
  return /Workspace-write execute:? no/i.test(text)
    || /does not authorize:[\s\S]*workspace-write execute/i.test(text);
}

function deniesCanaryFileWrite(text: string): boolean {
  return /Canary file write:? no/i.test(text)
    || /does not authorize:[\s\S]*canary file write/i.test(text);
}

function getBoolean(
  value: Record<string, unknown> | undefined,
  path: string[]
): boolean | undefined {
  const found = getPath(value, path);
  return typeof found === "boolean" ? found : undefined;
}

function getNumber(
  value: Record<string, unknown> | undefined,
  path: string[]
): number | undefined {
  const found = getPath(value, path);
  return typeof found === "number" ? found : undefined;
}

function getString(
  value: Record<string, unknown> | undefined,
  path: string[]
): string | undefined {
  const found = getPath(value, path);
  return typeof found === "string" ? found : undefined;
}

function getPath(
  value: Record<string, unknown> | undefined,
  path: string[]
): unknown {
  let current: unknown = value;

  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addReasonIfFalse(reasons: string[], condition: boolean, reason: string): void {
  if (!condition) {
    reasons.push(reason);
  }
}

async function main(): Promise<void> {
  const input = await collectWorkspaceWriteRealCanaryLocalCandidateConsistencyInput();
  const review = reviewWorkspaceWriteRealCanaryLocalCandidateConsistency(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatWorkspaceWriteRealCanaryLocalCandidateConsistencyReview(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Workspace-write real canary local candidate consistency failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
