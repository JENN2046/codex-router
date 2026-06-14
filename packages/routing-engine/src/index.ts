import type {
  HostRoute,
  IntentClassification,
  ModelId,
  ReasoningEffort,
  RiskLevel,
  RoutingDecision,
  ProviderGrant,
  TaskEnvelope,
  TaskEnvelopeInput,
  ToolAccessLevel
} from "../../contracts/src/index.js";
import { parseTaskEnvelope } from "../../contracts/src/index.js";
import type { PolicySnapshot } from "../../policy-config/src/index.js";
import { getExecutionProfile } from "../../execution-profiles/src/index.js";
import { hashProviderManifest } from "../../provider-core/src/index.js";
import { codexCliProviderManifest } from "../../providers/codex-cli/src/index.js";

export function routeTask(
  taskInput: TaskEnvelopeInput,
  intent: IntentClassification,
  policy: PolicySnapshot
): RoutingDecision {
  const task: TaskEnvelope = parseTaskEnvelope(taskInput);
  const taskClass = intent.taskClass;
  const risk = scoreRisk(task, taskClass);
  const selectedModel = getTaskValue(policy.models, taskClass, "model");
  const toolAccess = getTaskValue(policy.toolPolicies, taskClass, "tool policy");
  const executionProfile = intent.clarificationRequired
    ? "clarify-then-plan"
    : getTaskValue(policy.executionProfiles, taskClass, "execution profile");
  const profile = getExecutionProfile(executionProfile);
  const reasoningEffort = chooseReasoningEffort(risk.level, taskClass);
  const approvalReasons = collectApprovalSignals(task, toolAccess, policy);
  const parallelismMode = !profile.allowParallel
    ? "disabled"
    : toolAccess === "read_only"
      ? "read_only"
      : "owned_write";
  const hostRoute = resolveHostRoute(taskClass, policy);

  return {
    schemaVersion: "routing-decision.v1",
    decisionId: `${task.taskId}:${policy.policyVersion}`,
    taskId: task.taskId,
    policyVersion: policy.policyVersion,
    classification: {
      taskClass,
      riskLevel: risk.level,
      ambiguityScore: intent.ambiguityScore,
      clarificationRequired: intent.clarificationRequired,
      riskFactors: risk.factors
    },
    execution: {
      selectedModel,
      toolAccess,
      executionProfile,
      reasoningEffort
    },
    approval: {
      required: approvalReasons.length > 0,
      reasons: approvalReasons
    },
    parallelism: {
      allowed: profile.allowParallel,
      maxAgents: profile.maxParallelAgents,
      mode: parallelismMode
    },
    hostRoute,
    providerGrant: createProviderGrant({
      task,
      policyVersion: policy.policyVersion,
      hostRoute,
      toolAccess,
      approvalReasons
    })
  };
}

function createProviderGrant(input: {
  task: TaskEnvelope;
  policyVersion: string;
  hostRoute: HostRoute;
  toolAccess: ToolAccessLevel;
  approvalReasons: string[];
}): ProviderGrant {
  const providerId = input.hostRoute === "codex-cli" ? "codex-cli" : "codex-desktop";

  return {
    schemaVersion: "provider-grant.v1",
    grantId: `${input.task.taskId}:${input.policyVersion}:${providerId}:${input.toolAccess}`,
    providerId,
    providerKind: "executor",
    ...(providerId === "codex-cli"
      ? { manifestHash: hashProviderManifest(codexCliProviderManifest) }
      : {}),
    sideEffectClass: resolveProviderSideEffectClass(input.toolAccess),
    toolAccess: input.toolAccess,
    sandboxMode: input.toolAccess === "read_only" ? "read-only" : "workspace-write",
    approvalRequired: input.approvalReasons.length > 0,
    requiredApprovals: [...input.approvalReasons],
    reasons: [
      `host_route:${input.hostRoute}`,
      `tool_access:${input.toolAccess}`
    ]
  };
}

function resolveProviderSideEffectClass(
  toolAccess: ToolAccessLevel
): ProviderGrant["sideEffectClass"] {
  switch (toolAccess) {
    case "read_only":
      return "read_only";
    case "local_write":
      return "workspace_write";
    case "engineering_write":
      return "local_command";
    case "protected_remote":
      return "protected_remote";
  }
}

function resolveHostRoute(
  taskClass: IntentClassification["taskClass"],
  policy: PolicySnapshot
): HostRoute {
  const hostRoute = policy.hostRoutes[taskClass];
  if (hostRoute) {
    return hostRoute;
  }

  throw new Error(`Missing host route for task class: ${taskClass}`);
}

function scoreRisk(
  task: TaskEnvelope,
  taskClass: IntentClassification["taskClass"]
): { level: RiskLevel; factors: string[] } {
  const haystack = `${task.intent.summary} ${task.intent.requestedAction}`.toLowerCase();
  const factors = [`task_class:${taskClass}`];

  if (taskClass === "release_external_action" || taskClass === "high_risk") {
    return { level: "high", factors };
  }

  if (taskClass === "engineering") {
    if (haystack.includes("production")) {
      factors.push("keyword:production");
    }

    if (haystack.includes("migration")) {
      factors.push("keyword:migration");
    }

    return {
      level: factors.length > 1 ? "high" : "medium",
      factors
    };
  }

  return { level: "low", factors };
}

function chooseReasoningEffort(
  riskLevel: RiskLevel,
  taskClass: IntentClassification["taskClass"]
): ReasoningEffort {
  if (riskLevel === "high" || taskClass === "release_external_action") {
    return "high";
  }

  if (taskClass === "engineering" || taskClass === "small_edit") {
    return "medium";
  }

  return "low";
}

function collectApprovalSignals(
  task: TaskEnvelope,
  toolAccess: ToolAccessLevel,
  policy: PolicySnapshot
): string[] {
  const reasons: string[] = [];
  const haystack = `${task.intent.summary} ${task.intent.requestedAction}`.toLowerCase();

  if (policy.approvalRules.protectedToolAccess.includes(toolAccess)) {
    reasons.push(`tool_access:${toolAccess}`);
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

function getTaskValue<T>(
  source: Partial<Record<IntentClassification["taskClass"], T>>,
  taskClass: IntentClassification["taskClass"],
  label: string
): T {
  const value = source[taskClass];
  if (value === undefined) {
    throw new Error(`Missing ${label} for task class: ${taskClass}`);
  }

  return value;
}
