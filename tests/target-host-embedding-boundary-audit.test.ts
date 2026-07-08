import test from "node:test";
import assert from "node:assert/strict";
import {
  collectTargetHostEmbeddingBoundaryAuditInput,
  formatTargetHostEmbeddingBoundaryAuditResult,
  reviewTargetHostEmbeddingBoundaryAudit
} from "../scripts/run-target-host-embedding-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("target host embedding boundary audit passes for current evidence", async () => {
  const review = reviewTargetHostEmbeddingBoundaryAudit(
    await collectTargetHostEmbeddingBoundaryAuditInput()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.objectContractMarkersRecorded, true);
  assert.equal(review.checks.layerSkeletonMarkersRecorded, true);
  assert.equal(review.checks.embeddingStarterMarkersRecorded, true);
  assert.equal(review.checks.failClosedCoverageRecorded, true);
  assert.equal(review.checks.noDefaultRuntimeInvocationSurface, true);
  assert.equal(review.checks.outputSanitized, true);
  assert.equal(
    review.summary.targetHostEmbeddingMode,
    "explicit_target_host_contract_and_starter_only"
  );
  assert.equal(review.summary.placeholderMethodsAreRealExecution, false);
  assert.equal(review.summary.scaffoldReadyStatusIsExecutionAuthorization, false);
  assert.equal(review.summary.createBundleRequiresFullyWiredHost, true);
  assert.equal(review.summary.createBundleIsHostExecutorAuthorization, false);
  assert.equal(review.summary.directiveBuildersAreShellAuthorization, false);
  assert.equal(review.summary.defaultRealHostExecutionAllowed, false);
  assert.equal(review.summary.defaultHostExecutorLookupAllowed, false);
  assert.equal(review.summary.defaultCodexCliInvocationAllowed, false);
  assert.equal(review.summary.providerExecuteAllowed, false);
  assert.equal(review.summary.subAgentRuntimeInvocationAllowed, false);
  assert.equal(review.summary.shellProcessAllowedByDefault, false);
  assert.equal(review.summary.workspaceWriteAllowedByDefault, false);
  assert.equal(review.summary.externalWriteAllowed, false);
  assert.equal(review.summary.bundleCreationsDuringAudit, 0);
  assert.equal(review.summary.hostClientRunCallsDuringAudit, 0);
  assert.equal(review.summary.hostExecutorInvocationsDuringAudit, 0);
  assert.equal(review.summary.codexCliCallsDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.subAgentRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.shellProcessCallsDuringAudit, 0);
  assert.equal(review.summary.workspaceWriteCallsDuringAudit, 0);
  assert.equal(review.summary.externalWriteCallsDuringAudit, 0);
});

test("target host embedding boundary audit blocks missing governance registration", async () => {
  const input = await collectTargetHostEmbeddingBoundaryAuditInput();
  const review = reviewTargetHostEmbeddingBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "target-host-embedding-boundary",
      "archived-target-host-boundary"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit target-host-embedding-boundary",
      "npm run governance -- audit archived-target-host-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "target_host_embedding_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "target_host_embedding_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("target host embedding boundary audit blocks missing control-plane authority", async () => {
  const input = await collectTargetHostEmbeddingBoundaryAuditInput();
  const review = reviewTargetHostEmbeddingBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText.replaceAll(
      "Target host embedding boundary",
      "Archived target host boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "target_host_embedding_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("target host embedding boundary audit blocks missing source and test markers", async () => {
  const input = await collectTargetHostEmbeddingBoundaryAuditInput();
  const review = reviewTargetHostEmbeddingBoundaryAudit({
    ...input,
    targetHostObjectSourceText: input.targetHostObjectSourceText.replaceAll(
      "codex_desktop_target_host_contract_unwired_methods",
      "archived_unwired_methods"
    ),
    targetHostLayerSourceText: input.targetHostLayerSourceText.replaceAll(
      "assertCodexDesktopTargetHostObjectContract(options.host)",
      "true"
    ),
    targetHostStarterSourceText: input.targetHostStarterSourceText.replaceAll(
      "wire_required_methods",
      "connect_methods"
    ),
    targetHostStarterTestText: input.targetHostStarterTestText.replaceAll(
      "target host embedding starter exposes a scaffold with live readiness inspection",
      "archived starter scaffold test"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "target_host_embedding_boundary_objectContractMarkersRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "target_host_embedding_boundary_layerSkeletonMarkersRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "target_host_embedding_boundary_embeddingStarterMarkersRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "target_host_embedding_boundary_failClosedCoverageRecorded"
    )
  );
});

test("target host embedding boundary audit blocks default runtime invocation markers", async () => {
  const input = await collectTargetHostEmbeddingBoundaryAuditInput();
  const review = reviewTargetHostEmbeddingBoundaryAudit({
    ...input,
    targetHostStarterSourceText:
      input.targetHostStarterSourceText + "\nprovider.execute(plan);\n"
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "target_host_embedding_boundary_noDefaultRuntimeInvocationSurface"
    )
  );
});

test("target host embedding boundary audit formats sanitized text and json", async () => {
  const review = reviewTargetHostEmbeddingBoundaryAudit(
    await collectTargetHostEmbeddingBoundaryAuditInput()
  );
  const text = formatTargetHostEmbeddingBoundaryAuditResult(review);
  const json = formatTargetHostEmbeddingBoundaryAuditResult(review, "json");

  assert.match(text, /Target host embedding boundary audit/);
  assert.match(text, /placeholder methods are real execution: false/);
  assert.match(text, /createBundle requires fully wired host: true/);
  assert.match(text, /host client run calls during audit: 0/);
  assert.equal(JSON.parse(json).status, "passed");
  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false);
    assert.equal(json.includes(marker), false);
  }
});
