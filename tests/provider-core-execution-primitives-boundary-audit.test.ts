import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatProviderCoreExecutionPrimitivesBoundaryAuditResult,
  reviewProviderCoreExecutionPrimitivesBoundaryAudit,
  type ProviderCoreExecutionPrimitivesBoundaryAuditInput
} from "../scripts/run-provider-core-execution-primitives-boundary-audit.js";
import { hashProviderManifest as hashProviderManifestInternal } from "../packages/provider-core/src/index.js";
import {
  hashProviderManifest as hashProviderManifestGovernancePublic,
  ProviderManifestSchema
} from "../packages/provider-core/src/governance-public.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("provider-core execution primitives boundary audit passes for current evidence", async () => {
  const review = reviewProviderCoreExecutionPrimitivesBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneBoundaryRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.providerGovernancePublicManifestOnly, true);
  assert.equal(review.checks.providerGovernanceHelperOwnershipValid, true);
  assert.equal(review.checks.providerCoreMovedBindingsReexportValid, true);
  assert.equal(review.checks.providerCorePrimitiveSchemasPresent, true);
  assert.equal(review.checks.providerCorePermitGuardsPresent, true);
  assert.equal(review.checks.providerCoreRegressionCoverageRecorded, true);
  assert.equal(review.checks.providerRegistryRemoteAgentGuardsPresent, true);
  assert.equal(review.checks.providerRegistryRemoteAgentCoverageRecorded, true);
  assert.equal(review.checks.toolInvocationPlannerCoverageRecorded, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.equal(review.summary.providerCorePrimitiveMode, "manifest_permit_plan_only");
  assert.equal(review.summary.remoteAgentExecutionAllowed, false);
  assert.equal(review.summary.toolRuntimeInvocationAllowed, false);
  assert.equal(review.summary.workspaceWriteExecutionAllowedByProviderCore, false);
  assert.equal(review.summary.generalProviderExecutionAllowed, false);
  assert.equal(review.summary.providerCoreRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.remoteAgentRuntimeCallsDuringAudit, 0);
  assert.equal(review.summary.toolRuntimeCallsDuringAudit, 0);
});

test("provider manifest hashing preserves one binding and byte identity across both source paths", () => {
  const manifest = ProviderManifestSchema.parse({
    providerId: "provider-hash-parity",
    kind: "tool",
    displayName: "Provider hash parity",
    version: "1.0.0",
    securityBoundary: {}
  });
  assert.equal(hashProviderManifestInternal, hashProviderManifestGovernancePublic);
  assert.equal(
    hashProviderManifestInternal(manifest),
    hashProviderManifestGovernancePublic(manifest)
  );
});

test("provider-core execution primitives boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewProviderCoreExecutionPrimitivesBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "provider-core-execution-primitives-boundary",
      "archived-provider-core-primitives"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "provider_core_execution_primitives_boundary_governanceRunnerRegistered"
    )
  );
});

test("provider-core execution primitives boundary audit blocks broadened control plane", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewProviderCoreExecutionPrimitivesBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText
      .replaceAll(
        "Provider-core execution primitives | active / manifest / permit / plan primitives only | No",
        "Provider-core execution primitives | active | Yes"
      )
      .replaceAll(
        "remote-agent, tool, and workspace-write primitives are not runtime authorization",
        "remote-agent, tool, and workspace-write primitives are runtime authorization"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "provider_core_execution_primitives_boundary_controlPlaneBoundaryRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "provider_core_execution_primitives_boundary_noBroadExecutionAuthorization"
    )
  );
});

test("provider-core execution primitives boundary audit blocks weakened permit guards", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewProviderCoreExecutionPrimitivesBoundaryAudit({
    ...input,
    providerCoreInternalSourceText: input.providerCoreInternalSourceText.replaceAll(
      "createApprovedWorkspaceWriteProviderExecutionPermitV2",
      "createOptionalWorkspaceWriteProviderExecutionPermitV2"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "provider_core_execution_primitives_boundary_providerCorePermitGuardsPresent"
    )
  );
});

test("provider-core execution primitives boundary audit rejects execution ownership in governance-public", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewProviderCoreExecutionPrimitivesBoundaryAudit({
    ...input,
    providerGovernancePublicSourceText:
      `${input.providerGovernancePublicSourceText}\ninterface ExecutorProvider { execute(): void }\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes(
    "provider_core_execution_primitives_boundary_providerGovernancePublicManifestOnly"
  ));
});

test("provider-core execution primitives boundary audit requires manifest ownership in governance-public", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewProviderCoreExecutionPrimitivesBoundaryAudit({
    ...input,
    providerGovernancePublicSourceText:
      input.providerGovernancePublicSourceText.replaceAll(
        "ProviderSecurityBoundarySchema",
        "MovedSecurityBoundarySchema"
      )
  });

  assert.equal(input.providerCoreInternalSourceText.includes("ProviderSecurityBoundarySchema"), true);
  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes(
    "provider_core_execution_primitives_boundary_providerGovernancePublicManifestOnly"
  ));
});

test("provider-core execution primitives boundary audit requires public helper and internal annotation", async () => {
  const input = await createInputFromWorkspace();
  for (const publicSource of [
    input.providerGovernancePublicSourceText.replaceAll(
      "assertProviderSupportsSandboxProfile",
      "movedAssertProviderSupportsSandboxProfile"
    ),
    input.providerGovernancePublicSourceText.replace("/** @internal */", "/** internal */")
  ]) {
    const review = reviewProviderCoreExecutionPrimitivesBoundaryAudit({
      ...input,
      providerGovernancePublicSourceText: publicSource
    });
    assert.equal(review.status, "blocked");
    assert.ok(review.reasons.includes(
      "provider_core_execution_primitives_boundary_providerGovernancePublicManifestOnly"
    ));
  }
});

test("provider-core execution primitives boundary audit rejects the complete workspace-write permit lifecycle in governance-public", async () => {
  const input = await createInputFromWorkspace();
  for (const addition of [
    "export const consumeWorkspaceWriteProviderExecutionPermit = () => undefined;",
    "export const createBlockedWorkspaceWriteProviderExecutionPermit = () => undefined;",
    "export const createWorkspaceWriteProviderExecutionPermitV2 = () => undefined;",
    "export type WorkspaceWriteProviderExecutionPermitIssueInput = {};"
  ]) {
    const review = reviewProviderCoreExecutionPrimitivesBoundaryAudit({
      ...input,
      providerGovernancePublicSourceText:
        `${input.providerGovernancePublicSourceText}\n${addition}\n`
    });
    assert.equal(review.status, "blocked");
    assert.ok(review.reasons.includes(
      "provider_core_execution_primitives_boundary_providerGovernancePublicManifestOnly"
    ));
  }
});

test("provider-core execution primitives boundary audit rejects execution context and result in governance-public", async () => {
  const input = await createInputFromWorkspace();
  for (const addition of [
    "export type ProviderExecutionContext = {};",
    "export type ProviderExecutionResult = {};"
  ]) {
    const review = reviewProviderCoreExecutionPrimitivesBoundaryAudit({
      ...input,
      providerGovernancePublicSourceText:
        `${input.providerGovernancePublicSourceText}\n${addition}\n`
    });
    assert.equal(review.status, "blocked");
    assert.ok(review.reasons.includes(
      "provider_core_execution_primitives_boundary_providerGovernancePublicManifestOnly"
    ));
  }
});

test("provider-core execution primitives boundary audit rejects every provider runtime import category", async () => {
  const input = await createInputFromWorkspace();
  for (const moduleSpecifier of [
    "../../governance-internal-provider-execution-runner/src/index.js",
    "../../governance-internal-controlled-provider-dispatcher/src/index.js",
    "../../provider-registry/src/index.js",
    "../../providers/codex-cli/src/index.js"
  ]) {
    const review = reviewProviderCoreExecutionPrimitivesBoundaryAudit({
      ...input,
      providerGovernancePublicSourceText:
        `${input.providerGovernancePublicSourceText}\nimport { forbidden } from ${JSON.stringify(moduleSpecifier)};\n`
    });
    assert.equal(review.status, "blocked");
    assert.ok(review.reasons.includes(
      "provider_core_execution_primitives_boundary_providerGovernancePublicManifestOnly"
    ));
  }
});

test("provider-core execution primitives boundary audit requires the shared helper in the governance import declaration", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewProviderCoreExecutionPrimitivesBoundaryAudit({
    ...input,
    providerCoreInternalSourceText: input.providerCoreInternalSourceText
      .replace("  stableStringifyProviderObject,\n", "")
      .concat("\nvoid stableStringifyProviderObject;\n")
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes(
    "provider_core_execution_primitives_boundary_providerGovernanceHelperOwnershipValid"
  ));
});

test("provider-core execution primitives boundary audit rejects moved-binding re-export drift", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewProviderCoreExecutionPrimitivesBoundaryAudit({
    ...input,
    providerCoreInternalSourceText: input.providerCoreInternalSourceText.replace(
      "  parseProviderManifest,\n",
      ""
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes(
    "provider_core_execution_primitives_boundary_providerCoreMovedBindingsReexportValid"
  ));
});

test("provider-core execution primitives boundary audit rejects helper duplication", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewProviderCoreExecutionPrimitivesBoundaryAudit({
    ...input,
    providerCoreInternalSourceText:
      `${input.providerCoreInternalSourceText}\nfunction stableStringifyProviderObject() {}\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.includes(
    "provider_core_execution_primitives_boundary_providerGovernanceHelperOwnershipValid"
  ));
});

test("provider-core execution primitives boundary audit output stays summarized", async () => {
  const review = reviewProviderCoreExecutionPrimitivesBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatProviderCoreExecutionPrimitivesBoundaryAuditResult(review);
  const json = formatProviderCoreExecutionPrimitivesBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /provider-core runtime calls during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<ProviderCoreExecutionPrimitivesBoundaryAuditInput> = {}
): Promise<ProviderCoreExecutionPrimitivesBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    providerGovernancePublicSourceText: await readFile(
      "packages/provider-core/src/governance-public.ts",
      "utf8"
    ),
    providerCoreInternalSourceText: await readFile(
      "packages/provider-core/src/index.ts",
      "utf8"
    ),
    providerRegistrySourceText: await readFile(
      "packages/provider-registry/src/index.ts",
      "utf8"
    ),
    providerCoreTestText: await readFile("tests/provider-core.test.ts", "utf8"),
    providerRegistryTestText: await readFile(
      "tests/provider-registry.test.ts",
      "utf8"
    ),
    toolInvocationPlannerTestText: await readFile(
      "tests/tool-invocation-planner.test.ts",
      "utf8"
    ),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    ...overrides
  };
}
