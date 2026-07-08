#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PHASE15_SANDBOX_CLOSEOUT =
  "docs/governance/PHASE_15_AGENT_EXECUTOR_ADAPTER_SANDBOX_CONTRACT_CLOSEOUT.md";
const PHASE16_SANDBOX_CLOSEOUT =
  "docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_SANDBOX_DRY_RUN_CLOSEOUT.md";
const CURRENT_STATE = "docs/current/CURRENT_STATE.md";
const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const RECOVERY_CONTROL_SOURCE =
  "packages/governance-internal-recovery-control/src/index.ts";
const PHASE15_TEST = "tests/phase15-agent-executor-adapter-sandbox-contract.test.ts";
const PHASE16_TEST =
  "tests/phase16-agent-executor-adapter-dispatch-sandbox-dry-run.test.ts";
const PHASE15_FIXTURE =
  "tests/fixtures/phase15-sandbox-reference-agent-executor-adapter.ts";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const REQUIRED_SOURCE_MARKERS = [
  "GovernanceOperatorActionAgentExecutorAdapterSandboxContractPacketSchema",
  "GovernanceOperatorActionAgentExecutorAdapterDispatchSandboxDryRunPacketSchema",
  "adapterKind: z.literal(\"sandbox_reference_adapter\")",
  "sideEffectBoundary: z.literal(\"sandbox_only\")",
  "operator_action_agent_executor_adapter_sandbox_contract_adapter_required",
  "operator_action_agent_executor_adapter_sandbox_contract_audit_sink_required",
  "operator_action_agent_executor_adapter_dispatch_sandbox_dry_run_adapter_required",
  "operator_action_agent_executor_adapter_dispatch_sandbox_dry_run_evidence_sink_required",
  "operator_action_agent_executor_adapter_dispatch_sandbox_dry_run_adapter_kind_not_sandbox_reference",
  "phase16_sandbox_dry_run_no_real_recovery_execution"
] as const;

const REQUIRED_PHASE15_TEST_MARKERS = [
  "phase15 sandbox adapter contract run writes a sandbox artifact for fork",
  "phase15 sandbox adapter contract run is not called when audit sink is missing",
  "phase15 sandbox adapter contract run blocks before adapter when packet drifts",
  "phase15 sandbox adapter contract run hashes rollback checkpoint refs",
  "phase15 sandbox adapter contract run fails closed on unsafe adapter refs",
  "phase15 sandbox adapter contract run rejects symlink run directory escapes"
] as const;

const REQUIRED_PHASE16_TEST_MARKERS = [
  "phase16 sandbox dry-run calls injected sandbox adapter and records sanitized evidence",
  "phase16 sandbox dry-run blocks before adapter when evidence sink is missing",
  "phase16 sandbox dry-run blocks before adapter when dispatch packet drifts",
  "phase16 sandbox dry-run requires sandbox dispatch and side-effect classes",
  "phase16 sandbox dry-run binds rollback by checkpoint hash only",
  "phase16 sandbox dry-run fails closed on unsafe adapter refs",
  "phase16 sandbox dry-run records completion evidence only after final audit succeeds",
  "phase16 sandbox dry-run blocks contract packet sandbox-scope drift before adapter"
] as const;

const REQUIRED_FIXTURE_MARKERS = [
  "Phase15SandboxReferenceAgentExecutorAdapter",
  "implements GovernanceOperatorActionAgentExecutorAdapterSandboxContractAdapter",
  "sandboxRoot",
  "prepareSandboxRoot",
  "assertInsideSandbox",
  "assertSandboxRunDirUnused",
  "phase15_sandbox_symlink_escape",
  "phase15_sandbox_path_escape",
  "checkpointRefHash",
  "actionRefHash",
  "receiptIdHash",
  "adapterIdHash",
  "sandboxScopeRefHash",
  "artifact:phase15-sandbox-adapter",
  "completionMeaning: \"sandbox_contract_witness_completed\"",
  "adapterKind: \"sandbox_reference_adapter\""
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface AgentExecutorAdapterSandboxBoundaryAuditInput {
  phase15SandboxCloseoutText: string;
  phase16SandboxCloseoutText: string;
  currentStateText: string;
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  recoveryControlSourceText: string;
  phase15TestText: string;
  phase16TestText: string;
  phase15FixtureText: string;
  governanceRunnerText: string;
}

export interface AgentExecutorAdapterSandboxBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    phase15SandboxContractRecorded: boolean;
    phase16SandboxDryRunRecorded: boolean;
    currentStateRecorded: boolean;
    controlPlaneCapabilityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    implementationSurfacePresent: boolean;
    sandboxReferenceFixtureConstrained: boolean;
    failClosedCoverageRecorded: boolean;
    sandboxEvidenceSanitized: boolean;
    sandboxContainmentRecorded: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    adapterKind: "sandbox_reference_adapter";
    sideEffectBoundary: "sandbox_only";
    dispatchClass: "sandbox_contract";
    productionRecoveryExecutionAllowed: false;
    codexCliAdapterAllowed: false;
    providerAdapterAllowed: false;
    subAgentRuntimeAdapterAllowed: false;
    shellProcessAllowed: false;
    workspaceWriteAllowed: false;
    externalWriteAllowed: false;
    adapterInvocationsDuringAudit: 0;
  };
  reasons: string[];
}

export type AgentExecutorAdapterSandboxBoundaryAuditOutputFormat =
  | "text"
  | "json";

export async function collectAgentExecutorAdapterSandboxBoundaryAuditInput(
  cwd = process.cwd()
): Promise<AgentExecutorAdapterSandboxBoundaryAuditInput> {
  const [
    phase15SandboxCloseoutText,
    phase16SandboxCloseoutText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    recoveryControlSourceText,
    phase15TestText,
    phase16TestText,
    phase15FixtureText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, PHASE15_SANDBOX_CLOSEOUT),
    read(cwd, PHASE16_SANDBOX_CLOSEOUT),
    read(cwd, CURRENT_STATE),
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, RECOVERY_CONTROL_SOURCE),
    read(cwd, PHASE15_TEST),
    read(cwd, PHASE16_TEST),
    read(cwd, PHASE15_FIXTURE),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    phase15SandboxCloseoutText,
    phase16SandboxCloseoutText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    recoveryControlSourceText,
    phase15TestText,
    phase16TestText,
    phase15FixtureText,
    governanceRunnerText
  };
}

export function reviewAgentExecutorAdapterSandboxBoundaryAudit(
  input: AgentExecutorAdapterSandboxBoundaryAuditInput
): AgentExecutorAdapterSandboxBoundaryAuditResult {
  const checks = {
    phase15SandboxContractRecorded: phase15SandboxContractRecorded(
      input.phase15SandboxCloseoutText
    ),
    phase16SandboxDryRunRecorded: phase16SandboxDryRunRecorded(
      input.phase16SandboxCloseoutText
    ),
    currentStateRecorded: currentStateRecorded(input.currentStateText),
    controlPlaneCapabilityRecorded: controlPlaneCapabilityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: governanceReadmeListsBoundary(
      input.governanceReadmeText
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "agent-executor-adapter-sandbox-boundary"
    ),
    implementationSurfacePresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.recoveryControlSourceText.includes(marker)
    ),
    sandboxReferenceFixtureConstrained: REQUIRED_FIXTURE_MARKERS.every((marker) =>
      input.phase15FixtureText.includes(marker)
    ),
    failClosedCoverageRecorded:
      REQUIRED_PHASE15_TEST_MARKERS.every((marker) =>
        input.phase15TestText.includes(marker)
      )
      && REQUIRED_PHASE16_TEST_MARKERS.every((marker) =>
        input.phase16TestText.includes(marker)
      ),
    sandboxEvidenceSanitized: sandboxEvidenceSanitized(input),
    sandboxContainmentRecorded: sandboxContainmentRecorded(input),
    noBroadExecutionAuthorization: noBroadExecutionAuthorization(input),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      adapterKind: "sandbox_reference_adapter",
      sideEffectBoundary: "sandbox_only",
      dispatchClass: "sandbox_contract",
      productionRecoveryExecutionAllowed: false,
      codexCliAdapterAllowed: false,
      providerAdapterAllowed: false,
      subAgentRuntimeAdapterAllowed: false,
      shellProcessAllowed: false,
      workspaceWriteAllowed: false,
      externalWriteAllowed: false,
      adapterInvocationsDuringAudit: 0
    },
    reasons
  };
}

export function formatAgentExecutorAdapterSandboxBoundaryAuditResult(
  review: AgentExecutorAdapterSandboxBoundaryAuditResult,
  format: AgentExecutorAdapterSandboxBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Agent executor adapter sandbox boundary audit",
    `status: ${review.status}`,
    `adapter kind: ${review.summary.adapterKind}`,
    `side-effect boundary: ${review.summary.sideEffectBoundary}`,
    `dispatch class: ${review.summary.dispatchClass}`,
    `production recovery execution allowed: ${review.summary.productionRecoveryExecutionAllowed}`,
    `Codex CLI adapter allowed: ${review.summary.codexCliAdapterAllowed}`,
    `provider adapter allowed: ${review.summary.providerAdapterAllowed}`,
    `sub-agent runtime adapter allowed: ${review.summary.subAgentRuntimeAdapterAllowed}`,
    `shell/process allowed: ${review.summary.shellProcessAllowed}`,
    `workspace-write allowed: ${review.summary.workspaceWriteAllowed}`,
    `external write allowed: ${review.summary.externalWriteAllowed}`,
    `adapter invocations during audit: ${review.summary.adapterInvocationsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function phase15SandboxContractRecorded(text: string): boolean {
  return text.includes("Phase 15 Agent Executor Adapter Sandbox Contract Closeout")
    && text.includes("sandbox-only adapter contract run boundary")
    && text.includes("adapterKind = sandbox_reference_adapter")
    && text.includes("sideEffectBoundary = sandbox_only")
    && text.includes("No global adapter lookup is allowed")
    && text.includes("This closeout does not authorize")
    && text.includes("Any Codex-backed adapter, sub-agent-backed adapter");
}

function phase16SandboxDryRunRecorded(text: string): boolean {
  return text.includes("Phase 16 Agent Executor Adapter Dispatch Sandbox Dry-Run Closeout")
    && text.includes("sandbox-only dispatch dry-run boundary")
    && text.includes("requestedDispatchClass = sandbox_contract")
    && text.includes("requestedSideEffectClass = sandbox_only")
    && text.includes("adapterKind = sandbox_reference_adapter")
    && text.includes("nonAuthorizationDeclaration = phase16_sandbox_dry_run_no_real_recovery_execution")
    && text.includes("This closeout does not authorize")
    && text.includes("Any Codex-backed adapter, sub-agent-backed adapter");
}

function currentStateRecorded(text: string): boolean {
  return text.includes("Phase 15 agent executor adapter sandbox contract is closed out")
    && text.includes("Phase 16 agent executor adapter dispatch sandbox dry-run")
    && text.includes("sandbox_reference_adapter")
    && text.includes("sandbox contract binding")
    && text.includes("does not authorize Codex CLI");
}

function controlPlaneCapabilityRecorded(text: string): boolean {
  return text.includes("Agent executor adapter authorization")
    && text.includes("Agent executor adapter dispatch sandbox dry-run")
    && text.includes("sandbox_reference_adapter")
    && text.includes("sandbox contract witness")
    && text.includes("No real execution");
}

function governanceReadmeListsBoundary(text: string): boolean {
  return text.includes("Phase 15 agent executor adapter sandbox contract closeout")
    && text.includes("Phase 16 agent executor adapter dispatch sandbox dry-run closeout")
    && text.includes("npm run governance -- audit agent-executor-adapter-sandbox-boundary");
}

function sandboxEvidenceSanitized(
  input: AgentExecutorAdapterSandboxBoundaryAuditInput
): boolean {
  return input.phase15SandboxCloseoutText.includes("Raw prompts")
    && input.phase15SandboxCloseoutText.includes("are not written")
    && input.phase15FixtureText.includes("taskIdHash")
    && input.phase15FixtureText.includes("actionRefHash")
    && input.phase15FixtureText.includes("checkpointRefHash")
    && input.phase15FixtureText.includes("evidenceRefHashes")
    && input.phase15TestText.includes("serializedRecords.includes(checkpointRef), false")
    && input.phase16TestText.includes("JSON.stringify(result).includes(checkpointRef), false")
    && input.phase16TestText.includes("JSON.stringify(evidenceRecords).includes(checkpointRef), false");
}

function sandboxContainmentRecorded(
  input: AgentExecutorAdapterSandboxBoundaryAuditInput
): boolean {
  return input.phase15SandboxCloseoutText.includes("writes only under a caller-provided temporary")
    && input.phase15FixtureText.includes("realpath(root)")
    && input.phase15FixtureText.includes("assertInsideSandbox(root, target)")
    && input.phase15FixtureText.includes("phase15_sandbox_symlink_escape")
    && input.phase15FixtureText.includes("phase15_sandbox_path_escape")
    && input.phase15TestText.includes("rejects symlink run directory escapes")
    && input.phase16TestText.includes("blocks contract packet sandbox-scope drift before adapter");
}

function noBroadExecutionAuthorization(
  input: AgentExecutorAdapterSandboxBoundaryAuditInput
): boolean {
  const combined = [
    input.phase15SandboxCloseoutText,
    input.phase16SandboxCloseoutText,
    input.currentStateText,
    input.governanceControlPlaneText
  ].join("\n");

  return combined.includes("not a Codex CLI adapter")
    && countIncludes(combined, "This closeout does not authorize") >= 2
    && combined.includes("sub-agent runtime")
    && combined.includes("provider")
    && combined.includes("shell")
    && combined.includes("workspace-write")
    && combined.includes("external")
    && combined.includes("production recovery")
    && !/Agent executor adapter dispatch sandbox dry-run\s*\|\s*active[^\n|]*\|\s*Yes/i.test(combined)
    && !combined.includes("sub-agent runtime execution authorized")
    && !combined.includes("Codex-backed adapter authorized");
}

function outputSanitized(
  input: AgentExecutorAdapterSandboxBoundaryAuditInput
): boolean {
  const outputSource = [
    input.phase15SandboxCloseoutText,
    input.phase16SandboxCloseoutText,
    input.currentStateText
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !outputSource.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `agent_executor_adapter_sandbox_boundary_${name}`);
}

function countIncludes(text: string, marker: string): number {
  return text.split(marker).length - 1;
}

async function main(): Promise<void> {
  const input = await collectAgentExecutorAdapterSandboxBoundaryAuditInput();
  const review = reviewAgentExecutorAdapterSandboxBoundaryAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatAgentExecutorAdapterSandboxBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Agent executor adapter sandbox boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
