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
  const reasons = [
    ...decision.approval.reasons,
    ...collectPolicyApprovalSignals(task, decision, policy)
  ];
  const isWriteCapable = decision.execution.toolAccess !== "read_only";

  if (
    decision.classification.taskClass === "high_risk"
    || decision.classification.taskClass === "release_external_action"
  ) {
    reasons.push(`risk:${decision.classification.taskClass}`);
  }

  if (decision.classification.clarificationRequired) {
    reasons.push("clarification_required");
  }

  if (isWriteCapable && task.repoContext.protectedBranch) {
    reasons.push("repo_context:protected_branch");
  }

  if (isWriteCapable && !task.repoContext.worktreeClean && task.repoContext.worktreeClean !== undefined) {
    reasons.push("workspace:dirty");
  }

  const deduped = [...new Set(reasons)];
  return {
    status: deduped.length > 0 ? "pending" : "not_required",
    reasons: deduped,
    gateId: deduped.length > 0 ? `gate-${task.taskId}` : undefined
  };
}

function collectPolicyApprovalSignals(
  task: TaskEnvelope,
  decision: RoutingDecision,
  policy: PolicySnapshot
): string[] {
  const reasons: string[] = [];
  const haystack = `${task.intent.summary} ${task.intent.requestedAction}`.toLowerCase();
  const policyToolAccess = policy.toolPolicies[decision.classification.taskClass];

  if (policyToolAccess === undefined) {
    reasons.push(`missing_tool_policy:${decision.classification.taskClass}`);
  } else if (policy.approvalRules.protectedToolAccess.includes(policyToolAccess)) {
    reasons.push(`tool_access:${policyToolAccess}`);
  }

  for (const branch of task.target.branches) {
    if (policy.approvalRules.protectedBranches.includes(branch)) {
      reasons.push(`protected_branch:${branch}`);
    }
  }

  if (task.repoContext.branch && policy.approvalRules.protectedBranches.includes(task.repoContext.branch)) {
    reasons.push(`active_branch:${task.repoContext.branch}`);
  }

  for (const keyword of policy.approvalRules.protectedKeywords) {
    if (haystack.includes(keyword.toLowerCase())) {
      reasons.push(`keyword:${keyword}`);
    }
  }

  return [...new Set(reasons)];
}

export function assertApprovalResolved(
  approval: ApprovalDecision
): void {
  if (approval.status === "pending" || approval.status === "rejected" || approval.status === "expired") {
    throw new Error(`Approval gate unresolved: ${approval.status}`);
  }
}
