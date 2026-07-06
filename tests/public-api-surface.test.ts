import test from "node:test";
import assert from "node:assert/strict";
import publicApiSurfaceLockFixture from "./fixtures/public-api-surface-lock.fixture.json" with { type: "json" };
import publicApiSupportSpiSurfaceLockFixture from "./fixtures/public-api-support-spi-surface-lock.fixture.json" with { type: "json" };
import type {
  A2AAgentCardSkeleton,
  AgentOsSdkOptions,
  ArtifactStore,
  DesktopHostClientOptions,
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

test("public-api facade export surface is lock-stable", async () => {
  const moduleExports = await import("../packages/public-api/src/index.js");
  const actualExports = Object.keys(moduleExports)
    .filter((name) => !name.startsWith("__") && name !== "default")
    .sort();

  assert.deepEqual(actualExports, publicApiSurfaceLockFixture);
});

test("public-api support SPI facade export surface is lock-stable", async () => {
  const moduleExports = await import("../packages/public-api/src/support.js");
  const actualExports = Object.keys(moduleExports)
    .filter((name) => !name.startsWith("__") && name !== "default")
    .sort();

  assert.deepEqual(actualExports, publicApiSupportSpiSurfaceLockFixture);
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
