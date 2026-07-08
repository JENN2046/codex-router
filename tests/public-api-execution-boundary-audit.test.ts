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
  assert.equal(review.checks.packageExportsFacadeOnly, true);
  assert.equal(review.checks.rootPublicSurfaceLocked, true);
  assert.equal(review.checks.hostPublicSurfaceLocked, true);
  assert.equal(review.checks.providerPublicSurfaceLocked, true);
  assert.equal(review.checks.hostFacadeDelegatesToDesktopClient, true);
  assert.equal(review.checks.providerFacadeIsPlanAndRegistryOnly, true);
  assert.equal(review.checks.protocolRemoteInvokeDisabledByDefault, true);
  assert.equal(review.checks.negativeCoverageRecorded, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.equal(review.summary.publicApiMode, "facade_exports_only");
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
    review.reasons.includes("public_api_execution_boundary_packageExportsFacadeOnly")
  );
});

test("public API execution boundary audit blocks direct execution exports", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewPublicApiExecutionBoundaryAudit({
    ...input,
    rootFixtureText: input.rootFixtureText.replace(
      "\n]",
      ',\n  "dispatchGovernanceOperatorActionHostExecutor"\n]'
    ),
    publicApiIndexText:
      `${input.publicApiIndexText}\nexport { dispatchGovernanceOperatorActionHostExecutor } from "../../governance-internal-recovery-control/src/index.js";\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("public_api_execution_boundary_rootPublicSurfaceLocked")
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
    review.reasons.includes("public_api_execution_boundary_providerFacadeIsPlanAndRegistryOnly")
  );
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
    publicApiIndexText: await readFile("packages/public-api/src/index.ts", "utf8"),
    publicApiHostText: await readFile("packages/public-api/src/host.ts", "utf8"),
    publicApiProviderText: await readFile(
      "packages/public-api/src/provider.ts",
      "utf8"
    ),
    publicApiProtocolText: await readFile(
      "packages/public-api/src/protocol.ts",
      "utf8"
    ),
    publicApiTestText: await readFile("tests/public-api-surface.test.ts", "utf8"),
    rootFixtureText: await readFile(
      "tests/fixtures/public-api-surface-lock.fixture.json",
      "utf8"
    ),
    hostFixtureText: await readFile(
      "tests/fixtures/public-api-host-surface-lock.fixture.json",
      "utf8"
    ),
    providerFixtureText: await readFile(
      "tests/fixtures/public-api-provider-surface-lock.fixture.json",
      "utf8"
    ),
    ...overrides
  };
}
