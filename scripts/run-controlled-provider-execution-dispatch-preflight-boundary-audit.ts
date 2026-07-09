#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const MATRIX_DOC =
  "docs/governance/CONTROLLED_PROVIDER_EXECUTION_DISPATCH_PREFLIGHT_MATRIX.md";
const PROVIDER_RUNNER_AUDIT =
  "scripts/run-provider-execution-runner-boundary-audit.ts";
const ROADMAP = "docs/agent-os-transformation/current-roadmap-20260610.md";

const REQUIRED_MATRIX_MARKERS = [
  "CONTROLLED_PROVIDER_EXECUTION_DISPATCH_PREFLIGHT_MATRIX_RECORDED",
  "This matrix is a dispatch preflight boundary for controlled provider execution.",
  "It is not general provider execute authorization.",
  "It is not real Codex CLI authorization.",
  "It is not general workspace-write authorization.",
  "does not call `provider.execute`",
  "provider id is exactly `codex-cli`",
  "side effect class is exactly `read_only`",
  "sandbox is exactly `read-only`",
  "approval policy is exactly `never`",
  "execution mode is explicitly `controlled_readonly`",
  "dry-run remains the default",
  "provider registry selection is present",
  "provider manifest matches the selected provider",
  "provider execution plan hash is bound to the selected plan",
  "provider execution permit is valid for the exact task, run, provider plan",
  "environment preflight artifact ref is present",
  "environment preflight artifact hash is present",
  "side effect class is exactly `workspace_write`",
  "workspace-write permit v2 is approved",
  "operation manifest is declared and hashed",
  "dispatcher preparation records a sanitized controlled workspace-write",
  "provider execute is forbidden",
  "real Codex CLI is forbidden",
  "runner real-execution guard is present",
  "governance strategy is not `step_back`",
  "governance strategy is not `simulate`",
  "governance phase is not `recovery`",
  "sanitized observation and evidence refs are planned before dispatch"
] as const;

const REQUIRED_STOP_MARKERS = [
  "provider id is not `codex-cli`",
  "side effect class is not `read_only`",
  "sandbox is not `read-only`",
  "approval policy is not `never`",
  "execution mode is omitted, inferred, or default-enabled",
  "provider registry selection is missing",
  "provider manifest does not match the selected provider",
  "provider execution plan hash is missing or mismatched",
  "provider execution permit is missing, expired, revoked, nonce-replayed",
  "environment preflight artifact ref is missing",
  "environment preflight artifact hash is missing or mismatched",
  "runner real-execution guard is missing",
  "governance strategy is `step_back` or `simulate`",
  "governance phase is `recovery`",
  "requested scope includes workspace-write, local command, shell/process",
  "evidence would include raw prompt, argv, stdout, stderr, command"
] as const;

const REQUIRED_MATRIX_ROWS = [
  "dry-run default",
  "controlled read-only candidate",
  "controlled workspace-write prepare",
  "controlled workspace-write candidate",
  "provider mismatch",
  "side-effect mismatch",
  "sandbox mismatch",
  "approval mismatch",
  "permit invalid",
  "preflight invalid",
  "governance stop",
  "broad scope"
] as const;

const REQUIRED_RUNNER_MARKERS = [
  "Provider execution runner boundary audit",
  "controlled_readonly_and_workspace_write_gate",
  "provider.execute",
  "controlledReadOnlyProviderId: \"codex-cli\"",
  "controlledReadOnlySideEffectClass: \"read_only\"",
  "controlledReadOnlySandbox: \"read-only\"",
  "permitRequired: true",
  "preflightArtifactBindingRequired: true",
  "realExecutionGuardRequired: true",
  "workspaceWriteProviderExecuteAllowed: false"
] as const;

const FORBIDDEN_AUTHORIZATION_MARKERS = [
  "dispatch preflight authorizes provider execute: true",
  "dispatch preflight authorizes real Codex CLI: true",
  "dispatch preflight authorizes workspace-write: true",
  "dispatch preflight calls provider.execute",
  "provider execute now",
  "enable provider execution by default"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
] as const;

export interface ControlledProviderExecutionDispatchPreflightBoundaryAuditInput {
  controlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  matrixDocText: string;
  providerRunnerAuditText: string;
  roadmapText: string;
}

export interface ControlledProviderExecutionDispatchPreflightBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    matrixRecorded: boolean;
    stopMatrixRecorded: boolean;
    matrixRowsRecorded: boolean;
    providerRunnerBoundaryReferenced: boolean;
    roadmapReferencesPortableValidation: boolean;
    noBroadAuthorization: boolean;
    outputSanitized: boolean;
  };
  summary: {
    dispatchPreflightMode: "controlled_readonly_and_workspace_write_dispatch_preflight_matrix_only";
    dispatchPreflightIsProviderExecuteAuthorization: false;
    dispatchPreflightIsRealCodexCliAuthorization: false;
    dispatchPreflightIsWorkspaceWriteAuthorization: false;
    dispatchPreflightIsHostExecutorAuthorization: false;
    dispatchPreflightIsSubAgentRuntimeAuthorization: false;
    dispatchPreflightIsShellProcessAuthorization: false;
    dispatchPreflightIsExternalWriteAuthorization: false;
    dispatchPreflightIsReleaseAuthorization: false;
    runnerRemainsFinalProviderExecuteGate: true;
    dryRunDefaultPreserved: true;
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

export type ControlledProviderExecutionDispatchPreflightBoundaryAuditOutputFormat =
  "text" | "json";

export async function collectControlledProviderExecutionDispatchPreflightBoundaryAuditInput(
  cwd = process.cwd()
): Promise<ControlledProviderExecutionDispatchPreflightBoundaryAuditInput> {
  const [
    controlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    matrixDocText,
    providerRunnerAuditText,
    roadmapText
  ] = await Promise.all([
    read(cwd, CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, MATRIX_DOC),
    read(cwd, PROVIDER_RUNNER_AUDIT),
    read(cwd, ROADMAP)
  ]);

  return {
    controlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    matrixDocText,
    providerRunnerAuditText,
    roadmapText
  };
}

export function reviewControlledProviderExecutionDispatchPreflightBoundaryAudit(
  input: ControlledProviderExecutionDispatchPreflightBoundaryAuditInput
): ControlledProviderExecutionDispatchPreflightBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded:
      input.controlPlaneText.includes("Controlled provider execution dispatch preflight boundary")
      && input.controlPlaneText.includes("controlled_readonly_and_workspace_write_dispatch_preflight_matrix_only"),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "CONTROLLED_PROVIDER_EXECUTION_DISPATCH_PREFLIGHT_MATRIX.md"
    ) && input.governanceReadmeText.includes(
      "npm run governance -- audit controlled-provider-execution-dispatch-preflight-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "controlled-provider-execution-dispatch-preflight-boundary"
    ),
    matrixRecorded: REQUIRED_MATRIX_MARKERS.every((marker) =>
      input.matrixDocText.includes(marker)
    ),
    stopMatrixRecorded: REQUIRED_STOP_MARKERS.every((marker) =>
      input.matrixDocText.includes(marker)
    ),
    matrixRowsRecorded: REQUIRED_MATRIX_ROWS.every((marker) =>
      input.matrixDocText.includes(marker)
    ),
    providerRunnerBoundaryReferenced:
      REQUIRED_RUNNER_MARKERS.every((marker) =>
        input.providerRunnerAuditText.includes(marker)
      )
      && input.matrixDocText.includes("provider execution runner boundary"),
    roadmapReferencesPortableValidation:
      input.roadmapText.includes("portable validation baseline")
      && input.roadmapText.includes("content digest only")
      && input.roadmapText.includes(
        "controlled provider execution dispatch preflight matrix"
      ),
    noBroadAuthorization: noBroadAuthorization(input),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      dispatchPreflightMode: "controlled_readonly_and_workspace_write_dispatch_preflight_matrix_only",
      dispatchPreflightIsProviderExecuteAuthorization: false,
      dispatchPreflightIsRealCodexCliAuthorization: false,
      dispatchPreflightIsWorkspaceWriteAuthorization: false,
      dispatchPreflightIsHostExecutorAuthorization: false,
      dispatchPreflightIsSubAgentRuntimeAuthorization: false,
      dispatchPreflightIsShellProcessAuthorization: false,
      dispatchPreflightIsExternalWriteAuthorization: false,
      dispatchPreflightIsReleaseAuthorization: false,
      runnerRemainsFinalProviderExecuteGate: true,
      dryRunDefaultPreserved: true,
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

export function formatControlledProviderExecutionDispatchPreflightBoundaryAuditResult(
  review: ControlledProviderExecutionDispatchPreflightBoundaryAuditResult,
  format: ControlledProviderExecutionDispatchPreflightBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Controlled provider execution dispatch preflight boundary audit",
    `status: ${review.status}`,
    `dispatch preflight mode: ${review.summary.dispatchPreflightMode}`,
    `dispatch preflight is provider execute authorization: ${review.summary.dispatchPreflightIsProviderExecuteAuthorization}`,
    `dispatch preflight is real Codex CLI authorization: ${review.summary.dispatchPreflightIsRealCodexCliAuthorization}`,
    `dispatch preflight is workspace-write authorization: ${review.summary.dispatchPreflightIsWorkspaceWriteAuthorization}`,
    `dispatch preflight is host executor authorization: ${review.summary.dispatchPreflightIsHostExecutorAuthorization}`,
    `dispatch preflight is sub-agent runtime authorization: ${review.summary.dispatchPreflightIsSubAgentRuntimeAuthorization}`,
    `dispatch preflight is shell/process authorization: ${review.summary.dispatchPreflightIsShellProcessAuthorization}`,
    `dispatch preflight is external-write authorization: ${review.summary.dispatchPreflightIsExternalWriteAuthorization}`,
    `dispatch preflight is release authorization: ${review.summary.dispatchPreflightIsReleaseAuthorization}`,
    `runner remains final provider execute gate: ${review.summary.runnerRemainsFinalProviderExecuteGate}`,
    `dry-run default preserved: ${review.summary.dryRunDefaultPreserved}`,
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

function noBroadAuthorization(
  input: ControlledProviderExecutionDispatchPreflightBoundaryAuditInput
): boolean {
  const text = [
    input.controlPlaneText,
    input.governanceReadmeText,
    input.matrixDocText,
    input.roadmapText
  ].join("\n");

  return FORBIDDEN_AUTHORIZATION_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(
  input: ControlledProviderExecutionDispatchPreflightBoundaryAuditInput
): boolean {
  const review: ControlledProviderExecutionDispatchPreflightBoundaryAuditResult = {
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      matrixRecorded: true,
      stopMatrixRecorded: true,
      matrixRowsRecorded: true,
      providerRunnerBoundaryReferenced: true,
      roadmapReferencesPortableValidation: true,
      noBroadAuthorization: true,
      outputSanitized: true
    },
    summary: {
      dispatchPreflightMode: "controlled_readonly_and_workspace_write_dispatch_preflight_matrix_only",
      dispatchPreflightIsProviderExecuteAuthorization: false,
      dispatchPreflightIsRealCodexCliAuthorization: false,
      dispatchPreflightIsWorkspaceWriteAuthorization: false,
      dispatchPreflightIsHostExecutorAuthorization: false,
      dispatchPreflightIsSubAgentRuntimeAuthorization: false,
      dispatchPreflightIsShellProcessAuthorization: false,
      dispatchPreflightIsExternalWriteAuthorization: false,
      dispatchPreflightIsReleaseAuthorization: false,
      runnerRemainsFinalProviderExecuteGate: true,
      dryRunDefaultPreserved: true,
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
  };
  const text = formatControlledProviderExecutionDispatchPreflightBoundaryAuditResult(review);
  const json = formatControlledProviderExecutionDispatchPreflightBoundaryAuditResult(
    review,
    "json"
  );

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !text.includes(marker))
    && FORBIDDEN_OUTPUT_MARKERS.every((marker) => !json.includes(marker))
    && FORBIDDEN_OUTPUT_MARKERS.every((marker) =>
      !input.matrixDocText.includes(marker)
    );
}

function collectReasons(
  checks: ControlledProviderExecutionDispatchPreflightBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) =>
      `controlled_provider_execution_dispatch_preflight_boundary_${name}`
    );
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input =
    await collectControlledProviderExecutionDispatchPreflightBoundaryAuditInput();
  const review =
    reviewControlledProviderExecutionDispatchPreflightBoundaryAudit(input);
  console.log(
    formatControlledProviderExecutionDispatchPreflightBoundaryAuditResult(
      review,
      format
    )
  );

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
