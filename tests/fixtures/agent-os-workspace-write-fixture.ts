import {
  CapabilityScopeSchema,
  PolicyDecisionSchema,
  SandboxProfileSchema,
  type PolicyDecision,
  type SandboxProfile
} from "../../packages/kernel-contracts/src/index.js";
import { hashApprovalScope } from "../../packages/governance-internal-approval-permit/src/index.js";
import type { GovernanceState } from "../../packages/governance-internal-state-manager/src/index.js";
import { ProviderRegistry } from "../../packages/provider-registry/src/index.js";
import {
  hashProviderExecutionPlannerObject
} from "../../packages/execution-planner/src/index.js";
import {
  parseExecutorExecutionPlan,
  parseProviderManifest,
  type ExecutionPlanInput,
  type ExecutionValidationResult,
  type ExecutorExecutionPlan,
  type ExecutorProvider,
  type ProviderExecutionContext,
  type ProviderExecutionResult
} from "../../packages/provider-core/src/index.js";

export type AgentOsWorkspaceWriteTestProvider = ExecutorProvider & {
  calls: {
    planExecution: number;
    validateExecutionPlan: number;
    execute: number;
  };
};

export function createAgentOsWorkspaceWriteProvider(input: {
  providerId: string;
  targetFiles: string[];
  sandboxId: string;
  source: string;
}): AgentOsWorkspaceWriteTestProvider {
  const calls = {
    planExecution: 0,
    validateExecutionPlan: 0,
    execute: 0
  };
  const manifest = parseProviderManifest({
    schemaVersion: "provider-manifest.v1",
    providerId: input.providerId,
    kind: "executor",
    displayName: "Agent OS Workspace Write Test Provider",
    version: "0.1.0",
    capabilities: [
      "execution.plan",
      "execution.validate",
      ...input.targetFiles.map((path) => `fs.write:${path}`)
    ],
    requiredConfig: {
      keys: [],
      optionalKeys: []
    },
    securityBoundary: {
      isolation: "process",
      networkAccess: "none",
      filesystemAccess: "workspace-write",
      secretAccess: "none",
      notes: ["test fixture"]
    },
    supportedSandboxProfiles: [createAgentOsWorkspaceWriteSandboxProfile({
      sandboxId: input.sandboxId
    })],
    supportedSideEffectClasses: ["workspace_write"],
    enabled: true,
    metadata: {}
  });

  return {
    manifest,
    calls,
    planExecution(planInput: ExecutionPlanInput): ExecutorExecutionPlan {
      calls.planExecution += 1;
      return parseExecutorExecutionPlan({
        schemaVersion: "executor-execution-plan.v1",
        kind: "executor",
        planId: `executor_${planInput.run.runId}`,
        runId: planInput.run.runId,
        taskId: planInput.task.taskId,
        ...(planInput.taskHash !== undefined ? { taskHash: planInput.taskHash } : {}),
        ...(planInput.principalId !== undefined ? { principalId: planInput.principalId } : {}),
        ...(planInput.principalHash !== undefined
          ? { principalHash: planInput.principalHash }
          : {}),
        ...(planInput.providerExecutionPlanHash !== undefined
          ? { providerExecutionPlanHash: planInput.providerExecutionPlanHash }
          : {}),
        ...(planInput.providerManifestHash !== undefined
          ? { providerManifestHash: planInput.providerManifestHash }
          : {}),
        providerId: manifest.providerId,
        inputHash: planInput.inputHash ?? "1".repeat(64),
        policyDecisionHash: hashProviderExecutionPlannerObject(planInput.policyDecision),
        requiredCapabilities: input.targetFiles.map((path) => `fs.write:${path}`),
        approvalRequired: true,
        sandboxProfile: planInput.sandboxProfile,
        sideEffectClass: "workspace_write",
        createdAt: planInput.now,
        metadata: {
          controlledWorkspaceWrite: true,
          source: input.source
        }
      });
    },
    validateExecutionPlan(_plan: ExecutorExecutionPlan): ExecutionValidationResult {
      calls.validateExecutionPlan += 1;
      return {
        valid: true,
        reasons: []
      };
    },
    execute(
      _plan: ExecutorExecutionPlan,
      _context: ProviderExecutionContext
    ): ProviderExecutionResult {
      calls.execute += 1;
      throw new Error("agent_os_workspace_write_test_provider_execute_forbidden");
    }
  };
}

export function createAgentOsWorkspaceWriteProviderRegistry(
  provider: AgentOsWorkspaceWriteTestProvider
): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.registerProvider(provider.manifest, provider);
  return registry;
}

export function createAgentOsWorkspaceWritePolicyDecision(input: {
  basePolicyDecision: PolicyDecision;
  decisionId: string;
  taskId: string;
  targetFiles: string[];
  sandboxId: string;
  now: string;
}): PolicyDecision {
  return PolicyDecisionSchema.parse({
    ...input.basePolicyDecision,
    decisionId: input.decisionId,
    taskId: input.taskId,
    risk: {
      level: "medium",
      factors: ["workspace_write"],
      ambiguityScore: 0,
      clarificationRequired: false
    },
    execution: {
      executor: "codex-cli",
      model: "gpt-5.4-mini",
      profile: "workspace-write",
      reasoningEffort: "low",
      sandbox: createAgentOsWorkspaceWriteSandboxProfile({
        sandboxId: input.sandboxId
      })
    },
    capabilities: input.targetFiles.map((path) => CapabilityScopeSchema.parse({
      kind: "file",
      resource: path,
      access: "write"
    })),
    approval: {
      required: true,
      reasons: ["workspace_write_requires_operator_authorization"]
    },
    createdAt: input.now,
    legacy: {
      taskClass: "small_edit",
      toolAccess: "local_write"
    }
  });
}

export function createAgentOsWorkspaceWriteEligibility(input: {
  policyDecision: PolicyDecision;
  taskId: string;
  runId: string;
  permitId: string;
  now: string;
}) {
  return {
    status: "eligible" as const,
    taskId: input.taskId,
    runId: input.runId,
    policyDecisionHash: hashApprovalScope(input.policyDecision),
    reasons: ["capability_grants_satisfied", "valid_approval_permit"],
    missingCapabilities: [],
    requiredApprovals: [],
    acceptedPermits: [input.permitId],
    rejectedPermits: [],
    createdAt: input.now
  };
}

export function createAgentOsWorkspaceWriteGovernanceState(input: {
  taskId: string;
  now: string;
}): GovernanceState {
  return {
    schemaVersion: "governance-state.v1",
    taskId: input.taskId,
    branchId: "main",
    phase: "execution",
    trustBalance: {
      centralOrder: 0.5,
      distributedVitality: 0.5
    },
    risk: {
      entanglement: 0.2,
      entropy: 0.2,
      failureCost: 0.2,
      reversibility: 0.8,
      contextPressure: 0.2,
      historicalTrust: 0.5,
      globalCoherence: 0.9,
      finalRiskLevel: "low"
    },
    anomalies: [],
    approvals: [],
    taskGraphRef: `task-graph:${input.taskId}`,
    createdAt: input.now,
    updatedAt: input.now
  };
}

function createAgentOsWorkspaceWriteSandboxProfile(input: {
  sandboxId: string;
}): SandboxProfile {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: input.sandboxId,
    mode: "workspace-write",
    networkAccess: "none",
    writableRoots: ["workspace"],
    envPolicy: {
      inheritProcessEnv: false,
      allowlist: []
    }
  });
}
