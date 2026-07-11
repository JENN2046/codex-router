import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatAgentOsLocalRuntimeBoundaryAuditResult,
  reviewAgentOsLocalRuntimeBoundaryAudit,
  type AgentOsLocalRuntimeBoundaryAuditInput
} from "../scripts/run-agent-os-local-runtime-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("Agent OS local runtime boundary audit passes for current evidence", async () => {
  const review = reviewAgentOsLocalRuntimeBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneCapabilityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.runtimeGateMarkersPresent, true);
  assert.equal(review.checks.sdkWrapperUsesLocalRuntime, true);
  assert.equal(review.checks.cliWrapperUsesLocalRuntime, true);
  assert.equal(review.checks.appServerUsesLocalRuntimeWithoutNetwork, true);
  assert.equal(review.checks.manifestRemainsDeclarationOnly, true);
  assert.equal(review.checks.coverageRecorded, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.equal(review.summary.runtimeMode, "local_state_and_provider_plan_runtime");
  assert.deepEqual(review.summary.publicSurfaces, ["mcp", "cli", "app_server", "sdk"]);
  assert.equal(review.summary.providerPlanCanBeStored, true);
  assert.equal(review.summary.realProviderExecutionAllowed, false);
  assert.equal(review.summary.codexCliInvocationAllowed, false);
  assert.equal(review.summary.subAgentRuntimeInvocationAllowed, false);
  assert.equal(review.summary.hostExecutorInvocationAllowed, false);
  assert.equal(review.summary.controlledWorkspaceWritePrepareAllowed, true);
  assert.equal(review.summary.controlledWorkspaceWriteDispatchAllowed, true);
  assert.equal(review.summary.generalWorkspaceWriteExecutionAllowed, false);
  assert.equal(review.summary.workspaceWriteProviderExecuteAllowed, false);
  assert.equal(review.summary.localMutationRequiresApprovalAndAllowance, true);
  assert.equal(review.summary.localRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.codexCliCallsDuringAudit, 0);
});

test("Agent OS local runtime boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentOsLocalRuntimeBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "agent-os-local-runtime-boundary",
      "archived-local-runtime-audit"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_os_local_runtime_boundary_governanceRunnerRegistered"
    )
  );
});

test("Agent OS local runtime boundary audit blocks missing mutation gate markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentOsLocalRuntimeBoundaryAudit({
    ...input,
    localRuntimeText: input.localRuntimeText
      .replaceAll("AGENT_OS_MCP_LOCAL_MUTATION_DISABLED", "AGENT_OS_MUTATION_OPEN")
      .replaceAll("approvedMutatingTools", "unguardedMutatingTools")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_os_local_runtime_boundary_runtimeGateMarkersPresent"
    )
  );
});

test("Agent OS local runtime boundary audit blocks broad execution calls", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentOsLocalRuntimeBoundaryAudit({
    ...input,
    localRuntimeText:
      `${input.localRuntimeText}\nprovider.execute({});\nrunCodexCli({});\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_os_local_runtime_boundary_noBroadExecutionAuthorization"
    )
  );
});

test("Agent OS local runtime boundary audit blocks live app-server broadening", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewAgentOsLocalRuntimeBoundaryAudit({
    ...input,
    appServerText: input.appServerText
      .replaceAll("liveHttpServerStarted: false", "liveHttpServerStarted: true")
      .replaceAll("networkAccessed: false", "networkAccessed: true")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "agent_os_local_runtime_boundary_appServerUsesLocalRuntimeWithoutNetwork"
    )
  );
  assert.ok(
    review.reasons.includes(
      "agent_os_local_runtime_boundary_noBroadExecutionAuthorization"
    )
  );
});

test("Agent OS local runtime boundary audit output stays summarized", async () => {
  const review = reviewAgentOsLocalRuntimeBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatAgentOsLocalRuntimeBoundaryAuditResult(review);
  const json = formatAgentOsLocalRuntimeBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /local runtime calls during audit: 0/);
  assert.match(text, /controlled workspace-write dispatch allowed: true/);
  assert.match(text, /general workspace-write execution allowed: false/);
  assert.match(text, /workspace-write provider execute allowed: false/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<AgentOsLocalRuntimeBoundaryAuditInput> = {}
): Promise<AgentOsLocalRuntimeBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    localRuntimeText: await readFile(
      "packages/protocol-mcp/src/agent-os-local-runtime.ts",
      "utf8"
    ),
    serverManifestText: await readFile(
      "packages/protocol-mcp/src/agent-os-server-manifest.ts",
      "utf8"
    ),
    sdkWrapperText: await readFile("packages/agent-os-sdk/src/index.ts", "utf8"),
    cliWrapperText: await readFile("packages/agent-os-cli/src/index.ts", "utf8"),
    appServerText: await readFile(
      "packages/agent-os-app-server/src/index.ts",
      "utf8"
    ),
    localRuntimeTestText: await readFile(
      "tests/agent-os-mcp-local-runtime.test.ts",
      "utf8"
    ),
    sdkTestText: await readFile("tests/agent-os-sdk.test.ts", "utf8"),
    cliTestText: await readFile("tests/agent-os-cli.test.ts", "utf8"),
    appServerTestText: await readFile("tests/agent-os-app-server.test.ts", "utf8"),
    ...overrides
  };
}
