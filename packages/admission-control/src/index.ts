import type {
  AgentManifest,
  CapabilityScope,
  PolicyDecision,
  Principal,
  Task
} from "../../kernel-contracts/src/index.js";

export type AdmissionStatus =
  | "accepted"
  | "rejected"
  | "needs_clarification"
  | "needs_approval";

export type AdmissionDecision = {
  status: AdmissionStatus;
  taskId: string;
  principalId: string;
  reasons: string[];
  riskSignals: string[];
  requiredCapabilities: CapabilityScope[];
  requiredApprovals: string[];
  createdAt: string;
};

export type EvaluateTaskAdmissionInput = {
  task: Task;
  principal?: Principal;
  agent?: AgentManifest;
  policyDecision?: PolicyDecision & {
    status?: string;
    blocked?: boolean;
  };
  now?: string;
};

const defaultCreatedAt = "1970-01-01T00:00:00.000Z";
const unknownPrincipalId = "unknown_principal";

export function evaluateTaskAdmission(input: EvaluateTaskAdmissionInput): AdmissionDecision {
  const createdAt = input.now ?? defaultCreatedAt;
  const principalId = input.principal?.principalId ?? unknownPrincipalId;
  const reasons: string[] = [];
  const riskSignals = collectRiskSignals(input.task, input.policyDecision);
  const requiredCapabilities = collectRequiredCapabilities(input.task, input.policyDecision);
  const requiredApprovals = collectRequiredApprovals(riskSignals);

  if (!input.principal) {
    return createDecision({
      status: "rejected",
      taskId: input.task.taskId,
      principalId,
      reasons: ["missing_principal"],
      riskSignals,
      requiredCapabilities,
      requiredApprovals,
      createdAt
    });
  }

  if (!input.task.intent) {
    return createDecision({
      status: "rejected",
      taskId: input.task.taskId,
      principalId,
      reasons: ["missing_task_intent"],
      riskSignals,
      requiredCapabilities,
      requiredApprovals,
      createdAt
    });
  }

  if (isPolicyBlocked(input.policyDecision)) {
    return createDecision({
      status: "rejected",
      taskId: input.task.taskId,
      principalId,
      reasons: ["policy_decision_blocked"],
      riskSignals,
      requiredCapabilities,
      requiredApprovals,
      createdAt
    });
  }

  if (input.policyDecision?.risk.clarificationRequired) {
    return createDecision({
      status: "needs_clarification",
      taskId: input.task.taskId,
      principalId,
      reasons: ["policy_decision_requires_clarification"],
      riskSignals,
      requiredCapabilities,
      requiredApprovals,
      createdAt
    });
  }

  const missingCapabilities = requiredCapabilities.filter((scope) => (
    !agentHasMatchingCapability(input.agent, scope)
  ));
  const capabilityApprovals = missingCapabilities.map((scope) => (
    `capability:${scope.kind}:${scope.access}:${scope.resource}`
  ));
  const missingWriteCapabilities = missingCapabilities.some((scope) => scope.access !== "read");
  const missingReadCapabilities = missingCapabilities.some((scope) => scope.access === "read");
  const approvalReasons = [
    ...(requiresApproval(riskSignals) ? ["approval_required_by_task_risk"] : []),
    ...(missingWriteCapabilities ? ["missing_required_write_capability"] : []),
    ...(missingReadCapabilities ? ["missing_required_read_capability"] : [])
  ];

  if (approvalReasons.length > 0) {
    return createDecision({
      status: "needs_approval",
      taskId: input.task.taskId,
      principalId,
      reasons: approvalReasons,
      riskSignals,
      requiredCapabilities,
      requiredApprovals: [
        ...requiredApprovals,
        ...capabilityApprovals
      ],
      createdAt
    });
  }

  return createDecision({
    status: "accepted",
    taskId: input.task.taskId,
    principalId,
    reasons: [],
    riskSignals,
    requiredCapabilities,
    requiredApprovals,
    createdAt
  });
}

function createDecision(decision: AdmissionDecision): AdmissionDecision {
  return {
    ...decision,
    reasons: uniqueStrings(decision.reasons),
    riskSignals: uniqueStrings(decision.riskSignals),
    requiredCapabilities: uniqueCapabilities(decision.requiredCapabilities),
    requiredApprovals: uniqueStrings(decision.requiredApprovals)
  };
}

function isPolicyBlocked(policyDecision: EvaluateTaskAdmissionInput["policyDecision"]): boolean {
  if (!policyDecision) {
    return false;
  }

  const metadata = policyDecision.metadata?.legacy as Record<string, unknown> | undefined;

  return policyDecision.status === "blocked"
    || policyDecision.blocked === true
    || metadata?.status === "blocked"
    || metadata?.blocked === true;
}

function collectRequiredCapabilities(
  task: Task,
  policyDecision: EvaluateTaskAdmissionInput["policyDecision"]
): CapabilityScope[] {
  if (policyDecision?.capabilities && policyDecision.capabilities.length > 0) {
    return policyDecision.capabilities;
  }

  const signals = collectTaskSignalText(task).join(" ");
  const resources = inferResources(task);
  const capabilities: CapabilityScope[] = resources.map((resource): CapabilityScope => ({
    schemaVersion: "capability-scope.v1",
    kind: "file",
    resource,
    access: "read",
    constraints: {}
  }));

  if (hasAnySignal(signals, ["write", "edit", "modify", "patch", "change", "local_write"])) {
    capabilities.push(...resources.map((resource): CapabilityScope => ({
      schemaVersion: "capability-scope.v1",
      kind: "file",
      resource,
      access: "write",
      constraints: {}
    })));
  }

  if (hasAnySignal(signals, ["external", "network", "remote"])) {
    capabilities.push({
      schemaVersion: "capability-scope.v1",
      kind: "external",
      resource: "external_side_effect",
      access: "write",
      constraints: {}
    });
  }

  if (hasAnySignal(signals, ["secret"])) {
    capabilities.push({
      schemaVersion: "capability-scope.v1",
      kind: "secret",
      resource: "task_secret",
      access: "read",
      constraints: {}
    });
  }

  return uniqueCapabilities(capabilities);
}

function collectRiskSignals(
  task: Task,
  policyDecision: EvaluateTaskAdmissionInput["policyDecision"]
): string[] {
  const signals: string[] = [];
  const taskSignalText = collectTaskSignalText(task).join(" ");

  if (hasAnySignal(taskSignalText, ["external", "remote", "network"])) {
    signals.push("external_side_effect");
  }

  if (hasAnySignal(taskSignalText, ["destructive", "delete", "remove", "overwrite"])) {
    signals.push("destructive");
  }

  if (hasAnySignal(taskSignalText, ["production", "prod", "release"])) {
    signals.push("production");
  }

  if (hasAnySignal(taskSignalText, ["secret", "credential", "token"])) {
    signals.push("secret");
  }

  if (policyDecision?.approval.required) {
    signals.push("policy_approval_required");
  }

  if (policyDecision?.risk.level === "critical") {
    signals.push("critical_policy_risk");
  }

  return signals;
}

function collectRequiredApprovals(riskSignals: string[]): string[] {
  const approvals: string[] = [];

  for (const signal of riskSignals) {
    if (
      signal === "external_side_effect"
      || signal === "destructive"
      || signal === "production"
      || signal === "secret"
      || signal === "critical_policy_risk"
      || signal === "policy_approval_required"
    ) {
      approvals.push(`approval:${signal}`);
    }
  }

  return approvals;
}

function requiresApproval(riskSignals: string[]): boolean {
  return riskSignals.some((signal) => (
    signal === "external_side_effect"
    || signal === "destructive"
    || signal === "production"
    || signal === "secret"
    || signal === "critical_policy_risk"
    || signal === "policy_approval_required"
  ));
}

function agentHasMatchingCapability(
  agent: AgentManifest | undefined,
  requiredScope: CapabilityScope
): boolean {
  if (!agent) {
    return requiredScope.kind === "file" && requiredScope.access === "read";
  }

  return agent.capabilities.some((scope) => (
    scope.kind === requiredScope.kind
    && scope.access === requiredScope.access
    && resourceMatches(scope.resource, requiredScope.resource)
  ));
}

function resourceMatches(grantedResource: string, requiredResource: string): boolean {
  if (grantedResource === requiredResource || grantedResource === "**") {
    return true;
  }

  if (grantedResource.endsWith("/**")) {
    const prefix = grantedResource.slice(0, -3);
    return requiredResource === prefix || requiredResource.startsWith(`${prefix}/`);
  }

  return false;
}

function collectTaskSignalText(task: Task): string[] {
  const values: string[] = [
    task.title,
    task.requestedAction,
    ...task.successCriteria,
    ...task.target.branches,
    ...task.target.files,
    ...task.target.modules,
    ...task.hints.riskHints,
    ...task.hints.tags
  ];

  if (task.hints.taskClass) {
    values.push(task.hints.taskClass);
  }

  appendRecordValues(values, task.constraints);

  if (task.metadata?.legacySource) {
    values.push(task.metadata.legacySource);
  }

  if (task.metadata?.legacyHints) {
    appendRecordValues(values, task.metadata.legacyHints);
  }

  if (task.metadata?.legacy) {
    appendRecordValues(values, task.metadata.legacy);
  }

  return values.map((value) => value.toLowerCase());
}

function appendRecordValues(values: string[], record: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(record)) {
    if (value === false || value === undefined || value === null) {
      continue;
    }

    values.push(key);

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      values.push(String(value));
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
          values.push(String(item));
        }
      }
    } else if (value && typeof value === "object") {
      appendRecordValues(values, value as Record<string, unknown>);
    }
  }
}

function inferResources(task: Task): string[] {
  if (task.target.files.length > 0) {
    return task.target.files;
  }

  if (task.repo.root) {
    return [`${task.repo.root}/**`];
  }

  return ["workspace/**"];
}

function hasAnySignal(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function uniqueCapabilities(capabilities: CapabilityScope[]): CapabilityScope[] {
  const seen = new Set<string>();
  const result: CapabilityScope[] = [];

  for (const capability of capabilities) {
    const key = `${capability.kind}:${capability.access}:${capability.resource}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(capability);
    }
  }

  return result;
}
