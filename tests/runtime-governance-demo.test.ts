import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { runRuntimeGovernanceDemo } from "../scripts/run-runtime-governance-demo.js";

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
  assert.equal(recovery?.executionStatus, "failed");
  assert.equal(recovery?.evidenceRefResolved, true);
  assert.equal(recovery?.recoveryRequired, true);
  assert.equal(recovery?.lockdown, true);
  assert.ok(recovery?.blockingReasons.includes("governance_step_back_triggered"));
  assert.ok(recovery?.blockingReasons.includes("arbitration_required"));
});
