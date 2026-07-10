import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import packageJson from "../package.json" with { type: "json" };
import tsconfigJson from "../tsconfig.json" with { type: "json" };
import publicApiHostSurfaceLockFixture from "./fixtures/public-api-host-surface-lock.fixture.json" with { type: "json" };
import publicApiProtocolSurfaceLockFixture from "./fixtures/public-api-protocol-surface-lock.fixture.json" with { type: "json" };
import publicApiProviderSurfaceLockFixture from "./fixtures/public-api-provider-surface-lock.fixture.json" with { type: "json" };
import publicApiSdkSurfaceLockFixture from "./fixtures/public-api-sdk-surface-lock.fixture.json" with { type: "json" };
import publicApiSurfaceLockFixture from "./fixtures/public-api-surface-lock.fixture.json" with { type: "json" };
import publicApiSupportSpiSurfaceLockFixture from "./fixtures/public-api-support-spi-surface-lock.fixture.json" with { type: "json" };
import {
  createCodexDesktopLiveHostBundle
} from "../packages/public-api/src/index.js";
import type {
  A2AAgentCardSkeleton,
  AgentOsSdkOptions,
  ArtifactStore,
  CodexMemoryAdapterOptions,
  CodexDesktopBindingOptions,
  CodexDesktopBindingSession,
  CodexDesktopDirectiveResolvers,
  CodexDesktopLiveHostBundle,
  CodexDesktopLiveHostOptions,
  CodexDesktopRuntime,
  CodexDesktopToolRuntimeOperations,
  CodexMemoryHostOperations,
  CodexMemoryOverviewInput,
  CodexMemorySearchInput,
  CodexMemoryWriteInput,
  DesktopHostClient,
  DesktopHostBindings,
  DesktopHostClientPersistence,
  DesktopHostClientOptions,
  DesktopHostCheckpointLookup,
  DesktopHostCheckpointRecallAdapter,
  DesktopHostCheckpointRef,
  DesktopHostCheckpointStore,
  DesktopHostControlledWorkspaceWriteProviderDispatchInput,
  DesktopHostControlledWorkspaceWriteProviderDispatchResult,
  DesktopHostWorkspaceWriteOperation,
  DesktopHostAgentStrategyPlan,
  DesktopHostExecutionPlan,
  DesktopHostMemoryAdapter,
  DesktopHostOperation,
  DesktopHostPolicySnapshot,
  DesktopHostResumeOptions,
  DesktopHostPreflightContext,
  DesktopHostRoutingDecision,
  DesktopHostTaskEnvelopeInput,
  DesktopHostTelemetrySink,
  DesktopPrimitiveInvocation,
  ExecutorProvider,
  KernelStore,
  LogEvent,
  McpServerRef,
  ProviderManifest,
  RegisteredToolManifest,
  Run,
  Task,
  TelemetrySink,
  ToolRegistry
} from "../packages/public-api/src/index.js";

type ResolveLiveHostPreflightInput =
  Parameters<typeof import("../packages/public-api/src/index.js").resolveLiveHostPreflight>[0];
type ResolveLiveHostPreflightFromHostInput =
  Parameters<typeof import("../packages/public-api/src/index.js").resolveLiveHostPreflightFromHost>[1];

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const publicHostMemoryHealthPack = {
  health: {
    overviewUnavailableSeverity: "warn",
    codexMcpUnavailableSeverity: "warn",
    maxRejectedWrites: 1,
    rejectedWritesSeverity: "warn",
    maxShadowReconcileCount: 1,
    shadowReconcileSeverity: "warn",
    recallUnavailableSeverity: "warn",
    nonActiveRecallSeverity: "warn"
  },
  guidance: {
    memoryRequired: false,
    resumeExpected: false,
    telemetryMandatory: false,
    checkpointFrequency: "standard"
  }
} as const;

const publicHostTelemetryThresholds = {
  warn: {
    totals: {
      failures: 1
    }
  },
  error: {
    totals: {
      failures: 3
    }
  }
} as const;

const publicHostDeliveryWindowPolicy = {
  dedupeWindowMs: 0,
  cooldownWindowMs: 0
} as const;

const publicHostPolicy: DesktopHostPolicySnapshot = {
  policyVersion: "public-api-test-policy",
  rolloutMode: "desktop-first",
  models: {
    read_only: "gpt-5.4-mini",
    small_edit: "gpt-5.3-codex",
    engineering: "gpt-5.3-codex",
    high_risk: "gpt-5.4",
    release_external_action: "gpt-5.4"
  },
  toolPolicies: {
    read_only: "read_only",
    small_edit: "local_write",
    engineering: "engineering_write",
    high_risk: "protected_remote",
    release_external_action: "protected_remote"
  },
  executionProfiles: {
    read_only: "recon-only",
    small_edit: "engineering",
    engineering: "engineering",
    high_risk: "high-risk-change",
    release_external_action: "release-governance"
  },
  hostRoutes: {
    read_only: "desktop",
    small_edit: "desktop",
    engineering: "desktop",
    high_risk: "desktop",
    release_external_action: "desktop"
  },
  approvalRules: {
    protectedBranches: ["main"],
    protectedKeywords: ["deploy"],
    protectedToolAccess: ["protected_remote"]
  },
  escalationRules: {
    failureThreshold: 2,
    contextPressureThreshold: 0.8,
    highRiskSticky: true
  },
  memoryHealth: {
    defaultPack: "engineering",
    packByToolAccess: {
      read_only: "read_only",
      local_write: "local_write",
      engineering_write: "engineering",
      protected_remote: "release"
    },
    packs: {
      read_only: publicHostMemoryHealthPack,
      local_write: publicHostMemoryHealthPack,
      engineering: publicHostMemoryHealthPack,
      release: publicHostMemoryHealthPack
    }
  },
  telemetryAlerts: {
    defaultPreset: "engineering",
    presetByToolAccess: {
      read_only: "read_only",
      local_write: "local_write",
      engineering_write: "engineering",
      protected_remote: "release"
    },
    presets: {
      read_only: publicHostTelemetryThresholds,
      local_write: publicHostTelemetryThresholds,
      engineering: publicHostTelemetryThresholds,
      release: publicHostTelemetryThresholds
    }
  },
  telemetryAlertDeliveryAlerts: {
    defaultPreset: "engineering",
    presetByToolAccess: {
      read_only: "read_only",
      local_write: "local_write",
      engineering_write: "engineering",
      protected_remote: "release"
    },
    presets: {
      read_only: publicHostTelemetryThresholds,
      local_write: publicHostTelemetryThresholds,
      engineering: publicHostTelemetryThresholds,
      release: publicHostTelemetryThresholds
    }
  },
  telemetryAlertDeliveryWindow: {
    defaultPreset: "engineering",
    presetByToolAccess: {
      read_only: "read_only",
      local_write: "local_write",
      engineering_write: "engineering",
      protected_remote: "release"
    },
    presets: {
      read_only: publicHostDeliveryWindowPolicy,
      local_write: publicHostDeliveryWindowPolicy,
      engineering: publicHostDeliveryWindowPolicy,
      release: publicHostDeliveryWindowPolicy
    }
  }
};

test("public-api facade export surface is lock-stable", async () => {
  const moduleExports = await import("../packages/public-api/src/index.js");
  const actualExports = Object.keys(moduleExports)
    .filter((name) => !name.startsWith("__") && name !== "default")
    .sort();

  assert.deepEqual(actualExports, publicApiSurfaceLockFixture);
});

test("public-api subfacade export surfaces are lock-stable", async () => {
  for (const facade of [
    {
      entrypoint: "../packages/public-api/src/sdk.js",
      fixture: publicApiSdkSurfaceLockFixture
    },
    {
      entrypoint: "../packages/public-api/src/host.js",
      fixture: publicApiHostSurfaceLockFixture
    },
    {
      entrypoint: "../packages/public-api/src/protocol.js",
      fixture: publicApiProtocolSurfaceLockFixture
    },
    {
      entrypoint: "../packages/public-api/src/provider.js",
      fixture: publicApiProviderSurfaceLockFixture
    }
  ]) {
    const moduleExports = await import(facade.entrypoint);
    const actualExports = Object.keys(moduleExports)
      .filter((name) => !name.startsWith("__") && name !== "default")
      .sort();

    assert.deepEqual(actualExports, facade.fixture, `${facade.entrypoint} export surface drifted`);
  }
});

test("public-api support SPI facade export surface is lock-stable", async () => {
  const moduleExports = await import("../packages/public-api/src/support.js");
  const actualExports = Object.keys(moduleExports)
    .filter((name) => !name.startsWith("__") && name !== "default")
    .sort();

  assert.deepEqual(actualExports, publicApiSupportSpiSurfaceLockFixture);
});

test("public protocol facade exposes kernel contracts without legacy compatibility contracts", async () => {
  const moduleExports = await import("../packages/public-api/src/protocol.js");

  for (const name of [
    "TaskSchema",
    "RunSchema",
    "PolicyDecisionSchema",
    "ApprovalPermitSchema",
    "ToolInvocationSchema",
    "hashKernelObject",
    "parseTask",
    "parsePolicyDecision"
  ]) {
    assert.equal(name in moduleExports, true, `${name} should be public through kernel contracts`);
  }

  for (const legacyName of [
    "TaskEnvelopeSchema",
    "RoutingDecisionSchema",
    "DesktopExecutionPlanSchema",
    "DesktopPrimitiveSchema",
    "parseTaskEnvelope",
    "parseRoutingDecision"
  ]) {
    assert.equal(
      legacyName in moduleExports,
      false,
      `${legacyName} must remain on the legacy compatibility contract surface`
    );
  }
});

test("root package exports only approved public API facades", () => {
  const expectedExports = {
    ".": {
      types: "./dist/packages/public-api/src/index.d.ts",
      import: "./dist/packages/public-api/src/index.js"
    },
    "./sdk": {
      types: "./dist/packages/public-api/src/sdk.d.ts",
      import: "./dist/packages/public-api/src/sdk.js"
    },
    "./host": {
      types: "./dist/packages/public-api/src/host.d.ts",
      import: "./dist/packages/public-api/src/host.js"
    },
    "./protocol": {
      types: "./dist/packages/public-api/src/protocol.d.ts",
      import: "./dist/packages/public-api/src/protocol.js"
    },
    "./provider": {
      types: "./dist/packages/public-api/src/provider.d.ts",
      import: "./dist/packages/public-api/src/provider.js"
    },
    "./support": {
      types: "./dist/packages/public-api/src/support.d.ts",
      import: "./dist/packages/public-api/src/support.js"
    }
  };

  assert.equal(packageJson.main, expectedExports["."].import);
  assert.equal(packageJson.types, expectedExports["."].types);
  assert.deepEqual(packageJson.exports, expectedExports);

  for (const entry of Object.values(expectedExports)) {
    const sourceImportTarget = entry.import
      .replace(/^\.\/dist\//, "./")
      .replace(/\.js$/, ".ts");
    const sourceTypesTarget = entry.types
      .replace(/^\.\/dist\//, "./")
      .replace(/\.d\.ts$/, ".ts");

    assert.equal(
      existsSync(resolve(repoRoot, sourceImportTarget)),
      true,
      `${entry.import} must have a source facade`
    );
    assert.equal(
      sourceImportTarget,
      sourceTypesTarget,
      `${entry.import} and ${entry.types} must map to the same source facade`
    );
  }

  for (const blockedSubpath of [
    "./packages/public-api/src/index.js",
    "./packages/*",
    "./contracts",
    "./kernel-contracts",
    "./protocol-mcp",
    "./protocol-a2a",
    "./observability",
    "./artifact-store",
    "./kernel-store",
    "./tool-registry",
    "./governance-internal-recovery-control",
    "./governance-internal-workspace-write-guard",
    "./governance-internal-provider-execution-runner",
    "./recovery-control",
    "./workspace-write-guard",
    "./provider-execution-runner",
    "./state-manager",
    "./strategy-router",
    "./entropy-risk",
    "./execution-observation",
    "./testing",
    "./diagnostics"
  ]) {
    assert.equal(
      blockedSubpath in packageJson.exports,
      false,
      `${blockedSubpath} must not be a root package export`
    );
  }
});

test("public-api package type targets are emitted and stay governance-internal free", () => {
  assert.equal(
    tsconfigJson.compilerOptions.declaration,
    true,
    "build must emit declaration files for package.json type targets"
  );

  const declarationOutDir = mkdtempSync(resolve(tmpdir(), "codex-router-public-api-types-"));
  try {
    execFileSync(
      process.execPath,
      [
        resolve(repoRoot, "node_modules/typescript/bin/tsc"),
        "-p",
        "tsconfig.json",
        "--emitDeclarationOnly",
        "--outDir",
        declarationOutDir
      ],
      {
        cwd: repoRoot,
        stdio: "pipe"
      }
    );

    const exportEntries = Object.values(
      packageJson.exports as Record<string, { types: string; import: string }>
    );
    const publicTypeTargets = exportEntries.map((entry) =>
      resolve(declarationOutDir, entry.types.replace(/^\.\/dist\//, ""))
    );

    for (const typeTarget of publicTypeTargets) {
      assert.equal(existsSync(typeTarget), true, `${typeTarget} must be emitted`);
    }

    for (const typeTarget of publicTypeTargets) {
      const declaration = readFileSync(typeTarget, "utf8");
      for (const forbiddenPattern of [
        "governance-internal",
        "../../contracts/src/index.js",
        "../../desktop-host-client/src/index.js",
        "../../codex-desktop-live-host/src/index.js"
      ]) {
        assert.equal(
          declaration.includes(forbiddenPattern),
          false,
          `${typeTarget} must not expose ${forbiddenPattern}`
        );
      }
    }

    const protocolTypeTarget = resolve(
      declarationOutDir,
      "packages/public-api/src/protocol.d.ts"
    );
    const protocolDeclaration = readFileSync(protocolTypeTarget, "utf8");
    assert.equal(
      protocolDeclaration.includes("../../kernel-contracts/src/index.js"),
      true,
      "protocol facade declarations must preserve the canonical kernel contract source"
    );
  } finally {
    rmSync(declarationOutDir, { recursive: true, force: true });
  }
});

test("public-api facade exposes product and extension entrypoints", async () => {
  const moduleExports = await import("../packages/public-api/src/index.js");

  for (const name of [
    "AgentOsSdk",
    "createAgentOsSdk",
    "AgentOsCliCommandSchema",
    "runAgentOsCliCommand",
    "handleAgentOsAppServerRequest",
    "DesktopHostClient",
    "createDesktopHostClient",
    "createCodexDesktopLiveHostEmbeddingStarter",
    "TaskSchema",
    "RunSchema",
    "ProviderManifestSchema",
    "ProviderRegistry",
    "createProviderRegistry",
    "McpServerRefSchema",
    "A2AAgentCardSkeletonSchema",
    "createRecordingTelemetrySink",
    "createFanoutTelemetrySink",
    "InMemoryArtifactStore",
    "FileSystemArtifactStore",
    "InMemoryKernelStore",
    "FileSystemKernelStore",
    "RegisteredToolManifestSchema",
    "ToolProviderSchema",
    "InMemoryToolRegistry"
  ]) {
    assert.equal(name in moduleExports, true, `${name} should be public`);
  }
});

test("public-api host facade delegates through declaration-safe wrappers", async () => {
  const {
    DesktopHostClient,
    assertCodexDesktopLiveHostObject,
    createCodexDesktopLiveHostEmbeddingStarter,
    createDesktopHostClient,
    inspectCodexDesktopLiveHostObject,
    resolveLiveHostPreflight,
    resolveLiveHostPreflightFromHost
  } = await import("../packages/public-api/src/host.js");

  const resolvedPreflight = resolveLiveHostPreflight();
  const controlledWorkspaceWriteDispatchInputs: unknown[] = [];
  const client = createDesktopHostClient({
    policy: publicHostPolicy,
    preflight: resolvedPreflight,
    bridge: {
      invokePrimitive: () => ({ ok: true })
    },
    controlledWorkspaceWriteProviderDispatcher(input) {
      controlledWorkspaceWriteDispatchInputs.push(input);
      return {
        schemaVersion: "controlled-workspace-write-provider-dispatch-result.v1",
        status: "dispatch_blocked",
        runnerInvoked: false,
        executeInvoked: false,
        providerExecuteInvoked: false,
        reasons: ["public_host_controlled_workspace_write_dispatch_test"]
      };
    }
  });

  assert.equal(client instanceof DesktopHostClient, true);
  const controlledWorkspaceWriteInput: DesktopHostControlledWorkspaceWriteProviderDispatchInput = {
    providerExecutionPlan: {
      schemaVersion: "provider-execution-plan.v1"
    },
    task: {
      taskId: "task-public-host-workspace-write"
    },
    run: {
      runId: "run-public-host-workspace-write"
    },
    principal: {
      principalId: "principal-public-host-workspace-write"
    },
    policyDecision: {
      decisionId: "decision-public-host-workspace-write"
    },
    providerRegistry: {},
    kernelStore: {},
    artifactStore: {},
    workspaceRoot: "/tmp/public-host-workspace-write",
    permit: {
      schemaVersion: "provider-workspace-write-execution-permit.v2"
    },
    executorPlan: {
      schemaVersion: "executor-execution-plan.v1"
    },
    operations: [{
      kind: "write",
      path: "docs/public-host-workspace-write.txt",
      content: "public host controlled workspace-write\n"
    }],
    executionAuthorizationId: "auth-public-host-workspace-write",
    consumptionStore: {},
    dispatchPreflight: {
      schemaVersion: "controlled-workspace-write-provider-dispatch-preflight.v1",
      mode: "controlled-workspace-write",
      providerExecutionPlanHash: "a".repeat(64),
      providerRegistrySelectionRequired: true,
      permitRequired: true,
      operationManifestRequired: true,
      preflightArtifactBindingRequired: true,
      providerExecuteForbidden: true,
      realCodexCliForbidden: true,
      environmentPreflight: {
        status: "ready",
        artifactRef: "artifact-public-host-workspace-write",
        artifactHash: "b".repeat(64),
        checks: {
          cleanWorktreeConfirmed: true,
          targetAllowlistConfirmed: true,
          rollbackRequired: true,
          noProviderExecute: true,
          noRealCodexCli: true,
          noExternalWrite: true,
          versionProbe: "public-host-test"
        },
        blockingReasons: []
      }
    },
    governanceState: {},
    taskEnvelope: {
      taskId: "task-public-host-workspace-write",
      intent: {
        summary: "Verify public host workspace-write dispatch type",
        requestedAction: "Dispatch controlled workspace-write through the public host facade"
      }
    },
    now: () => "2026-07-10T00:00:00.000Z"
  };
  const controlledWorkspaceWriteResult =
    await client.dispatchControlledWorkspaceWriteProviderPlan(
      controlledWorkspaceWriteInput
    ) as DesktopHostControlledWorkspaceWriteProviderDispatchResult;
  assert.equal(controlledWorkspaceWriteDispatchInputs.length, 1);
  assert.equal(
    controlledWorkspaceWriteDispatchInputs[0],
    controlledWorkspaceWriteInput
  );
  assert.equal(controlledWorkspaceWriteResult.status, "dispatch_blocked");
  assert.equal(controlledWorkspaceWriteResult.runnerInvoked, false);
  assert.equal(controlledWorkspaceWriteResult.executeInvoked, false);
  assert.equal(controlledWorkspaceWriteResult.providerExecuteInvoked, false);
  assert.deepEqual(controlledWorkspaceWriteResult.reasons, [
    "public_host_controlled_workspace_write_dispatch_test"
  ]);

  const inspection = inspectCodexDesktopLiveHostObject({});
  assert.equal(inspection.ready, false);
  assert.throws(() => assertCodexDesktopLiveHostObject({}), /codex_desktop_live_host_missing/);

  const starter = createCodexDesktopLiveHostEmbeddingStarter({
    anchor: "public-api-host-wrapper",
    policy: publicHostPolicy
  });
  assert.equal(starter.getStatus().ready, false);

  const hostResolvedPreflight = resolveLiveHostPreflightFromHost({
    read_thread_terminal: () => "terminal snapshot",
    spawn_agent: () => ({ ok: true })
  });
  const hostPreflightClient = createDesktopHostClient({
    policy: publicHostPolicy,
    preflight: hostResolvedPreflight,
    bridge: {
      invokePrimitive: () => ({ ok: true })
    }
  });
  assert.equal(hostPreflightClient instanceof DesktopHostClient, true);
  assert.equal(resolvedPreflight.authAvailable, true);
  assert.equal(Array.isArray(hostResolvedPreflight.availableTools), true);
});

test("public-api host facade preserves concrete runtime handler contracts", async () => {
  const preflight: DesktopHostPreflightContext = {
    authAvailable: true,
    availableTools: []
  };

  const taskEnvelope: DesktopHostTaskEnvelopeInput = {
    taskId: "task-public-host-envelope",
    intent: {
      summary: "Verify public host task envelope type",
      requestedAction: "Run a declaration-safe desktop host task"
    }
  };

  const operation: DesktopHostOperation = {
    primitive: "shell_command",
    reason: "verify public host facade metadata"
  };

  const executionPlan: DesktopHostExecutionPlan = {
    executionProfile: "engineering",
    primitives: [operation],
    notes: ["public facade type contract"]
  };

  const routingDecision: DesktopHostRoutingDecision = {
    schemaVersion: "routing-decision.v1",
    decisionId: "decision-public-host-contract",
    taskId: taskEnvelope.taskId,
    policyVersion: "public-api-test",
    classification: {
      taskClass: "engineering",
      riskLevel: "medium",
      ambiguityScore: 0,
      clarificationRequired: false,
      riskFactors: []
    },
    execution: {
      selectedModel: "gpt-5.3-codex",
      toolAccess: "engineering_write",
      executionProfile: "engineering",
      reasoningEffort: "medium"
    },
    approval: {
      required: false,
      reasons: []
    },
    parallelism: {
      allowed: true,
      maxAgents: 1,
      mode: "owned_write"
    },
    hostRoute: "desktop"
  };

  const agentStrategy: DesktopHostAgentStrategyPlan = {
    parallel: true,
    maxAgents: 1,
    assignments: [{
      role: "worker",
      mode: "write",
      ownership: ["packages/public-api/src/host.ts"]
    }],
    reasons: ["public facade type contract"]
  };

  const invocation: DesktopPrimitiveInvocation = {
    task: taskEnvelope,
    decision: routingDecision,
    executionPlan,
    agentStrategy,
    operation,
    stepIndex: 0,
    primitive: "shell_command",
    taskId: "task-public-host-contract",
    reason: "verify public host facade metadata"
  };

  const runtimeTools: CodexDesktopToolRuntimeOperations = {
    read_thread_terminal() {
      return "terminal snapshot";
    },
    spawn_agent(input: { message: string }) {
      return { message: input.message };
    },
    wait_agent(input: { targets: string[] }) {
      return { targets: input.targets };
    },
    send_input(input: { target: string; message: string }) {
      return { target: input.target, message: input.message };
    },
    close_agent(input: { target: string }) {
      return { target: input.target };
    },
    shell_command(input: { command: string }) {
      return { command: input.command };
    },
    apply_patch(patch: string) {
      return patch;
    },
    automation_update(input: { status?: string }) {
      return input.status ?? "updated";
    }
  };

  const bridgeBindings: DesktopHostBindings = {
    spawn_agent: () => ({ ok: true }),
    read_thread_terminal: () => "terminal snapshot"
  };

  const desktopRuntime: CodexDesktopRuntime = {
    readThreadTerminal() {
      return "terminal snapshot";
    },
    spawnAgent(input: { message: string }) {
      return { message: input.message };
    },
    sendInput(input: { target: string; message: string }) {
      return { target: input.target, message: input.message };
    },
    waitAgent(input: { targets: string[] }) {
      return { targets: input.targets };
    },
    closeAgent(input: { target: string }) {
      return { target: input.target };
    },
    automationUpdate(input: { status?: string }) {
      return input.status ?? "updated";
    },
    shellCommand(input: { command?: string; structuredCommand?: { executable: string } }) {
      return input.command ?? input.structuredCommand?.executable ?? "shell";
    },
    applyPatch(patch: string) {
      return patch;
    }
  };

  const memoryOperations: CodexMemoryHostOperations = {
    record_memory(input: CodexMemoryWriteInput) {
      return {
        success: input.validated,
        memoryId: input.title
      };
    },
    search_memory(input: CodexMemorySearchInput) {
      return {
        results: [{
          title: input.query
        }]
      };
    },
    memory_overview(input: CodexMemoryOverviewInput = {}) {
      return {
        limit: input.limit ?? 0
      };
    }
  };

  const memoryAdapterOptions: CodexMemoryAdapterOptions = {
    anchor: "public-api-host-memory"
  };

  const bindingSessionRecords = new Map<string, ReturnType<CodexDesktopBindingSession["read"]>>();
  const bindingSession: CodexDesktopBindingSession = {
    read(taskId: string) {
      return bindingSessionRecords.get(taskId) ?? { activeAgents: [] };
    },
    write(taskId: string, session) {
      bindingSessionRecords.set(taskId, {
        activeAgents: [...session.activeAgents]
      });
    },
    clear(taskId: string) {
      bindingSessionRecords.delete(taskId);
    }
  };

  const directives: CodexDesktopDirectiveResolvers = {
    spawnAgent(invocation) {
      return {
        requests: [{
          message: `${invocation.task.intent.summary}:${invocation.agentStrategy.assignments[0]?.role}`,
          agentType: "default",
          forkContext: true,
          reasoningEffort: invocation.decision.execution.reasoningEffort
        }]
      };
    },
    waitAgent(_invocation, session) {
      return {
        targets: session.activeAgents.map((agent) => agent.agentId)
      };
    },
    shellCommand(invocation) {
      return {
        command: "pwd",
        justification: `${invocation.executionPlan.primitives[0]?.primitive}:${invocation.stepIndex}`
      };
    },
    applyPatch(invocation) {
      return invocation.operation.primitive === "apply_patch"
        ? "*** Begin Patch\n*** End Patch\n"
        : undefined;
    }
  };

  const binding: CodexDesktopBindingOptions = {
    session: bindingSession,
    sendInputWithoutAgentMode: "noop",
    shellPolicy: {
      governedMode: true,
      allowRawCommand: true,
      allowedExecutables: ["git"]
    }
  };

  const liveHostOptions: CodexDesktopLiveHostOptions = {
    policy: publicHostPolicy,
    runtime: desktopRuntime,
    memory: {
      adapter: memoryAdapterOptions,
      operations: memoryOperations
    },
    preflight: {
      authAvailable: true,
      availableTools: ["spawn_agent"],
      workspaceClean: true
    },
    directives,
    binding
  };

  const checkpoint: DesktopHostCheckpointRef = {
    checkpointId: "checkpoint-public-host",
    taskId: taskEnvelope.taskId,
    stage: "public-api",
    createdAt: "2026-07-06T00:00:00.000Z",
    summary: "Public host checkpoint contract"
  };

  const checkpointStore: DesktopHostCheckpointStore & DesktopHostCheckpointLookup = {
    record(input: DesktopHostCheckpointRef) {
      return Promise.resolve(void input);
    },
    findLatestForTask(taskId: string) {
      return taskId === checkpoint.taskId ? checkpoint : undefined;
    }
  };

  const checkpointMemoryAdapter: DesktopHostMemoryAdapter & DesktopHostCheckpointRecallAdapter = {
    recordCheckpoint(input: DesktopHostCheckpointRef) {
      return Promise.resolve(void input);
    },
    recallLatestCheckpointRef(input) {
      return input.taskId === checkpoint.taskId ? checkpoint : undefined;
    }
  };

  const telemetryStore: DesktopHostTelemetrySink = {
    record(event) {
      void event.message;
    }
  };

  const persistence: DesktopHostClientPersistence = {
    checkpointStore,
    auditStore: {
      record(event) {
        return Promise.resolve(void event.taskId);
      }
    },
    memoryAdapter: checkpointMemoryAdapter,
    memoryRecall: checkpointMemoryAdapter,
    memoryOverviewProvider: {
      memoryOverview(input = {}) {
        return {
          limit: input.limit ?? 0
        };
      }
    },
    telemetryStore
  };

  const resumeOptions: DesktopHostResumeOptions = {
    memoryRecall: checkpointMemoryAdapter,
    checkpointStore,
    preferredSource: "memory"
  };

  const assertDesktopHostTaskRunnerContract = (
    client: Pick<DesktopHostClient, "run" | "resume">,
    task: DesktopHostTaskEnvelopeInput
  ) => {
    void client.run(task);
    void client.resume(task, resumeOptions);
  };

  const assertLiveHostBundleContract = async (bundle: CodexDesktopLiveHostBundle) => {
    await bundle.bridge.invokePrimitive(invocation);
    void bundle.session.read(taskEnvelope.taskId);
    void bundle.memoryClient.recordMemory;
    void bundle.memoryClient.searchMemory;
    void bundle.memoryClient.memoryOverview;
    void bundle.memoryAdapter.recordCheckpoint;
    void bundle.memoryAdapter.recallLatestCheckpointRef;
  };

 const assertPublicHostNegativeContracts = () => {
    const client = null as unknown as DesktopHostClient;
    const emptyPolicy = {};
    // @ts-expect-error public DesktopHostClient.run requires a task envelope input.
    void client.run({});
    const malformedHostPolicy: DesktopHostClientOptions = {
      // @ts-expect-error public desktop host options require a structural policy snapshot.
      policy: emptyPolicy,
      preflight,
      bridge: {
        invokePrimitive: () => ({ ok: true })
      }
    };
    const malformedLiveHostPolicy: CodexDesktopLiveHostOptions = {
      // @ts-expect-error public live-host options require a structural policy snapshot.
      policy: emptyPolicy,
      runtime: desktopRuntime,
      memory: {
        adapter: memoryAdapterOptions,
        operations: memoryOperations
      }
    };
    // @ts-expect-error public memory adapter options require an anchor.
    const missingAnchor: CodexMemoryAdapterOptions = {};
    // @ts-expect-error public checkpoint stores require a record method.
    const missingCheckpointStore: DesktopHostClientPersistence = { checkpointStore: {} };
    // @ts-expect-error public resume memory recall requires lookup method.
    const missingMemoryRecall: DesktopHostResumeOptions = { memoryRecall: {} };
    // @ts-expect-error live-host preflight availableTools must be a string array.
    const malformedLiveHostPreflight: CodexDesktopLiveHostOptions["preflight"] = { availableTools: {} };
    // @ts-expect-error live-host directive resolvers must be functions.
    const malformedDirectiveResolvers: CodexDesktopDirectiveResolvers = { spawnAgent: "bad" };
    // @ts-expect-error live-host binding session requires read/write/clear methods.
    const malformedBindingOptions: CodexDesktopBindingOptions = { session: {} };
    // @ts-expect-error bridge bindings use snake-case desktop primitive keys.
    const malformedBridgeBindings: DesktopHostBindings = { spawnAgent: () => ({ ok: true }) };
    // @ts-expect-error write operations require explicit content.
    const malformedWorkspaceWriteOperation: DesktopHostWorkspaceWriteOperation = {
      kind: "write",
      path: "docs/missing-content.txt"
    };
    // @ts-expect-error preflight helper input availableTools must be a string array.
    const malformedPreflightHelperInput: ResolveLiveHostPreflightInput = { availableTools: {} };
    // @ts-expect-error from-host preflight helper input availableTools must be a string array.
    const malformedFromHostPreflightInput: ResolveLiveHostPreflightFromHostInput = { availableTools: {} };
    void malformedHostPolicy;
    void malformedLiveHostPolicy;
    void missingAnchor;
    void missingCheckpointStore;
    void missingMemoryRecall;
    void malformedLiveHostPreflight;
    void malformedDirectiveResolvers;
    void malformedBindingOptions;
    void malformedBridgeBindings;
    void malformedWorkspaceWriteOperation;
    void malformedPreflightHelperInput;
    void malformedFromHostPreflightInput;
  };

  assert.equal(preflight.authAvailable, true);
  assert.equal(typeof bridgeBindings.spawn_agent, "function");
  assert.equal(liveHostOptions.memory.adapter.anchor, "public-api-host-memory");
  assert.equal(liveHostOptions.preflight?.availableTools?.includes("spawn_agent"), true);
  assert.equal(
    liveHostOptions.directives?.spawnAgent?.(invocation)?.requests[0]?.message,
    "Verify public host task envelope type:worker"
  );
  assert.equal(liveHostOptions.directives?.shellCommand?.(invocation)?.justification, "shell_command:0");
  assert.deepEqual(liveHostOptions.binding?.session?.read(taskEnvelope.taskId), { activeAgents: [] });
  assert.equal(liveHostOptions.memory.operations?.search_memory, memoryOperations.search_memory);
  assert.equal(taskEnvelope.taskId, "task-public-host-envelope");
  assert.equal(persistence.checkpointStore?.findLatestForTask?.(taskEnvelope.taskId), checkpoint);
  assert.equal(resumeOptions.memoryRecall?.recallLatestCheckpointRef({
    taskId: taskEnvelope.taskId
  }), checkpoint);
  assert.equal(typeof assertDesktopHostTaskRunnerContract, "function");
  assert.equal(typeof assertLiveHostBundleContract, "function");
  assert.equal(typeof assertPublicHostNegativeContracts, "function");
  assert.equal(invocation.primitive, "shell_command");
  assert.equal(invocation.taskId, "task-public-host-contract");
  assert.equal(invocation.task.intent.requestedAction, "Run a declaration-safe desktop host task");
  assert.equal(invocation.decision.execution.reasoningEffort, "medium");
  assert.equal(invocation.executionPlan.primitives[0]?.reason, "verify public host facade metadata");
  assert.equal(invocation.agentStrategy.assignments[0]?.ownership?.[0], "packages/public-api/src/host.ts");
  assert.equal(invocation.operation.primitive, "shell_command");
  assert.equal(invocation.stepIndex, 0);
  assert.equal(
    runtimeTools.apply_patch("*** Begin Patch\n*** End Patch\n"),
    "*** Begin Patch\n*** End Patch\n"
  );
  assert.deepEqual(runtimeTools.spawn_agent({ message: "spawn" }), { message: "spawn" });
  assert.deepEqual(desktopRuntime.spawnAgent({ message: "spawn" }), { message: "spawn" });
  assert.deepEqual(memoryOperations.search_memory({ query: "checkpoint" }), {
    results: [{ title: "checkpoint" }]
  });

  const bundle = createCodexDesktopLiveHostBundle(liveHostOptions);
  await assertLiveHostBundleContract(bundle);
  bundle.session.write(taskEnvelope.taskId, {
    activeAgents: [{
      agentId: "agent-public-host",
      role: "worker",
      mode: "write",
      ownership: ["packages/public-api/src/host.ts"]
    }]
  });
  assert.equal(bundle.session.read(taskEnvelope.taskId).activeAgents[0]?.agentId, "agent-public-host");
  assert.deepEqual(await bundle.memoryClient.memoryOverview({ limit: 1 }), { limit: 1 });
});

test("public-api facade does not expose internal governance implementation", async () => {
  const moduleExports = await import("../packages/public-api/src/index.js");

  for (const name of [
    "dispatchGovernanceOperatorActionHostExecutor",
    "authorizeGovernanceOperatorActionHostExecutorReview",
    "evaluateWorkspaceWritePatchGuard",
    "evaluateWorkspaceWriteRealCanaryAuthorization",
    "runProviderExecutionPlanControlledReadOnly",
    "runProviderExecutionPlanDryRun",
    "createInitialGovernanceState",
    "recordAnomaly",
    "routeStrategyV2",
    "scoreGovernanceRisk",
    "createExecutionObservationRef",
    "evaluateApprovalRequirement",
    "createApprovalPermit",
    "createFileCheckpointLedgerStore",
    "RunManager",
    "arbitrateConflict",
    "createCodexDesktopLiveHostSmokeEvidence",
    "runCodexDesktopLiveHostSmoke",
    "createFakeMcpToolProvider",
    "createFakeA2ATransport",
    "InMemoryProviderExecutionPermitConsumptionStore",
    "consumeProviderExecutionPermitForPlan",
    "createApprovedProviderExecutionPermit",
    "WorkspaceWriteProviderExecutionPermitV2Schema",
    "redactSecretLikeFields",
    "JsonlEventLog",
    "JsonlEventLogReadError",
    "redactEventSecrets",
    "createPreflightLogEvent",
    "createMemoryPreflightLogEvent",
    "builtinApplyPatchToolManifest",
    "mcpGithubCreatePullRequestToolManifest",
    "remoteAgentInvokeToolManifest",
    "defaultToolManifests",
    "createDefaultToolRegistry"
  ]) {
    assert.equal(name in moduleExports, false, `${name} must stay internal`);
  }
});

test("public-api facade exported types can be referenced by consumers", () => {
  const typed = null as unknown as {
    sdkOptions: AgentOsSdkOptions;
    hostOptions: DesktopHostClientOptions;
    providerManifest: ProviderManifest;
    executorProvider: ExecutorProvider;
    task: Task;
    run: Run;
    mcpServerRef: McpServerRef;
    a2aAgentCard: A2AAgentCardSkeleton;
    telemetrySink: TelemetrySink;
    logEvent: LogEvent;
    artifactStore: ArtifactStore;
    kernelStore: KernelStore;
    registeredTool: RegisteredToolManifest;
    toolRegistry: ToolRegistry;
  };

  assert.equal(typeof typed, "object");
});
