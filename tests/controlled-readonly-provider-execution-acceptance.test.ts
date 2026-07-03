import test from "node:test";
import assert from "node:assert/strict";
import {
  runControlledReadonlyProviderExecutionAcceptance
} from "../scripts/run-controlled-readonly-provider-execution-acceptance.js";

test("controlled read-only provider execution acceptance covers permit lifecycle", async () => {
  const evidence = await runControlledReadonlyProviderExecutionAcceptance();

  assert.equal(
    Object.values(evidence.checks).every(Boolean),
    true
  );
  assert.equal(evidence.checks.expiredPermitBlocked, true);
  assert.equal(evidence.checks.nonceMismatchBlocked, true);
  assert.equal(evidence.checks.permitReplayBlocked, true);
  assert.equal(evidence.checks.permitStoreFailureBlocked, true);
  assert.equal(evidence.counters.expiredPermitSpawnCalls, 0);
  assert.equal(evidence.counters.nonceMismatchSpawnCalls, 0);
  assert.equal(evidence.counters.replaySpawnCalls, 1);
  assert.equal(evidence.counters.permitStoreFailureSpawnCalls, 0);
  assert.equal(evidence.counters.realCodexCliCalls, 0);
  assert.equal(evidence.counters.workspaceWriteExecuteCalls, 0);
  assert.equal(evidence.counters.externalWriteCalls, 0);
  assert.ok(evidence.blockingReasons.includes(
    "controlled_readonly_provider_execution_permit_expired"
  ));
  assert.ok(evidence.blockingReasons.includes(
    "controlled_readonly_provider_execution_permit_nonce_mismatch"
  ));
  assert.ok(evidence.blockingReasons.includes(
    "codex_cli_provider_execution_permit_already_consumed_by_store"
  ));
  assert.ok(evidence.blockingReasons.includes(
    "codex_cli_provider_execution_permit_consumption_store_failed"
  ));
});
