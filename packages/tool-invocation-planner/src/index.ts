import { createHash } from "node:crypto";
import {
  explainCapabilityDecision,
  type CapabilityGrantLike
} from "../../capability/src/index.js";
import {
  hashApprovalScope,
  validateApprovalPermit
} from "../../approval-permit/src/index.js";
import type {
  ApprovalPermit,
  PolicyDecision,
  Principal,
  Run,
  SandboxProfile,
  Step
} from "../../kernel-contracts/src/index.js";
import {
  SandboxProfileSchema
} from "../../kernel-contracts/src/index.js";
import {
  RegisteredToolManifestSchema,
  type RegisteredToolManifest,
  type ToolProvider,
  type ToolSideEffectClass
} from "../../tool-registry/src/index.js";

export type ToolInvocationPlanStatus =
  | "planned"
  | "blocked"
  | "waiting_approval";

export type ToolInvocationPlan = {
  invocationId: string;
  runId: string;
  stepId: string;
  toolId: string;
  provider: ToolProvider;
  inputHash: string;
  inputPreview: unknown;
  requiredCapabilities: string[];
  sideEffectClass: ToolSideEffectClass;
  sandboxProfile: SandboxProfile;
  approvalRequired: boolean;
  status: ToolInvocationPlanStatus;
  reasons: string[];
};

export type PlanToolInvocationInput = {
  run: Run;
  step: Step;
  toolManifest: RegisteredToolManifest;
  proposedInput: unknown;
  principal: Principal;
  capabilityGrants: CapabilityGrantLike[];
  approvalPermits: ApprovalPermit[];
  policyDecision: PolicyDecision;
  planHash: string;
  now: string;
};

export function planToolInvocation(input: PlanToolInvocationInput): ToolInvocationPlan {
  const toolManifest = RegisteredToolManifestSchema.parse(input.toolManifest);
  const inputHash = hashToolInvocationInput(input.proposedInput);
  const inputPreview = redactToolInvocationInput(
    input.proposedInput,
    toolManifest.redactionPolicy.secretKeys
  );
  const basePlan = createBasePlan(input, toolManifest, inputHash, inputPreview);
  const integrityReasons = collectKernelIntegrityReasons(input);

  if (integrityReasons.length > 0) {
    return {
      ...basePlan,
      status: "blocked",
      reasons: uniqueStrings(integrityReasons)
    };
  }

  const capabilityResults = toolManifest.requiredCapabilities.map((scope) => (
    explainCapabilityDecision(input.capabilityGrants, scope, {
      principalId: input.principal.principalId,
      taskId: input.run.taskId,
      runId: input.run.runId,
      now: input.now
    })
  ));
  const denyResults = capabilityResults.filter((result) => (
    result.reasons.includes("matched_deny_scope")
  ));
  const policySandboxMismatch = explainToolSandboxPolicyMismatch(
    basePlan.sandboxProfile,
    input.policyDecision.execution.sandbox
  );

  if (policySandboxMismatch !== undefined) {
    return {
      ...basePlan,
      status: "blocked",
      reasons: [
        `tool_invocation_sandbox_exceeds_policy:${policySandboxMismatch}:${basePlan.sandboxProfile.sandboxId}:${input.policyDecision.execution.sandbox.sandboxId}`
      ]
    };
  }

  if (denyResults.length > 0) {
    return {
      ...basePlan,
      status: "blocked",
      reasons: uniqueStrings([
        "capability_deny",
        ...denyResults.flatMap((result) => result.reasons)
      ])
    };
  }

  const missingCapabilities = capabilityResults
    .filter((result) => !result.allowed)
    .map((result) => result.requestedScope);
  const permitEvaluation = evaluateApprovalPermits(input, toolManifest.requiredCapabilities);

  if (missingCapabilities.length > 0 && permitEvaluation.acceptedPermits.length === 0) {
    return {
      ...basePlan,
      status: "waiting_approval",
      approvalRequired: true,
      reasons: uniqueStrings([
        "missing_capability",
        ...capabilityResults
          .filter((result) => !result.allowed)
          .flatMap(capabilityFailureReasons),
        ...permitEvaluation.rejectedPermits
      ])
    };
  }

  if (basePlan.approvalRequired && permitEvaluation.acceptedPermits.length === 0) {
    return {
      ...basePlan,
      status: "waiting_approval",
      reasons: uniqueStrings([
        "approval_required",
        ...input.policyDecision.approval.reasons,
        ...permitEvaluation.rejectedPermits
      ])
    };
  }

  if (permitEvaluation.acceptedPermits.length > 0) {
    return {
      ...basePlan,
      status: "planned",
      reasons: uniqueStrings([
        "valid_approval_permit",
        ...permitEvaluation.acceptedPermits.map((permitId) => `permit:${permitId}`)
      ])
    };
  }

  return {
    ...basePlan,
    status: "planned",
    reasons: ["capability_grants_satisfied"]
  };
}

export function hashToolInvocationInput(input: unknown): string {
  return createHash("sha256")
    .update(stableStringify(input))
    .digest("hex");
}

export function redactToolInvocationInput(
  input: unknown,
  additionalSecretKeys: string[] = []
): unknown {
  return redactSecretLikeFields(input, new Set([
    "apiKey",
    "authorization",
    "credential",
    "password",
    "secret",
    "token",
    ...additionalSecretKeys
  ]));
}

function createBasePlan(
  input: PlanToolInvocationInput,
  toolManifest: RegisteredToolManifest,
  inputHash: string,
  inputPreview: unknown
): ToolInvocationPlan {
  return {
    invocationId: createInvocationId(input.run.runId, input.step.stepId, toolManifest.toolId, inputHash),
    runId: input.run.runId,
    stepId: input.step.stepId,
    toolId: toolManifest.toolId,
    provider: toolManifest.provider,
    inputHash,
    inputPreview,
    requiredCapabilities: [...toolManifest.requiredCapabilities],
    sideEffectClass: toolManifest.sideEffectClass,
    sandboxProfile: deriveSandboxProfile(toolManifest.sideEffectClass),
    approvalRequired: input.policyDecision.approval.required
      || isDangerousSideEffectClass(toolManifest.sideEffectClass),
    status: "blocked",
    reasons: []
  };
}

function collectKernelIntegrityReasons(input: PlanToolInvocationInput): string[] {
  const reasons: string[] = [];

  if (input.step.runId !== input.run.runId) {
    reasons.push(`tool_invocation_step_run_mismatch:${input.step.runId}:${input.run.runId}`);
  }

  if (input.step.taskId !== input.run.taskId) {
    reasons.push(`tool_invocation_step_task_mismatch:${input.step.taskId}:${input.run.taskId}`);
  }

  if (input.policyDecision.taskId !== input.run.taskId) {
    reasons.push(`tool_invocation_policy_task_mismatch:${input.policyDecision.taskId}:${input.run.taskId}`);
  }

  if (
    input.run.policyDecisionId !== undefined
    && input.run.policyDecisionId !== input.policyDecision.decisionId
  ) {
    reasons.push(
      `tool_invocation_run_policy_decision_mismatch:${input.run.policyDecisionId}:${input.policyDecision.decisionId}`
    );
  }

  return reasons;
}

function evaluateApprovalPermits(
  input: PlanToolInvocationInput,
  requiredCapabilities: string[]
): {
  acceptedPermits: string[];
  rejectedPermits: string[];
} {
  const policyDecisionHash = hashApprovalScope(input.policyDecision);
  const acceptedPermits: string[] = [];
  const rejectedPermits: string[] = [];

  for (const permit of input.approvalPermits) {
    const validation = validateApprovalPermit(permit, {
      taskId: input.run.taskId,
      runId: input.run.runId,
      principalId: input.principal.principalId,
      policyDecisionHash,
      planHash: input.planHash,
      requestedCapabilityScopes: requiredCapabilities,
      now: input.now
    });

    if (validation.valid) {
      acceptedPermits.push(permit.permitId);
    } else {
      rejectedPermits.push(`permit_rejected:${permit.permitId}:${validation.reasons.join(",")}`);
    }
  }

  return {
    acceptedPermits,
    rejectedPermits
  };
}

function deriveSandboxProfile(sideEffectClass: ToolSideEffectClass): SandboxProfile {
  const base = {
    schemaVersion: "sandbox-profile.v1" as const,
    sandboxId: `sandbox_tool_${sideEffectClass}`,
    envPolicy: {
      inheritProcessEnv: false,
      allowlist: []
    }
  };

  if (sideEffectClass === "local_write") {
    return {
      ...base,
      mode: "workspace-write",
      networkAccess: "none",
      writableRoots: ["workspace"]
    };
  }

  if (sideEffectClass === "external_write") {
    return {
      ...base,
      mode: "read-only",
      networkAccess: "restricted",
      writableRoots: []
    };
  }

  if (sideEffectClass === "destructive" || sideEffectClass === "secret_access") {
    return {
      ...base,
      mode: "read-only",
      networkAccess: "none",
      writableRoots: []
    };
  }

  return {
    ...base,
    mode: "read-only",
    networkAccess: "none",
    writableRoots: []
  };
}

function explainToolSandboxPolicyMismatch(
  requested: SandboxProfile,
  policySandboxInput: SandboxProfile
): string | undefined {
  const policySandbox = SandboxProfileSchema.parse(policySandboxInput);

  if (!sandboxModeImplies(policySandbox.mode, requested.mode)) {
    return "mode";
  }

  if (!networkAccessImplies(policySandbox.networkAccess, requested.networkAccess)) {
    return "networkAccess";
  }

  if (!writableRootsImply(policySandbox.writableRoots, requested.writableRoots)) {
    return "writableRoots";
  }

  if (!envPolicyImplies(policySandbox.envPolicy, requested.envPolicy)) {
    return "envPolicy";
  }

  return undefined;
}

function sandboxModeImplies(
  policyMode: SandboxProfile["mode"],
  requestedMode: SandboxProfile["mode"]
): boolean {
  return policyMode === requestedMode
    || policyMode === "danger-full-access"
    || (policyMode === "workspace-write" && requestedMode === "read-only");
}

function networkAccessImplies(
  granted: SandboxProfile["networkAccess"],
  requested: SandboxProfile["networkAccess"]
): boolean {
  if (granted === requested) {
    return true;
  }

  if (granted === "full") {
    return true;
  }

  return granted === "restricted" && requested === "none";
}

function writableRootsImply(granted: string[], requested: string[]): boolean {
  if (requested.length === 0) {
    return true;
  }

  return requested.every((root) => (
    granted.some((grantedRoot) => writableRootImplies(grantedRoot, root))
  ));
}

function writableRootImplies(grantedRoot: string, requestedRoot: string): boolean {
  if (grantedRoot === requestedRoot || grantedRoot === "*") {
    return true;
  }

  if (grantedRoot.endsWith("/**")) {
    const prefix = grantedRoot.slice(0, -3);
    return requestedRoot === prefix || requestedRoot.startsWith(`${prefix}/`);
  }

  return false;
}

function envPolicyImplies(
  granted: SandboxProfile["envPolicy"],
  requested: SandboxProfile["envPolicy"]
): boolean {
  if (!granted.inheritProcessEnv && requested.inheritProcessEnv) {
    return false;
  }

  if (granted.inheritProcessEnv) {
    return true;
  }

  return requested.allowlist.every((key) => granted.allowlist.includes(key));
}

function createInvocationId(
  runId: string,
  stepId: string,
  toolId: string,
  inputHash: string
): string {
  return `invocation_${createHash("sha256")
    .update(stableStringify({ runId, stepId, toolId, inputHash }))
    .digest("hex")
    .slice(0, 24)}`;
}

function isDangerousSideEffectClass(sideEffectClass: ToolSideEffectClass): boolean {
  return sideEffectClass === "local_write"
    || sideEffectClass === "external_write"
    || sideEffectClass === "destructive"
    || sideEffectClass === "secret_access"
    || sideEffectClass === "unknown";
}

function redactSecretLikeFields(input: unknown, secretKeys: Set<string>): unknown {
  if (Array.isArray(input)) {
    return input.map((item) => redactSecretLikeFields(item, secretKeys));
  }

  if (!isRecord(input)) {
    return input;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) {
      continue;
    }

    output[key] = isSecretLikeKey(key, secretKeys)
      ? "<REDACTED_SECRET>"
      : redactSecretLikeFields(value, secretKeys);
  }

  return output;
}

function isSecretLikeKey(key: string, secretKeys: Set<string>): boolean {
  if (secretKeys.has(key)) {
    return true;
  }

  return /api[-_]?key|authorization|credential|password|secret|token/i.test(key);
}

function stableStringify(input: unknown): string {
  if (input === undefined) {
    return "null";
  }

  if (input === null || typeof input !== "object") {
    return JSON.stringify(input) ?? "null";
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

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
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
