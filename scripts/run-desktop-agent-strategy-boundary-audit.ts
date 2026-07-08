#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const DESKTOP_AGENT_STRATEGY_SOURCE =
  "packages/desktop-agent-strategy/src/index.ts";
const DESKTOP_AGENT_STRATEGY_TEST = "tests/desktop-agent-strategy.test.ts";
const DESKTOP_DECISION_RUNNER_TEST = "tests/desktop-decision-runner.test.ts";

const REQUIRED_SOURCE_MARKERS = [
  "WorkerAssignment",
  "AgentStrategyPlan",
  "planAgentStrategy",
  "parallel: boolean",
  "maxAgents: number",
  "assignments: WorkerAssignment[]",
  "mode: \"read_only\" | \"write\"",
  "ownership?: string[]",
  "profile_disallows_parallel",
  "write_scope_needs_explicit_ownership",
  "write_parallelism_allowed_with_ownership",
  "read_only_parallelism_allowed",
  "Math.min(options.availableAgents, fileTargets.length, decision.parallelism.maxAgents)",
  "Math.min(options.availableAgents, decision.parallelism.maxAgents)"
] as const;

const REQUIRED_TEST_MARKERS = [
  "desktop agent strategy allows bounded read-only parallelism",
  "desktop agent strategy disables write parallelism without ownership",
  "desktop agent strategy bounds write ownership assignments to files and max agents",
  "desktop decision runner returns ready execution package for safe read-only work",
  "desktop decision runner read-only result can dry-run provider dispatch"
] as const;

const FORBIDDEN_RUNTIME_SOURCE_MARKERS = [
  "provider.execute(",
  ".executeProvider(",
  "dispatchReadOnlyRunnerResultToProvider",
  "runCodexCli(",
  "CodexCliExecutorProvider",
  "runDesktopTask(",
  "resumeDesktopTask(",
  "dispatchToHost(",
  "invokePrimitive",
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

export interface DesktopAgentStrategyBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  desktopAgentStrategySourceText: string;
  desktopAgentStrategyTestText: string;
  desktopDecisionRunnerTestText: string;
}

export interface DesktopAgentStrategyBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    sourceMarkersPresent: boolean;
    coverageRecorded: boolean;
    noRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    desktopAgentStrategyMode: "agent_assignment_and_ownership_plan_only";
    parallelPlanIsSubAgentRuntimeAuthorization: false;
    workerAssignmentIsRuntimeInvocation: false;
    writeModeIsWorkspaceWriteExecution: false;
    ownershipTargetIsWorkspaceWriteAuthorization: false;
    maxAgentsIsSubAgentSpawnAuthorization: false;
    readOnlyAnalystIsProviderExecutionAuthorization: false;
    strategyReasonIsExecutionGate: false;
    desktopAgentStrategyCallsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    desktopPrimitiveCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    hostDispatchCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type DesktopAgentStrategyBoundaryAuditOutputFormat = "text" | "json";

export async function collectDesktopAgentStrategyBoundaryAuditInput(
  cwd = process.cwd()
): Promise<DesktopAgentStrategyBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    desktopAgentStrategySourceText,
    desktopAgentStrategyTestText,
    desktopDecisionRunnerTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, DESKTOP_AGENT_STRATEGY_SOURCE),
    read(cwd, DESKTOP_AGENT_STRATEGY_TEST),
    read(cwd, DESKTOP_DECISION_RUNNER_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    desktopAgentStrategySourceText,
    desktopAgentStrategyTestText,
    desktopDecisionRunnerTestText
  };
}

export function reviewDesktopAgentStrategyBoundaryAudit(
  input: DesktopAgentStrategyBoundaryAuditInput
): DesktopAgentStrategyBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit desktop-agent-strategy-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "desktop-agent-strategy-boundary"
    ),
    sourceMarkersPresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.desktopAgentStrategySourceText.includes(marker)
    ),
    coverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      [
        input.desktopAgentStrategyTestText,
        input.desktopDecisionRunnerTestText
      ].join("\n").includes(marker)
    ),
    noRuntimeInvocationSurface: noRuntimeInvocationSurface(
      input.desktopAgentStrategySourceText
    ),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      desktopAgentStrategyMode: "agent_assignment_and_ownership_plan_only",
      parallelPlanIsSubAgentRuntimeAuthorization: false,
      workerAssignmentIsRuntimeInvocation: false,
      writeModeIsWorkspaceWriteExecution: false,
      ownershipTargetIsWorkspaceWriteAuthorization: false,
      maxAgentsIsSubAgentSpawnAuthorization: false,
      readOnlyAnalystIsProviderExecutionAuthorization: false,
      strategyReasonIsExecutionGate: false,
      desktopAgentStrategyCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      desktopPrimitiveCallsDuringAudit: 0,
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

export function formatDesktopAgentStrategyBoundaryAuditResult(
  review: DesktopAgentStrategyBoundaryAuditResult,
  format: DesktopAgentStrategyBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Desktop agent strategy boundary audit",
    `status: ${review.status}`,
    `desktop agent strategy mode: ${review.summary.desktopAgentStrategyMode}`,
    `parallel plan is sub-agent runtime authorization: ${review.summary.parallelPlanIsSubAgentRuntimeAuthorization}`,
    `worker assignment is runtime invocation: ${review.summary.workerAssignmentIsRuntimeInvocation}`,
    `write mode is workspace-write execution: ${review.summary.writeModeIsWorkspaceWriteExecution}`,
    `ownership target is workspace-write authorization: ${review.summary.ownershipTargetIsWorkspaceWriteAuthorization}`,
    `maxAgents is sub-agent spawn authorization: ${review.summary.maxAgentsIsSubAgentSpawnAuthorization}`,
    `read-only analyst is provider execution authorization: ${review.summary.readOnlyAnalystIsProviderExecutionAuthorization}`,
    `strategy reason is execution gate: ${review.summary.strategyReasonIsExecutionGate}`,
    `desktop agent strategy calls during audit: ${review.summary.desktopAgentStrategyCallsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `desktop primitive calls during audit: ${review.summary.desktopPrimitiveCallsDuringAudit}`,
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
  return text.includes("Desktop agent strategy boundary")
    && text.includes("agent assignment and ownership plan only")
    && text.includes("parallel plans are not sub-agent runtime authorization")
    && text.includes("worker assignments are not runtime invocation")
    && text.includes("write mode is not workspace-write execution")
    && text.includes("ownership targets are not workspace-write authorization")
    && text.includes("maxAgents is not sub-agent spawn authorization")
    && text.includes("read-only analyst assignments are not provider execution authorization")
    && text.includes("strategy reasons are not execution gates");
}

function noRuntimeInvocationSurface(text: string): boolean {
  return FORBIDDEN_RUNTIME_SOURCE_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(input: DesktopAgentStrategyBoundaryAuditInput): boolean {
  const output = formatDesktopAgentStrategyBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      sourceMarkersPresent: true,
      coverageRecorded: true,
      noRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      desktopAgentStrategyMode: "agent_assignment_and_ownership_plan_only",
      parallelPlanIsSubAgentRuntimeAuthorization: false,
      workerAssignmentIsRuntimeInvocation: false,
      writeModeIsWorkspaceWriteExecution: false,
      ownershipTargetIsWorkspaceWriteAuthorization: false,
      maxAgentsIsSubAgentSpawnAuthorization: false,
      readOnlyAnalystIsProviderExecutionAuthorization: false,
      strategyReasonIsExecutionGate: false,
      desktopAgentStrategyCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      desktopPrimitiveCallsDuringAudit: 0,
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
    input.desktopAgentStrategySourceText,
    output
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !aggregateText.includes(marker));
}

function collectReasons(
  checks: DesktopAgentStrategyBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `desktop_agent_strategy_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectDesktopAgentStrategyBoundaryAuditInput();
  const review = reviewDesktopAgentStrategyBoundaryAudit(input);
  console.log(formatDesktopAgentStrategyBoundaryAuditResult(review, format));
  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Desktop agent strategy boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
