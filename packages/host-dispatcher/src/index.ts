import type { HostRoute, RoutingDecision, TaskEnvelopeInput } from "../../contracts/src/index.js";
import type { CodexCliExecPlan, CodexCliProcessRunOptions, CodexCliProcessRunResult } from "../../codex-cli-host/src/index.js";
import {
  createCodexCliExecPlanFromRoutingDecision,
  runCodexCliExecPlan
} from "../../codex-cli-host/src/index.js";

export type { HostRoute };

export interface HostDispatcherInput {
  task: TaskEnvelopeInput;
  decision: RoutingDecision;
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
  const hostRoute = input.decision.hostRoute ?? "desktop";

  if (hostRoute === "codex-cli") {
    return dispatchToCliHost(input);
  }

  return { hostRoute: "desktop" };
}

async function dispatchToCliHost(
  input: HostDispatcherInput
): Promise<HostDispatcherResult> {
  try {
    const plan = createCodexCliExecPlanFromRoutingDecision(
      input.task,
      input.decision,
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
