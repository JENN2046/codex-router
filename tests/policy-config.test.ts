import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import {
  getTelemetryAlertDeliveryThresholdPreset,
  getTelemetryAlertDeliveryWindowPolicy,
  getTelemetryAlertThresholdPreset,
  loadPolicyFromFile,
  loadPolicyFromString,
  resolveMemoryHealthPolicyPack,
  resolveTelemetryAlertDeliveryThresholdPreset,
  resolveTelemetryAlertDeliveryWindowPolicy,
  resolveTelemetryAlertThresholdPreset
} from "../packages/policy-config/src/index.js";

const policyPath = fileURLToPath(new URL("../routing-policy.yaml", import.meta.url));

test("policy config exposes execution-oriented memory health policy packs", async () => {
  const policy = await loadPolicyFromFile(policyPath);

  const readOnly = resolveMemoryHealthPolicyPack(policy, "read_only");
  const localWrite = resolveMemoryHealthPolicyPack(policy, "local_write");
  const engineering = resolveMemoryHealthPolicyPack(policy, "engineering_write");
  const release = resolveMemoryHealthPolicyPack(policy, "protected_remote");

  assert.equal(readOnly.packName, "read_only");
  assert.equal(readOnly.healthPolicy.overviewUnavailableSeverity, "ignore");
  assert.equal(readOnly.healthPolicy.codexMcpUnavailableSeverity, "warn");
  assert.equal(readOnly.guidance.resumeExpected, false);
  assert.equal(localWrite.packName, "local_write");
  assert.equal(localWrite.healthPolicy.codexMcpUnavailableSeverity, "warn");
  assert.equal(localWrite.healthPolicy.maxRejectedWrites, 1);
  assert.equal(localWrite.guidance.checkpointFrequency, "standard");
  assert.equal(engineering.packName, "engineering");
  assert.equal(engineering.healthPolicy.codexMcpUnavailableSeverity, "warn");
  assert.equal(engineering.healthPolicy.overviewUnavailableSeverity, "warn");
  assert.equal(engineering.guidance.telemetryMandatory, true);
  assert.equal(release.packName, "release");
  assert.equal(release.healthPolicy.codexMcpUnavailableSeverity, "block");
  assert.equal(release.healthPolicy.rejectedWritesSeverity, "block");
  assert.equal(release.healthPolicy.recallUnavailableSeverity, "block");
  assert.equal(release.guidance.memoryRequired, true);
  assert.equal(release.guidance.checkpointFrequency, "dense");
});

test("policy config exposes telemetry alert threshold presets aligned to tool access", async () => {
  const policy = await loadPolicyFromFile(policyPath);

  const readOnly = resolveTelemetryAlertThresholdPreset(policy, "read_only");
  const engineering = resolveTelemetryAlertThresholdPreset(policy, "engineering_write");
  const release = resolveTelemetryAlertThresholdPreset(policy, "protected_remote");
  const localWritePreset = getTelemetryAlertThresholdPreset(policy, "local_write");

  assert.equal(readOnly.presetName, "read_only");
  assert.equal(readOnly.thresholds.warn?.totals?.failures, 1);
  assert.equal(engineering.presetName, "engineering");
  assert.equal(engineering.thresholds.error?.totals?.failureRate, 0.25);
  assert.equal(release.presetName, "release");
  assert.equal(release.thresholds.error?.totals?.failures, 0);
  assert.equal(release.thresholds.error?.perSink?.timeouts, 0);
  assert.equal(localWritePreset.warn?.totals?.timeouts, 0);
});

test("policy config exposes telemetry alert delivery threshold presets aligned to tool access", async () => {
  const policy = await loadPolicyFromFile(policyPath);

  const readOnly = resolveTelemetryAlertDeliveryThresholdPreset(policy, "read_only");
  const engineering = resolveTelemetryAlertDeliveryThresholdPreset(policy, "engineering_write");
  const release = resolveTelemetryAlertDeliveryThresholdPreset(policy, "protected_remote");
  const localWritePreset = getTelemetryAlertDeliveryThresholdPreset(policy, "local_write");

  assert.equal(readOnly.presetName, "read_only");
  assert.equal(readOnly.thresholds.warn?.totals?.failures, 1);
  assert.equal(engineering.presetName, "engineering");
  assert.equal(engineering.thresholds.error?.totals?.failureRate, 0.25);
  assert.equal(release.presetName, "release");
  assert.equal(release.thresholds.error?.totals?.failures, 0);
  assert.equal(release.thresholds.error?.perSink?.timeouts, 0);
  assert.equal(localWritePreset.warn?.totals?.timeouts, 0);
});

test("policy config exposes telemetry alert delivery window presets aligned to tool access", async () => {
  const policy = await loadPolicyFromFile(policyPath);

  const readOnly = resolveTelemetryAlertDeliveryWindowPolicy(policy, "read_only");
  const engineering = resolveTelemetryAlertDeliveryWindowPolicy(policy, "engineering_write");
  const release = resolveTelemetryAlertDeliveryWindowPolicy(policy, "protected_remote");
  const localWritePreset = getTelemetryAlertDeliveryWindowPolicy(policy, "local_write");

  assert.equal(readOnly.presetName, "read_only");
  assert.equal(readOnly.policy.dedupeWindowMs, 60000);
  assert.equal(readOnly.policy.cooldownWindowMs, 120000);
  assert.equal(engineering.presetName, "engineering");
  assert.equal(engineering.policy.dedupeWindowMs, 30000);
  assert.equal(release.presetName, "release");
  assert.ok(release.policy.cooldownWindowMs! > engineering.policy.cooldownWindowMs!);
  assert.equal(release.policy.cooldownWindowMs, 300000);
  assert.equal(localWritePreset.dedupeWindowMs, 30000);
  assert.equal(localWritePreset.cooldownWindowMs, 60000);
});

test("policy config requires explicit host routes for every task class", async () => {
  const content = await readFile(policyPath, "utf8");

  assert.throws(
    () => loadPolicyFromString(content.replace('  high_risk: "desktop"\n', "")),
    /Missing host route for task class: high_risk/
  );
});

test("policy config rejects policies without hostRoutes", async () => {
  const content = await readFile(policyPath, "utf8");
  const withoutHostRoutes = content.replace(/hostRoutes:\r?\n(?:  .+\r?\n)+approvalRules:/, "approvalRules:");

  assert.throws(
    () => loadPolicyFromString(withoutHostRoutes),
    /hostRoutes/
  );
});
