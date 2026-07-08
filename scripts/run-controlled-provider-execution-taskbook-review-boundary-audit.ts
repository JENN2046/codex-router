#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const TASKBOOK = "docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md";
const REVIEW_AUDIT =
  "scripts/run-controlled-provider-execution-taskbook-review-audit.ts";
const REVIEW_TEST = "tests/controlled-provider-execution-taskbook-review-audit.test.ts";

const REQUIRED_REVIEW_AUDIT_MARKERS = [
  "Controlled provider execution taskbook review audit",
  "PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK_REVIEW_RECORDED",
  "APPROVE_CONTROLLED_PROVIDER_EXECUTION_MINIMAL_SLICE_PR_22A",
  "worktreeClean: input.gitStatusShort.trim() === \"\"",
  "taskbookNonAuthorizing",
  "futureGateExact",
  "generalExecutionClosed",
  "noProviderExecuteDuringReview: true",
  "noRealCodexCliDuringReview: true",
  "noWorkspaceWriteDuringReview: true",
  "noEvidenceWriteDuringReview: true",
  "noExternalWriteDuringReview: true",
  "providerExecuteCallsDuringReview: 0",
  "realCodexCliCallsDuringReview: 0",
  "workspaceWriteCallsDuringReview: 0",
  "evidenceWritesDuringReview: 0",
  "externalWritesDuringReview: 0"
] as const;

const REQUIRED_TASKBOOK_MARKERS = [
  "PR-22A Controlled Provider Execution Minimal Taskbook",
  "This taskbook is local-only.",
  "does not authorize provider execute",
  "authorize invoking the real Codex CLI",
  "does not authorize workspace-write",
  "not authorize local command execution",
  "not authorize protected remote",
  "does not authorize remote write",
  "does not authorize evidence refresh",
  "does not authorize push, release, tag, publish, deployment, or external",
  "General provider execution remains closed.",
  "The next safe action after this taskbook is a local taskbook review"
] as const;

const REQUIRED_REVIEW_TEST_MARKERS = [
  "controlled provider execution taskbook review passes for current planning line",
  "controlled provider execution taskbook review blocks broadened authorization text",
  "controlled provider execution taskbook review blocks missing prior artifacts",
  "controlled provider execution taskbook review blocks dirty worktree state",
  "controlled provider execution taskbook review blocks secret-like sk tokens",
  "controlled provider execution taskbook review output stays summarized and sanitized"
] as const;

const FORBIDDEN_REVIEW_RUNTIME_MARKERS = [
  "provider.execute(",
  ".executeProvider(",
  "runCodexCli(",
  "CodexCliExecutorProvider",
  "dispatchGovernanceOperatorActionHostExecutor",
  "dispatchToHost(",
  "runDesktopTask(",
  "resumeDesktopTask(",
  "invokeSubAgent",
  "spawnSubAgent",
  "hostExecutor(",
  "new Worker(",
  "fetch(",
  "writeFile(",
  "mkdir(",
  "rm(",
  "rename(",
  "copyFile(",
  "apply_patch("
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface ControlledProviderExecutionTaskbookReviewBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  taskbookText: string;
  reviewAuditText: string;
  reviewTestText: string;
}

export interface ControlledProviderExecutionTaskbookReviewBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    reviewAuditRegistered: boolean;
    reviewAuditMarkersPresent: boolean;
    taskbookNonAuthorizationRecorded: boolean;
    reviewCoverageRecorded: boolean;
    reviewAuditGitStateGateRecorded: boolean;
    noProviderRuntimeSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    reviewBoundaryMode: "git_state_and_artifact_review_gate_only";
    reviewAuditIsProviderExecuteAuthorization: false;
    reviewAuditIsRealCodexCliAuthorization: false;
    reviewAuditIsWorkspaceWriteAuthorization: false;
    reviewAuditIsLocalCommandAuthorization: false;
    reviewAuditIsHostExecutorAuthorization: false;
    reviewAuditIsSubAgentRuntimeAuthorization: false;
    reviewAuditIsExternalWriteAuthorization: false;
    reviewAuditIsReleaseAuthorization: false;
    reviewAuditGitStateIsExecutionAuthorization: false;
    reviewAuditWorktreeCleanIsProviderExecutionAuthorization: false;
    providerExecuteCallsDuringBoundaryAudit: 0;
    codexCliCallsDuringBoundaryAudit: 0;
    workspaceWriteCallsDuringBoundaryAudit: 0;
    hostExecutorCallsDuringBoundaryAudit: 0;
    subAgentRuntimeCallsDuringBoundaryAudit: 0;
    shellProcessCallsDuringBoundaryAudit: 0;
    externalWriteCallsDuringBoundaryAudit: 0;
    evidenceWritesDuringBoundaryAudit: 0;
  };
  reasons: string[];
}

export type ControlledProviderExecutionTaskbookReviewBoundaryAuditOutputFormat =
  "text" | "json";

export async function collectControlledProviderExecutionTaskbookReviewBoundaryAuditInput(
  cwd = process.cwd()
): Promise<ControlledProviderExecutionTaskbookReviewBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    taskbookText,
    reviewAuditText,
    reviewTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, TASKBOOK),
    read(cwd, REVIEW_AUDIT),
    read(cwd, REVIEW_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    taskbookText,
    reviewAuditText,
    reviewTestText
  };
}

export function reviewControlledProviderExecutionTaskbookReviewBoundaryAudit(
  input: ControlledProviderExecutionTaskbookReviewBoundaryAuditInput
): ControlledProviderExecutionTaskbookReviewBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit controlled-provider-execution-taskbook-review-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "controlled-provider-execution-taskbook-review-boundary"
    ),
    reviewAuditRegistered: input.governanceRunnerText.includes(
      "controlled-provider-execution-taskbook-review"
    ),
    reviewAuditMarkersPresent: REQUIRED_REVIEW_AUDIT_MARKERS.every((marker) =>
      input.reviewAuditText.includes(marker)
    ),
    taskbookNonAuthorizationRecorded: REQUIRED_TASKBOOK_MARKERS.every((marker) =>
      input.taskbookText.includes(marker)
    ),
    reviewCoverageRecorded: REQUIRED_REVIEW_TEST_MARKERS.every((marker) =>
      input.reviewTestText.includes(marker)
    ),
    reviewAuditGitStateGateRecorded:
      input.reviewAuditText.includes("git([\"status\", \"--short\"], cwd)")
      && input.reviewAuditText.includes("git([\"branch\", \"--show-current\"], cwd)")
      && input.reviewAuditText.includes("git([\"rev-parse\", \"--short\", \"HEAD\"], cwd)")
      && input.reviewAuditText.includes(
        "worktreeClean: input.gitStatusShort.trim() === \"\""
      ),
    noProviderRuntimeSurface: noProviderRuntimeSurface(input.reviewAuditText),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      reviewBoundaryMode: "git_state_and_artifact_review_gate_only",
      reviewAuditIsProviderExecuteAuthorization: false,
      reviewAuditIsRealCodexCliAuthorization: false,
      reviewAuditIsWorkspaceWriteAuthorization: false,
      reviewAuditIsLocalCommandAuthorization: false,
      reviewAuditIsHostExecutorAuthorization: false,
      reviewAuditIsSubAgentRuntimeAuthorization: false,
      reviewAuditIsExternalWriteAuthorization: false,
      reviewAuditIsReleaseAuthorization: false,
      reviewAuditGitStateIsExecutionAuthorization: false,
      reviewAuditWorktreeCleanIsProviderExecutionAuthorization: false,
      providerExecuteCallsDuringBoundaryAudit: 0,
      codexCliCallsDuringBoundaryAudit: 0,
      workspaceWriteCallsDuringBoundaryAudit: 0,
      hostExecutorCallsDuringBoundaryAudit: 0,
      subAgentRuntimeCallsDuringBoundaryAudit: 0,
      shellProcessCallsDuringBoundaryAudit: 0,
      externalWriteCallsDuringBoundaryAudit: 0,
      evidenceWritesDuringBoundaryAudit: 0
    },
    reasons
  };
}

export function formatControlledProviderExecutionTaskbookReviewBoundaryAuditResult(
  review: ControlledProviderExecutionTaskbookReviewBoundaryAuditResult,
  format: ControlledProviderExecutionTaskbookReviewBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Controlled provider execution taskbook review boundary audit",
    `status: ${review.status}`,
    `review boundary mode: ${review.summary.reviewBoundaryMode}`,
    `review audit is provider execute authorization: ${review.summary.reviewAuditIsProviderExecuteAuthorization}`,
    `review audit is real Codex CLI authorization: ${review.summary.reviewAuditIsRealCodexCliAuthorization}`,
    `review audit is workspace-write authorization: ${review.summary.reviewAuditIsWorkspaceWriteAuthorization}`,
    `review audit is local command authorization: ${review.summary.reviewAuditIsLocalCommandAuthorization}`,
    `review audit is host executor authorization: ${review.summary.reviewAuditIsHostExecutorAuthorization}`,
    `review audit is sub-agent runtime authorization: ${review.summary.reviewAuditIsSubAgentRuntimeAuthorization}`,
    `review audit is external-write authorization: ${review.summary.reviewAuditIsExternalWriteAuthorization}`,
    `review audit is release authorization: ${review.summary.reviewAuditIsReleaseAuthorization}`,
    `review audit git state is execution authorization: ${review.summary.reviewAuditGitStateIsExecutionAuthorization}`,
    `review audit worktree clean is provider execution authorization: ${review.summary.reviewAuditWorktreeCleanIsProviderExecutionAuthorization}`,
    `provider execute calls during boundary audit: ${review.summary.providerExecuteCallsDuringBoundaryAudit}`,
    `Codex CLI calls during boundary audit: ${review.summary.codexCliCallsDuringBoundaryAudit}`,
    `workspace-write calls during boundary audit: ${review.summary.workspaceWriteCallsDuringBoundaryAudit}`,
    `host executor calls during boundary audit: ${review.summary.hostExecutorCallsDuringBoundaryAudit}`,
    `sub-agent runtime calls during boundary audit: ${review.summary.subAgentRuntimeCallsDuringBoundaryAudit}`,
    `shell/process calls during boundary audit: ${review.summary.shellProcessCallsDuringBoundaryAudit}`,
    `external write calls during boundary audit: ${review.summary.externalWriteCallsDuringBoundaryAudit}`,
    `evidence writes during boundary audit: ${review.summary.evidenceWritesDuringBoundaryAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

function controlPlaneAuthorityRecorded(text: string): boolean {
  return text.includes("Controlled provider execution taskbook review boundary")
    && text.includes("git-state and artifact review gate only")
    && text.includes("review audit is not provider execute authorization")
    && text.includes("review audit git state is not execution authorization")
    && text.includes("worktree clean is not provider execution authorization");
}

function noProviderRuntimeSurface(text: string): boolean {
  return FORBIDDEN_REVIEW_RUNTIME_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(): boolean {
  const review: ControlledProviderExecutionTaskbookReviewBoundaryAuditResult = {
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      reviewAuditRegistered: true,
      reviewAuditMarkersPresent: true,
      taskbookNonAuthorizationRecorded: true,
      reviewCoverageRecorded: true,
      reviewAuditGitStateGateRecorded: true,
      noProviderRuntimeSurface: true,
      outputSanitized: true
    },
    summary: {
      reviewBoundaryMode: "git_state_and_artifact_review_gate_only",
      reviewAuditIsProviderExecuteAuthorization: false,
      reviewAuditIsRealCodexCliAuthorization: false,
      reviewAuditIsWorkspaceWriteAuthorization: false,
      reviewAuditIsLocalCommandAuthorization: false,
      reviewAuditIsHostExecutorAuthorization: false,
      reviewAuditIsSubAgentRuntimeAuthorization: false,
      reviewAuditIsExternalWriteAuthorization: false,
      reviewAuditIsReleaseAuthorization: false,
      reviewAuditGitStateIsExecutionAuthorization: false,
      reviewAuditWorktreeCleanIsProviderExecutionAuthorization: false,
      providerExecuteCallsDuringBoundaryAudit: 0,
      codexCliCallsDuringBoundaryAudit: 0,
      workspaceWriteCallsDuringBoundaryAudit: 0,
      hostExecutorCallsDuringBoundaryAudit: 0,
      subAgentRuntimeCallsDuringBoundaryAudit: 0,
      shellProcessCallsDuringBoundaryAudit: 0,
      externalWriteCallsDuringBoundaryAudit: 0,
      evidenceWritesDuringBoundaryAudit: 0
    },
    reasons: []
  };
  const text = formatControlledProviderExecutionTaskbookReviewBoundaryAuditResult(
    review
  );
  const json = formatControlledProviderExecutionTaskbookReviewBoundaryAuditResult(
    review,
    "json"
  );

  return FORBIDDEN_OUTPUT_MARKERS.every(
    (marker) => !text.includes(marker) && !json.includes(marker)
  );
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `controlled_provider_execution_taskbook_review_boundary_${name}`);
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

async function main(): Promise<void> {
  const input =
    await collectControlledProviderExecutionTaskbookReviewBoundaryAuditInput();
  const review = reviewControlledProviderExecutionTaskbookReviewBoundaryAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(
    formatControlledProviderExecutionTaskbookReviewBoundaryAuditResult(
      review,
      format
    )
  );

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Controlled provider execution taskbook review boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
