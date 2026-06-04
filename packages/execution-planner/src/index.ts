import { createHash } from "node:crypto";
import { z } from "zod";
import {
  CapabilityScopeSchema,
  PolicyDecisionSchema,
  PrincipalSchema,
  RunSchema,
  SandboxProfileSchema,
  TaskSchema,
  type CapabilityScope,
  type PolicyDecision,
  type Principal,
  type Run,
  type SandboxProfile,
  type Task
} from "../../kernel-contracts/src/index.js";
import {
  ProviderKindSchema,
  ProviderSideEffectClassSchema,
  providerSupportsSandboxProfile,
  providerSupportsSideEffectClass,
  type ProviderKind,
  type ProviderSideEffectClass
} from "../../provider-core/src/index.js";
import {
  type ExecutionEligibilityDecision
} from "../../execution-eligibility/src/index.js";
import {
  type ProviderRegistry,
  type ProviderRegistryEntry
} from "../../provider-registry/src/index.js";

export const ProviderExecutionPlanStatusSchema = z.enum([
  "planned",
  "blocked",
  "waiting_approval"
]);

export const ProviderExecutionPlanProviderKindSchema = z.union([
  ProviderKindSchema,
  z.literal("unknown")
]);

export const ProviderExecutionPlanSchema = z.object({
  schemaVersion: z.literal("provider-execution-plan.v2").default("provider-execution-plan.v2"),
  planId: z.string().min(1),
  taskId: z.string().min(1),
  runId: z.string().min(1),
  providerId: z.string().min(1),
  providerKind: ProviderExecutionPlanProviderKindSchema,
  status: ProviderExecutionPlanStatusSchema,
  inputHash: z.string().regex(/^[a-f0-9]{64}$/),
  policyDecisionHash: z.string().regex(/^[a-f0-9]{64}$/),
  requiredCapabilities: z.array(z.string().min(1)).default([]),
  requiredApprovals: z.array(z.string().min(1)).default([]),
  sandboxProfile: SandboxProfileSchema,
  sideEffectClass: ProviderSideEffectClassSchema,
  reasons: z.array(z.string().min(1)).default([]),
  createdAt: z.string().min(1)
});

export type ProviderExecutionPlanStatus = z.infer<typeof ProviderExecutionPlanStatusSchema>;
export type ProviderExecutionPlanProviderKind = z.infer<typeof ProviderExecutionPlanProviderKindSchema>;
export type ProviderExecutionPlan = z.infer<typeof ProviderExecutionPlanSchema>;

export type PlanProviderExecutionInput = {
  task: Task;
  run: Run;
  principal: Principal;
  policyDecision: PolicyDecision;
  executionEligibility: ExecutionEligibilityDecision;
  providerRegistry: ProviderRegistry;
  preferredProviderId?: string;
  now: string;
};

export function planProviderExecution(
  input: PlanProviderExecutionInput
): ProviderExecutionPlan {
  const task = TaskSchema.parse(input.task);
  const run = RunSchema.parse(input.run);
  const principal = PrincipalSchema.parse(input.principal);
  const policyDecision = PolicyDecisionSchema.parse(input.policyDecision);
  const eligibility = parseExecutionEligibility(input.executionEligibility);
  const sandboxProfile = SandboxProfileSchema.parse(policyDecision.execution.sandbox);
  const sideEffectClass = resolveProviderSideEffectClass(policyDecision, sandboxProfile);
  const requiredCapabilities = policyDecision.capabilities.map(capabilityScopeToString);
  const requiredApprovals = uniqueStrings([...eligibility.requiredApprovals]);
  const policyDecisionHash = hashProviderExecutionPlannerObject(policyDecision);
  const providerResolution = resolveProvider({
    providerRegistry: input.providerRegistry,
    sideEffectClass,
    sandboxProfile,
    ...(input.preferredProviderId !== undefined
      ? { preferredProviderId: input.preferredProviderId }
      : {})
  });
  const providerId = providerResolution.providerId;
  const providerKind = providerResolution.providerKind;
  const inputHash = createInputHash({
    taskId: task.taskId,
    runId: run.runId,
    principalId: principal.principalId,
    providerId,
    providerKind,
    policyDecisionHash,
    eligibilityStatus: eligibility.status,
    sideEffectClass,
    sandboxProfile,
    preferredProviderId: input.preferredProviderId
  });
  const basePlan = {
    schemaVersion: "provider-execution-plan.v2" as const,
    planId: createPlanId(run.runId, providerId, inputHash),
    taskId: task.taskId,
    runId: run.runId,
    providerId,
    providerKind,
    inputHash,
    policyDecisionHash,
    requiredCapabilities,
    requiredApprovals,
    sandboxProfile,
    sideEffectClass,
    createdAt: input.now
  };
  const integrityReasons = collectKernelIntegrityReasons(task, run, policyDecision, eligibility);

  if (providerResolution.reasons.length > 0 || integrityReasons.length > 0) {
    return ProviderExecutionPlanSchema.parse({
      ...basePlan,
      status: "blocked",
      reasons: uniqueStrings([
        ...integrityReasons,
        ...providerResolution.reasons
      ])
    });
  }

  if (eligibility.status === "blocked") {
    return ProviderExecutionPlanSchema.parse({
      ...basePlan,
      status: "blocked",
      reasons: uniqueStrings([
        "eligibility_blocked",
        ...eligibility.reasons
      ])
    });
  }

  if (eligibility.status === "waiting_approval") {
    return ProviderExecutionPlanSchema.parse({
      ...basePlan,
      status: "waiting_approval",
      reasons: uniqueStrings([
        "eligibility_waiting_approval",
        ...eligibility.reasons
      ])
    });
  }

  return ProviderExecutionPlanSchema.parse({
    ...basePlan,
    status: "planned",
    reasons: uniqueStrings([
      "provider_planned",
      ...eligibility.reasons
    ])
  });
}

export function hashProviderExecutionPlannerObject(input: unknown): string {
  return createHash("sha256")
    .update(stableStringify(input))
    .digest("hex");
}

function resolveProvider(input: {
  providerRegistry: ProviderRegistry;
  preferredProviderId?: string;
  sideEffectClass: ProviderSideEffectClass;
  sandboxProfile: SandboxProfile;
}): {
  providerId: string;
  providerKind: ProviderExecutionPlanProviderKind;
  entry?: ProviderRegistryEntry;
  reasons: string[];
} {
  if (input.preferredProviderId !== undefined) {
    const entry = input.providerRegistry.getProvider(input.preferredProviderId);

    if (entry === undefined) {
      return {
        providerId: input.preferredProviderId,
        providerKind: "unknown",
        reasons: [`provider_not_found:${input.preferredProviderId}`]
      };
    }

    return evaluateProviderEntry(entry, input.sideEffectClass, input.sandboxProfile);
  }

  const candidates = input.providerRegistry.listProviders({
    sideEffectClass: input.sideEffectClass,
    sandboxProfile: input.sandboxProfile
  });

  if (candidates[0] !== undefined) {
    return {
      providerId: candidates[0].manifest.providerId,
      providerKind: candidates[0].manifest.kind,
      entry: candidates[0],
      reasons: []
    };
  }

  const disabledCandidate = input.providerRegistry.listProviders({
    sideEffectClass: input.sideEffectClass,
    sandboxProfile: input.sandboxProfile,
    enabled: false
  })[0];

  if (disabledCandidate !== undefined) {
    return evaluateProviderEntry(
      disabledCandidate,
      input.sideEffectClass,
      input.sandboxProfile
    );
  }

  return {
    providerId: "unresolved",
    providerKind: "unknown",
    reasons: [
      `provider_not_found_for_requirements:${input.sideEffectClass}:${input.sandboxProfile.sandboxId}`
    ]
  };
}

function evaluateProviderEntry(
  entry: ProviderRegistryEntry,
  sideEffectClass: ProviderSideEffectClass,
  sandboxProfile: SandboxProfile
): {
  providerId: string;
  providerKind: ProviderKind;
  entry: ProviderRegistryEntry;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (!entry.manifest.enabled) {
    reasons.push(`provider_disabled:${entry.manifest.providerId}`);
  }

  if (!providerSupportsSideEffectClass(entry.manifest, sideEffectClass)) {
    reasons.push(`unsupported_side_effect_class:${entry.manifest.providerId}:${sideEffectClass}`);
  }

  if (!providerSupportsSandboxProfile(entry.manifest, sandboxProfile)) {
    reasons.push(`unsupported_sandbox_profile:${entry.manifest.providerId}:${sandboxProfile.sandboxId}`);
  }

  return {
    providerId: entry.manifest.providerId,
    providerKind: entry.manifest.kind,
    entry,
    reasons
  };
}

function collectKernelIntegrityReasons(
  task: Task,
  run: Run,
  policyDecision: PolicyDecision,
  eligibility: ExecutionEligibilityDecision
): string[] {
  const reasons: string[] = [];

  if (task.taskId !== run.taskId) {
    reasons.push(`task_run_mismatch:${task.taskId}:${run.taskId}`);
  }

  if (policyDecision.taskId !== task.taskId) {
    reasons.push(`policy_task_mismatch:${policyDecision.taskId}:${task.taskId}`);
  }

  if (eligibility.taskId !== task.taskId) {
    reasons.push(`eligibility_task_mismatch:${eligibility.taskId}:${task.taskId}`);
  }

  if (eligibility.runId !== run.runId) {
    reasons.push(`eligibility_run_mismatch:${eligibility.runId}:${run.runId}`);
  }

  if (
    run.policyDecisionId !== undefined
    && run.policyDecisionId !== policyDecision.decisionId
  ) {
    reasons.push(`run_policy_decision_mismatch:${run.policyDecisionId}:${policyDecision.decisionId}`);
  }

  return reasons;
}

function parseExecutionEligibility(
  input: ExecutionEligibilityDecision
): ExecutionEligibilityDecision {
  return {
    status: z.enum(["eligible", "blocked", "waiting_approval"]).parse(input.status),
    taskId: z.string().min(1).parse(input.taskId),
    runId: z.string().min(1).parse(input.runId),
    reasons: z.array(z.string().min(1)).parse(input.reasons),
    missingCapabilities: z.array(z.string().min(1)).parse(input.missingCapabilities),
    requiredApprovals: z.array(z.string().min(1)).parse(input.requiredApprovals),
    acceptedPermits: z.array(z.string().min(1)).parse(input.acceptedPermits),
    rejectedPermits: z.array(z.string().min(1)).parse(input.rejectedPermits),
    createdAt: z.string().min(1).parse(input.createdAt)
  };
}

function resolveProviderSideEffectClass(
  policyDecision: PolicyDecision,
  sandboxProfile: SandboxProfile
): ProviderSideEffectClass {
  if (hasProtectedRemoteSideEffect(policyDecision)) {
    return "protected_remote";
  }

  if (hasExternalSideEffect(policyDecision)) {
    return "external_side_effects";
  }

  if (hasSecretAccess(policyDecision)) {
    return "secret_access";
  }

  if (sandboxProfile.mode === "workspace-write") {
    return "workspace_write";
  }

  if (hasLocalCommand(policyDecision)) {
    return "local_command";
  }

  return "read_only";
}

function hasProtectedRemoteSideEffect(policyDecision: PolicyDecision): boolean {
  return policyDecision.legacy.toolAccess === "protected_remote"
    || policyDecision.capabilities.some((scope) => (
      scope.kind === "external"
      && scope.resource === "protected_remote"
      && scope.access !== "read"
    ));
}

function hasExternalSideEffect(policyDecision: PolicyDecision): boolean {
  return policyDecision.capabilities.some((scope) => (
    scope.kind === "external"
    && scope.access !== "read"
  ));
}

function hasSecretAccess(policyDecision: PolicyDecision): boolean {
  return policyDecision.capabilities.some((scope) => scope.kind === "secret");
}

function hasLocalCommand(policyDecision: PolicyDecision): boolean {
  return policyDecision.capabilities.some((scope) => (
    (scope.kind === "tool" || scope.kind === "process")
    && scope.access === "execute"
  ));
}

function capabilityScopeToString(scopeInput: CapabilityScope): string {
  const scope = CapabilityScopeSchema.parse(scopeInput);
  return `${scope.kind}:${scope.access}:${scope.resource}`;
}

function createInputHash(input: Record<string, unknown>): string {
  return hashProviderExecutionPlannerObject(input);
}

function createPlanId(runId: string, providerId: string, inputHash: string): string {
  return `plan_provider_${toSafeIdPart(runId)}_${toSafeIdPart(providerId)}_${inputHash.slice(0, 12)}`;
}

function stableStringify(input: unknown): string {
  if (input === null || typeof input !== "object") {
    return JSON.stringify(input);
  }

  if (Array.isArray(input)) {
    return `[${input.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = input as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();

  return `{${keys.map((key) => (
    `${JSON.stringify(key)}:${stableStringify(record[key])}`
  )).join(",")}}`;
}

function toSafeIdPart(value: string): string {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return safe || "unnamed";
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
