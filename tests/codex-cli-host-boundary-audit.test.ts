import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatCodexCliHostBoundaryAuditResult,
  reviewCodexCliHostBoundaryAudit,
  type CodexCliHostBoundaryAuditInput
} from "../scripts/run-codex-cli-host-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer ",
  "CODEX_ACCESS_TOKEN"
];

test("codex cli host boundary audit passes for current evidence", async () => {
  const review = reviewCodexCliHostBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneCapabilityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.publicSurfaceLocked, true);
  assert.equal(review.checks.hostRunGuardsPresent, true);
  assert.equal(review.checks.governanceGuardsPresent, true);
  assert.equal(review.checks.regressionCoverageRecorded, true);
  assert.equal(review.checks.readonlySmokeCoverageRecorded, true);
  assert.equal(review.checks.publicExportFixtureLocksRunSurface, true);
  assert.equal(review.checks.governanceExportFixtureLocksControlSurface, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.equal(review.summary.hostMode, "explicit_codex_cli_host_execution_surface");
  assert.equal(review.summary.readOnlySmokeApprovalPolicy, "never");
  assert.equal(review.summary.workspaceWriteRequiresExplicitAllowance, true);
  assert.equal(review.summary.workspaceWriteRequiresConfirmation, true);
  assert.equal(review.summary.governanceStepBackBlocksWriteSandbox, true);
  assert.equal(review.summary.defaultRealCodexCliAllowedByBoundaryAudit, false);
  assert.equal(review.summary.codexCliProcessSpawnsDuringAudit, 0);
});

test("codex cli host boundary audit blocks missing governance runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCodexCliHostBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "codex-cli-host-boundary",
      "archived-codex-cli-host"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("codex_cli_host_boundary_governanceRunnerRegistered")
  );
});

test("codex cli host boundary audit blocks broadened control plane docs", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCodexCliHostBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText
      .replaceAll("Codex CLI host boundary", "Codex CLI host execution")
      .replaceAll(
        "workspace-write smoke requires explicit allowance and confirmation",
        "workspace-write smoke may run broadly"
      )
      .concat("\nCodex CLI host boundary | active | authorizes broad workspace-write\n")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("codex_cli_host_boundary_controlPlaneCapabilityRecorded")
  );
  assert.ok(
    review.reasons.includes("codex_cli_host_boundary_noBroadExecutionAuthorization")
  );
});

test("codex cli host boundary audit blocks weakened workspace-write guard", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCodexCliHostBoundaryAudit({
    ...input,
    sourceText: input.sourceText.replaceAll(
      "codex_cli_workspace_write_smoke_requires_confirmation",
      "codex_cli_workspace_write_smoke_confirmation_optional"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("codex_cli_host_boundary_hostRunGuardsPresent")
  );
});

test("codex cli host boundary audit blocks provider or host executor broadening", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCodexCliHostBoundaryAudit({
    ...input,
    sourceText: `${input.sourceText}\nprovider.execute(plan);\ndispatchGovernanceOperatorActionHostExecutor();`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("codex_cli_host_boundary_noBroadExecutionAuthorization")
  );
});

test("codex cli host boundary audit output stays summarized", async () => {
  const review = reviewCodexCliHostBoundaryAudit(await createInputFromWorkspace());
  const text = formatCodexCliHostBoundaryAuditResult(review);
  const json = formatCodexCliHostBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /Codex CLI process spawns during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<CodexCliHostBoundaryAuditInput> = {}
): Promise<CodexCliHostBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    publicSourceText: await readFile("packages/codex-cli-host/src/index.ts", "utf8"),
    sourceText: await readFile("packages/codex-cli-host/src/index-impl.ts", "utf8"),
    governanceSourceText: await readFile(
      "packages/codex-cli-host/src/governance-v2.ts",
      "utf8"
    ),
    testText: await readFile("tests/codex-cli-host.test.ts", "utf8"),
    readonlySmokeTestText: await readFile(
      "tests/codex-cli-real-readonly-smoke-script.test.ts",
      "utf8"
    ),
    publicExportFixtureText: await readFile(
      "tests/fixtures/codex-cli-host-public-export-lock.fixture.json",
      "utf8"
    ),
    governanceExportFixtureText: await readFile(
      "tests/fixtures/codex-cli-host-governance-v2-public-export-lock.fixture.json",
      "utf8"
    ),
    ...overrides
  };
}
