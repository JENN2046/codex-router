#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const SCHEDULER_SOURCE = "packages/scheduler/src/index.ts";
const SCHEDULER_TEST = "tests/scheduler.test.ts";

const REQUIRED_SOURCE_MARKERS = [
  "SchedulerLeaseStatus",
  "SchedulerQueueItemStatus",
  "SchedulerExecutionLease",
  "SchedulerQueueItem",
  "SchedulerExecutionLeaseSchema",
  "SchedulerQueueItemSchema",
  "InMemoryScheduler",
  "FileSystemScheduler",
  "enqueueRun",
  "acquireLease",
  "renewLease",
  "releaseLease",
  "failLease",
  "expireLeases",
  "expireLeasesInState",
  "createFileSystemScheduler",
  "writeFileSync(tempPath,",
  "renameSync(tempPath, this.statePath)",
  "openSync(this.lockPath, \"wx\")",
  "process.kill(snapshot.pid, 0)"
] as const;

const REQUIRED_TEST_MARKERS = [
  "scheduler enqueues and acquires a run lease",
  "scheduler allows only one active lease per run",
  "scheduler renews an active lease",
  "scheduler releases a lease without completing the run itself",
  "scheduler reacquires expired leases and increments attempts",
  "scheduler retries failed leases while attempts remain",
  "scheduler stops dispatching after maxAttempts is exhausted",
  "scheduler lists queue and leases as stable snapshots",
  "file scheduler persists queue and leases across instances",
  "file scheduler persists release and completion across instances",
  "file scheduler refuses state mutation while another lock is present",
  "file scheduler does not remove a stale-looking lock owned by a live process"
] as const;

const FORBIDDEN_RUNTIME_SOURCE_MARKERS = [
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
  "apply_patch("
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface SchedulerBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  schedulerSourceText: string;
  schedulerTestText: string;
}

export interface SchedulerBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    sourceSchedulerMarkersPresent: boolean;
    coverageRecorded: boolean;
    noRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    schedulerMode: "queue_and_execution_lease_state_machine_only";
    queuedStatusIsDispatchAuthorization: false;
    leasedStatusIsExecutionAuthorization: false;
    activeLeaseIsProviderExecuteAuthorization: false;
    workerIdIsHostOrSubAgentAuthorization: false;
    releaseLeaseIsRuntimeCompletionProof: false;
    failLeaseIsRecoveryExecution: false;
    expiredLeaseIsRetryExecution: false;
    exhaustedStatusIsRuntimeBlockExecution: false;
    fileStatePersistenceIsWorkspaceWriteExecution: false;
    fileLockIsShellProcessExecution: false;
    schedulerCallsDuringAudit: 0;
    schedulerLeaseAcquisitionsDuringAudit: 0;
    schedulerStateWritesDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    hostDispatchCallsDuringAudit: 0;
    toolRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type SchedulerBoundaryAuditOutputFormat = "text" | "json";

export async function collectSchedulerBoundaryAuditInput(
  cwd = process.cwd()
): Promise<SchedulerBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    schedulerSourceText,
    schedulerTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, SCHEDULER_SOURCE),
    read(cwd, SCHEDULER_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    schedulerSourceText,
    schedulerTestText
  };
}

export function reviewSchedulerBoundaryAudit(
  input: SchedulerBoundaryAuditInput
): SchedulerBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit scheduler-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "scheduler-boundary"
    ),
    sourceSchedulerMarkersPresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.schedulerSourceText.includes(marker)
    ),
    coverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.schedulerTestText.includes(marker)
    ),
    noRuntimeInvocationSurface: noRuntimeInvocationSurface(
      input.schedulerSourceText
    ),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      schedulerMode: "queue_and_execution_lease_state_machine_only",
      queuedStatusIsDispatchAuthorization: false,
      leasedStatusIsExecutionAuthorization: false,
      activeLeaseIsProviderExecuteAuthorization: false,
      workerIdIsHostOrSubAgentAuthorization: false,
      releaseLeaseIsRuntimeCompletionProof: false,
      failLeaseIsRecoveryExecution: false,
      expiredLeaseIsRetryExecution: false,
      exhaustedStatusIsRuntimeBlockExecution: false,
      fileStatePersistenceIsWorkspaceWriteExecution: false,
      fileLockIsShellProcessExecution: false,
      schedulerCallsDuringAudit: 0,
      schedulerLeaseAcquisitionsDuringAudit: 0,
      schedulerStateWritesDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      toolRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatSchedulerBoundaryAuditResult(
  review: SchedulerBoundaryAuditResult,
  format: SchedulerBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Scheduler boundary audit",
    `status: ${review.status}`,
    `scheduler mode: ${review.summary.schedulerMode}`,
    `queued status is dispatch authorization: ${review.summary.queuedStatusIsDispatchAuthorization}`,
    `leased status is execution authorization: ${review.summary.leasedStatusIsExecutionAuthorization}`,
    `active lease is provider execute authorization: ${review.summary.activeLeaseIsProviderExecuteAuthorization}`,
    `worker id is host or sub-agent authorization: ${review.summary.workerIdIsHostOrSubAgentAuthorization}`,
    `releaseLease is runtime completion proof: ${review.summary.releaseLeaseIsRuntimeCompletionProof}`,
    `failLease is recovery execution: ${review.summary.failLeaseIsRecoveryExecution}`,
    `expired lease is retry execution: ${review.summary.expiredLeaseIsRetryExecution}`,
    `exhausted status is runtime block execution: ${review.summary.exhaustedStatusIsRuntimeBlockExecution}`,
    `file-state persistence is workspace-write execution: ${review.summary.fileStatePersistenceIsWorkspaceWriteExecution}`,
    `file lock is shell/process execution: ${review.summary.fileLockIsShellProcessExecution}`,
    `scheduler calls during audit: ${review.summary.schedulerCallsDuringAudit}`,
    `scheduler lease acquisitions during audit: ${review.summary.schedulerLeaseAcquisitionsDuringAudit}`,
    `scheduler state writes during audit: ${review.summary.schedulerStateWritesDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `host dispatch calls during audit: ${review.summary.hostDispatchCallsDuringAudit}`,
    `tool runtime calls during audit: ${review.summary.toolRuntimeCallsDuringAudit}`,
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
  return text.includes("Scheduler boundary")
    && text.includes("queue and execution lease state machine only")
    && text.includes("queued status is not dispatch authorization")
    && text.includes("leased status is not execution authorization")
    && text.includes("active leases are not provider execute authorization")
    && text.includes("worker ids are not host executor or sub-agent identity authorization")
    && text.includes("releaseLease is not runtime completion proof")
    && text.includes("failLease is not recovery execution")
    && text.includes("expired leases are not retry execution")
    && text.includes("exhausted status is not runtime block execution")
    && text.includes("scheduler file-state persistence is not workspace-write execution")
    && text.includes("scheduler file locks are not shell/process execution");
}

function noRuntimeInvocationSurface(text: string): boolean {
  return FORBIDDEN_RUNTIME_SOURCE_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(input: SchedulerBoundaryAuditInput): boolean {
  const output = formatSchedulerBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      sourceSchedulerMarkersPresent: true,
      coverageRecorded: true,
      noRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      schedulerMode: "queue_and_execution_lease_state_machine_only",
      queuedStatusIsDispatchAuthorization: false,
      leasedStatusIsExecutionAuthorization: false,
      activeLeaseIsProviderExecuteAuthorization: false,
      workerIdIsHostOrSubAgentAuthorization: false,
      releaseLeaseIsRuntimeCompletionProof: false,
      failLeaseIsRecoveryExecution: false,
      expiredLeaseIsRetryExecution: false,
      exhaustedStatusIsRuntimeBlockExecution: false,
      fileStatePersistenceIsWorkspaceWriteExecution: false,
      fileLockIsShellProcessExecution: false,
      schedulerCallsDuringAudit: 0,
      schedulerLeaseAcquisitionsDuringAudit: 0,
      schedulerStateWritesDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      hostDispatchCallsDuringAudit: 0,
      toolRuntimeCallsDuringAudit: 0,
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
    input.schedulerSourceText,
    input.schedulerTestText,
    output
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !aggregateText.includes(marker));
}

function collectReasons(
  checks: SchedulerBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `scheduler_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectSchedulerBoundaryAuditInput();
  const review = reviewSchedulerBoundaryAudit(input);
  console.log(formatSchedulerBoundaryAuditResult(review, format));
  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Scheduler boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
