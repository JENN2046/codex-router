#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PHASE15_REVIEW_CLOSEOUT =
  "docs/governance/PHASE_15_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_CLOSEOUT.md";
const PHASE16_REVIEW_CLOSEOUT =
  "docs/governance/PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md";
const CURRENT_STATE = "docs/current/CURRENT_STATE.md";
const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const RECOVERY_CONTROL_SOURCE =
  "packages/governance-internal-recovery-control/src/index.ts";
const RECOVERY_CONTROL_TEST = "tests/recovery-control.test.ts";
const PHASE16_AUTHORIZATION_TEST =
  "tests/phase16-agent-executor-adapter-dispatch-authorization.test.ts";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const REQUIRED_SOURCE_MARKERS = [
  "GovernanceOperatorActionAgentExecutorAdapterDescriptorSchema",
  "adapterKind: GovernanceOperatorActionAgentExecutorAdapterKindSchema",
  "executionBoundary: z.literal(\"review_only\")",
  "invocationSupported: z.literal(false)",
  "sideEffectBoundary: z.literal(\"none\")",
  "GovernanceOperatorActionAgentExecutorAdapterReviewPacketSchema",
  "reviewGovernanceOperatorActionAgentExecutorAdapterReadiness",
  "GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationPacketSchema",
  "GovernanceOperatorActionAgentExecutorAdapterDispatchAuthorizationReviewResultSchema",
  "reviewGovernanceOperatorActionAgentExecutorAdapterDispatchAuthorization",
  "requestedDispatchClass: \"review_only\"",
  "requestedSideEffectClass: \"none\"",
  "phase16_review_only_no_adapter_invocation"
] as const;

const REQUIRED_REVIEW_TEST_MARKERS = [
  "recovery control accepts review-only agent executor adapter readiness",
  "recovery control blocks review-only agent executor adapter with wrong approval string",
  "recovery control blocks agent executor adapter descriptors that claim invocation support",
  "recovery control blocks agent executor adapter descriptor hash drift",
  "recovery control blocks agent executor adapter descriptors without action support",
  "readiness.invocationSupported, false",
  "readiness.adapterKind, \"sub_agent_adapter\""
] as const;

const REQUIRED_DISPATCH_TEST_MARKERS = [
  "phase16 dispatch authorization accepts review-only adapter dispatch review",
  "phase16 dispatch authorization blocks non-review dispatch classes",
  "phase16 dispatch authorization blocks adapter readiness hash drift",
  "phase16 dispatch authorization requires sandbox proof for sandbox contract class",
  "phase16 dispatch authorization blocks supplied readiness drift",
  "phase16 dispatch authorization requires supplied adapter readiness",
  "phase16 dispatch authorization binds rollback by checkpoint hash only",
  "requestedDispatchClass, \"review_only\"",
  "requestedSideEffectClass, \"none\"",
  "nonAuthorizationDeclaration, \"phase16_review_only_no_adapter_invocation\""
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface AgentExecutorAdapterReviewBoundaryAuditInput {
  phase15ReviewCloseoutText: string;
  phase16ReviewCloseoutText: string;
  currentStateText: string;
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  recoveryControlSourceText: string;
  recoveryControlTestText: string;
  phase16AuthorizationTestText: string;
  governanceRunnerText: string;
}

export interface AgentExecutorAdapterReviewBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    phase15ReviewOnlyRecorded: boolean;
    phase16ReviewOnlyRecorded: boolean;
    currentStateRecorded: boolean;
    controlPlaneCapabilityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    implementationSurfacePresent: boolean;
    reviewOnlyDescriptorConstrained: boolean;
    dispatchReviewOnlyConstrained: boolean;
    failClosedCoverageRecorded: boolean;
    rollbackEvidenceSanitized: boolean;
    noBroadExecutionAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    adapterKind: "sub_agent_adapter";
    executionBoundary: "review_only";
    invocationSupported: false;
    sideEffectBoundary: "none";
    dispatchClass: "review_only";
    dispatchSideEffectClass: "none";
    adapterInvocationAllowed: false;
    subAgentRuntimeInvocationAllowed: false;
    codexCliInvocationAllowed: false;
    providerInvocationAllowed: false;
    shellProcessAllowed: false;
    workspaceWriteAllowed: false;
    externalWriteAllowed: false;
    adapterInvocationsDuringAudit: 0;
  };
  reasons: string[];
}

export type AgentExecutorAdapterReviewBoundaryAuditOutputFormat =
  | "text"
  | "json";

export async function collectAgentExecutorAdapterReviewBoundaryAuditInput(
  cwd = process.cwd()
): Promise<AgentExecutorAdapterReviewBoundaryAuditInput> {
  const [
    phase15ReviewCloseoutText,
    phase16ReviewCloseoutText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    recoveryControlSourceText,
    recoveryControlTestText,
    phase16AuthorizationTestText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, PHASE15_REVIEW_CLOSEOUT),
    read(cwd, PHASE16_REVIEW_CLOSEOUT),
    read(cwd, CURRENT_STATE),
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, RECOVERY_CONTROL_SOURCE),
    read(cwd, RECOVERY_CONTROL_TEST),
    read(cwd, PHASE16_AUTHORIZATION_TEST),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    phase15ReviewCloseoutText,
    phase16ReviewCloseoutText,
    currentStateText,
    governanceControlPlaneText,
    governanceReadmeText,
    recoveryControlSourceText,
    recoveryControlTestText,
    phase16AuthorizationTestText,
    governanceRunnerText
  };
}

export function reviewAgentExecutorAdapterReviewBoundaryAudit(
  input: AgentExecutorAdapterReviewBoundaryAuditInput
): AgentExecutorAdapterReviewBoundaryAuditResult {
  const checks = {
    phase15ReviewOnlyRecorded: phase15ReviewOnlyRecorded(
      input.phase15ReviewCloseoutText
    ),
    phase16ReviewOnlyRecorded: phase16ReviewOnlyRecorded(
      input.phase16ReviewCloseoutText
    ),
    currentStateRecorded: currentStateRecorded(input.currentStateText),
    controlPlaneCapabilityRecorded: controlPlaneCapabilityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: governanceReadmeListsBoundary(
      input.governanceReadmeText
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "agent-executor-adapter-review-boundary"
    ),
    implementationSurfacePresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.recoveryControlSourceText.includes(marker)
    ),
    reviewOnlyDescriptorConstrained: reviewOnlyDescriptorConstrained(input),
    dispatchReviewOnlyConstrained: dispatchReviewOnlyConstrained(input),
    failClosedCoverageRecorded:
      REQUIRED_REVIEW_TEST_MARKERS.every((marker) =>
        input.recoveryControlTestText.includes(marker)
      )
      && REQUIRED_DISPATCH_TEST_MARKERS.every((marker) =>
        input.phase16AuthorizationTestText.includes(marker)
      ),
    rollbackEvidenceSanitized: rollbackEvidenceSanitized(input),
    noBroadExecutionAuthorization: noBroadExecutionAuthorization(input),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      adapterKind: "sub_agent_adapter",
      executionBoundary: "review_only",
      invocationSupported: false,
      sideEffectBoundary: "none",
      dispatchClass: "review_only",
      dispatchSideEffectClass: "none",
      adapterInvocationAllowed: false,
      subAgentRuntimeInvocationAllowed: false,
      codexCliInvocationAllowed: false,
      providerInvocationAllowed: false,
      shellProcessAllowed: false,
      workspaceWriteAllowed: false,
      externalWriteAllowed: false,
      adapterInvocationsDuringAudit: 0
    },
    reasons
  };
}

export function formatAgentExecutorAdapterReviewBoundaryAuditResult(
  review: AgentExecutorAdapterReviewBoundaryAuditResult,
  format: AgentExecutorAdapterReviewBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Agent executor adapter review boundary audit",
    `status: ${review.status}`,
    `adapter kind: ${review.summary.adapterKind}`,
    `execution boundary: ${review.summary.executionBoundary}`,
    `invocation supported: ${review.summary.invocationSupported}`,
    `side-effect boundary: ${review.summary.sideEffectBoundary}`,
    `dispatch class: ${review.summary.dispatchClass}`,
    `dispatch side-effect class: ${review.summary.dispatchSideEffectClass}`,
    `adapter invocation allowed: ${review.summary.adapterInvocationAllowed}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `Codex CLI invocation allowed: ${review.summary.codexCliInvocationAllowed}`,
    `provider invocation allowed: ${review.summary.providerInvocationAllowed}`,
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

function phase15ReviewOnlyRecorded(text: string): boolean {
  return text.includes("Phase 15 Agent Executor Adapter Review-Only Closeout")
    && text.includes("review-only readiness boundary")
    && text.includes("executionBoundary = review_only")
    && text.includes("invocationSupported = false")
    && text.includes("sideEffectBoundary = none")
    && text.includes("The boundary is intentionally\nnon-executing")
    && text.includes("This closeout does not authorize");
}

function phase16ReviewOnlyRecorded(text: string): boolean {
  return text.includes("Phase 16 Agent Executor Adapter Dispatch Authorization Review-Only Closeout")
    && text.includes("review-only dispatch authorization boundary")
    && text.includes("requestedDispatchClass = review_only")
    && text.includes("requestedSideEffectClass = none")
    && text.includes("phase16_review_only_no_adapter_invocation")
    && text.includes("not invoke an adapter")
    && text.includes("This closeout does not authorize");
}

function currentStateRecorded(text: string): boolean {
  return text.includes("Phase 15 agent executor adapter review-only closeout")
    && text.includes("Phase 16 agent executor adapter dispatch authorization review-only")
    && text.includes("without adding adapter invocation")
    && text.includes("Codex CLI invocation")
    && text.includes("sub-agent runtime invocation");
}

function controlPlaneCapabilityRecorded(text: string): boolean {
  return text.includes("PHASE_15_AGENT_EXECUTOR_ADAPTER_REVIEW_ONLY_CLOSEOUT.md")
    && text.includes("PHASE_16_AGENT_EXECUTOR_ADAPTER_DISPATCH_AUTHORIZATION_REVIEW_ONLY_CLOSEOUT.md")
    && text.includes("Sub-agent runtime execution boundary")
    && text.includes("`sub_agent_adapter` may appear only as a review identity")
    && text.includes("invocationSupported: false");
}

function governanceReadmeListsBoundary(text: string): boolean {
  return text.includes("Phase 15 agent executor adapter review-only closeout")
    && text.includes("Phase 16 agent executor adapter dispatch authorization review-only closeout")
    && text.includes("npm run governance -- audit agent-executor-adapter-review-boundary");
}

function reviewOnlyDescriptorConstrained(
  input: AgentExecutorAdapterReviewBoundaryAuditInput
): boolean {
  return input.recoveryControlSourceText.includes(
    "executionBoundary: z.literal(\"review_only\")"
  )
    && input.recoveryControlSourceText.includes(
      "invocationSupported: z.literal(false)"
    )
    && input.recoveryControlSourceText.includes(
      "sideEffectBoundary: z.literal(\"none\")"
    )
    && input.recoveryControlTestText.includes(
      "blocks agent executor adapter descriptors that claim invocation support"
    )
    && input.recoveryControlTestText.includes("readiness.adapterKind, \"sub_agent_adapter\"");
}

function dispatchReviewOnlyConstrained(
  input: AgentExecutorAdapterReviewBoundaryAuditInput
): boolean {
  return input.recoveryControlSourceText.includes("requestedDispatchClass: \"review_only\"")
    && input.recoveryControlSourceText.includes("requestedSideEffectClass: \"none\"")
    && input.recoveryControlSourceText.includes(
      "phase16_review_only_no_adapter_invocation"
    )
    && input.recoveryControlSourceText.includes(
      "operator_action_agent_executor_adapter_dispatch_authorization_dispatch_class_not_review_only"
    )
    && input.recoveryControlSourceText.includes(
      "operator_action_agent_executor_adapter_dispatch_authorization_side_effect_class_not_none"
    )
    && input.phase16AuthorizationTestText.includes(
      "blocks non-review dispatch classes"
    )
    && input.phase16AuthorizationTestText.includes(
      "requires sandbox proof for sandbox contract class"
    );
}

function rollbackEvidenceSanitized(
  input: AgentExecutorAdapterReviewBoundaryAuditInput
): boolean {
  return input.phase16ReviewCloseoutText.includes("rollback checkpoint binding by `checkpointRefHash` only")
    && input.phase16AuthorizationTestText.includes(
      "binds rollback by checkpoint hash only"
    )
    && input.phase16AuthorizationTestText.includes(
      "JSON.stringify(result).includes(checkpointRef), false"
    )
    && input.phase16AuthorizationTestText.includes(
      "JSON.stringify(context.dispatchAuthorizationPacket).includes(checkpointRef), false"
    );
}

function noBroadExecutionAuthorization(
  input: AgentExecutorAdapterReviewBoundaryAuditInput
): boolean {
  const combined = [
    input.phase15ReviewCloseoutText,
    input.phase16ReviewCloseoutText,
    input.currentStateText,
    input.governanceControlPlaneText
  ].join("\n");

  return countIncludes(combined, "This closeout does not authorize") >= 2
    && combined.includes("adapter invocation")
    && combined.includes("Codex CLI")
    && combined.includes("sub-agent")
    && combined.includes("provider")
    && combined.includes("shell")
    && combined.includes("workspace")
    && combined.includes("external")
    && !combined.includes("sub-agent runtime execution authorized")
    && !combined.includes("adapter invocation allowed")
    && !combined.includes("invocationSupported = true")
    && !combined.includes("requestedSideEffectClass = sandbox_only");
}

function outputSanitized(
  input: AgentExecutorAdapterReviewBoundaryAuditInput
): boolean {
  const outputSource = [
    input.phase15ReviewCloseoutText,
    input.phase16ReviewCloseoutText,
    input.currentStateText
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !outputSource.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => `agent_executor_adapter_review_boundary_${name}`);
}

function countIncludes(text: string, marker: string): number {
  return text.split(marker).length - 1;
}

async function main(): Promise<void> {
  const input = await collectAgentExecutorAdapterReviewBoundaryAuditInput();
  const review = reviewAgentExecutorAdapterReviewBoundaryAudit(input);
  const format = process.argv.includes("--json") ? "json" : "text";

  console.log(formatAgentExecutorAdapterReviewBoundaryAuditResult(review, format));

  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      "Agent executor adapter review boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
