import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatProviderRegistryBoundaryAuditResult,
  reviewProviderRegistryBoundaryAudit,
  type ProviderRegistryBoundaryAuditInput
} from "../scripts/run-provider-registry-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("provider registry boundary audit passes for current evidence", async () => {
  const review = reviewProviderRegistryBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.registryMarkersRecorded, true);
  assert.equal(review.checks.registryRegressionCoverageRecorded, true);
  assert.equal(review.checks.selectionAcceptanceRecorded, true);
  assert.equal(review.checks.selectionAcceptanceCoverageRecorded, true);
  assert.equal(review.checks.noRuntimeProviderInvocationSurface, true);
  assert.equal(
    review.summary.providerRegistryMode,
    "catalog_selection_attestation_and_manifest_store_only"
  );
  assert.equal(review.summary.selectedProviderIsExecutionAuthorization, false);
  assert.equal(
    review.summary.providerGrantSelectionIsProviderExecuteAuthorization,
    false
  );
  assert.equal(
    review.summary.routingDecisionSelectionIsCodexCliAuthorization,
    false
  );
  assert.equal(
    review.summary.registeredRemoteAgentProviderIsSubAgentRuntimeAuthorization,
    false
  );
  assert.equal(
    review.summary.manifestStorePersistenceIsWorkspaceWriteExecution,
    false
  );
  assert.equal(review.summary.providerRegistryCallsDuringAudit, 0);
  assert.equal(review.summary.providerSelectionCallsDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.codexCliCallsDuringAudit, 0);
});

test("provider registry boundary audit blocks missing registration", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewProviderRegistryBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "provider-registry-boundary",
      "archived-provider-registry"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "provider-registry-boundary",
      "archived-provider-registry"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "provider_registry_boundary_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "provider_registry_boundary_governanceReadmeListsBoundary"
    )
  );
});

test("provider registry boundary audit blocks missing control-plane authority", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewProviderRegistryBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText
      .replaceAll("Provider registry boundary", "Provider registry")
      .replaceAll(
        "selected providers are not execution authorization",
        "selected providers authorize execution"
      )
      .replaceAll(
        "manifest-store persistence is not workspace-write execution",
        "manifest-store persistence is workspace-write execution"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "provider_registry_boundary_controlPlaneAuthorityRecorded"
    )
  );
});

test("provider registry boundary audit blocks source and test drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewProviderRegistryBoundaryAudit({
    ...input,
    providerRegistrySourceText: input.providerRegistrySourceText
      .replaceAll("assertRemoteAgentAuthSchemes", "allowRemoteAgentAuth")
      .replaceAll("writeState(state: ProviderManifestStoreState)", "writeRuntimeState(state)"),
    providerRegistryTestText: input.providerRegistryTestText.replaceAll(
      "provider-registry accepts Codex CLI provider while execution remains disabled",
      "provider-registry accepts Codex CLI provider and executes it"
    ),
    providerRegistrySelectionAcceptanceText:
      input.providerRegistrySelectionAcceptanceText.replaceAll(
        "noRunPath: true",
        "noRunPath: false"
      ),
    providerRegistrySelectionAcceptanceTestText:
      input.providerRegistrySelectionAcceptanceTestText.replaceAll(
        "assertSafeEvidence",
        "assertRawEvidence"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("provider_registry_boundary_registryMarkersRecorded")
  );
  assert.ok(
    review.reasons.includes(
      "provider_registry_boundary_registryRegressionCoverageRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "provider_registry_boundary_selectionAcceptanceRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "provider_registry_boundary_selectionAcceptanceCoverageRecorded"
    )
  );
});

test("provider registry boundary audit blocks runtime invocation markers", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewProviderRegistryBoundaryAudit({
    ...input,
    providerRegistrySourceText: `${input.providerRegistrySourceText}
entry.provider.execute(plan);
entry.provider.invoke(invocation);
entry.provider.createRemoteTask(task);
spawnSubAgent(input);
`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "provider_registry_boundary_noRuntimeProviderInvocationSurface"
    )
  );
});

test("provider registry boundary audit formats sanitized text and json", async () => {
  const review = reviewProviderRegistryBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatProviderRegistryBoundaryAuditResult(review);
  const json = formatProviderRegistryBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /provider execute calls during audit: 0/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.providerExecuteCallsDuringAudit, 0);

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<ProviderRegistryBoundaryAuditInput> = {}
): Promise<ProviderRegistryBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    providerRegistrySourceText: await readFile(
      "packages/provider-registry/src/index.ts",
      "utf8"
    ),
    providerRegistryTestText: await readFile("tests/provider-registry.test.ts", "utf8"),
    providerRegistrySelectionAcceptanceText: await readFile(
      "scripts/run-provider-registry-selection-acceptance.ts",
      "utf8"
    ),
    providerRegistrySelectionAcceptanceTestText: await readFile(
      "tests/provider-registry-selection-acceptance.test.ts",
      "utf8"
    ),
    ...overrides
  };
}
