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
  assert.deepEqual(
    plan[1]?.args,
    expectedTsxArgs(["--test", "tests/desktop-live-adapter.test.ts"])
  );
});

test("pr validation tier defines the normal pull request gate", () => {
  const plan = getValidationTierPlan("pr");

  assert.deepEqual(
    plan.map((command) => command.id),
    ["typecheck", "test", "build", "docs:governance", "governance-audit-state-sync"]
  );
  assert.deepEqual(
    plan[4]?.args,
    expectedTsxArgs(["scripts/run-state-sync-audit.ts"])
  );
});

test("release validation tier avoids external and real host smoke by default", () => {
  const plan = getValidationTierPlan("release");
  const commandIds = plan.map((command) => command.id);

  assert.deepEqual(commandIds, [
    "typecheck",
    "test",
    "build",
    "docs:governance",
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

test("governance check runner default list shows current checks only", () => {
  const checks = listGovernanceChecks();

  assert.ok(checks.audit.includes("state-sync"));
  assert.ok(checks.audit.includes("readonly-productization"));
  assert.ok(checks.audit.includes("controlled-provider-execution-taskbook-review"));
  assert.ok(checks.acceptance.includes("readonly-chain"));
  assert.ok(checks.acceptance.includes("controlled-readonly-provider-execution"));
  assert.ok(checks.operator.includes("readonly"));
  assert.equal(checks.audit.includes("future-codex-cli-canary-execution-gate"), false);
  assert.equal(checks.acceptance.includes("workspace-write-real-canary-auth"), false);
  assert.equal(checks.operator.includes("telemetry"), false);
});

test("governance check runner all list keeps archived checks discoverable", () => {
  const checks = listGovernanceChecks({ includeArchived: true });

  assert.ok(checks.audit.includes("state-sync"));
  assert.ok(checks.audit.includes("future-codex-cli-canary-execution-gate"));
  assert.ok(checks.acceptance.includes("readonly-chain"));
  assert.ok(checks.acceptance.includes("workspace-write-real-canary-auth"));
  assert.ok(checks.operator.includes("default"));
  assert.ok(checks.operator.includes("readonly"));
  assert.ok(checks.operator.includes("telemetry"));
});

test("governance check runner resolves registered checks with passthrough args", () => {
  const audit = resolveGovernanceCheck("audit", "state-sync", ["--json"]);
  const acceptance = resolveGovernanceCheck("acceptance", "readonly-chain");
  const operator = resolveGovernanceCheck("operator", "readonly");
  const archived = resolveGovernanceCheck("audit", "future-codex-cli-canary-execution-gate");

  assert.deepEqual(
    audit.args,
    expectedTsxArgs(["scripts/run-state-sync-audit.ts", "--json"])
  );
  assert.deepEqual(
    acceptance.args,
    expectedTsxArgs(["scripts/run-readonly-control-chain-acceptance.ts"])
  );
  assert.deepEqual(
    operator.args,
    expectedTsxArgs(["scripts/run-codex-cli-operator-acceptance-readonly.ts"])
  );
  assert.deepEqual(
    archived.args,
    expectedTsxArgs(["scripts/run-future-codex-cli-canary-execution-gate-audit.ts"])
  );
});

test("governance check runner avoids Windows command shims for tsx", () => {
  withPlatform("win32", () => {
    const daily = getValidationTierPlan("daily", {
      targetedTests: ["tests/governance-check.test.ts"]
    });
    const pr = getValidationTierPlan("pr");
    const audit = resolveGovernanceCheck("audit", "state-sync");
    const expectedNpmCommand = process.env.npm_execpath
      ? process.execPath
      : "npm.cmd";

    assert.equal(daily[0]?.command, expectedNpmCommand);
    assert.equal(daily[1]?.command, process.execPath);
    assert.deepEqual(daily[1]?.args, [
      "node_modules/tsx/dist/cli.mjs",
      "--test",
      "tests/governance-check.test.ts"
    ]);
    assert.equal(pr[0]?.command, expectedNpmCommand);
    assert.equal(pr[1]?.command, expectedNpmCommand);
    assert.equal(pr[2]?.command, expectedNpmCommand);
    assert.equal(pr[3]?.command, expectedNpmCommand);
    assert.equal(pr[4]?.command, process.execPath);
    assert.equal(audit.command, process.execPath);
    assert.deepEqual(audit.args, [
      "node_modules/tsx/dist/cli.mjs",
      "scripts/run-state-sync-audit.ts"
    ]);
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

function expectedTsxArgs(args: string[]): string[] {
  return process.platform === "win32"
    ? ["node_modules/tsx/dist/cli.mjs", ...args]
    : args;
}
