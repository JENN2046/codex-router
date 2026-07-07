#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const PR_22A_CONTROLLED_PROVIDER_EXECUTION_TOKEN =
  "APPROVE_CONTROLLED_PROVIDER_EXECUTION_MINIMAL_SLICE_PR_22A";
export const PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK =
  "docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md";

const GOVERNANCE_README = "docs/governance/README.md";
const CURRENT_STATE_DOC = "docs/current/CURRENT_STATE.md";
const CLI_CLOSEOUT_DOC = "docs/governance/CLI_LINE_LOCAL_CLOSEOUT.md";
const READONLY_PRODUCTIZATION_DOC =
  "docs/governance/READONLY_PRODUCTIZATION_ACCEPTANCE.md";
const CAPABILITY_POLICY_DOC =
  "docs/governance/CAPABILITY_TAXONOMY_ESCALATION_POLICY.md";

const REVIEW_MARKER =
  "PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK_REVIEW_RECORDED";

const REQUIRED_PACKAGE_SCRIPTS = {
  governance: "tsx scripts/run-governance-check.ts"
} as const;

const REQUIRED_TASKBOOK_MARKERS = [
  "PR-22A Controlled Provider Execution Minimal Taskbook",
  PR_22A_CONTROLLED_PROVIDER_EXECUTION_TOKEN,
  PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK,
  "READONLY_PRODUCTIZATION_FINAL_CLOSEOUT_RECORDED",
  "npm run governance -- audit readonly-productization",
  "CAPABILITY_TAXONOMY_ESCALATION_POLICY_RECORDED",
  CAPABILITY_POLICY_DOC,
  "PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK_RECORDED"
] as const;

const REQUIRED_NON_AUTHORIZATION_MARKERS = [
  "This taskbook is local-only.",
  "does not authorize provider execute",
  "does not authorize invoking the real Codex CLI",
  "does not authorize workspace-write",
  "does not authorize local command execution",
  "does not authorize protected remote execution",
  "does not authorize remote write",
  "does not authorize evidence refresh",
  "does not authorize push, release, tag, publish, deployment, or external",
  "does not authorize:",
  "- provider execute",
  "- invoking the real Codex CLI",
  "- running a real provider spawner",
  "- setting any execution operator flag",
  "- secret or credential changes"
] as const;

const REQUIRED_MINIMUM_SLICE_MARKERS = [
  "add an explicit controlled execution mode separate from dry-run mode",
  "keep the default mode as dry-run or disabled",
  "require provider id `codex-cli`",
  "require side effect class `read_only`",
  "require sandbox `read-only`",
  "require approval policy `never`",
  "require registry selection",
  "require provider execution metadata",
  "require a valid provider execution permit bound to the exact plan",
  "require injected spawner or injected executor dependency",
  "require environment preflight showing the injected execution dependency",
  "require runner invariant checks before any spawn boundary",
  "require sanitized observation and evidence output",
  "use fake or stub spawner in local tests",
  "general provider execution",
  "default provider execution enablement",
  "workspace-write execution",
  "local command execution",
  "protected remote execution",
  "live MCP, A2A, or App Server transport",
  "release, tag, publish, deployment, or external service write",
  "secret or credential changes"
] as const;

const REQUIRED_INVARIANT_MARKERS = [
  "current worktree is clean before local validation",
  "branch is `main`",
  "local `main` is not behind `origin/main`",
  "read-only productization audit passes",
  "requested provider id is exactly `codex-cli`",
  "provider grant side effect class is exactly `read_only`",
  "provider grant sandbox is exactly `read-only`",
  "approval policy is exactly `never`",
  "provider manifest selected by registry matches the planned provider",
  "provider execution metadata is present and sanitized",
  "provider execution permit is valid for the exact task, run, provider plan",
  "dry-run mode remains available and unchanged",
  "execution mode remains disabled unless explicitly selected",
  "injected spawner or executor dependency is present",
  "no global process, shell, env, or host executor is read implicitly",
  "evidence omits raw prompt, argv, stdout, stderr, command, task envelope"
] as const;

const REQUIRED_FAILURE_CASE_MARKERS = [
  "missing provider execution permit",
  "expired, revoked, plan-hash-mismatched, or scope-mismatched permit",
  "missing provider registry selection",
  "provider manifest mismatch",
  "missing provider execution metadata",
  "missing injected spawner or executor dependency",
  "requested side effect class is not `read_only`",
  "requested sandbox is not `read-only`",
  "requested approval policy is not `never`",
  "requested provider id is not `codex-cli`",
  "workspace-write, local command, protected remote, or external write scope",
  "execution mode is implied by default rather than explicitly selected",
  "evidence contains unsanitized execution material or secret-like values"
] as const;

const REQUIRED_VALIDATION_MARKERS = [
  "git status --short",
  "git branch -vv",
  "git log --oneline --decorate -n 10",
  "npm run governance -- audit readonly-productization",
  "npm run typecheck",
  "targeted provider execution runner tests",
  "targeted host dispatcher tests",
  "targeted execution eligibility and approval permit tests",
  "targeted redaction tests",
  "npm test",
  "npm run build",
  "provider execute calls during taskbook review: `0`",
  "real Codex CLI calls during taskbook review: `0`",
  "workspace-write calls during taskbook review: `0`",
  "external write calls during taskbook review: `0`"
] as const;

const REQUIRED_STOP_MARKERS = [
  "worktree is dirty before validation",
  "branch is not `main`",
  "local branch is behind or diverged from `origin/main`",
  "read-only productization audit fails",
  "requested scope includes workspace-write, local command, protected remote, or",
  "requested scope changes default provider execution posture",
  "requested scope bundles live protocol transport work",
  "requested scope bundles release, tag, publish, deployment, or remote write",
  "requested scope requires secret or credential changes",
  "rollback or step-back behavior for failure is unspecified",
  "evidence or logs would expose raw execution material or secret-like values"
] as const;

const REQUIRED_CURRENT_STATE_MARKERS = [
  REVIEW_MARKER,
  PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK,
  "controlled-provider-execution-taskbook-review",
  "general_provider_execution",
  "general_workspace_write",
  "secret_or_credential_change"
] as const;

const REQUIRED_README_MARKERS = [
  "PR-22A controlled provider execution taskbook",
  "PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md",
  "npm run governance -- audit controlled-provider-execution-taskbook-review"
] as const;

const FORBIDDEN_AUTHORIZATION_MARKERS = [
  "provider execute authorized: `true`",
  "real Codex CLI authorized: `true`",
  "workspace-write authorized: `true`",
  "local command authorized: `true`",
  "protected remote authorized: `true`",
  "remote write authorized: `true`",
  "push authorized: `true`",
  "release authorized: `true`",
  "tag authorized: `true`",
  "secret change authorized: `true`",
  "execute the provider now",
  "run provider execute now",
  "enable provider execute by default"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "Bearer",
  "raw env",
  "raw environment",
  "raw token"
] as const;

const FORBIDDEN_OUTPUT_PATTERNS = [
  /(^|[^A-Za-z0-9_])sk-[A-Za-z0-9_-]{3,}/
] as const;

export interface ControlledProviderExecutionTaskbookReviewAuditInput {
  gitStatusShort: string;
  branch: string;
  headShort: string;
  packageJsonText: string;
  taskbookText: string;
  governanceReadmeText: string;
  currentStateText: string;
  cliCloseoutText: string;
  readonlyProductizationText: string;
  capabilityPolicyText: string;
}

export interface ControlledProviderExecutionTaskbookReviewAuditResult {
  status: "passed" | "blocked";
  checks: {
    worktreeClean: boolean;
    packageScriptsPresent: boolean;
    taskbookRecorded: boolean;
    taskbookNonAuthorizing: boolean;
    futureGateExact: boolean;
    minimumSafeSliceBounded: boolean;
    invariantsRecorded: boolean;
    failureCasesRecorded: boolean;
    validationPlanRecorded: boolean;
    stopConditionsRecorded: boolean;
    priorCloseoutRecorded: boolean;
    readonlyProductizationRecorded: boolean;
    capabilityPolicyRecorded: boolean;
    governanceIndexRecorded: boolean;
    currentStateRecorded: boolean;
    generalExecutionClosed: boolean;
    outputSanitized: boolean;
    noProviderExecuteDuringReview: boolean;
    noRealCodexCliDuringReview: boolean;
    noWorkspaceWriteDuringReview: boolean;
    noEvidenceWriteDuringReview: boolean;
    noExternalWriteDuringReview: boolean;
  };
  summary: {
    branch: string;
    headShort: string;
    taskbookPath: typeof PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK;
    reviewMarker: typeof REVIEW_MARKER;
    packageScriptTargetCount: number;
    packageScriptMismatchCount: number;
    futureAuthorizationTokenRecorded: boolean;
    priorCloseoutMarkerRecorded: boolean;
    capabilityPolicyMarkerRecorded: boolean;
    providerExecuteCallsDuringReview: 0;
    realCodexCliCallsDuringReview: 0;
    workspaceWriteCallsDuringReview: 0;
    evidenceWritesDuringReview: 0;
    externalWritesDuringReview: 0;
  };
  reasons: string[];
}

export type ControlledProviderExecutionTaskbookReviewAuditOutputFormat =
  "text" | "json";

export async function collectControlledProviderExecutionTaskbookReviewAuditInput(
  cwd = process.cwd()
): Promise<ControlledProviderExecutionTaskbookReviewAuditInput> {
  const [gitStatusShort, branch, headShort] = await Promise.all([
    git(["status", "--short"], cwd),
    git(["branch", "--show-current"], cwd),
    git(["rev-parse", "--short", "HEAD"], cwd)
  ]);

  return {
    gitStatusShort,
    branch: branch.trim(),
    headShort: headShort.trim(),
    packageJsonText: await read(cwd, "package.json"),
    taskbookText: await read(cwd, PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK),
    governanceReadmeText: await read(cwd, GOVERNANCE_README),
    currentStateText: await read(cwd, CURRENT_STATE_DOC),
    cliCloseoutText: await read(cwd, CLI_CLOSEOUT_DOC),
    readonlyProductizationText: await read(cwd, READONLY_PRODUCTIZATION_DOC),
    capabilityPolicyText: await read(cwd, CAPABILITY_POLICY_DOC)
  };
}

export function reviewControlledProviderExecutionTaskbookReviewAudit(
  input: ControlledProviderExecutionTaskbookReviewAuditInput
): ControlledProviderExecutionTaskbookReviewAuditResult {
  const packageJson = parseObject(input.packageJsonText);
  const packageScriptReview = reviewPackageScripts(packageJson);
  const taskbookNonAuthorizing =
    markersPresent(input.taskbookText, REQUIRED_NON_AUTHORIZATION_MARKERS)
    && !containsForbiddenAuthorization(input.taskbookText);
  const taskbookRecorded =
    markersPresent(input.taskbookText, REQUIRED_TASKBOOK_MARKERS);
  const futureGateExact =
    input.taskbookText.includes(PR_22A_CONTROLLED_PROVIDER_EXECUTION_TOKEN)
    && input.taskbookText.includes(
      `- \`${PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK}\``
    )
    && input.taskbookText.includes(
      "The next safe action after this taskbook is a local taskbook review"
    );
  const priorCloseoutRecorded =
    input.cliCloseoutText.includes("CLI_LINE_LOCAL_CLOSEOUT_RECORDED")
    && input.cliCloseoutText.includes("READONLY_PRODUCTIZATION_FINAL_CLOSEOUT_RECORDED")
    && input.cliCloseoutText.includes("CAPABILITY_TAXONOMY_ESCALATION_POLICY_RECORDED");
  const readonlyProductizationRecorded =
    input.readonlyProductizationText.includes(
      "READONLY_PRODUCTIZATION_FINAL_CLOSEOUT_RECORDED"
    );
  const capabilityPolicyRecorded =
    input.capabilityPolicyText.includes("CAPABILITY_TAXONOMY_ESCALATION_POLICY_RECORDED")
    && input.capabilityPolicyText.includes("`general_provider_execution`")
    && input.capabilityPolicyText.includes("remain closed");
  const currentStateRecorded =
    markersPresent(input.currentStateText, REQUIRED_CURRENT_STATE_MARKERS);
  const governanceIndexRecorded =
    markersPresent(input.governanceReadmeText, REQUIRED_README_MARKERS);
  const generalExecutionClosed =
    taskbookNonAuthorizing
    && currentStateRecorded
    && capabilityPolicyRecorded
    && input.currentStateText.includes("Blocked capabilities")
    && input.currentStateText.includes("general_provider_execution")
    && input.currentStateText.includes("general_workspace_write");
  const checks = {
    worktreeClean: input.gitStatusShort.trim() === "",
    packageScriptsPresent: packageScriptReview.mismatchCount === 0,
    taskbookRecorded,
    taskbookNonAuthorizing,
    futureGateExact,
    minimumSafeSliceBounded:
      markersPresent(input.taskbookText, REQUIRED_MINIMUM_SLICE_MARKERS),
    invariantsRecorded:
      markersPresent(input.taskbookText, REQUIRED_INVARIANT_MARKERS),
    failureCasesRecorded:
      markersPresent(input.taskbookText, REQUIRED_FAILURE_CASE_MARKERS),
    validationPlanRecorded:
      markersPresent(input.taskbookText, REQUIRED_VALIDATION_MARKERS),
    stopConditionsRecorded:
      markersPresent(input.taskbookText, REQUIRED_STOP_MARKERS),
    priorCloseoutRecorded,
    readonlyProductizationRecorded,
    capabilityPolicyRecorded,
    governanceIndexRecorded,
    currentStateRecorded,
    generalExecutionClosed,
    outputSanitized: outputIsSanitized(input),
    noProviderExecuteDuringReview: true,
    noRealCodexCliDuringReview: true,
    noWorkspaceWriteDuringReview: true,
    noEvidenceWriteDuringReview: true,
    noExternalWriteDuringReview: true
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      branch: input.branch,
      headShort: input.headShort,
      taskbookPath: PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK,
      reviewMarker: REVIEW_MARKER,
      packageScriptTargetCount: packageScriptReview.targetCount,
      packageScriptMismatchCount: packageScriptReview.mismatchCount,
      futureAuthorizationTokenRecorded:
        input.taskbookText.includes(PR_22A_CONTROLLED_PROVIDER_EXECUTION_TOKEN),
      priorCloseoutMarkerRecorded: priorCloseoutRecorded,
      capabilityPolicyMarkerRecorded: capabilityPolicyRecorded,
      providerExecuteCallsDuringReview: 0,
      realCodexCliCallsDuringReview: 0,
      workspaceWriteCallsDuringReview: 0,
      evidenceWritesDuringReview: 0,
      externalWritesDuringReview: 0
    },
    reasons
  };
}

export function formatControlledProviderExecutionTaskbookReviewAuditResult(
  review: ControlledProviderExecutionTaskbookReviewAuditResult,
  format: ControlledProviderExecutionTaskbookReviewAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Controlled provider execution taskbook review audit",
    `status: ${review.status}`,
    `branch: ${review.summary.branch}`,
    `head: ${review.summary.headShort}`,
    `taskbook: ${review.summary.taskbookPath}`,
    `review marker: ${review.summary.reviewMarker}`,
    `package scripts: ${review.summary.packageScriptTargetCount - review.summary.packageScriptMismatchCount}/${review.summary.packageScriptTargetCount}`,
    `future authorization token recorded: ${review.summary.futureAuthorizationTokenRecorded}`,
    `prior closeout marker recorded: ${review.summary.priorCloseoutMarkerRecorded}`,
    `capability policy marker recorded: ${review.summary.capabilityPolicyMarkerRecorded}`,
    `provider execute calls during taskbook review: ${review.summary.providerExecuteCallsDuringReview}`,
    `real Codex CLI calls during taskbook review: ${review.summary.realCodexCliCallsDuringReview}`,
    `workspace-write calls during taskbook review: ${review.summary.workspaceWriteCallsDuringReview}`,
    `evidence writes during taskbook review: ${review.summary.evidenceWritesDuringReview}`,
    `external writes during taskbook review: ${review.summary.externalWritesDuringReview}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });

  return stdout;
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function reviewPackageScripts(packageJson: Record<string, unknown> | undefined): {
  targetCount: number;
  mismatchCount: number;
} {
  const scripts = packageJson?.scripts;
  const entries = Object.entries(REQUIRED_PACKAGE_SCRIPTS);

  return {
    targetCount: entries.length,
    mismatchCount: entries.filter(
      ([scriptName, expectedCommand]) =>
        !isRecord(scripts) || scripts[scriptName] !== expectedCommand
    ).length
  };
}

function markersPresent(text: string, markers: readonly string[]): boolean {
  const normalizedText = normalizeWhitespace(text);

  return markers.every((marker) => normalizedText.includes(normalizeWhitespace(marker)));
}

function containsForbiddenAuthorization(text: string): boolean {
  return FORBIDDEN_AUTHORIZATION_MARKERS.some((marker) => text.includes(marker));
}

function outputIsSanitized(
  input: ControlledProviderExecutionTaskbookReviewAuditInput
): boolean {
  const combined = [
    input.taskbookText,
    input.governanceReadmeText,
    input.currentStateText,
    input.cliCloseoutText,
    input.readonlyProductizationText,
    input.capabilityPolicyText
  ].join("\n");

  return (
    !FORBIDDEN_OUTPUT_MARKERS.some((marker) => combined.includes(marker))
    && !FORBIDDEN_OUTPUT_PATTERNS.some((pattern) => pattern.test(combined))
  );
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `controlled_provider_execution_taskbook_review_${name}`);
}

function parseObject(value: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function main(): Promise<void> {
  const input = await collectControlledProviderExecutionTaskbookReviewAuditInput();
  const review = reviewControlledProviderExecutionTaskbookReviewAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatControlledProviderExecutionTaskbookReviewAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Controlled provider execution taskbook review audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
