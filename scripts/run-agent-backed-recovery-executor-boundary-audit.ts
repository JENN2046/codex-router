#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PHASE13_AGENT_BACKED_BOUNDARY =
  "docs/governance/PHASE_13_AGENT_BACKED_RECOVERY_EXECUTOR_BOUNDARY.md";
const CURRENT_STATE = "docs/current/CURRENT_STATE.md";
const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const PHASE13_TEST = "tests/phase13-agent-backed-recovery-executor-boundary.test.ts";
const PHASE13_FIXTURE =
  "tests/fixtures/phase13-sandbox-reference-recovery-executor.ts";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const RECOVERY_ACTIONS = ["resume", "rollback", "abort", "fork"] as const;

const REQUIRED_FIXTURE_MARKERS = [
  "Phase13SandboxReferenceRecoveryExecutor",
  "implements GovernanceOperatorActionHostExecutorDispatchExecutor",
  "sandboxRoot",
  "prepareSandboxRoot",
  "assertInsideSandbox",
  "assertSandboxRunDirUnused",
  "phase13_sandbox_symlink_escape",
  "phase13_sandbox_path_escape",
  "checkpointRefHash",
  "actionRefHash",
  "receiptIdHash",
  "artifact:phase13-sandbox-reference",
  "completionMeaning: \"dispatch_transaction_completed\"",
  "executorKind: \"sandbox_reference\""
] as const;

const REQUIRED_TEST_MARKERS = [
  "phase13 sandbox reference executor dispatches approved fork into sandbox",
  "phase13 sandbox reference executor is not called when audit sink is missing",
  "phase13 sandbox reference executor hashes rollback checkpoint refs",
  "phase13 sandbox reference executor maps resume and abort to sandbox status files",
  "phase13 dispatch fails closed when an executor returns unsafe evidence refs",
  "phase13 sandbox reference executor rejects symlink run directory escapes",
  "executorKind, \"sandbox_reference\"",
  "completionMeaning, \"dispatch_transaction_completed\"",
  "phase13_sandbox_symlink_escape"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface AgentBackedRecoveryExecutorBoundaryAuditInput {
  phase13AgentBackedBoundaryText: string;
  currentStateText: string;
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  phase13TestText: string;
  phase13FixtureText: string;
  governanceRunnerText: string;
}

export interface AgentBackedRecoveryExecutorBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    phase13BoundaryRecorded: boolean;
    currentStateRecorded: boolean;
    controlPlaneCapabilityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    sandboxReferenceFixtureConstrained: boolean;
    sandboxReferenceTestCoverageRecorded: boolean;
    taskControlSemanticsOnly: boolean;
    sandboxEvidenceSanitized: boolean;
    sandboxContainmentRecorded: boolean;
    noProductionExecutorAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    executorBoundary: "host_provided_agent_backed";
    sandboxReferenceKind: "sandbox_reference";
    recoveryActions: typeof RECOVERY_ACTIONS;
    productionRecoveryExecutionAllowed: false;
    codexCliAdapterAllowed: false;
    providerAdapterAllowed: false;
    subAgentRuntimeInvocationAllowedByRouter: false;
    shellProcessAllowed: false;
    workspaceWriteAllowed: false;
    externalWriteAllowed: false;
    sandboxExecutorInvocationsDuringAudit: 0;
  };
  reasons: string[];
}

export type AgentBackedRecoveryExecutorBoundaryAuditOutputFormat =
  | "text"
  | "json";

export async function collectAgentBackedRecoveryExecutorBoundaryAuditInput(
  cwd = process.cwd()
): Promise<AgentBackedRecoveryExecutorBoundaryAuditInput> {
  const [
    phase13AgentBackedBoundaryText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    phase13TestText,
    phase13FixtureText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, PHASE13_AGENT_BACKED_BOUNDARY),
    read(cwd, CURRENT_STATE),
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, PHASE13_TEST),
    read(cwd, PHASE13_FIXTURE),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    phase13AgentBackedBoundaryText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    phase13TestText,
    phase13FixtureText,
    governanceRunnerText
  };
}

export function reviewAgentBackedRecoveryExecutorBoundaryAudit(
  input: AgentBackedRecoveryExecutorBoundaryAuditInput
): AgentBackedRecoveryExecutorBoundaryAuditResult {
  const checks = {
    phase13BoundaryRecorded: phase13BoundaryRecorded(
      input.phase13AgentBackedBoundaryText
    ),
    currentStateRecorded: currentStateRecorded(input.currentStateText),
    controlPlaneCapabilityRecorded: controlPlaneCapabilityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: governanceReadmeListsBoundary(
      input.governanceReadmeText
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "agent-backed-recovery-executor-boundary"
    ),
    sandboxReferenceFixtureConstrained: sandboxReferenceFixtureConstrained(
      input.phase13FixtureText
    ),
    sandboxReferenceTestCoverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.phase13TestText.includes(marker)
    ),
    taskControlSemanticsOnly: taskControlSemanticsOnly(input),
    sandboxEvidenceSanitized: sandboxEvidenceSanitized(input),
    sandboxContainmentRecorded: sandboxContainmentRecorded(input),
    noProductionExecutorAuthorization: noProductionExecutorAuthorization(input),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      executorBoundary: "host_provided_agent_backed",
      sandboxReferenceKind: "sandbox_reference",
      recoveryActions: RECOVERY_ACTIONS,
      productionRecoveryExecutionAllowed: false,
      codexCliAdapterAllowed: false,
      providerAdapterAllowed: false,
      subAgentRuntimeInvocationAllowedByRouter: false,
      shellProcessAllowed: false,
      workspaceWriteAllowed: false,
      externalWriteAllowed: false,
      sandboxExecutorInvocationsDuringAudit: 0
    },
    reasons
  };
}

export function formatAgentBackedRecoveryExecutorBoundaryAuditResult(
  review: AgentBackedRecoveryExecutorBoundaryAuditResult,
  format: AgentBackedRecoveryExecutorBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Agent-backed recovery executor boundary audit",
    `status: ${review.status}`,
    `executor boundary: ${review.summary.executorBoundary}`,
    `sandbox reference kind: ${review.summary.sandboxReferenceKind}`,
    `recovery actions: ${review.summary.recoveryActions.join(",")}`,
    `production recovery execution allowed: ${review.summary.productionRecoveryExecutionAllowed}`,
    `Codex CLI adapter allowed: ${review.summary.codexCliAdapterAllowed}`,
    `provider adapter allowed: ${review.summary.providerAdapterAllowed}`,
    `sub-agent runtime invocation allowed by router: ${review.summary.subAgentRuntimeInvocationAllowedByRouter}`,
    `shell/process allowed: ${review.summary.shellProcessAllowed}`,
    `workspace-write allowed: ${review.summary.workspaceWriteAllowed}`,
    `external write allowed: ${review.summary.externalWriteAllowed}`,
    `sandbox executor invocations during audit: ${review.summary.sandboxExecutorInvocationsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function phase13BoundaryRecorded(text: string): boolean {
  return text.includes("Phase 13 Agent-Backed Recovery Executor Boundary")
    && text.includes("codex-router` is a governance kernel")
    && text.includes("Production recovery execution is host-provided")
    && text.includes("This boundary does not authorize")
    && text.includes("sandbox-only controlled side effects used as contract proof")
    && text.includes("It is not a real business recovery")
    && text.includes("Sandbox reference executor")
    && text.includes("not a production executor")
    && text.includes("Any production host executor, Codex CLI-backed executor");
}

function currentStateRecorded(text: string): boolean {
  return text.includes("Phase 13 agent-backed recovery executor boundary is recorded")
    && text.includes("PHASE_13_AGENT_BACKED_RECOVERY_EXECUTOR_BOUNDARY_RECORDED")
    && text.includes("host-provided / agent-backed executor semantics")
    && text.includes("sandbox-only reference")
    && text.includes("production recovery execution remains");
}

function controlPlaneCapabilityRecorded(text: string): boolean {
  return text.includes("[Phase 13 Agent-Backed Recovery Executor Boundary](PHASE_13_AGENT_BACKED_RECOVERY_EXECUTOR_BOUNDARY.md)")
    && text.includes("| `PHASE_13_AGENT_BACKED_RECOVERY_EXECUTOR_BOUNDARY.md` | Agent-backed recovery executor boundary |")
    && text.includes("| Agent-backed recovery executor boundary | active / sandbox proof only | No production execution |")
    && text.includes("It does not add business recovery logic, Codex CLI, provider, shell, external write, or arbitrary workspace-write execution");
}

function governanceReadmeListsBoundary(text: string): boolean {
  return text.includes("Phase 13 agent-backed recovery executor boundary")
    && text.includes("sandbox-only reference executor contract proof")
    && text.includes("production recovery execution authorization")
    && text.includes("npm run governance -- audit agent-backed-recovery-executor-boundary");
}

function sandboxReferenceFixtureConstrained(text: string): boolean {
  return REQUIRED_FIXTURE_MARKERS.every((marker) => text.includes(marker))
    && RECOVERY_ACTIONS.every((action) =>
      action === "fork"
        ? text.includes("lineage")
        : text.includes("${invocation.recommendedAction}.completed.json")
    )
    && !text.includes("CodexCliRecoveryExecutor")
    && !text.includes("ProductionRecoveryExecutor")
    && !text.includes("dispatchToHost(");
}

function taskControlSemanticsOnly(
  input: AgentBackedRecoveryExecutorBoundaryAuditInput
): boolean {
  return input.phase13AgentBackedBoundaryText.includes(
    "These are task-control semantics"
  )
    && input.phase13AgentBackedBoundaryText.includes("business implementation details")
    && RECOVERY_ACTIONS.every((action) =>
      input.phase13AgentBackedBoundaryText.includes(`\`${action}\``)
    )
    && input.phase13FixtureText.includes(
      "completionMeaning: \"dispatch_transaction_completed\""
    )
    && input.phase13TestText.includes(
      "completionMeaning, \"dispatch_transaction_completed\""
    );
}

function sandboxEvidenceSanitized(
  input: AgentBackedRecoveryExecutorBoundaryAuditInput
): boolean {
  return input.phase13AgentBackedBoundaryText.includes(
    "writes only hash/status/ref evidence"
  )
    && input.phase13AgentBackedBoundaryText.includes(
      "hashes rollback checkpoint refs"
    )
    && input.phase13FixtureText.includes("taskIdHash")
    && input.phase13FixtureText.includes("actionRefHash")
    && input.phase13FixtureText.includes("receiptIdHash")
    && input.phase13FixtureText.includes("evidenceRefHashes")
    && input.phase13TestText.includes("includes(context.gate.actionRef ?? \"\"), false")
    && input.phase13TestText.includes("serializedRecords.includes(checkpointRef), false");
}

function sandboxContainmentRecorded(
  input: AgentBackedRecoveryExecutorBoundaryAuditInput
): boolean {
  return input.phase13AgentBackedBoundaryText.includes("canonicalizes the sandbox root")
    && input.phase13AgentBackedBoundaryText.includes("rejects existing symlink run directories")
    && input.phase13FixtureText.includes("realpath(root)")
    && input.phase13FixtureText.includes("assertInsideSandbox(root, target)")
    && input.phase13FixtureText.includes("phase13_sandbox_symlink_escape")
    && input.phase13FixtureText.includes("phase13_sandbox_path_escape")
    && input.phase13TestText.includes("rejects symlink run directory escapes");
}

function noProductionExecutorAuthorization(
  input: AgentBackedRecoveryExecutorBoundaryAuditInput
): boolean {
  const combined = [
    input.phase13AgentBackedBoundaryText,
    input.currentStateText,
    input.governanceControlPlaneText
  ].join("\n");

  return combined.includes("not a production executor")
    && combined.includes("not a real business recovery")
    && combined.includes("does not authorize `codex-router`")
    && combined.includes("Codex CLI invocation")
    && combined.includes("provider invocation")
    && combined.includes("workspace-wide writes")
    && combined.includes("external service writes")
    && combined.includes("secret, credential")
    && !/Agent-backed recovery executor boundary\s*\|\s*active[^\n|]*\|\s*Yes/i.test(combined);
}

function outputSanitized(
  input: AgentBackedRecoveryExecutorBoundaryAuditInput
): boolean {
  const outputSource = [
    input.phase13AgentBackedBoundaryText,
    input.currentStateText,
    input.governanceControlPlaneText
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !outputSource.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `agent_backed_recovery_executor_boundary_${name}`);
}

async function main(): Promise<void> {
  const input = await collectAgentBackedRecoveryExecutorBoundaryAuditInput();
  const review = reviewAgentBackedRecoveryExecutorBoundaryAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatAgentBackedRecoveryExecutorBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Agent-backed recovery executor boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
