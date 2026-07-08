#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";
const GOVERNANCE_FAILURE_REDUCER_SOURCE =
  "packages/governance-failure-reducer/src/index.ts";
const GOVERNANCE_FAILURE_REDUCER_TEST = "tests/governance-failure-reducer.test.ts";

const REQUIRED_SOURCE_MARKERS = [
  "ApplyExecutionFailureInput",
  "ApplyExecutionFailureOutput",
  "applyExecutionFailureToGovernanceState",
  "parseExecutionObservation",
  "scoreGovernanceRisk",
  "routeStrategyV2",
  "createArbitrationPacket",
  "kind: \"execution_failure\"",
  "strikeNumber",
  "normalizeEvidenceRefs",
  "return value.trim()"
] as const;

const REQUIRED_PURITY_MARKERS = [
  "Pure reducer: does not mutate input state, does not call callbacks,",
  "does not persist. The caller is responsible for onGovernanceUpdate",
  "state: GovernanceState = {",
  "anomalies: [...input.state.anomalies, anomaly]",
  "updatedAt: timestamp"
] as const;

const REQUIRED_TEST_MARKERS = [
  "reducer returns all expected output fields",
  "reducer appends execution_failure anomaly with strike 1 on clean state",
  "reducer preserves supplied evidence refs on anomaly and arbitration packet",
  "reducer normalizes evidence refs by trimming, de-duping, and dropping empty values",
  "reducer increments strikeNumber when same-kind anomalies exist",
  "reducer caps strikeNumber at 3",
  "reducer re-scores risk differently from initial state after failure",
  "reducer re-routes strategy based on updated state",
  "reducer routes step_back on high risk with third strike",
  "reducer creates arbitration packet with third_anomaly trigger on third strike",
  "reducer creates arbitration packet with first_anomaly trigger on first failure",
  "reducer does not mutate input state"
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

export interface GovernanceFailureReducerBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  governanceRunnerText: string;
  failureReducerSourceText: string;
  failureReducerTestText: string;
}

export interface GovernanceFailureReducerBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneAuthorityRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    reducerMarkersPresent: boolean;
    purityMarkersPresent: boolean;
    coverageRecorded: boolean;
    noRuntimeInvocationSurface: boolean;
    outputSanitized: boolean;
  };
  summary: {
    failureReducerMode: "pure_failure_to_governance_state_reducer_only";
    executionFailureIsRecoveryAuthorization: false;
    strategyDecisionIsRuntimeAuthorization: false;
    arbitrationPacketIsRecoveryExecution: false;
    recoveryRecommendationIsHostExecutorAuthorization: false;
    anomalyRecordIsRuntimeInvocation: false;
    evidenceRefIsReplayAuthorization: false;
    riskScoreIsProviderExecutionAuthorization: false;
    reducerStateUpdateIsWorkspaceWriteExecution: false;
    reducerCallsCallbacksDuringAudit: 0;
    reducerPersistenceWritesDuringAudit: 0;
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

export type GovernanceFailureReducerBoundaryAuditOutputFormat = "text" | "json";

export async function collectGovernanceFailureReducerBoundaryAuditInput(
  cwd = process.cwd()
): Promise<GovernanceFailureReducerBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    failureReducerSourceText,
    failureReducerTestText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, GOVERNANCE_RUNNER),
    read(cwd, GOVERNANCE_FAILURE_REDUCER_SOURCE),
    read(cwd, GOVERNANCE_FAILURE_REDUCER_TEST)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    governanceRunnerText,
    failureReducerSourceText,
    failureReducerTestText
  };
}

export function reviewGovernanceFailureReducerBoundaryAudit(
  input: GovernanceFailureReducerBoundaryAuditInput
): GovernanceFailureReducerBoundaryAuditResult {
  const checks = {
    controlPlaneAuthorityRecorded: controlPlaneAuthorityRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit governance-failure-reducer-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "governance-failure-reducer-boundary"
    ),
    reducerMarkersPresent: REQUIRED_SOURCE_MARKERS.every((marker) =>
      input.failureReducerSourceText.includes(marker)
    ),
    purityMarkersPresent: REQUIRED_PURITY_MARKERS.every((marker) =>
      input.failureReducerSourceText.includes(marker)
    ),
    coverageRecorded: REQUIRED_TEST_MARKERS.every((marker) =>
      input.failureReducerTestText.includes(marker)
    ),
    noRuntimeInvocationSurface: noRuntimeInvocationSurface(
      input.failureReducerSourceText
    ),
    outputSanitized: outputSanitized(input)
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      failureReducerMode: "pure_failure_to_governance_state_reducer_only",
      executionFailureIsRecoveryAuthorization: false,
      strategyDecisionIsRuntimeAuthorization: false,
      arbitrationPacketIsRecoveryExecution: false,
      recoveryRecommendationIsHostExecutorAuthorization: false,
      anomalyRecordIsRuntimeInvocation: false,
      evidenceRefIsReplayAuthorization: false,
      riskScoreIsProviderExecutionAuthorization: false,
      reducerStateUpdateIsWorkspaceWriteExecution: false,
      reducerCallsCallbacksDuringAudit: 0,
      reducerPersistenceWritesDuringAudit: 0,
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

export function formatGovernanceFailureReducerBoundaryAuditResult(
  review: GovernanceFailureReducerBoundaryAuditResult,
  format: GovernanceFailureReducerBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Governance failure reducer boundary audit",
    `status: ${review.status}`,
    `failure reducer mode: ${review.summary.failureReducerMode}`,
    `execution failure is recovery authorization: ${review.summary.executionFailureIsRecoveryAuthorization}`,
    `strategy decision is runtime authorization: ${review.summary.strategyDecisionIsRuntimeAuthorization}`,
    `arbitration packet is recovery execution: ${review.summary.arbitrationPacketIsRecoveryExecution}`,
    `recovery recommendation is host executor authorization: ${review.summary.recoveryRecommendationIsHostExecutorAuthorization}`,
    `anomaly record is runtime invocation: ${review.summary.anomalyRecordIsRuntimeInvocation}`,
    `evidence ref is replay authorization: ${review.summary.evidenceRefIsReplayAuthorization}`,
    `risk score is provider execution authorization: ${review.summary.riskScoreIsProviderExecutionAuthorization}`,
    `reducer state update is workspace-write execution: ${review.summary.reducerStateUpdateIsWorkspaceWriteExecution}`,
    `reducer callback calls during audit: ${review.summary.reducerCallsCallbacksDuringAudit}`,
    `reducer persistence writes during audit: ${review.summary.reducerPersistenceWritesDuringAudit}`,
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
  return text.includes("Governance failure reducer boundary")
    && text.includes("pure failure-to-governance-state reducer only")
    && text.includes("execution failures are not recovery authorization")
    && text.includes("strategy decisions are not runtime authorization")
    && text.includes("arbitration packets are not recovery execution")
    && text.includes("recovery recommendations are not host executor authorization")
    && text.includes("anomaly records are not runtime invocation")
    && text.includes("evidence refs are not replay authorization")
    && text.includes("risk scores are not provider execution authorization")
    && text.includes("reducer state updates are not workspace-write execution");
}

function noRuntimeInvocationSurface(text: string): boolean {
  return FORBIDDEN_RUNTIME_SOURCE_MARKERS.every((marker) => !text.includes(marker));
}

function outputSanitized(input: GovernanceFailureReducerBoundaryAuditInput): boolean {
  const output = formatGovernanceFailureReducerBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneAuthorityRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      reducerMarkersPresent: true,
      purityMarkersPresent: true,
      coverageRecorded: true,
      noRuntimeInvocationSurface: true,
      outputSanitized: true
    },
    summary: {
      failureReducerMode: "pure_failure_to_governance_state_reducer_only",
      executionFailureIsRecoveryAuthorization: false,
      strategyDecisionIsRuntimeAuthorization: false,
      arbitrationPacketIsRecoveryExecution: false,
      recoveryRecommendationIsHostExecutorAuthorization: false,
      anomalyRecordIsRuntimeInvocation: false,
      evidenceRefIsReplayAuthorization: false,
      riskScoreIsProviderExecutionAuthorization: false,
      reducerStateUpdateIsWorkspaceWriteExecution: false,
      reducerCallsCallbacksDuringAudit: 0,
      reducerPersistenceWritesDuringAudit: 0,
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
    input.failureReducerSourceText,
    input.failureReducerTestText,
    output
  ].join("\n");

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !aggregateText.includes(marker));
}

function collectReasons(
  checks: GovernanceFailureReducerBoundaryAuditResult["checks"]
): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `governance_failure_reducer_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectGovernanceFailureReducerBoundaryAuditInput();
  const review = reviewGovernanceFailureReducerBoundaryAudit(input);
  console.log(formatGovernanceFailureReducerBoundaryAuditResult(review, format));
  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(
      "Governance failure reducer boundary audit failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  });
}
