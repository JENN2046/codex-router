import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "yaml";
import {
  buildCompilerInvocation,
  createCompilerFailureScanner,
  parseToolchainExperimentArgs,
  runToolchainStabilityExperiment,
  type CompileTrialResult
} from "../scripts/run-toolchain-stability-experiment.js";

const EXACT_HEAD_SHA = "a".repeat(40);
const RUNTIME = { node: "22.23.0", v8: "12.4.254.21-node.33" };

test("toolchain experiment accepts only governed compilers and exact runtime tuples", () => {
  assert.deepEqual(parseToolchainExperimentArgs([
    "--compiler",
    "typescript-5-9",
    "--iterations",
    "20",
    "--expected-node-version",
    "22.23.0",
    "--expected-head-sha",
    EXACT_HEAD_SHA
  ]), {
    compiler: "typescript-5-9",
    iterations: 20,
    expectedNodeVersion: "22.23.0",
    expectedHeadSha: EXACT_HEAD_SHA
  });
  assert.deepEqual(parseToolchainExperimentArgs([
    "--compiler",
    "typescript",
    "--expected-node-version",
    "22.23.1",
    "--expected-head-sha",
    EXACT_HEAD_SHA
  ]), {
    compiler: "typescript",
    iterations: 20,
    expectedNodeVersion: "22.23.1",
    expectedHeadSha: EXACT_HEAD_SHA
  });

  assert.throws(
    () => parseToolchainExperimentArgs(["--compiler", "typescript-next"]),
    /toolchain_experiment_compiler_invalid/u
  );
  assert.throws(
    () => parseToolchainExperimentArgs([
      "--compiler",
      "typescript",
      "--expected-node-version",
      "22.24.0",
      "--expected-head-sha",
      EXACT_HEAD_SHA
    ]),
    /toolchain_experiment_node_version_invalid/u
  );
  assert.throws(
    () => parseToolchainExperimentArgs([
      "--compiler",
      "typescript",
      "--iterations",
      "21",
      "--expected-node-version",
      "22.23.0",
      "--expected-head-sha",
      EXACT_HEAD_SHA
    ]),
    /toolchain_experiment_iterations_invalid/u
  );
  assert.throws(
    () => parseToolchainExperimentArgs([
      "--compiler",
      "typescript",
      "--expected-node-version",
      "22.23.0",
      "--expected-head-sha",
      "not-a-sha"
    ]),
    /toolchain_experiment_head_sha_invalid/u
  );
  assert.throws(
    () => parseToolchainExperimentArgs([
      "--compiler",
      "typescript",
      "--expected-node-version",
      "22.23.0",
      "--expected-head-sha",
      EXACT_HEAD_SHA,
      "--stack-size-kb",
      "8192"
    ]),
    /toolchain_experiment_argument_unknown/u
  );
});

test("toolchain experiment records every trial and fails on any observed crash", async () => {
  const planned: CompileTrialResult[] = [
    "passed",
    "typescript_maximum_call_stack",
    "passed",
    "compiler_nonzero_exit"
  ];
  const reports: Record<string, unknown>[] = [];
  let calls = 0;
  const result = await runToolchainStabilityExperiment({
    compiler: "typescript",
    iterations: planned.length,
    expectedNodeVersion: "22.23.0",
    expectedHeadSha: EXACT_HEAD_SHA
  }, {
    compileTrial: async () => planned[calls++] as CompileTrialResult,
    resolveCompiler: async () => ({ entry: "/bounded/tsc.js", version: "6.0.3" }),
    resolveHeadSha: async () => EXACT_HEAD_SHA,
    runtimeVersions: () => RUNTIME,
    runnerImage: () => ({ os: "macOS", version: "20260715.1" }),
    report: (record) => reports.push(record)
  });

  assert.equal(calls, planned.length);
  assert.equal(reports.length, planned.length + 1);
  assert.deepEqual(result, {
    status: "failed",
    scope: "typescript_compile_stability_only",
    compiler: "typescript-6.0.3",
    compilerVersion: "6.0.3",
    nodeVersion: RUNTIME.node,
    v8Version: RUNTIME.v8,
    exactHeadSha: EXACT_HEAD_SHA,
    platform: process.platform,
    architecture: process.arch,
    runnerImageOS: "macOS",
    runnerImageVersion: "20260715.1",
    attempted: 4,
    succeeded: 2,
    failed: 2,
    failureRate: 0.5,
    failureSignatures: {
      typescript_maximum_call_stack: 1,
      compiler_nonzero_exit: 1
    },
    retryPolicyChanged: false
  });
});

test("compiler diagnostics retain only bounded failure signatures", () => {
  const stackScanner = createCompilerFailureScanner();
  stackScanner.ingest("private path /Users/example/project RangeError: Maximum call ");
  stackScanner.ingest("stack size exceeded token=private");
  assert.equal(stackScanner.signature(), "typescript_maximum_call_stack");

  const heapScanner = createCompilerFailureScanner();
  heapScanner.ingest("FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory");
  assert.equal(heapScanner.signature(), "node_heap_exhausted");

  const unknownScanner = createCompilerFailureScanner();
  unknownScanner.ingest("private compiler output");
  assert.equal(unknownScanner.signature(), "compiler_nonzero_exit");

  const longChunkScanner = createCompilerFailureScanner();
  longChunkScanner.ingest(
    `RangeError: Maximum call stack size exceeded${" private".repeat(256)}`
  );
  assert.equal(
    longChunkScanner.signature(),
    "typescript_maximum_call_stack"
  );
});

test("compiler invocation always uses the default Node stack", () => {
  assert.deepEqual(buildCompilerInvocation("/bounded/tsc.js"), [
    "/bounded/tsc.js",
    "-p",
    "tsconfig.json"
  ]);
});

test("compiler version drift fails closed", async () => {
  await assert.rejects(
    runToolchainStabilityExperiment({
      compiler: "typescript-5-9",
      iterations: 1,
      expectedNodeVersion: "22.23.0",
      expectedHeadSha: EXACT_HEAD_SHA
    }, {
      resolveCompiler: async () => ({ entry: "/bounded/tsc.js", version: "5.9.2" }),
      resolveHeadSha: async () => EXACT_HEAD_SHA,
      runtimeVersions: () => RUNTIME,
      compileTrial: async () => "passed",
      report: () => undefined
    }),
    /toolchain_experiment_compiler_version_mismatch/u
  );
});

test("runtime tuple drift fails closed before sampling", async () => {
  const common = {
    compiler: "typescript" as const,
    iterations: 1,
    expectedNodeVersion: "22.23.0" as const,
    expectedHeadSha: EXACT_HEAD_SHA
  };
  const dependencies = {
    resolveCompiler: async () => ({ entry: "/bounded/tsc.js", version: "6.0.3" }),
    compileTrial: async () => "passed" as const,
    report: () => undefined
  };

  await assert.rejects(
    runToolchainStabilityExperiment(common, {
      ...dependencies,
      resolveHeadSha: async () => EXACT_HEAD_SHA,
      runtimeVersions: () => ({ ...RUNTIME, node: "22.23.1" })
    }),
    /toolchain_experiment_node_version_mismatch/u
  );
  await assert.rejects(
    runToolchainStabilityExperiment(common, {
      ...dependencies,
      resolveHeadSha: async () => "b".repeat(40),
      runtimeVersions: () => RUNTIME
    }),
    /toolchain_experiment_head_sha_mismatch/u
  );
});

test("toolchain workflow keeps the experiment bounded and non-retrying", async () => {
  const workflowText = await readFile(
    new URL("../.github/workflows/toolchain-stability.yml", import.meta.url),
    "utf8"
  );
  const workflow = parse(workflowText) as {
    on: Record<string, unknown>;
    permissions: Record<string, string>;
    jobs: {
      "compile-stability": {
        strategy: {
          "fail-fast": boolean;
          matrix: { include: Array<Record<string, unknown>> };
        };
        steps: Array<Record<string, unknown>>;
      };
    };
  };
  const job = workflow.jobs["compile-stability"];
  const checkout = job.steps.find((step) => (
    typeof step.uses === "string" && step.uses.startsWith("actions/checkout@")
  ));

  assert.deepEqual(Object.keys(workflow.on), ["pull_request"]);
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.deepEqual(checkout?.with, {
    ref: "${{ github.event.pull_request.head.sha }}"
  });
  assert.equal(job.strategy["fail-fast"], false);
  assert.equal(job.strategy.matrix.include.length, 6);
  assert.deepEqual(job.strategy.matrix.include.map((row) => [
    row.node,
    row.compiler
  ]), [
    ["20.20.2", "typescript-5-9"],
    ["20.20.2", "typescript"],
    ["22.23.1", "typescript-5-9"],
    ["22.23.1", "typescript"],
    ["22.23.0", "typescript-5-9"],
    ["22.23.0", "typescript"]
  ]);
  assert.equal(job.steps.some((step) => "continue-on-error" in step), false);
  assert.match(workflowText, /--iterations 20/u);
  assert.match(workflowText, /--expected-node-version \$\{\{ matrix\.node \}\}/u);
  assert.match(
    workflowText,
    /--expected-head-sha \$\{\{ github\.event\.pull_request\.head\.sha \}\}/u
  );
  assert.doesNotMatch(workflowText, /stack[-_]size/iu);
  assert.doesNotMatch(workflowText, /\bretry\b/iu);
});
