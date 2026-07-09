import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatControlledProviderExecutionDispatchPreflightBoundaryAuditResult,
  reviewControlledProviderExecutionDispatchPreflightBoundaryAudit,
  type ControlledProviderExecutionDispatchPreflightBoundaryAuditInput
} from "../scripts/run-controlled-provider-execution-dispatch-preflight-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("controlled provider execution dispatch preflight boundary passes", async () => {
  const review = reviewControlledProviderExecutionDispatchPreflightBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneAuthorityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.matrixRecorded, true);
  assert.equal(review.checks.stopMatrixRecorded, true);
  assert.equal(review.checks.matrixRowsRecorded, true);
  assert.equal(review.checks.providerRunnerBoundaryReferenced, true);
  assert.equal(review.checks.roadmapReferencesPortableValidation, true);
  assert.equal(review.checks.noBroadAuthorization, true);
  assert.equal(
    review.summary.dispatchPreflightMode,
    "controlled_readonly_dispatch_preflight_matrix_only"
  );
  assert.equal(review.summary.dispatchPreflightIsProviderExecuteAuthorization, false);
  assert.equal(review.summary.runnerRemainsFinalProviderExecuteGate, true);
  assert.equal(review.summary.dryRunDefaultPreserved, true);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
});

test("controlled provider execution dispatch preflight blocks missing matrix rows", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewControlledProviderExecutionDispatchPreflightBoundaryAudit({
    ...input,
    matrixDocText: input.matrixDocText
      .replaceAll("controlled read-only candidate", "controlled broad candidate")
      .replaceAll("provider execution permit is missing, expired, revoked, nonce-replayed", "")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_dispatch_preflight_boundary_stopMatrixRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_dispatch_preflight_boundary_matrixRowsRecorded"
    )
  );
});

test("controlled provider execution dispatch preflight blocks broad authorization", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewControlledProviderExecutionDispatchPreflightBoundaryAudit({
    ...input,
    matrixDocText: `${input.matrixDocText}\ndispatch preflight authorizes provider execute: true\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_dispatch_preflight_boundary_noBroadAuthorization"
    )
  );
});

test("controlled provider execution dispatch preflight requires runner boundary", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewControlledProviderExecutionDispatchPreflightBoundaryAudit({
    ...input,
    providerRunnerAuditText: input.providerRunnerAuditText.replaceAll(
      "controlled_readonly_and_workspace_write_gate",
      "general_provider_execute_gate"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "controlled_provider_execution_dispatch_preflight_boundary_providerRunnerBoundaryReferenced"
    )
  );
});

test("controlled provider execution dispatch preflight output stays sanitized", async () => {
  const review = reviewControlledProviderExecutionDispatchPreflightBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text =
    formatControlledProviderExecutionDispatchPreflightBoundaryAuditResult(review);
  const json = formatControlledProviderExecutionDispatchPreflightBoundaryAuditResult(
    review,
    "json"
  );
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
  overrides: Partial<ControlledProviderExecutionDispatchPreflightBoundaryAuditInput> = {}
): Promise<ControlledProviderExecutionDispatchPreflightBoundaryAuditInput> {
  return {
    controlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    matrixDocText: await readFile(
      "docs/governance/CONTROLLED_PROVIDER_EXECUTION_DISPATCH_PREFLIGHT_MATRIX.md",
      "utf8"
    ),
    providerRunnerAuditText: await readFile(
      "scripts/run-provider-execution-runner-boundary-audit.ts",
      "utf8"
    ),
    roadmapText: await readFile(
      "docs/agent-os-transformation/current-roadmap-20260610.md",
      "utf8"
    ),
    ...overrides
  };
}
