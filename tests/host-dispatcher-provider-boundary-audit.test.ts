import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatHostDispatcherProviderBoundaryAuditResult,
  reviewHostDispatcherProviderBoundaryAudit,
  type HostDispatcherProviderBoundaryAuditInput
} from "../scripts/run-host-dispatcher-provider-boundary-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer ",
  "prompt",
  "stdout",
  "stderr"
];

test("host dispatcher provider boundary audit passes for current evidence", async () => {
  const review = reviewHostDispatcherProviderBoundaryAudit(
    await createInputFromWorkspace()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.controlPlaneBoundaryRecorded, true);
  assert.equal(review.checks.governanceReadmeListsBoundary, true);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.hostDispatcherSourceGuardsPresent, true);
  assert.equal(review.checks.hostDispatcherRegressionCoverageRecorded, true);
  assert.equal(review.checks.noBroadExecutionAuthorization, true);
  assert.equal(review.summary.dispatchMode, "controlled_read_only_provider_dispatch");
  assert.equal(review.summary.permittedProviderId, "codex-cli");
  assert.equal(review.summary.permittedSideEffectClass, "read_only");
  assert.equal(review.summary.permittedSandbox, "read-only");
  assert.equal(review.summary.readOnlyProviderDispatchAllowed, true);
  assert.equal(review.summary.formalDispatchRequiresRegistry, true);
  assert.equal(review.summary.formalDispatchRequiresMetadata, true);
  assert.equal(review.summary.generalProviderExecutionAllowed, false);
  assert.equal(review.summary.workspaceWriteAllowedByHostDispatcher, false);
  assert.equal(review.summary.defaultRealCodexCliAllowed, false);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.realCodexCliCallsDuringAudit, 0);
});

test("host dispatcher provider boundary audit blocks missing runner entry", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewHostDispatcherProviderBoundaryAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "host-dispatcher-provider-boundary",
      "archived-host-dispatcher-provider"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "host_dispatcher_provider_boundary_governanceRunnerRegistered"
    )
  );
});

test("host dispatcher provider boundary audit blocks broadened control plane", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewHostDispatcherProviderBoundaryAudit({
    ...input,
    governanceControlPlaneText: input.governanceControlPlaneText
      .replaceAll(
        "Host dispatcher provider boundary | active / controlled read-only provider dispatch | Yes, narrow",
        "Host dispatcher provider boundary | active | Yes"
      )
      .replaceAll(
        "codex-cli + read_only + read-only only",
        "all providers and side effects"
      )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "host_dispatcher_provider_boundary_controlPlaneBoundaryRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "host_dispatcher_provider_boundary_noBroadExecutionAuthorization"
    )
  );
});

test("host dispatcher provider boundary audit blocks weakened source guards", async () => {
  const input = await createInputFromWorkspace();
  const review = reviewHostDispatcherProviderBoundaryAudit({
    ...input,
    hostDispatcherSourceText: input.hostDispatcherSourceText.replaceAll(
      "runner_result_provider_grant_side_effect_not_read_only",
      "runner_result_provider_grant_side_effect_allowed"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "host_dispatcher_provider_boundary_hostDispatcherSourceGuardsPresent"
    )
  );
});

test("host dispatcher provider boundary audit output stays summarized", async () => {
  const review = reviewHostDispatcherProviderBoundaryAudit(
    await createInputFromWorkspace()
  );
  const text = formatHostDispatcherProviderBoundaryAuditResult(review);
  const json = formatHostDispatcherProviderBoundaryAuditResult(review, "json");
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
  overrides: Partial<HostDispatcherProviderBoundaryAuditInput> = {}
): Promise<HostDispatcherProviderBoundaryAuditInput> {
  return {
    governanceControlPlaneText: await readFile(
      "docs/governance/GOVERNANCE_CONTROL_PLANE.md",
      "utf8"
    ),
    governanceReadmeText: await readFile("docs/governance/README.md", "utf8"),
    hostDispatcherSourceText: await readFile(
      "packages/host-dispatcher/src/index.ts",
      "utf8"
    ),
    hostDispatcherTestText: await readFile("tests/host-dispatcher.test.ts", "utf8"),
    governanceRunnerText: await readFile("scripts/run-governance-check.ts", "utf8"),
    ...overrides
  };
}
