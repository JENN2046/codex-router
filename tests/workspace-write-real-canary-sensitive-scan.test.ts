import test from "node:test";
import assert from "node:assert/strict";
import {
  WORKSPACE_WRITE_REAL_CANARY_SENSITIVE_SCAN_TARGETS,
  formatWorkspaceWriteRealCanarySensitiveScanResult,
  reviewWorkspaceWriteRealCanarySensitiveScan,
  type WorkspaceWriteRealCanarySensitiveScanInput
} from "../scripts/run-workspace-write-real-canary-sensitive-scan.js";

const forbiddenMarkers = [
  "prompt",
  "args",
  "stdout",
  "stderr",
  "raw command",
  "raw task envelope",
  "raw env",
  "raw token",
  "raw patch",
  "OPENAI_API_KEY",
  "sk-",
  "Bearer"
];

test("workspace-write real canary sensitive scan passes sanitized targets", () => {
  const result = reviewWorkspaceWriteRealCanarySensitiveScan(createInput());

  assert.equal(result.status, "passed");
  assert.deepEqual(result.checks, {
    allTargetsPresent: true,
    noSensitiveMarkers: true
  });
  assert.equal(result.summary.targetCount, WORKSPACE_WRITE_REAL_CANARY_SENSITIVE_SCAN_TARGETS.length);
  assert.equal(result.summary.missingTargetCount, 0);
  assert.equal(result.summary.leakingTargetCount, 0);
  assert.equal(result.summary.markerHitCount, 0);
  assert.deepEqual(result.reasons, []);
});

test("workspace-write real canary sensitive scan blocks missing targets", () => {
  const input = createInput({
    [WORKSPACE_WRITE_REAL_CANARY_SENSITIVE_SCAN_TARGETS[0]]: undefined
  });
  const result = reviewWorkspaceWriteRealCanarySensitiveScan(input);

  assert.equal(result.status, "blocked");
  assert.equal(result.checks.allTargetsPresent, false);
  assert.equal(result.summary.missingTargetCount, 1);
  assert.ok(result.reasons.includes(
    "workspace_write_real_canary_sensitive_scan_target_missing"
  ));
});

test("workspace-write real canary sensitive scan blocks marker hits without returning raw marker", () => {
  const input = createInput({
    [WORKSPACE_WRITE_REAL_CANARY_SENSITIVE_SCAN_TARGETS[1]]: "safe text with stdout marker"
  });
  const result = reviewWorkspaceWriteRealCanarySensitiveScan(input);
  const output = formatWorkspaceWriteRealCanarySensitiveScanResult(result, "json");

  assert.equal(result.status, "blocked");
  assert.equal(result.checks.noSensitiveMarkers, false);
  assert.equal(result.summary.leakingTargetCount, 1);
  assert.equal(result.summary.markerHitCount, 1);
  assert.ok(result.reasons.includes(
    "workspace_write_real_canary_sensitive_scan_marker_found"
  ));

  for (const marker of forbiddenMarkers) {
    assert.equal(output.includes(marker), false, `scan output must omit ${marker}`);
  }
});

test("workspace-write real canary sensitive scan formats text and json summaries", () => {
  const result = reviewWorkspaceWriteRealCanarySensitiveScan(createInput());
  const text = formatWorkspaceWriteRealCanarySensitiveScanResult(result);
  const json = formatWorkspaceWriteRealCanarySensitiveScanResult(result, "json");
  const parsed = JSON.parse(json) as typeof result;

  assert.match(text, /status: passed/);
  assert.match(text, /targets:/);
  assert.equal(parsed.status, "passed");
  assert.equal(parsed.summary.markerHitCount, 0);
});

function createInput(
  overrides: Partial<Record<string, string | undefined>> = {}
): WorkspaceWriteRealCanarySensitiveScanInput {
  return {
    targetTexts: {
      ...Object.fromEntries(
        WORKSPACE_WRITE_REAL_CANARY_SENSITIVE_SCAN_TARGETS.map((target) => [
          target,
          "sanitized local-only review text"
        ])
      ),
      ...overrides
    }
  };
}
