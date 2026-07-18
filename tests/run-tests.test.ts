import assert from "node:assert/strict";
import test from "node:test";
import { planTestRuns } from "../scripts/run-tests.js";

test("test runner isolates clean-build determinism from parallel tests", () => {
  assert.deepEqual(planTestRuns([
    "/workspace/tests/alpha.test.ts",
    "/workspace/tests/clean-build-determinism.test.ts",
    "/workspace/tests/omega.test.ts"
  ]), [
    {
      mode: "parallel",
      files: [
        "/workspace/tests/alpha.test.ts",
        "/workspace/tests/omega.test.ts"
      ]
    },
    {
      mode: "isolated",
      files: ["/workspace/tests/clean-build-determinism.test.ts"]
    }
  ]);
});

test("test runner keeps all ordinary tests in one parallel batch", () => {
  assert.deepEqual(planTestRuns([
    "/workspace/tests/alpha.test.ts",
    "/workspace/tests/omega.test.ts"
  ]), [{
    mode: "parallel",
    files: [
      "/workspace/tests/alpha.test.ts",
      "/workspace/tests/omega.test.ts"
    ]
  }]);
});
