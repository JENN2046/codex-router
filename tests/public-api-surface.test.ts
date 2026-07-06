import test from "node:test";
import assert from "node:assert/strict";
import publicApiSurfaceLockFixture from "./fixtures/public-api-surface-lock.fixture.json" with { type: "json" };
import type {
  A2AAgentCardSkeleton,
  AgentOsSdkOptions,
  DesktopHostClientOptions,
  ExecutorProvider,
  McpServerRef,
  ProviderManifest,
  Run,
  Task
} from "../packages/public-api/src/index.js";

test("public-api facade export surface is lock-stable", async () => {
  const moduleExports = await import("../packages/public-api/src/index.js");
  const actualExports = Object.keys(moduleExports)
    .filter((name) => !name.startsWith("__") && name !== "default")
    .sort();

  assert.deepEqual(actualExports, publicApiSurfaceLockFixture);
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
    "A2AAgentCardSkeletonSchema"
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
    "WorkspaceWriteProviderExecutionPermitV2Schema"
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
  };

  assert.equal(typeof typed, "object");
});
