import type {
  ApprovalDecision,
  RoutingDecision,
  TaskEnvelope,
  TaskEnvelopeInput
} from "../../contracts/src/index.js";
import { parseTaskEnvelope } from "../../contracts/src/index.js";
import type { PolicySnapshot } from "../../policy-config/src/index.js";

export function evaluateApprovalRequirement(
  taskInput: TaskEnvelopeInput,
  decision: RoutingDecision,
  policy: PolicySnapshot
): ApprovalDecision {
  const task: TaskEnvelope = parseTaskEnvelope(taskInput);
  if (!decision.approval.required) {
    return {
      status: "not_required",
      reasons: []
    };
  }

  const reasons = [...decision.approval.reasons];

  if (task.repoContext.protectedBranch) {
    reasons.push("repo_context:protected_branch");
  }

  if (!task.repoContext.worktreeClean && task.repoContext.worktreeClean !== undefined) {
    reasons.push("workspace:dirty");
  }

  const deduped = [...new Set(reasons)];
  return {
    status: deduped.length > 0 ? "pending" : "not_required",
    reasons: deduped,
    gateId: deduped.length > 0 ? `gate-${task.taskId}` : undefined
  };
}

export function assertApprovalResolved(
  approval: ApprovalDecision
): void {
  if (approval.status === "pending" || approval.status === "rejected" || approval.status === "expired") {
    throw new Error(`Approval gate unresolved: ${approval.status}`);
  }
}
