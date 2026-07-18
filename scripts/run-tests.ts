#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ISOLATED_TEST_FILE_NAMES = new Set([
  "clean-build-determinism.test.ts"
]);

export interface TestRunBatch {
  mode: "parallel" | "isolated";
  files: string[];
}

export async function discoverTestFiles(
  testDirectory = resolve(process.cwd(), "tests")
): Promise<string[]> {
  const entries = await readdir(testDirectory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".test.ts"))
    .map((entry) => resolve(testDirectory, entry.name))
    .sort(compareCodeUnits);
}

export async function runTests(
  testDirectory = resolve(process.cwd(), "tests")
): Promise<number> {
  const testFiles = await discoverTestFiles(testDirectory);
  if (testFiles.length === 0) {
    throw new Error("test_files_missing");
  }
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  delete childEnv.NODE_TEST_CONTEXT;

  for (const batch of planTestRuns(testFiles)) {
    const exitCode = await runTestBatch(batch.files, childEnv);
    if (exitCode !== 0) {
      return exitCode;
    }
  }
  return 0;
}

export function planTestRuns(testFiles: string[]): TestRunBatch[] {
  const parallelFiles = testFiles.filter(
    (file) => !ISOLATED_TEST_FILE_NAMES.has(basename(file))
  );
  const isolatedFiles = testFiles.filter(
    (file) => ISOLATED_TEST_FILE_NAMES.has(basename(file))
  );
  const batches: TestRunBatch[] = [];
  if (parallelFiles.length > 0) {
    batches.push({ mode: "parallel", files: parallelFiles });
  }
  for (const file of isolatedFiles) {
    batches.push({ mode: "isolated", files: [file] });
  }
  return batches;
}

function runTestBatch(
  testFiles: string[],
  childEnv: NodeJS.ProcessEnv
): Promise<number> {
  return new Promise<number>((resolveResult, reject) => {
    const child = spawn(process.execPath, [
      "--import",
      "tsx",
      "--test",
      ...testFiles
    ], {
      cwd: process.cwd(),
      env: childEnv,
      shell: false,
      stdio: "inherit",
      windowsHide: true
    });
    child.once("error", reject);
    child.once("close", (code) => resolveResult(code ?? 1));
  });
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function main(): Promise<void> {
  const testDirectory = process.argv[2] === undefined
    ? resolve(process.cwd(), "tests")
    : resolve(process.argv[2]);
  process.exitCode = await runTests(testDirectory);
}

if (process.argv[1] !== undefined) {
  const invoked = resolve(process.argv[1]);
  const current = resolve(fileURLToPath(import.meta.url));
  if (invoked === current) {
    await main().catch((error: unknown) => {
      const reason = error instanceof Error && /^[a-z0-9_]+$/.test(error.message)
        ? error.message
        : "test_runner_unknown_error";
      console.error(reason);
      process.exitCode = 1;
    });
  }
}
