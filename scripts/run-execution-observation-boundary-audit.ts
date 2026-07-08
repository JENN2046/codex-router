#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const EXECUTION_OBSERVATION_SOURCE =
  "packages/governance-internal-execution-observation/src/index.ts";
const EXECUTION_OBSERVATION_TEST = "tests/execution-observation.test.ts";

const REQUIRED_SOURCE_MARKERS = [
  "ExecutionObservationStatusSchema",
  "ExecutionObservationSignalsSchema",
  "ExecutionObservationSchema",
  "ExecutionObservationBus",
  "ExecutionObservationStore",
  "RecordingExecutionObservationStore",
  "createRecordingExecutionObservationStore",
  "createObservationId",
  "createExecutionObservationRef",
  "parseExecutionObservationRef",
  "resolveExecutionObservationRef",
  "FileExecutionObservationStore",
  "writeFile(taskPath, line, { flag: \"a\", encoding: \"utf-8\" })",
  "const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, \"_\")"
] as const;

const REQUIRED_TEST_MARKERS = [
  "execution observation parses a succeeded primitive event",
  "execution observation parses a failed primitive with permission blocked signal",
  "recording observation store keeps events across emits",
  "execution observation refs resolve through an observation store",
  "execution observation refs do not resolve across colliding file store task paths",
  "file execution observation store persists events to disk"
] as const;

const FORBIDDEN_SOURCE_MARKERS = [
  "provider.execute(",
  ".executeProvider(",
  "spawn(",
  "execFile(",
  "exec(",
  "dispatchToHost(",
  "runDesktopTask(",
  "resumeDesktopTask(",
  "invokeSubAgent",
  "hostExecutor(",
  "new Worker(",
  "fetch("
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface ExecutionObservationBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  executionObservationSourceText: string;
  executionObservationTestText: string;
}

export interface ExecutionObservationBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    sourceSchemaAndStoreMarkersRecorded: boolean;
    taskScopedRefResolutionRecorded: boolean;
    failClosedCoverageRecorded: boolean;
    noRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    observationMode: "sanitized_task_scoped_observation_record_only";
    observationStatusIsExecutionAuthorization: false;
    succeededObservationIsCompletionAuthorization: false;
    failedObservationIsRecoveryAuthorization: false;
    evidenceRefIsRuntimeInvocation: false;
    observationRefResolutionIsReplayAuthorization: false;
    observationRecordWriteIsWorkspaceWriteExecution: false;
    fileStorePersistenceAllowed: true;
    providerExecuteAllowed: false;
    codexCliInvocationAllowed: false;
    subAgentRuntimeInvocationAllowed: false;
    hostExecutorInvocationAllowed: false;
    hostDispatchAllowed: false;
    shellProcessAllowed: false;
    workspaceWriteExecutionAllowed: false;
    externalWriteAllowed: false;
    observationBusEmitsDuringAudit: 0;
    observationStoreWritesDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    hostDispatchCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type ExecutionObservationBoundaryAuditOutputFormat = "text" | "json";

export async function collectExecutionObservationBoundaryAuditInput(
  cwd = process.cwd()
): Promise<ExecutionObservationBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    executionObservationSourceText,
    executionObservationTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, EXECUTION_OBSERVATION_SOURCE),
    read(cwd, EXECUTION_OBSERVATION_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    executionObservationSourceText,
    executionObservationTestText
  };
}

export function reviewExecutionObservationBoundaryAudit(
  input: ExecutionObservationBoundaryAuditInput
): ExecutionObservationBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit execution-observation-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "execution-observation-boundary"
    ),
    sourceSchemaAndStoreMarkersRecorded: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.executionObservationSourceText.includes(marker)
    ),
    taskScopedRefResolutionRecorded: taskScopedRefResolutionRecorded(
      input.executionObservationSourceText
    ),
    failClosedCoverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.executionObservationTestText.includes(marker)
    ),
    noRuntimeInvocationSurface: noRuntimeInvocationSurface(
      input.executionObservationSourceText
    ),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      observationMode: "sanitized_task_scoped_observation_record_only",
      observationStatusIsExecutionAuthorization: false,
      succeededObservationIsCompletionAuthorization: false,
      failedObservationIsRecoveryAuthorization: false,
      evidenceRefIsRuntimeInvocation: false,
      observationRefResolutionIsReplayAuthorization: false,
      observationRecordWriteIsWorkspaceWriteExecution: false,
      fileStorePersistenceAllowed: true,
      providerExecuteAllowed: false,
      codexCliInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      hostDispatchAllowed: false,
      shellProcessAllowed: false,
      workspaceWriteExecutionAllowed: false,
      externalWriteAllowed: false,
      observationBusEmitsDuringAudit: 0,
      observationStoreWritesDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatExecutionObservationBoundaryAuditResult(
  review: ExecutionObservationBoundaryAuditResult,
  format: ExecutionObservationBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Execution observation boundary audit",
    `status: ${review.status}`,
    `observation mode: ${review.summary.observationMode}`,
    `observation status is execution authorization: ${review.summary.observationStatusIsExecutionAuthorization}`,
    `succeeded observation is completion authorization: ${review.summary.succeededObservationIsCompletionAuthorization}`,
    `failed observation is recovery authorization: ${review.summary.failedObservationIsRecoveryAuthorization}`,
    `evidence ref is runtime invocation: ${review.summary.evidenceRefIsRuntimeInvocation}`,
    `observation ref resolution is replay authorization: ${review.summary.observationRefResolutionIsReplayAuthorization}`,
    `observation record write is workspace-write execution: ${review.summary.observationRecordWriteIsWorkspaceWriteExecution}`,
    `file store persistence allowed: ${review.summary.fileStorePersistenceAllowed}`,
    `provider execute allowed: ${review.summary.providerExecuteAllowed}`,
    `Codex CLI invocation allowed: ${review.summary.codexCliInvocationAllowed}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `host executor invocation allowed: ${review.summary.hostExecutorInvocationAllowed}`,
    `host dispatch allowed: ${review.summary.hostDispatchAllowed}`,
    `shell/process allowed: ${review.summary.shellProcessAllowed}`,
    `workspace-write execution allowed: ${review.summary.workspaceWriteExecutionAllowed}`,
    `external write allowed: ${review.summary.externalWriteAllowed}`,
    `observation bus emits during audit: ${review.summary.observationBusEmitsDuringAudit}`,
    `observation store writes during audit: ${review.summary.observationStoreWritesDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `host dispatch calls during audit: ${review.summary.hostDispatchCallsDuringAudit}`,
    `shell/process calls during audit: ${review.summary.shellProcessCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function controlPlaneAuthorityRecorded(text: string): boolean {
  return text.includes("Execution observation boundary")
    && text.includes("sanitized task-scoped observation records")
    && text.includes("observation status is not execution authorization")
    && text.includes("succeeded observations are not completion authorization")
    && text.includes("failed observations are not recovery authorization")
    && text.includes("observation refs are not replay authorization")
    && text.includes("file-store persistence is audit-record storage");
}

function taskScopedRefResolutionRecorded(text: string): boolean {
  return text.includes("const observations = await store.findByTaskId(taskId)")
    && text.includes("observation.taskId === taskId")
    && text.includes("observation.observationId === parsedRef.observationId");
}

function noRuntimeInvocationSurface(text: string): boolean {
  return FORBIDDEN_SOURCE_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(input: ExecutionObservationBoundaryAuditInput): boolean {
  const output = formatExecutionObservationBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      sourceSchemaAndStoreMarkersRecorded: true,
      taskScopedRefResolutionRecorded: true,
      failClosedCoverageRecorded: true,
      noRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      observationMode: "sanitized_task_scoped_observation_record_only",
      observationStatusIsExecutionAuthorization: false,
      succeededObservationIsCompletionAuthorization: false,
      failedObservationIsRecoveryAuthorization: false,
      evidenceRefIsRuntimeInvocation: false,
      observationRefResolutionIsReplayAuthorization: false,
      observationRecordWriteIsWorkspaceWriteExecution: false,
      fileStorePersistenceAllowed: true,
      providerExecuteAllowed: false,
      codexCliInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      hostDispatchAllowed: false,
      shellProcessAllowed: false,
      workspaceWriteExecutionAllowed: false,
      externalWriteAllowed: false,
      observationBusEmitsDuringAudit: 0,
      observationStoreWritesDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  });
  const aggregateText = [
    input.governanceControlPlaneText,
    input.governanceReadmeText,
    input.governanceRunnerText,
    input.executionObservationSourceText,
    input.executionObservationTestText,
    output
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !aggregateText.includes(marker));
}

function collectReasons(
  checks: ExecutionObservationBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `execution_observation_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectExecutionObservationBoundaryAuditInput();
  const review = reviewExecutionObservationBoundaryAudit(input);
  console.log(formatExecutionObservationBoundaryAuditResult(review, format));
  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Execution observation boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
