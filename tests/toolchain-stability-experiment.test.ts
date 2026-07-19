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

test("toolchain experiment accepts only the governed compiler and stack variants", () => {
  assert.deepEqual(parseToolchainExperimentArgs([
    "--compiler",
    "typescript-5-9",
    "--iterations",
    "20",
    "--stack-size-kb",
    "default"
  ]), {
    compiler: "typescript-5-9",
    iterations: 20,
    stackSizeKb: "default"
  });
  assert.deepEqual(parseToolchainExperimentArgs([
    "--compiler",
    "typescript",
    "--stack-size-kb",
    "8192"
  ]), {
    compiler: "typescript",
    iterations: 20,
    stackSizeKb: "8192"
  });

  assert.throws(
    () => parseToolchainExperimentArgs(["--compiler", "typescript-next"]),
    /toolchain_experiment_compiler_invalid/u
  );
  assert.throws(
    () => parseToolchainExperimentArgs([
      "--compiler",
      "typescript",
      "--stack-size-kb",
      "16384"
    ]),
    /toolchain_experiment_stack_size_invalid/u
  );
  assert.throws(
    () => parseToolchainExperimentArgs([
      "--compiler",
      "typescript",
      "--iterations",
      "51"
    ]),
    /toolchain_experiment_iterations_invalid/u
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
    stackSizeKb: "default"
  }, {
    compileTrial: async () => planned[calls++] as CompileTrialResult,
    resolveCompiler: async () => ({ entry: "/bounded/tsc.js", version: "6.0.3" }),
    report: (record) => reports.push(record)
  });

  assert.equal(calls, planned.length);
  assert.equal(reports.length, planned.length + 1);
  assert.deepEqual(result, {
    status: "failed",
    scope: "typescript_compile_stability_only",
    compiler: "typescript-6.0.3",
    compilerVersion: "6.0.3",
    nodeVersion: process.versions.node,
    platform: process.platform,
    architecture: process.arch,
    stackSizeKb: "default",
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

test("stack-size control changes only the Node compiler invocation", () => {
  assert.deepEqual(buildCompilerInvocation("/bounded/tsc.js", "default"), [
    "/bounded/tsc.js",
    "-p",
    "tsconfig.json"
  ]);
  assert.deepEqual(buildCompilerInvocation("/bounded/tsc.js", "8192"), [
    "--stack_size=8192",
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
      stackSizeKb: "default"
    }, {
      resolveCompiler: async () => ({ entry: "/bounded/tsc.js", version: "5.9.2" }),
      compileTrial: async () => "passed",
      report: () => undefined
    }),
    /toolchain_experiment_compiler_version_mismatch/u
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
  assert.equal(job.strategy.matrix.include.length, 5);
  assert.deepEqual(job.strategy.matrix.include.map((row) => [
    row.node,
    row.compiler,
    row["stack-size-kb"]
  ]), [
    [20, "typescript-5-9", "default"],
    [20, "typescript", "default"],
    [22, "typescript-5-9", "default"],
    [22, "typescript", "default"],
    [22, "typescript", "8192"]
  ]);
  assert.equal(job.steps.some((step) => "continue-on-error" in step), false);
  assert.match(workflowText, /--iterations 20/u);
  assert.doesNotMatch(workflowText, /\bretry\b/iu);
});
