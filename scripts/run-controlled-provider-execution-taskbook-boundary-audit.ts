#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const TASKBOOK = "docs/governance/PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK.md";
const TASKBOOK_REVIEW_TEST =
  "tests/controlled-provider-execution-taskbook-review-audit.test.ts";

const REQUIRED_TASKBOOK_MARKERS = [
  "PR-22A Controlled Provider Execution Minimal Taskbook",
  "APPROVE_CONTROLLED_PROVIDER_EXECUTION_MINIMAL_SLICE_PR_22A",
  "This taskbook is local-only.",
  "does not authorize provider execute",
  "authorize invoking the real Codex CLI",
  "does not authorize workspace-write",
  "not authorize local command execution",
  "not authorize protected remote",
  "does not authorize remote write",
  "does not authorize evidence refresh",
  "does not authorize push, release, tag, publish, deployment, or external",
  "keep the default mode as dry-run or disabled",
  "require provider id `codex-cli`",
  "require side effect class `read_only`",
  "require sandbox `read-only`",
  "require approval policy `never`",
  "require a valid provider execution permit bound to the exact plan",
  "require injected spawner or injected executor dependency",
  "require runner invariant checks before any spawn boundary",
  "general provider execution",
  "default provider execution enablement",
  "workspace-write execution",
  "local command execution",
  "protected remote execution",
  "live MCP, A2A, or App Server transport",
  "release, tag, publish, deployment, or external service write",
  "secret or credential changes",
  "execution mode remains disabled unless explicitly selected",
  "no global process, shell, env, or host executor is read implicitly",
  "evidence omits raw prompt, argv, stdout, stderr, command, task envelope",
  "provider execute calls during taskbook review: `0`",
  "real Codex CLI calls during taskbook review: `0`",
  "workspace-write calls during taskbook review: `0`",
  "external write calls during taskbook review: `0`",
  "This taskbook does not authorize:",
  "- provider execute",
  "- invoking the real Codex CLI",
  "- running a real provider spawner",
  "- setting any execution operator flag",
  "- workspace-write execute",
  "- local command execute",
  "- protected remote execute",
  "- live MCP, A2A, or App Server transport",
  "- refreshing evidence",
  "- external service write",
  "- secret or credential changes",
  "PR_22A_CONTROLLED_PROVIDER_EXECUTION_TASKBOOK_RECORDED",
  "General provider execution remains closed."
] as const;

const REQUIRED_REVIEW_TEST_MARKERS = [
  "controlled provider execution taskbook review passes for current planning line",
  "controlled provider execution taskbook review blocks broadened authorization text",
  "controlled provider execution taskbook review blocks missing prior artifacts",
  "controlled provider execution taskbook review blocks dirty worktree state",
  "controlled provider execution taskbook review output stays summarized and sanitized"
] as const;

const FORBIDDEN_RUNTIME_MARKERS = [
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
  "spawn(",
  "execFile(",
  "exec(",
  "child_process",
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

export interface ControlledProviderExecutionTaskbookBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  taskbookText: string;
  taskbookReviewTestText: string;
}

export interface ControlledProviderExecutionTaskbookBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    taskbookMarkersPresent: boolean;
    reviewCoverageRecorded: boolean;
    noRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    taskbookMode: "local_only_minimal_slice_taskbook";
    taskbookIsProviderExecuteAuthorization: false;
    taskbookIsRealCodexCliAuthorization: false;
    taskbookIsWorkspaceWriteAuthorization: false;
    taskbookIsLocalCommandAuthorization: false;
    taskbookIsProtectedRemoteAuthorization: false;
    taskbookIsHostExecutorAuthorization: false;
    taskbookIsSubAgentRuntimeAuthorization: false;
    taskbookIsExternalWriteAuthorization: false;
    taskbookIsReleaseAuthorization: false;
    taskbookIsSecretChangeAuthorization: false;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
    evidenceWritesDuringAudit: 0;
  };
  reasons: string[];
}

export type ControlledProviderExecutionTaskbookBoundaryAuditOutputFormat =
  "text" | "json";

export async function collectControlledProviderExecutionTaskbookBoundaryAuditInput(
  cwd = process.cwd()
): Promise<ControlledProviderExecutionTaskbookBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    taskbookText,
    taskbookReviewTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, TASKBOOK),
    read(cwd, TASKBOOK_REVIEW_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    taskbookText,
    taskbookReviewTestText
  };
}

export function reviewControlledProviderExecutionTaskbookBoundaryAudit(
  input: ControlledProviderExecutionTaskbookBoundaryAuditInput
): ControlledProviderExecutionTaskbookBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit controlled-provider-execution-taskbook-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "controlled-provider-execution-taskbook-boundary"
    ),
    taskbookMarkersPresent: REQUIRED_TASKBOOK_MARKERS.every((marker) =>
      input.taskbookText.includes(marker)
    ),
    reviewCoverageRecorded: REQUIRED_REVIEW_TEST_MARKERS.every((marker) =>
      input.taskbookReviewTestText.includes(marker)
    ),
    noRuntimeInvocationSurface: noRuntimeInvocationSurface(input.taskbookText),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      taskbookMode: "local_only_minimal_slice_taskbook",
      taskbookIsProviderExecuteAuthorization: false,
      taskbookIsRealCodexCliAuthorization: false,
      taskbookIsWorkspaceWriteAuthorization: false,
      taskbookIsLocalCommandAuthorization: false,
      taskbookIsProtectedRemoteAuthorization: false,
      taskbookIsHostExecutorAuthorization: false,
      taskbookIsSubAgentRuntimeAuthorization: false,
      taskbookIsExternalWriteAuthorization: false,
      taskbookIsReleaseAuthorization: false,
      taskbookIsSecretChangeAuthorization: false,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0,
      evidenceWritesDuringAudit: 0
    },
    reasons
  };
}

export function formatControlledProviderExecutionTaskbookBoundaryAuditResult(
  review: ControlledProviderExecutionTaskbookBoundaryAuditResult,
  format: ControlledProviderExecutionTaskbookBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Controlled provider execution taskbook boundary audit",
    `status: ${review.status}`,
    `taskbook mode: ${review.summary.taskbookMode}`,
    `taskbook is provider execute authorization: ${review.summary.taskbookIsProviderExecuteAuthorization}`,
    `taskbook is real Codex CLI authorization: ${review.summary.taskbookIsRealCodexCliAuthorization}`,
    `taskbook is workspace-write authorization: ${review.summary.taskbookIsWorkspaceWriteAuthorization}`,
    `taskbook is local command authorization: ${review.summary.taskbookIsLocalCommandAuthorization}`,
    `taskbook is protected remote authorization: ${review.summary.taskbookIsProtectedRemoteAuthorization}`,
    `taskbook is host executor authorization: ${review.summary.taskbookIsHostExecutorAuthorization}`,
    `taskbook is sub-agent runtime authorization: ${review.summary.taskbookIsSubAgentRuntimeAuthorization}`,
    `taskbook is external-write authorization: ${review.summary.taskbookIsExternalWriteAuthorization}`,
    `taskbook is release authorization: ${review.summary.taskbookIsReleaseAuthorization}`,
    `taskbook is secret change authorization: ${review.summary.taskbookIsSecretChangeAuthorization}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `shell/process calls during audit: ${review.summary.shellProcessCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    `evidence writes during audit: ${review.summary.evidenceWritesDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function controlPlaneAuthorityRecorded(text: string): boolean {
  return text.includes("Controlled provider execution taskbook boundary")
    && text.includes("local-only minimal provider execution taskbook")
    && text.includes("taskbook is not provider execute authorization")
    && text.includes("taskbook is not real Codex CLI authorization")
    && text.includes("taskbook is not workspace-write authorization")
    && text.includes("taskbook is not local command authorization")
    && text.includes("taskbook is not protected remote authorization")
    && text.includes("taskbook is not host executor authorization")
    && text.includes("taskbook is not sub-agent runtime authorization")
    && text.includes("taskbook is not external-write authorization")
    && text.includes("taskbook is not release authorization")
    && text.includes("taskbook is not secret change authorization");
}

function noRuntimeInvocationSurface(text: string): boolean {
  return FORBIDDEN_RUNTIME_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(): boolean {
  const output = formatControlledProviderExecutionTaskbookBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      taskbookMarkersPresent: true,
      reviewCoverageRecorded: true,
      noRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      taskbookMode: "local_only_minimal_slice_taskbook",
      taskbookIsProviderExecuteAuthorization: false,
      taskbookIsRealCodexCliAuthorization: false,
      taskbookIsWorkspaceWriteAuthorization: false,
      taskbookIsLocalCommandAuthorization: false,
      taskbookIsProtectedRemoteAuthorization: false,
      taskbookIsHostExecutorAuthorization: false,
      taskbookIsSubAgentRuntimeAuthorization: false,
      taskbookIsExternalWriteAuthorization: false,
      taskbookIsReleaseAuthorization: false,
      taskbookIsSecretChangeAuthorization: false,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0,
      evidenceWritesDuringAudit: 0
    },
    reasons: []
  });

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !output.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `controlled_provider_execution_taskbook_boundary_${name}`);
}

async function main(): Promise<void> {
  const input = await collectControlledProviderExecutionTaskbookBoundaryAuditInput();
  const review = reviewControlledProviderExecutionTaskbookBoundaryAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(
    formatControlledProviderExecutionTaskbookBoundaryAuditResult(review, format)
  );

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Controlled provider execution taskbook boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
