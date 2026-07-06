import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import packageJson from "../package.json" with { type: "json" };
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
