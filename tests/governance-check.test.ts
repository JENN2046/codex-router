import test from "node:test";
import assert from "node:assert/strict";
import {
  getValidationTierPlan,
  listGovernanceChecks,
  resolveGovernanceCheck
} from "../scripts/run-governance-check.js";

test("daily validation tier stays narrow and accepts targeted tests", () => {
  const plan = getValidationTierPlan("daily", {
    targetedTests: ["tests/desktop-live-adapter.test.ts"]
  });

  assert.deepEqual(
    plan.map((command) => command.id),
    ["typecheck", "targeted-tests"]
  );
  assert.deepEqual(plan[1]?.args, ["--test", "tests/desktop-live-adapter.test.ts"]);
});

test("pr validation tier defines the normal pull request gate", () => {
  const plan = getValidationTierPlan("pr");

  assert.deepEqual(
    plan.map((command) => command.id),
    ["typecheck", "test", "build", "governance-audit-state-sync"]
  );
  assert.deepEqual(plan[3]?.args, ["scripts/run-state-sync-audit.ts"]);
});

test("release validation tier avoids external and real host smoke by default", () => {
  const plan = getValidationTierPlan("release");
  const commandIds = plan.map((command) => command.id);

  assert.deepEqual(commandIds, [
    "typecheck",
    "test",
    "build",
    "governance-audit-state-sync",
    "canary",
    "canary:write",
    "smoke:contract",
    "evidence:collect"
  ]);
  assert.equal(commandIds.includes("canary:external"), false);
  assert.equal(commandIds.includes("smoke:telemetry"), false);
  assert.equal(commandIds.includes("smoke:workspace-write:telemetry"), false);
});

test("governance check runner lists audit acceptance and operator checks", () => {
  const checks = listGovernanceChecks();

  assert.ok(checks.audit.includes("state-sync"));
  assert.ok(checks.acceptance.includes("readonly-chain"));
  assert.ok(checks.operator.includes("default"));
  assert.ok(checks.operator.includes("readonly"));
});

test("governance check runner resolves registered checks with passthrough args", () => {
  const audit = resolveGovernanceCheck("audit", "state-sync", ["--json"]);
  const acceptance = resolveGovernanceCheck("acceptance", "readonly-chain");
  const operator = resolveGovernanceCheck("operator", "readonly");

  assert.deepEqual(audit.args, ["scripts/run-state-sync-audit.ts", "--json"]);
  assert.deepEqual(acceptance.args, ["scripts/run-readonly-control-chain-acceptance.ts"]);
  assert.deepEqual(operator.args, ["scripts/run-codex-cli-operator-acceptance-readonly.ts"]);
});

test("governance check runner uses Windows command shims", () => {
  withPlatform("win32", () => {
    const daily = getValidationTierPlan("daily", {
      targetedTests: ["tests/governance-check.test.ts"]
    });
    const pr = getValidationTierPlan("pr");
    const audit = resolveGovernanceCheck("audit", "state-sync");

    assert.equal(daily[0]?.command, "npm.cmd");
    assert.equal(daily[1]?.command, "tsx.cmd");
    assert.deepEqual(daily[1]?.args, ["--test", "tests/governance-check.test.ts"]);
    assert.equal(pr[0]?.command, "npm.cmd");
    assert.equal(pr[1]?.command, "npm.cmd");
    assert.equal(pr[2]?.command, "npm.cmd");
    assert.equal(pr[3]?.command, "tsx.cmd");
    assert.equal(audit.command, "tsx.cmd");
  });
});

function withPlatform<T>(platform: NodeJS.Platform, callback: () => T): T {
  const originalDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", {
    configurable: true,
    value: platform
  });

  try {
    return callback();
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(process, "platform", originalDescriptor);
    }
  }
}
