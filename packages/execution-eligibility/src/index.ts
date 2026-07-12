import {
  evaluateTaskAdmission
} from "../../admission-control/src/index.js";
import {
  capabilityScopeToCanonicalString,
  explainCapabilityDecision,
  type CapabilityGrantLike
} from "../../capability/src/index.js";
import {
  type ApprovalPermitStore,
  hashApprovalScope,
  validateApprovalPermit
} from "../../governance-internal-approval-permit/src/index.js";
import type {
  ApprovalPermit,
  PolicyDecision,
  Principal,
  Run,
  Task
} from "../../kernel-contracts/src/index.js";

export type ExecutionEligibilityStatus =
  | "eligible"
  | "blocked"
  | "waiting_approval";

export type ExecutionEligibilityDecision = {
  status: ExecutionEligibilityStatus;
  taskId: string;
  runId: string;
  policyDecisionHash: string;
  reasons: string[];
  missingCapabilities: string[];
  requiredApprovals: string[];
  acceptedPermits: string[];
  rejectedPermits: string[];
  createdAt: string;
};

export type EvaluateExecutionEligibilityInput = {
  task: Task;
  run: Run;
  principal: Principal;
  policyDecision: PolicyDecision & {
    status?: string;
    blocked?: boolean;
  };
  capabilityGrants: CapabilityGrantLike[];
  approvalPermits: ApprovalPermit[];
  requestedScopes: string[];
  planHash: string;
  now: string;
};

export type EvaluateExecutionEligibilityWithPermitStoreInput = Omit<
  EvaluateExecutionEligibilityInput,
  "approvalPermits"
> & {
  approvalPermitStore: ApprovalPermitStore;
};

const terminalRunStatuses = new Set<Run["status"]>([
  "succeeded",
  "failed",
  "cancelled"
]);

export function evaluateExecutionEligibility(
  input: EvaluateExecutionEligibilityInput
): ExecutionEligibilityDecision {
  const base = createBaseDecision(input);

  if (terminalRunStatuses.has(input.run.status)) {
    return {
      ...base,
      status: "blocked",
      reasons: [`run_terminal:${input.run.status}`]
    };
  }

  const admission = evaluateTaskAdmission({
    task: input.task,
    principal: input.principal,
    policyDecision: input.policyDecision,
    now: input.now
  });

  if (admission.status === "rejected") {
    return {
      ...base,
      status: "blocked",
      reasons: uniqueStrings(["admission_rejected", ...admission.reasons]),
      requiredApprovals: admission.requiredApprovals
    };
  }

  if (admission.status === "needs_clarification") {
    return {
      ...base,
      status: "blocked",
      reasons: uniqueStrings(["admission_needs_clarification", ...admission.reasons]),
      requiredApprovals: admission.requiredApprovals
    };
  }

  if (isPolicyBlocked(input.policyDecision)) {
    return {
      ...base,
      status: "blocked",
      reasons: ["policy_blocked"]
    };
  }

  const effectiveRequestedScopes = uniqueStrings([
    ...input.requestedScopes,
    ...input.policyDecision.capabilities.map(capabilityScopeToCanonicalString)
  ]);
  const capabilityResults = effectiveRequestedScopes.map((scope) => (
    explainCapabilityDecision(input.capabilityGrants, scope, {
      principalId: input.principal.principalId,
      taskId: input.task.taskId,
      runId: input.run.runId,
      now: input.now
    })
  ));
  const denyResults = capabilityResults.filter((result) => (
    result.reasons.includes("matched_deny_scope")
  ));

  if (denyResults.length > 0) {
    return {
      ...base,
      status: "blocked",
      reasons: uniqueStrings([
        "capability_deny",
        ...denyResults.flatMap((result) => result.reasons)
      ]),
      missingCapabilities: denyResults.map((result) => result.requestedScope)
    };
  }

  const missingCapabilities = capabilityResults
    .filter((result) => !result.allowed)
    .map((result) => result.requestedScope);
  const nonCapabilityApprovals = admission.requiredApprovals.filter((approval) => (
    !approval.startsWith("capability:")
  ));
  const approvalRequired = nonCapabilityApprovals.length > 0
    || missingCapabilities.length > 0;
  const permitEvaluation = evaluatePermits(input, effectiveRequestedScopes);

  if (missingCapabilities.length > 0) {
    return {
      ...base,
      status: "waiting_approval",
      reasons: uniqueStrings([
        "missing_capability",
        "capability_grant_required",
        ...(permitEvaluation.acceptedPermits.length > 0
          ? ["approval_permit_cannot_expand_capability"]
          : []),
        ...capabilityResults
          .filter((result) => !result.allowed)
          .flatMap(capabilityFailureReasons)
      ]),
      missingCapabilities,
      requiredApprovals: uniqueStrings([
        ...admission.requiredApprovals,
        ...missingCapabilities.map((scope) => `approval:${scope}`)
      ]),
      acceptedPermits: [],
      rejectedPermits: uniqueStrings([
        ...permitEvaluation.rejectedPermits,
        ...permitEvaluation.acceptedPermits.map((permitId) => (
          `${permitId}:permit_cannot_expand_capability`
        ))
      ])
    };
  }

  if (approvalRequired && permitEvaluation.acceptedPermits.length === 0) {
    return {
      ...base,
      status: "waiting_approval",
      reasons: uniqueStrings([
        "approval_required",
        ...admission.reasons
      ]),
      missingCapabilities,
      requiredApprovals: uniqueStrings([
        ...admission.requiredApprovals,
        ...effectiveRequestedScopes.map((scope) => `approval:${scope}`)
      ]),
      rejectedPermits: permitEvaluation.rejectedPermits
    };
  }

  if (permitEvaluation.acceptedPermits.length > 0) {
    return {
      ...base,
      status: "eligible",
      reasons: ["valid_approval_permit"],
      missingCapabilities: [],
      requiredApprovals: [],
      acceptedPermits: permitEvaluation.acceptedPermits,
      rejectedPermits: permitEvaluation.rejectedPermits
    };
  }

  return {
    ...base,
    status: "eligible",
    reasons: ["capability_grants_satisfied"],
    missingCapabilities: [],
    requiredApprovals: [],
    rejectedPermits: permitEvaluation.rejectedPermits
  };
}

export function evaluateExecutionEligibilityWithPermitStore(
  input: EvaluateExecutionEligibilityWithPermitStoreInput
): ExecutionEligibilityDecision {
  const { approvalPermitStore, ...eligibilityInput } = input;
  const approvalPermits = approvalPermitStore.listPermits({
    taskId: input.task.taskId,
    runId: input.run.runId,
    principalId: input.principal.principalId
  });

  return evaluateExecutionEligibility({
    ...eligibilityInput,
    approvalPermits
  });
}

function evaluatePermits(
  input: EvaluateExecutionEligibilityInput,
  requestedCapabilityScopes: string[]
): {
  acceptedPermits: string[];
  rejectedPermits: string[];
} {
  const policyDecisionHash = hashApprovalScope(input.policyDecision);
  const acceptedPermits: string[] = [];
  const rejectedPermits: string[] = [];

  for (const permit of input.approvalPermits) {
    const validation = validateApprovalPermit(permit, {
      taskId: input.task.taskId,
      runId: input.run.runId,
      principalId: input.principal.principalId,
      policyDecisionHash,
      planHash: input.planHash,
      requestedCapabilityScopes,
      now: input.now
    });

    if (validation.valid) {
      acceptedPermits.push(permit.permitId);
    } else {
      rejectedPermits.push(`${permit.permitId}:${validation.reasons.join(",")}`);
    }
  }

  return {
    acceptedPermits,
    rejectedPermits
  };
}

function createBaseDecision(
  input: EvaluateExecutionEligibilityInput
): ExecutionEligibilityDecision {
  return {
    status: "blocked",
    taskId: input.task.taskId,
    runId: input.run.runId,
    policyDecisionHash: hashApprovalScope(input.policyDecision),
    reasons: [],
    missingCapabilities: [],
    requiredApprovals: [],
    acceptedPermits: [],
    rejectedPermits: [],
    createdAt: input.now
  };
}

function isPolicyBlocked(policyDecision: EvaluateExecutionEligibilityInput["policyDecision"]): boolean {
  const metadata = policyDecision.metadata?.legacy as Record<string, unknown> | undefined;

  return policyDecision.status === "blocked"
    || policyDecision.blocked === true
    || metadata?.status === "blocked"
    || metadata?.blocked === true;
}

function capabilityFailureReasons(
  result: ReturnType<typeof explainCapabilityDecision>
): string[] {
  return [
    ...result.reasons,
    ...result.ignoredGrantReasons
  ];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
