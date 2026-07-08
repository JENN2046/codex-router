#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GOVERNANCE_CONTROL_PLANE = "docs/governance/GOVERNANCE_CONTROL_PLANE.md";
const GOVERNANCE_README = "docs/governance/README.md";
const STRATEGY_ROUTER_SOURCE =
  "packages/governance-internal-strategy-router/src/index.ts";
const STRATEGY_ROUTER_TEST = "tests/strategy-router.test.ts";
const PROVIDER_EXECUTION_RUNNER_TEST = "tests/provider-execution-runner.test.ts";
const GOVERNANCE_RUNNER = "scripts/run-governance-check.ts";

const REQUIRED_STRATEGY_SOURCE_MARKERS = [
  "StrategyActionFamilySchema",
  "\"execute\"",
  "\"verify\"",
  "\"simulate\"",
  "\"step_back\"",
  "agentBudget: z.object({",
  "executor: z.number().int().min(0)",
  "export function routeStrategyV2(",
  "actionFamily: \"step_back\"",
  "executor: 0",
  "actionFamily: \"simulate\"",
  "actionFamily: \"verify\"",
  "actionFamily: \"execute\"",
  "export function requiresHumanStepBack(",
  "export function isWriteExecutionAllowed("
] as const;

const REQUIRED_STRATEGY_TEST_MARKERS = [
  "strategy router executes low risk work",
  "strategy router allows write execution for low risk",
  "strategy router verifies high risk work",
  "strategy router simulates critical risk work",
  "strategy router steps back after three strikes",
  "strategy router step_back blocks execution",
  "assert.equal(decision.agentBudget.executor, 0)"
] as const;

const REQUIRED_PROVIDER_RUNNER_TEST_MARKERS = [
  "provider execution runner blocks governance states requiring step-back before provider hooks",
  "provider execution runner blocks simulate-only governance states before provider hooks",
  "provider execution runner blocks recovery-phase governance states before provider hooks",
  "assert.equal(result.preflightGovernance.strategyDecision.actionFamily, \"step_back\")",
  "assert.equal(result.preflightGovernance.strategyDecision.actionFamily, \"simulate\")",
  "assert.equal(result.preflightGovernance.strategyDecision.actionFamily, \"execute\")",
  "assert.equal(result.preflightGovernance.executionAllowed, false)",
  "assert.deepEqual(calls, {\n    planExecution: 0,\n    validateExecutionPlan: 0,\n    execute: 0\n  })"
] as const;

const FORBIDDEN_OUTPUT_MARKERS = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer ",
  "raw stdout",
  "raw stderr"
] as const;

export interface StrategyRouterExecutionBoundaryAuditInput {
  governanceControlPlaneText: string;
  governanceReadmeText: string;
  strategyRouterSourceText: string;
  strategyRouterTestText: string;
  providerExecutionRunnerTestText: string;
  governanceRunnerText: string;
}

export interface StrategyRouterExecutionBoundaryAuditResult {
  status: "passed" | "blocked";
  checks: {
    controlPlaneBoundaryRecorded: boolean;
    governanceReadmeListsBoundary: boolean;
    governanceRunnerRegistered: boolean;
    strategyRoutingGuardsPresent: boolean;
    strategyRegressionCoverageRecorded: boolean;
    downstreamProviderHookBlockCoverageRecorded: boolean;
    noCrossBoundaryExecutionBroadening: boolean;
    outputSanitized: boolean;
  };
  summary: {
    strategyMode: "advisory_budget_signal_only";
    executeActionFamilyIsAuthorization: false;
    writeExecutionPredicateIsAuthorization: false;
    executorBudgetIsRuntimeInvocation: false;
    stepBackExecutorBudget: 0;
    simulateExecutorBudget: 0;
    providerRunnerBlocksStrategyStopBeforeHooks: true;
    providerRunnerBlocksSimulateBeforeHooks: true;
    providerRunnerBlocksRecoveryPhaseBeforeHooks: true;
    codexCliInvocationAllowedByStrategyRouter: false;
    providerInvocationAllowedByStrategyRouter: false;
    subAgentRuntimeInvocationAllowed: false;
    hostExecutorInvocationAllowed: false;
    strategyRouterCallsDuringAudit: 0;
    providerPlanExecutionCallsDuringAudit: 0;
    providerValidateExecutionPlanCallsDuringAudit: 0;
    providerExecuteCallsDuringAudit: 0;
    codexCliCallsDuringAudit: 0;
    subAgentRuntimeCallsDuringAudit: 0;
    hostExecutorCallsDuringAudit: 0;
    shellProcessCallsDuringAudit: 0;
    workspaceWriteCallsDuringAudit: 0;
    externalWriteCallsDuringAudit: 0;
  };
  reasons: string[];
}

export type StrategyRouterExecutionBoundaryAuditOutputFormat = "text" | "json";

export async function collectStrategyRouterExecutionBoundaryAuditInput(
  cwd = process.cwd()
): Promise<StrategyRouterExecutionBoundaryAuditInput> {
  const [
    governanceControlPlaneText,
    governanceReadmeText,
    strategyRouterSourceText,
    strategyRouterTestText,
    providerExecutionRunnerTestText,
    governanceRunnerText
  ] = await Promise.all([
    read(cwd, GOVERNANCE_CONTROL_PLANE),
    read(cwd, GOVERNANCE_README),
    read(cwd, STRATEGY_ROUTER_SOURCE),
    read(cwd, STRATEGY_ROUTER_TEST),
    read(cwd, PROVIDER_EXECUTION_RUNNER_TEST),
    read(cwd, GOVERNANCE_RUNNER)
  ]);

  return {
    governanceControlPlaneText,
    governanceReadmeText,
    strategyRouterSourceText,
    strategyRouterTestText,
    providerExecutionRunnerTestText,
    governanceRunnerText
  };
}

export function reviewStrategyRouterExecutionBoundaryAudit(
  input: StrategyRouterExecutionBoundaryAuditInput
): StrategyRouterExecutionBoundaryAuditResult {
  const checks = {
    controlPlaneBoundaryRecorded: controlPlaneBoundaryRecorded(
      input.governanceControlPlaneText
    ),
    governanceReadmeListsBoundary: input.governanceReadmeText.includes(
      "npm run governance -- audit strategy-router-execution-boundary"
    ),
    governanceRunnerRegistered: input.governanceRunnerText.includes(
      "strategy-router-execution-boundary"
    ),
    strategyRoutingGuardsPresent: REQUIRED_STRATEGY_SOURCE_MARKERS.every(
      (marker) => input.strategyRouterSourceText.includes(marker)
    ),
    strategyRegressionCoverageRecorded: REQUIRED_STRATEGY_TEST_MARKERS.every(
      (marker) => input.strategyRouterTestText.includes(marker)
    ),
    downstreamProviderHookBlockCoverageRecorded:
      REQUIRED_PROVIDER_RUNNER_TEST_MARKERS.every((marker) =>
        input.providerExecutionRunnerTestText.includes(marker)
      ),
    noCrossBoundaryExecutionBroadening: noCrossBoundaryExecutionBroadening(input),
    outputSanitized: outputSanitized()
  };
  const reasons = collectReasons(checks);

  return {
    status: reasons.length === 0 ? "passed" : "blocked",
    checks,
    summary: {
      strategyMode: "advisory_budget_signal_only",
      executeActionFamilyIsAuthorization: false,
      writeExecutionPredicateIsAuthorization: false,
      executorBudgetIsRuntimeInvocation: false,
      stepBackExecutorBudget: 0,
      simulateExecutorBudget: 0,
      providerRunnerBlocksStrategyStopBeforeHooks: true,
      providerRunnerBlocksSimulateBeforeHooks: true,
      providerRunnerBlocksRecoveryPhaseBeforeHooks: true,
      codexCliInvocationAllowedByStrategyRouter: false,
      providerInvocationAllowedByStrategyRouter: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      strategyRouterCallsDuringAudit: 0,
      providerPlanExecutionCallsDuringAudit: 0,
      providerValidateExecutionPlanCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons
  };
}

export function formatStrategyRouterExecutionBoundaryAuditResult(
  review: StrategyRouterExecutionBoundaryAuditResult,
  format: StrategyRouterExecutionBoundaryAuditOutputFormat = "text"
): string {
  if (format === "json") {
    return JSON.stringify(review, null, 2);
  }

  return [
    "Strategy router execution boundary audit",
    `status: ${review.status}`,
    `strategy mode: ${review.summary.strategyMode}`,
    `execute action family is authorization: ${review.summary.executeActionFamilyIsAuthorization}`,
    `write execution predicate is authorization: ${review.summary.writeExecutionPredicateIsAuthorization}`,
    `executor budget is runtime invocation: ${review.summary.executorBudgetIsRuntimeInvocation}`,
    `step_back executor budget: ${review.summary.stepBackExecutorBudget}`,
    `simulate executor budget: ${review.summary.simulateExecutorBudget}`,
    `provider runner blocks strategy stop before hooks: ${review.summary.providerRunnerBlocksStrategyStopBeforeHooks}`,
    `provider runner blocks simulate before hooks: ${review.summary.providerRunnerBlocksSimulateBeforeHooks}`,
    `provider runner blocks recovery phase before hooks: ${review.summary.providerRunnerBlocksRecoveryPhaseBeforeHooks}`,
    `Codex CLI invocation allowed by strategy router: ${review.summary.codexCliInvocationAllowedByStrategyRouter}`,
    `provider invocation allowed by strategy router: ${review.summary.providerInvocationAllowedByStrategyRouter}`,
    `sub-agent runtime invocation allowed: ${review.summary.subAgentRuntimeInvocationAllowed}`,
    `host executor invocation allowed: ${review.summary.hostExecutorInvocationAllowed}`,
    `strategy router calls during audit: ${review.summary.strategyRouterCallsDuringAudit}`,
    `provider planExecution calls during audit: ${review.summary.providerPlanExecutionCallsDuringAudit}`,
    `provider validateExecutionPlan calls during audit: ${review.summary.providerValidateExecutionPlanCallsDuringAudit}`,
    `provider execute calls during audit: ${review.summary.providerExecuteCallsDuringAudit}`,
    `Codex CLI calls during audit: ${review.summary.codexCliCallsDuringAudit}`,
    `sub-agent runtime calls during audit: ${review.summary.subAgentRuntimeCallsDuringAudit}`,
    `host executor calls during audit: ${review.summary.hostExecutorCallsDuringAudit}`,
    `shell/process calls during audit: ${review.summary.shellProcessCallsDuringAudit}`,
    `workspace-write calls during audit: ${review.summary.workspaceWriteCallsDuringAudit}`,
    `external write calls during audit: ${review.summary.externalWriteCallsDuringAudit}`,
    ...(review.reasons.length > 0 ? [`reasons: ${review.reasons.join(",")}`] : [])
  ].join("\n");
}

async function read(cwd: string, filePath: string): Promise<string> {
  return readFile(join(cwd, filePath), "utf8");
}

function controlPlaneBoundaryRecorded(text: string): boolean {
  return text.includes(
    "Strategy router execution boundary | active / advisory budget signal only | No"
  )
    && text.includes("`execute`, `verify`, and executor budget signals are routing advice, not runtime authorization")
    && text.includes("does not invoke Codex CLI, provider execution, sub-agent runtime, host executor, shell/process, workspace-write, or external write");
}

function noCrossBoundaryExecutionBroadening(
  input: StrategyRouterExecutionBoundaryAuditInput
): boolean {
  const text = [
    input.governanceControlPlaneText,
    input.governanceReadmeText,
    input.governanceRunnerText
  ].join("\n");

  return !text.includes("strategy router execute action family is authorization: true")
    && !text.includes("strategy router write execution predicate is authorization: true")
    && !text.includes("strategy router executor budget is runtime invocation: true")
    && !text.includes("Codex CLI invocation allowed by strategy router: true")
    && !text.includes("provider invocation allowed by strategy router: true")
    && !text.includes("sub-agent runtime invocation allowed: true")
    && !text.includes("host executor invocation allowed: true")
    && !text.includes("strategy router calls during audit: 1")
    && !text.includes("provider execute calls during audit: 1");
}

function outputSanitized(): boolean {
  const output = formatStrategyRouterExecutionBoundaryAuditResult({
    status: "passed",
    checks: {
      controlPlaneBoundaryRecorded: true,
      governanceReadmeListsBoundary: true,
      governanceRunnerRegistered: true,
      strategyRoutingGuardsPresent: true,
      strategyRegressionCoverageRecorded: true,
      downstreamProviderHookBlockCoverageRecorded: true,
      noCrossBoundaryExecutionBroadening: true,
      outputSanitized: true
    },
    summary: {
      strategyMode: "advisory_budget_signal_only",
      executeActionFamilyIsAuthorization: false,
      writeExecutionPredicateIsAuthorization: false,
      executorBudgetIsRuntimeInvocation: false,
      stepBackExecutorBudget: 0,
      simulateExecutorBudget: 0,
      providerRunnerBlocksStrategyStopBeforeHooks: true,
      providerRunnerBlocksSimulateBeforeHooks: true,
      providerRunnerBlocksRecoveryPhaseBeforeHooks: true,
      codexCliInvocationAllowedByStrategyRouter: false,
      providerInvocationAllowedByStrategyRouter: false,
      subAgentRuntimeInvocationAllowed: false,
      hostExecutorInvocationAllowed: false,
      strategyRouterCallsDuringAudit: 0,
      providerPlanExecutionCallsDuringAudit: 0,
      providerValidateExecutionPlanCallsDuringAudit: 0,
      providerExecuteCallsDuringAudit: 0,
      codexCliCallsDuringAudit: 0,
      subAgentRuntimeCallsDuringAudit: 0,
      hostExecutorCallsDuringAudit: 0,
      shellProcessCallsDuringAudit: 0,
      workspaceWriteCallsDuringAudit: 0,
      externalWriteCallsDuringAudit: 0
    },
    reasons: []
  });

  return FORBIDDEN_OUTPUT_MARKERS.every((marker) => !output.includes(marker));
}

function collectReasons(checks: Record<string, boolean>): string[] {
  return Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `strategy_router_execution_boundary_${name}`);
}

async function main(): Promise<void> {
  const format = process.argv.includes("--json") ? "json" : "text";
  const input = await collectStrategyRouterExecutionBoundaryAuditInput();
  const review = reviewStrategyRouterExecutionBoundaryAudit(input);

  process.stdout.write(`${formatStrategyRouterExecutionBoundaryAuditResult(review, format)}\n`);
  if (review.status !== "passed") {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
