import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatPublicApiExecutionBoundaryAuditResult,
  reviewPublicApiExecutionBoundaryAudit,
  type PublicApiExecutionBoundaryAuditInput
} from "../scripts/run-public-api-execution-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("public API execution boundary audit passes for current evidence", async () => {
  const review = reviewPublicApiExecutionBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneCapabilityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.packageExportsNamedGovernanceOnly, true);
  assert.equal(review.checks.protocolPublicSurfaceLocked, true);
  assert.equal(review.checks.policyPublicSurfaceLocked, true);
  assert.equal(review.checks.codexAdapterPublicSurfaceLocked, true);
  assert.equal(review.checks.evidencePublicSurfaceLocked, true);
  assert.equal(review.checks.providerPublicSurfaceLocked, true);
  assert.equal(review.checks.providerFacadeIsManifestSpiOnly, true);
  assert.equal(review.checks.protocolExcludesMcpA2a, true);
  assert.equal(review.checks.negativeCoverageRecorded, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.equal(review.summary.publicApiMode, "named_governance_subpaths_only");
  assert.equal(review.summary.governedRollbackExportAllowed, true);
  assert.equal(review.summary.directHostExecutorDispatchExportAllowed, false);
  assert.equal(review.summary.providerExecuteExportAllowed, false);
  assert.equal(review.summary.codexCliHostRunExportAllowed, false);
  assert.equal(review.summary.publicApiCallsDuringAudit, 0);
});

test("public API execution boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewPublicApiExecutionBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "public-api-execution-boundary",
      "archived-public-api-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("public_api_execution_boundary_governanceRunnerRegistered")
  );
});

test("public API execution boundary audit blocks internal package exports", async () => {
  const input = await createInputFromWorkspace();
  const packageJson = JSON.parse(input.packageJsonText) as {
    exports: Record<string, unknown>;
  };
  packageJson.exports["./governance-internal-recovery-control"] =
    "./dist/packages/governance-internal-recovery-control/src/index.js";
  const review = reviewPublicApiExecutionBoundaryAudit({
    ...input,
    packageJsonText: JSON.stringify(packageJson, null, 2)
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("public_api_execution_boundary_packageExportsNamedGovernanceOnly")
  );
});

test("public API execution boundary audit blocks direct execution exports", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewPublicApiExecutionBoundaryAudit({
    ...input,
    evidenceFixtureText: input.evidenceFixtureText.replace(
      "\n]",
      ',\n  "dispatchGovernanceOperatorActionHostExecutor"\n]'
    ),
    publicApiEvidenceText:
      `${input.publicApiEvidenceText}\nexport { dispatchGovernanceOperatorActionHostExecutor } from "../../governance-internal-recovery-control/src/index.js";\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("public_api_execution_boundary_evidencePublicSurfaceLocked")
  );
  assert.ok(
    review.reasons.includes("public_api_execution_boundary_noBroadExecutionAuthorization")
  );
});

test("public API execution boundary audit blocks provider runner broadening", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewPublicApiExecutionBoundaryAudit({
    ...input,
    providerFixtureText: input.providerFixtureText.replace(
      "\n]",
      ',\n  "runProviderExecutionPlanControlledReadOnly"\n]'
    ),
    publicApiProviderText:
      `${input.publicApiProviderText}\nexport const runProviderExecutionPlanControlledReadOnly = () => provider.execute();\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("public_api_execution_boundary_providerPublicSurfaceLocked")
  );
  assert.ok(
    review.reasons.includes("public_api_execution_boundary_providerFacadeIsManifestSpiOnly")
  );
  assert.ok(
    review.reasons.includes("public_api_execution_boundary_noBroadExecutionAuthorization")
  );
});

test("public API execution boundary audit blocks test preview and injected rollback seams", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewPublicApiExecutionBoundaryAudit({
    ...input,
    publicApiPolicyText:
      `${input.publicApiPolicyText}\nexport { createTestOnlyLocalClonePreviewer } from "../../file-change-preview/src/index.js";\n`,
    publicApiEvidenceText:
      `${input.publicApiEvidenceText}\nexport { runGovernedRollbackWithPrimitive } from "../../retain-control/src/index.js";\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("public_api_execution_boundary_noBroadExecutionAuthorization")
  );
});

test("public API execution boundary audit output stays summarized", async () => {
  const review = reviewPublicApiExecutionBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatPublicApiExecutionBoundaryAuditResult(review);
  const json = formatPublicApiExecutionBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /public API calls during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<PublicApiExecutionBoundaryAuditInput> = {}
): Promise<PublicApiExecutionBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    packageJsonText: await readFile("package.json", "utf8"),
    publicApiProtocolText: await readFile(
      "packages/public-api/src/protocol.ts",
      "utf8"
    ),
    publicApiPolicyText: await readFile("packages/public-api/src/policy.ts", "utf8"),
    publicApiCodexAdapterText: await readFile(
      "packages/public-api/src/codex-adapter.ts",
      "utf8"
    ),
    publicApiEvidenceText: await readFile(
      "packages/public-api/src/evidence.ts",
      "utf8"
    ),
    publicApiProviderText: await readFile(
      "packages/public-api/src/provider.ts",
      "utf8"
    ),
    publicApiTestText: await readFile("tests/public-api-surface.test.ts", "utf8"),
    protocolFixtureText: await readFile(
      "tests/fixtures/public-api-protocol-surface-lock.fixture.json",
      "utf8"
    ),
    policyFixtureText: await readFile(
      "tests/fixtures/public-api-policy-surface-lock.fixture.json",
      "utf8"
    ),
    codexAdapterFixtureText: await readFile(
      "tests/fixtures/public-api-codex-adapter-surface-lock.fixture.json",
      "utf8"
    ),
    evidenceFixtureText: await readFile(
      "tests/fixtures/public-api-evidence-surface-lock.fixture.json",
      "utf8"
    ),
    providerFixtureText: await readFile(
      "tests/fixtures/public-api-provider-surface-lock.fixture.json",
      "utf8"
    ),
    ...overrides
  };
}
