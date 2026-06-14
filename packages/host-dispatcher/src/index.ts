import type { HostRoute } from "../../contracts/src/index.js";
import type { CodexCliExecPlan, CodexCliProcessRunOptions, CodexCliProcessRunResult } from "../../codex-cli-host/src/index.js";
import {
  createCodexCliExecPlanFromRoutingDecision,
  runCodexCliExecPlan
} from "../../codex-cli-host/src/index.js";
import type { CodexCliExecutorProvider } from "../../providers/codex-cli/src/index.js";
import {
  createApprovedProviderExecutionPermit,
  createBlockedProviderExecutionPermit,
  parseExecutorExecutionPlan,
  type ExecutorExecutionPlan,
  type ExecutionPlanInput,
  type ProviderExecutionPermit,
  type ProviderExecutionResult
} from "../../provider-core/src/index.js";
import {
  legacyRoutingDecisionToPolicyDecision,
  legacyTaskAndRoutingToRunSeed,
  legacyTaskEnvelopeToKernelTask
} from "../../kernel-contracts/src/legacy-adapter.js";
import type { DesktopDecisionRunnerResult } from "../../desktop-decision-runner/src/index.js";
import {
  selectProviderForRoutingDecision,
  summarizeProviderSelectionResult,
  type ProviderRegistry,
  type ProviderSelectionSummary
} from "../../provider-registry/src/index.js";

export type { HostRoute };

export interface HostDispatcherInput {
  runnerResult: DesktopDecisionRunnerResult;
  codexCliOptions?: CodexCliProcessRunOptions;
}

export interface HostDispatcherResult {
  hostRoute: HostRoute;
  cliPlan?: CodexCliExecPlan;
  cliRun?: CodexCliProcessRunResult;
  cliError?: string;
}

export interface ReadOnlyProviderDispatchInput {
  provider: CodexCliExecutorProvider;
  plan: ExecutorExecutionPlan;
  now: string;
  dryRun?: boolean;
  providerExecutionMetadata?: Record<string, unknown>;
}

export interface ReadOnlyProviderDispatchResult {
  ok: boolean;
  status: "completed" | "failed" | "blocked" | "dry_run";
  providerId?: string;
  planId?: string;
  permitId?: string;
  taskId?: string;
  runId?: string;
  decisionId?: string;
  sideEffectClass?: string;
  sandbox?: string;
  dryRun?: boolean;
  eventCount?: number;
  parseErrorCount?: number;
  warningCount?: number;
  blockingReasons?: string[];
  timedOut?: boolean;
  killed?: boolean;
  permit?: ProviderExecutionPermit;
  providerSelection?: ProviderSelectionSummary;
  error?: {
    code: string;
    reasons: string[];
  };
}

export interface ReadOnlyRunnerProviderDispatchInput {
  runnerResult: DesktopDecisionRunnerResult;
  provider: CodexCliExecutorProvider;
  providerRegistry?: ProviderRegistry;
  now: string;
  dryRun?: boolean;
  providerExecutionMetadata?: Record<string, unknown>;
}

export interface FormalReadOnlyRunnerProviderDispatchInput {
  runnerResult: DesktopDecisionRunnerResult;
  provider: CodexCliExecutorProvider;
  providerRegistry: ProviderRegistry;
  now: string;
  dryRun?: boolean;
  providerExecutionMetadata: Record<string, unknown>;
}

export async function dispatchToHost(
  input: HostDispatcherInput
): Promise<HostDispatcherResult> {
  const verificationError = verifyRunnerResult(input.runnerResult);
  if (verificationError) {
    return {
      hostRoute: "codex-cli",
      cliError: verificationError
    };
  }

  const hostRoute = input.runnerResult.decision.hostRoute;

  if (hostRoute === "codex-cli") {
    return dispatchToCliHost(input);
  }

  return { hostRoute: "desktop" };
}

export async function dispatchReadOnlyProviderPlan(
  input: ReadOnlyProviderDispatchInput
): Promise<ReadOnlyProviderDispatchResult> {
  let plan: ExecutorExecutionPlan;
  try {
    plan = parseExecutorExecutionPlan(input.plan);
  } catch (error) {
    return createReadOnlyProviderDispatchBlockedResult(
      undefined,
      undefined,
      "host_dispatcher_provider_plan_invalid",
      [normalizeHostDispatcherError(error)]
    );
  }

  if (
    input.provider.manifest.providerId !== "codex-cli"
    || plan.providerId !== "codex-cli"
  ) {
    return createReadOnlyProviderDispatchBlockedResult(
      plan,
      undefined,
      "host_dispatcher_read_only_provider_dispatch_requires_codex_cli",
      ["host_dispatcher_read_only_provider_dispatch_requires_codex_cli"]
    );
  }

  const validation = await input.provider.validateExecutionPlan(plan);
  if (!validation.valid) {
    return createReadOnlyProviderDispatchBlockedResult(
      plan,
      undefined,
      "host_dispatcher_provider_plan_invalid",
      validation.reasons
    );
  }

  if (plan.sideEffectClass !== "read_only" || plan.sandboxProfile.mode !== "read-only") {
    const permit = createBlockedProviderExecutionPermit({
      plan,
      manifest: input.provider.manifest,
      issuedAt: input.now
    });
    return createReadOnlyProviderDispatchBlockedResult(
      plan,
      permit,
      "host_dispatcher_read_only_provider_dispatch_rejected",
      permit.reasons
    );
  }

  let permit: ProviderExecutionPermit;
  try {
    permit = createApprovedProviderExecutionPermit({
      plan,
      manifest: input.provider.manifest,
      issuedAt: input.now
    });
  } catch (error) {
    const blockedPermit = createBlockedProviderExecutionPermit({
      plan,
      manifest: input.provider.manifest,
      issuedAt: input.now,
      reasons: [normalizeHostDispatcherError(error)]
    });
    return createReadOnlyProviderDispatchBlockedResult(
      plan,
      blockedPermit,
      "host_dispatcher_read_only_provider_permit_not_approved",
      blockedPermit.reasons
    );
  }

  const execution = await input.provider.execute(plan, {
    ...(input.dryRun === true ? { dryRun: true } : { permit }),
    ...(input.providerExecutionMetadata !== undefined
      ? { metadata: input.providerExecutionMetadata }
      : {})
  });

  return createReadOnlyProviderDispatchExecutionResult(plan, permit, execution);
}

export async function dispatchReadOnlyRunnerResultToProvider(
  input: ReadOnlyRunnerProviderDispatchInput
): Promise<ReadOnlyProviderDispatchResult> {
  const reasons = validateReadOnlyRunnerResultForProviderDispatch(input.runnerResult);
  if (reasons.length > 0) {
    return createReadOnlyRunnerDispatchBlockedResult(
      input.runnerResult,
      "host_dispatcher_read_only_runner_result_rejected",
      reasons,
      input.dryRun === true
    );
  }

  const providerSelection = input.providerRegistry === undefined
    ? undefined
    : summarizeProviderSelectionResult(
        selectProviderForRoutingDecision(input.providerRegistry, input.runnerResult.decision)
      );
  if (providerSelection !== undefined && !providerSelection.selected) {
    return createReadOnlyRunnerDispatchBlockedResult(
      input.runnerResult,
      "host_dispatcher_provider_registry_selection_rejected",
      providerSelection.reasons,
      input.dryRun === true,
      providerSelection
    );
  }

  const planInput = createProviderPlanInputFromRunnerResult(
    input.runnerResult,
    input.now
  );
  const plan = await input.provider.planExecution(planInput);
  const result = await dispatchReadOnlyProviderPlan({
    provider: input.provider,
    plan,
    now: input.now,
    ...(input.dryRun === true ? { dryRun: true } : {}),
    ...(input.providerExecutionMetadata !== undefined
      ? { providerExecutionMetadata: input.providerExecutionMetadata }
      : {})
  });

  return {
    ...result,
    decisionId: input.runnerResult.decision.decisionId,
    dryRun: input.dryRun === true,
    ...(providerSelection !== undefined ? { providerSelection } : {})
  };
}

export async function dispatchFormalReadOnlyRunnerResultToProvider(
  input: FormalReadOnlyRunnerProviderDispatchInput
): Promise<ReadOnlyProviderDispatchResult> {
  const looseInput = input as FormalReadOnlyRunnerProviderDispatchInput & {
    providerRegistry?: ProviderRegistry;
    providerExecutionMetadata?: Record<string, unknown>;
  };
  const reasons = [
    ...(looseInput.providerRegistry === undefined
      ? ["host_dispatcher_formal_read_only_provider_registry_required"]
      : []),
    ...(!isRecord(looseInput.providerExecutionMetadata)
      ? ["host_dispatcher_formal_read_only_provider_metadata_required"]
      : [])
  ];

  if (reasons.length > 0) {
    return createReadOnlyRunnerDispatchBlockedResult(
      input.runnerResult,
      "host_dispatcher_formal_read_only_provider_dispatch_rejected",
      reasons,
      input.dryRun === true
    );
  }

  return dispatchReadOnlyRunnerResultToProvider({
    runnerResult: input.runnerResult,
    provider: input.provider,
    providerRegistry: looseInput.providerRegistry,
    now: input.now,
    ...(input.dryRun === true ? { dryRun: true } : {}),
    providerExecutionMetadata: looseInput.providerExecutionMetadata
  });
}

async function dispatchToCliHost(
  input: HostDispatcherInput
): Promise<HostDispatcherResult> {
  const routeError = verifyCodexCliRunnerResult(input.runnerResult);
  if (routeError) {
    return {
      hostRoute: "codex-cli",
      cliError: routeError
    };
  }

  try {
    const { task, decision } = input.runnerResult;
    const plan = createCodexCliExecPlanFromRoutingDecision(
      task,
      decision,
      { skipGitRepoCheck: true, ephemeral: true }
    );
    const run = await runCodexCliExecPlan(plan, input.codexCliOptions ?? {});

    return {
      hostRoute: "codex-cli",
      cliPlan: plan,
      cliRun: run
    };
  } catch (error) {
    return {
      hostRoute: "codex-cli",
      cliError: error instanceof Error ? error.message : String(error)
    };
  }
}

function verifyRunnerResult(
  runnerResult: DesktopDecisionRunnerResult | undefined
): string | undefined {
  if (!runnerResult) {
    return "host_dispatcher_requires_verified_runner_result";
  }

  if (runnerResult.status !== "ready") {
    return `host_dispatcher_runner_not_ready:${runnerResult.status}`;
  }

  if (!runnerResult.preflight.ok) {
    return "host_dispatcher_preflight_not_verified";
  }

  if (
    runnerResult.approval.status !== "not_required" &&
    runnerResult.approval.status !== "approved"
  ) {
    return "host_dispatcher_approval_not_verified";
  }

  if (runnerResult.decision.taskId !== runnerResult.task.taskId) {
    return `host_dispatcher_decision_task_mismatch:${runnerResult.task.taskId}:${runnerResult.decision.taskId}`;
  }

  return undefined;
}

function validateReadOnlyRunnerResultForProviderDispatch(
  runnerResult: DesktopDecisionRunnerResult
): string[] {
  const reasons: string[] = [];

  if (runnerResult.status !== "ready") {
    reasons.push("runner_result_not_ready");
  }

  if (!runnerResult.preflight.ok) {
    reasons.push("runner_result_preflight_failed");
  }

  if (
    runnerResult.approval.status !== "not_required"
    && runnerResult.approval.status !== "approved"
  ) {
    reasons.push("runner_result_approval_unresolved");
  }

  if (runnerResult.decision.hostRoute !== "codex-cli") {
    reasons.push("runner_result_host_route_not_codex_cli");
  }

  if (runnerResult.decision.execution.toolAccess !== "read_only") {
    reasons.push("runner_result_tool_access_not_read_only");
  }

  const providerGrant = runnerResult.decision.providerGrant;
  if (providerGrant === undefined) {
    reasons.push("runner_result_provider_grant_missing");
    return uniqueHostDispatcherStrings(reasons);
  }

  if (providerGrant.providerId !== "codex-cli") {
    reasons.push("runner_result_provider_grant_provider_mismatch");
  }

  if (providerGrant.sideEffectClass !== "read_only") {
    reasons.push("runner_result_provider_grant_side_effect_not_read_only");
  }

  if (providerGrant.sandboxMode !== "read-only") {
    reasons.push("runner_result_provider_grant_sandbox_not_read_only");
  }

  return uniqueHostDispatcherStrings(reasons);
}

function createProviderPlanInputFromRunnerResult(
  runnerResult: DesktopDecisionRunnerResult,
  now: string
): ExecutionPlanInput {
  const task = legacyTaskEnvelopeToKernelTask(runnerResult.task, {
    createdAt: now
  });
  const policyDecision = legacyRoutingDecisionToPolicyDecision(
    runnerResult.decision,
    {
      createdAt: now
    }
  );
  const run = legacyTaskAndRoutingToRunSeed(
    runnerResult.task,
    runnerResult.decision,
    {
      createdAt: now
    }
  );

  return {
    task,
    run,
    policyDecision,
    sandboxProfile: policyDecision.execution.sandbox,
    now
  };
}

function createReadOnlyProviderDispatchExecutionResult(
  plan: ExecutorExecutionPlan,
  permit: ProviderExecutionPermit,
  execution: ProviderExecutionResult
): ReadOnlyProviderDispatchResult {
  const summary = readProviderExecutionSummary(execution);
  const inspection = readRecord(summary?.inspection);
  const status = typeof summary?.status === "string"
    ? summary.status
    : execution.ok ? "completed" : "failed";
  const eventCount = readNumber(inspection?.eventCount);
  const parseErrorCount = readNumber(inspection?.parseErrorCount);
  const warningCount = readNumber(inspection?.warningCount ?? summary?.warningCount);
  const blockingReasons = readStringArray(inspection?.blockingReasons);
  const timedOut = readBoolean(summary?.timedOut);
  const killed = readBoolean(summary?.killed);

  return {
    ok: execution.ok,
    status: status === "dry_run" ? "dry_run" : execution.ok ? "completed" : "failed",
    providerId: plan.providerId,
    planId: plan.planId,
    permitId: permit.permitId,
    taskId: plan.taskId,
    runId: plan.runId,
    sideEffectClass: plan.sideEffectClass,
    sandbox: plan.sandboxProfile.mode,
    dryRun: status === "dry_run",
    ...(eventCount !== undefined ? { eventCount } : {}),
    ...(parseErrorCount !== undefined ? { parseErrorCount } : {}),
    ...(warningCount !== undefined ? { warningCount } : {}),
    ...(blockingReasons !== undefined ? { blockingReasons } : {}),
    ...(timedOut !== undefined ? { timedOut } : {}),
    ...(killed !== undefined ? { killed } : {}),
    permit,
    ...(execution.error ? { error: sanitizeProviderExecutionError(execution.error) } : {})
  };
}

function createReadOnlyRunnerDispatchBlockedResult(
  runnerResult: DesktopDecisionRunnerResult,
  code: string,
  reasons: string[],
  dryRun: boolean,
  providerSelection?: ProviderSelectionSummary
): ReadOnlyProviderDispatchResult {
  const providerGrant = runnerResult.decision.providerGrant;

  return {
    ok: false,
    status: "blocked",
    taskId: runnerResult.task.taskId,
    decisionId: runnerResult.decision.decisionId,
    ...(providerGrant !== undefined
      ? {
          providerId: providerGrant.providerId,
          sideEffectClass: providerGrant.sideEffectClass,
          sandbox: providerGrant.sandboxMode
        }
      : {}),
    dryRun,
    ...(providerSelection !== undefined ? { providerSelection } : {}),
    blockingReasons: [...reasons],
    error: {
      code,
      reasons: [...reasons]
    }
  };
}

function createReadOnlyProviderDispatchBlockedResult(
  plan: ExecutorExecutionPlan | undefined,
  permit: ProviderExecutionPermit | undefined,
  code: string,
  reasons: string[]
): ReadOnlyProviderDispatchResult {
  return {
    ok: false,
    status: "blocked",
    ...(plan !== undefined
      ? {
          providerId: plan.providerId,
          planId: plan.planId,
          taskId: plan.taskId,
          runId: plan.runId,
          sideEffectClass: plan.sideEffectClass,
          sandbox: plan.sandboxProfile.mode
        }
      : {}),
    ...(permit !== undefined
      ? {
          permitId: permit.permitId,
          permit
        }
      : {}),
    blockingReasons: [...reasons],
    error: {
      code,
      reasons: [...reasons]
    }
  };
}

function readProviderExecutionSummary(
  execution: ProviderExecutionResult
): Record<string, unknown> | undefined {
  const metadata = execution.artifacts?.[0]?.metadata;
  const summary = metadata?.summary;
  return readRecord(summary);
}

function sanitizeProviderExecutionError(
  error: Record<string, unknown>
): { code: string; reasons: string[] } {
  return {
    code: typeof error.code === "string"
      ? error.code
      : "host_dispatcher_provider_execution_failed",
    reasons: readStringArray(error.reasons) ?? []
  };
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? [...value]
    : undefined;
}

function uniqueHostDispatcherStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeHostDispatcherError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function verifyCodexCliRunnerResult(
  runnerResult: DesktopDecisionRunnerResult
): string | undefined {
  if (runnerResult.decision.hostRoute !== "codex-cli") {
    return `host_dispatcher_unexpected_host_route:${runnerResult.decision.hostRoute}`;
  }

  return undefined;
}
