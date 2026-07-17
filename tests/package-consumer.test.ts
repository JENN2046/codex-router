import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveNpmInvocation,
  testPackageConsumer,
  type PackageConsumerCommandInput
} from "../scripts/test-package-consumer.js";

test("package consumer builds before creating the package tarball", async () => {
  const calls: PackageConsumerCommandInput[] = [];
  const result = await testPackageConsumer(process.cwd(), {
    npmInvocation: { platform: "linux" },
    async runCommand(input) {
      calls.push(input);
      if (calls.length === 2) {
        throw new Error("injected_pack_stop");
      }
    }
  });

  assert.deepEqual(
    { command: calls[0]?.command, argv: calls[0]?.argv },
    { command: "npm", argv: ["run", "build"] }
  );
  assert.equal(calls[1]?.command, "npm");
  assert.deepEqual(
    calls[1]?.argv.slice(0, 3),
    ["pack", "--json", "--pack-destination"]
  );
  assert.equal(typeof calls[1]?.argv[3], "string");
  assert.equal(result.checks.packageBuilt, true);
  assert.equal(result.checks.exactArtifactVerified, false);
  assert.equal(result.checks.publicSubpathsRuntimeImported, false);
  assert.equal(result.checks.staleAliasesBlocked, false);
  assert.ok(result.reasons.includes("package_consumer_failed_at_pack"));
  assert.equal(result.reasons.includes("package_consumer_failed_at_build"), false);
});

test("package consumer reports build failures before attempting to pack", async () => {
  const calls: PackageConsumerCommandInput[] = [];
  const result = await testPackageConsumer(process.cwd(), {
    npmInvocation: { platform: "linux" },
    async runCommand(input) {
      calls.push(input);
      throw new Error("injected_build_failure");
    }
  });

  assert.deepEqual(calls.map(({ command, argv }) => ({ command, argv })), [{
    command: "npm",
    argv: ["run", "build"]
  }]);
  assert.equal(result.checks.packageBuilt, false);
  assert.ok(result.reasons.includes("package_consumer_failed_at_build"));
  assert.equal(result.reasons.includes("package_consumer_failed_at_pack"), false);
});

test("package consumer invokes npm through node on Windows without a shell", () => {
  assert.deepEqual(resolveNpmInvocation(["pack", "--json"], {
    platform: "win32",
    npmExecPath: "C:/node/node_modules/npm/bin/npm-cli.js"
  }), {
    command: process.execPath,
    argv: ["C:/node/node_modules/npm/bin/npm-cli.js", "pack", "--json"]
  });
});

test("package consumer requires an explicit npm CLI path on Windows", () => {
  assert.throws(() => resolveNpmInvocation(["pack"], {
    platform: "win32",
    npmExecPath: ""
  }), /package_consumer_npm_execpath_missing/u);
});

test("package consumer keeps direct npm invocation on POSIX", () => {
  assert.deepEqual(resolveNpmInvocation(["install"], {
    platform: "linux",
    npmExecPath: "/ignored/npm-cli.js"
  }), {
    command: "npm",
    argv: ["install"]
  });
});
