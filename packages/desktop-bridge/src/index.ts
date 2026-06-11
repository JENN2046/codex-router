import type {
  DesktopExecutionPlan,
  DesktopOperation,
  RoutingDecision
} from "../../contracts/src/index.js";

export interface DesktopExecutionPlanOptions {
  authorized?: boolean;
}

export function createDesktopExecutionPlan(
  decision: RoutingDecision,
  options: DesktopExecutionPlanOptions = {}
): DesktopExecutionPlan {
  const primitives: DesktopOperation[] = [
    { primitive: "read_thread_terminal" as const, reason: "read current thread context before dispatch" }
  ];

  if (decision.parallelism.mode === "read_only") {
    primitives.push({ primitive: "spawn_agent", reason: "parallel read-only exploration is allowed" });
    primitives.push({ primitive: "wait_agent", reason: "collect explorer output before final synthesis" });
  } else {
    primitives.push({ primitive: "send_input", reason: "continue within the current desktop conversation" });
  }

  if (options.authorized === true && decision.execution.toolAccess !== "read_only") {
    primitives.push({ primitive: "shell_command", reason: "local execution is required for implementation or validation" });
    primitives.push({ primitive: "apply_patch", reason: "file edits must stay minimal and reversible" });
  }

  if (decision.approval.required) {
    primitives.push({ primitive: "automation_update", reason: "approval wait or later follow-up may require scheduling" });
  }

  return {
    executionProfile: decision.execution.executionProfile,
    primitives,
    notes: [
      `model:${decision.execution.selectedModel}`,
      `tool_access:${decision.execution.toolAccess}`,
      `approval:${decision.approval.required ? "required" : "not_required"}`,
      `plan_mode:${options.authorized === true ? "authorized" : "candidate"}`
    ]
  };
}
