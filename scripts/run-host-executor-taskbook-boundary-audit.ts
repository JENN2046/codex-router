#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PHASE11_TASKBOOK =
  "docs/governance/PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_TASKBOOK.md";
const PHASE13_TASKBOOK =
  "docs/governance/PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_TASKBOOK.md";
const CURRENT_STATE = "docs/current/CURRENT_STATE.md";
const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const REQUIRED_PHASE11_MARKERS = [
  "Phase 11 Operator Action Host Executor Boundary Taskbook",
  "Phase 11 defines the next non-executing boundary",
  "without dispatching the action",
  "This taskbook is local-only. It does not authorize executing `resume`,\n`rollback`, `abort`, or `fork`",
  "APPROVE_PHASE_11_HOST_EXECUTOR_BOUNDARY_DESIGN_SLICE",
  "require an explicit injected host executor descriptor",
  "without calling the executor",
  "The first Phase 11 implementation must not introduce:",
  "a side-effecting host executor implementation",
  "direct calls to `dispatchToHost()` for recovery action execution",
  "provider execute calls during Phase 11 boundary review: `0`",
  "real Codex CLI calls during Phase 11 boundary review: `0`",
  "workspace-write calls during Phase 11 boundary review: `0`",
  "recovery action dispatch calls during Phase 11 boundary review: `0`",
  "external write calls during Phase 11 boundary review: `0`",
  "This taskbook does not authorize:",
  "PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_TASKBOOK_RECORDED",
  "Recovery execution remains closed"
] as const;

const REQUIRED_PHASE13_MARKERS = [
  "Phase 13 Operator Action Host Executor Dispatch Taskbook",
  "Phase 13 defines the authorization boundary for any future side-effecting host\nexecutor dispatch",
  "This taskbook is design and governance memory only",
  "It does not authorize\nimplementing, testing, invoking, simulating as real, or running recovery action\ndispatch",
  "The next implementation step is blocked until Jenn explicitly authorizes the\nexact future dispatch slice",
  "APPROVE_PHASE_13_HOST_EXECUTOR_DISPATCH_IMPLEMENTATION_SLICE",
  "A host executor descriptor must stay explicitly injected and review-bound",
  "dispatch must be an explicit injected dependency, not a global lookup",
  "dispatch must have a dry-run / pre-dispatch validation mode before any real\n  side effect",
  "dispatch must not broaden into provider execution, real Codex CLI execution,\n  workspace-write, shell/process execution",
  "Stop and report `BLOCK` unless Jenn's active instruction contains the exact\nPhase 13 authorization token",
  "This taskbook does not authorize:",
  "calling `dispatchToHost()` for recovery action execution",
  "The next safe step without Jenn's explicit authorization is limited to\nread-only review"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface HostExecutorTaskbookBoundaryAuditInput {
  phase11TaskbookText: string;
  phase13TaskbookText: string;
  currentStateText: string;
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
}

export interface HostExecutorTaskbookBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    phase11TaskbookRecorded: boolean;
    phase13TaskbookRecorded: boolean;
    currentStateRecordsTaskbooks: boolean;
    controlPlaneRecordsTaskbookAuthority: boolean;
    governanceReadmeListsTaskbooks: boolean;
    governanceRunnerRegistered: boolean;
    phase11ImplementationGateRemainsNonExecuting: boolean;
    phase13DispatchGateRemainsAuthorizationStop: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    phase11GateToken: "APPROVE_PHASE_11_HOST_EXECUTOR_BOUNDARY_DESIGN_SLICE";
    phase13GateToken: "APPROVE_PHASE_13_HOST_EXECUTOR_DISPATCH_IMPLEMENTATION_SLICE";
    phase11TaskbookMode: "non_executing_authorization_packet_design";
    phase13TaskbookMode: "authorization_stop";
    taskbookExecutionAuthorized: false;
    hostExecutorInvocationsDuringAudit: 0;
    recoveryActionDispatchCallsDuringAudit: 0;
    realCodexCliCallsDuringAudit: 0;
    providerCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type HostExecutorTaskbookBoundaryAuditOutputFormat = "text" | "json";

export async function collectHostExecutorTaskbookBoundaryAuditInput(
  cwd = process.cwd()
): Promise<HostExecutorTaskbookBoundaryAuditInput> {
  const [
    phase11TaskbookText,
    phase13TaskbookText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, PHASE11_TASKBOOK),
    read(cwd, PHASE13_TASKBOOK),
    read(cwd, CURRENT_STATE),
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    phase11TaskbookText,
    phase13TaskbookText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText
  };
}

export function reviewHostExecutorTaskbookBoundaryAudit(
  input: HostExecutorTaskbookBoundaryAuditInput
): HostExecutorTaskbookBoundaryAuditResult {
  const checks = {
    phase11TaskbookRecorded: REQUIRED_PHASE11_MARKERS.every((marker) =>
      input.phase11TaskbookText.includes(marker)
    ),
    phase13TaskbookRecorded: REQUIRED_PHASE13_MARKERS.every((marker) =>
      input.phase13TaskbookText.includes(marker)
    ),
    currentStateRecordsTaskbooks: currentStateRecordsTaskbooks(
      input.currentStateText
    ),
    controlPlaneRecordsTaskbookAuthority: controlPlaneRecordsTaskbookAuthority(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsTaskbooks: governanceReadmeListsTaskbooks(
      input.governanceReadmeText
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "host-executor-taskbook-boundary"
    ),
    phase11ImplementationGateRemainsNonExecuting:
      phase11ImplementationGateRemainsNonExecuting(input.phase11TaskbookText),
    phase13DispatchGateRemainsAuthorizationStop:
      phase13DispatchGateRemainsAuthorizationStop(input.phase13TaskbookText),
    noBroadExecutionAuthorization: noBroadExecutionAuthorization(input),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      phase11GateToken: "APPROVE_PHASE_11_HOST_EXECUTOR_BOUNDARY_DESIGN_SLICE",
      phase13GateToken: "APPROVE_PHASE_13_HOST_EXECUTOR_DISPATCH_IMPLEMENTATION_SLICE",
      phase11TaskbookMode: "non_executing_authorization_packet_design",
      phase13TaskbookMode: "authorization_stop",
      taskbookExecutionAuthorized: false,
      hostExecutorInvocationsDuringAudit: 0,
      recoveryActionDispatchCallsDuringAudit: 0,
      realCodexCliCallsDuringAudit: 0,
      providerCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatHostExecutorTaskbookBoundaryAuditResult(
  review: HostExecutorTaskbookBoundaryAuditResult,
  format: HostExecutorTaskbookBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Host executor taskbook boundary audit",
    `status: ${review.status}`,
    `Phase 11 taskbook mode: ${review.summary.phase11TaskbookMode}`,
    `Phase 13 taskbook mode: ${review.summary.phase13TaskbookMode}`,
    `taskbook execution authorized: ${review.summary.taskbookExecutionAuthorized}`,
    `host executor invocations during audit: ${review.summary.hostExecutorInvocationsDuringAudit}`,
    `recovery action dispatch calls during audit: ${review.summary.recoveryActionDispatchCallsDuringAudit}`,
    `real Codex CLI calls during audit: ${review.summary.realCodexCliCallsDuringAudit}`,
    `provider calls during audit: ${review.summary.providerCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `shell/process calls during audit: ${review.summary.shellProcessCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function currentStateRecordsTaskbooks(text: string): boolean {
  return text.includes("PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_TASKBOOK.md")
    && text.includes("PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_TASKBOOK.md")
    && text.includes("future non-executing authorization packet")
    && text.includes("authorization token and stop conditions");
}

function controlPlaneRecordsTaskbookAuthority(text: string): boolean {
  return text.includes("PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_TASKBOOK.md")
    && text.includes(
      "Current human authority for the next non-executing authorization packet and injected host executor descriptor boundary; not execution authorization."
    )
    && text.includes("PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_TASKBOOK.md")
    && text.includes(
      "Current authorization stop for any future side-effecting recovery action dispatch implementation; not execution authorization."
    );
}

function governanceReadmeListsTaskbooks(text: string): boolean {
  return text.includes(
    "[Phase 11 operator action host executor boundary taskbook](PHASE_11_OPERATOR_ACTION_HOST_EXECUTOR_BOUNDARY_TASKBOOK.md)"
  )
    && text.includes("future non-executing authorization packet")
    && text.includes(
      "[Phase 13 operator action host executor dispatch taskbook](PHASE_13_OPERATOR_ACTION_HOST_EXECUTOR_DISPATCH_TASKBOOK.md)"
    )
    && text.includes("current authorization stop for any future side-effecting recovery action");
}

function phase11ImplementationGateRemainsNonExecuting(text: string): boolean {
  return text.includes("Exact token for a later non-executing implementation gate")
    && text.includes("APPROVE_PHASE_11_HOST_EXECUTOR_BOUNDARY_DESIGN_SLICE")
    && text.includes("The first Phase 11 implementation may only add a non-executing authorization")
    && text.includes("produce an authorization result")
    && text.includes("without calling the executor")
    && text.includes("any code path attempts to execute the action during authorization review");
}

function phase13DispatchGateRemainsAuthorizationStop(text: string): boolean {
  return text.includes("Authorization Stop")
    && text.includes("blocked until Jenn explicitly authorizes")
    && text.includes("APPROVE_PHASE_13_HOST_EXECUTOR_DISPATCH_IMPLEMENTATION_SLICE")
    && text.includes("Stop and report `BLOCK` unless Jenn's active instruction contains the exact\nPhase 13 authorization token")
    && text.includes("read-only review of this taskbook");
}

function noBroadExecutionAuthorization(
  input: HostExecutorTaskbookBoundaryAuditInput
): boolean {
  const text = [
    input.phase11TaskbookText,
    input.phase13TaskbookText,
    input.governanceControlPlaneText,
    input.governanceReadmeText
  ].join("\n");

  return text.includes("does not authorize executing `resume`")
    && text.includes("does not authorize real provider execution")
    && text.includes("does not authorize invoking the real Codex CLI")
    && text.includes("does not authorize\nimplementing, testing, invoking, simulating as real, or running recovery action\ndispatch")
    && text.includes("not execution authorization")
    && !text.includes("taskbook execution authorized: true")
    && !text.includes("default real execution allowed: true")
    && !text.includes("workspace-write allowed by this boundary: true")
    && !text.includes("sub-agent runtime execution authorized");
}

function outputSanitized(): boolean {
  const review: HostExecutorTaskbookBoundaryAuditResult = {
    status: "passed",
    checks: {
      phase11TaskbookRecorded: true,
      phase13TaskbookRecorded: true,
      currentStateRecordsTaskbooks: true,
      controlPlaneRecordsTaskbookAuthority: true,
      governanceReadmeListsTaskbooks: true,
      governanceRunnerRegistered: true,
      phase11ImplementationGateRemainsNonExecuting: true,
      phase13DispatchGateRemainsAuthorizationStop: true,
      noBroadExecutionAuthorization: true,
      outputSanitized: true
    },
    summary: {
      phase11GateToken: "APPROVE_PHASE_11_HOST_EXECUTOR_BOUNDARY_DESIGN_SLICE",
      phase13GateToken: "APPROVE_PHASE_13_HOST_EXECUTOR_DISPATCH_IMPLEMENTATION_SLICE",
      phase11TaskbookMode: "non_executing_authorization_packet_design",
      phase13TaskbookMode: "authorization_stop",
      taskbookExecutionAuthorized: false,
      hostExecutorInvocationsDuringAudit: 0,
      recoveryActionDispatchCallsDuringAudit: 0,
      realCodexCliCallsDuringAudit: 0,
      providerCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  };
  const text = formatHostExecutorTaskbookBoundaryAuditResult(review);
  const json = formatHostExecutorTaskbookBoundaryAuditResult(review, "json");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !text.includes(marker))
    && FORBIDDEN_OUTPUT_MARKERS.every((marker) => !json.includes(marker));
}

function collectReasons(
  checks: HostExecutorTaskbookBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `host_executor_taskbook_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectHostExecutorTaskbookBoundaryAuditInput();
  const review = reviewHostExecutorTaskbookBoundaryAudit(input);
  console.log(formatHostExecutorTaskbookBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isDirect = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirect) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
