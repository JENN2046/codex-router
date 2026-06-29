import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  executionObservationResolutionMatches,
  runRuntimeGovernanceDemo
} from "../scripts/run-runtime-governance-demo.js";

const policyPath = fileURLToPath(new URL("../routing-policy.yaml", import.meta.url));

test("runtime governance demo summarizes executable evidence and recovery without live host execution", async () => {
  const result = await runRuntimeGovernanceDemo(policyPath);

  assert.equal(result.schemaVersion, "runtime-governance-demo.v1");
  assert.equal(result.summary.allScenariosPassed, true);
  assert.equal(result.summary.realHostExecution, false);
  assert.equal(result.summary.wroteEvidence, false);

  const success = result.scenarios.find(
    (scenario) => scenario.name === "successful_example_execution"
  );
  assert.equal(success?.decisionStatus, "ready");
  assert.equal(success?.executionStatus, "completed");
  assert.ok((success?.observationCount ?? 0) > 0);

  const failure = result.scenarios.find(
    (scenario) => scenario.name === "failure_evidence_ref_resolution"
  );
  assert.equal(failure?.executionStatus, "failed");
  assert.equal(failure?.evidenceRefResolved, true);

  const recovery = result.scenarios.find(
    (scenario) => scenario.name === "third_failure_recovery_packet"
  );
  assert.equal(recovery?.hostRoute, "desktop");
  assert.equal(recovery?.usedHostDispatch, false);
  assert.equal(recovery?.executionStatus, "failed");
  assert.equal(recovery?.evidenceRefResolved, true);
  assert.equal(recovery?.recoveryRequired, true);
  assert.equal(recovery?.lockdown, true);
  assert.equal(recovery?.recommendedRecoveryAction, "fork");
  assert.equal(
    recovery?.recoveryRecommendationReason,
    "third_anomaly_fork_for_investigation"
  );
  assert.equal(recovery?.recoveryRecommendationEvidenceStatus, "referenced");
  assert.ok(recovery?.blockingReasons.includes("governance_step_back_triggered"));
  assert.ok(recovery?.blockingReasons.includes("arbitration_required"));
});

test("runtime governance demo fails closed before host dispatch when policy routes scenarios to codex-cli", async () => {
  const policyText = await readFile(policyPath, "utf8");
  const unsafePolicyText = policyText.replace(
    /(\n  engineering:\s*)"desktop"/,
    "$1\"codex-cli\""
  );
  assert.notEqual(unsafePolicyText, policyText);

  const cwd = await mkdtemp(join(tmpdir(), "runtime-governance-demo-policy-"));
  const unsafePolicyPath = join(cwd, "routing-policy.yaml");
  await writeFile(unsafePolicyPath, unsafePolicyText, "utf8");

  await assert.rejects(
    () => runRuntimeGovernanceDemo(unsafePolicyPath),
    /runtime_governance_demo_requires_desktop_route:scenario:successful_example_execution:taskClass:engineering:hostRoute:codex-cli/
  );
});

test("runtime governance demo requires real failed and resolved observations before marking evidence resolved", () => {
  assert.equal(executionObservationResolutionMatches(undefined, undefined), false);
  assert.equal(
    executionObservationResolutionMatches(
      { observationId: "runtime-demo-failure:send_input:failed:1" },
      undefined
    ),
    false
  );
  assert.equal(
    executionObservationResolutionMatches(
      undefined,
      { observationId: "runtime-demo-failure:send_input:failed:1" }
    ),
    false
  );
  assert.equal(
    executionObservationResolutionMatches(
      { observationId: "runtime-demo-failure:send_input:failed:1" },
      { observationId: "runtime-demo-failure:send_input:failed:2" }
    ),
    false
  );
  assert.equal(
    executionObservationResolutionMatches(
      { observationId: "runtime-demo-failure:send_input:failed:1" },
      { observationId: "runtime-demo-failure:send_input:failed:1" }
    ),
    true
  );
});
