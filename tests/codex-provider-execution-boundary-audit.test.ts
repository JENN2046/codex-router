import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatCodexProviderExecutionBoundaryAuditResult,
  reviewCodexProviderExecutionBoundaryAudit,
  type CodexProviderExecutionBoundaryAuditInput
} from "../scripts/run-codex-provider-execution-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("codex provider execution boundary audit passes for current evidence", async () => {
  const review = reviewCodexProviderExecutionBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.pr23bBoundaryRecorded, true);
  assert.equal(review.checks.pr23cEvidenceBindingRecorded, true);
  assert.equal(review.checks.phase6CloseoutRecorded, true);
  assert.equal(review.checks.controlPlaneCapabilityRecorded, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.controlledAcceptanceScriptRecorded, true);
  assert.equal(review.checks.controlledRunnerGuardsPresent, true);
  assert.equal(review.checks.codexProviderGuardsPresent, true);
  assert.equal(review.checks.runnerRegressionCoverageRecorded, true);
  assert.equal(review.checks.providerWorkspaceWriteBlockCoverageRecorded, true);
  assert.equal(review.checks.acceptanceCoverageRecorded, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.equal(review.summary.permittedMode, "controlled-read-only");
  assert.equal(review.summary.defaultRealCodexCliAllowed, false);
  assert.equal(review.summary.generalProviderExecutionAllowed, false);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.realCodexCliCallsDuringAudit, 0);
});

test("codex provider execution boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCodexProviderExecutionBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "codex-provider-execution-boundary",
      "archived-codex-provider"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "codex_provider_execution_boundary_governanceRunnerRegistered"
    )
  );
});

test("codex provider execution boundary audit blocks broadened docs", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCodexProviderExecutionBoundaryAudit({
    ...input,
    phase6CloseoutText: input.phase6CloseoutText
      .replaceAll(
        "PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_CLOSEOUT_RECORDED",
        "PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_CLOSEOUT_REOPENED"
      )
      .replaceAll("General provider execution | blocked | No", "General provider execution | active | Yes")
      .replaceAll("real Codex CLI execution by default", "real Codex CLI execution by default is authorized")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("codex_provider_execution_boundary_phase6CloseoutRecorded")
  );
  assert.ok(
    review.reasons.includes("codex_provider_execution_boundary_noBroadExecutionAuthorization")
  );
});

test("codex provider execution boundary audit blocks weakened runner guard", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewCodexProviderExecutionBoundaryAudit({
    ...input,
    providerRunnerSourceText: input.providerRunnerSourceText.replaceAll(
      "controlled_readonly_provider_execution_permit_required",
      "controlled_readonly_provider_execution_permit_optional"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes("codex_provider_execution_boundary_controlledRunnerGuardsPresent")
  );
});

test("codex provider execution boundary audit output stays summarized", async () => {
  const review = reviewCodexProviderExecutionBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatCodexProviderExecutionBoundaryAuditResult(review);
  const json = formatCodexProviderExecutionBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /provider execute calls during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<CodexProviderExecutionBoundaryAuditInput> = {}
): Promise<CodexProviderExecutionBoundaryAuditInput> {
  return {
    pr23bDocText: await readFile(
      "docs/governance/PR_23B_CONTROLLED_READONLY_PROVIDER_EXECUTION_MINIMAL_SLICE.md",
      "utf8"
    ),
    pr23cDocText: await readFile(
      "docs/governance/PR_23C_EXECUTION_EVIDENCE_BINDING.md",
      "utf8"
    ),
    phase6CloseoutText: await readFile(
      "docs/governance/PHASE_6_CONTROLLED_EXECUTION_RUNTIME_HARDENING_CLOSEOUT.md",
      "utf8"
    ),
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    controlledAcceptanceScriptText: await readFile(
      "scripts/run-controlled-readonly-provider-execution-acceptance.ts",
      "utf8"
    ),
    providerRunnerSourceText: await readFile(
      "packages/governance-internal-provider-execution-runner/src/index.ts",
      "utf8"
    ),
    codexProviderSourceText: await readFile(
      "packages/providers/codex-cli/src/index.ts",
      "utf8"
    ),
    providerRunnerTestText: await readFile(
      "tests/provider-execution-runner.test.ts",
      "utf8"
    ),
    codexProviderTestText: await readFile("tests/codex-cli-provider.test.ts", "utf8"),
    controlledAcceptanceTestText: await readFile(
      "tests/controlled-readonly-provider-execution-acceptance.test.ts",
      "utf8"
    ),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    ...overrides
  };
}
