import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatCodexMemoryMcpClientBoundaryAuditResult,
  reviewCodexMemoryMcpClientBoundaryAudit,
  type CodexMemoryMcpClientBoundaryAuditInput
} from "../scripts/run-codex-memory-mcp-client-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("Codex memory MCP client boundary audit passes for current evidence", async () => {
  const review = reviewCodexMemoryMcpClientBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.mcpClientMarkersRecorded, true);
  assert.equal(review.checks.adapterMarkersRecorded, true);
  assert.equal(review.checks.regressionCoverageRecorded, true);
  assert.equal(review.checks.noDefaultRuntimeInvocationSurface, true);
  assert.equal(
    review.summary.codexMemoryMcpClientMode,
    "explicit_mcp_http_memory_transport_only"
  );
  assert.equal(review.summary.mcpHttpCallsAreProviderExecution, false);
  assert.equal(review.summary.mcpHttpCallsAreHostExecutorAuthorization, false);
  assert.equal(review.summary.recordMemoryIsWorkspaceWriteExecution, false);
  assert.equal(review.summary.searchMemoryIsSubAgentRuntimeInvocation, false);
  assert.equal(review.summary.memoryOverviewIsRuntimeAuthorization, false);
  assert.equal(review.summary.adapterCheckpointWriteIsExecutionAuthorization, false);
  assert.equal(review.summary.defaultEndpointLookupAllowed, false);
  assert.equal(review.summary.bearerTokenIsExecutionAuthorization, false);
  assert.equal(review.summary.defaultCodexCliInvocationAllowed, false);
  assert.equal(review.summary.providerExecuteAllowed, false);
  assert.equal(review.summary.subAgentRuntimeInvocationAllowed, false);
  assert.equal(review.summary.shellProcessAllowedByDefault, false);
  assert.equal(review.summary.workspaceWriteAllowedByDefault, false);
  assert.equal(review.summary.mcpHttpCallsDuringAudit, 0);
  assert.equal(review.summary.memoryToolCallsDuringAudit, 0);
  assert.equal(review.summary.hostExecutorInvocationsDuringAudit, 0);
});

test("Codex memory MCP client boundary audit blocks missing registration", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCodexMemoryMcpClientBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "codex-memory-mcp-client-boundary",
      "archived-memory-mcp-client"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit codex-memory-mcp-client-boundary",
      "npm run governance -- audit archived-memory-mcp-client"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "codex_memory_mcp_client_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "codex_memory_mcp_client_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("Codex memory MCP client boundary audit blocks missing control-plane authority", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCodexMemoryMcpClientBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Codex memory MCP client boundary",
      "Archived memory MCP client boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "codex_memory_mcp_client_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("Codex memory MCP client boundary audit blocks source and test drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCodexMemoryMcpClientBoundaryAudit({
    ...input,
    memoryMcpClientSourceText: input.memoryMcpClientSourceText
      .replaceAll("EXPECTED_SERVER_NAME", "OPTIONAL_SERVER_NAME")
      .replaceAll("method: \"tools/call\"", "method: \"tools/execute\""),
    memoryAdapterSourceText: input.memoryAdapterSourceText.replaceAll(
      "await this.client.searchMemory({",
      "await this.client.executeMemorySearch({"
    ),
    memoryMcpClientTestText: input.memoryMcpClientTestText.replaceAll(
      "createCodexMemoryAdapterFromMcpHttp wires native MCP transport into CodexMemoryAdapter",
      "memory MCP client wires native transport into CodexMemoryAdapter"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "codex_memory_mcp_client_boundary_mcpClientMarkersRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "codex_memory_mcp_client_boundary_adapterMarkersRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "codex_memory_mcp_client_boundary_regressionCoverageRecorded"
    )
  );
});

test("Codex memory MCP client boundary audit blocks runtime invocation markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCodexMemoryMcpClientBoundaryAudit({
    ...input,
    memoryMcpClientSourceText: input.memoryMcpClientSourceText.concat(
      "\nprovider.execute(plan);\ndispatchGovernanceOperatorActionHostExecutor(input);\n"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "codex_memory_mcp_client_boundary_noDefaultRuntimeInvocationSurface"
    )
  );
});

test("Codex memory MCP client boundary audit formats sanitized text and json", async () => {
  const review = reviewCodexMemoryMcpClientBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatCodexMemoryMcpClientBoundaryAuditResult(review);
  const json = formatCodexMemoryMcpClientBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /Codex memory MCP client boundary audit/);
  assert.match(text, /status: passed/);
  assert.match(text, /MCP HTTP calls during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<CodexMemoryMcpClientBoundaryAuditInput> = {}
): Promise<CodexMemoryMcpClientBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    memoryMcpClientSourceText: await readFile(
      "packages/codex-memory-mcp-client/src/index.ts",
      "utf8"
    ),
    memoryAdapterSourceText: await readFile(
      "packages/codex-memory-adapter/src/index.ts",
      "utf8"
    ),
    memoryMcpClientTestText: await readFile(
      "tests/codex-memory-mcp-client.test.ts",
      "utf8"
    ),
    ...overrides
  };
}
