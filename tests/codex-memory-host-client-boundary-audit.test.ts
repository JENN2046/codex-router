import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatCodexMemoryHostClientBoundaryAuditResult,
  reviewCodexMemoryHostClientBoundaryAudit,
  type CodexMemoryHostClientBoundaryAuditInput
} from "../scripts/run-codex-memory-host-client-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("Codex memory host client boundary audit passes for current evidence", async () => {
  const review = reviewCodexMemoryHostClientBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.hostClientMarkersRecorded, true);
  assert.equal(review.checks.adapterMarkersRecorded, true);
  assert.equal(review.checks.regressionCoverageRecorded, true);
  assert.equal(review.checks.noDefaultRuntimeInvocationSurface, true);
  assert.equal(
    review.summary.codexMemoryHostClientMode,
    "explicit_injected_memory_operations_only"
  );
  assert.equal(
    review.summary.memoryOperationCallsAreHostExecutorAuthorization,
    false
  );
  assert.equal(review.summary.recordMemoryIsWorkspaceWriteExecution, false);
  assert.equal(review.summary.searchMemoryIsSubAgentRuntimeInvocation, false);
  assert.equal(review.summary.memoryOverviewIsRuntimeAuthorization, false);
  assert.equal(review.summary.adapterCheckpointWriteIsExecutionAuthorization, false);
  assert.equal(review.summary.mcpToolStyleAdapterIsDefaultHostLookup, false);
  assert.equal(review.summary.defaultRealHostExecutionAllowed, false);
  assert.equal(review.summary.defaultHostExecutorLookupAllowed, false);
  assert.equal(review.summary.defaultCodexCliInvocationAllowed, false);
  assert.equal(review.summary.providerExecuteAllowed, false);
  assert.equal(review.summary.subAgentRuntimeInvocationAllowed, false);
  assert.equal(review.summary.shellProcessAllowedByDefault, false);
  assert.equal(review.summary.workspaceWriteAllowedByDefault, false);
  assert.equal(review.summary.memoryHostClientCallsDuringAudit, 0);
  assert.equal(review.summary.memoryOperationCallsDuringAudit, 0);
  assert.equal(review.summary.hostExecutorInvocationsDuringAudit, 0);
});

test("Codex memory host client boundary audit blocks missing registration", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCodexMemoryHostClientBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "codex-memory-host-client-boundary",
      "archived-memory-host-client"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit codex-memory-host-client-boundary",
      "npm run governance -- audit archived-memory-host-client"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "codex_memory_host_client_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "codex_memory_host_client_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("Codex memory host client boundary audit blocks missing control-plane authority", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCodexMemoryHostClientBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Codex memory host client boundary",
      "Archived memory client boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "codex_memory_host_client_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("Codex memory host client boundary audit blocks source and test drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCodexMemoryHostClientBoundaryAudit({
    ...input,
    memoryHostClientSourceText: input.memoryHostClientSourceText.replaceAll(
      "createMcpToolStyleCodexMemoryOperations",
      "createImplicitMemoryHostOperations"
    ),
    memoryAdapterSourceText: input.memoryAdapterSourceText.replaceAll(
      "await this.client.recordMemory(record.writeInput)",
      "await this.client.executeMemoryWrite(record.writeInput)"
    ),
    memoryHostClientTestText: input.memoryHostClientTestText.replaceAll(
      "createMcpToolStyleCodexMemoryOperations adapts direct tool functions",
      "memory host client adapts direct tool functions"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "codex_memory_host_client_boundary_hostClientMarkersRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "codex_memory_host_client_boundary_adapterMarkersRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "codex_memory_host_client_boundary_regressionCoverageRecorded"
    )
  );
});

test("Codex memory host client boundary audit blocks runtime invocation markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCodexMemoryHostClientBoundaryAudit({
    ...input,
    memoryHostClientSourceText: input.memoryHostClientSourceText.concat(
      "\nprovider.execute(plan);\ndispatchGovernanceOperatorActionHostExecutor(input);\n"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "codex_memory_host_client_boundary_noDefaultRuntimeInvocationSurface"
    )
  );
});

test("Codex memory host client boundary audit formats sanitized text and json", async () => {
  const review = reviewCodexMemoryHostClientBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatCodexMemoryHostClientBoundaryAuditResult(review);
  const json = formatCodexMemoryHostClientBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /Codex memory host client boundary audit/);
  assert.match(text, /status: passed/);
  assert.match(text, /memory host client calls during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<CodexMemoryHostClientBoundaryAuditInput> = {}
): Promise<CodexMemoryHostClientBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    memoryHostClientSourceText: await readFile(
      "packages/codex-memory-host-client/src/index.ts",
      "utf8"
    ),
    memoryAdapterSourceText: await readFile(
      "packages/codex-memory-adapter/src/index.ts",
      "utf8"
    ),
    memoryHostClientTestText: await readFile(
      "tests/codex-memory-host-client.test.ts",
      "utf8"
    ),
    ...overrides
  };
}
