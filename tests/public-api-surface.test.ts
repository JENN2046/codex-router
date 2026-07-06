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
import type {
  A2AAgentCardSkeleton,
  AgentOsSdkOptions,
  ArtifactStore,
  CodexMemoryAdapterOptions,
  CodexDesktopLiveHostOptions,
  CodexDesktopRuntime,
  CodexDesktopToolRuntimeOperations,
  CodexMemoryHostOperations,
  CodexMemoryOverviewInput,
  CodexMemorySearchInput,
  CodexMemoryWriteInput,
  DesktopHostClient,
  DesktopHostClientPersistence,
  DesktopHostClientOptions,
  DesktopHostCheckpointLookup,
  DesktopHostCheckpointRecallAdapter,
  DesktopHostCheckpointRef,
  DesktopHostCheckpointStore,
  DesktopHostMemoryAdapter,
  DesktopHostResumeOptions,
  DesktopHostPreflightContext,
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

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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
  const client = createDesktopHostClient({
    policy: {},
    preflight: resolvedPreflight,
    bridge: {
      invokePrimitive: () => ({ ok: true })
    }
  });

  assert.equal(client instanceof DesktopHostClient, true);

  const inspection = inspectCodexDesktopLiveHostObject({});
  assert.equal(inspection.ready, false);
  assert.throws(() => assertCodexDesktopLiveHostObject({}), /codex_desktop_live_host_missing/);

  const starter = createCodexDesktopLiveHostEmbeddingStarter({
    anchor: "public-api-host-wrapper",
    policy: {}
  });
  assert.equal(starter.getStatus().ready, false);

  const hostResolvedPreflight = resolveLiveHostPreflightFromHost({
    read_thread_terminal: () => "terminal snapshot",
    spawn_agent: () => ({ ok: true })
  });
  const hostPreflightClient = createDesktopHostClient({
    policy: {},
    preflight: hostResolvedPreflight,
    bridge: {
      invokePrimitive: () => ({ ok: true })
    }
  });
  assert.equal(hostPreflightClient instanceof DesktopHostClient, true);
  assert.equal(resolvedPreflight.authAvailable, true);
  assert.equal(Array.isArray(hostResolvedPreflight.availableTools), true);
});

test("public-api host facade preserves concrete runtime handler contracts", () => {
  const preflight: DesktopHostPreflightContext = {
    authAvailable: true,
    availableTools: []
  };

  const invocation: DesktopPrimitiveInvocation = {
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

  const liveHostOptions: CodexDesktopLiveHostOptions = {
    policy: {},
    runtime: desktopRuntime,
    memory: {
      adapter: memoryAdapterOptions,
      operations: memoryOperations
    }
  };

  const taskEnvelope: DesktopHostTaskEnvelopeInput = {
    taskId: "task-public-host-envelope",
    intent: {
      summary: "Verify public host task envelope type",
      requestedAction: "Run a declaration-safe desktop host task"
    }
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

  const assertPublicHostNegativeContracts = () => {
    const client = null as unknown as DesktopHostClient;
    // @ts-expect-error public DesktopHostClient.run requires a task envelope input.
    void client.run({});
    // @ts-expect-error public memory adapter options require an anchor.
    const missingAnchor: CodexMemoryAdapterOptions = {};
    // @ts-expect-error public checkpoint stores require a record method.
    const missingCheckpointStore: DesktopHostClientPersistence = { checkpointStore: {} };
    // @ts-expect-error public resume memory recall requires lookup method.
    const missingMemoryRecall: DesktopHostResumeOptions = { memoryRecall: {} };
    void missingAnchor;
    void missingCheckpointStore;
    void missingMemoryRecall;
  };

  assert.equal(preflight.authAvailable, true);
  assert.equal(liveHostOptions.memory.adapter.anchor, "public-api-host-memory");
  assert.equal(liveHostOptions.memory.operations?.search_memory, memoryOperations.search_memory);
  assert.equal(taskEnvelope.taskId, "task-public-host-envelope");
  assert.equal(persistence.checkpointStore?.findLatestForTask?.(taskEnvelope.taskId), checkpoint);
  assert.equal(resumeOptions.memoryRecall?.recallLatestCheckpointRef({
    taskId: taskEnvelope.taskId
  }), checkpoint);
  assert.equal(typeof assertDesktopHostTaskRunnerContract, "function");
  assert.equal(typeof assertPublicHostNegativeContracts, "function");
  assert.equal(invocation.primitive, "shell_command");
  assert.equal(invocation.taskId, "task-public-host-contract");
  assert.equal(
    runtimeTools.apply_patch("*** Begin Patch\n*** End Patch\n"),
    "*** Begin Patch\n*** End Patch\n"
  );
  assert.deepEqual(runtimeTools.spawn_agent({ message: "spawn" }), { message: "spawn" });
  assert.deepEqual(desktopRuntime.spawnAgent({ message: "spawn" }), { message: "spawn" });
  assert.deepEqual(memoryOperations.search_memory({ query: "checkpoint" }), {
    results: [{ title: "checkpoint" }]
  });
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
