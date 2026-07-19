#!/usr/bin/env node

import { execFile as execFileCallback, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { cleanBuildOutput } from "./clean-build-output.js";

const execFile = promisify(execFileCallback);

const COMPILER_VARIANTS = {
  "typescript-5-9": {
    expectedVersion: "5.9.3",
    label: "typescript-5.9.3"
  },
  typescript: {
    expectedVersion: "6.0.3",
    label: "typescript-6.0.3"
  }
} as const;
const EXPECTED_NODE_VERSIONS = ["20.20.2", "22.23.1", "22.23.0"] as const;
const FAILURE_SIGNATURES = [
  "typescript_maximum_call_stack",
  "node_heap_exhausted",
  "clean_build_failed",
  "compiler_spawn_failed",
  "compiler_nonzero_exit"
] as const;

export type CompilerVariant = keyof typeof COMPILER_VARIANTS;
export type ExpectedNodeVersion = typeof EXPECTED_NODE_VERSIONS[number];
export type CompileFailureSignature = typeof FAILURE_SIGNATURES[number];
export type CompileTrialResult = "passed" | CompileFailureSignature;

export interface ToolchainExperimentOptions {
  compiler: CompilerVariant;
  iterations: number;
  expectedNodeVersion: ExpectedNodeVersion;
  expectedHeadSha: string;
  repositoryRoot?: string;
}

export interface ToolchainExperimentSummary {
  status: "passed" | "failed";
  scope: "typescript_compile_stability_only";
  compiler: string;
  compilerVersion: string;
  nodeVersion: string;
  v8Version: string;
  exactHeadSha: string;
  platform: NodeJS.Platform;
  architecture: string;
  runnerImageOS: string;
  runnerImageVersion: string;
  attempted: number;
  succeeded: number;
  failed: number;
  failureRate: number;
  failureSignatures: Partial<Record<CompileFailureSignature, number>>;
  retryPolicyChanged: false;
}

export interface ToolchainExperimentDependencies {
  compileTrial?: (
    options: ToolchainExperimentOptions,
    compilerEntry: string
  ) => Promise<CompileTrialResult>;
  resolveCompiler?: (
    compiler: CompilerVariant,
    repositoryRoot: string
  ) => Promise<{ entry: string; version: string }>;
  resolveHeadSha?: (repositoryRoot: string) => Promise<string>;
  runtimeVersions?: () => { node: string; v8: string };
  runnerImage?: () => { os: string; version: string };
  report?: (record: Record<string, unknown>) => void;
}

export function parseToolchainExperimentArgs(
  argv: string[]
): ToolchainExperimentOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === undefined || value === undefined || !flag.startsWith("--")) {
      throw new Error("toolchain_experiment_argument_invalid");
    }
    if (values.has(flag)) {
      throw new Error("toolchain_experiment_argument_duplicate");
    }
    values.set(flag, value);
  }

  const allowedFlags = new Set([
    "--compiler",
    "--iterations",
    "--expected-node-version",
    "--expected-head-sha"
  ]);
  for (const flag of values.keys()) {
    if (!allowedFlags.has(flag)) {
      throw new Error("toolchain_experiment_argument_unknown");
    }
  }

  const compiler = values.get("--compiler");
  if (compiler === undefined || !(compiler in COMPILER_VARIANTS)) {
    throw new Error("toolchain_experiment_compiler_invalid");
  }
  const expectedNodeVersion = values.get("--expected-node-version");
  if (!isExpectedNodeVersion(expectedNodeVersion)) {
    throw new Error("toolchain_experiment_node_version_invalid");
  }
  const expectedHeadSha = values.get("--expected-head-sha");
  if (expectedHeadSha === undefined || !/^[0-9a-f]{40}$/u.test(expectedHeadSha)) {
    throw new Error("toolchain_experiment_head_sha_invalid");
  }
  const iterationsText = values.get("--iterations") ?? "20";
  const iterations = Number(iterationsText);
  if (!Number.isSafeInteger(iterations) || iterations !== 20) {
    throw new Error("toolchain_experiment_iterations_invalid");
  }

  return {
    compiler: compiler as CompilerVariant,
    iterations,
    expectedNodeVersion,
    expectedHeadSha
  };
}

export function buildCompilerInvocation(compilerEntry: string): string[] {
  return [compilerEntry, "-p", "tsconfig.json"];
}

export function createCompilerFailureScanner(): {
  ingest: (chunk: Uint8Array | string) => void;
  signature: () => CompileFailureSignature;
} {
  let tail = "";
  let detected: CompileFailureSignature = "compiler_nonzero_exit";
  return {
    ingest(chunk) {
      const combined = `${tail}${String(chunk)}`;
      if (/Maximum call stack size exceeded/u.test(combined)) {
        detected = "typescript_maximum_call_stack";
      } else if (/heap out of memory/iu.test(combined)) {
        detected = "node_heap_exhausted";
      }
      tail = combined.slice(-512);
    },
    signature() {
      return detected;
    }
  };
}

export async function runToolchainStabilityExperiment(
  options: ToolchainExperimentOptions,
  dependencies: ToolchainExperimentDependencies = {}
): Promise<ToolchainExperimentSummary> {
  const repositoryRoot = resolve(options.repositoryRoot ?? process.cwd());
  const resolveCompiler = dependencies.resolveCompiler ?? resolveCompilerVariant;
  const resolveHeadSha = dependencies.resolveHeadSha ?? resolveRepositoryHeadSha;
  const runtimeVersions = dependencies.runtimeVersions ?? (() => ({
    node: process.versions.node,
    v8: process.versions.v8
  }));
  const runnerImage = dependencies.runnerImage ?? (() => ({
    os: boundedRunnerValue(process.env.ImageOS),
    version: boundedRunnerValue(process.env.ImageVersion)
  }));
  const compileTrial = dependencies.compileTrial ?? runCompileTrial;
  const report = dependencies.report ?? ((record) => {
    console.log(JSON.stringify(record));
  });
  const resolvedCompiler = await resolveCompiler(options.compiler, repositoryRoot);
  const expected = COMPILER_VARIANTS[options.compiler];
  if (resolvedCompiler.version !== expected.expectedVersion) {
    throw new Error("toolchain_experiment_compiler_version_mismatch");
  }
  const runtime = runtimeVersions();
  if (runtime.node !== options.expectedNodeVersion) {
    throw new Error("toolchain_experiment_node_version_mismatch");
  }
  const exactHeadSha = await resolveHeadSha(repositoryRoot);
  if (exactHeadSha !== options.expectedHeadSha) {
    throw new Error("toolchain_experiment_head_sha_mismatch");
  }
  const runner = runnerImage();

  const failureSignatures: Partial<Record<CompileFailureSignature, number>> = {};
  let succeeded = 0;
  for (let iteration = 1; iteration <= options.iterations; iteration += 1) {
    const result = await compileTrial(
      { ...options, repositoryRoot },
      resolvedCompiler.entry
    );
    if (result === "passed") {
      succeeded += 1;
    } else {
      failureSignatures[result] = (failureSignatures[result] ?? 0) + 1;
    }
    report({
      kind: "typescript_compile_stability_trial",
      iteration,
      status: result === "passed" ? "passed" : "failed",
      ...(result === "passed" ? {} : { failureSignature: result })
    });
  }

  const failed = options.iterations - succeeded;
  const summary: ToolchainExperimentSummary = {
    status: failed === 0 ? "passed" : "failed",
    scope: "typescript_compile_stability_only",
    compiler: expected.label,
    compilerVersion: resolvedCompiler.version,
    nodeVersion: runtime.node,
    v8Version: runtime.v8,
    exactHeadSha,
    platform: process.platform,
    architecture: process.arch,
    runnerImageOS: boundedRunnerValue(runner.os),
    runnerImageVersion: boundedRunnerValue(runner.version),
    attempted: options.iterations,
    succeeded,
    failed,
    failureRate: failed / options.iterations,
    failureSignatures,
    retryPolicyChanged: false
  };
  report({ kind: "typescript_compile_stability_summary", ...summary });
  return summary;
}

async function resolveCompilerVariant(
  compiler: CompilerVariant,
  repositoryRoot: string
): Promise<{ entry: string; version: string }> {
  const requireFromRepository = createRequire(resolve(repositoryRoot, "package.json"));
  const packageJsonPath = requireFromRepository.resolve(`${compiler}/package.json`);
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    version?: unknown;
  };
  if (typeof packageJson.version !== "string") {
    throw new Error("toolchain_experiment_compiler_metadata_invalid");
  }
  return {
    entry: requireFromRepository.resolve(`${compiler}/lib/tsc.js`),
    version: packageJson.version
  };
}

async function runCompileTrial(
  options: ToolchainExperimentOptions,
  compilerEntry: string
): Promise<CompileTrialResult> {
  const repositoryRoot = resolve(options.repositoryRoot ?? process.cwd());
  try {
    await cleanBuildOutput(repositoryRoot);
  } catch {
    return "clean_build_failed";
  }

  return new Promise<CompileTrialResult>((resolveResult) => {
    const scanner = createCompilerFailureScanner();
    const child = spawn(
      process.execPath,
      buildCompilerInvocation(compilerEntry),
      {
        cwd: repositoryRoot,
        env: process.env,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      }
    );
    child.stdout.on("data", scanner.ingest);
    child.stderr.on("data", scanner.ingest);
    child.once("error", () => resolveResult("compiler_spawn_failed"));
    child.once("close", (code) => {
      resolveResult(code === 0 ? "passed" : scanner.signature());
    });
  });
}

function isExpectedNodeVersion(value: string | undefined): value is ExpectedNodeVersion {
  return value !== undefined
    && (EXPECTED_NODE_VERSIONS as readonly string[]).includes(value);
}

function boundedRunnerValue(value: string | undefined): string {
  return value !== undefined && /^[A-Za-z0-9._-]{1,64}$/u.test(value)
    ? value
    : "unknown";
}

async function resolveRepositoryHeadSha(repositoryRoot: string): Promise<string> {
  const { stdout } = await execFile("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 1024
  });
  const headSha = String(stdout).trim();
  if (!/^[0-9a-f]{40}$/u.test(headSha)) {
    throw new Error("toolchain_experiment_head_sha_metadata_invalid");
  }
  return headSha;
}

async function main(): Promise<void> {
  const options = parseToolchainExperimentArgs(process.argv.slice(2));
  const result = await runToolchainStabilityExperiment(options);
  process.exitCode = result.status === "passed" ? 0 : 1;
}

if (
  process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main().catch((error: unknown) => {
    const reason = error instanceof Error && /^[a-z0-9_]+$/u.test(error.message)
      ? error.message
      : "toolchain_experiment_unknown_error";
    console.error(reason);
    process.exitCode = 1;
  });
}
