import type { HostRoute } from "../../contracts/src/index.js";
import type { CodexCliExecPlan, CodexCliProcessRunOptions, CodexCliProcessRunResult } from "../../codex-cli-host/src/index.js";
import {
  createCodexCliExecPlanFromRoutingDecision,
  runCodexCliExecPlan
} from "../../codex-cli-host/src/index.js";
import type { DesktopDecisionRunnerResult } from "../../desktop-decision-runner/src/index.js";

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

function verifyCodexCliRunnerResult(
  runnerResult: DesktopDecisionRunnerResult
): string | undefined {
  if (runnerResult.decision.hostRoute !== "codex-cli") {
    return `host_dispatcher_unexpected_host_route:${runnerResult.decision.hostRoute}`;
  }

  return undefined;
}
