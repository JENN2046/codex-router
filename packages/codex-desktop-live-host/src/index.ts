import type { CodexMemoryAdapterOptions } from "../../codex-memory-adapter/src/index.js";
import {
  createMcpToolStyleCodexMemoryOperations,
  createCodexMemoryAdapterFromHost,
  type CodexMemoryHostAdapterBundle,
  type CodexMemoryHostClient,
  type CodexMemoryHostOperations,
  type CodexMemoryOverviewInput,
  type CodexMemorySearchInput,
  type CodexMemoryWriteInput
} from "../../codex-memory-host-client/src/index.js";
import {
  createCodexDesktopBindingSession,
  createCodexDesktopBridge,
  createToolStyleCodexDesktopRuntime,
  type CodexDesktopBindingOptions,
  type CodexDesktopBindingSession,
  type CodexDesktopDirectiveResolvers,
  type CodexDesktopRuntime,
  type CodexDesktopToolRuntimeOperations
} from "../../codex-desktop-bindings/src/index.js";
import {
  createDesktopHostClient,
  type DesktopHostClient,
  type DesktopHostClientPersistence
} from "../../desktop-host-client/src/index.js";
import type { CodexCliProcessRunOptions } from "../../codex-cli-host/src/index.js";
import type { RunDesktopTaskResult } from "../../desktop-live-adapter/src/index.js";
import type { EnvelopeSource, TaskEnvelopeInput } from "../../contracts/src/index.js";
import type { TelemetrySink } from "../../observability/src/index.js";
import type { PolicySnapshot } from "../../policy-config/src/index.js";
import type { PreflightContext } from "../../preflight/src/index.js";

const DEFAULT_CODEX_DESKTOP_AVAILABLE_TOOLS = [
  "read_thread_terminal",
  "spawn_agent",
  "wait_agent",
  "send_input",
  "close_agent",
  "shell_command",
  "apply_patch",
  "automation_update"
] as const;

const REQUIRED_CODEX_DESKTOP_LIVE_HOST_RUNTIME_METHODS = [
  "read_thread_terminal",
  "spawn_agent",
  "wait_agent",
  "send_input",
  "close_agent",
  "shell_command",
  "apply_patch",
  "automation_update"
] as const;

const REQUIRED_CODEX_DESKTOP_LIVE_HOST_MEMORY_METHODS = [
  "record_memory",
  "search_memory"
] as const;

const OPTIONAL_CODEX_DESKTOP_LIVE_HOST_MEMORY_METHODS = [
  "memory_overview"
] as const;

export interface CodexDesktopLiveHostMemoryTools {
  recordMemoryTool(input: CodexMemoryWriteInput): Promise<unknown> | unknown;
  searchMemoryTool(input: CodexMemorySearchInput): Promise<unknown> | unknown;
  memoryOverviewTool?(input?: CodexMemoryOverviewInput): Promise<unknown> | unknown;
}

export interface CodexDesktopLiveHostOptions {
  policy: PolicySnapshot;
  runtime: CodexDesktopRuntime;
  memory: {
    adapter: CodexMemoryAdapterOptions;
    operations?: CodexMemoryHostOperations;
    tools?: CodexDesktopLiveHostMemoryTools;
  };
  preflight?: Partial<Omit<PreflightContext, "requiredTools" | "requestedToolAccess">>;
  directives?: CodexDesktopDirectiveResolvers;
  binding?: Omit<CodexDesktopBindingOptions, "session"> & {
    session?: CodexDesktopBindingSession;
  };
  persistence?: Omit<
    DesktopHostClientPersistence,
    "memoryAdapter" | "memoryRecall" | "memoryOverviewProvider"
  >;
  codexCliOptions?: CodexCliProcessRunOptions;
  telemetryStore?: TelemetrySink;
  availableAgents?: number;
  stopOnFailure?: boolean;
  now?: () => string;
}

export interface CodexDesktopLiveHostFromToolsOptions
  extends Omit<CodexDesktopLiveHostOptions, "runtime"> {
  runtimeTools: CodexDesktopToolRuntimeOperations;
}

export interface CodexDesktopLiveHostObject extends CodexDesktopToolRuntimeOperations {
  record_memory(input: CodexMemoryWriteInput): Promise<unknown> | unknown;
  search_memory(input: CodexMemorySearchInput): Promise<unknown> | unknown;
  memory_overview?(input?: CodexMemoryOverviewInput): Promise<unknown> | unknown;
}

export interface CodexDesktopLiveHostFromHostObjectOptions
  extends Omit<CodexDesktopLiveHostOptions, "runtime" | "memory"> {
  host: CodexDesktopLiveHostObject;
  memory: {
    adapter: CodexMemoryAdapterOptions;
  };
}

export interface CodexDesktopLiveHostStarterOptions
  extends Omit<CodexDesktopLiveHostFromHostObjectOptions, "memory"> {
  anchor: string;
  memoryAdapter?: Omit<CodexMemoryAdapterOptions, "anchor">;
}

export interface CodexDesktopLiveHostBundle {
  hostClient: DesktopHostClient;
  bridge: ReturnType<typeof createCodexDesktopBridge>;
  session: CodexDesktopBindingSession;
  memoryClient: CodexMemoryHostClient;
  memoryAdapter: CodexMemoryHostAdapterBundle["adapter"];
  memoryOperations: CodexMemoryHostOperations;
}

export interface CodexDesktopLiveHostInspection {
  ready: boolean;
  availableRuntimeMethods: string[];
  availableMemoryMethods: string[];
  availableTools: string[];
  missingMethods: string[];
  supportsMemoryOverview: boolean;
}

export type CodexDesktopLiveHostMutableHost = Partial<CodexDesktopLiveHostObject>;

export interface CodexDesktopLiveHostEmbeddingStarterOptions
  extends Omit<CodexDesktopLiveHostStarterOptions, "host"> {
  host?: CodexDesktopLiveHostMutableHost;
}

export interface CodexDesktopLiveHostEmbeddingStarter {
  host: CodexDesktopLiveHostMutableHost;
  inspect(): CodexDesktopLiveHostInspection;
  getStatus(): CodexDesktopLiveHostEmbeddingStatus;
  assertReady(): void;
  createBundle(): CodexDesktopLiveHostBundle;
}

export interface CodexDesktopLiveHostEmbeddingStatus {
  ready: boolean;
  wiredRuntimeMethods: string[];
  wiredMemoryMethods: string[];
  pendingRequiredMethods: string[];
  pendingOptionalMethods: string[];
  nextAction: "wire_required_methods" | "create_bundle";
}

export interface CodexDesktopLiveHostSmokeTaskOptions {
  taskIdPrefix?: string;
  repoRoot?: string;
  branch?: string;
  protectedBranch?: boolean;
  source?: EnvelopeSource;
  hostLabel?: string;
  moduleName?: string;
  engineeringTargetFile?: string;
  tags?: string[];
}

export interface CodexDesktopLiveHostSmokeTasks {
  readOnly: TaskEnvelopeInput;
  engineering: TaskEnvelopeInput;
  releasePosture: TaskEnvelopeInput;
}

export type CodexDesktopLiveHostSmokeStatus = "passed" | "failed";
export type CodexDesktopLiveHostSmokeCheckName =
  | "readOnly"
  | "engineering"
  | "releasePosture";

export interface CodexDesktopLiveHostSmokeRunOptions {
  tasks?: CodexDesktopLiveHostSmokeTasks;
  taskOptions?: CodexDesktopLiveHostSmokeTaskOptions;
}

export interface CodexDesktopLiveHostSmokeCheckResult {
  passed: boolean;
  expected: string;
  decisionStatus?: string;
  executionStatus?: string;
  blockingReasons: string[];
  result?: RunDesktopTaskResult;
  error?: string;
}

export interface CodexDesktopLiveHostSmokeResult {
  ready: boolean;
  status: CodexDesktopLiveHostSmokeStatus;
  inspection: CodexDesktopLiveHostInspection;
  starterStatus: CodexDesktopLiveHostEmbeddingStatus;
  checks: Record<CodexDesktopLiveHostSmokeCheckName, CodexDesktopLiveHostSmokeCheckResult>;
}

export interface CodexDesktopLiveHostSmokeEvidenceOptions {
  generatedAt?: string;
  host?: string;
  repoRoot?: string;
  notes?: string[];
}

export interface CodexDesktopLiveHostSmokeEvidenceCheck {
  passed: boolean;
  expected: string;
  decisionStatus?: string;
  executionStatus?: string;
  blockingReasons: string[];
  error?: string;
}

export interface CodexDesktopLiveHostSmokeEvidence {
  schemaVersion: "codex-desktop-live-host-smoke-evidence.v1";
  generatedAt: string;
  ready: boolean;
  status: CodexDesktopLiveHostSmokeStatus;
  inspection: CodexDesktopLiveHostInspection;
  starterStatus: CodexDesktopLiveHostEmbeddingStatus;
  checks: Record<CodexDesktopLiveHostSmokeCheckName, CodexDesktopLiveHostSmokeEvidenceCheck>;
  summary: {
    passedChecks: CodexDesktopLiveHostSmokeCheckName[];
    failedChecks: CodexDesktopLiveHostSmokeCheckName[];
    blockingReasons: string[];
    errors: string[];
  };
  host?: string;
  repoRoot?: string;
  notes: string[];
}

export function createCodexDesktopLiveHostBundle(
  options: CodexDesktopLiveHostOptions
): CodexDesktopLiveHostBundle {
  const memoryOperations = resolveMemoryOperations(options.memory);
  const memoryBundle = createCodexMemoryAdapterFromHost(
    memoryOperations,
    options.memory.adapter
  );
  const session = options.binding?.session ?? createCodexDesktopBindingSession();
  const bridge = createCodexDesktopBridge(
    options.runtime,
    options.directives,
    {
      ...(options.binding ?? {}),
      session
    }
  );
  const hostClient = createDesktopHostClient({
    policy: options.policy,
    preflight: resolveLiveHostPreflight(options.preflight),
    bridge,
    ...(options.availableAgents !== undefined
      ? { availableAgents: options.availableAgents }
      : {}),
    ...(options.stopOnFailure !== undefined
      ? { stopOnFailure: options.stopOnFailure }
      : {}),
    ...(options.codexCliOptions !== undefined
      ? { codexCliOptions: options.codexCliOptions }
      : {}),
    persistence: {
      ...(options.persistence ?? {}),
      memoryAdapter: memoryBundle.adapter,
      ...(hasMemoryOverviewOperation(memoryOperations)
        ? { memoryOverviewProvider: memoryBundle.client }
        : {}),
      ...(options.telemetryStore !== undefined
        ? { telemetryStore: options.telemetryStore }
        : {})
    },
    ...(options.now !== undefined ? { now: options.now } : {})
  });

  return {
    hostClient,
    bridge,
    session,
    memoryClient: memoryBundle.client,
    memoryAdapter: memoryBundle.adapter,
    memoryOperations
  };
}

export function createCodexDesktopLiveHostBundleFromTools(
  options: CodexDesktopLiveHostFromToolsOptions
): CodexDesktopLiveHostBundle {
  return createCodexDesktopLiveHostBundle({
    ...options,
    runtime: createToolStyleCodexDesktopRuntime(options.runtimeTools)
  });
}

export function createCodexDesktopLiveHostBundleFromHostObject(
  options: CodexDesktopLiveHostFromHostObjectOptions
): CodexDesktopLiveHostBundle {
  assertCodexDesktopLiveHostObject(options.host);

  return createCodexDesktopLiveHostBundleFromTools({
    ...options,
    preflight: resolveLiveHostPreflightFromHost(options.host, options.preflight),
    runtimeTools: options.host,
    memory: {
      adapter: options.memory.adapter,
      operations: createCodexMemoryOperationsFromHostObject(options.host)
    }
  });
}

export function createCodexDesktopLiveHostStarter(
  options: CodexDesktopLiveHostStarterOptions
): CodexDesktopLiveHostBundle {
  assertCodexDesktopLiveHostObject(options.host);

  return createCodexDesktopLiveHostBundleFromHostObject({
    ...options,
    memory: {
      adapter: {
        anchor: options.anchor,
        ...(options.memoryAdapter ?? {})
      }
    }
  });
}

export function createCodexDesktopLiveHostEmbeddingStarter(
  options: CodexDesktopLiveHostEmbeddingStarterOptions
): CodexDesktopLiveHostEmbeddingStarter {
  const host = options.host ?? {};

  return {
    host,
    inspect() {
      return inspectCodexDesktopLiveHostObject(host);
    },
    getStatus() {
      return getCodexDesktopLiveHostEmbeddingStatus(host);
    },
    assertReady() {
      assertCodexDesktopLiveHostObject(host);
    },
    createBundle() {
      assertCodexDesktopLiveHostObject(host);
      return createCodexDesktopLiveHostStarter({
        ...options,
        host
      });
    }
  };
}

export function resolveLiveHostPreflight(
  input: Partial<Omit<PreflightContext, "requiredTools" | "requestedToolAccess">> = {}
): Omit<PreflightContext, "requiredTools" | "requestedToolAccess"> {
  return {
    authAvailable: input.authAvailable ?? true,
    availableTools: input.availableTools ?? [...DEFAULT_CODEX_DESKTOP_AVAILABLE_TOOLS],
    ...(input.workspaceClean !== undefined ? { workspaceClean: input.workspaceClean } : {}),
    ...(input.protectedBranch !== undefined ? { protectedBranch: input.protectedBranch } : {}),
    ...(input.memoryOverview !== undefined ? { memoryOverview: input.memoryOverview } : {}),
    ...(input.requireMemoryOverview !== undefined
      ? { requireMemoryOverview: input.requireMemoryOverview }
      : {}),
    ...(input.memoryOverviewPolicy !== undefined
      ? { memoryOverviewPolicy: input.memoryOverviewPolicy }
      : {}),
    ...(input.memoryOverviewPolicyPack !== undefined
      ? { memoryOverviewPolicyPack: input.memoryOverviewPolicyPack }
      : {}),
    ...(input.memoryExecutionGuidance !== undefined
      ? { memoryExecutionGuidance: input.memoryExecutionGuidance }
      : {})
  };
}

export function inspectCodexDesktopLiveHostObject(
  host: Partial<CodexDesktopLiveHostObject>
): CodexDesktopLiveHostInspection {
  const availableRuntimeMethods = REQUIRED_CODEX_DESKTOP_LIVE_HOST_RUNTIME_METHODS
    .filter((method) => typeof host[method] === "function");
  const requiredMemoryMethods = REQUIRED_CODEX_DESKTOP_LIVE_HOST_MEMORY_METHODS
    .filter((method) => typeof host[method] === "function");
  const optionalMemoryMethods = OPTIONAL_CODEX_DESKTOP_LIVE_HOST_MEMORY_METHODS
    .filter((method) => typeof host[method] === "function");
  const missingMethods = [
    ...REQUIRED_CODEX_DESKTOP_LIVE_HOST_RUNTIME_METHODS
      .filter((method) => typeof host[method] !== "function"),
    ...REQUIRED_CODEX_DESKTOP_LIVE_HOST_MEMORY_METHODS
      .filter((method) => typeof host[method] !== "function")
  ];

  return {
    ready: missingMethods.length === 0,
    availableRuntimeMethods: [...availableRuntimeMethods],
    availableMemoryMethods: [...requiredMemoryMethods, ...optionalMemoryMethods],
    availableTools: [...availableRuntimeMethods],
    missingMethods,
    supportsMemoryOverview: typeof host.memory_overview === "function"
  };
}

export function getCodexDesktopLiveHostEmbeddingStatus(
  host: Partial<CodexDesktopLiveHostObject>
): CodexDesktopLiveHostEmbeddingStatus {
  const inspection = inspectCodexDesktopLiveHostObject(host);
  const missingSet = new Set(inspection.missingMethods);
  const wiredRuntimeMethods = REQUIRED_CODEX_DESKTOP_LIVE_HOST_RUNTIME_METHODS
    .filter((method) => !missingSet.has(method));
  const wiredRequiredMemoryMethods = REQUIRED_CODEX_DESKTOP_LIVE_HOST_MEMORY_METHODS
    .filter((method) => !missingSet.has(method));
  const wiredOptionalMemoryMethods = OPTIONAL_CODEX_DESKTOP_LIVE_HOST_MEMORY_METHODS
    .filter((method) => typeof host[method] === "function");
  const pendingOptionalMethods = OPTIONAL_CODEX_DESKTOP_LIVE_HOST_MEMORY_METHODS
    .filter((method) => typeof host[method] !== "function");

  return {
    ready: inspection.ready,
    wiredRuntimeMethods,
    wiredMemoryMethods: [...wiredRequiredMemoryMethods, ...wiredOptionalMemoryMethods],
    pendingRequiredMethods: [...inspection.missingMethods],
    pendingOptionalMethods,
    nextAction: inspection.ready ? "create_bundle" : "wire_required_methods"
  };
}

export function createCodexDesktopLiveHostSmokeTasks(
  options: CodexDesktopLiveHostSmokeTaskOptions = {}
): CodexDesktopLiveHostSmokeTasks {
  const taskIdPrefix = options.taskIdPrefix ?? "codex-desktop-live-host-smoke";
  const repoRoot = options.repoRoot ?? "A:/codex-router";
  const branch = options.branch ?? "main";
  const source = options.source ?? "desktop-thread";
  const hostLabel = options.hostLabel ?? "final Codex Desktop host";
  const moduleName = options.moduleName ?? "codex-desktop-live-host";
  const engineeringTargetFile = options.engineeringTargetFile
    ?? "packages/codex-desktop-live-host/src/index.ts";
  const baseTags = options.tags ?? ["final-host-smoke"];
  const smokeTags = (check: CodexDesktopLiveHostSmokeCheckName) => [
    ...baseTags,
    check === "readOnly"
      ? "read-only"
      : check === "releasePosture"
        ? "release-posture"
        : check
  ];

  return {
    readOnly: {
      taskId: `${taskIdPrefix}-readonly`,
      source,
      intent: {
        summary: `inspect ${hostLabel} readiness`,
        requestedAction: `inspect and summarize the current ${hostLabel} readiness state`,
        successCriteria: [
          "decision reaches ready state",
          "read_thread_terminal is exercised"
        ],
        outOfScope: [
          "file edits",
          "external writes"
        ]
      },
      repoContext: {
        repoRoot,
        worktreeClean: true
      },
      target: {
        branches: [],
        files: ["README.md"],
        modules: [moduleName]
      },
      constraints: {},
      hints: {
        taskClassHint: "read_only",
        riskHints: [],
        tags: smokeTags("readOnly")
      }
    },
    engineering: {
      taskId: `${taskIdPrefix}-engineering`,
      source,
      intent: {
        summary: `validate ${hostLabel} engineering path`,
        requestedAction: "make a narrow engineering dry-run change through explicit shell and patch directives",
        successCriteria: [
          "decision reaches ready state",
          "engineering execution completes",
          "checkpoint write succeeds"
        ],
        outOfScope: [
          "release",
          "external writes",
          "production changes"
        ]
      },
      repoContext: {
        repoRoot,
        worktreeClean: true
      },
      target: {
        branches: [],
        files: [engineeringTargetFile],
        modules: [moduleName]
      },
      constraints: {
        explicitOwnership: true
      },
      hints: {
        taskClassHint: "engineering",
        riskHints: [],
        tags: smokeTags("engineering")
      }
    },
    releasePosture: {
      taskId: `${taskIdPrefix}-release-posture`,
      source,
      intent: {
        summary: `verify ${hostLabel} release posture`,
        requestedAction: "prepare release dry run for main and verify approval gating without external writes",
        successCriteria: [
          "release posture is approval gated",
          "no external write is executed"
        ],
        outOfScope: [
          "merge",
          "push",
          "deploy",
          "production mutation"
        ]
      },
      repoContext: {
        repoRoot,
        branch,
        worktreeClean: true,
        ...(options.protectedBranch !== undefined
          ? { protectedBranch: options.protectedBranch }
          : {})
      },
      target: {
        branches: ["main"],
        files: [],
        modules: [moduleName]
      },
      constraints: {},
      hints: {
        taskClassHint: "release_external_action",
        riskHints: ["release-posture-smoke"],
        tags: smokeTags("releasePosture")
      }
    }
  };
}

export async function runCodexDesktopLiveHostSmoke(
  starter: CodexDesktopLiveHostEmbeddingStarter,
  options: CodexDesktopLiveHostSmokeRunOptions = {}
): Promise<CodexDesktopLiveHostSmokeResult> {
  const inspection = starter.inspect();
  const starterStatus = starter.getStatus();
  const tasks = options.tasks ?? createCodexDesktopLiveHostSmokeTasks(options.taskOptions);

  if (!inspection.ready || starterStatus.pendingRequiredMethods.length > 0) {
    const checks = createSkippedSmokeChecks(
      "host_not_ready",
      starterStatus.pendingRequiredMethods
    );

    return {
      ready: false,
      status: "failed",
      inspection,
      starterStatus,
      checks
    };
  }

  try {
    const bundle = starter.createBundle();
    const checks = {
      readOnly: await runSmokeCheck(
        () => bundle.hostClient.run(tasks.readOnly),
        "decision ready and execution completed",
        (result) => result.decisionResult.status === "ready"
          && result.executionResult.status === "completed"
      ),
      engineering: await runSmokeCheck(
        () => bundle.hostClient.run(tasks.engineering),
        "decision ready and execution completed",
        (result) => result.decisionResult.status === "ready"
          && result.executionResult.status === "completed"
      ),
      releasePosture: await runSmokeCheck(
        () => bundle.hostClient.run(tasks.releasePosture),
        "decision blocked_approval and execution not_ready",
        (result) => result.decisionResult.status === "blocked_approval"
          && result.executionResult.status === "not_ready"
      )
    };

    return {
      ready: true,
      status: Object.values(checks).every((check) => check.passed) ? "passed" : "failed",
      inspection,
      starterStatus,
      checks
    };
  } catch (error) {
    return {
      ready: true,
      status: "failed",
      inspection,
      starterStatus,
      checks: createSkippedSmokeChecks(formatSmokeError(error), [])
    };
  }
}

export function createCodexDesktopLiveHostSmokeEvidence(
  result: CodexDesktopLiveHostSmokeResult,
  options: CodexDesktopLiveHostSmokeEvidenceOptions = {}
): CodexDesktopLiveHostSmokeEvidence {
  const checkNames: CodexDesktopLiveHostSmokeCheckName[] = [
    "readOnly",
    "engineering",
    "releasePosture"
  ];
  const checks = Object.fromEntries(
    checkNames.map((name) => {
      const check = result.checks[name];
      return [name, {
        passed: check.passed,
        expected: check.expected,
        ...(check.decisionStatus !== undefined ? { decisionStatus: check.decisionStatus } : {}),
        ...(check.executionStatus !== undefined ? { executionStatus: check.executionStatus } : {}),
        blockingReasons: [...check.blockingReasons],
        ...(check.error !== undefined ? { error: check.error } : {})
      }];
    })
  ) as Record<CodexDesktopLiveHostSmokeCheckName, CodexDesktopLiveHostSmokeEvidenceCheck>;
  const passedChecks = checkNames.filter((name) => checks[name].passed);
  const failedChecks = checkNames.filter((name) => !checks[name].passed);
  const blockingReasons = uniqueStrings(
    checkNames.flatMap((name) => checks[name].blockingReasons)
  );
  const errors = uniqueStrings(
    checkNames
      .map((name) => checks[name].error)
      .filter((error): error is string => typeof error === "string" && error.length > 0)
  );

  return {
    schemaVersion: "codex-desktop-live-host-smoke-evidence.v1",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    ready: result.ready,
    status: result.status,
    inspection: result.inspection,
    starterStatus: result.starterStatus,
    checks,
    summary: {
      passedChecks,
      failedChecks,
      blockingReasons,
      errors
    },
    ...(options.host !== undefined ? { host: options.host } : {}),
    ...(options.repoRoot !== undefined ? { repoRoot: options.repoRoot } : {}),
    notes: [...(options.notes ?? [])]
  };
}

export function resolveLiveHostPreflightFromHost(
  host: Partial<CodexDesktopLiveHostObject>,
  input: Partial<Omit<PreflightContext, "requiredTools" | "requestedToolAccess">> = {}
): Omit<PreflightContext, "requiredTools" | "requestedToolAccess"> {
  const inspection = inspectCodexDesktopLiveHostObject(host);

  return resolveLiveHostPreflight({
    ...input,
    ...(input.availableTools !== undefined
      ? {}
      : { availableTools: inspection.availableTools })
  });
}

export function getMissingCodexDesktopLiveHostMethods(
  host: Partial<CodexDesktopLiveHostObject>
): string[] {
  return inspectCodexDesktopLiveHostObject(host).missingMethods;
}

export function assertCodexDesktopLiveHostObject(
  host: Partial<CodexDesktopLiveHostObject>
): asserts host is CodexDesktopLiveHostObject {
  const missingMethods = getMissingCodexDesktopLiveHostMethods(host);
  if (missingMethods.length === 0) {
    return;
  }

  throw new Error(
    `codex_desktop_live_host_missing_methods:${missingMethods.join(",")}`
  );
}

async function runSmokeCheck(
  run: () => Promise<RunDesktopTaskResult>,
  expected: string,
  matchesExpectation: (result: RunDesktopTaskResult) => boolean
): Promise<CodexDesktopLiveHostSmokeCheckResult> {
  try {
    const result = await run();
    return {
      passed: matchesExpectation(result),
      expected,
      decisionStatus: result.decisionResult.status,
      executionStatus: result.executionResult.status,
      blockingReasons: [...new Set([
        ...result.decisionResult.blockingReasons,
        ...result.executionResult.blockingReasons
      ])],
      result
    };
  } catch (error) {
    return {
      passed: false,
      expected,
      blockingReasons: [],
      error: formatSmokeError(error)
    };
  }
}

function createSkippedSmokeChecks(
  error: string,
  blockingReasons: string[]
): Record<CodexDesktopLiveHostSmokeCheckName, CodexDesktopLiveHostSmokeCheckResult> {
  return {
    readOnly: createSkippedSmokeCheck(
      "decision ready and execution completed",
      error,
      blockingReasons
    ),
    engineering: createSkippedSmokeCheck(
      "decision ready and execution completed",
      error,
      blockingReasons
    ),
    releasePosture: createSkippedSmokeCheck(
      "decision blocked_approval and execution not_ready",
      error,
      blockingReasons
    )
  };
}

function createSkippedSmokeCheck(
  expected: string,
  error: string,
  blockingReasons: string[]
): CodexDesktopLiveHostSmokeCheckResult {
  return {
    passed: false,
    expected,
    blockingReasons: [...blockingReasons],
    error
  };
}

function formatSmokeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function resolveMemoryOperations(
  memory: CodexDesktopLiveHostOptions["memory"]
): CodexMemoryHostOperations {
  if (memory.operations) {
    return memory.operations;
  }

  if (memory.tools) {
    return createMcpToolStyleCodexMemoryOperations(memory.tools);
  }

  throw new Error("codex_desktop_live_host_requires_memory_operations_or_tools");
}

function hasMemoryOverviewOperation(
  operations: CodexMemoryHostOperations
): boolean {
  return typeof operations.memory_overview === "function";
}

function createCodexMemoryOperationsFromHostObject(
  host: CodexDesktopLiveHostObject
): CodexMemoryHostOperations {
  return {
    record_memory(request) {
      return host.record_memory(request);
    },
    search_memory(request) {
      return host.search_memory(request);
    },
    ...(host.memory_overview
      ? {
          memory_overview(request?: CodexMemoryOverviewInput) {
            return host.memory_overview?.(request);
          }
        }
      : {})
  };
}

export type {
  CodexDesktopBindingOptions,
  CodexDesktopBindingSession,
  CodexDesktopDirectiveResolvers,
  CodexDesktopRuntime,
  CodexDesktopToolRuntimeOperations,
  CodexMemoryHostOperations
};
