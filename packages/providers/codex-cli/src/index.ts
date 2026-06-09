import {
  createCodexCliExecPlanFromRoutingDecision,
  validateCodexCliExecPlanForRun,
  type CodexCliApprovalPolicy,
  type CodexCliExecPlan,
  type CodexCliSandboxMode
} from "../../../codex-cli-host/src/index.js";
import {
  ModelIdSchema,
  parseRoutingDecision,
  parseTaskEnvelope,
  type ExecutionProfileName,
  type ParallelismMode,
  type ReasoningEffort,
  type RoutingDecisionInput,
  type TaskClass,
  type TaskEnvelope,
  type TaskEnvelopeInput,
  type ToolAccessLevel
} from "../../../contracts/src/index.js";
import {
  SandboxProfileSchema,
  hashKernelObject,
  type PolicyDecision,
  type SandboxProfile,
  type Task
} from "../../../kernel-contracts/src/index.js";
import {
  capabilityScopeToCanonicalString
} from "../../../capability/src/index.js";
import {
  assertProviderSupportsSandboxProfile,
  assertProviderSupportsSideEffectClass,
  parseExecutorExecutionPlan,
  parseProviderManifest,
  type ExecutionPlanInput,
  type ExecutionValidationResult,
  type ExecutorExecutionPlan,
  type ExecutorProvider,
  type ProviderExecutionContext,
  type ProviderExecutionResult,
  type ProviderManifest,
  type ProviderSideEffectClass
} from "../../../provider-core/src/index.js";

export const CODEX_CLI_PROVIDER_ID = "codex-cli";
export const CODEX_CLI_PROVIDER_EXECUTE_DISABLED =
  "codex_cli_provider_execute_disabled";
export const CODEX_CLI_PROVIDER_PROMPT_OMITTED =
  "<codex-cli-provider-prompt-omitted>";

export interface CodexCliExecutorProviderOptions {
  manifest?: ProviderManifest;
  executionEnabled?: boolean;
}

export interface CodexCliProviderSanitizedPlan {
  schemaVersion: "codex-cli-provider-sanitized-plan.v1";
  command: string;
  argsWithoutPrompt: string[];
  promptOmitted: true;
  sandbox: CodexCliSandboxMode;
  approvalPolicy: CodexCliApprovalPolicy;
  warnings: string[];
  model?: string;
  workdir?: string;
  modelResolution?: unknown;
}

export interface CodexCliProviderPlanMetadata {
  schemaVersion: "codex-cli-provider-plan-metadata.v1";
  promptStorage: "omitted";
  policyAllowsWorkspaceWrite: boolean;
  policyDecisionHash: string;
  routingDecisionHash: string;
  codexCliPlan: CodexCliProviderSanitizedPlan;
}

export class CodexCliProviderExecutionDisabledError extends Error {
  constructor() {
    super(CODEX_CLI_PROVIDER_EXECUTE_DISABLED);
    this.name = "CodexCliProviderExecutionDisabledError";
  }
}

export class CodexCliProviderNotImplementedError extends Error {
  constructor() {
    super("codex_cli_provider_real_execution_not_implemented");
    this.name = "CodexCliProviderNotImplementedError";
  }
}

export const codexCliProviderManifest = parseProviderManifest({
  schemaVersion: "provider-manifest.v1",
  providerId: CODEX_CLI_PROVIDER_ID,
  kind: "executor",
  displayName: "Codex CLI Executor",
  version: "0.1.0",
  capabilities: [
    "execution.plan",
    "execution.validate",
    "codex-cli-host.plan"
  ],
  requiredConfig: {
    keys: [],
    optionalKeys: []
  },
  securityBoundary: {
    isolation: "process",
    networkAccess: "restricted",
    filesystemAccess: "workspace-write",
    secretAccess: "brokered",
    notes: [
      "Facade over packages/codex-cli-host.",
      "Real Codex CLI execution is disabled by default in Phase 3.",
      "Protected remote and external side effects are not supported without an explicit approval permit path."
    ]
  },
  supportedSandboxProfiles: [
    createCodexCliSandboxProfile("read-only"),
    createCodexCliSandboxProfile("workspace-write")
  ],
  supportedSideEffectClasses: [
    "read_only",
    "workspace_write",
    "local_command"
  ],
  enabled: true,
  metadata: {
    codexCliHostFacade: true,
    executionDefault: "disabled",
    promptStorage: "inputHash_only",
    externalSideEffectsDefault: "unsupported_without_approval_permit"
  }
});

export class CodexCliExecutorProvider implements ExecutorProvider {
  readonly manifest: ProviderManifest;
  private readonly executionEnabled: boolean;

  constructor(options: CodexCliExecutorProviderOptions = {}) {
    this.manifest = options.manifest ?? codexCliProviderManifest;
    this.executionEnabled = options.executionEnabled ?? false;
  }

  planExecution(input: ExecutionPlanInput): ExecutorExecutionPlan {
    assertNoDirectCodexCliPolicyOverrides(input.proposedInput);
    assertKernelInputMatches(input);

    const effectiveSandboxProfile = resolveEffectiveSandboxProfile(input);
    assertProviderSupportsSandboxProfile(this.manifest, effectiveSandboxProfile);

    const effectiveSandbox = effectiveSandboxProfile.mode;
    const sideEffectClass = resolveProviderSideEffectClass(input, effectiveSandbox);
    assertProviderSupportsSideEffectClass(this.manifest, sideEffectClass);

    const taskEnvelope = kernelTaskToTaskEnvelope(
      input.task,
      input.policyDecision
    );
    const routingDecision = policyDecisionToRoutingDecision(
      input.policyDecision,
      taskEnvelope,
      effectiveSandbox
    );
    const parsedRoutingDecision = parseRoutingDecision(routingDecision);
    const codexCliPlan = createCodexCliExecPlanFromRoutingDecision(
      taskEnvelope,
      parsedRoutingDecision,
      {
        approvalPolicy: "on-request",
        ephemeral: true
      }
    );
    const policyDecisionHash = hashKernelObject(input.policyDecision);
    const routingDecisionHash = hashKernelObject(parsedRoutingDecision);
    const inputHash = createCodexCliProviderInputHash(input);
    const metadata: CodexCliProviderPlanMetadata = {
      schemaVersion: "codex-cli-provider-plan-metadata.v1",
      promptStorage: "omitted",
      policyAllowsWorkspaceWrite: effectiveSandbox === "workspace-write",
      policyDecisionHash,
      routingDecisionHash,
      codexCliPlan: sanitizeCodexCliPlan(codexCliPlan)
    };

    return parseExecutorExecutionPlan({
      schemaVersion: "executor-execution-plan.v1",
      kind: "executor",
      planId: `plan_codex_cli_${input.task.taskId}_${inputHash.slice(0, 12)}`,
      runId: input.run.runId,
      taskId: input.task.taskId,
      providerId: this.manifest.providerId,
      inputHash,
      policyDecisionHash,
      requiredCapabilities: input.policyDecision.capabilities.map(capabilityScopeToCanonicalString),
      approvalRequired: input.policyDecision.approval.required,
      sandboxProfile: effectiveSandboxProfile,
      sideEffectClass,
      createdAt: input.now,
      metadata: {
        codexCliProvider: metadata
      }
    });
  }

  validateExecutionPlan(plan: ExecutorExecutionPlan): ExecutionValidationResult {
    const reasons: string[] = [];
    let parsedPlan: ExecutorExecutionPlan;

    try {
      parsedPlan = parseExecutorExecutionPlan(plan);
    } catch (error) {
      return {
        valid: false,
        reasons: [normalizeErrorMessage(error)]
      };
    }

    if (parsedPlan.providerId !== this.manifest.providerId) {
      reasons.push(
        `codex_cli_provider_id_mismatch:${parsedPlan.providerId}:${this.manifest.providerId}`
      );
    }

    collectProviderSupportReason(
      () => assertProviderSupportsSideEffectClass(
        this.manifest,
        parsedPlan.sideEffectClass
      ),
      reasons
    );
    collectProviderSupportReason(
      () => assertProviderSupportsSandboxProfile(
        this.manifest,
        parsedPlan.sandboxProfile
      ),
      reasons
    );

    const metadata = readCodexCliProviderMetadata(parsedPlan);
    if (!metadata) {
      reasons.push("codex_cli_provider_metadata_missing");
      return {
        valid: false,
        reasons: uniqueStrings(reasons)
      };
    }

    reasons.push(...validateCodexCliProviderMetadata(metadata));
    reasons.push(...validateCodexCliPlanAlignment(parsedPlan, metadata));
    const codexCliPlan = createValidationCodexCliPlan(parsedPlan, metadata);
    reasons.push(...validateCodexCliExecPlanForRun(codexCliPlan, {
      allowWriteSandbox: metadata.policyAllowsWorkspaceWrite
    }));

    return {
      valid: reasons.length === 0,
      reasons: uniqueStrings(reasons)
    };
  }

  execute(
    _plan: ExecutorExecutionPlan,
    _context: ProviderExecutionContext
  ): ProviderExecutionResult {
    if (!this.executionEnabled) {
      throw new CodexCliProviderExecutionDisabledError();
    }

    throw new CodexCliProviderNotImplementedError();
  }
}

export const codexCliExecutorProvider = new CodexCliExecutorProvider();

export function createCodexCliExecutorProvider(
  options: CodexCliExecutorProviderOptions = {}
): CodexCliExecutorProvider {
  return new CodexCliExecutorProvider(options);
}

function createCodexCliSandboxProfile(
  mode: "read-only" | "workspace-write"
): SandboxProfile {
  return SandboxProfileSchema.parse({
    schemaVersion: "sandbox-profile.v1",
    sandboxId: `codex-cli-${mode}`,
    mode,
    networkAccess: "none",
    writableRoots: mode === "read-only" ? [] : ["workspace/**"],
    envPolicy: {
      inheritProcessEnv: false,
      allowlist: []
    }
  });
}

function assertNoDirectCodexCliPolicyOverrides(proposedInput: unknown): void {
  const records = collectRecords(proposedInput);

  for (const record of records) {
    if ("model" in record) {
      throw new Error("codex_cli_provider_disallows_direct_model_override:model");
    }

    if ("sandbox" in record) {
      throw new Error("codex_cli_provider_disallows_direct_sandbox_override:sandbox");
    }

    if ("extraArgs" in record || "args" in record) {
      throw new Error("codex_cli_provider_disallows_direct_cli_args_override");
    }
  }
}

function collectRecords(input: unknown): Array<Record<string, unknown>> {
  if (!isRecord(input)) {
    return [];
  }

  const records = [input];
  for (const key of ["planOptions", "codexCliPlanOptions", "codexCliOptions"]) {
    const nested = input[key];
    if (isRecord(nested)) {
      records.push(nested);
    }
  }

  return records;
}

function assertKernelInputMatches(input: ExecutionPlanInput): void {
  if (input.task.taskId !== input.run.taskId) {
    throw new Error(
      `codex_cli_provider_run_task_id_mismatch:${input.run.taskId}:${input.task.taskId}`
    );
  }

  if (input.policyDecision.taskId !== input.task.taskId) {
    throw new Error(
      `codex_cli_provider_policy_task_id_mismatch:${input.policyDecision.taskId}:${input.task.taskId}`
    );
  }

  if (
    input.run.policyDecisionId !== undefined
    && input.run.policyDecisionId !== input.policyDecision.decisionId
  ) {
    throw new Error(
      `codex_cli_provider_policy_decision_mismatch:${input.run.policyDecisionId}:${input.policyDecision.decisionId}`
    );
  }
}

type CodexCliEffectiveSandboxProfile = SandboxProfile & {
  mode: CodexCliSandboxMode;
};

function resolveEffectiveSandboxProfile(input: ExecutionPlanInput): CodexCliEffectiveSandboxProfile {
  const requested = SandboxProfileSchema.parse(input.sandboxProfile);
  const policySandbox = SandboxProfileSchema.parse(input.policyDecision.execution.sandbox);

  if (policySandbox.mode === "danger-full-access") {
    throw new Error("codex_cli_provider_policy_danger_full_access_unsupported");
  }

  if (requested.mode === "danger-full-access") {
    throw new Error("codex_cli_provider_danger_full_access_unsupported");
  }

  if (requested.mode === "workspace-write" && policySandbox.mode !== "workspace-write") {
    throw new Error("codex_cli_provider_policy_disallows_workspace_write");
  }

  const policyMismatch = explainRequestedSandboxPolicyMismatch(requested, policySandbox);
  if (policyMismatch !== undefined) {
    throw new Error(
      `codex_cli_provider_requested_sandbox_exceeds_policy:${policyMismatch}:${requested.sandboxId}:${policySandbox.sandboxId}`
    );
  }

  return requested as CodexCliEffectiveSandboxProfile;
}

function resolveProviderSideEffectClass(
  input: ExecutionPlanInput,
  effectiveSandbox: CodexCliSandboxMode
): ProviderSideEffectClass {
  if (hasProtectedRemoteSideEffect(input.policyDecision)) {
    return "protected_remote";
  }

  if (hasExternalSideEffect(input.policyDecision)) {
    return "external_side_effects";
  }

  if (hasSecretAccess(input.policyDecision)) {
    return "secret_access";
  }

  if (hasLocalCommand(input.policyDecision)) {
    return "local_command";
  }

  if (effectiveSandbox === "workspace-write") {
    return "workspace_write";
  }

  return "read_only";
}

function kernelTaskToTaskEnvelope(
  task: Task,
  policyDecision: PolicyDecision
): TaskEnvelope {
  const taskClassHint = resolveTaskClass(task, policyDecision);
  const repoContext = task.workspace ?? task.repo;
  const taskEnvelopeInput: TaskEnvelopeInput = {
    schemaVersion: "task-envelope.v1",
    taskId: task.taskId,
    source: task.source,
    intent: task.intent ?? {
      summary: task.title,
      requestedAction: task.requestedAction,
      successCriteria: task.successCriteria,
      outOfScope: task.outOfScope
    },
    repoContext: {
      ...(repoContext.root !== undefined ? { repoRoot: repoContext.root } : {}),
      ...(repoContext.branch !== undefined ? { branch: repoContext.branch } : {}),
      ...(repoContext.worktreeClean !== undefined
        ? { worktreeClean: repoContext.worktreeClean }
        : {}),
      ...(repoContext.protectedBranch !== undefined
        ? { protectedBranch: repoContext.protectedBranch }
        : {})
    },
    target: {
      branches: [...task.target.branches],
      files: [...task.target.files],
      modules: [...task.target.modules]
    },
    constraints: {
      ...(typeof task.constraints.requiresNetwork === "boolean"
        ? { requiresNetwork: task.constraints.requiresNetwork }
        : {}),
      ...(typeof task.constraints.explicitOwnership === "boolean"
        ? { explicitOwnership: task.constraints.explicitOwnership }
        : {}),
      ...(typeof task.constraints.allowBackgroundAutomation === "boolean"
        ? { allowBackgroundAutomation: task.constraints.allowBackgroundAutomation }
        : {})
    },
    hints: {
      ...(taskClassHint ? { taskClassHint } : {}),
      riskHints: [...task.hints.riskHints],
      tags: [...task.hints.tags]
    }
  };

  return parseTaskEnvelope(taskEnvelopeInput);
}

function policyDecisionToRoutingDecision(
  policyDecision: PolicyDecision,
  task: TaskEnvelope,
  effectiveSandbox: CodexCliSandboxMode
): RoutingDecisionInput {
  const taskClass = resolveRoutingTaskClass(policyDecision, task);
  const selectedModel = policyDecision.execution.model;

  if (!selectedModel) {
    throw new Error("codex_cli_provider_policy_model_missing");
  }
  const parsedModel = ModelIdSchema.parse(selectedModel);

  return {
    schemaVersion: "routing-decision.v1",
    decisionId: `routing_from_policy_${policyDecision.decisionId}`,
    taskId: policyDecision.taskId,
    policyVersion: policyDecision.policyVersion,
    classification: {
      taskClass,
      riskLevel: resolveRoutingRiskLevel(policyDecision),
      ambiguityScore: policyDecision.classification?.ambiguityScore
        ?? policyDecision.risk.ambiguityScore,
      clarificationRequired: policyDecision.classification?.clarificationRequired
        ?? policyDecision.risk.clarificationRequired,
      riskFactors: policyDecision.classification?.riskFactors
        ?? policyDecision.risk.factors
    },
    execution: {
      selectedModel: parsedModel,
      toolAccess: resolveToolAccess(policyDecision, effectiveSandbox),
      executionProfile: resolveExecutionProfile(policyDecision, taskClass),
      reasoningEffort: policyDecision.execution.reasoningEffort
        ?? resolveReasoningEffort(policyDecision)
    },
    approval: {
      required: policyDecision.approval.required,
      reasons: [...policyDecision.approval.reasons]
    },
    parallelism: {
      allowed: policyDecision.parallelism.allowed,
      maxAgents: policyDecision.parallelism.maxAgents,
      mode: resolveParallelismMode(policyDecision.parallelism.mode)
    },
    hostRoute: "codex-cli"
  };
}

function resolveTaskClass(
  task: Task,
  policyDecision: PolicyDecision
): TaskClass | undefined {
  if (policyDecision.classification?.taskClass) {
    return policyDecision.classification.taskClass;
  }

  if (isTaskClass(policyDecision.legacy.taskClass)) {
    return policyDecision.legacy.taskClass;
  }

  if (isTaskClass(task.hints.taskClass)) {
    return task.hints.taskClass;
  }

  return undefined;
}

function resolveRoutingTaskClass(
  policyDecision: PolicyDecision,
  task: TaskEnvelope
): TaskClass {
  if (policyDecision.classification?.taskClass) {
    return policyDecision.classification.taskClass;
  }

  if (isTaskClass(policyDecision.legacy.taskClass)) {
    return policyDecision.legacy.taskClass;
  }

  if (task.hints.taskClassHint) {
    return task.hints.taskClassHint;
  }

  if (policyDecision.risk.level === "high" || policyDecision.risk.level === "critical") {
    return "high_risk";
  }

  return policyDecision.execution.sandbox.mode === "read-only"
    ? "read_only"
    : "engineering";
}

function resolveRoutingRiskLevel(policyDecision: PolicyDecision): "low" | "medium" | "high" {
  if (policyDecision.classification?.riskLevel) {
    return policyDecision.classification.riskLevel;
  }

  return policyDecision.risk.level === "critical"
    ? "high"
    : policyDecision.risk.level;
}

function resolveToolAccess(
  policyDecision: PolicyDecision,
  effectiveSandbox: CodexCliSandboxMode
): ToolAccessLevel {
  if (hasProtectedRemoteSideEffect(policyDecision) || hasExternalSideEffect(policyDecision)) {
    return "protected_remote";
  }

  if (effectiveSandbox === "read-only") {
    return "read_only";
  }

  if (hasLocalCommand(policyDecision)) {
    return "engineering_write";
  }

  return "local_write";
}

function resolveExecutionProfile(
  policyDecision: PolicyDecision,
  taskClass: TaskClass
): ExecutionProfileName {
  if (isExecutionProfileName(policyDecision.execution.profile)) {
    return policyDecision.execution.profile;
  }

  if (policyDecision.risk.clarificationRequired) {
    return "clarify-then-plan";
  }

  switch (taskClass) {
    case "read_only":
      return "recon-only";
    case "high_risk":
      return "high-risk-change";
    case "release_external_action":
      return "release-governance";
    case "small_edit":
    case "engineering":
      return "engineering";
  }
}

function resolveReasoningEffort(policyDecision: PolicyDecision): ReasoningEffort {
  switch (policyDecision.risk.level) {
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
    case "critical":
      return "high";
  }
}

function resolveParallelismMode(mode: string): ParallelismMode {
  if (mode === "read_only" || mode === "owned_write") {
    return mode;
  }

  return "disabled";
}

function sanitizeCodexCliPlan(plan: CodexCliExecPlan): CodexCliProviderSanitizedPlan {
  const argsWithoutPrompt = plan.args.at(-1) === plan.prompt
    ? plan.args.slice(0, -1)
    : plan.args.map((arg) => arg === plan.prompt ? CODEX_CLI_PROVIDER_PROMPT_OMITTED : arg);
  const sanitized: CodexCliProviderSanitizedPlan = {
    schemaVersion: "codex-cli-provider-sanitized-plan.v1",
    command: plan.command,
    argsWithoutPrompt,
    promptOmitted: true,
    sandbox: plan.sandbox,
    approvalPolicy: plan.approvalPolicy,
    warnings: [...plan.warnings]
  };

  if (plan.model !== undefined) {
    sanitized.model = plan.model;
  }

  if (plan.workdir !== undefined) {
    sanitized.workdir = plan.workdir;
  }

  if (plan.modelResolution !== undefined) {
    sanitized.modelResolution = plan.modelResolution;
  }

  return sanitized;
}

function createValidationCodexCliPlan(
  plan: ExecutorExecutionPlan,
  metadata: CodexCliProviderPlanMetadata
): CodexCliExecPlan {
  const prompt = CODEX_CLI_PROVIDER_PROMPT_OMITTED;
  const task = createRedactedValidationTask(plan, metadata);
  const codexCliPlan = metadata.codexCliPlan;
  const validationPlan: CodexCliExecPlan = {
    command: codexCliPlan.command,
    args: [...codexCliPlan.argsWithoutPrompt, prompt],
    prompt,
    task,
    sandbox: codexCliPlan.sandbox,
    approvalPolicy: codexCliPlan.approvalPolicy,
    warnings: [...codexCliPlan.warnings]
  };

  if (codexCliPlan.model !== undefined) {
    validationPlan.model = codexCliPlan.model;
  }

  if (codexCliPlan.workdir !== undefined) {
    validationPlan.workdir = codexCliPlan.workdir;
  }

  return validationPlan;
}

function createRedactedValidationTask(
  plan: ExecutorExecutionPlan,
  metadata: CodexCliProviderPlanMetadata
): TaskEnvelope {
  return parseTaskEnvelope({
    schemaVersion: "task-envelope.v1",
    taskId: plan.taskId,
    source: "cli",
    intent: {
      summary: "redacted provider validation placeholder",
      requestedAction: "validate sanitized Codex CLI execution plan",
      successCriteria: [],
      outOfScope: []
    },
    repoContext: {
      ...(metadata.codexCliPlan.workdir !== undefined
        ? { repoRoot: metadata.codexCliPlan.workdir }
        : {})
    },
    target: {
      branches: [],
      files: [],
      modules: ["codex-cli-provider"]
    },
    constraints: {},
    hints: {
      taskClassHint: plan.sandboxProfile.mode === "read-only"
        ? "read_only"
        : "engineering",
      riskHints: [],
      tags: ["provider-validation-placeholder"]
    }
  });
}

function readCodexCliProviderMetadata(
  plan: ExecutorExecutionPlan
): CodexCliProviderPlanMetadata | undefined {
  const metadata = plan.metadata.codexCliProvider;

  if (!isRecord(metadata)) {
    return undefined;
  }

  const codexCliPlan = metadata.codexCliPlan;
  if (!isRecord(codexCliPlan)) {
    return undefined;
  }

  if (
    metadata.schemaVersion !== "codex-cli-provider-plan-metadata.v1"
    || metadata.promptStorage !== "omitted"
    || typeof metadata.policyAllowsWorkspaceWrite !== "boolean"
    || typeof metadata.policyDecisionHash !== "string"
    || typeof metadata.routingDecisionHash !== "string"
    || codexCliPlan.schemaVersion !== "codex-cli-provider-sanitized-plan.v1"
    || typeof codexCliPlan.command !== "string"
    || !Array.isArray(codexCliPlan.argsWithoutPrompt)
    || !codexCliPlan.argsWithoutPrompt.every((arg) => typeof arg === "string")
    || codexCliPlan.promptOmitted !== true
    || !isCodexCliSandboxMode(codexCliPlan.sandbox)
    || !isCodexCliApprovalPolicy(codexCliPlan.approvalPolicy)
    || !Array.isArray(codexCliPlan.warnings)
    || !codexCliPlan.warnings.every((warning) => typeof warning === "string")
  ) {
    return undefined;
  }

  const parsedPlan: CodexCliProviderSanitizedPlan = {
    schemaVersion: "codex-cli-provider-sanitized-plan.v1",
    command: codexCliPlan.command,
    argsWithoutPrompt: [...codexCliPlan.argsWithoutPrompt],
    promptOmitted: true,
    sandbox: codexCliPlan.sandbox,
    approvalPolicy: codexCliPlan.approvalPolicy,
    warnings: [...codexCliPlan.warnings]
  };

  if (typeof codexCliPlan.model === "string") {
    parsedPlan.model = codexCliPlan.model;
  }

  if (typeof codexCliPlan.workdir === "string") {
    parsedPlan.workdir = codexCliPlan.workdir;
  }

  if ("modelResolution" in codexCliPlan) {
    parsedPlan.modelResolution = codexCliPlan.modelResolution;
  }

  return {
    schemaVersion: "codex-cli-provider-plan-metadata.v1",
    promptStorage: "omitted",
    policyAllowsWorkspaceWrite: metadata.policyAllowsWorkspaceWrite,
    policyDecisionHash: metadata.policyDecisionHash,
    routingDecisionHash: metadata.routingDecisionHash,
    codexCliPlan: parsedPlan
  };
}

function validateCodexCliProviderMetadata(
  metadata: CodexCliProviderPlanMetadata
): string[] {
  const reasons: string[] = [];
  const rawMetadata = metadata as unknown as Record<string, unknown>;
  const rawCodexPlan = metadata.codexCliPlan as unknown as Record<string, unknown>;

  if ("prompt" in rawMetadata || "prompt" in rawCodexPlan) {
    reasons.push("codex_cli_provider_plan_must_not_store_prompt");
  }

  if (metadata.codexCliPlan.promptOmitted !== true) {
    reasons.push("codex_cli_provider_prompt_omission_required");
  }

  if (
    metadata.codexCliPlan.argsWithoutPrompt.some((arg) => (
      arg.includes("Task envelope:") || arg.includes(CODEX_CLI_PROVIDER_PROMPT_OMITTED)
    ))
  ) {
    reasons.push("codex_cli_provider_args_must_not_store_prompt");
  }

  return reasons;
}

function validateCodexCliPlanAlignment(
  plan: ExecutorExecutionPlan,
  metadata: CodexCliProviderPlanMetadata
): string[] {
  const reasons: string[] = [];

  if (metadata.codexCliPlan.sandbox !== plan.sandboxProfile.mode) {
    reasons.push(
      `codex_cli_provider_sandbox_mismatch:${metadata.codexCliPlan.sandbox}:${plan.sandboxProfile.mode}`
    );
  }

  if (
    plan.sideEffectClass === "read_only"
    && metadata.codexCliPlan.sandbox !== "read-only"
  ) {
    reasons.push("codex_cli_provider_readonly_plan_must_use_readonly_sandbox");
  }

  if (
    plan.sideEffectClass === "workspace_write"
    && metadata.codexCliPlan.sandbox !== "workspace-write"
  ) {
    reasons.push("codex_cli_provider_workspace_write_plan_must_use_write_sandbox");
  }

  return reasons;
}

function createCodexCliProviderInputHash(input: ExecutionPlanInput): string {
  return hashKernelObject({
    task: input.task,
    run: input.run,
    policyDecision: input.policyDecision,
    sandboxProfile: input.sandboxProfile,
    proposedInputHash: input.proposedInput === undefined
      ? undefined
      : hashKernelObject(input.proposedInput)
  });
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

function explainRequestedSandboxPolicyMismatch(
  requested: SandboxProfile,
  policySandbox: SandboxProfile
): string | undefined {
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

function collectProviderSupportReason(
  action: () => void,
  reasons: string[]
): void {
  try {
    action();
  } catch (error) {
    reasons.push(normalizeErrorMessage(error));
  }
}

function normalizeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function isTaskClass(value: unknown): value is TaskClass {
  return [
    "read_only",
    "small_edit",
    "engineering",
    "high_risk",
    "release_external_action"
  ].includes(String(value));
}

function isExecutionProfileName(value: unknown): value is ExecutionProfileName {
  return [
    "recon-only",
    "clarify-then-plan",
    "engineering",
    "high-risk-change",
    "release-governance"
  ].includes(String(value));
}

function isCodexCliSandboxMode(value: unknown): value is CodexCliSandboxMode {
  return value === "read-only" || value === "workspace-write";
}

function isCodexCliApprovalPolicy(value: unknown): value is CodexCliApprovalPolicy {
  return value === "untrusted" || value === "on-request" || value === "never";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
