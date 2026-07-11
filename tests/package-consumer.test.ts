import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveNpmInvocation
} from "../scripts/test-package-consumer.js";

test("package consumer invokes npm through node on Windows without a shell", () => {
  assert.deepEqual(resolveNpmInvocation(["pack", "--json"], {
    platform: "win32",
    npmExecPath: "C:/node/node_modules/npm/bin/npm-cli.js",
    nodeExecutable: "C:/node/node.exe"
  }), {
    command: "C:/node/node.exe",
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
