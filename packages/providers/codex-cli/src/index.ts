import { posix as pathPosix } from "node:path";
import {
  createCodexCliExecPlanFromRoutingDecision,
  runCodexCliExecPlan,
  validateCodexCliExecPlanForRun,
  type CodexCliApprovalPolicy,
  type CodexCliExecPlan,
  type CodexCliProcessRunResult,
  type CodexCliProcessSpawner,
  type CodexCliRuntimeBinding,
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
  type Artifact,
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
  consumeProviderExecutionPermitForPlan,
  createProviderExecutionPermitConsumptionKey,
  InMemoryProviderExecutionPermitConsumptionStore,
  parseExecutorExecutionPlan,
  parseProviderManifest,
  validateProviderExecutionPermitForPlan,
  hashProviderManifest,
  type ExecutionPlanInput,
  type ExecutionValidationResult,
  type ExecutorExecutionPlan,
  type ExecutorProvider,
  type ProviderExecutionContext,
  type ProviderExecutionResult,
  type ProviderExecutionPermitConsumptionStore,
  type ProviderManifest,
  type ProviderSideEffectClass
} from "../../../provider-core/src/index.js";

export const CODEX_CLI_PROVIDER_ID = "codex-cli";
export const CODEX_CLI_PROVIDER_EXECUTE_DISABLED =
  "codex_cli_provider_execute_disabled";
export const CODEX_CLI_PROVIDER_PROMPT_OMITTED =
  "<codex-cli-provider-prompt-omitted>";

const defaultCodexCliPermitConsumptionStore =
  new InMemoryProviderExecutionPermitConsumptionStore();

export interface CodexCliExecutorProviderOptions {
  manifest?: ProviderManifest;
  executionEnabled?: boolean;
  executionMode?: CodexCliProviderExecutionMode;
  realExecutionAllowed?: boolean;
  spawn?: CodexCliProcessSpawner;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  oneShotEnv?: NodeJS.ProcessEnv;
  skipExecutionModelProbe?: boolean;
  permitConsumptionStore?: ProviderExecutionPermitConsumptionStore;
  promptHandoffStore?: CodexCliProviderPromptHandoffStore;
  promptHandoffTtlMs?: number;
  nowMs?: () => number;
}

export type CodexCliProviderExecutionMode = "fake" | "real";

export interface CodexCliProviderRealExecutionGuard {
  schemaVersion: "codex-cli-provider-real-execution-guard.v1";
  realExecutionAllowed: true;
  providerRegistrySelection: {
    selected: true;
    providerId: string;
    manifestHash: string;
    kind?: string;
    enabled?: boolean;
  };
  environmentPreflight: {
    status: "ready" | "blocked";
    checks: {
      injectedSpawner: boolean;
      realCliAllowed: boolean;
      versionProbe: "passed" | "failed" | "skipped";
      noTaskEnvelope: boolean;
      noPromptSent: boolean;
      noWorkspaceWrite: boolean;
      noRealCliFallback: boolean;
    };
    blockingReasons: string[];
  };
}

export interface CodexCliProviderSanitizedPlan {
  schemaVersion: "codex-cli-provider-sanitized-plan.v1";
  promptOmitted: true;
  sandbox: CodexCliSandboxMode;
  approvalPolicy: CodexCliApprovalPolicy;
  runtimeBinding: CodexCliRuntimeBinding;
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
  promptHandoff: CodexCliProviderPromptHandoffMetadata;
  codexCliPlan: CodexCliProviderSanitizedPlan;
}

export interface CodexCliProviderPromptHandoffMetadata {
  schemaVersion: "codex-cli-provider-handoff.v1";
  storage: "one-shot";
  handle: string;
  inputHash: string;
  contentHash: string;
}

export interface CodexCliProviderPromptHandoffRecord {
  schemaVersion: "codex-cli-provider-handoff-record.v1";
  handle: string;
  planId: string;
  runId: string;
  taskId: string;
  inputHash: string;
  contentHash: string;
  content: string;
  expiresAtMs?: number;
}

export interface CodexCliProviderPromptHandoffStore {
  put(record: CodexCliProviderPromptHandoffRecord): void;
  peek?(handle: string): CodexCliProviderPromptHandoffRecord | undefined;
  consume(handle: string): CodexCliProviderPromptHandoffRecord | undefined;
}

class InMemoryCodexCliProviderPromptHandoffStore implements CodexCliProviderPromptHandoffStore {
  private readonly records = new Map<string, CodexCliProviderPromptHandoffRecord>();

  constructor(private readonly nowMs: () => number) {}

  put(record: CodexCliProviderPromptHandoffRecord): void {
    this.records.set(record.handle, {
      ...record
    });
  }

  peek(handle: string): CodexCliProviderPromptHandoffRecord | undefined {
    const record = this.records.get(handle);
    if (record?.expiresAtMs !== undefined && record.expiresAtMs <= this.nowMs()) {
      this.records.delete(handle);
      return undefined;
    }

    return record === undefined ? undefined : {
      ...record
    };
  }

  consume(handle: string): CodexCliProviderPromptHandoffRecord | undefined {
    const record = this.peek(handle);
    this.records.delete(handle);
    return record;
  }
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
  private readonly executionMode: CodexCliProviderExecutionMode;
  private readonly realExecutionAllowed: boolean;
  private readonly spawn: CodexCliProcessSpawner | undefined;
  private readonly fakeModeProcessSpawnerConfigured: boolean;
  private readonly timeoutMs: number | undefined;
  private readonly env: NodeJS.ProcessEnv | undefined;
  private readonly oneShotEnv: NodeJS.ProcessEnv | undefined;
  private readonly skipExecutionModelProbe: boolean;
  private readonly permitConsumptionStore: ProviderExecutionPermitConsumptionStore;
  private readonly promptHandoffStore: CodexCliProviderPromptHandoffStore;
  private readonly promptHandoffTtlMs: number;
  private readonly nowMs: () => number;

  constructor(options: CodexCliExecutorProviderOptions = {}) {
    this.manifest = options.manifest ?? codexCliProviderManifest;
    this.executionEnabled = options.executionEnabled ?? false;
    this.executionMode = options.executionMode ?? "fake";
    this.realExecutionAllowed = options.realExecutionAllowed ?? false;
    this.spawn = options.spawn;
    this.fakeModeProcessSpawnerConfigured = this.executionMode !== "real"
      && options.spawn !== undefined;
    this.timeoutMs = options.timeoutMs;
    this.env = options.env;
    this.oneShotEnv = options.oneShotEnv;
    this.skipExecutionModelProbe = options.skipExecutionModelProbe ?? true;
    this.nowMs = options.nowMs ?? (() => Date.now());
    this.permitConsumptionStore = options.permitConsumptionStore
      ?? defaultCodexCliPermitConsumptionStore;
    this.promptHandoffTtlMs = options.promptHandoffTtlMs ?? 5 * 60 * 1000;
    this.promptHandoffStore = options.promptHandoffStore
      ?? new InMemoryCodexCliProviderPromptHandoffStore(this.nowMs);
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
        ephemeral: true
      }
    );
    const policyDecisionHash = hashKernelObject(input.policyDecision);
    const routingDecisionHash = hashKernelObject(parsedRoutingDecision);
    const inputHash = input.inputHash ?? createCodexCliProviderInputHash(input);
    const planId = `plan_codex_cli_${input.task.taskId}_${inputHash.slice(0, 12)}`;
    const promptHandoff = createCodexCliProviderPromptHandoffMetadata({
      planId,
      runId: input.run.runId,
      taskId: input.task.taskId,
      inputHash,
      content: codexCliPlan.prompt
    });
    const metadata: CodexCliProviderPlanMetadata = {
      schemaVersion: "codex-cli-provider-plan-metadata.v1",
      promptStorage: "omitted",
      policyAllowsWorkspaceWrite: effectiveSandbox === "workspace-write",
      policyDecisionHash,
      routingDecisionHash,
      promptHandoff,
      codexCliPlan: sanitizeCodexCliPlan(codexCliPlan)
    };

    const executionPlan = parseExecutorExecutionPlan({
      schemaVersion: "executor-execution-plan.v1",
      kind: "executor",
      planId,
      runId: input.run.runId,
      taskId: input.task.taskId,
      ...(input.taskHash !== undefined ? { taskHash: input.taskHash } : {}),
      ...(input.principalId !== undefined ? { principalId: input.principalId } : {}),
      ...(input.principalHash !== undefined ? { principalHash: input.principalHash } : {}),
      ...(input.providerExecutionPlanHash !== undefined
        ? { providerExecutionPlanHash: input.providerExecutionPlanHash }
        : {}),
      ...(input.providerManifestHash !== undefined ? { providerManifestHash: input.providerManifestHash } : {}),
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
    this.promptHandoffStore.put({
      schemaVersion: "codex-cli-provider-handoff-record.v1",
      handle: promptHandoff.handle,
      planId,
      runId: input.run.runId,
      taskId: input.task.taskId,
      inputHash,
      contentHash: promptHandoff.contentHash,
      content: codexCliPlan.prompt,
      expiresAtMs: this.nowMs() + this.promptHandoffTtlMs
    });

    return executionPlan;
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

  async execute(
    plan: ExecutorExecutionPlan,
    context: ProviderExecutionContext
  ): Promise<ProviderExecutionResult> {
    if (!this.executionEnabled) {
      throw new CodexCliProviderExecutionDisabledError();
    }

    const validation = this.validateExecutionPlan(plan);
    if (!validation.valid) {
      return createCodexCliProviderErrorResult(
        "codex_cli_provider_execution_plan_invalid",
        validation.reasons
      );
    }

    const parsedPlan = parseExecutorExecutionPlan(plan);
    const metadata = readCodexCliProviderMetadata(parsedPlan);
    if (!metadata) {
      return createCodexCliProviderErrorResult(
        "codex_cli_provider_execution_plan_invalid",
        ["codex_cli_provider_metadata_missing"]
      );
    }

    const readOnlyRejectionReasons = collectReadOnlyExecutionRejectionReasons(
      parsedPlan,
      metadata
    );
    if (readOnlyRejectionReasons.length > 0) {
      return createCodexCliProviderErrorResult(
        "codex_cli_provider_execute_rejected",
        readOnlyRejectionReasons
      );
    }

    if (context.dryRun === true) {
      const summary = createCodexCliProviderDryRunSummary(parsedPlan, metadata);
      return {
        ok: true,
        artifacts: [
          createCodexCliProviderSummaryArtifact(
            parsedPlan,
            "codex-cli-provider-dry-run",
            summary
          )
        ]
      };
    }

    const executionNow = new Date(this.nowMs()).toISOString();
    const permitRejectionReasons = validateCodexCliProviderExecutionPermit(
      parsedPlan,
      context,
      this.manifest,
      executionNow
    );
    if (permitRejectionReasons.length > 0) {
      return createCodexCliProviderErrorResult(
        permitRejectionReasons.includes("codex_cli_provider_execution_permit_required")
          ? "codex_cli_provider_execution_permit_required"
          : "codex_cli_provider_execution_permit_invalid",
        permitRejectionReasons
      );
    }

    if (this.executionMode === "fake" && this.fakeModeProcessSpawnerConfigured) {
      return createCodexCliProviderErrorResult(
        "codex_cli_provider_fake_execute_rejected",
        ["codex_cli_provider_fake_execute_disallows_process_spawner"]
      );
    }

    const realExecutionRejectionReasons = collectRealExecutionRejectionReasons({
      plan: parsedPlan,
      context,
      manifest: this.manifest,
      executionMode: this.executionMode,
      realExecutionAllowed: this.realExecutionAllowed,
      timeoutMs: this.timeoutMs
    });
    if (realExecutionRejectionReasons.length > 0) {
      return createCodexCliProviderErrorResult(
        "codex_cli_provider_real_execute_rejected",
        realExecutionRejectionReasons
      );
    }

    if (this.executionMode === "real" && !this.spawn) {
      return createCodexCliProviderErrorResult(
        "codex_cli_provider_execute_requires_injected_spawn",
        ["codex_cli_provider_execute_requires_injected_spawn"]
      );
    }

    const handoff = peekCodexCliProviderPromptHandoff(
      this.promptHandoffStore,
      metadata.promptHandoff.handle
    );
    const handoffValidationReasons = validateCodexCliProviderPromptHandoff(
      parsedPlan,
      metadata,
      handoff
    );
    if (handoffValidationReasons.length > 0 || handoff === undefined) {
      const consumedPermitReplayReasons = collectConsumedCodexCliProviderPermitReasons(
        parsedPlan,
        context,
        this.manifest,
        this.permitConsumptionStore,
        executionNow
      );
      if (consumedPermitReplayReasons.length > 0) {
        return createCodexCliProviderErrorResult(
          "codex_cli_provider_execution_permit_replay_rejected",
          consumedPermitReplayReasons
        );
      }

      return createCodexCliProviderErrorResult(
        "codex_cli_provider_handoff_invalid",
        handoffValidationReasons.length > 0
          ? handoffValidationReasons
          : ["codex_cli_provider_handoff_missing"]
      );
    }

    const permitConsumptionReasons = consumeCodexCliProviderExecutionPermit(
      parsedPlan,
      context,
      this.manifest,
      this.permitConsumptionStore,
      executionNow
    );
    if (permitConsumptionReasons.length > 0) {
      return createCodexCliProviderErrorResult(
        "codex_cli_provider_execution_permit_replay_rejected",
        permitConsumptionReasons
      );
    }

    const consumedHandoff = this.promptHandoffStore.consume(metadata.promptHandoff.handle);
    const consumedHandoffValidationReasons = validateCodexCliProviderPromptHandoff(
      parsedPlan,
      metadata,
      consumedHandoff
    );
    if (consumedHandoffValidationReasons.length > 0) {
      return createCodexCliProviderErrorResult(
        "codex_cli_provider_handoff_invalid",
        consumedHandoffValidationReasons
      );
    }

    if (this.executionMode === "fake") {
      const summary = createCodexCliProviderFakeExecutionSummary(parsedPlan, metadata);
      return {
        ok: true,
        artifacts: [
          createCodexCliProviderSummaryArtifact(
            parsedPlan,
            "codex-cli-provider-fake-execution-summary",
            summary
          )
        ]
      };
    }

    if (!this.spawn) {
      return createCodexCliProviderErrorResult(
        "codex_cli_provider_execute_requires_injected_spawn",
        ["codex_cli_provider_execute_requires_injected_spawn"]
      );
    }

    const codexCliPlan = createExecutionCodexCliPlan(
      parsedPlan,
      metadata,
      handoff.content
    );
    let run: CodexCliProcessRunResult;
    try {
      run = await runCodexCliExecPlan(codexCliPlan, {
        allowWriteSandbox: false,
        spawn: this.spawn,
        skipExecutionModelProbe: this.skipExecutionModelProbe,
        governance: {
          enabled: false
        },
        ...(this.timeoutMs !== undefined ? { timeoutMs: this.timeoutMs } : {}),
        ...(this.env !== undefined ? { env: this.env } : {}),
        ...(this.oneShotEnv !== undefined ? { oneShotEnv: this.oneShotEnv } : {})
      });
    } catch (error) {
      return createCodexCliProviderErrorResult(
        "codex_cli_provider_execute_failed",
        [normalizeErrorMessage(error)]
      );
    }

    const summary = createCodexCliProviderExecutionSummary(
      parsedPlan,
      metadata,
      run
    );

    return {
      ok: run.inspection.status === "completed",
      artifacts: [
        createCodexCliProviderSummaryArtifact(
          parsedPlan,
          "codex-cli-provider-execution-summary",
          summary
        )
      ]
    };
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
  const toolAccess = resolveToolAccess(policyDecision, effectiveSandbox);

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
      toolAccess,
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
    hostRoute: "codex-cli",
    providerGrant: {
      schemaVersion: "provider-grant.v1",
      grantId: `provider_grant_${policyDecision.decisionId}_${CODEX_CLI_PROVIDER_ID}`,
      providerId: CODEX_CLI_PROVIDER_ID,
      providerKind: "executor",
      sideEffectClass: resolveProviderGrantSideEffectClass(policyDecision, effectiveSandbox),
      toolAccess,
      sandboxMode: effectiveSandbox,
      approvalRequired: policyDecision.approval.required,
      requiredApprovals: [...policyDecision.approval.reasons],
      reasons: [
        "host_route:codex-cli",
        `tool_access:${toolAccess}`
      ]
    }
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

function resolveProviderGrantSideEffectClass(
  policyDecision: PolicyDecision,
  effectiveSandbox: CodexCliSandboxMode
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

  if (hasLocalCommand(policyDecision)) {
    return "local_command";
  }

  if (effectiveSandbox === "workspace-write") {
    return "workspace_write";
  }

  return "read_only";
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
  const sanitized: CodexCliProviderSanitizedPlan = {
    schemaVersion: "codex-cli-provider-sanitized-plan.v1",
    promptOmitted: true,
    sandbox: plan.sandbox,
    approvalPolicy: plan.approvalPolicy,
    runtimeBinding: cloneCodexCliRuntimeBinding(plan.runtimeBinding),
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

function cloneCodexCliRuntimeBinding(
  binding: CodexCliRuntimeBinding
): CodexCliRuntimeBinding {
  return {
    schemaVersion: binding.schemaVersion,
    runtimeId: binding.runtimeId,
    descriptorHash: binding.descriptorHash,
    commandHash: binding.commandHash,
    argvShapeHash: binding.argvShapeHash,
    promptChannel: binding.promptChannel,
    protocol: binding.protocol,
    trusted: binding.trusted,
    ...(binding.workdirHash !== undefined ? { workdirHash: binding.workdirHash } : {})
  };
}

function createCodexCliProviderArgs(
  plan: CodexCliProviderSanitizedPlan
): string[] {
  const args = [
    "-a",
    plan.approvalPolicy,
    "exec",
    "--json",
    "--sandbox",
    plan.sandbox
  ];

  if (plan.model !== undefined) {
    args.push("--model", plan.model);
  }

  if (plan.workdir !== undefined) {
    args.push("--cd", plan.workdir);
  }

  args.push("--ephemeral", "--ignore-user-config");
  return args;
}

function createCodexCliProviderPromptHandoffMetadata(input: {
  planId: string;
  runId: string;
  taskId: string;
  inputHash: string;
  content: string;
}): CodexCliProviderPromptHandoffMetadata {
  const contentHash = hashCodexCliProviderPromptContent(input.content);
  return {
    schemaVersion: "codex-cli-provider-handoff.v1",
    storage: "one-shot",
    handle: [
      "handoff_codex_cli",
      toSafeCodexCliProviderHandoffPart(input.taskId),
      toSafeCodexCliProviderHandoffPart(input.runId),
      input.inputHash.slice(0, 12),
      contentHash.slice(0, 12)
    ].join("_"),
    inputHash: input.inputHash,
    contentHash
  };
}

function createValidationCodexCliPlan(
  plan: ExecutorExecutionPlan,
  metadata: CodexCliProviderPlanMetadata
): CodexCliExecPlan {
  const prompt = CODEX_CLI_PROVIDER_PROMPT_OMITTED;
  const task = createRedactedValidationTask(plan, metadata);
  const codexCliPlan = metadata.codexCliPlan;
  const validationPlan: CodexCliExecPlan = {
    command: "codex",
    args: createCodexCliProviderArgs(codexCliPlan),
    prompt,
    task,
    sandbox: codexCliPlan.sandbox,
    approvalPolicy: codexCliPlan.approvalPolicy,
    runtimeBinding: cloneCodexCliRuntimeBinding(codexCliPlan.runtimeBinding),
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

function createExecutionCodexCliPlan(
  plan: ExecutorExecutionPlan,
  metadata: CodexCliProviderPlanMetadata,
  prompt: string
): CodexCliExecPlan {
  const executionPlan = createValidationCodexCliPlan(plan, metadata);
  return {
    ...executionPlan,
    args: createCodexCliProviderArgs(metadata.codexCliPlan),
    prompt
  };
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
  const promptHandoff = metadata.promptHandoff;
  const runtimeBinding = isRecord(codexCliPlan)
    ? readCodexCliRuntimeBinding(codexCliPlan.runtimeBinding)
    : undefined;
  if (!isRecord(codexCliPlan)) {
    return undefined;
  }
  if (!isRecord(promptHandoff)) {
    return undefined;
  }

  if (
    metadata.schemaVersion !== "codex-cli-provider-plan-metadata.v1"
    || metadata.promptStorage !== "omitted"
    || typeof metadata.policyAllowsWorkspaceWrite !== "boolean"
    || typeof metadata.policyDecisionHash !== "string"
    || typeof metadata.routingDecisionHash !== "string"
    || promptHandoff.schemaVersion !== "codex-cli-provider-handoff.v1"
    || promptHandoff.storage !== "one-shot"
    || typeof promptHandoff.handle !== "string"
    || typeof promptHandoff.inputHash !== "string"
    || typeof promptHandoff.contentHash !== "string"
    || codexCliPlan.schemaVersion !== "codex-cli-provider-sanitized-plan.v1"
    || codexCliPlan.promptOmitted !== true
    || !isCodexCliSandboxMode(codexCliPlan.sandbox)
    || !isCodexCliApprovalPolicy(codexCliPlan.approvalPolicy)
    || runtimeBinding === undefined
    || !Array.isArray(codexCliPlan.warnings)
    || !codexCliPlan.warnings.every((warning) => typeof warning === "string")
  ) {
    return undefined;
  }

  const parsedPlan: CodexCliProviderSanitizedPlan = {
    schemaVersion: "codex-cli-provider-sanitized-plan.v1",
    promptOmitted: true,
    sandbox: codexCliPlan.sandbox,
    approvalPolicy: codexCliPlan.approvalPolicy,
    runtimeBinding,
    warnings: [...codexCliPlan.warnings]
  };
  const parsedPlanRecord = parsedPlan as unknown as Record<string, unknown>;
  for (const rawRuntimeField of ["command", "args", "argv", "argsWithoutPrompt"]) {
    if (rawRuntimeField in codexCliPlan) {
      parsedPlanRecord[rawRuntimeField] = codexCliPlan[rawRuntimeField];
    }
  }

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
    promptHandoff: {
      schemaVersion: "codex-cli-provider-handoff.v1",
      storage: "one-shot",
      handle: promptHandoff.handle,
      inputHash: promptHandoff.inputHash,
      contentHash: promptHandoff.contentHash
    },
    codexCliPlan: parsedPlan
  };
}

function readCodexCliRuntimeBinding(
  value: unknown
): CodexCliRuntimeBinding | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const hashKeys = [
    "descriptorHash",
    "commandHash",
    "argvShapeHash"
  ];
  const hashValuesValid = hashKeys.every((key) => (
    typeof value[key] === "string"
    && /^[a-f0-9]{64}$/.test(value[key])
  ));

  if (
    value.schemaVersion !== "codex-cli-runtime-binding.v1"
    || typeof value.runtimeId !== "string"
    || !hashValuesValid
    || (value.workdirHash !== undefined && (
      typeof value.workdirHash !== "string"
      || !/^[a-f0-9]{64}$/.test(value.workdirHash)
    ))
    || value.promptChannel !== "stdin"
    || value.protocol !== "exec-json-stdin-prompt.v1"
    || value.trusted !== true
  ) {
    return undefined;
  }

  return {
    schemaVersion: "codex-cli-runtime-binding.v1",
    runtimeId: value.runtimeId,
    descriptorHash: value.descriptorHash as string,
    commandHash: value.commandHash as string,
    argvShapeHash: value.argvShapeHash as string,
    promptChannel: "stdin",
    protocol: "exec-json-stdin-prompt.v1",
    trusted: true,
    ...(value.workdirHash !== undefined ? { workdirHash: value.workdirHash } : {})
  };
}

function collectReadOnlyExecutionRejectionReasons(
  plan: ExecutorExecutionPlan,
  metadata: CodexCliProviderPlanMetadata
): string[] {
  const reasons: string[] = [];

  if (plan.sideEffectClass !== "read_only") {
    reasons.push("codex_cli_provider_execute_only_supports_read_only");
  }

  if (
    plan.sandboxProfile.mode !== "read-only"
    || metadata.codexCliPlan.sandbox !== "read-only"
  ) {
    reasons.push("codex_cli_provider_execute_requires_read_only_sandbox");
  }

  if (metadata.policyAllowsWorkspaceWrite !== false) {
    reasons.push("codex_cli_provider_execute_disallows_workspace_write");
  }

  return uniqueStrings(reasons);
}

function validateCodexCliProviderExecutionPermit(
  plan: ExecutorExecutionPlan,
  context: ProviderExecutionContext,
  manifest: ProviderManifest,
  now: string
): string[] {
  if (context.permit === undefined) {
    return ["codex_cli_provider_execution_permit_required"];
  }

  return validateProviderExecutionPermitForPlan(
    context.permit,
    plan,
    manifest,
    {
      reasonPrefix: "codex_cli_provider_execution_permit",
      now
    }
  );
}

function consumeCodexCliProviderExecutionPermit(
  plan: ExecutorExecutionPlan,
  context: ProviderExecutionContext,
  manifest: ProviderManifest,
  store: ProviderExecutionPermitConsumptionStore,
  now: string
): string[] {
  if (context.permit === undefined) {
    return ["codex_cli_provider_execution_permit_required"];
  }

  return consumeProviderExecutionPermitForPlan(
    context.permit,
    plan,
    manifest,
    store,
    {
      reasonPrefix: "codex_cli_provider_execution_permit",
      consumedAt: now,
      now
    }
  );
}

function collectConsumedCodexCliProviderPermitReasons(
  plan: ExecutorExecutionPlan,
  context: ProviderExecutionContext,
  manifest: ProviderManifest,
  store: ProviderExecutionPermitConsumptionStore,
  now: string
): string[] {
  if (context.permit === undefined) {
    return [];
  }

  const validationReasons = validateProviderExecutionPermitForPlan(
    context.permit,
    plan,
    manifest,
    {
      reasonPrefix: "codex_cli_provider_execution_permit",
      now
    }
  );
  if (validationReasons.length > 0) {
    return [];
  }

  try {
    const consumedRecord = store.get(
      createProviderExecutionPermitConsumptionKey(context.permit)
    );
    return consumedRecord === undefined
      ? []
      : ["codex_cli_provider_execution_permit_already_consumed_by_store"];
  } catch {
    return ["codex_cli_provider_execution_permit_consumption_store_failed"];
  }
}

function collectRealExecutionRejectionReasons(input: {
  plan: ExecutorExecutionPlan;
  context: ProviderExecutionContext;
  manifest: ProviderManifest;
  executionMode: CodexCliProviderExecutionMode;
  realExecutionAllowed: boolean;
  timeoutMs: number | undefined;
}): string[] {
  if (input.executionMode !== "real") {
    return [];
  }

  const reasons: string[] = [];

  if (!input.realExecutionAllowed) {
    reasons.push("codex_cli_provider_real_execute_requires_explicit_allowance");
  }

  if (input.timeoutMs === undefined || input.timeoutMs <= 0) {
    reasons.push("codex_cli_provider_real_execute_requires_timeout");
  }

  const guard = readCodexCliProviderRealExecutionGuard(input.context);
  if (!guard) {
    reasons.push("codex_cli_provider_real_execute_guard_missing");
    return uniqueStrings(reasons);
  }

  const expectedManifestHash = hashProviderManifest(input.manifest);
  const selection = guard.providerRegistrySelection;
  if (guard.realExecutionAllowed !== true) {
    reasons.push("codex_cli_provider_real_execute_guard_not_allowed");
  }

  if (selection.selected !== true) {
    reasons.push("codex_cli_provider_real_execute_registry_selection_required");
  }

  if (selection.providerId !== input.plan.providerId) {
    reasons.push("codex_cli_provider_real_execute_registry_provider_mismatch");
  }

  if (selection.manifestHash !== expectedManifestHash) {
    reasons.push("codex_cli_provider_real_execute_registry_manifest_mismatch");
  }

  if (selection.kind !== undefined && selection.kind !== "executor") {
    reasons.push("codex_cli_provider_real_execute_registry_kind_mismatch");
  }

  if (selection.enabled !== undefined && selection.enabled !== true) {
    reasons.push("codex_cli_provider_real_execute_registry_provider_disabled");
  }

  const preflight = guard.environmentPreflight;
  if (preflight.status !== "ready") {
    reasons.push("codex_cli_provider_real_execute_preflight_not_ready");
  }

  if (preflight.blockingReasons.length > 0) {
    reasons.push("codex_cli_provider_real_execute_preflight_blocked");
  }

  if (preflight.checks.injectedSpawner !== true) {
    reasons.push("codex_cli_provider_real_execute_preflight_requires_injected_spawner");
  }

  if (preflight.checks.realCliAllowed !== true) {
    reasons.push("codex_cli_provider_real_execute_preflight_requires_real_cli_allowance");
  }

  if (preflight.checks.noWorkspaceWrite !== true) {
    reasons.push("codex_cli_provider_real_execute_preflight_requires_no_workspace_write");
  }

  if (preflight.checks.noPromptSent !== true || preflight.checks.noTaskEnvelope !== true) {
    reasons.push("codex_cli_provider_real_execute_preflight_must_not_send_prompt");
  }

  if (preflight.checks.noRealCliFallback !== true) {
    reasons.push("codex_cli_provider_real_execute_preflight_disallows_fallback");
  }

  return uniqueStrings(reasons);
}

function readCodexCliProviderRealExecutionGuard(
  context: ProviderExecutionContext
): CodexCliProviderRealExecutionGuard | undefined {
  const guard = context.metadata?.codexCliProviderRealExecutionGuard;

  if (!isRecord(guard)) {
    return undefined;
  }

  const selection = guard.providerRegistrySelection;
  const preflight = guard.environmentPreflight;
  if (!isRecord(selection) || !isRecord(preflight)) {
    return undefined;
  }

  const checks = preflight.checks;
  if (!isRecord(checks) || !Array.isArray(preflight.blockingReasons)) {
    return undefined;
  }

  if (
    guard.schemaVersion !== "codex-cli-provider-real-execution-guard.v1"
    || guard.realExecutionAllowed !== true
    || selection.selected !== true
    || typeof selection.providerId !== "string"
    || typeof selection.manifestHash !== "string"
    || (selection.kind !== undefined && typeof selection.kind !== "string")
    || (selection.enabled !== undefined && typeof selection.enabled !== "boolean")
    || preflight.status !== "ready" && preflight.status !== "blocked"
    || !preflight.blockingReasons.every((reason) => typeof reason === "string")
  ) {
    return undefined;
  }

  const requiredChecks = [
    "injectedSpawner",
    "realCliAllowed",
    "noTaskEnvelope",
    "noPromptSent",
    "noWorkspaceWrite",
    "noRealCliFallback"
  ];
  if (!requiredChecks.every((key) => typeof checks[key] === "boolean")) {
    return undefined;
  }

  return {
    schemaVersion: "codex-cli-provider-real-execution-guard.v1",
    realExecutionAllowed: true,
    providerRegistrySelection: {
      selected: true,
      providerId: selection.providerId,
      manifestHash: selection.manifestHash,
      ...(typeof selection.kind === "string" ? { kind: selection.kind } : {}),
      ...(typeof selection.enabled === "boolean" ? { enabled: selection.enabled } : {})
    },
    environmentPreflight: {
      status: preflight.status,
      checks: {
        injectedSpawner: checks.injectedSpawner === true,
        realCliAllowed: checks.realCliAllowed === true,
        versionProbe: checks.versionProbe === "passed" || checks.versionProbe === "failed"
          ? checks.versionProbe
          : "skipped",
        noTaskEnvelope: checks.noTaskEnvelope === true,
        noPromptSent: checks.noPromptSent === true,
        noWorkspaceWrite: checks.noWorkspaceWrite === true,
        noRealCliFallback: checks.noRealCliFallback === true
      },
      blockingReasons: [...preflight.blockingReasons]
    }
  };
}

function createCodexCliProviderDryRunSummary(
  plan: ExecutorExecutionPlan,
  metadata: CodexCliProviderPlanMetadata
): Record<string, unknown> {
  return {
    schemaVersion: "codex-cli-provider-execution-summary.v1",
    status: "dry_run",
    providerId: plan.providerId,
    planId: plan.planId,
    taskId: plan.taskId,
    ...(plan.runId !== undefined ? { runId: plan.runId } : {}),
    executionSkipped: true,
    runtime: createCodexCliProviderRuntimeSummary(metadata.codexCliPlan.runtimeBinding),
    model: metadata.codexCliPlan.model,
    sandbox: metadata.codexCliPlan.sandbox,
    approvalPolicy: metadata.codexCliPlan.approvalPolicy,
    warningCount: metadata.codexCliPlan.warnings.length
  };
}

function createCodexCliProviderFakeExecutionSummary(
  plan: ExecutorExecutionPlan,
  metadata: CodexCliProviderPlanMetadata
): Record<string, unknown> {
  return {
    schemaVersion: "codex-cli-provider-execution-summary.v1",
    status: "fake_completed",
    providerId: plan.providerId,
    planId: plan.planId,
    taskId: plan.taskId,
    ...(plan.runId !== undefined ? { runId: plan.runId } : {}),
    executionMode: "fake",
    processSpawned: false,
    promptDeliveredToProcess: false,
    inspection: {
      status: "completed",
      eventCount: 0,
      parseErrorCount: 0,
      warningCount: 0,
      blockingReasons: []
    },
    runtime: createCodexCliProviderRuntimeSummary(metadata.codexCliPlan.runtimeBinding),
    model: metadata.codexCliPlan.model,
    sandbox: metadata.codexCliPlan.sandbox,
    approvalPolicy: metadata.codexCliPlan.approvalPolicy,
    warningCount: metadata.codexCliPlan.warnings.length
  };
}

function createCodexCliProviderExecutionSummary(
  plan: ExecutorExecutionPlan,
  metadata: CodexCliProviderPlanMetadata,
  run: CodexCliProcessRunResult
): Record<string, unknown> {
  return {
    schemaVersion: "codex-cli-provider-execution-summary.v1",
    status: run.inspection.status,
    providerId: plan.providerId,
    planId: plan.planId,
    taskId: plan.taskId,
    ...(plan.runId !== undefined ? { runId: plan.runId } : {}),
    exitCode: run.output.exitCode,
    inspection: {
      status: run.inspection.status,
      eventCount: run.inspection.events.length,
      parseErrorCount: run.inspection.parseErrors.length,
      warningCount: run.inspection.warnings.length,
      blockingReasons: [...run.inspection.blockingReasons]
    },
    timedOut: run.timedOut,
    killed: run.killed,
    runtime: createCodexCliProviderRuntimeSummary(metadata.codexCliPlan.runtimeBinding),
    model: metadata.codexCliPlan.model,
    sandbox: metadata.codexCliPlan.sandbox,
    approvalPolicy: metadata.codexCliPlan.approvalPolicy
  };
}

function createCodexCliProviderRuntimeSummary(
  binding: CodexCliRuntimeBinding
): Record<string, unknown> {
  return {
    schemaVersion: "codex-cli-provider-runtime-summary.v1",
    runtimeId: binding.runtimeId,
    descriptorHash: binding.descriptorHash,
    commandHash: binding.commandHash,
    argvShapeHash: binding.argvShapeHash,
    trusted: binding.trusted,
    ...(binding.workdirHash !== undefined ? { workdirHash: binding.workdirHash } : {})
  };
}

function createCodexCliProviderSummaryArtifact(
  plan: ExecutorExecutionPlan,
  summaryKind: string,
  summary: Record<string, unknown>
): Artifact {
  const payload = JSON.stringify(summary);

  return {
    schemaVersion: "artifact.v1",
    artifactId: `${summaryKind}:${plan.planId}`,
    taskId: plan.taskId,
    ...(plan.runId !== undefined ? { runId: plan.runId } : {}),
    kind: "evidence",
    uri: `memory://codex-cli-provider/${encodeURIComponent(plan.planId)}/${summaryKind}`,
    sha256: hashKernelObject(summary),
    sizeBytes: Buffer.byteLength(payload, "utf8"),
    createdAt: plan.createdAt,
    metadata: {
      summaryKind,
      summary
    }
  };
}

function createCodexCliProviderErrorResult(
  code: string,
  reasons: string[]
): ProviderExecutionResult {
  return {
    ok: false,
    error: {
      code,
      reasons: uniqueStrings(reasons)
    }
  };
}

function validateCodexCliProviderMetadata(
  metadata: CodexCliProviderPlanMetadata
): string[] {
  const reasons: string[] = [];
  const rawMetadata = metadata as unknown as Record<string, unknown>;
  const rawCodexPlan = metadata.codexCliPlan as unknown as Record<string, unknown>;
  const rawHandoff = metadata.promptHandoff as unknown as Record<string, unknown>;

  if ("prompt" in rawMetadata || "prompt" in rawCodexPlan) {
    reasons.push("codex_cli_provider_plan_must_not_store_prompt");
  }

  if (
    "command" in rawCodexPlan
    || "args" in rawCodexPlan
    || "argv" in rawCodexPlan
    || "argsWithoutPrompt" in rawCodexPlan
  ) {
    reasons.push("codex_cli_provider_plan_must_not_store_raw_runtime");
  }

  if ("prompt" in rawHandoff || "content" in rawHandoff || "raw" in rawHandoff) {
    reasons.push("codex_cli_provider_handoff_must_not_store_raw_content");
  }

  if (metadata.codexCliPlan.promptOmitted !== true) {
    reasons.push("codex_cli_provider_prompt_omission_required");
  }

  if (
    !/^[a-f0-9]{64}$/.test(metadata.promptHandoff.inputHash)
    || !/^[a-f0-9]{64}$/.test(metadata.promptHandoff.contentHash)
    || metadata.promptHandoff.handle.trim().length === 0
  ) {
    reasons.push("codex_cli_provider_handoff_metadata_invalid");
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

  if (metadata.promptHandoff.inputHash !== plan.inputHash) {
    reasons.push("codex_cli_provider_handoff_input_hash_mismatch");
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

function validateCodexCliProviderPromptHandoff(
  plan: ExecutorExecutionPlan,
  metadata: CodexCliProviderPlanMetadata,
  handoff: CodexCliProviderPromptHandoffRecord | undefined
): string[] {
  if (handoff === undefined) {
    return ["codex_cli_provider_handoff_missing"];
  }

  const reasons: string[] = [];
  if (handoff.schemaVersion !== "codex-cli-provider-handoff-record.v1") {
    reasons.push("codex_cli_provider_handoff_schema_mismatch");
  }

  if (handoff.handle !== metadata.promptHandoff.handle) {
    reasons.push("codex_cli_provider_handoff_handle_mismatch");
  }

  if (handoff.planId !== plan.planId) {
    reasons.push("codex_cli_provider_handoff_plan_mismatch");
  }

  if (handoff.runId !== plan.runId) {
    reasons.push("codex_cli_provider_handoff_run_mismatch");
  }

  if (handoff.taskId !== plan.taskId) {
    reasons.push("codex_cli_provider_handoff_task_mismatch");
  }

  if (
    handoff.inputHash !== plan.inputHash
    || handoff.inputHash !== metadata.promptHandoff.inputHash
  ) {
    reasons.push("codex_cli_provider_handoff_input_hash_mismatch");
  }

  if (
    handoff.contentHash !== metadata.promptHandoff.contentHash
    || hashCodexCliProviderPromptContent(handoff.content) !== metadata.promptHandoff.contentHash
  ) {
    reasons.push("codex_cli_provider_handoff_content_hash_mismatch");
  }

  if (handoff.content.trim().length === 0) {
    reasons.push("codex_cli_provider_handoff_empty_content");
  }

  return uniqueStrings(reasons);
}

function peekCodexCliProviderPromptHandoff(
  store: CodexCliProviderPromptHandoffStore,
  handle: string
): CodexCliProviderPromptHandoffRecord | undefined {
  if (store.peek !== undefined) {
    return store.peek(handle);
  }

  const record = store.consume(handle);
  if (record !== undefined) {
    store.put(record);
  }

  return record;
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

function hashCodexCliProviderPromptContent(content: string): string {
  return hashKernelObject({
    codexCliProviderPromptContent: content
  });
}

function toSafeCodexCliProviderHandoffPart(value: string): string {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return safe || "unknown";
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
  if (grantedRoot === "*") {
    return true;
  }

  const normalizedGrantedRoot = normalizeRootPattern(grantedRoot);
  const normalizedRequestedRoot = normalizeRootPattern(requestedRoot);

  if (normalizedGrantedRoot === normalizedRequestedRoot) {
    return true;
  }

  if (normalizedGrantedRoot.endsWith("/**")) {
    const prefix = normalizedGrantedRoot.slice(0, -3);
    return normalizedRequestedRoot === prefix || normalizedRequestedRoot.startsWith(`${prefix}/`);
  }

  return false;
}

function normalizeRootPattern(root: string): string {
  const slashRoot = root.replace(/\\/g, "/");
  const hasRecursiveWildcard = slashRoot.endsWith("/**");
  const rootBase = hasRecursiveWildcard ? slashRoot.slice(0, -3) : slashRoot;
  const normalizedBase = trimTrailingSlash(pathPosix.normalize(rootBase));

  return hasRecursiveWildcard ? `${normalizedBase}/**` : normalizedBase;
}

function trimTrailingSlash(root: string): string {
  if (root.length > 1 && root.endsWith("/")) {
    return root.slice(0, -1);
  }

  return root;
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
