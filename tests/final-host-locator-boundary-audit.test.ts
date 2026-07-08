import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatFinalHostLocatorBoundaryAuditResult,
  reviewFinalHostLocatorBoundaryAudit,
  type FinalHostLocatorBoundaryAuditInput
} from "../scripts/run-final-host-locator-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("final host locator boundary audit passes for current evidence", async () => {
  const review = reviewFinalHostLocatorBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneCapabilityRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.sourceGateMarkersPresent, true);
  assert.equal(review.checks.pathProbeIsReadOnlyAndBounded, true);
  assert.equal(review.checks.coverageRecorded, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.equal(review.summary.locatorMode, "source_candidate_pre_mapping_only");
  assert.equal(review.summary.readyForMappingIsHostExecutionAuthorization, false);
  assert.equal(review.summary.packagedRuntimeCanBeFinalHostSource, false);
  assert.equal(review.summary.referenceHostCanBeFinalHostSource, false);
  assert.equal(review.summary.pathProbeWritesAllowed, false);
  assert.equal(review.summary.recursiveScanAllowed, false);
  assert.equal(review.summary.hostExecutorInvocationAllowed, false);
  assert.equal(review.summary.desktopHostClientCreationAllowed, false);
  assert.equal(review.summary.hostDispatchAllowed, false);
  assert.equal(review.summary.providerExecuteAllowed, false);
  assert.equal(review.summary.codexCliInvocationAllowed, false);
  assert.equal(review.summary.subAgentRuntimeInvocationAllowed, false);
  assert.equal(review.summary.workspaceWriteExecutionAllowed, false);
  assert.equal(review.summary.finalHostLocatorCallsDuringAudit, 0);
  assert.equal(review.summary.pathProbeWritesDuringAudit, 0);
  assert.equal(review.summary.hostExecutorCallsDuringAudit, 0);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
});

test("final host locator boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewFinalHostLocatorBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "final-host-locator-boundary",
      "archived-final-host-source-boundary"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "final_host_locator_boundary_governanceRunnerRegistered"
    )
  );
});

test("final host locator boundary audit blocks missing source gate marker", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewFinalHostLocatorBoundaryAudit({
    ...input,
    finalHostLocatorText: input.finalHostLocatorText
      .replaceAll("\"blocked_missing_editable_source\"", "\"blocked\"")
      .replaceAll("DEFAULT_REQUIRED_INPUTS", "OPTIONAL_INPUTS")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "final_host_locator_boundary_sourceGateMarkersPresent"
    )
  );
});

test("final host locator boundary audit blocks broad execution calls", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewFinalHostLocatorBoundaryAudit({
    ...input,
    finalHostLocatorText:
      `${input.finalHostLocatorText}\ndispatchGovernanceOperatorActionHostExecutor({});\nprovider.execute({});\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "final_host_locator_boundary_noBroadExecutionAuthorization"
    )
  );
});

test("final host locator boundary audit blocks path probe writes", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewFinalHostLocatorBoundaryAudit({
    ...input,
    finalHostLocatorText:
      `${input.finalHostLocatorText}\nawait writeFile(join(options.path, "marker"), "x");\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "final_host_locator_boundary_pathProbeIsReadOnlyAndBounded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "final_host_locator_boundary_noBroadExecutionAuthorization"
    )
  );
});

test("final host locator boundary audit output stays summarized", async () => {
  const review = reviewFinalHostLocatorBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatFinalHostLocatorBoundaryAuditResult(review);
  const json = formatFinalHostLocatorBoundaryAuditResult(review, "json");
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /locator mode: source_candidate_pre_mapping_only/);
  assert.match(text, /final host locator calls during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});

async function createInputFromWorkspace(
  overrides: Partial<FinalHostLocatorBoundaryAuditInput> = {}
): Promise<FinalHostLocatorBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    finalHostLocatorText: await readFile(
      "packages/final-host-locator/src/index.ts",
      "utf8"
    ),
    finalHostLocatorTestText: await readFile(
      "tests/final-host-locator.test.ts",
      "utf8"
    ),
    ...overrides
  };
}
